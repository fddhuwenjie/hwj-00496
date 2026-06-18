import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, type Template, type TemplateVariable, type User } from '../lib/api';
import { ArrowLeft, Eye, Save, FileText } from 'lucide-react';

export default function ContractCreate() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const templateId = sp.get('templateId');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template & { variables?: TemplateVariable[] } | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<Record<string, any>>({
    title: '',
    party_a: '',
    party_b: '',
    amount: 0,
    effective_date: '',
    expiry_date: '',
    content: '',
    variables: {} as Record<string, string>,
    signerIds: [] as number[],
  });
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    api.getTemplates().then(setTemplates).catch(() => {});
    api.getUsers().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    if (templateId && templates.length > 0) {
      const t = templates.find((x) => x.id === Number(templateId));
      if (t) handleSelectTemplate(t.id);
    }
  }, [templates, templateId]);

  const handleSelectTemplate = async (id: number) => {
    const t = await api.getTemplate(id);
    setSelectedTemplate(t);
    const vars: Record<string, string> = {};
    (t.variables || []).forEach((v) => {
      vars[v.name] = v.type === 'date' ? new Date().toISOString().split('T')[0] : '';
    });
    setForm({
      ...form,
      title: t.name,
      templateId: t.id,
      content: t.content,
      variables: vars,
    });
  };

  const updateVar = (name: string, val: string) => {
    setForm({ ...form, variables: { ...form.variables, [name]: val } });
  };

  const toggleSigner = (uid: number) => {
    const ids = form.signerIds.includes(uid)
      ? form.signerIds.filter((x: number) => x !== uid)
      : [...form.signerIds, uid];
    setForm({ ...form, signerIds: ids });
  };

  const doPreview = async () => {
    const html = await api.previewTemplate(form.content, form.variables);
    setPreviewHtml(html);
    setShowPreview(true);
  };

  const handleSubmit = async () => {
    if (!form.title || !form.content) {
      alert('请填写合同标题和内容');
      return;
    }
    try {
      const result = await api.createContract({
        templateId: selectedTemplate?.id,
        title: form.title,
        content: form.content,
        party_a: form.party_a,
        party_b: form.party_b,
        amount: form.amount,
        effective_date: form.effective_date,
        expiry_date: form.expiry_date,
        variables: form.variables,
        signerIds: form.signerIds,
      });
      navigate(`/contract/${result.id}`);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-semibold">创建合同</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">选择合同模板</label>
              <select
                value={selectedTemplate?.id || ''}
                onChange={(e) => e.target.value && handleSelectTemplate(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">-- 请选择模板 --</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>[{t.category}] {t.name}</option>
                ))}
              </select>
            </div>

            {selectedTemplate && (selectedTemplate.variables || []).length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">填写变量</label>
                <div className="grid grid-cols-2 gap-3">
                  {(selectedTemplate.variables || []).map((v) => (
                    <div key={v.name}>
                      <label className="block text-xs text-gray-600 mb-1">{v.name} <span className="text-gray-400">({v.type})</span></label>
                      <input
                        type={v.type}
                        value={form.variables[v.name] || ''}
                        onChange={(e) => updateVar(v.name, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder={v.description}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">合同标题</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">合同金额 (元)</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">甲方</label>
                <input
                  type="text"
                  value={form.party_a}
                  onChange={(e) => setForm({ ...form, party_a: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">乙方</label>
                <input
                  type="text"
                  value={form.party_b}
                  onChange={(e) => setForm({ ...form, party_b: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">生效日期</label>
                <input
                  type="date"
                  value={form.effective_date}
                  onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">到期日期</label>
                <input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">合同正文HTML</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={doPreview}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                <Eye className="w-4 h-4" />
                预览合同
              </button>
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
              >
                <Save className="w-4 h-4" />
                保存为草稿
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              指定签署人（按顺序）
            </h3>
            <div className="space-y-2">
              {users.filter((u) => u.role !== 'admin' || true).map((u) => (
                <label
                  key={u.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition ${
                    form.signerIds.includes(u.id)
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.signerIds.includes(u.id)}
                    onChange={() => toggleSigner(u.id)}
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.username} · {u.role === 'admin' ? '管理员' : '签署人'}</p>
                  </div>
                  {form.signerIds.includes(u.id) && (
                    <span className="text-xs px-2 py-0.5 bg-indigo-600 text-white rounded-full">
                      {form.signerIds.indexOf(u.id) + 1}
                    </span>
                  )}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              勾选顺序即签署顺序，先勾选先签
            </p>
          </div>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold">合同预览</h3>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              <div
                className="bg-white shadow-lg mx-auto max-w-2xl p-10 min-h-full"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
