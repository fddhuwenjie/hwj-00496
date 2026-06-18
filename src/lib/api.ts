export interface User {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'signer';
  email?: string;
}

export interface Template {
  id: number;
  name: string;
  category: string;
  content: string;
  created_by: number;
  creator_name?: string;
  created_at: string;
  updated_at: string;
  variables?: TemplateVariable[];
}

export interface TemplateVariable {
  id: number;
  template_id: number;
  name: string;
  type: 'text' | 'number' | 'date';
  description: string;
  placeholder: string;
}

export interface ContractSigner {
  id: number;
  contract_id: number;
  user_id: number;
  user_name?: string;
  username?: string;
  email?: string;
  sign_order: number;
  status: 'pending' | 'signed' | 'rejected';
  signed_at?: string;
  signature_data?: string;
  sign_ip?: string;
  reject_reason?: string;
  position_x?: number | null;
  position_y?: number | null;
  sign_page?: number;
}

export interface Contract {
  id: number;
  contract_no: string;
  title: string;
  template_id?: number;
  template_name?: string;
  template_category?: string;
  content: string;
  party_a?: string;
  party_b?: string;
  amount: number;
  effective_date?: string;
  expiry_date?: string;
  status: 'draft' | 'pending' | 'signed' | 'expired' | 'voided';
  created_by: number;
  creator_name?: string;
  created_at: string;
  updated_at: string;
  version: number;
  is_voided: number;
  void_reason?: string;
  void_initiated_by?: number | null;
  void_initiated_at?: string | null;
  signers?: ContractSigner[];
  versions?: ContractVersion[];
}

export interface ContractVersion {
  id: number;
  contract_id: number;
  version: number;
  content: string;
  changed_by: number;
  changer_name?: string;
  change_reason?: string;
  created_at: string;
}

export interface Signature {
  id: number;
  user_id: number;
  signature_data: string;
  created_at: string;
}

export interface SignatureLog {
  id: number;
  user_id: number;
  user_name?: string;
  contract_id: number;
  contract_title?: string;
  action: string;
  sign_ip?: string;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  contract_id: number;
  contract_title?: string;
  message: string;
  is_read: number;
  created_at: string;
}

const BASE = '/api';

function getHeaders(): Record<string, string> {
  const user = localStorage.getItem('user');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (user) {
    const u: User = JSON.parse(user);
    headers['x-user-id'] = String(u.id);
    headers['x-user-role'] = u.role;
    headers['x-user-name'] = encodeURIComponent(u.name);
  }
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }
  return data.data as T;
}

export interface ReviewRule {
  id: number;
  name: string;
  contract_type: string;
  risk_level: 'high' | 'medium' | 'low';
  pattern: string;
  is_regex: number;
  description: string;
  suggestion: string;
  is_enabled: number;
  created_by: number;
  creator_name?: string;
  created_at: string;
  updated_at: string;
}

export interface RiskRecord {
  id: number;
  review_history_id: number;
  contract_id: number;
  rule_id: number;
  rule_name: string;
  risk_level: 'high' | 'medium' | 'low';
  matched_content: string;
  paragraph: string;
  description: string;
  suggestion: string;
  status: 'pending' | 'modified' | 'exempt';
  exempt_reason?: string;
  handled_by?: number;
  handler_name?: string;
  handled_at?: string;
  created_at: string;
  contract_title?: string;
  contract_no?: string;
  reviewed_at?: string;
}

export interface ReviewHistory {
  id: number;
  contract_id: number;
  version: number;
  reviewed_by: number;
  reviewer_name?: string;
  reviewed_at: string;
  total_risks: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  risks?: RiskRecord[];
  can_sign?: boolean;
}

export interface RiskComparison {
  added: RiskRecord[];
  removed: RiskRecord[];
  remaining: RiskRecord[];
  prev_version: number;
  curr_version: number;
}

export interface ReviewResult {
  review_id: number;
  risks: RiskRecord[];
  counts: { total: number; high: number; medium: number; low: number };
  can_sign: boolean;
  comparison: RiskComparison | null;
}

export interface RiskDashboard {
  month_high_risk: number;
  type_distribution: {
    contract_type: string;
    high_count: number;
    medium_count: number;
    low_count: number;
    total: number;
  }[];
  top_risks: {
    rule_name: string;
    high_count: number;
    medium_count: number;
    low_count: number;
    total: number;
  }[];
  pending_list: RiskRecord[];
}

export interface RiskAuditLog {
  id: number;
  risk_record_id: number;
  contract_id: number;
  action: string;
  old_status: string;
  new_status: string;
  reason: string;
  operator_id: number;
  operator_name: string;
  created_at: string;
}

