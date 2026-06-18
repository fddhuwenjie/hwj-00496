import { Router, Response } from 'express';
import db from '../db.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/overview', (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthStart = `${year}-${month}-01`;
    const nextMonth = now.getMonth() + 2;
    const nmYear = nextMonth > 12 ? year + 1 : year;
    const nmMonth = String(nextMonth > 12 ? 1 : nextMonth).padStart(2, '0');
    const monthEnd = `${nmYear}-${nmMonth}-01`;

    const monthNew = db.prepare(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total_amount
      FROM contracts WHERE created_at >= ? AND created_at < ? AND is_voided = 0
    `).get(monthStart, monthEnd) as any;

    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as cnt
      FROM contracts WHERE is_voided = 0
      GROUP BY status
    `).all();

    const byCategory = db.prepare(`
      SELECT t.category, COUNT(*) as cnt
      FROM contracts c
      LEFT JOIN templates t ON c.template_id = t.id
      WHERE c.is_voided = 0
      GROUP BY t.category
    `).all();

    const pendingOvertime = (db.prepare(`
      SELECT COUNT(*) as cnt
      FROM contract_signers cs
      LEFT JOIN contracts c ON cs.contract_id = c.id
      WHERE cs.status = 'pending' AND c.status = 'pending'
        AND c.created_at < DATETIME('now', '-3 days')
    `).get() as any).cnt;

    res.json({
      success: true,
      data: {
        monthNewCount: monthNew.cnt,
        monthNewAmount: monthNew.total_amount,
        byStatus,
        byCategory,
        pendingOvertime,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/calendar', (req: AuthRequest, res: Response) => {
  try {
    const { year, month } = req.query;
    const y = Number(year) || new Date().getFullYear();
    const m = Number(month) || new Date().getMonth() + 1;

    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    const endDate = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

    const events = db.prepare(`
      SELECT id, title, expiry_date, status, amount, party_a, party_b
      FROM contracts
      WHERE expiry_date >= ? AND expiry_date < ? AND is_voided = 0 AND status != 'voided'
      ORDER BY expiry_date
    `).all(startDate, endDate);

    res.json({ success: true, data: events });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/pending-overtime', (req: AuthRequest, res: Response) => {
  try {
    const list = db.prepare(`
      SELECT c.*, cs.signed_at, cs.user_id, u.name as signer_name, cs.sign_order
      FROM contract_signers cs
      LEFT JOIN contracts c ON cs.contract_id = c.id
      LEFT JOIN users u ON cs.user_id = u.id
      WHERE cs.status = 'pending' AND c.status = 'pending'
        AND c.created_at < DATETIME('now', '-3 days')
      ORDER BY c.created_at ASC
    `).all();
    res.json({ success: true, data: list });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/category-distribution', (req: AuthRequest, res: Response) => {
  try {
    const data = db.prepare(`
      SELECT COALESCE(t.category, '无模板') as category, COUNT(*) as cnt, COALESCE(SUM(c.amount), 0) as total_amount
      FROM contracts c
      LEFT JOIN templates t ON c.template_id = t.id
      WHERE c.is_voided = 0
      GROUP BY t.category
    `).all();
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
