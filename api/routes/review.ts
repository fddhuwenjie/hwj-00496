import { Router, Response } from 'express';
import db from '../db.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

interface ReviewRule {
  id: number;
  name: string;
  contract_type: string;
  risk_level: 'low' | 'medium' | 'high';
  pattern: string;
  is_regex: number;
  description: string;
  suggestion: string;
  is_enabled: number;
  created_at: string;
  updated_at: string;
}

const router = Router();

router.use(authMiddleware);

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitIntoParagraphs(html: string): string[] {
  const paragraphs: string[] = [];
  const regex = /<p[^>]*>([\s\S]*?)<\/p>|<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = stripHtml(match[0]);
    if (text.length > 0) {
      paragraphs.push(text);
    }
  }
  if (paragraphs.length === 0) {
    const text = stripHtml(html);
    if (text.length > 0) {
      paragraphs.push(text);
    }
  }
  return paragraphs;
}

function matchPattern(text: string, pattern: string, isRegex: boolean): { matched: boolean; matchedContent: string } {
  if (!pattern || pattern.trim() === '') {
    return { matched: false, matchedContent: '' };
  }
  
  try {
    if (isRegex) {
      const regex = new RegExp(pattern, 'i');
      const match = text.match(regex);
      if (match) {
        return { matched: true, matchedContent: match[0] };
      }
    } else {
      if (text.includes(pattern)) {
        return { matched: true, matchedContent: pattern };
      }
    }
  } catch (e) {
    console.error('Pattern match error:', e);
  }
  
  return { matched: false, matchedContent: '' };
}

function reverseMatchPattern(text: string, pattern: string, isRegex: boolean): { matched: boolean; matchedContent: string } {
  const result = matchPattern(text, pattern, isRegex);
  return { matched: !result.matched, matchedContent: '' };
}

