import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!);
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid token' });
  }
};
