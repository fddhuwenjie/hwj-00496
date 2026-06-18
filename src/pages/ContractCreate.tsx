import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, type Template, type TemplateVariable, type User, type ReviewResult, type RiskRecord } from '../lib/api';
import { ArrowLeft, Eye, Save, FileText, Upload, X, Shield, RefreshCw, AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';

const RISK_LEVEL_BG: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

const RISK_LEVEL_ICON: Record<string, any> = {
  high: AlertTriangle,
  medium: AlertCircle,
  low: Info,
};

export default function ContractCreate() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [sp] = useSearchParams();
  const templateId = sp.get('templateId');
  const isEdit = !!id;

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
  const [uploadedFileName, setUploadedFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [showRiskPanel, setShowRiskPanel] = useState(false);

  useEffect(() => {
    api.getTemplates().then(setTemplates).catch(() => {});
    api.getUsers().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    if (isEdit) {
      loadContract();
    } else if (templateId && templates.length > 0) {
      const t = templates.find((x) => x.id === Number(templateId));
      if (t) handleSelectTemplate(t.id);
    }
  }, [templates, templateId, isEdit]);

  const loadContract = async () => {
    try {
      const c = await api.getContract(Number(id));
      setForm({
        title: c.title,
        party_a: c.party_a || '',
        party_b: c.party_b || '',
        amount: c.amount,
        effective_date: c.effective_date || '',
        expiry_date: c.expiry_date || '',
        content: c.content,
        templateId: c.template_id,
        variables: {},
        signerIds: (c.signers || []).map((s: any) => s.user_id),
      });
      if (c.template_id) {
        const t = templates.find((x) => x.id === c.template_id);
        if (t) setSelectedTemplate(t as any);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'html' && ext !== 'htm') {
      alert('请上传HTML格式的合同文件（PDF请先转换为HTML）');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setForm({ ...form, content, title: form.title || file.name.replace(/\.[^/.]+$/, '') });
      setUploadedFileName(file.name);
      setSelectedTemplate(null);
    };
    reader.readAsText(file);
  };

  const clearUploadedFile = () => {
    setUploadedFileName('');
    setForm({ ...form, content: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const doPreview = async () => {
    const html = await api.previewTemplate(form.content, form.variables);
    setPreviewHtml(html);
    setShowPreview(true);
  };

  const handleReview = async () => {
    if (!isEdit) {
      if (!confirm('智能审查需要先保存合同。是否先保存为草稿，然后执行审查？')) return;
      await handleSubmit(true);
      return;
    }
    if (!confirm('确认执行智能审查？系统将扫描合同内容并检测风险条款。')) return;
    setReviewing(true);
    try {
      const result = await api.reviewContract(Number(id));
      setReviewResult(result);
      setShowRiskPanel(true);
      alert(`审查完成！共发现 ${result.counts.total} 项风险，其中高风险 ${result.counts.high} 项。`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setReviewing(false);
    }
  };

  const handleSubmit = async (stayOnPage = false) => {
    if (!form.title || !form.content) {
      alert('请填写合同标题和内容');
      return;
    }
    try {
      if (isEdit) {
        await api.updateContract(Number(id), {
          title: form.title,
          content: form.content,
          party_a: form.party_a,
          party_b: form.party_b,
          amount: form.amount,
          effective_date: form.effective_date,
          expiry_date: form.expiry_date,
          change_reason: '编辑合同内容',
        });
        if (!stayOnPage) {
          navigate(`/contract/${id}`);
        } else {
          alert('保存成功！');
        }
      } else {
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
        if (!stayOnPage) {
          navigate(`/contract/${result.id}`);
        } else {
          navigate(`/contract/${result.id}/edit`);
        }
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const renderRiskCard = (risk: RiskRecord) => {
    const LevelIcon = RISK_LEVEL_ICON[risk.risk_level];
    return (
      <div key={risk.id} className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${RISK_LEVEL_BG[risk.risk_level]}`}>
                <LevelIcon className="w-3 h-3" />
                {risk.risk_level === 'high' ? '高风险' : risk.risk_level === 'medium' ? '中风险' : '低风险'}
              </span>
              <span className="text-sm font-medium text-gray-900">{risk.rule_name}</span>
            </div>
            {risk.matched_content && (
              <div className="mb-2">
                <span className="text-xs text-gray-500">命中内容：</span>
                <span className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-mono ml-1">{risk.matched_content}</span>
              </div>
            )}
            {risk.paragraph && (
              <p className="text-xs text-gray-600 mb-2 bg-gray-50 p-2 rounded">
                <span className="text-gray-400">所在段落：</span>{risk.paragraph}
              </p>
            )}
            <p className="text-sm text-gray-700 mb-1"><span className="text-gray-500">风险说明：</span>{risk.description}</p>
            <p className="text-sm text-indigo-600"><span className="text-gray-500">修改建议：</span>{risk.suggestion}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-semibold">{isEdit ? '编辑合同' : '创建合同'}</h2>
          {isEdit && id && (
            <p className="text-sm text-gray-500">合同ID: {id}</p>
          )}
        </div>
        {reviewResult && (
          <div className="ml-auto flex items-center gap-2">
            <span className={`text-xs px-3 py-1 rounded-full flex items-center gap-1 ${
              reviewResult.can_sign ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              <Shield className="w-3 h-3" />
              风险：高{reviewResult.counts.high} 中{reviewResult.counts.medium} 低{reviewResult.counts.low}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {reviewResult && showRiskPanel && (
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-500" />
                智能审查结果
              </h3>
              <button
                onClick={() => setShowRiskPanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {reviewResult.counts.total === 0 ? (
              <div className="text-center py-10">
                <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
                <p className="text-gray-800 font-medium">太棒了！</p>
                <p className="text-gray-500 text-sm">未检测到任何风险条款</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviewResult.risks.map((risk) => renderRiskCard(risk))}
              </div>
            )}
          </div>
        )}

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

            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-gray-200"></div>
                <span className="text-xs text-gray-400 px-2">或直接上传合同文件</span>
                <div className="h-px flex-1 bg-gray-200"></div>
              </div>

              {!uploadedFileName ? (
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition">
                    <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm font-medium text-gray-700">点击上传合同文件</p>
                    <p className="text-xs text-gray-400 mt-1">支持 .html / .htm 格式（PDF请先转换为HTML）</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,.htm"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{uploadedFileName}</p>
                      <p className="text-xs text-gray-500">文件内容已加载到合同正文</p>
                    </div>
                  </div>
                  <button
                    onClick={clearUploadedFile}
                    className="p-1.5 hover:bg-white rounded-lg text-gray-400 hover:text-red-500 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
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

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={doPreview}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                <Eye className="w-4 h-4" />
                预览合同
              </button>
              <button
                onClick={handleReview}
                disabled={reviewing}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${reviewing ? 'animate-spin' : ''}`} />
                智能审查
              </button>
              {reviewResult && (
                <button
                  onClick={() => setShowRiskPanel(!showRiskPanel)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm"
                >
                  <Shield className="w-4 h-4" />
                  {showRiskPanel ? '隐藏审查结果' : '显示审查结果'}
                </button>
              )}
              <button
                onClick={() => handleSubmit(false)}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Save className="w-4 h-4" />
                {isEdit ? '保存并返回' : '保存为草稿'}
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