export type NodeType = 'payment' | 'delivery' | 'acceptance' | 'other';
export type NodeStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';

export interface PerformanceNode {
  id: number;
  contract_id: number;
  node_name: string;
  node_type: NodeType;
  responsible_party: string | null;
  planned_date: string;
  amount: number;
  deliverable: string | null;
  status: NodeStatus;
  effective_status: NodeStatus;
  completed_at: string | null;
  completed_by: number | null;
  completer_name?: string | null;
  attachment_url: string | null;
  remark: string | null;
  sort_order: number;
  created_by: number;
  creator_name?: string | null;
  created_at: string;
  updated_at: string;
  contract_title?: string;
  contract_no?: string;
  party_a?: string;
  party_b?: string;
  contract_amount?: number;
  expiry_date?: string;
}

export interface NodeSuggestion {
  node_name: string;
  node_type: NodeType;
  responsible_party: string;
  planned_date: string;
  amount: number;
  deliverable: string;
  remark: string;
  _source?: string;
}

export interface NodeReminders {
  today: string;
  within7Date: string;
  dueIn7Days: PerformanceNode[];
  overdue: PerformanceNode[];
  expiringContracts: (Contract & { template_name?: string; template_category?: string })[];
}

export interface ResponsiblePartyStat {
  responsible_party: string;
  total: number;
  completed: number;
  overdue: number;
}

export interface PendingAmountByContract {
  id: number;
  title: string;
  contract_no: string;
  contract_amount: number;
  party_a: string;
  party_b: string;
  contract_status: string;
  pending_amount: number;
  completed_amount: number;
  node_total: number;
  node_completed: number;
}

export interface NodeDashboard {
  month: { year: number; month: number };
  monthDueNodes: PerformanceNode[];
  monthDueCount: number;
  monthPlannedCount: number;
  monthCompletedCount: number;
  overdueCount: number;
  overdueList: PerformanceNode[];
  byResponsibleParty: ResponsiblePartyStat[];
  pendingAmountByContract: PendingAmountByContract[];
  totalPendingAmount: number;
  filters: { node_type: string | null; responsible_party: string | null; startDate: string | null; endDate: string | null };
}

