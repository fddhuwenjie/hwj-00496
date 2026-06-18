import { Router, Response } from 'express';
import db from '../db.js';
import { AuthRequest, authMiddleware, getClientIp } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

function generateContractNo() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `HT${y}${m}${d}${rand}`;
}

function getContractWithSigners(contractId: number) {
  const contract = db.prepare(`
    SELECT c.*, t.name as template_name, t.category as template_category, u.name as creator_name
    FROM contracts c
    LEFT JOIN templates t ON c.template_id = t.id
    LEFT JOIN users u ON c.created_by = u.id
    WHERE c.id = ?
  `).get(contractId) as any;
  if (!contract) return null;
  const signers = db.prepare(`
    SELECT cs.*, u.name as user_name, u.username, u.email
    FROM contract_signers cs
    LEFT JOIN users u ON cs.user_id = u.id
    WHERE cs.contract_id = ?
    ORDER BY cs.sign_order
  `).all(contractId);
  return { ...contract, signers };
}

router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const { status, keyword, party, startDate, endDate, minAmount, maxAmount, category } = req.query;
    let sql = `
      SELECT DISTINCT c.*, t.name as template_name, t.category as template_category, u.name as creator_name
      FROM contracts c
      LEFT JOIN templates t ON c.template_id = t.id
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN contract_signers cs ON c.id = cs.contract_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }
    if (keyword) {
      sql += ' AND (c.title LIKE ? OR c.contract_no LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (party) {
      sql += ' AND (c.party_a LIKE ? OR c.party_b LIKE ?)';
      params.push(`%${party}%`, `%${party}%`);
    }
    if (startDate) {
      sql += ' AND c.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND c.created_at <= ?';
      params.push(endDate + ' 23:59:59');
    }
    if (minAmount) {
      sql += ' AND c.amount >= ?';
      params.push(Number(minAmount));
    }
    if (maxAmount) {
      sql += ' AND c.amount <= ?';
      params.push(Number(maxAmount));
    }
    if (category) {
      sql += ' AND t.category = ?';
      params.push(category);
    }

    if (req.userRole !== 'admin') {
      sql += ' AND (c.created_by = ? OR cs.user_id = ?)';
      params.push(req.userId, req.userId);
    }

    sql += ' ORDER BY c.created_at DESC';

    const contracts = db.prepare(sql).all(...params);
    res.json({ success: true, data: contracts });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/pending-sign', (req: AuthRequest, res: Response) => {
  try {
    const contracts = db.prepare(`
      SELECT c.*, t.name as template_name, t.category as template_category, cs.sign_order, cs.status as signer_status
      FROM contracts c
      LEFT JOIN templates t ON c.template_id = t.id
      LEFT JOIN contract_signers cs ON c.id = cs.contract_id
      WHERE cs.user_id = ? AND cs.status = 'pending' AND c.status = 'pending'
      ORDER BY c.created_at DESC
    `).all(req.userId);
    res.json({ success: true, data: contracts });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/expiring', (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    const contracts = db.prepare(`
      SELECT c.*, t.name as template_name, t.category as template_category
      FROM contracts c
      LEFT JOIN templates t ON c.template_id = t.id
      WHERE c.status IN ('signed', 'pending')
        AND c.expiry_date >= ? AND c.expiry_date <= ?
        AND c.is_voided = 0
      ORDER BY c.expiry_date ASC
    `).all(fmt(today), fmt(in30));
    res.json({ success: true, data: contracts });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  try {
    const contract = getContractWithSigners(Number(req.params.id));
    if (!contract) {
      res.status(404).json({ success: false, error: '合同不存在' });
      return;
    }
    const versions = db.prepare('SELECT * FROM contract_versions WHERE contract_id = ? ORDER BY version DESC').all(req.params.id);
    res.json({ success: true, data: { ...contract, versions } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { templateId, content, title, party_a, party_b, amount, effective_date, expiry_date, variables, signerIds } = req.body;

    if (!content || !title) {
      res.status(400).json({ success: false, error: '缺少必填字段' });
      return;
    }

    let finalContent = content;
    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        finalContent = finalContent.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      });
    }

    const contractNo = generateContractNo();
    const info = db.prepare(`
      INSERT INTO contracts (contract_no, title, template_id, content, party_a, party_b, amount, effective_date, expiry_date, status, created_by, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, 1)
    `).run(
      contractNo, title, templateId || null, finalContent,
      party_a || null, party_b || null, Number(amount) || 0,
      effective_date || null, expiry_date || null, req.userId,
    );

    const contractId = Number(info.lastInsertRowid);

    if (signerIds && signerIds.length > 0) {
      const insertSigner = db.prepare('INSERT INTO contract_signers (contract_id, user_id, sign_order, status) VALUES (?, ?, ?, ?)');
      signerIds.forEach((uid: number, idx: number) => {
        insertSigner.run(contractId, uid, idx + 1, 'pending');
      });
    }

    db.prepare('INSERT INTO contract_versions (contract_id, version, content, changed_by) VALUES (?, 1, ?, ?)').run(
      contractId, finalContent, req.userId,
    );

    res.json({ success: true, data: { id: contractId, contract_no: contractNo } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/start-sign', (req: AuthRequest, res: Response) => {
  try {
    const contractId = Number(req.params.id);
    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId) as any;
    if (!contract) {
      res.status(404).json({ success: false, error: '合同不存在' });
      return;
    }
    if (contract.status !== 'draft') {
      res.status(400).json({ success: false, error: '只有草稿合同可以发起签署' });
      return;
    }
    const signers = db.prepare('SELECT * FROM contract_signers WHERE contract_id = ? ORDER BY sign_order').all(contractId);
    if (signers.length === 0) {
      res.status(400).json({ success: false, error: '请先指定签署人' });
      return;
    }

    const latestReview = db.prepare(`
      SELECT * FROM review_history
      WHERE contract_id = ? AND version = ?
      ORDER BY id DESC LIMIT 1
    `).get(contractId, contract.version) as any;

    if (latestReview) {
      const pendingHighRisks = db.prepare(`
        SELECT COUNT(*) as cnt FROM risk_records
        WHERE review_history_id = ? AND risk_level = ? AND status = ?
      `).get(latestReview.id, 'high', 'pending') as any;

      if (pendingHighRisks.cnt > 0) {
        res.status(400).json({
          success: false,
          error: `存在 ${pendingHighRisks.cnt} 项未处理的高风险，请先处理或豁免后再发起签署`,
          data: { has_high_risk: true, pending_high_count: pendingHighRisks.cnt },
        });
        return;
      }
    }

    db.prepare("UPDATE contracts SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(contractId);

    const insertNotif = db.prepare('INSERT INTO notifications (user_id, contract_id, message) VALUES (?, ?, ?)');
    signers.forEach((s: any) => {
      insertNotif.run(s.user_id, contractId, `您有待签署的合同：${contract.title}`);
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/:id', (req: AuthRequest, res: Response) => {
  try {
    const contractId = Number(req.params.id);
    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId) as any;
    if (!contract) {
      res.status(404).json({ success: false, error: '合同不存在' });
      return;
    }
    if (contract.status === 'signed' || contract.is_voided === 1) {
      res.status(400).json({ success: false, error: '已签署或已作废的合同不可修改' });
      return;
    }

    const { content, title, party_a, party_b, amount, effective_date, expiry_date, signerIds, changeReason } = req.body;

    const newVersion = contract.version + 1;

    db.prepare(`
      UPDATE contracts SET
        title = ?, content = ?, party_a = ?, party_b = ?, amount = ?,
        effective_date = ?, expiry_date = ?, version = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title || contract.title, content || contract.content,
      party_a !== undefined ? party_a : contract.party_a,
      party_b !== undefined ? party_b : contract.party_b,
      amount !== undefined ? Number(amount) : contract.amount,
      effective_date !== undefined ? effective_date : contract.effective_date,
      expiry_date !== undefined ? expiry_date : contract.expiry_date,
      newVersion, contractId,
    );

    if (signerIds) {
      db.prepare("DELETE FROM contract_signers WHERE contract_id = ? AND status != 'signed'").run(contractId);
      const signed = db.prepare("SELECT user_id, sign_order FROM contract_signers WHERE contract_id = ? AND status = 'signed' ORDER BY sign_order").all(contractId) as any[];
      const signedUids = signed.map((s: any) => s.user_id);
      const insertSigner = db.prepare('INSERT INTO contract_signers (contract_id, user_id, sign_order, status) VALUES (?, ?, ?, ?)');
      let order = signed.length + 1;
      signerIds.forEach((uid: number) => {
        if (!signedUids.includes(uid)) {
          insertSigner.run(contractId, uid, order++, 'pending');
        }
      });
    }

    db.prepare('INSERT INTO contract_versions (contract_id, version, content, changed_by, change_reason) VALUES (?, ?, ?, ?, ?)').run(
      contractId, newVersion, content || contract.content, req.userId, changeReason || '',
    );

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/sign', (req: AuthRequest, res: Response) => {
  try {
    const contractId = Number(req.params.id);
    const { signatureData, position, positionX, positionY, page } = req.body;
    const px = position?.x ?? positionX;
    const py = position?.y ?? positionY;
    const pg = position?.page ?? page;
    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId) as any;
    if (!contract) {
      res.status(404).json({ success: false, error: '合同不存在' });
      return;
    }
    if (contract.status !== 'pending') {
      res.status(400).json({ success: false, error: '合同状态不允许签署' });
      return;
    }

    const signers = db.prepare('SELECT * FROM contract_signers WHERE contract_id = ? ORDER BY sign_order').all(contractId) as any[];
    const mySigner = signers.find((s) => s.user_id === req.userId);
    if (!mySigner) {
      res.status(403).json({ success: false, error: '您不是签署人' });
      return;
    }
    if (mySigner.status === 'signed') {
      res.status(400).json({ success: false, error: '您已签署' });
      return;
    }

    const prevSigners = signers.filter((s) => s.sign_order < mySigner.sign_order);
    const allPrevSigned = prevSigners.every((s) => s.status === 'signed');
    if (!allPrevSigned) {
      res.status(400).json({ success: false, error: '请等待前序签署人完成签署' });
      return;
    }

    const signedAt = new Date().toISOString();
    const ip = getClientIp(req);

    db.prepare(`
      UPDATE contract_signers
      SET status = 'signed', signed_at = ?, signature_data = ?, sign_ip = ?,
          position_x = ?, position_y = ?, sign_page = ?
      WHERE id = ?
    `).run(signedAt, signatureData || '', ip,
      px != null ? Number(px) : null,
      py != null ? Number(py) : null,
      pg != null ? Number(pg) : 1,
      mySigner.id);

    db.prepare('INSERT INTO signature_logs (user_id, contract_id, action, sign_ip) VALUES (?, ?, ?, ?)').run(
      req.userId, contractId, 'sign', ip,
    );

    const remaining = (db.prepare("SELECT COUNT(*) as cnt FROM contract_signers WHERE contract_id = ? AND status != 'signed'").get(contractId) as any).cnt;
    if (remaining === 0) {
      db.prepare("UPDATE contracts SET status = 'signed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(contractId);
      db.prepare('INSERT INTO notifications (user_id, contract_id, message) VALUES (?, ?, ?)').run(
        contract.created_by, contractId, `合同【${contract.title}】所有签署人已完成签署`,
      );
    } else {
      const nextSigner = db.prepare("SELECT * FROM contract_signers WHERE contract_id = ? AND status = 'pending' ORDER BY sign_order LIMIT 1").get(contractId) as any;
      if (nextSigner) {
        db.prepare('INSERT INTO notifications (user_id, contract_id, message) VALUES (?, ?, ?)').run(
          nextSigner.user_id, contractId, `合同【${contract.title}】已轮到您签署`,
        );
      }
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/reject', (req: AuthRequest, res: Response) => {
  try {
    const contractId = Number(req.params.id);
    const { reason } = req.body;
    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId) as any;
    if (!contract) {
      res.status(404).json({ success: false, error: '合同不存在' });
      return;
    }

    const mySigner = db.prepare('SELECT * FROM contract_signers WHERE contract_id = ? AND user_id = ?').get(contractId, req.userId) as any;
    if (!mySigner) {
      res.status(403).json({ success: false, error: '您不是签署人' });
      return;
    }

    db.prepare("UPDATE contract_signers SET status = 'rejected', reject_reason = ? WHERE id = ?").run(reason || '', mySigner.id);
    db.prepare("UPDATE contracts SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(contractId);

    db.prepare('INSERT INTO notifications (user_id, contract_id, message) VALUES (?, ?, ?)').run(
      contract.created_by, contractId, `合同【${contract.title}】被拒签，原因：${reason || '未填写'}`,
    );

    const ip = getClientIp(req);
    db.prepare('INSERT INTO signature_logs (user_id, contract_id, action, sign_ip) VALUES (?, ?, ?, ?)').run(
      req.userId, contractId, 'reject', ip,
    );

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:id/void-confirmations', (req: AuthRequest, res: Response) => {
  try {
    const contractId = Number(req.params.id);
    const confirmations = db.prepare(`
      SELECT vc.*, u.name as user_name, u.username
      FROM void_confirmations vc
      LEFT JOIN users u ON vc.user_id = u.id
      WHERE vc.contract_id = ?
      ORDER BY vc.created_at
    `).all(contractId);
    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId) as any;
    res.json({ success: true, data: { confirmations, void_initiated_by: contract?.void_initiated_by, void_reason: contract?.void_reason, void_initiated_at: contract?.void_initiated_at } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/void', (req: AuthRequest, res: Response) => {
  try {
    const contractId = Number(req.params.id);
    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId) as any;
    if (!contract) {
      res.status(404).json({ success: false, error: '合同不存在' });
      return;
    }
    if (contract.is_voided) {
      res.status(400).json({ success: false, error: '合同已作废' });
      return;
    }
    if (req.userRole !== 'admin' && contract.created_by !== req.userId) {
      res.status(403).json({ success: false, error: '无权限发起作废' });
      return;
    }

    const { reason } = req.body;

    const signedSigners = db.prepare("SELECT * FROM contract_signers WHERE contract_id = ? AND status = 'signed'").all(contractId) as any[];

    db.prepare('UPDATE contracts SET void_reason = ?, void_initiated_by = ?, void_initiated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      reason || '', req.userId, contractId,
    );

    db.prepare('DELETE FROM void_confirmations WHERE contract_id = ?').run(contractId);
    const insertConf = db.prepare('INSERT OR IGNORE INTO void_confirmations (contract_id, user_id, confirmed) VALUES (?, ?, ?)');

    const relevantUsers = new Set<number>();
    relevantUsers.add(contract.created_by);
    signedSigners.forEach((s) => relevantUsers.add(s.user_id));

    relevantUsers.forEach((uid) => {
      insertConf.run(contractId, uid, uid === req.userId ? 1 : 0);
    });

    const allSigned = signedSigners.length === 0;
    if (allSigned) {
      db.prepare("UPDATE contracts SET is_voided = 1, status = 'voided', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(contractId);
      db.prepare('INSERT INTO signature_logs (user_id, contract_id, action, sign_ip) VALUES (?, ?, ?, ?)').run(
        req.userId, contractId, 'void', getClientIp(req),
      );
      res.json({ success: true, data: { voided: true, message: '合同已作废' } });
      return;
    }

    const insertNotif = db.prepare('INSERT INTO notifications (user_id, contract_id, message) VALUES (?, ?, ?)');
    relevantUsers.forEach((uid) => {
      if (uid !== req.userId) {
        insertNotif.run(uid, contractId, `合同【${contract.title}】已发起作废申请，原因：${reason || '未填写'}，请您确认`);
      }
    });

    db.prepare('INSERT INTO signature_logs (user_id, contract_id, action, sign_ip) VALUES (?, ?, ?, ?)').run(
      req.userId, contractId, 'init_void', getClientIp(req),
    );

    res.json({ success: true, data: { voided: false, message: '已发起作废申请，等待其他签署方确认' } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/void-confirm', (req: AuthRequest, res: Response) => {
  try {
    const contractId = Number(req.params.id);
    const { confirmed } = req.body;
    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId) as any;
    if (!contract) {
      res.status(404).json({ success: false, error: '合同不存在' });
      return;
    }
    if (contract.is_voided) {
      res.status(400).json({ success: false, error: '合同已作废' });
      return;
    }
    if (!contract.void_initiated_by) {
      res.status(400).json({ success: false, error: '合同尚未发起作废申请' });
      return;
    }

    const myConf = db.prepare('SELECT * FROM void_confirmations WHERE contract_id = ? AND user_id = ?').get(contractId, req.userId) as any;
    if (!myConf) {
      res.status(403).json({ success: false, error: '您无需确认此作废申请' });
      return;
    }

    db.prepare('UPDATE void_confirmations SET confirmed = ?, confirmed_at = CURRENT_TIMESTAMP WHERE contract_id = ? AND user_id = ?').run(
      confirmed ? 1 : 0, contractId, req.userId,
    );

    db.prepare('INSERT INTO signature_logs (user_id, contract_id, action, sign_ip) VALUES (?, ?, ?, ?)').run(
      req.userId, contractId, confirmed ? 'confirm_void' : 'cancel_void', getClientIp(req),
    );

    if (!confirmed) {
      db.prepare('UPDATE contracts SET void_initiated_by = NULL, void_initiated_at = NULL, void_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(contractId);
      db.prepare('DELETE FROM void_confirmations WHERE contract_id = ?').run(contractId);
      const insertNotif = db.prepare('INSERT INTO notifications (user_id, contract_id, message) VALUES (?, ?, ?)');
      const users = db.prepare('SELECT DISTINCT user_id FROM void_confirmations WHERE contract_id = ?').all(contractId) as any[];
      users.forEach((u) => {
        if (u.user_id !== req.userId) {
          insertNotif.run(u.user_id, contractId, `合同【${contract.title}】的作废申请已被取消`);
        }
      });
      res.json({ success: true, data: { message: '已取消作废申请' } });
      return;
    }

    const total = (db.prepare('SELECT COUNT(*) as cnt FROM void_confirmations WHERE contract_id = ?').get(contractId) as any).cnt;
    const confirmedCnt = (db.prepare('SELECT COUNT(*) as cnt FROM void_confirmations WHERE contract_id = ? AND confirmed = 1').get(contractId) as any).cnt;

    if (confirmedCnt >= total) {
      db.prepare("UPDATE contracts SET is_voided = 1, status = 'voided', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(contractId);
      db.prepare('INSERT INTO signature_logs (user_id, contract_id, action, sign_ip) VALUES (?, ?, ?, ?)').run(
        req.userId, contractId, 'void', getClientIp(req),
      );
      const insertNotif = db.prepare('INSERT INTO notifications (user_id, contract_id, message) VALUES (?, ?, ?)');
      const users = db.prepare('SELECT DISTINCT user_id FROM void_confirmations WHERE contract_id = ?').all(contractId) as any[];
      users.forEach((u) => {
        if (u.user_id !== req.userId) {
          insertNotif.run(u.user_id, contractId, `合同【${contract.title}】已完成所有确认，已正式作废`);
        }
      });
      res.json({ success: true, data: { voided: true, message: '所有相关方已确认，合同已作废' } });
    } else {
      res.json({ success: true, data: { voided: false, message: `已确认，等待其他签署方（${confirmedCnt}/${total}）` } });
    }
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/signers', (req: AuthRequest, res: Response) => {
  try {
    const { contractId, signerIds } = req.body;
    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId) as any;
    if (!contract) {
      res.status(404).json({ success: false, error: '合同不存在' });
      return;
    }
    if (contract.status !== 'draft') {
      res.status(400).json({ success: false, error: '只有草稿合同可以修改签署人' });
      return;
    }
    db.prepare('DELETE FROM contract_signers WHERE contract_id = ?').run(contractId);
    const insertSigner = db.prepare('INSERT INTO contract_signers (contract_id, user_id, sign_order, status) VALUES (?, ?, ?, ?)');
    signerIds.forEach((uid: number, idx: number) => {
      insertSigner.run(contractId, uid, idx + 1, 'pending');
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:id/versions', (req: AuthRequest, res: Response) => {
  try {
    const versions = db.prepare(`
      SELECT cv.*, u.name as changer_name
      FROM contract_versions cv
      LEFT JOIN users u ON cv.changed_by = u.id
      WHERE cv.contract_id = ?
      ORDER BY cv.version DESC
    `).all(req.params.id);
    res.json({ success: true, data: versions });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
