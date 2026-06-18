import { Router, Response } from 'express';
import db from '../db.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

const NODE_STATUSES = ['not_started', 'in_progress', 'completed', 'overdue', 'cancelled'];
const NODE_TYPES = ['payment', 'delivery', 'acceptance', 'other'];

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitIntoParagraphs(html: string): string[] {
  const paragraphs: string[] = [];
  const regex = /<p[^>]*>([\s\S]*?)<\/p>|<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>|<li[^>]*>([\s\S]*?)<\/li>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = stripHtml(match[0]);
    if (text.length > 0) {
      paragraphs.push(text);
    }
  }
  if (paragraphs.length === 0) {
    const text = stripHtml(html);
    const sentences = text
      .split(/[。\n；;！!]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (sentences.length > 1) {
      paragraphs.push(...sentences);
    } else if (text.length > 0) {
      paragraphs.push(text);
    }
  }
  return paragraphs;
}

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function selectNodesSql(extraWhere: string): string {
  return `
    SELECT n.*,
      u.name as completer_name,
      cu.name as creator_name,
      c.title as contract_title, c.contract_no as contract_no,
      c.party_a, c.party_b, c.amount as contract_amount, c.expiry_date,
      CASE
        WHEN n.status IN ('completed', 'cancelled') THEN n.status
        WHEN n.planned_date < date('now') THEN 'overdue'
        ELSE n.status
      END as effective_status
    FROM contract_nodes n
    LEFT JOIN users u ON n.completed_by = u.id
    LEFT JOIN users cu ON n.created_by = cu.id
    LEFT JOIN contracts c ON n.contract_id = c.id
    WHERE 1=1 ${extraWhere}
    ORDER BY n.sort_order ASC, n.planned_date ASC, n.id ASC
  `;
}

function canManageNodes(contractId: number, req: AuthRequest): boolean {
  if (req.userRole === 'admin') return true;
  const contract = db.prepare('SELECT created_by FROM contracts WHERE id = ?').get(contractId) as any;
  if (contract && contract.created_by === req.userId) return true;
  const signer = db.prepare('SELECT id FROM contract_signers WHERE contract_id = ? AND user_id = ?').get(contractId, req.userId);
  return !!signer;
}

function buildFilters(query: any): { sql: string; params: any[] } {
  const { node_type, responsible_party, startDate, endDate } = query;
  let sql = '';
  const params: any[] = [];
  if (node_type) {
    sql += ' AND n.node_type = ?';
    params.push(node_type);
  }
  if (responsible_party) {
    sql += ' AND n.responsible_party = ?';
    params.push(responsible_party);
  }
  if (startDate) {
    sql += ' AND n.planned_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND n.planned_date <= ?';
    params.push(endDate);
  }
  return { sql, params };
}

function getContract(contractId: number): any | null {
  return db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId) as any | null;
}

