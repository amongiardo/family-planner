import { Router } from 'express';
import prisma from '../prisma';
import { isAuthenticated, getFamilyId } from '../middleware/auth';
import { createNotifications } from '../services/notifications';

const router = Router();

router.get('/messages', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;

    const messages = await prisma.chatMessage.findMany({
      where: { familyId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.json(messages);
  } catch (error) {
    next(error);
  }
});

router.post('/messages', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const sender = req.user!;
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';

    if (!content) {
      return res.status(400).json({ error: 'Messaggio vuoto' });
    }
    if (content.length > 2000) {
      return res.status(400).json({ error: 'Messaggio troppo lungo (max 2000 caratteri)' });
    }

    const message = await prisma.chatMessage.create({
      data: {
        familyId,
        senderUserId: sender.id,
        messageType: 'user',
        content,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    const otherMembers = await prisma.familyMember.findMany({
      where: {
        familyId,
        status: 'active',
        userId: { not: sender.id },
      },
      select: {
        userId: true,
      },
    });

    await createNotifications(
      otherMembers.map((member) => ({
        userId: member.userId,
        familyId,
        type: 'chat_message',
        title: 'Nuovo messaggio in chat',
        message: `${sender.name} ha inviato un messaggio in chat famiglia.`,
        data: {
          messageId: message.id,
        },
      }))
    );

    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

export default router;
