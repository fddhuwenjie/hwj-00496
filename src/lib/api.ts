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

export const api = {
  login: (username: string, password: string) =>
    request<User>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  getUsers: () => request<User[]>('/auth/users'),

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
  signContract: (id: number, signatureData: string) =>
    request<void>(`/contracts/${id}/sign`, { method: 'POST', body: JSON.stringify({ signatureData }) }),
  rejectContract: (id: number, reason: string) =>
    request<void>(`/contracts/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  voidContract: (id: number, reason: string) =>
    request<void>(`/contracts/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) }),
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
};
