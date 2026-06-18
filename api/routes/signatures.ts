import { Router, Response } from 'express';
import db from '../db.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/my', (req: AuthRequest, res: Response) => {
  try {
    const signatures = db.prepare('SELECT * FROM signatures WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
    res.json({ success: true, data: signatures });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { signatureData } = req.body;
    if (!signatureData) {
      res.status(400).json({ success: false, error: '签章数据不能为空' });
      return;
    }
    db.prepare('DELETE FROM signatures WHERE user_id = ?').run(req.userId);
    const info = db.prepare('INSERT INTO signatures (user_id, signature_data) VALUES (?, ?)').run(req.userId, signatureData);
    res.json({ success: true, data: { id: info.lastInsertRowid } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    db.prepare('DELETE FROM signatures WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/logs', (req: AuthRequest, res: Response) => {
  try {
    const { page, pageSize, userId } = req.query;
    const p = Number(page) || 1;
    const ps = Number(pageSize) || 50;
    const offset = (p - 1) * ps;

    let sql = `
      SELECT sl.*, u.name as user_name, c.title as contract_title
      FROM signature_logs sl
      LEFT JOIN users u ON sl.user_id = u.id
      LEFT JOIN contracts c ON sl.contract_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (userId) {
      sql += ' AND sl.user_id = ?';
      params.push(Number(userId));
    }
    if (req.userRole !== 'admin') {
      sql += ' AND sl.user_id = ?';
      params.push(req.userId);
    }

    sql += ' ORDER BY sl.created_at DESC LIMIT ? OFFSET ?';
    params.push(ps, offset);

    const logs = db.prepare(sql).all(...params);
    const total = (db.prepare('SELECT COUNT(*) as cnt FROM signature_logs').get() as any).cnt;

    res.json({ success: true, data: { list: logs, total, page: p, pageSize: ps } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/notifications', (req: AuthRequest, res: Response) => {
  try {
    const notifs = db.prepare(`
      SELECT n.*, c.title as contract_title
      FROM notifications n
      LEFT JOIN contracts c ON n.contract_id = c.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 100
    `).all(req.userId);
    res.json({ success: true, data: notifs });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/notifications/:id/read', (req: AuthRequest, res: Response) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/notifications/read-all', (req: AuthRequest, res: Response) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.userId);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
