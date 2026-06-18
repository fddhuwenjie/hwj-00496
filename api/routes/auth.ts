import { Router, Request, Response } from 'express';
import db from '../db.js';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password) as any;
    if (!user) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }
    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/users', (req: Request, res: Response) => {
  try {
    const users = db.prepare('SELECT id, username, name, role, email FROM users').all();
    res.json({ success: true, data: users });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
