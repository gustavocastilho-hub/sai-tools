import jwt from 'jsonwebtoken';

export class AuthService {
  login(password: string): { token: string; expiresIn: number } | null {
    if (password !== process.env.MASTER_PASSWORD) return null;
    const secret = process.env.ACCESS_TOKEN_SECRET!;
    const expiresIn = 86400;
    const token = jwt.sign({ ok: true }, secret, { expiresIn });
    return { token, expiresIn };
  }
}
