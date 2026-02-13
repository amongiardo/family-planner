import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';
import prisma from '../prisma';
import { isAuthenticated, getFamilyId, getFamilyRole } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';
import { requireFamilyAuthCode } from '../middleware/familyAuthCode';
import { generateFamilyAuthCode } from '../utils/familyAuthCode';

const router = Router();

function toFamilyResponse(family: any, role: 'admin' | 'member', includeAuthCode: boolean) {
  return {
    id: family.id,
    name: family.name,
    city: family.city,
    authCode: includeAuthCode ? family.authCode : undefined,
    createdAt: family.createdAt,
    users: (family.memberships || []).map((membership: any) => ({
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      avatarUrl: membership.user.avatarUrl,
      role: membership.role,
    })),
    role,
  };
}

type InviteValidationResult =
  | { ok: true; invite: any }
  | { ok: false; error: string; status: number };

async function ensureInviteValid(token: string): Promise<InviteValidationResult> {
  const invite = await prisma.familyInvite.findUnique({
    where: { token },
    include: {
      family: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!invite) return { ok: false, error: 'Invite not found', status: 404 };
  if (invite.usedAt) return { ok: false, error: 'Invite already used', status: 400 };
  if (invite.expiresAt < new Date()) return { ok: false, error: 'Invite expired', status: 400 };

  return { ok: true, invite };
}

// Get active family
router.get('/', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const role = getFamilyRole(req);

    let family = await prisma.family.findUnique({
      where: { id: familyId },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }

    if (role === 'admin' && !family.authCode) {
      family = await prisma.family.update({
        where: { id: familyId },
        data: { authCode: generateFamilyAuthCode(5) },
        include: {
          memberships: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });
    }

    res.json(toFamilyResponse(family, role, role === 'admin'));
  } catch (error) {
    next(error);
  }
});

// List families for current user
router.get('/mine', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const activeFamilyId = getFamilyId(req);

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

    res.json({
      activeFamilyId,
      families: memberships.map((m) => ({
        id: m.family.id,
        name: m.family.name,
        city: m.family.city,
        createdAt: m.family.createdAt,
        role: m.role,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Switch active family in session
router.post('/switch', isAuthenticated, async (req, res, next) => {
  try {
    const { familyId } = req.body ?? {};
    if (!familyId || typeof familyId !== 'string') {
      return res.status(400).json({ error: 'Family ID is required' });
    }

    const membership = await prisma.familyMember.findUnique({
      where: {
        familyId_userId: {
          familyId,
          userId: req.user!.id,
        },
      },
      select: { familyId: true },
    });

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of selected family' });
    }

    req.session.activeFamilyId = familyId;
    res.json({ success: true, activeFamilyId: familyId });
  } catch (error) {
    next(error);
  }
});

// Create a new family and join as admin
router.post('/create', isAuthenticated, async (req, res, next) => {
  try {
    const { name, city, switchToNewFamily } = req.body ?? {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Family name is required' });
    }

    const family = await prisma.family.create({
      data: {
        name: name.trim(),
        city: typeof city === 'string' && city.trim() ? city.trim() : 'Roma',
        authCode: generateFamilyAuthCode(5),
      },
    });

    await prisma.familyMember.create({
      data: {
        familyId: family.id,
        userId: req.user!.id,
        role: 'admin',
      },
    });

    const shouldSwitch = switchToNewFamily !== false;
    if (shouldSwitch) {
      req.session.activeFamilyId = family.id;
    }

    res.status(201).json({
      family: {
        id: family.id,
        name: family.name,
        city: family.city,
        createdAt: family.createdAt,
        role: 'admin',
      },
      activeFamilyId: shouldSwitch ? family.id : req.session.activeFamilyId,
    });
  } catch (error) {
    next(error);
  }
});

// Update active family name / city
router.put('/', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { name, city } = req.body;

    if ((!name || typeof name !== 'string') && (!city || typeof city !== 'string')) {
      return res.status(400).json({ error: 'Name or city is required' });
    }

    const family = await prisma.family.update({
      where: { id: familyId },
      data: {
        ...(name && typeof name === 'string' ? { name: name.trim() } : {}),
        ...(city && typeof city === 'string' ? { city: city.trim() } : {}),
      },
    });

    res.json(family);
  } catch (error) {
    next(error);
  }
});

// Regenerate destructive-action auth code (active family, admin only)
router.post('/auth-code/regenerate', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const authCode = generateFamilyAuthCode(5);
    const family = await prisma.family.update({
      where: { id: familyId },
      data: { authCode },
      select: { authCode: true },
    });
    res.json({ authCode: family.authCode });
  } catch (error) {
    next(error);
  }
});

// Create invite for active family
router.post('/invite', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const alreadyMember = await prisma.familyMember.findFirst({
      where: {
        familyId,
        user: {
          email: normalizedEmail,
        },
      },
      select: { id: true },
    });

    if (alreadyMember) {
      return res.status(400).json({ error: 'User already in family' });
    }

    const token = uuidv4();
    const expiresAt = addDays(new Date(), 7);

    const invite = await prisma.familyInvite.create({
      data: {
        familyId,
        email: normalizedEmail,
        token,
        expiresAt,
      },
    });

    const inviteUrl = `${process.env.FRONTEND_URL}/invite/${token}`;

    res.json({
      invite: {
        id: invite.id,
        email: invite.email,
        expiresAt: invite.expiresAt,
        inviteUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get pending invites for active family
router.get('/invites', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);

    const invites = await prisma.familyInvite.findMany({
      where: {
        familyId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        createdAt: true,
        token: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const baseUrl = process.env.FRONTEND_URL;
    res.json(
      invites.map((invite) => ({
        ...invite,
        inviteUrl: baseUrl ? `${baseUrl}/invite/${invite.token}` : undefined,
      }))
    );
  } catch (error) {
    next(error);
  }
});

// Delete invite
router.delete('/invites/:id', isAuthenticated, requireAdmin, requireFamilyAuthCode, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { id } = req.params;

    await prisma.familyInvite.deleteMany({
      where: {
        id,
        familyId,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Accept invite for an already authenticated user
router.post('/invite/:token/accept', isAuthenticated, async (req, res, next) => {
  try {
    const user = req.user!;
    const { token } = req.params;

    const result = await ensureInviteValid(token);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    const invite = result.invite;

    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return res.status(403).json({ error: 'Invite email does not match current user' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.familyMember.upsert({
        where: {
          familyId_userId: {
            familyId: invite.familyId,
            userId: user.id,
          },
        },
        update: {},
        create: {
          familyId: invite.familyId,
          userId: user.id,
          role: 'member',
        },
      });

      await tx.familyInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });
    });

    req.session.activeFamilyId = invite.familyId;
    res.json({ success: true, activeFamilyId: invite.familyId });
  } catch (error) {
    next(error);
  }
});

// Update member role in active family (admin only)
router.put('/members/:userId/role', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { userId } = req.params;
    const { role } = req.body ?? {};

    if (role !== 'admin' && role !== 'member') {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const target = await prisma.familyMember.findUnique({
      where: {
        familyId_userId: {
          familyId,
          userId,
        },
      },
      select: { userId: true, role: true },
    });

    if (!target) {
      return res.status(404).json({ error: 'User not found in family' });
    }

    if (target.role === 'admin' && role === 'member') {
      const adminCount = await prisma.familyMember.count({
        where: { familyId, role: 'admin' },
      });
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Non puoi rimuovere l’ultimo admin della famiglia' });
      }
    }

    const updated = await prisma.familyMember.update({
      where: {
        familyId_userId: {
          familyId,
          userId,
        },
      },
      data: { role },
      select: { userId: true, role: true },
    });

    res.json({ user: { id: updated.userId, role: updated.role } });
  } catch (error) {
    next(error);
  }
});

// Validate invite token (public)
router.get('/invite/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const result = await ensureInviteValid(token);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    const invite = result.invite;

    res.json({
      email: invite.email,
      family: invite.family,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
