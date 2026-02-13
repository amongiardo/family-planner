import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';
import prisma from '../prisma';
import { isAuthenticated, isLoggedIn, getFamilyId, getFamilyRole } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';
import { ensureUserAuthCode, readProvidedCode, requireFamilyAuthCode } from '../middleware/familyAuthCode';
import { generateFamilyAuthCode, isValidFamilyAuthCode } from '../utils/familyAuthCode';

const router = Router();

type FamilyRole = 'admin' | 'member';
type CitySelectionInput = {
  name: string;
  displayName?: string;
  country?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
};

type InviteValidationResult =
  | { ok: true; invite: any }
  | { ok: false; error: string; status: number };

function toFamilyResponse(family: any, role: FamilyRole, authCode?: string) {
  return {
    id: family.id,
    name: family.name,
    city: family.city,
    cityDisplayName: family.cityDisplayName,
    cityCountry: family.cityCountry,
    cityTimezone: family.cityTimezone,
    cityLatitude: family.cityLatitude,
    cityLongitude: family.cityLongitude,
    authCode,
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

const ACTIVE_FAMILY_FILTER = { deletedAt: null };

function normalizeCitySelection(input: unknown): CitySelectionInput | null {
  if (!input || typeof input !== 'object') return null;

  const payload = input as Record<string, unknown>;
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) return null;

  const latitudeRaw = payload.latitude;
  const longitudeRaw = payload.longitude;
  const latitude = typeof latitudeRaw === 'number' ? latitudeRaw : Number(latitudeRaw);
  const longitude = typeof longitudeRaw === 'number' ? longitudeRaw : Number(longitudeRaw);

  return {
    name,
    displayName: typeof payload.displayName === 'string' ? payload.displayName.trim() : undefined,
    country: typeof payload.country === 'string' ? payload.country.trim() : undefined,
    timezone: typeof payload.timezone === 'string' ? payload.timezone.trim() : undefined,
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
  };
}

async function ensureInviteValid(token: string): Promise<InviteValidationResult> {
  const invite = await prisma.familyInvite.findUnique({
    where: { token },
    include: {
      family: {
        select: {
          id: true,
          name: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!invite) return { ok: false, error: 'Invite not found', status: 404 };
  if (invite.usedAt) return { ok: false, error: 'Invite already used', status: 400 };
  if (invite.expiresAt < new Date()) return { ok: false, error: 'Invite expired', status: 400 };
  if (invite.family.deletedAt) return { ok: false, error: 'Family no longer available', status: 410 };

  return { ok: true, invite };
}

// Get active family
router.get('/', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const role = getFamilyRole(req);
    const userAuthCode = await ensureUserAuthCode(req.user!.id);

    const family = await prisma.family.findFirst({
      where: { id: familyId, ...ACTIVE_FAMILY_FILTER },
      include: {
        memberships: {
          where: { status: 'active' },
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

    res.json(toFamilyResponse(family, role, userAuthCode));
  } catch (error) {
    next(error);
  }
});

// List active/former families for current user
router.get('/mine', isLoggedIn, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const activeFamilyId = req.activeFamilyId || null;

    const memberships = await prisma.familyMember.findMany({
      where: { userId },
      include: {
        family: {
          select: {
            id: true,
            name: true,
            city: true,
            createdAt: true,
            deletedAt: true,
            createdByUser: {
              select: {
                name: true,
                email: true,
              },
            },
            deletedByUser: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { familyId: 'asc' }],
    });

    const familyIds = Array.from(new Set(memberships.map((m) => m.familyId)));
    const activeCounts = familyIds.length
      ? await prisma.familyMember.groupBy({
          by: ['familyId'],
          where: { familyId: { in: familyIds }, status: 'active' },
          _count: { _all: true },
        })
      : [];
    const countMap = new Map(activeCounts.map((c) => [c.familyId, c._count._all]));

    const activeFamilies = memberships
      .filter((m) => m.status === 'active' && !m.family.deletedAt)
      .map((m) => ({
        id: m.family.id,
        name: m.family.name,
        city: m.family.city,
        createdAt: m.family.createdAt,
        role: m.role,
        membersCount: countMap.get(m.family.id) || 0,
        status: 'active' as const,
      }));

    const formerFamilies = memberships
      .filter((m) => m.status === 'left' || Boolean(m.family.deletedAt))
      .map((m) => ({
        id: m.family.id,
        name: m.family.name,
        city: m.family.city,
        createdAt: m.family.createdAt,
        role: m.role,
        membersCount: !m.family.deletedAt ? countMap.get(m.family.id) || 0 : 0,
        status: 'left' as const,
        leftAt: m.leftAt,
        familyDeletedAt: m.family.deletedAt,
        creatorName: m.family.createdByUser?.name || null,
        creatorEmail: m.family.createdByUser?.email || null,
        deletedByName: m.family.deletedByUser?.name || null,
        deletedByEmail: m.family.deletedByUser?.email || null,
        canRejoin: !m.family.deletedAt,
      }));

    res.json({ activeFamilyId, families: activeFamilies, formerFamilies });
  } catch (error) {
    next(error);
  }
});

// Switch active family in session
router.post('/switch', isLoggedIn, async (req, res, next) => {
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
      select: {
        familyId: true,
        status: true,
        family: {
          select: {
            deletedAt: true,
          },
        },
      },
    });

    if (!membership || membership.status !== 'active' || membership.family.deletedAt) {
      return res.status(403).json({ error: 'Not an active member of selected family' });
    }

    req.session.activeFamilyId = familyId;
    res.json({ success: true, activeFamilyId: familyId });
  } catch (error) {
    next(error);
  }
});

// Create a new family and join as admin
router.post('/create', isLoggedIn, async (req, res, next) => {
  try {
    const { name, city, citySelection, switchToNewFamily } = req.body ?? {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Family name is required' });
    }

    const normalizedCitySelection = normalizeCitySelection(citySelection);
    const normalizedCity =
      normalizedCitySelection?.name ||
      (typeof city === 'string' && city.trim() ? city.trim() : 'Roma');

    const family = await prisma.family.create({
      data: {
        name: name.trim(),
        city: normalizedCity,
        cityDisplayName: normalizedCitySelection?.displayName,
        cityCountry: normalizedCitySelection?.country,
        cityTimezone: normalizedCitySelection?.timezone,
        cityLatitude: normalizedCitySelection?.latitude,
        cityLongitude: normalizedCitySelection?.longitude,
        createdByUserId: req.user!.id,
      },
    });

    await prisma.familyMember.create({
      data: {
        familyId: family.id,
        userId: req.user!.id,
        role: 'admin',
        status: 'active',
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
        cityDisplayName: family.cityDisplayName,
        cityCountry: family.cityCountry,
        cityTimezone: family.cityTimezone,
        cityLatitude: family.cityLatitude,
        cityLongitude: family.cityLongitude,
        createdAt: family.createdAt,
        role: 'admin',
      },
      activeFamilyId: shouldSwitch ? family.id : req.session.activeFamilyId,
    });
  } catch (error) {
    next(error);
  }
});

// Leave family (only non-admin)
router.post('/:familyId/leave', isLoggedIn, async (req, res, next) => {
  try {
    const { familyId } = req.params;
    const userId = req.user!.id;

    const membership = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
      select: {
        role: true,
        status: true,
        family: {
          select: {
            deletedAt: true,
          },
        },
      },
    });

    if (!membership || membership.status !== 'active') {
      return res.status(404).json({ error: 'Active membership not found' });
    }
    if (membership.family.deletedAt) {
      return res.status(400).json({ error: 'La famiglia risulta gia cancellata' });
    }

    if (membership.role === 'admin') {
      return res.status(400).json({ error: 'Gli admin non possono abbandonare la famiglia da questa azione' });
    }

    await prisma.familyMember.update({
      where: { familyId_userId: { familyId, userId } },
      data: { status: 'left', leftAt: new Date() },
    });

    if (req.session.activeFamilyId === familyId) {
      const fallback = await prisma.familyMember.findFirst({
        where: { userId, status: 'active', family: { deletedAt: null } },
        orderBy: [{ createdAt: 'asc' }, { familyId: 'asc' }],
        select: { familyId: true },
      });
      req.session.activeFamilyId = fallback?.familyId;
    }

    res.json({ success: true, activeFamilyId: req.session.activeFamilyId || null });
  } catch (error) {
    next(error);
  }
});

// Rejoin a former family
router.post('/:familyId/rejoin', isLoggedIn, async (req, res, next) => {
  try {
    const { familyId } = req.params;
    const userId = req.user!.id;

    const membership = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
      select: {
        status: true,
        family: {
          select: {
            deletedAt: true,
          },
        },
      },
    });

    if (!membership || membership.status !== 'left') {
      return res.status(404).json({ error: 'Former membership not found' });
    }
    if (membership.family.deletedAt) {
      return res.status(400).json({ error: 'La famiglia e stata eliminata e non e possibile rientrare' });
    }

    await prisma.familyMember.update({
      where: { familyId_userId: { familyId, userId } },
      data: { status: 'active', leftAt: null },
    });

    req.session.activeFamilyId = familyId;
    res.json({ success: true, activeFamilyId: familyId });
  } catch (error) {
    next(error);
  }
});

