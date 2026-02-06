import { Request, Response, NextFunction } from 'express';

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (typeof req.isAuthenticated !== 'function') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

export function getFamilyId(req: Request): string {
  if (!req.user) {
    throw new Error('User not authenticated');
  }
  return req.user.familyId;
}