router.get('/contract/:contractId', (req: AuthRequest, res: Response) => {
  try {
    const contractId = Number(req.params.contractId);
    const contract = getContract(contractId);
    if (!contract) {
      res.status(404).json({ success: false, error: '合同不存在' });
      return;
    }
    const nodes = db.prepare(selectNodesSql('AND n.contract_id = ?')).all(contractId);
    res.json({ success: true, data: nodes });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/contract/:contractId', (req: AuthRequest, res: Response) => {
  try {
    const contractId = Number(req.params.contractId);
    const contract = getContract(contractId);
    if (!contract) {
      res.status(404).json({ success: false, error: '合同不存在' });
      return;
    }
    if (contract.is_voided) {
      res.status(400).json({ success: false, error: '已作废合同不可维护履约节点' });
      return;
    }
    if (!canManageNodes(contractId, req)) {
      res.status(403).json({ success: false, error: '无权限维护履约节点' });
      return;
    }

    const { node_name, node_type, responsible_party, planned_date, amount, deliverable, remark, attachment_url, sort_order } = req.body;
    if (!node_name || !planned_date) {
      res.status(400).json({ success: false, error: '节点名称和计划完成日期不能为空' });
      return;
    }

    const maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM contract_nodes WHERE contract_id = ?').get(contractId) as any).m || 0;
    const info = db.prepare(`
      INSERT INTO contract_nodes
        (contract_id, node_name, node_type, responsible_party, planned_date, amount, deliverable, status, attachment_url, remark, sort_order, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'not_started', ?, ?, ?, ?)
    `).run(
      contractId,
      node_name,
      NODE_TYPES.includes(node_type) ? node_type : 'other',
      responsible_party || null,
      planned_date,
      Number(amount) || 0,
      deliverable || null,
      attachment_url || null,
      remark || null,
      sort_order !== undefined ? Number(sort_order) : maxOrder + 1,
      req.userId,
    );
    res.json({ success: true, data: { id: info.lastInsertRowid } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/contract/:contractId/bulk', (req: AuthRequest, res: Response) => {
  try {
    const contractId = Number(req.params.contractId);
    const contract = getContract(contractId);
    if (!contract) {
      res.status(404).json({ success: false, error: '合同不存在' });
      return;
    }
    if (contract.is_voided) {
      res.status(400).json({ success: false, error: '已作废合同不可维护履约节点' });
      return;
    }
    if (!canManageNodes(contractId, req)) {
      res.status(403).json({ success: false, error: '无权限维护履约节点' });
      return;
    }

    const { nodes } = req.body as { nodes: any[] };
    if (!Array.isArray(nodes) || nodes.length === 0) {
      res.status(400).json({ success: false, error: '节点列表不能为空' });
      return;
    }

    let maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM contract_nodes WHERE contract_id = ?').get(contractId) as any).m || 0;
    const insertNode = db.prepare(`
      INSERT INTO contract_nodes
        (contract_id, node_name, node_type, responsible_party, planned_date, amount, deliverable, status, attachment_url, remark, sort_order, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'not_started', ?, ?, ?, ?)
    `);
    const ids: number[] = [];
    const insertMany = db.transaction((items: any[]) => {
      items.forEach((n) => {
        if (!n.node_name || !n.planned_date) return;
        maxOrder += 1;
        const info = insertNode.run(
          contractId,
          n.node_name,
          NODE_TYPES.includes(n.node_type) ? n.node_type : 'other',
          n.responsible_party || null,
          n.planned_date,
          Number(n.amount) || 0,
          n.deliverable || null,
          n.attachment_url || null,
          n.remark || null,
          n.sort_order !== undefined ? Number(n.sort_order) : maxOrder,
          req.userId,
        );
        ids.push(Number(info.lastInsertRowid));
      });
    });
    insertMany(nodes);
    res.json({ success: true, data: { ids, count: ids.length } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/:id', (req: AuthRequest, res: Response) => {
  try {
    const nodeId = Number(req.params.id);
    const node = db.prepare('SELECT * FROM contract_nodes WHERE id = ?').get(nodeId) as any;
    if (!node) {
      res.status(404).json({ success: false, error: '节点不存在' });
      return;
    }
    const contract = getContract(node.contract_id);
    if (!contract || contract.is_voided) {
      res.status(400).json({ success: false, error: '合同不存在或已作废' });
      return;
    }
    if (!canManageNodes(node.contract_id, req)) {
      res.status(403).json({ success: false, error: '无权限修改履约节点' });
      return;
    }

    const { node_name, node_type, responsible_party, planned_date, amount, deliverable, remark, attachment_url, sort_order } = req.body;

    db.prepare(`
      UPDATE contract_nodes SET
        node_name = ?, node_type = ?, responsible_party = ?, planned_date = ?, amount = ?,
        deliverable = ?, remark = ?, attachment_url = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      node_name || node.node_name,
      NODE_TYPES.includes(node_type) ? node_type : node.node_type,
      responsible_party !== undefined ? responsible_party : node.responsible_party,
      planned_date || node.planned_date,
      amount !== undefined ? Number(amount) : node.amount,
      deliverable !== undefined ? deliverable : node.deliverable,
      remark !== undefined ? remark : node.remark,
      attachment_url !== undefined ? attachment_url : node.attachment_url,
      sort_order !== undefined ? Number(sort_order) : node.sort_order,
      nodeId,
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    const nodeId = Number(req.params.id);
    const node = db.prepare('SELECT * FROM contract_nodes WHERE id = ?').get(nodeId) as any;
    if (!node) {
      res.status(404).json({ success: false, error: '节点不存在' });
      return;
    }
    const contract = getContract(node.contract_id);
    if (!contract || contract.is_voided) {
      res.status(400).json({ success: false, error: '合同不存在或已作废' });
      return;
    }
    if (!canManageNodes(node.contract_id, req)) {
      res.status(403).json({ success: false, error: '无权限删除履约节点' });
      return;
    }
    db.prepare('DELETE FROM contract_nodes WHERE id = ?').run(nodeId);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/status', (req: AuthRequest, res: Response) => {
  try {
    const nodeId = Number(req.params.id);
    const { status, attachment_url } = req.body;
    if (!NODE_STATUSES.includes(status)) {
      res.status(400).json({ success: false, error: '无效的节点状态' });
      return;
    }
    const node = db.prepare('SELECT * FROM contract_nodes WHERE id = ?').get(nodeId) as any;
    if (!node) {
      res.status(404).json({ success: false, error: '节点不存在' });
      return;
    }
    const contract = getContract(node.contract_id);
    if (!contract || contract.is_voided) {
      res.status(400).json({ success: false, error: '合同不存在或已作废' });
      return;
    }
    if (!canManageNodes(node.contract_id, req)) {
      res.status(403).json({ success: false, error: '无权限修改节点状态' });
      return;
    }

    if (status === 'completed') {
      db.prepare(`
        UPDATE contract_nodes SET
          status = ?, completed_at = CURRENT_TIMESTAMP, completed_by = ?,
          attachment_url = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, req.userId, attachment_url || node.attachment_url || null, nodeId);
    } else {
      db.prepare(`
        UPDATE contract_nodes SET
          status = ?, completed_at = NULL, completed_by = NULL,
          attachment_url = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, attachment_url !== undefined ? attachment_url : node.attachment_url, nodeId);
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/contract/:contractId/extract', (req: AuthRequest, res: Response) => {
  try {
    const contractId = Number(req.params.contractId);
    const contract = getContract(contractId);
    if (!contract) {
      res.status(404).json({ success: false, error: '合同不存在' });
      return;
    }
    const content = req.body?.content || contract.content || '';
    const paragraphs = splitIntoParagraphs(content);
    const nameMap: Record<string, string> = {
      payment: '付款节点',
      delivery: '交付节点',
      acceptance: '验收节点',
    };
    const counters: Record<string, number> = { payment: 0, delivery: 0, acceptance: 0 };
    const suggestions: any[] = [];

    paragraphs.forEach((para) => {
      let type: string | null = null;
      if (/付款|支付|结算|预付|尾款|款项|价款|报酬|工资/.test(para)) type = 'payment';
      else if (/交货|交付|发货|供货|到货|运输|送达|提供.*服务/.test(para)) type = 'delivery';
      else if (/验收|检验|测试|确认|接收|审查/.test(para)) type = 'acceptance';
      if (!type) return;

      counters[type] += 1;

      let amount = 0;
      const amtMatch = para.match(/(?:人民币|￥|¥)\s*([\d,]+(?:\.\d+)?)\s*元?/) || para.match(/([\d,]+(?:\.\d+)?)\s*元/);
      if (amtMatch) {
        amount = Number(amtMatch[1].replace(/,/g, '')) || 0;
      }

      let planned_date = '';
      const dateMatch = para.match(/(\d{4})\s*[年\-/.]\s*(\d{1,2})\s*[月\-/.]\s*(\d{1,2})/);
      if (dateMatch) {
        planned_date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      }

      let responsible_party = '';
      if (/甲方/.test(para)) responsible_party = '甲方';
      if (/乙方/.test(para)) responsible_party = responsible_party ? `${responsible_party}/乙方` : '乙方';

      suggestions.push({
        node_name: `${nameMap[type]}${counters[type]}`,
        node_type: type,
        responsible_party,
        planned_date,
        amount,
        deliverable: para.length > 80 ? para.slice(0, 80) + '...' : para,
        remark: '由合同正文提取',
        _source: para,
      });
    });

    res.json({ success: true, data: { suggestions, content_length: content.length } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/sync-overdue', (req: AuthRequest, res: Response) => {
  try {
    const result = db.prepare(`
      UPDATE contract_nodes
      SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
      WHERE planned_date < date('now')
        AND status NOT IN ('completed', 'cancelled', 'overdue')
    `).run();
    res.json({ success: true, data: { updated: result.changes } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/reminders', (req: AuthRequest, res: Response) => {
  try {
    const today = fmtDate(new Date());
    const in7 = fmtDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    const dueIn7Days = db.prepare(selectNodesSql(
      `AND n.planned_date >= date('now') AND n.planned_date <= date('now','+7 days')
       AND n.status NOT IN ('completed','cancelled')`
    )).all();

    const overdue = db.prepare(selectNodesSql(
      `AND n.planned_date < date('now')
       AND n.status NOT IN ('completed','cancelled')`
    )).all();

    const expiringContracts = db.prepare(`
      SELECT c.*, t.name as template_name, t.category as template_category
      FROM contracts c
      LEFT JOIN templates t ON c.template_id = t.id
      WHERE c.status IN ('signed','pending')
        AND c.is_voided = 0
        AND c.expiry_date >= date('now')
        AND c.expiry_date <= date('now','+7 days')
      ORDER BY c.expiry_date ASC
    `).all();

    res.json({
      success: true,
      data: {
        today,
        within7Date: in7,
        dueIn7Days,
        overdue,
        expiringContracts,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/dashboard', (req: AuthRequest, res: Response) => {
  try {
    const filters = buildFilters(req.query);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextM = month === 12 ? 1 : month + 1;
    const nextY = month === 12 ? year + 1 : year;
    const monthEnd = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

    const monthDueRows = db.prepare(`
      ${selectNodesSql(`
        AND n.planned_date >= ? AND n.planned_date < ?
        AND n.status NOT IN ('completed','cancelled')
        ${filters.sql}
      `)}
    `).all(monthStart, monthEnd, ...filters.params);

    const monthPlanned = (db.prepare(`
      SELECT COUNT(*) as cnt FROM contract_nodes n
      WHERE n.planned_date >= ? AND n.planned_date < ? ${filters.sql}
    `).get(monthStart, monthEnd, ...filters.params) as any).cnt;

    const monthCompleted = (db.prepare(`
      SELECT COUNT(*) as cnt FROM contract_nodes n
      WHERE n.planned_date >= ? AND n.planned_date < ?
        AND n.status = 'completed' ${filters.sql}
    `).get(monthStart, monthEnd, ...filters.params) as any).cnt;

    const overdueCount = (db.prepare(`
      SELECT COUNT(*) as cnt FROM contract_nodes n
      WHERE n.planned_date < date('now')
        AND n.status NOT IN ('completed','cancelled') ${filters.sql}
    `).get(...filters.params) as any).cnt;

    const overdueList = db.prepare(
      selectNodesSql(`
        AND n.planned_date < date('now')
        AND n.status NOT IN ('completed','cancelled') ${filters.sql}
      `)
    ).all(...filters.params);

    const byResponsibleParty = db.prepare(`
      SELECT COALESCE(NULLIF(n.responsible_party,''), '未指定') as responsible_party,
             COUNT(*) as total,
             SUM(CASE WHEN n.status = 'completed' THEN 1 ELSE 0 END) as completed,
             SUM(CASE WHEN n.status = 'overdue' OR (n.planned_date < date('now') AND n.status NOT IN ('completed','cancelled')) THEN 1 ELSE 0 END) as overdue
      FROM contract_nodes n
      WHERE n.status != 'cancelled' ${filters.sql}
      GROUP BY COALESCE(NULLIF(n.responsible_party,''), '未指定')
      ORDER BY total DESC
    `).all(...filters.params);

    const pendingAmountByContract = db.prepare(`
      SELECT c.id, c.title, c.contract_no, c.amount as contract_amount,
             c.party_a, c.party_b, c.status as contract_status,
             COALESCE(SUM(CASE WHEN n.status NOT IN ('completed','cancelled') THEN n.amount ELSE 0 END), 0) as pending_amount,
             COALESCE(SUM(CASE WHEN n.status = 'completed' THEN n.amount ELSE 0 END), 0) as completed_amount,
             COUNT(n.id) as node_total,
             SUM(CASE WHEN n.status = 'completed' THEN 1 ELSE 0 END) as node_completed
      FROM contracts c
      LEFT JOIN contract_nodes n ON n.contract_id = c.id ${filters.sql.replace(/n\./g, 'n.')}
      WHERE c.is_voided = 0
      GROUP BY c.id
      HAVING COUNT(n.id) > 0
      ORDER BY pending_amount DESC
      LIMIT 20
    `).all(...filters.params);

    const totalPendingAmount = (db.prepare(`
      SELECT COALESCE(SUM(n.amount), 0) as total
      FROM contract_nodes n
      WHERE n.status NOT IN ('completed','cancelled') ${filters.sql}
    `).get(...filters.params) as any).total;

    res.json({
      success: true,
      data: {
        month: { year, month },
        monthDueNodes: monthDueRows,
        monthDueCount: monthDueRows.length,
        monthPlannedCount: monthPlanned,
        monthCompletedCount: monthCompleted,
        overdueCount,
        overdueList,
        byResponsibleParty,
        pendingAmountByContract,
        totalPendingAmount,
        filters: { node_type: req.query.node_type || null, responsible_party: req.query.responsible_party || null, startDate: req.query.startDate || null, endDate: req.query.endDate || null },
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