export const api = {
  login: (username: string, password: string) =>
    request<User>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  getUsers: () => request<User[]>('/auth/users'),

  getReviewRules: (contract_type?: string, is_enabled?: boolean) => {
    const params: Record<string, string> = {};
    if (contract_type) params.contract_type = contract_type;
    if (is_enabled !== undefined) params.is_enabled = is_enabled ? '1' : '0';
    const qs = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
    return request<ReviewRule[]>(`/review/rules${qs}`);
  },
  getReviewRule: (id: number) => request<ReviewRule>(`/review/rules/${id}`),
  createReviewRule: (data: Partial<ReviewRule>) =>
    request<{ id: number }>('/review/rules', { method: 'POST', body: JSON.stringify(data) }),
  updateReviewRule: (id: number, data: Partial<ReviewRule>) =>
    request<void>(`/review/rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteReviewRule: (id: number) => request<void>(`/review/rules/${id}`, { method: 'DELETE' }),

  reviewContract: (id: number) =>
    request<ReviewResult>(`/review/contract/${id}`, { method: 'POST' }),
  getLatestReview: (id: number) =>
    request<ReviewHistory | null>(`/review/contract/${id}/latest`),
  getReviewHistory: (id: number) =>
    request<ReviewHistory[]>(`/review/contract/${id}/history`),
  updateRiskStatus: (id: number, status: 'pending' | 'modified' | 'exempt', exempt_reason?: string) =>
    request<void>(`/review/risk/${id}/status`, { method: 'POST', body: JSON.stringify({ status, exempt_reason }) }),
  getRiskAuditLogs: (id: number) =>
    request<RiskAuditLog[]>(`/review/risk/${id}/audit`),
  getRiskDashboard: (params?: { contract_type?: string; risk_level?: string; startDate?: string; endDate?: string }) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request<RiskDashboard>(`/review/dashboard${qs}`);
  },

  getTemplates: (category?: string) =>
    request<Template[]>(category ? `/templates?category=${category}` : '/templates'),
  getTemplateCategories: () => request<string[]>('/templates/categories'),
  getTemplate: (id: number) => request<Template>(`/templates/${id}`),
  createTemplate: (data: Partial<Template> & { variables?: { name: string; type: string; description: string }[] }) =>
    request<{ id: number }>('/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id: number, data: Partial<Template> & { variables?: { name: string; type: string; description: string }[] }) =>
    request<void>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTemplate: (id: number) => request<void>(`/templates/${id}`, { method: 'DELETE' }),
  previewTemplate: (content: string, variables: Record<string, string>) =>
    request<string>('/templates/preview', { method: 'POST', body: JSON.stringify({ content, variables }) }),

  getContracts: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request<Contract[]>(`/contracts${qs}`);
  },
  getPendingSign: () => request<Contract[]>('/contracts/pending-sign'),
  getExpiring: () => request<Contract[]>('/contracts/expiring'),
  getContract: (id: number) => request<Contract & { versions: ContractVersion[] }>(`/contracts/${id}`),
  createContract: (data: any) =>
    request<{ id: number; contract_no: string }>('/contracts', { method: 'POST', body: JSON.stringify(data) }),
  updateContract: (id: number, data: any) =>
    request<void>(`/contracts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  startSign: (id: number) => request<void>(`/contracts/${id}/start-sign`, { method: 'POST' }),
  signContract: (id: number, signatureData: string, position?: { x: number; y: number; page: number }) =>
    request<void>(`/contracts/${id}/sign`, { method: 'POST', body: JSON.stringify({ signatureData, positionX: position?.x, positionY: position?.y, page: position?.page }) }),
  rejectContract: (id: number, reason: string) =>
    request<void>(`/contracts/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  voidContract: (id: number, reason: string) =>
    request<{ voided: boolean; message: string }>(`/contracts/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getVoidConfirmations: (id: number) =>
    request<any>(`/contracts/${id}/void-confirmations`),
  confirmVoid: (id: number, confirmed: boolean) =>
    request<{ voided: boolean; message: string }>(`/contracts/${id}/void-confirm`, { method: 'POST', body: JSON.stringify({ confirmed }) }),
  setSigners: (contractId: number, signerIds: number[]) =>
    request<void>('/contracts/signers', { method: 'POST', body: JSON.stringify({ contractId, signerIds }) }),
  getContractVersions: (id: number) => request<ContractVersion[]>(`/contracts/${id}/versions`),

  getMySignatures: () => request<Signature[]>('/signatures/my'),
  saveSignature: (signatureData: string) =>
    request<{ id: number }>('/signatures', { method: 'POST', body: JSON.stringify({ signatureData }) }),
  deleteSignature: (id: number) => request<void>(`/signatures/${id}`, { method: 'DELETE' }),
  getSignatureLogs: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request<{ list: SignatureLog[]; total: number; page: number; pageSize: number }>(`/signatures/logs${qs}`);
  },
  getNotifications: () => request<Notification[]>('/signatures/notifications'),
  readNotification: (id: number) => request<void>(`/signatures/notifications/${id}/read`, { method: 'POST' }),
  readAllNotifications: () => request<void>('/signatures/notifications/read-all', { method: 'POST' }),

  getStatsOverview: () => request<any>('/stats/overview'),
  getCalendarEvents: (year?: number, month?: number) => {
    const qs = year && month ? `?year=${year}&month=${month}` : '';
    return request<any[]>(`/stats/calendar${qs}`);
  },
  getPendingOvertime: () => request<any[]>('/stats/pending-overtime'),
  getCategoryDistribution: () => request<any[]>('/stats/category-distribution'),

  getNodes: (contractId: number) => request<PerformanceNode[]>(`/nodes/contract/${contractId}`),
  createNode: (contractId: number, data: Partial<PerformanceNode>) =>
    request<{ id: number }>(`/nodes/contract/${contractId}`, { method: 'POST', body: JSON.stringify(data) }),
  bulkCreateNodes: (contractId: number, nodes: Partial<NodeSuggestion>[]) =>
    request<{ ids: number[]; count: number }>(`/nodes/contract/${contractId}/bulk`, { method: 'POST', body: JSON.stringify({ nodes }) }),
  updateNode: (id: number, data: Partial<PerformanceNode>) =>
    request<void>(`/nodes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNode: (id: number) => request<void>(`/nodes/${id}`, { method: 'DELETE' }),
  updateNodeStatus: (id: number, status: NodeStatus, attachment_url?: string) =>
    request<void>(`/nodes/${id}/status`, { method: 'POST', body: JSON.stringify({ status, attachment_url }) }),
  extractNodes: (contractId: number, content?: string) =>
    request<{ suggestions: NodeSuggestion[]; content_length: number }>(`/nodes/contract/${contractId}/extract`, {
      method: 'POST',
      body: JSON.stringify(content ? { content } : {}),
    }),
  syncOverdueNodes: () => request<{ updated: number }>(`/nodes/sync-overdue`, { method: 'POST' }),
  getNodeReminders: () => request<NodeReminders>('/nodes/reminders'),
  getNodeDashboard: (params?: { node_type?: string; responsible_party?: string; startDate?: string; endDate?: string }) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request<NodeDashboard>(`/nodes/dashboard${qs}`);
  },
};
