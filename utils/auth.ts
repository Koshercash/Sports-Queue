import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export function authMiddleware(req: NextApiRequest, res: NextApiResponse, next: (result: unknown) => void) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return next(new Error('Unauthorized'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
    (req as any).userId = decoded.userId;
    next(null);
  } catch (error) {
    next(new Error('Unauthorized'));
  }
}