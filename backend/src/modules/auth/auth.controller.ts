import { Request, Response } from 'express';
import { AuthService } from './auth.service';

const service = new AuthService();

export const login = (req: Request, res: Response) => {
  const { password } = req.body || {};
  if (typeof password !== 'string') return res.status(400).json({ error: 'Password required' });
  const result = service.login(password);
  if (!result) return res.status(401).json({ error: 'Invalid password' });
  res.json(result);
};
