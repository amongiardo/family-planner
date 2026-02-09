import { Router } from 'express';
import bcrypt from 'bcryptjs';
import passport from 'passport';
import prisma from '../prisma';

const router = Router();

function sanitizeUser(user: any) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

// Google OAuth
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
  }),
  (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }
);

// GitHub OAuth
router.get(
  '/github',
  passport.authenticate('github', {
    scope: ['user:email'],
  })
);

router.get(
  '/github/callback',
  passport.authenticate('github', {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
  }),
  (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }
);

// Local auth (email/password)
router.post('/local/register', async (req, res, next) => {
  try {
    const { email, password, name, inviteToken } = req.body ?? {};
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing email, password, or name' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    let familyId: string | undefined;
    if (inviteToken) {
      const invite = await prisma.familyInvite.findUnique({ where: { token: inviteToken } });
      if (
        invite &&
        !invite.usedAt &&
        invite.expiresAt > new Date() &&
        invite.email === email
      ) {
        familyId = invite.familyId;
        await prisma.familyInvite.update({
          where: { id: invite.id },
          data: { usedAt: new Date() },
        });
      }
    }

    if (!familyId) {
      const family = await prisma.family.create({
        data: {
          name: `${name}'s Family`,
        },
      });
      familyId = family.id;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        familyId,
        email,
        name,
        oauthProvider: 'local',
        oauthId: email,
        passwordHash,
      },
    });

    req.login(user, (err) => {
      if (err) {
        return next(err);
      }
      res.json({ user: sanitizeUser(user) });
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

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return res
        .status(401)
        .json({ error: "Utente non trovato. Registrati per continuare." });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    req.login(user, (err) => {
      if (err) {
        return next(err);
      }
      res.json({ user: sanitizeUser(user) });
    });
  } catch (error) {
    next(error);
  }
});

// Get current user (returns null when not authenticated)
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  res.json({
    user: sanitizeUser(req.user),
  });
});

// Logout
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
});

export default router;
