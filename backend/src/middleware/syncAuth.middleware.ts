import { Request, Response, NextFunction } from 'express';

export const authenticateSyncInternal = (req: Request, res: Response, next: NextFunction): void => {
  const secret = process.env.SYNC_INTERNAL_SECRET;
  
  if (!secret) {
    res.status(500).json({ error: 'SYNC_INTERNAL_SECRET not configured' });
    return;
  }

  const providedSecret = req.headers['x-sync-secret'];
  
  if (!providedSecret || providedSecret !== secret) {
    res.status(401).json({ error: 'Unauthorized sync request' });
    return;
  }

  next();
};