router.get('/rules', (req: AuthRequest, res: Response) => {
  try {
    const { contract_type, is_enabled } = req.query;
    let sql = 'SELECT r.*, u.name as creator_name FROM review_rules r LEFT JOIN users u ON r.created_by = u.id WHERE 1=1';
    const params: any[] = [];

    if (contract_type) {
      sql += ' AND (r.contract_type = ? OR r.contract_type = ?)';
      params.push(contract_type, 'all');
    }
    if (is_enabled !== undefined) {
      sql += ' AND r.is_enabled = ?';
      params.push(is_enabled === '1' ? 1 : 0);
    }

    sql += ' ORDER BY r.risk_level = ? DESC, r.risk_level = ? DESC, r.risk_level = ? DESC, r.created_at DESC';
    params.push('high', 'medium', 'low');

    const rules = db.prepare(sql).all(...params);
    res.json({ success: true, data: rules });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/rules/:id', (req: AuthRequest, res: Response) => {
  try {
    const rule = db.prepare(`
      SELECT r.*, u.name as creator_name
      FROM review_rules r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.id = ?
    `).get(req.params.id);
    if (!rule) {
      res.status(404).json({ success: false, error: '规则不存在' });
      return;
    }
    res.json({ success: true, data: rule });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/rules', (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'admin') {
      res.status(403).json({ success: false, error: '只有管理员可以创建规则' });
      return;
    }

    const { name, contract_type, risk_level, pattern, is_regex, description, suggestion, is_enabled } = req.body;

    if (!name || !pattern) {
      res.status(400).json({ success: false, error: '规则名称和匹配模式不能为空' });
      return;
    }

    const info = db.prepare(`
      INSERT INTO review_rules (name, contract_type, risk_level, pattern, is_regex, description, suggestion, is_enabled, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      contract_type || 'all',
      risk_level || 'medium',
      pattern,
      is_regex ? 1 : 0,
      description || '',
      suggestion || '',
      is_enabled !== undefined ? (is_enabled ? 1 : 0) : 1,
      req.userId,
    );

    res.json({ success: true, data: { id: info.lastInsertRowid } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/rules/:id', (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'admin') {
      res.status(403).json({ success: false, error: '只有管理员可以修改规则' });
      return;
    }

    const ruleId = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM review_rules WHERE id = ?').get(ruleId) as ReviewRule | undefined;
    if (!existing) {
      res.status(404).json({ success: false, error: '规则不存在' });
      return;
    }

    const { name, contract_type, risk_level, pattern, is_regex, description, suggestion, is_enabled } = req.body;

    db.prepare(`
      UPDATE review_rules SET
        name = ?, contract_type = ?, risk_level = ?, pattern = ?, is_regex = ?,
        description = ?, suggestion = ?, is_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || existing.name,
      contract_type || existing.contract_type,
      risk_level || existing.risk_level,
      pattern !== undefined ? pattern : existing.pattern,
      is_regex !== undefined ? (is_regex ? 1 : 0) : existing.is_regex,
      description !== undefined ? description : existing.description,
      suggestion !== undefined ? suggestion : existing.suggestion,
      is_enabled !== undefined ? (is_enabled ? 1 : 0) : existing.is_enabled,
      ruleId,
    );

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/rules/:id', (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'admin') {
      res.status(403).json({ success: false, error: '只有管理员可以删除规则' });
      return;
    }

    const ruleId = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM review_rules WHERE id = ?').get(ruleId);
    if (!existing) {
      res.status(404).json({ success: false, error: '规则不存在' });
      return;
    }

    db.prepare('DELETE FROM review_rules WHERE id = ?').run(ruleId);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/contract/:id', (req: AuthRequest, res: Response) => {
  try {
    const contractId = Number(req.params.id);
    const contract = db.prepare(`
      SELECT c.*, t.category as contract_type
      FROM contracts c
      LEFT JOIN templates t ON c.template_id = t.id
      WHERE c.id = ?
    `).get(contractId) as any;

    if (!contract) {
      res.status(404).json({ success: false, error: '合同不存在' });
      return;
    }

    const rules = db.prepare(`
      SELECT * FROM review_rules
      WHERE is_enabled = 1 AND (contract_type = ? OR contract_type = ?)
    `).all(contract.contract_type || 'all', 'all') as any[];

    const plainText = stripHtml(contract.content);
    const paragraphs = splitIntoParagraphs(contract.content);

    const risks: any[] = [];

    rules.forEach((rule) => {
      if (rule.name === '合同金额为0') {
        if (contract.amount === 0) {
          risks.push({
            rule_id: rule.id,
            rule_name: rule.name,
            risk_level: rule.risk_level,
            matched_content: `合同金额：${contract.amount} 元`,
            paragraph: '合同元数据 - 金额字段',
            description: rule.description,
            suggestion: rule.suggestion,
          });
        }
        return;
      }

      if (rule.name === '有效期结束日期早于开始日期') {
        if (contract.effective_date && contract.expiry_date) {
          const start = new Date(contract.effective_date);
          const end = new Date(contract.expiry_date);
          if (end < start) {
            risks.push({
              rule_id: rule.id,
              rule_name: rule.name,
              risk_level: rule.risk_level,
              matched_content: `开始：${contract.effective_date}，结束：${contract.expiry_date}`,
              paragraph: '合同元数据 - 有效期字段',
              description: rule.description,
              suggestion: rule.suggestion,
            });
          }
        }
        return;
      }

      if (rule.name === '保密期限为空') {
        if (contract.contract_type === '保密协议') {
          const hasNdaTerm = matchPattern(plainText, '保密期限.*\\d+.*年|保密期限.*\\d+.*月', true);
          if (!hasNdaTerm.matched) {
            risks.push({
              rule_id: rule.id,
              rule_name: rule.name,
              risk_level: rule.risk_level,
              matched_content: '',
              paragraph: '合同正文 - 保密条款',
              description: rule.description,
              suggestion: rule.suggestion,
            });
          }
        }
        return;
      }

      if (rule.name === '金额大小写不一致') {
        if (contract.contract_type === '采购合同') {
          const amount = contract.amount;
          const upperCaseMatch = matchPattern(plainText, '(壹|贰|叁|肆|伍|陆|柒|捌|玖|拾|佰|仟|万|零|元|角|分)+[元整]', true);
          if (upperCaseMatch.matched) {
            const upperNums: Record<string, number> = { '零': 0, '壹': 1, '贰': 2, '叁': 3, '肆': 4, '伍': 5, '陆': 6, '柒': 7, '捌': 8, '玖': 9 };
            const units: Record<string, number> = { '拾': 10, '佰': 100, '仟': 1000, '万': 10000 };
            let parsed = 0;
            let current = 0;
            for (const char of upperCaseMatch.matchedContent) {
              if (upperNums[char] !== undefined) {
                current = upperNums[char];
              } else if (units[char] !== undefined) {
                parsed += current * units[char];
                current = 0;
              }
            }
            parsed += current;
            if (parsed > 0 && parsed !== amount) {
              risks.push({
                rule_id: rule.id,
                rule_name: rule.name,
                risk_level: rule.risk_level,
                matched_content: `小写：${amount}，大写：${upperCaseMatch.matchedContent}（解析：${parsed}）`,
                paragraph: '合同金额条款',
                description: rule.description,
                suggestion: rule.suggestion,
              });
            }
          }
        }
        return;
      }

      const isMissingRule = rule.name.startsWith('缺少');
      let matched = false;
      let matchedContent = '';
      let matchedParagraph = '';

      for (const para of paragraphs) {
        const result = matchPattern(para, rule.pattern, rule.is_regex === 1);
        if (result.matched) {
          matched = true;
          matchedContent = result.matchedContent;
          matchedParagraph = para;
          break;
        }
      }

      if ((isMissingRule && !matched) || (!isMissingRule && matched)) {
        risks.push({
          rule_id: rule.id,
          rule_name: rule.name,
          risk_level: rule.risk_level,
          matched_content: matchedContent,
          paragraph: matchedParagraph || '合同正文',
          description: rule.description,
          suggestion: rule.suggestion,
        });
      }
    });

    const highCount = risks.filter(r => r.risk_level === 'high').length;
    const mediumCount = risks.filter(r => r.risk_level === 'medium').length;
    const lowCount = risks.filter(r => r.risk_level === 'low').length;

    const historyInfo = db.prepare(`
      INSERT INTO review_history (contract_id, version, reviewed_by, total_risks, high_count, medium_count, low_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      contractId,
      contract.version,
      req.userId,
      risks.length,
      highCount,
      mediumCount,
      lowCount,
    );
    const historyId = Number(historyInfo.lastInsertRowid);

    const insertRisk = db.prepare(`
      INSERT INTO risk_records (review_history_id, contract_id, rule_id, rule_name, risk_level, matched_content, paragraph, description, suggestion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    risks.forEach((risk) => {
      insertRisk.run(
        historyId,
        contractId,
        risk.rule_id,
        risk.rule_name,
        risk.risk_level,
        risk.matched_content,
        risk.paragraph,
        risk.description,
        risk.suggestion,
      );
    });

    const prevHistory = db.prepare(`
      SELECT * FROM review_history
      WHERE contract_id = ? AND id < ?
      ORDER BY id DESC LIMIT 1
    `).get(contractId, historyId) as any;

    let comparison = null;
    if (prevHistory) {
      const prevRisks = db.prepare(`
        SELECT rule_id, rule_name, risk_level, matched_content
        FROM risk_records
        WHERE review_history_id = ?
      `).all(prevHistory.id) as any[];

      const currRiskIds = new Set(risks.map(r => `${r.rule_id}_${r.matched_content}`));
      const prevRiskIds = new Set(prevRisks.map((r: any) => `${r.rule_id}_${r.matched_content}`));

      const added = risks.filter(r => !prevRiskIds.has(`${r.rule_id}_${r.matched_content}`));
      const removed = prevRisks.filter((r: any) => !currRiskIds.has(`${r.rule_id}_${r.matched_content}`));
      const remaining = risks.filter(r => prevRiskIds.has(`${r.rule_id}_${r.matched_content}`));

      comparison = {
        added,
        removed,
        remaining,
        prev_version: prevHistory.version,
        curr_version: contract.version,
      };
    }

    const canSign = highCount === 0;

    res.json({
      success: true,
      data: {
        review_id: historyId,
        risks,
        counts: { total: risks.length, high: highCount, medium: mediumCount, low: lowCount },
        can_sign: canSign,
        comparison,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/contract/:id/latest', (req: AuthRequest, res: Response) => {
  try {
    const contractId = Number(req.params.id);
    const latest = db.prepare(`
      SELECT rh.*, u.name as reviewer_name
      FROM review_history rh
      LEFT JOIN users u ON rh.reviewed_by = u.id
      WHERE rh.contract_id = ?
      ORDER BY rh.id DESC LIMIT 1
    `).get(contractId) as any;

    if (!latest) {
      res.json({ success: true, data: null });
      return;
    }

    const risks = db.prepare(`
      SELECT r.*, u.name as handler_name
      FROM risk_records r
      LEFT JOIN users u ON r.handled_by = u.id
      WHERE r.review_history_id = ?
      ORDER BY r.risk_level = ? DESC, r.risk_level = ? DESC, r.risk_level = ? DESC
    `).all(latest.id, 'high', 'medium', 'low');

    const pendingHighCount = (risks as any[]).filter((r: any) => r.risk_level === 'high' && r.status === 'pending').length;

    res.json({
      success: true,
      data: {
        ...latest,
        risks,
        can_sign: pendingHighCount === 0,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/contract/:id/history', (req: AuthRequest, res: Response) => {
  try {
    const contractId = Number(req.params.id);
    const history = db.prepare(`
      SELECT rh.*, u.name as reviewer_name
      FROM review_history rh
      LEFT JOIN users u ON rh.reviewed_by = u.id
      WHERE rh.contract_id = ?
      ORDER BY rh.id DESC
    `).all(contractId);

    res.json({ success: true, data: history });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/risk/:id/status', (req: AuthRequest, res: Response) => {
  try {
    const riskId = Number(req.params.id);
    const { status, exempt_reason } = req.body;

    if (!['pending', 'modified', 'exempt'].includes(status)) {
      res.status(400).json({ success: false, error: '无效的状态值' });
      return;
    }

    if (status === 'exempt' && (!exempt_reason || exempt_reason.trim() === '')) {
      res.status(400).json({ success: false, error: '豁免时必须填写原因' });
      return;
    }

    const risk = db.prepare('SELECT * FROM risk_records WHERE id = ?').get(riskId) as any;
    if (!risk) {
      res.status(404).json({ success: false, error: '风险记录不存在' });
      return;
    }

    const oldStatus = risk.status;

    db.prepare(`
      UPDATE risk_records
      SET status = ?, exempt_reason = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      status,
      status === 'exempt' ? exempt_reason : null,
      req.userId,
      riskId,
    );

    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;

    db.prepare(`
      INSERT INTO risk_audit_logs (risk_record_id, contract_id, action, old_status, new_status, reason, operator_id, operator_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      riskId,
      risk.contract_id,
      status === 'modified' ? '标记已修改' : status === 'exempt' ? '风险豁免' : '重置状态',
      oldStatus,
      status,
      exempt_reason || '',
      req.userId,
      user?.name || '',
    );

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/risk/:id/audit', (req: AuthRequest, res: Response) => {
  try {
    const riskId = Number(req.params.id);
    const logs = db.prepare(`
      SELECT * FROM risk_audit_logs
      WHERE risk_record_id = ?
      ORDER BY created_at DESC
    `).all(riskId);

    res.json({ success: true, data: logs });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/dashboard', (req: AuthRequest, res: Response) => {
  try {
    const { contract_type, risk_level, startDate, endDate } = req.query;

    let dateFilterSql = '';
    const dateParams: any[] = [];
    if (startDate) {
      dateFilterSql += ' AND rh.reviewed_at >= ?';
      dateParams.push(startDate);
    }
    if (endDate) {
      dateFilterSql += ' AND rh.reviewed_at <= ?';
      dateParams.push(endDate + ' 23:59:59');
    }

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const fmtMonthStart = monthStart.toISOString().split('T')[0];

    const monthHighRiskSql = `
      SELECT COUNT(DISTINCT rh.contract_id) as count
      FROM review_history rh
      INNER JOIN (
        SELECT review_history_id, MAX(created_at) as max_date
        FROM risk_records
        WHERE risk_level = ? AND status = ?
        GROUP BY review_history_id
      ) rr ON rh.id = rr.review_history_id
      WHERE rh.reviewed_at >= ?
    `;
    const monthHighRisk = (db.prepare(monthHighRiskSql).get('high', 'pending', fmtMonthStart) as any).count;

    let typeSql = `
      SELECT t.category as contract_type,
             SUM(CASE WHEN r.risk_level = 'high' THEN 1 ELSE 0 END) as high_count,
             SUM(CASE WHEN r.risk_level = 'medium' THEN 1 ELSE 0 END) as medium_count,
             SUM(CASE WHEN r.risk_level = 'low' THEN 1 ELSE 0 END) as low_count,
             COUNT(*) as total
      FROM risk_records r
      INNER JOIN review_history rh ON r.review_history_id = rh.id
      LEFT JOIN contracts c ON r.contract_id = c.id
      LEFT JOIN templates t ON c.template_id = t.id
      WHERE 1=1
    `;
    const typeParams: any[] = [];
    if (contract_type) {
      typeSql += ' AND t.category = ?';
      typeParams.push(contract_type);
    }
    typeSql += ' ' + dateFilterSql;
    typeParams.push(...dateParams);
    typeSql += ' GROUP BY t.category ORDER BY total DESC';
    const typeDistribution = db.prepare(typeSql).all(...typeParams);

    let topSql = `
      SELECT rule_name,
             SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) as high_count,
             SUM(CASE WHEN risk_level = 'medium' THEN 1 ELSE 0 END) as medium_count,
             SUM(CASE WHEN risk_level = 'low' THEN 1 ELSE 0 END) as low_count,
             COUNT(*) as total
      FROM risk_records r
      INNER JOIN review_history rh ON r.review_history_id = rh.id
      WHERE 1=1
    `;
    const topParams: any[] = [];
    if (risk_level) {
      topSql += ' AND r.risk_level = ?';
      topParams.push(risk_level);
    }
    topSql += ' ' + dateFilterSql;
    topParams.push(...dateParams);
    topSql += ' GROUP BY rule_name ORDER BY total DESC LIMIT 10';
    const topRisks = db.prepare(topSql).all(...topParams);

    let pendingSql = `
      SELECT r.*, c.title as contract_title, c.contract_no, rh.reviewed_at
      FROM risk_records r
      INNER JOIN contracts c ON r.contract_id = c.id
      INNER JOIN review_history rh ON r.review_history_id = rh.id
      WHERE r.status = ?
    `;
    const pendingParams: any[] = ['pending'];
    if (contract_type) {
      pendingSql += ` AND EXISTS (SELECT 1 FROM templates t WHERE t.id = c.template_id AND t.category = ?)`;
      pendingParams.push(contract_type);
    }
    if (risk_level) {
      pendingSql += ' AND r.risk_level = ?';
      pendingParams.push(risk_level);
    }
    pendingSql += ' ' + dateFilterSql.replace(/rh\./g, 'rh2.');
    if (dateParams.length > 0) {
      pendingSql += ' AND EXISTS (SELECT 1 FROM review_history rh2 WHERE rh2.id = r.review_history_id ' + dateFilterSql + ')';
    }
    pendingSql += ' ORDER BY r.risk_level = ? DESC, r.risk_level = ? DESC, r.risk_level = ? DESC, r.created_at DESC LIMIT 50';
    pendingParams.push('high', 'medium', 'low');
    const pendingList = db.prepare(pendingSql).all(...pendingParams);

    res.json({
      success: true,
      data: {
        month_high_risk: monthHighRisk,
        type_distribution: typeDistribution,
        top_risks: topRisks,
        pending_list: pendingList,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
