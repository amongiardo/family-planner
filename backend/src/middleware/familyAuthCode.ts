import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { getFamilyId } from './auth';
import { generateFamilyAuthCode, isValidFamilyAuthCode } from '../utils/familyAuthCode';

function readProvidedCode(req: Request): string | null {
  const headerCode =
    typeof req.headers['x-family-auth-code'] === 'string'
      ? req.headers['x-family-auth-code']
      : Array.isArray(req.headers['x-family-auth-code'])
        ? req.headers['x-family-auth-code'][0]
        : null;

  const bodyCode = (req.body as any)?.authCode;
  const queryCode = (req.query as any)?.authCode;

  const raw = headerCode ?? bodyCode ?? queryCode;
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toUpperCase();
  return normalized || null;
}

export async function requireFamilyAuthCode(req: Request, res: Response, next: NextFunction) {
  try {
    const provided = readProvidedCode(req);
    if (!provided) {
      return res.status(400).json({ error: 'Codice di autenticazione richiesto' });
    }
    if (!isValidFamilyAuthCode(provided)) {
      return res.status(400).json({ error: 'Codice di autenticazione non valido' });
    }

    const familyId = getFamilyId(req);

    let family = await prisma.family.findUnique({
      where: { id: familyId },
      select: { authCode: true },
    });

    // Backfill for existing families created before this feature.
    if (!family?.authCode) {
      const newCode = generateFamilyAuthCode(5);
      family = await prisma.family.update({
        where: { id: familyId },
        data: { authCode: newCode },
        select: { authCode: true },
      });
    }

    if (family.authCode?.toUpperCase() !== provided) {
      return res.status(403).json({ error: 'Codice di autenticazione errato' });
    }

    next();
  } catch (error) {
    next(error);
  }
}

