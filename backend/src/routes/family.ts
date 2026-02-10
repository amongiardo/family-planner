import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';
import prisma from '../prisma';
import { isAuthenticated, getFamilyId } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';
import { requireFamilyAuthCode } from '../middleware/familyAuthCode';
import { generateFamilyAuthCode } from '../utils/familyAuthCode';

const router = Router();

// Get current family
router.get('/', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);

    let family = await prisma.family.findUnique({
      where: { id: familyId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
    });

    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }

    // Backfill auth code for existing families (only if admin requests it).
    if (req.user?.role === 'admin' && !family.authCode) {
      family = await prisma.family.update({
        where: { id: familyId },
        data: { authCode: generateFamilyAuthCode(5) },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              role: true,
            },
          },
        },
      });
    }

    // Hide authCode from non-admin members.
    const { authCode, ...safeFamily } = family as any;
    res.json(req.user?.role === 'admin' ? family : safeFamily);
  } catch (error) {
    next(error);
  }
});

// Update family name / city
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
        ...(name && typeof name === 'string' ? { name } : {}),
        ...(city && typeof city === 'string' ? { city: city.trim() } : {}),
      },
    });

    res.json(family);
  } catch (error) {
    next(error);
  }
});

// Regenerate destructive-action auth code (admin only)
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

// Create invite
router.post('/invite', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user already exists in this family
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        familyId,
      },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already in family' });
    }

    // Create invite token
    const token = uuidv4();
    const expiresAt = addDays(new Date(), 7);

    const invite = await prisma.familyInvite.create({
      data: {
        familyId,
        email,
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

// Get pending invites
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

// Update member role (admin only)
router.put('/members/:userId/role', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { userId } = req.params;
    const { role } = req.body ?? {};

    if (role !== 'admin' && role !== 'member') {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const target = await prisma.user.findFirst({
      where: { id: userId, familyId },
      select: { id: true, role: true },
    });

    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent demoting the last admin of the family.
    if (target.role === 'admin' && role === 'member') {
      const adminCount = await prisma.user.count({
        where: { familyId, role: 'admin' },
      });
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Non puoi rimuovere l’ultimo admin della famiglia' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, role: true },
    });

    res.json({ user: updated });
  } catch (error) {
    next(error);
  }
});

// Validate invite token (public route)
router.get('/invite/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

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

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    if (invite.usedAt) {
      return res.status(400).json({ error: 'Invite already used' });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invite expired' });
    }

    res.json({
      email: invite.email,
      family: invite.family,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
