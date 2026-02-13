import { Router } from 'express';
import bcrypt from 'bcryptjs';
import passport from 'passport';
import prisma from '../prisma';
import { generateFamilyAuthCode } from '../utils/familyAuthCode';

const router = Router();

function sanitizeUser(user: any) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

async function resolveActiveFamilyId(userId: string, current?: string) {
  if (current) {
    const currentMembership = await prisma.familyMember.findUnique({
      where: {
        familyId_userId: {
          familyId: current,
          userId,
        },
      },
      select: { familyId: true },
    });
    if (currentMembership) return currentMembership.familyId;
  }

  const firstMembership = await prisma.familyMember.findFirst({
    where: { userId },
    orderBy: [{ createdAt: 'asc' }, { familyId: 'asc' }],
    select: { familyId: true },
  });

  return firstMembership?.familyId;
}

async function buildAuthPayload(userId: string, activeFamilyId?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { user: null };

  const memberships = await prisma.familyMember.findMany({
    where: { userId },
    include: {
      family: {
        select: {
          id: true,
          name: true,
          city: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { familyId: 'asc' }],
  });

  const resolvedActiveFamilyId = activeFamilyId || (await resolveActiveFamilyId(userId));
  const activeMembership = memberships.find((m) => m.familyId === resolvedActiveFamilyId) || memberships[0];

  return {
    user: {
      ...sanitizeUser(user),
      // Backward-compatible fields used by existing frontend.
      familyId: activeMembership?.familyId,
      role: activeMembership?.role,
      activeFamilyId: activeMembership?.familyId,
      families: memberships.map((m) => ({
        id: m.family.id,
        name: m.family.name,
        city: m.family.city,
        createdAt: m.family.createdAt,
        role: m.role,
      })),
    },
  };
}

async function attachInviteMembershipForUser(userId: string, email: string, inviteToken?: string) {
  if (!inviteToken) return undefined;

  const invite = await prisma.familyInvite.findUnique({ where: { token: inviteToken } });
  if (!invite || invite.usedAt || invite.expiresAt <= new Date()) return undefined;
  if (invite.email.toLowerCase() !== email.toLowerCase()) return undefined;

  await prisma.$transaction(async (tx) => {
    await tx.familyMember.upsert({
      where: {
        familyId_userId: {
          familyId: invite.familyId,
          userId,
        },
      },
      update: {},
      create: {
        familyId: invite.familyId,
        userId,
        role: 'member',
      },
    });

    await tx.familyInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });
  });

  return invite.familyId;
}

// Google OAuth
router.get(
  '/google',
  (req, _res, next) => {
    const invite = typeof req.query.invite === 'string' ? req.query.invite : undefined;
    if (invite) {
      req.session.inviteToken = invite;
    }
    next();
  },
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
  }),
  async (req, res, next) => {
    try {
      if (!req.user) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
      }
      const activeFamilyId = await resolveActiveFamilyId(req.user.id, req.session.activeFamilyId);
      req.session.activeFamilyId = activeFamilyId;
      res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
    } catch (error) {
      next(error);
    }
  }
);

// GitHub OAuth
router.get(
  '/github',
  (req, _res, next) => {
    const invite = typeof req.query.invite === 'string' ? req.query.invite : undefined;
    if (invite) {
      req.session.inviteToken = invite;
    }
    next();
  },
  passport.authenticate('github', {
    scope: ['user:email'],
  })
);

router.get(
  '/github/callback',
  passport.authenticate('github', {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
  }),
  async (req, res, next) => {
    try {
      if (!req.user) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
      }
      const activeFamilyId = await resolveActiveFamilyId(req.user.id, req.session.activeFamilyId);
      req.session.activeFamilyId = activeFamilyId;
      res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
    } catch (error) {
      next(error);
    }
  }
);

// Local auth (email/password)
router.post('/local/register', async (req, res, next) => {
  try {
    const { email, password, name, inviteToken, familyName } = req.body ?? {};
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing email, password, or name' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    let inviteFamilyId: string | undefined;
    if (inviteToken) {
      const invite = await prisma.familyInvite.findUnique({ where: { token: inviteToken } });
      if (
        !invite ||
        invite.usedAt ||
        invite.expiresAt <= new Date() ||
        invite.email.toLowerCase() !== normalizedEmail
      ) {
        return res.status(400).json({ error: 'Invite not valid for this email' });
      }
      inviteFamilyId = invite.familyId;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name,
        oauthProvider: 'local',
        oauthId: normalizedEmail,
        passwordHash,
      },
    });

    let activeFamilyId: string | undefined;

    if (inviteToken) {
      if (!inviteFamilyId) {
        return res.status(400).json({ error: 'Invite not valid for this email' });
      }
      await prisma.$transaction(async (tx) => {
        await tx.familyMember.upsert({
          where: {
            familyId_userId: {
              familyId: inviteFamilyId!,
              userId: user.id,
            },
          },
          update: {},
          create: {
            familyId: inviteFamilyId!,
            userId: user.id,
            role: 'member',
          },
        });

        await tx.familyInvite.updateMany({
          where: {
            token: inviteToken,
            familyId: inviteFamilyId!,
            usedAt: null,
          },
          data: { usedAt: new Date() },
        });
      });
      activeFamilyId = inviteFamilyId;
    } else {
      if (!familyName || typeof familyName !== 'string' || !familyName.trim()) {
        return res.status(400).json({ error: 'Missing family name' });
      }

      const family = await prisma.family.create({
        data: {
          name: familyName.trim(),
          authCode: generateFamilyAuthCode(5),
        },
      });

      await prisma.familyMember.create({
        data: {
          familyId: family.id,
          userId: user.id,
          role: 'admin',
        },
      });

      activeFamilyId = family.id;
    }

    req.login(user, async (err) => {
      if (err) {
        return next(err);
      }
      req.session.activeFamilyId = activeFamilyId;
      res.json(await buildAuthPayload(user.id, activeFamilyId));
    });
  } catch (error) {
    next(error);
  }
});

router.post('/local/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.passwordHash) {
      return res
        .status(401)
        .json({ error: 'Utente non trovato. Registrati per continuare.' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const sessionInviteToken = req.session.inviteToken;
    let inviteFamilyId: string | undefined;
    if (sessionInviteToken) {
      inviteFamilyId = await attachInviteMembershipForUser(user.id, normalizedEmail, sessionInviteToken);
      delete req.session.inviteToken;
    }

    req.login(user, async (err) => {
      if (err) {
        return next(err);
      }

      const activeFamilyId =
        inviteFamilyId || (await resolveActiveFamilyId(user.id, req.session.activeFamilyId));
      req.session.activeFamilyId = activeFamilyId;
      res.json(await buildAuthPayload(user.id, activeFamilyId));
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    if (!req.user) {
      return res.json({ user: null });
    }

    const activeFamilyId = await resolveActiveFamilyId(req.user.id, req.session.activeFamilyId);
    req.session.activeFamilyId = activeFamilyId;
    res.json(await buildAuthPayload(req.user.id, activeFamilyId));
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        return next(destroyErr);
      }
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
});

export default router;