// Permanently remove a former family membership
router.delete('/:familyId/former-membership', isLoggedIn, async (req, res, next) => {
  try {
    const { familyId } = req.params;
    const userId = req.user!.id;

    const membership = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
      select: { status: true },
    });

    if (!membership || membership.status !== 'left') {
      return res.status(404).json({ error: 'Former membership not found' });
    }

    await prisma.familyMember.delete({
      where: { familyId_userId: { familyId, userId } },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Delete entire family (admin only, requires auth code)
router.delete('/:familyId', isLoggedIn, async (req, res, next) => {
  try {
    const { familyId } = req.params;
    const userId = req.user!.id;
    const { targetFamilyId } = (req.body ?? {}) as { targetFamilyId?: string };
    const isDeletingActiveFamily = req.session.activeFamilyId === familyId;

    const membership = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
      select: {
        role: true,
        status: true,
        family: {
          select: {
            deletedAt: true,
          },
        },
      },
    });

    if (!membership || membership.status !== 'active') {
      return res.status(403).json({ error: 'Not an active member of this family' });
    }
    if (membership.family.deletedAt) {
      return res.status(404).json({ error: 'Family not found' });
    }

    if (membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can delete the family' });
    }

    // Check if this is the only family
    const activeFamiliesCount = await prisma.familyMember.count({
      where: { userId, status: 'active', family: ACTIVE_FAMILY_FILTER },
    });
    if (activeFamiliesCount <= 1) {
      return res.status(400).json({ error: 'Non puoi eliminare l\'unica famiglia di cui fai parte' });
    }

    if (isDeletingActiveFamily) {
      if (!targetFamilyId || typeof targetFamilyId !== 'string') {
        return res.status(400).json({ error: 'Seleziona la famiglia di destinazione prima di eliminare quella attiva' });
      }

      if (targetFamilyId === familyId) {
        return res.status(400).json({ error: 'La famiglia di destinazione deve essere diversa da quella da eliminare' });
      }

      const targetMembership = await prisma.familyMember.findUnique({
        where: { familyId_userId: { familyId: targetFamilyId, userId } },
        select: {
          status: true,
          family: {
            select: {
              deletedAt: true,
            },
          },
        },
      });

      if (targetMembership?.status !== 'active' || targetMembership.family.deletedAt) {
        return res.status(400).json({ error: 'La famiglia di destinazione non è valida' });
      }
    }

    const code = readProvidedCode(req);
    if (!code) {
      return res.status(400).json({ error: 'Codice di autenticazione richiesto' });
    }
    if (!isValidFamilyAuthCode(code)) {
      return res.status(400).json({ error: 'Codice di autenticazione non valido' });
    }

    const familyExists = await prisma.family.findFirst({
      where: { id: familyId, deletedAt: null },
      select: { id: true, deletedAt: true },
    });
    if (!familyExists) {
      return res.status(404).json({ error: 'Family not found' });
    }

    const userAuthCode = await ensureUserAuthCode(userId);
    if (userAuthCode.toUpperCase() !== code) {
      return res.status(403).json({ error: 'Codice di autenticazione errato' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.family.update({
        where: { id: familyId },
        data: {
          deletedAt: new Date(),
          deletedByUserId: userId,
        },
      });

      await tx.familyMember.updateMany({
        where: {
          familyId,
          status: 'active',
        },
        data: {
          status: 'left',
          leftAt: new Date(),
        },
      });
    });

    if (isDeletingActiveFamily && targetFamilyId) {
      req.session.activeFamilyId = targetFamilyId;
    } else if (req.session.activeFamilyId === familyId) {
      req.session.activeFamilyId = undefined;
    }

    res.json({ success: true, activeFamilyId: req.session.activeFamilyId || null });
  } catch (error) {
    next(error);
  }
});

// Update active family name / city
router.put('/', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { name, city, citySelection } = req.body;

    if ((!name || typeof name !== 'string') && (!city || typeof city !== 'string')) {
      if (!citySelection || typeof citySelection !== 'object') {
        return res.status(400).json({ error: 'Name or city is required' });
      }
    }

    const normalizedCitySelection = normalizeCitySelection(citySelection);

    const family = await prisma.family.update({
      where: { id: familyId },
      data: {
        ...(name && typeof name === 'string' ? { name: name.trim() } : {}),
        ...(normalizedCitySelection
          ? {
              city: normalizedCitySelection.name,
              cityDisplayName: normalizedCitySelection.displayName,
              cityCountry: normalizedCitySelection.country,
              cityTimezone: normalizedCitySelection.timezone,
              cityLatitude: normalizedCitySelection.latitude,
              cityLongitude: normalizedCitySelection.longitude,
            }
          : city && typeof city === 'string'
            ? {
                city: city.trim(),
                cityDisplayName: null,
                cityCountry: null,
                cityTimezone: null,
                cityLatitude: null,
                cityLongitude: null,
              }
            : {}),
      },
    });

    res.json(family);
  } catch (error) {
    next(error);
  }
});

// Regenerate user auth code used for destructive actions
router.post('/auth-code/regenerate', isLoggedIn, async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { authCode: generateFamilyAuthCode(5) },
      select: { authCode: true },
    });
    res.json({ authCode: user.authCode });
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
        status: 'active',
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
router.post('/invite/:token/accept', isLoggedIn, async (req, res, next) => {
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
        update: {
          status: 'active',
          leftAt: null,
        },
        create: {
          familyId: invite.familyId,
          userId: user.id,
          role: 'member',
          status: 'active',
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
      select: { userId: true, role: true, status: true },
    });

    if (!target || target.status !== 'active') {
      return res.status(404).json({ error: 'User not found in family' });
    }

    if (target.role === 'admin' && role === 'member') {
      const adminCount = await prisma.familyMember.count({
        where: { familyId, role: 'admin', status: 'active' },
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
