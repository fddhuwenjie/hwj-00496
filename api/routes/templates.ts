import { Router, Response } from 'express';
import db from '../db.js';
import { AuthRequest, authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

const CATEGORIES = ['劳动合同', '采购合同', '保密协议', '租赁合同'];

router.get('/categories', (_req: AuthRequest, res: Response) => {
  res.json({ success: true, data: CATEGORIES });
});

router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT t.*, u.name as creator_name FROM templates t LEFT JOIN users u ON t.created_by = u.id WHERE 1=1';
    const params: any[] = [];
    if (category) {
      sql += ' AND t.category = ?';
      params.push(category);
    }
    sql += ' ORDER BY t.created_at DESC';
    const templates = db.prepare(sql).all(...params);
    res.json({ success: true, data: templates });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  try {
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id) as any;
    if (!template) {
      res.status(404).json({ success: false, error: '模板不存在' });
      return;
    }
    const variables = db.prepare('SELECT * FROM template_variables WHERE template_id = ?').all(req.params.id);
    res.json({ success: true, data: { ...template, variables } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/', adminMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { name, category, content, variables } = req.body;
    if (!name || !category || !content) {
      res.status(400).json({ success: false, error: '缺少必填字段' });
      return;
    }
    if (!CATEGORIES.includes(category)) {
      res.status(400).json({ success: false, error: '无效的模板分类' });
      return;
    }
    const info = db.prepare('INSERT INTO templates (name, category, content, created_by) VALUES (?, ?, ?, ?)').run(
      name, category, content, req.userId,
    );
    const templateId = Number(info.lastInsertRowid);
    if (variables && variables.length > 0) {
      const insertVar = db.prepare('INSERT INTO template_variables (template_id, name, type, description, placeholder) VALUES (?, ?, ?, ?, ?)');
      variables.forEach((v: any) => {
        insertVar.run(templateId, v.name, v.type || 'text', v.description || '', `{{${v.name}}}`);
      });
    }
    res.json({ success: true, data: { id: templateId } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/:id', adminMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { name, category, content, variables } = req.body;
    const templateId = Number(req.params.id);
    const exists = db.prepare('SELECT id FROM templates WHERE id = ?').get(templateId);
    if (!exists) {
      res.status(404).json({ success: false, error: '模板不存在' });
      return;
    }
    db.prepare('UPDATE templates SET name = ?, category = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      name, category, content, templateId,
    );
    if (variables) {
      db.prepare('DELETE FROM template_variables WHERE template_id = ?').run(templateId);
      const insertVar = db.prepare('INSERT INTO template_variables (template_id, name, type, description, placeholder) VALUES (?, ?, ?, ?, ?)');
      variables.forEach((v: any) => {
        insertVar.run(templateId, v.name, v.type || 'text', v.description || '', `{{${v.name}}}`);
      });
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/:id', adminMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const templateId = Number(req.params.id);
    db.prepare('DELETE FROM templates WHERE id = ?').run(templateId);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/preview', (req: AuthRequest, res: Response) => {
  try {
    const { content, variables } = req.body;
    let result = content;
    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      });
    }
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
