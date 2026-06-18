import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
  userName?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  const userName = req.headers['x-user-name'];

  if (!userId) {
    res.status(401).json({ success: false, error: '未登录' });
    return;
  }

  req.userId = Number(userId);
  req.userRole = userRole as string;
  req.userName = userName ? decodeURIComponent(userName as string) : '';
  next();
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin') {
    res.status(403).json({ success: false, error: '需要管理员权限' });
    return;
  }
  next();
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string;
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || '127.0.0.1';
}
