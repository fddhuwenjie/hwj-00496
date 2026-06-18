import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'contracts.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'signer',
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS template_variables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER REFERENCES templates(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      description TEXT,
      placeholder TEXT
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_no TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      template_id INTEGER REFERENCES templates(id),
      content TEXT NOT NULL,
      party_a TEXT,
      party_b TEXT,
      amount REAL DEFAULT 0,
      effective_date DATE,
      expiry_date DATE,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      version INTEGER DEFAULT 1,
      is_voided INTEGER DEFAULT 0,
      void_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS contract_signers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      sign_order INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      signed_at DATETIME,
      signature_data TEXT,
      sign_ip TEXT,
      reject_reason TEXT,
      position_x INTEGER,
      position_y INTEGER,
      sign_page INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS void_confirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      confirmed INTEGER DEFAULT 0,
      confirmed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(contract_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS signatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      signature_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contract_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      changed_by INTEGER REFERENCES users(id),
      change_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS signature_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      contract_id INTEGER REFERENCES contracts(id),
      action TEXT NOT NULL,
      sign_ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      contract_id INTEGER REFERENCES contracts(id),
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS review_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contract_type TEXT NOT NULL DEFAULT 'all',
      risk_level TEXT NOT NULL DEFAULT 'medium',
      pattern TEXT NOT NULL,
      is_regex INTEGER DEFAULT 0,
      description TEXT,
      suggestion TEXT,
      is_enabled INTEGER DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS review_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_risks INTEGER DEFAULT 0,
      high_count INTEGER DEFAULT 0,
      medium_count INTEGER DEFAULT 0,
      low_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS risk_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_history_id INTEGER REFERENCES review_history(id) ON DELETE CASCADE,
      contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
      rule_id INTEGER REFERENCES review_rules(id),
      rule_name TEXT,
      risk_level TEXT NOT NULL,
      matched_content TEXT,
      paragraph TEXT,
      description TEXT,
      suggestion TEXT,
      status TEXT DEFAULT 'pending',
      exempt_reason TEXT,
      handled_by INTEGER REFERENCES users(id),
      handled_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS risk_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      risk_record_id INTEGER REFERENCES risk_records(id) ON DELETE CASCADE,
      contract_id INTEGER REFERENCES contracts(id),
      action TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT,
      reason TEXT,
      operator_id INTEGER REFERENCES users(id),
      operator_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contract_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      node_name TEXT NOT NULL,
      node_type TEXT NOT NULL DEFAULT 'other',
      responsible_party TEXT,
      planned_date DATE NOT NULL,
      amount REAL DEFAULT 0,
      deliverable TEXT,
      status TEXT NOT NULL DEFAULT 'not_started',
      completed_at DATETIME,
      completed_by INTEGER REFERENCES users(id),
      attachment_url TEXT,
      remark TEXT,
      sort_order INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function seedData() {
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
  if (userCount > 0) return;

  const insertUser = db.prepare(`
    INSERT INTO users (username, password, name, role, email) VALUES (?, ?, ?, ?, ?)
  `);

  const users = [
    { username: 'admin1', password: '123456', name: '系统管理员A', role: 'admin', email: 'admin1@example.com' },
    { username: 'admin2', password: '123456', name: '系统管理员B', role: 'admin', email: 'admin2@example.com' },
    { username: 'user1', password: '123456', name: '张三', role: 'signer', email: 'zhangsan@example.com' },
    { username: 'user2', password: '123456', name: '李四', role: 'signer', email: 'lisi@example.com' },
    { username: 'user3', password: '123456', name: '王五', role: 'signer', email: 'wangwu@example.com' },
  ];

  const userIds: number[] = [];
  users.forEach((u) => {
    const info = insertUser.run(u.username, u.password, u.name, u.role, u.email);
    userIds.push(Number(info.lastInsertRowid));
  });

  const insertTemplate = db.prepare(`
    INSERT INTO templates (name, category, content, created_by) VALUES (?, ?, ?, ?)
  `);
  const insertVariable = db.prepare(`
    INSERT INTO template_variables (template_id, name, type, description, placeholder) VALUES (?, ?, ?, ?, ?)
  `);

  const templates = [
    {
      name: '标准劳动合同',
      category: '劳动合同',
      content: `<div style="padding:40px;font-family:SimSun,serif;">
<h2 style="text-align:center;">劳动合同</h2>
<p style="text-align:right;">合同编号：{{合同编号}}</p>
<p>甲方（用人单位）：<b>{{甲方名称}}</b></p>
<p>乙方（劳动者）：<b>{{乙方名称}}</b></p>
<p>根据《中华人民共和国劳动法》等法律法规，甲乙双方本着平等自愿、协商一致的原则，签订本合同。</p>
<h3>一、合同期限</h3>
<p>本合同期限为{{合同期限}}，自{{开始日期}}起至{{结束日期}}止。</p>
<h3>二、工作内容与地点</h3>
<p>乙方同意在甲方安排的{{工作地点}}从事{{工作岗位}}工作。</p>
<h3>三、劳动报酬</h3>
<p>甲方按月支付乙方工资，月工资为人民币{{月工资}}元。</p>
<h3>四、其他</h3>
<p>本合同一式两份，甲乙双方各执一份。</p>
<br/><br/>
<p>甲方（盖章）：____________________ &nbsp;&nbsp;&nbsp; 乙方（签字）：____________________</p>
<p>日期：{{签订日期}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 日期：{{签订日期}}</p>
</div>`,
      variables: [
        { name: '合同编号', type: 'text', description: '合同编号' },
        { name: '甲方名称', type: 'text', description: '用人单位名称' },
        { name: '乙方名称', type: 'text', description: '劳动者姓名' },
        { name: '合同期限', type: 'text', description: '合同期限描述' },
        { name: '开始日期', type: 'date', description: '合同开始日期' },
        { name: '结束日期', type: 'date', description: '合同结束日期' },
        { name: '工作地点', type: 'text', description: '工作地点' },
        { name: '工作岗位', type: 'text', description: '工作岗位' },
        { name: '月工资', type: 'number', description: '月工资金额' },
        { name: '签订日期', type: 'date', description: '合同签订日期' },
      ],
    },
    {
      name: '采购合同模板',
      category: '采购合同',
      content: `<div style="padding:40px;font-family:SimSun,serif;">
<h2 style="text-align:center;">采购合同</h2>
<p style="text-align:right;">合同编号：{{合同编号}}</p>
<p>甲方（采购方）：<b>{{甲方名称}}</b></p>
<p>乙方（供货方）：<b>{{乙方名称}}</b></p>
<p>根据《中华人民共和国民法典》等相关法律规定，甲乙双方经友好协商，就甲方向乙方采购货物事宜达成如下协议：</p>
<h3>一、采购标的</h3>
<p>货物名称：{{货物名称}}</p>
<p>数量：{{数量}}</p>
<p>单价：人民币{{单价}}元</p>
<p>合同总金额：人民币{{总金额}}元（大写：{{大写金额}}）</p>
<h3>二、交货方式</h3>
<p>交货地点：{{交货地点}}</p>
<p>交货时间：{{交货时间}}</p>
<h3>三、付款方式</h3>
<p>{{付款方式}}</p>
<h3>四、违约责任</h3>
<p>双方应严格履行本合同约定，如一方违约应承担相应违约责任。</p>
<br/><br/>
<p>甲方（盖章）：____________________ &nbsp;&nbsp;&nbsp; 乙方（盖章）：____________________</p>
<p>日期：{{签订日期}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 日期：{{签订日期}}</p>
</div>`,
      variables: [
        { name: '合同编号', type: 'text', description: '合同编号' },
        { name: '甲方名称', type: 'text', description: '采购方名称' },
        { name: '乙方名称', type: 'text', description: '供货方名称' },
        { name: '货物名称', type: 'text', description: '采购货物名称' },
        { name: '数量', type: 'number', description: '采购数量' },
        { name: '单价', type: 'number', description: '单价' },
        { name: '总金额', type: 'number', description: '合同总金额' },
        { name: '大写金额', type: 'text', description: '金额大写' },
        { name: '交货地点', type: 'text', description: '交货地点' },
        { name: '交货时间', type: 'date', description: '交货时间' },
        { name: '付款方式', type: 'text', description: '付款方式描述' },
        { name: '签订日期', type: 'date', description: '合同签订日期' },
      ],
    },
    {
      name: '保密协议模板',
      category: '保密协议',
      content: `<div style="padding:40px;font-family:SimSun,serif;">
<h2 style="text-align:center;">保密协议</h2>
<p style="text-align:right;">协议编号：{{协议编号}}</p>
<p>甲方：<b>{{甲方名称}}</b></p>
<p>乙方：<b>{{乙方名称}}</b></p>
<p>鉴于甲乙双方在合作过程中可能接触到对方的商业秘密，为保护双方的合法权益，特签订本保密协议：</p>
<h3>一、保密信息</h3>
<p>本协议所称保密信息，是指双方在合作中获知的对方不为公众所知悉、能为权利人带来经济利益的技术信息和经营信息。</p>
<h3>二、保密期限</h3>
<p>保密期限为{{保密期限}}年，自本协议签订之日起计算。</p>
<h3>三、保密义务</h3>
<p>双方应对获知的保密信息予以严格保密，未经对方书面同意，不得向任何第三方披露。</p>
<h3>四、违约责任</h3>
<p>如一方违反本协议约定，应向对方支付违约金人民币{{违约金}}元，并赔偿由此造成的损失。</p>
<br/><br/>
<p>甲方（盖章）：____________________ &nbsp;&nbsp;&nbsp; 乙方（签字/盖章）：____________________</p>
<p>日期：{{签订日期}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 日期：{{签订日期}}</p>
</div>`,
      variables: [
        { name: '协议编号', type: 'text', description: '协议编号' },
        { name: '甲方名称', type: 'text', description: '甲方名称' },
        { name: '乙方名称', type: 'text', description: '乙方名称' },
        { name: '保密期限', type: 'number', description: '保密年限' },
        { name: '违约金', type: 'number', description: '违约金额' },
        { name: '签订日期', type: 'date', description: '协议签订日期' },
      ],
    },
  ];

  const templateIds: number[] = [];
  templates.forEach((t) => {
    const info = insertTemplate.run(t.name, t.category, t.content, userIds[0]);
    const templateId = Number(info.lastInsertRowid);
    templateIds.push(templateId);
    t.variables.forEach((v) => {
      insertVariable.run(templateId, v.name, v.type, v.description, `{{${v.name}}}`);
    });
  });

  function generateContractNo() {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `HT${y}${m}${d}${rand}`;
  }

  function fillTemplate(content: string, vars: Record<string, string>): string {
    let result = content;
    Object.entries(vars).forEach(([k, v]) => {
      result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    });
    return result;
  }

  const today = new Date();
  const fmtDate = (d: Date) => d.toISOString().split('T')[0];
  const addDays = (d: Date, days: number) => {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + days);
    return nd;
  };

  const insertContract = db.prepare(`
    INSERT INTO contracts (contract_no, title, template_id, content, party_a, party_b, amount, effective_date, expiry_date, status, created_by, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSigner = db.prepare(`
    INSERT INTO contract_signers (contract_id, user_id, sign_order, status) VALUES (?, ?, ?, ?)
  `);

  const contracts = [
    {
      title: '张三劳动合同2026',
      templateIdx: 0,
      party_a: '北京科技有限公司',
      party_b: '张三',
      amount: 15000,
      effectiveDate: fmtDate(today),
      expiryDate: fmtDate(addDays(today, 365)),
      status: 'draft',
      signers: [userIds[0], userIds[2]],
      vars: {
        合同编号: generateContractNo(),
        甲方名称: '北京科技有限公司',
        乙方名称: '张三',
        合同期限: '一年',
        开始日期: fmtDate(today),
        结束日期: fmtDate(addDays(today, 365)),
        工作地点: '北京市海淀区',
        工作岗位: '高级工程师',
        月工资: '15000',
        签订日期: fmtDate(today),
      },
    },
    {
      title: '办公设备采购合同（草稿）',
      templateIdx: 1,
      party_a: '北京科技有限公司',
      party_b: '李四的设备公司',
      amount: 50000,
      effectiveDate: fmtDate(today),
      expiryDate: fmtDate(addDays(today, 90)),
      status: 'draft',
      signers: [userIds[0], userIds[3]],
      vars: {
        合同编号: generateContractNo(),
        甲方名称: '北京科技有限公司',
        乙方名称: '李四的设备公司',
        货物名称: '办公电脑及打印机',
        数量: '20',
        单价: '2500',
        总金额: '50000',
        大写金额: '伍万元整',
        交货地点: '北京市海淀区中关村大街1号',
        交货时间: fmtDate(addDays(today, 7)),
        付款方式: '货到验收合格后10个工作日内一次性支付',
        签订日期: fmtDate(today),
      },
    },
    {
      title: '王五劳动合同2026（待签署）',
      templateIdx: 0,
      party_a: '北京科技有限公司',
      party_b: '王五',
      amount: 12000,
      effectiveDate: fmtDate(today),
      expiryDate: fmtDate(addDays(today, 365)),
      status: 'pending',
      signers: [userIds[0], userIds[4]],
      vars: {
        合同编号: generateContractNo(),
        甲方名称: '北京科技有限公司',
        乙方名称: '王五',
        合同期限: '一年',
        开始日期: fmtDate(today),
        结束日期: fmtDate(addDays(today, 365)),
        工作地点: '北京市朝阳区',
        工作岗位: '产品经理',
        月工资: '12000',
        签订日期: fmtDate(today),
      },
    },
    {
      title: '软件开发服务保密协议（待签署）',
      templateIdx: 2,
      party_a: '北京科技有限公司',
      party_b: '张三',
      amount: 0,
      effectiveDate: fmtDate(today),
      expiryDate: fmtDate(addDays(today, 1095)),
      status: 'pending',
      signers: [userIds[0], userIds[2]],
      vars: {
        协议编号: generateContractNo(),
        甲方名称: '北京科技有限公司',
        乙方名称: '张三',
        保密期限: '3',
        违约金: '100000',
        签订日期: fmtDate(today),
      },
    },
    {
      title: '服务器采购合同（已签署）',
      templateIdx: 1,
      party_a: '北京科技有限公司',
      party_b: '李四的设备公司',
      amount: 200000,
      effectiveDate: fmtDate(addDays(today, -60)),
      expiryDate: fmtDate(addDays(today, 300)),
      status: 'signed',
      signers: [userIds[0], userIds[3]],
      vars: {
        合同编号: generateContractNo(),
        甲方名称: '北京科技有限公司',
        乙方名称: '李四的设备公司',
        货物名称: '企业级服务器',
        数量: '4',
        单价: '50000',
        总金额: '200000',
        大写金额: '贰拾万元整',
        交货地点: '北京市海淀区中关村大街1号机房',
        交货时间: fmtDate(addDays(today, -50)),
        付款方式: '预付30%，验收合格后付清余款',
        签订日期: fmtDate(addDays(today, -60)),
      },
    },
    {
      title: '张三劳动合同2025（已签署）',
      templateIdx: 0,
      party_a: '北京科技有限公司',
      party_b: '张三',
      amount: 13000,
      effectiveDate: fmtDate(addDays(today, -365)),
      expiryDate: fmtDate(addDays(today, -1)),
      status: 'signed',
      signers: [userIds[0], userIds[2]],
      vars: {
        合同编号: generateContractNo(),
        甲方名称: '北京科技有限公司',
        乙方名称: '张三',
        合同期限: '一年',
        开始日期: fmtDate(addDays(today, -365)),
        结束日期: fmtDate(addDays(today, -1)),
        工作地点: '北京市海淀区',
        工作岗位: '工程师',
        月工资: '13000',
        签订日期: fmtDate(addDays(today, -365)),
      },
    },
    {
      title: '办公场地租赁保密协议（已签署）',
      templateIdx: 2,
      party_a: '北京科技有限公司',
      party_b: '王五',
      amount: 0,
      effectiveDate: fmtDate(addDays(today, -200)),
      expiryDate: fmtDate(addDays(today, 165)),
      status: 'signed',
      signers: [userIds[0], userIds[4]],
      vars: {
        协议编号: generateContractNo(),
        甲方名称: '北京科技有限公司',
        乙方名称: '王五',
        保密期限: '5',
        违约金: '200000',
        签订日期: fmtDate(addDays(today, -200)),
      },
    },
    {
      title: '2024年度员工劳动合同（已过期）',
      templateIdx: 0,
      party_a: '北京科技有限公司',
      party_b: '李四',
      amount: 10000,
      effectiveDate: fmtDate(addDays(today, -730)),
      expiryDate: fmtDate(addDays(today, -365)),
      status: 'expired',
      signers: [userIds[0], userIds[3]],
      vars: {
        合同编号: generateContractNo(),
        甲方名称: '北京科技有限公司',
        乙方名称: '李四',
        合同期限: '一年',
        开始日期: fmtDate(addDays(today, -730)),
        结束日期: fmtDate(addDays(today, -365)),
        工作地点: '北京市西城区',
        工作岗位: '行政助理',
        月工资: '10000',
        签订日期: fmtDate(addDays(today, -730)),
      },
    },
  ];

  const contractIds: number[] = [];
  contracts.forEach((c) => {
    const content = fillTemplate(templates[c.templateIdx].content, c.vars);
    const info = insertContract.run(
      generateContractNo(),
      c.title,
      templateIds[c.templateIdx],
      content,
      c.party_a,
      c.party_b,
      c.amount,
      c.effectiveDate,
      c.expiryDate,
      c.status,
      userIds[0],
      1,
    );
    const contractId = Number(info.lastInsertRowid);
    contractIds.push(contractId);

    c.signers.forEach((uid, idx) => {
      const signerStatus = c.status === 'signed' ? 'signed' : 'pending';
      const sInfo = insertSigner.run(contractId, uid, idx + 1, signerStatus);
      if (c.status === 'signed') {
        const signDate = addDays(today, -Math.floor(Math.random() * 30));
        db.prepare('UPDATE contract_signers SET signed_at = ? WHERE id = ?').run(
          fmtDate(signDate) + ' 10:00:00',
          sInfo.lastInsertRowid,
        );
        db.prepare(`INSERT INTO signature_logs (user_id, contract_id, action, sign_ip) VALUES (?, ?, ?, ?)`).run(
          uid,
          contractId,
          'sign',
          '192.168.1.' + Math.floor(Math.random() * 255),
        );
      }
    });
  });

  seedReviewRules(userIds[0]);
  seedRiskyContracts(userIds[0], [userIds[2], userIds[3], userIds[4]], templateIds);
}

function migrateDatabase() {
  const columns = db.prepare("PRAGMA table_info(contract_signers)").all() as any[];
  const colNames = columns.map((c) => c.name);
  if (!colNames.includes('position_x')) {
    db.exec('ALTER TABLE contract_signers ADD COLUMN position_x INTEGER');
  }
  if (!colNames.includes('position_y')) {
    db.exec('ALTER TABLE contract_signers ADD COLUMN position_y INTEGER');
  }
  if (!colNames.includes('sign_page')) {
    db.exec('ALTER TABLE contract_signers ADD COLUMN sign_page INTEGER DEFAULT 1');
  }

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='void_confirmations'").all() as any[];
  if (tables.length === 0) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS void_confirmations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        confirmed INTEGER DEFAULT 0,
        confirmed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(contract_id, user_id)
      )
    `);
  } else {
    const voidCols = db.prepare("PRAGMA table_info(void_confirmations)").all() as any[];
    const voidColNames = voidCols.map((c) => c.name);
    if (!voidColNames.includes('confirmed')) {
      db.exec('ALTER TABLE void_confirmations ADD COLUMN confirmed INTEGER DEFAULT 0');
    }
    if (!voidColNames.includes('confirmed_at')) {
      db.exec('ALTER TABLE void_confirmations ADD COLUMN confirmed_at DATETIME');
    }
    if (!voidColNames.includes('created_at')) {
      db.exec('ALTER TABLE void_confirmations ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    }
  }

  const contractCols = db.prepare("PRAGMA table_info(contracts)").all() as any[];
  const contractColNames = contractCols.map((c) => c.name);
  if (!contractColNames.includes('void_initiated_by')) {
    db.exec('ALTER TABLE contracts ADD COLUMN void_initiated_by INTEGER');
    db.exec('ALTER TABLE contracts ADD COLUMN void_initiated_at DATETIME');
  }

  const newTables = ['review_rules', 'review_history', 'risk_records', 'risk_audit_logs'];
  newTables.forEach((tableName) => {
    const existing = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
    if (!existing) {
      if (tableName === 'review_rules') {
        db.exec(`
          CREATE TABLE IF NOT EXISTS review_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            contract_type TEXT NOT NULL DEFAULT 'all',
            risk_level TEXT NOT NULL DEFAULT 'medium',
            pattern TEXT NOT NULL,
            is_regex INTEGER DEFAULT 0,
            description TEXT,
            suggestion TEXT,
            is_enabled INTEGER DEFAULT 1,
            created_by INTEGER REFERENCES users(id),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
      } else if (tableName === 'review_history') {
        db.exec(`
          CREATE TABLE IF NOT EXISTS review_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
            version INTEGER NOT NULL,
            reviewed_by INTEGER REFERENCES users(id),
            reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            total_risks INTEGER DEFAULT 0,
            high_count INTEGER DEFAULT 0,
            medium_count INTEGER DEFAULT 0,
            low_count INTEGER DEFAULT 0
          )
        `);
      } else if (tableName === 'risk_records') {
        db.exec(`
          CREATE TABLE IF NOT EXISTS risk_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            review_history_id INTEGER REFERENCES review_history(id) ON DELETE CASCADE,
            contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
            rule_id INTEGER REFERENCES review_rules(id),
            rule_name TEXT,
            risk_level TEXT NOT NULL,
            matched_content TEXT,
            paragraph TEXT,
            description TEXT,
            suggestion TEXT,
            status TEXT DEFAULT 'pending',
            exempt_reason TEXT,
            handled_by INTEGER REFERENCES users(id),
            handled_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
      } else if (tableName === 'risk_audit_logs') {
        db.exec(`
          CREATE TABLE IF NOT EXISTS risk_audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            risk_record_id INTEGER REFERENCES risk_records(id) ON DELETE CASCADE,
            contract_id INTEGER REFERENCES contracts(id),
            action TEXT NOT NULL,
            old_status TEXT,
            new_status TEXT,
            reason TEXT,
            operator_id INTEGER REFERENCES users(id),
            operator_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }
    }
  });
}

function seedReviewRules(createdBy: number) {
  const rules = [
    {
      name: '缺少违约责任条款',
      contract_type: 'all',
      risk_level: 'high',
      pattern: '违约责任',
      is_regex: 0,
      description: '合同中未包含违约责任条款，一方违约时难以追究责任',
      suggestion: '建议添加"违约责任"章节，明确双方违约情形及违约金计算方式',
    },
    {
      name: '付款周期超过90天',
      contract_type: '采购合同',
      risk_level: 'high',
      pattern: '(9[1-9]|[1-9]\\d{2,})\\s*天',
      is_regex: 1,
      description: '付款周期超过90天，资金占用风险较高',
      suggestion: '建议缩短付款周期至30-60天，或增加逾期付款违约金条款',
    },
    {
      name: '合同金额为0',
      contract_type: 'all',
      risk_level: 'high',
      pattern: '',
      is_regex: 0,
      description: '合同金额为0，可能是数据录入错误或存在无偿转移风险',
      suggestion: '请核实合同金额，如为无偿合同请在条款中明确说明',
    },
    {
      name: '有效期结束日期早于开始日期',
      contract_type: 'all',
      risk_level: 'high',
      pattern: '',
      is_regex: 0,
      description: '合同有效期结束日期早于开始日期，属于明显的逻辑错误',
      suggestion: '请检查并修正合同有效期的开始和结束日期',
    },
    {
      name: '保密期限为空',
      contract_type: '保密协议',
      risk_level: 'high',
      pattern: '',
      is_regex: 0,
      description: '保密协议未约定保密期限，保密义务终止时间不明确',
      suggestion: '建议明确约定保密期限，一般为2-5年或直至信息公开',
    },
    {
      name: '缺少争议解决条款',
      contract_type: 'all',
      risk_level: 'medium',
      pattern: '争议解决|诉讼|仲裁',
      is_regex: 0,
      description: '合同未约定争议解决方式，发生纠纷时管辖不明确',
      suggestion: '建议添加争议解决条款，明确约定管辖法院或仲裁机构',
    },
    {
      name: '缺少不可抗力条款',
      contract_type: 'all',
      risk_level: 'medium',
      pattern: '不可抗力',
      is_regex: 0,
      description: '合同未约定不可抗力条款，免责情形不明确',
      suggestion: '建议添加不可抗力条款，明确不可抗力的范围及免责方式',
    },
    {
      name: '合同期限超过20年',
      contract_type: '租赁合同',
      risk_level: 'high',
      pattern: '(2[1-9]|[3-9]\\d|\\d{3,})\\s*年',
      is_regex: 1,
      description: '根据《民法典》规定，租赁合同期限不得超过20年',
      suggestion: '建议将租赁期限缩短至20年以内，超过部分无效',
    },
    {
      name: '缺少合同生效条件',
      contract_type: 'all',
      risk_level: 'low',
      pattern: '本合同.*生效|合同自.*生效',
      is_regex: 0,
      description: '合同未明确约定生效条件，生效时间可能存在争议',
      suggestion: '建议明确合同生效条件，如"本合同自双方签字盖章之日起生效"',
    },
    {
      name: '金额大小写不一致',
      contract_type: '采购合同',
      risk_level: 'medium',
      pattern: '',
      is_regex: 0,
      description: '合同金额的大写与小写表述不一致',
      suggestion: '请核实并统一合同金额的大小写表述',
    },
    {
      name: '缺少保密条款',
      contract_type: '劳动合同',
      risk_level: 'medium',
      pattern: '保密|商业秘密',
      is_regex: 0,
      description: '劳动合同未包含保密条款，企业商业秘密保护不足',
      suggestion: '建议在劳动合同中增加保密条款或单独签订保密协议',
    },
    {
      name: '试用期超过法定期限',
      contract_type: '劳动合同',
      risk_level: 'high',
      pattern: '试用期.*(6[1-9]|[7-9]\\d|\\d{3,})\\s*天|试用期.*[7-9]\\s*个月',
      is_regex: 1,
      description: '根据《劳动合同法》，试用期最长不得超过6个月',
      suggestion: '请根据劳动合同期限调整试用期，3年以上固定期限合同试用期不得超过6个月',
    },
  ];

  const insertRule = db.prepare(`
    INSERT INTO review_rules (name, contract_type, risk_level, pattern, is_regex, description, suggestion, is_enabled, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);

  rules.forEach((rule) => {
    insertRule.run(
      rule.name,
      rule.contract_type,
      rule.risk_level,
      rule.pattern,
      rule.is_regex,
      rule.description,
      rule.suggestion,
      createdBy,
    );
  });
}

function seedRiskyContracts(adminId: number, userIds: number[], templateIds: number[]) {
  function generateContractNo() {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `HT${y}${m}${d}${rand}`;
  }

  function fillTemplate(content: string, vars: Record<string, string>): string {
    let result = content;
    Object.entries(vars).forEach(([k, v]) => {
      result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    });
    return result;
  }

  const today = new Date();
  const fmtDate = (d: Date) => d.toISOString().split('T')[0];
  const addDays = (d: Date, days: number) => {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + days);
    return nd;
  };

  const insertContract = db.prepare(`
    INSERT INTO contracts (contract_no, title, template_id, content, party_a, party_b, amount, effective_date, expiry_date, status, created_by, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, 1)
  `);
  const insertSigner = db.prepare(`
    INSERT INTO contract_signers (contract_id, user_id, sign_order, status) VALUES (?, ?, ?, ?)
  `);

  const template0Content = db.prepare('SELECT content FROM templates WHERE id = ?').get(templateIds[0]) as any;
  const template1Content = db.prepare('SELECT content FROM templates WHERE id = ?').get(templateIds[1]) as any;
  const template2Content = db.prepare('SELECT content FROM templates WHERE id = ?').get(templateIds[2]) as any;

  const riskyContracts = [
    {
      title: '【高风险】金额为0的采购合同',
      templateId: templateIds[1],
      templateContent: template1Content.content,
      party_a: '北京科技有限公司',
      party_b: '风险供应商A',
      amount: 0,
      effectiveDate: fmtDate(today),
      expiryDate: fmtDate(addDays(today, 90)),
      signers: [adminId, userIds[1]],
      vars: {
        合同编号: generateContractNo(),
        甲方名称: '北京科技有限公司',
        乙方名称: '风险供应商A',
        货物名称: '测试货物',
        数量: '100',
        单价: '0',
        总金额: '0',
        大写金额: '零元整',
        交货地点: '北京市海淀区',
        交货时间: fmtDate(addDays(today, 7)),
        付款方式: '货到验收合格后一次性支付，付款周期180天',
        签订日期: fmtDate(today),
      },
      removeSections: ['违约责任'],
    },
    {
      title: '【高风险】日期异常的劳动合同',
      templateId: templateIds[0],
      templateContent: template0Content.content,
      party_a: '北京科技有限公司',
      party_b: '风险员工B',
      amount: 8000,
      effectiveDate: fmtDate(addDays(today, 365)),
      expiryDate: fmtDate(today),
      signers: [adminId, userIds[2]],
      vars: {
        合同编号: generateContractNo(),
        甲方名称: '北京科技有限公司',
        乙方名称: '风险员工B',
        合同期限: '一年',
        开始日期: fmtDate(addDays(today, 365)),
        结束日期: fmtDate(today),
        工作地点: '北京市朝阳区',
        工作岗位: '测试岗位',
        月工资: '8000',
        签订日期: fmtDate(today),
      },
      removeSections: ['保密'],
      addTrialPeriod: '试用期8个月',
    },
    {
      title: '【高风险】缺少保密期限的保密协议',
      templateId: templateIds[2],
      templateContent: template2Content.content,
      party_a: '北京科技有限公司',
      party_b: '风险合作方C',
      amount: 0,
      effectiveDate: fmtDate(today),
      expiryDate: fmtDate(addDays(today, 365)),
      signers: [adminId, userIds[0]],
      vars: {
        协议编号: generateContractNo(),
        甲方名称: '北京科技有限公司',
        乙方名称: '风险合作方C',
        保密期限: '',
        违约金: '50000',
        签订日期: fmtDate(today),
      },
      removeSections: ['违约责任', '争议解决', '不可抗力'],
    },
  ];

  riskyContracts.forEach((c) => {
    let content = fillTemplate(c.templateContent, c.vars);

    if (c.removeSections) {
      c.removeSections.forEach((section) => {
        content = content.replace(new RegExp(`<h3>[一二三四五六七八九十]*、[^<]*${section}[^<]*</h3>`, 'g'), '');
        content = content.replace(new RegExp(`<p>[^<]*${section}[^<]*</p>`, 'g'), '');
      });
    }

    if (c.addTrialPeriod) {
      content = content.replace(
        '<h3>二、工作内容与地点</h3>',
        `<p>试用期：${c.addTrialPeriod}</p>\n<h3>二、工作内容与地点</h3>`,
      );
    }

    const info = insertContract.run(
      c.vars['合同编号'] || generateContractNo(),
      c.title,
      c.templateId,
      content,
      c.party_a,
      c.party_b,
      c.amount,
      c.effectiveDate,
      c.expiryDate,
      adminId,
    );

    const contractId = Number(info.lastInsertRowid);
    c.signers.forEach((uid, idx) => {
      insertSigner.run(contractId, uid, idx + 1, 'pending');
    });

    db.prepare('INSERT INTO contract_versions (contract_id, version, content, changed_by) VALUES (?, 1, ?, ?)').run(
      contractId, content, adminId,
    );
  });
}

function seedPerformanceNodes() {
  const nodeCount = (db.prepare('SELECT COUNT(*) as count FROM contract_nodes').get() as any).count;
  if (nodeCount > 0) return;

  const admin = db.prepare("SELECT id FROM users WHERE username = 'admin1' LIMIT 1").get() as any;
  if (!admin) return;
  const adminId = admin.id;

  const findContractId = (title: string): number | null => {
    const row = db.prepare('SELECT id FROM contracts WHERE title = ? LIMIT 1').get(title) as any;
    return row ? Number(row.id) : null;
  };

  const today = new Date();
  const fmtDate = (d: Date) => d.toISOString().split('T')[0];
  const fmtDateTime = (d: Date) => fmtDate(d) + ' 10:00:00';
  const addDays = (d: Date, days: number) => {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + days);
    return nd;
  };

  const insertNode = db.prepare(`
    INSERT INTO contract_nodes
      (contract_id, node_name, node_type, responsible_party, planned_date, amount, deliverable, status, completed_at, completed_by, attachment_url, remark, sort_order, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  type SeedNode = {
    contractTitle: string;
    node_name: string;
    node_type: string;
    responsible_party: string;
    planned: number;
    amount: number;
    deliverable: string;
    status: string;
    completedOffset?: number;
    attachment?: string;
    remark?: string;
  };

  const nodes: SeedNode[] = [
    {
      contractTitle: '服务器采购合同（已签署）',
      node_name: '预付款支付（30%）',
      node_type: 'payment',
      responsible_party: '北京科技有限公司（甲方）',
      planned: -55,
      amount: 60000,
      deliverable: '合同签订后5个工作日内支付预付款6万元',
      status: 'completed',
      completedOffset: -54,
      attachment: '/uploads/receipt/server-prepay.pdf',
      remark: '银行转账已完成',
    },
    {
      contractTitle: '服务器采购合同（已签署）',
      node_name: '设备交付',
      node_type: 'delivery',
      responsible_party: '李四的设备公司（乙方）',
      planned: -50,
      amount: 0,
      deliverable: '4台企业级服务器送达指定机房',
      status: 'completed',
      completedOffset: -48,
      attachment: '/uploads/delivery/server-delivery.pdf',
      remark: '验收无误',
    },
    {
      contractTitle: '服务器采购合同（已签署）',
      node_name: '到货验收',
      node_type: 'acceptance',
      responsible_party: '北京科技有限公司（甲方）',
      planned: -45,
      amount: 0,
      deliverable: '设备通电测试与配置验收报告',
      status: 'completed',
      completedOffset: -44,
      attachment: '/uploads/acceptance/server-acceptance.pdf',
      remark: '验收合格',
    },
    {
      contractTitle: '服务器采购合同（已签署）',
      node_name: '尾款支付（70%）',
      node_type: 'payment',
      responsible_party: '北京科技有限公司（甲方）',
      planned: 3,
      amount: 140000,
      deliverable: '验收合格后支付尾款14万元',
      status: 'not_started',
      remark: '请在验收合格后10个工作日内支付',
    },
    {
      contractTitle: '张三劳动合同2025（已签署）',
      node_name: '首月工资发放',
      node_type: 'payment',
      responsible_party: '北京科技有限公司（甲方）',
      planned: -335,
      amount: 13000,
      deliverable: '入职首月工资发放',
      status: 'completed',
      completedOffset: -334,
      remark: '已按时发放',
    },
    {
      contractTitle: '张三劳动合同2025（已签署）',
      node_name: '合同到期结算',
      node_type: 'payment',
      responsible_party: '北京科技有限公司（甲方）',
      planned: -2,
      amount: 13000,
      deliverable: '合同到期当月工资及结算',
      status: 'in_progress',
      remark: '尚未完成结算',
    },
    {
      contractTitle: '办公场地租赁保密协议（已签署）',
      node_name: '保密义务持续履行',
      node_type: 'other',
      responsible_party: '王五（乙方）',
      planned: 165,
      amount: 0,
      deliverable: '保密期限内持续履行保密义务',
      status: 'in_progress',
      remark: '保密期5年内持续有效',
    },
    {
      contractTitle: '办公场地租赁保密协议（已签署）',
      node_name: '年度保密审查',
      node_type: 'acceptance',
      responsible_party: '北京科技有限公司（甲方）',
      planned: 5,
      amount: 0,
      deliverable: '年度保密措施执行情况审查',
      status: 'not_started',
      remark: '到期前需完成审查',
    },
    {
      contractTitle: '2024年度员工劳动合同（已过期）',
      node_name: '合同到期处理',
      node_type: 'other',
      responsible_party: '北京科技有限公司（甲方）',
      planned: -30,
      amount: 0,
      deliverable: '到期合同续签或终止处理',
      status: 'overdue',
      remark: '已逾期未处理',
    },
    {
      contractTitle: '王五劳动合同2026（待签署）',
      node_name: '入职交付',
      node_type: 'delivery',
      responsible_party: '北京科技有限公司（甲方）',
      planned: 6,
      amount: 0,
      deliverable: '办理入职并交付办公设备',
      status: 'not_started',
      remark: '签署后安排入职',
    },
  ];

  let order = 0;
  nodes.forEach((n) => {
    const contractId = findContractId(n.contractTitle);
    if (!contractId) return;
    order += 1;
    insertNode.run(
      contractId,
      n.node_name,
      n.node_type,
      n.responsible_party,
      fmtDate(addDays(today, n.planned)),
      n.amount,
      n.deliverable,
      n.status,
      n.completedOffset !== undefined ? fmtDateTime(addDays(today, n.completedOffset)) : null,
      n.status === 'completed' ? adminId : null,
      n.attachment || null,
      n.remark || null,
      order,
      adminId,
    );
  });
}

initDatabase();
migrateDatabase();
seedData();
seedPerformanceNodes();

export default db;
