import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, type Contract, type User, type ReviewHistory, type RiskRecord, type RiskComparison, type RiskAuditLog } from '../lib/api';
import { STATUS_LABEL, STATUS_COLOR, useStore } from '../store';
import { ArrowLeft, Send, Edit2, FileX, History, Users, FileText, CheckCircle, XCircle, Clock, Shield, AlertTriangle, AlertCircle, Info, RefreshCw, Plus, Minus, X } from 'lucide-react';

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

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  modified: '已修改',
  exempt: '已豁免',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  modified: 'bg-blue-100 text-blue-700',
  exempt: 'bg-purple-100 text-purple-700',
};

type TabType = 'content' | 'risk' | 'review-history';

export default function ContractDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const [contract, setContract] = useState<Contract | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('content');
  const [showHistory, setShowHistory] = useState(false);
  const [showSigners, setShowSigners] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [selectedSigners, setSelectedSigners] = useState<number[]>([]);
  const [voidConfirmations, setVoidConfirmations] = useState<any[]>([]);
  const [voidInfo, setVoidInfo] = useState<any>(null);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [latestReview, setLatestReview] = useState<ReviewHistory | null>(null);
  const [reviewHistory, setReviewHistory] = useState<ReviewHistory[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [comparison, setComparison] = useState<RiskComparison | null>(null);
  const [exemptModal, setExemptModal] = useState<{ risk: RiskRecord; reason: string } | null>(null);
  const [auditLogModal, setAuditLogModal] = useState<{ riskId: number; logs: RiskAuditLog[] } | null>(null);

  const load = async () => {
    const c = await api.getContract(Number(id));
    setContract(c);
    setSelectedSigners((c.signers || []).map((s) => s.user_id));
    if (c.void_initiated_by) {
      try {
        const v = await api.getVoidConfirmations(Number(id));
        setVoidConfirmations(v.confirmations || []);
        setVoidInfo({ void_initiated_by: v.void_initiated_by, void_reason: v.void_reason, void_initiated_at: v.void_initiated_at });
      } catch {}
    } else {
      setVoidConfirmations([]);
      setVoidInfo(null);
    }
  };

  const loadReviewData = async () => {
    try {
      const [latest, history] = await Promise.all([
        api.getLatestReview(Number(id)),
        api.getReviewHistory(Number(id)),
      ]);
      setLatestReview(latest);
      setReviewHistory(history);
    } catch {}
  };

  useEffect(() => {
    load();
    api.getUsers().then(setUsers).catch(() => {});
    loadReviewData();
  }, [id]);

  if (!contract) {
    return <div className="p-10 text-center text-gray-400">加载中...</div>;
  }

  const canEdit = contract.status === 'draft' && !contract.is_voided && !contract.void_initiated_by;
  const canStartSign = contract.status === 'draft' && !contract.is_voided && !contract.void_initiated_by && (contract.signers || []).length > 0;
  const canVoid = !contract.is_voided && !contract.void_initiated_by && (user?.role === 'admin' || contract.created_by === user?.id);
  const myVoidConf = voidConfirmations.find((v) => v.user_id === user?.id);
  const needConfirmVoid = contract.void_initiated_by && !contract.is_voided && myVoidConf && !myVoidConf.confirmed;
  const isSigned = contract.status === 'signed';
  const isReadOnly = isSigned || contract.is_voided || !!contract.void_initiated_by;

  const handleReview = async () => {
    if (!confirm('确认执行智能审查？系统将扫描合同内容并检测风险条款。')) return;
    setReviewing(true);
    try {
      const result = await api.reviewContract(contract.id);
      setComparison(result.comparison);
      await loadReviewData();
      alert(`审查完成！共发现 ${result.counts.total} 项风险，其中高风险 ${result.counts.high} 项。`);
      if (!result.can_sign) {
        alert('存在未处理的高风险，请先处理后再发起签署。');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setReviewing(false);
    }
  };

  const handleStartSign = async () => {
    if (latestReview && latestReview.can_sign === false) {
      alert('存在未处理的高风险，请先处理或豁免后再发起签署。');
      return;
    }
    if (!confirm('确认发起签署流程？发起后将通知所有签署人。')) return;
    try {
      await api.startSign(contract.id);
      alert('已发起签署流程');
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSaveSigners = async () => {
    try {
      await api.setSigners(contract.id, selectedSigners);
      setShowSigners(false);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleVoid = async () => {
    if (!voidReason) {
      alert('请填写作废原因');
      return;
    }
    const signedCount = (contract.signers || []).filter((s) => s.status === 'signed').length;
    let msg = '确认作废此合同？';
    if (signedCount > 0) {
      msg = `此合同已有 ${signedCount} 人签署，发起作废后需要所有已签署方和创建人确认方可生效。确认发起？`;
    } else {
      msg += '此操作不可撤销。';
    }
    if (!confirm(msg)) return;
    try {
      const r = await api.voidContract(contract.id, voidReason);
      setShowVoid(false);
      setVoidReason('');
      alert(r.message);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleConfirmVoid = async (confirmed: boolean) => {
    const msg = confirmed ? '确认同意作废此合同？' : '确认反对此作废申请？';
    if (!confirm(msg)) return;
    try {
      const r = await api.confirmVoid(contract.id, confirmed);
      setShowVoidConfirm(false);
      alert(r.message);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const toggleSigner = (uid: number) => {
    setSelectedSigners(
      selectedSigners.includes(uid)
        ? selectedSigners.filter((x) => x !== uid)
        : [...selectedSigners, uid]
    );
  };

  const handleRiskStatus = async (risk: RiskRecord, status: 'modified' | 'exempt' | 'pending') => {
    if (status === 'exempt') {
      setExemptModal({ risk, reason: '' });
      return;
    }
    try {
      await api.updateRiskStatus(risk.id, status);
      await loadReviewData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleExemptSubmit = async () => {
    if (!exemptModal) return;
    if (!exemptModal.reason.trim()) {
      alert('请填写豁免原因');
      return;
    }
    try {
      await api.updateRiskStatus(exemptModal.risk.id, 'exempt', exemptModal.reason);
      setExemptModal(null);
      await loadReviewData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const showAuditLog = async (riskId: number) => {
    try {
      const logs = await api.getRiskAuditLogs(riskId);
      setAuditLogModal({ riskId, logs });
    } catch (e: any) {
      alert(e.message);
    }
  };

  const renderContentWithSignatures = () => {
    let html = contract.content;
    const positionedSignatures: string[] = [];
    const appendSignatures: string[] = [];

    (contract.signers || []).forEach((s) => {
      if (s.status === 'signed' && s.signature_data) {
        const signBlock = `<img src="${s.signature_data}" style="max-width:120px;max-height:50px;display:block;" /><div style="font-size:10px;color:#666;text-align:center;white-space:nowrap;">${s.user_name}<br/>${s.signed_at?.split(' ')[0] || ''}</div>`;

        if (s.position_x !== null && s.position_x !== undefined && s.position_y !== null && s.position_y !== undefined) {
          positionedSignatures.push(
            `<div style="position:absolute;left:${s.position_x - 60}px;top:${s.position_y - 30}px;pointer-events:none;text-align:center;padding:4px;background:rgba(255,255,255,0.9);border:1px solid #e5e7eb;border-radius:4px;z-index:10;">${signBlock}</div>`
          );
        } else {
          appendSignatures.push(
            `<div style="display:inline-block;margin:10px;padding:8px;border:1px dashed #ccc;border-radius:4px;">${signBlock}</div>`
          );
        }
      }
    });

    if (positionedSignatures.length > 0 || appendSignatures.length > 0) {
      html = `<div style="position:relative;">${html}${positionedSignatures.join('')}${appendSignatures.length > 0 ? `<div style="margin-top:20px;padding-top:20px;border-top:1px dashed #ccc;">${appendSignatures.join('')}</div>` : ''}</div>`;
    }
    return html;
  };

  const renderRiskCard = (risk: RiskRecord, showActions = true) => {
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
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[risk.status]}`}>
                {STATUS_LABELS[risk.status]}
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
            {risk.status === 'exempt' && risk.exempt_reason && (
              <p className="text-sm text-purple-600 mt-2 bg-purple-50 p-2 rounded">
                <span className="font-medium">豁免原因：</span>{risk.exempt_reason}
                {risk.handler_name && <span className="text-purple-400 ml-2">（{risk.handler_name} {risk.handled_at}）</span>}
              </p>
            )}
            {risk.status === 'modified' && risk.handler_name && (
              <p className="text-xs text-blue-500 mt-2">
                处理人：{risk.handler_name} · {risk.handled_at}
              </p>
            )}
          </div>
          {showActions && risk.status === 'pending' && (
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <button
                onClick={() => handleRiskStatus(risk, 'modified')}
                className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition whitespace-nowrap"
              >
                标记已修改
              </button>
              <button
                onClick={() => handleRiskStatus(risk, 'exempt')}
                className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition whitespace-nowrap"
              >
                申请豁免
              </button>
              <button
                onClick={() => showAuditLog(risk.id)}
                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition whitespace-nowrap"
              >
                处理日志
              </button>
            </div>
          )}
          {showActions && risk.status !== 'pending' && (
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <button
                onClick={() => handleRiskStatus(risk, 'pending')}
                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition whitespace-nowrap"
              >
                重置状态
              </button>
              <button
                onClick={() => showAuditLog(risk.id)}
                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition whitespace-nowrap"
              >
                处理日志
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-semibold">{contract.title}</h2>
            <p className="text-sm text-gray-500">编号：{contract.contract_no}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-3 py-1 rounded-full ${STATUS_COLOR[contract.status]}`}>
            {contract.is_voided ? '已作废' : STATUS_LABEL[contract.status]}
          </span>
          {latestReview && (
            <span className={`text-xs px-3 py-1 rounded-full flex items-center gap-1 ${
              latestReview.can_sign ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              <Shield className="w-3 h-3" />
              风险：高{latestReview.high_count} 中{latestReview.medium_count} 低{latestReview.low_count}
              {!latestReview.can_sign && latestReview.high_count > 0 && ' (禁止签署)'}
            </span>
          )}
          {contract.void_initiated_by && !contract.is_voided && (
            <span className="text-xs px-3 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              作废确认中 ({voidConfirmations.filter((v) => v.confirmed).length}/{voidConfirmations.length})
            </span>
          )}
          {contract.version > 1 && (
            <button
              onClick={() => setShowHistory(true)}
              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 flex items-center gap-1"
            >
              <History className="w-3.5 h-3.5" />
              v{contract.version}
            </button>
          )}
          {!isReadOnly && (
            <>
              <button
                onClick={handleReview}
                disabled={reviewing}
                className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reviewing ? 'animate-spin' : ''}`} />
                智能审查
              </button>
              {canEdit && (
                <Link
                  to={`/contract/${contract.id}/edit`}
                  className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 flex items-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  编辑
                </Link>
              )}
              {canStartSign && (
                <button
                  onClick={handleStartSign}
                  className={`text-xs px-3 py-1.5 rounded flex items-center gap-1 ${
                    latestReview && !latestReview.can_sign
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  发起签署
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => setShowSigners(true)}
                  className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1"
                >
                  <Users className="w-3.5 h-3.5" />
                  设置签署人
                </button>
              )}
            </>
          )}
          {needConfirmVoid && (
            <>
              <button
                onClick={() => handleConfirmVoid(true)}
                className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                确认作废
              </button>
              <button
                onClick={() => handleConfirmVoid(false)}
                className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 flex items-center gap-1"
              >
                <XCircle className="w-3.5 h-3.5" />
                反对作废
              </button>
            </>
          )}
          {canVoid && (
            <button
              onClick={() => setShowVoid(true)}
              className="text-xs px-3 py-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200 flex items-center gap-1"
            >
              <FileX className="w-3.5 h-3.5" />
              作废
            </button>
          )}
          {contract.status === 'pending' && (contract.signers || []).some((s) => s.user_id === user?.id && s.status === 'pending') && (
            <Link
              to={`/contract/${contract.id}/sign`}
              className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
            >
              去签署
            </Link>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-white rounded-xl border border-gray-200 shadow-sm p-1">
        <button
          onClick={() => setActiveTab('content')}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
            activeTab === 'content'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <FileText className="w-4 h-4" />
            合同正文
          </div>
        </button>
        <button
          onClick={() => setActiveTab('risk')}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
            activeTab === 'risk'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Shield className="w-4 h-4" />
            风险审查
            {latestReview && latestReview.total_risks > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === 'risk' ? 'bg-white/20' : 'bg-red-100 text-red-600'
              }`}>
                {latestReview.total_risks}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('review-history')}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
            activeTab === 'review-history'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <History className="w-4 h-4" />
            审查历史
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          {activeTab === 'content' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  合同正文
                  {isReadOnly && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">只读归档</span>}
                </h3>
              </div>
              <div className="p-6 bg-gray-50">
                <div
                  className="bg-white shadow p-10 mx-auto max-w-3xl min-h-[600px]"
                  dangerouslySetInnerHTML={{ __html: renderContentWithSignatures() }}
                />
              </div>
            </div>
          )}

          {activeTab === 'risk' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-500" />
                  风险审查结果
                </h3>
                {latestReview && (
                  <div className="text-sm text-gray-500">
                    审查时间：{latestReview.reviewed_at} · 审查人：{latestReview.reviewer_name}
                  </div>
                )}
              </div>
              <div className="p-4">
                {comparison && (
                  <div className="mb-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <h4 className="font-medium text-indigo-800 mb-3 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" />
                      版本风险变化对比（v{comparison.prev_version} → v{comparison.curr_version}）
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-white rounded-lg border border-green-200">
                        <div className="flex items-center gap-1 text-green-700 text-sm font-medium mb-1">
                          <Plus className="w-3.5 h-3.5" />
                          新增风险
                        </div>
                        <div className="text-2xl font-bold text-green-600">{comparison.added.length}</div>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-red-200">
                        <div className="flex items-center gap-1 text-red-700 text-sm font-medium mb-1">
                          <Minus className="w-3.5 h-3.5" />
                          已消除风险
                        </div>
                        <div className="text-2xl font-bold text-red-600">{comparison.removed.length}</div>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-yellow-200">
                        <div className="flex items-center gap-1 text-yellow-700 text-sm font-medium mb-1">
                          <Clock className="w-3.5 h-3.5" />
                          仍存在风险
                        </div>
                        <div className="text-2xl font-bold text-yellow-600">{comparison.remaining.length}</div>
                      </div>
                    </div>
                    {comparison.added.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-green-700 font-medium mb-1">新增风险：</p>
                        <div className="flex flex-wrap gap-1">
                          {comparison.added.map((r, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                              {r.rule_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {comparison.removed.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-red-700 font-medium mb-1">已消除风险：</p>
                        <div className="flex flex-wrap gap-1">
                          {comparison.removed.map((r, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded line-through">
                              {r.rule_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!latestReview ? (
                  <div className="text-center py-16">
                    <Shield className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 mb-4">尚未执行智能审查</p>
                    {!isReadOnly && (
                      <button
                        onClick={handleReview}
                        disabled={reviewing}
                        className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 inline mr-2 ${reviewing ? 'animate-spin' : ''}`} />
                        开始智能审查
                      </button>
                    )}
                  </div>
                ) : latestReview.risks?.length === 0 ? (
                  <div className="text-center py-16">
                    <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                    <p className="text-lg font-medium text-gray-800">太棒了！</p>
                    <p className="text-gray-500">未检测到任何风险条款</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {latestReview.risks?.map((risk) => renderRiskCard(risk))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'review-history' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-500" />
                  审查历史记录
                </h3>
              </div>
              <div className="p-4">
                {reviewHistory.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    暂无审查历史记录
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviewHistory.map((review) => (
                      <div key={review.id} className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                              v{review.version}
                            </span>
                            <span className="text-sm font-medium text-gray-800">
                              审查人：{review.reviewer_name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {review.reviewed_at}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-red-600 font-medium">高 {review.high_count}</span>
                            <span className="text-yellow-600 font-medium">中 {review.medium_count}</span>
                            <span className="text-green-600 font-medium">低 {review.low_count}</span>
                            <span className="text-gray-600 font-medium ml-1">共 {review.total_risks}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm space-y-3">
            <h3 className="font-semibold text-sm">合同信息</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">模板分类</span>
                <span className="text-gray-800">{contract.template_category || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">甲方</span>
                <span className="text-gray-800">{contract.party_a || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">乙方</span>
                <span className="text-gray-800">{contract.party_b || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">金额</span>
                <span className="text-gray-800 font-medium">¥ {Number(contract.amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">生效日期</span>
                <span className="text-gray-800">{contract.effective_date || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">到期日期</span>
                <span className="text-gray-800">{contract.expiry_date || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">创建人</span>
                <span className="text-gray-800">{contract.creator_name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">创建时间</span>
                <span className="text-gray-800">{contract.created_at?.split(' ')[0]}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <h3 className="font-semibold text-sm mb-3">签署流程</h3>
            <div className="space-y-3">
              {(contract.signers || []).map((s, idx) => (
                <div key={s.id} className="relative pl-7">
                  {idx < (contract.signers || []).length - 1 && (
                    <div className="absolute left-2.5 top-5 w-0.5 h-8 bg-gray-200" />
                  )}
                  <div className={`absolute left-0 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    s.status === 'signed' ? 'bg-green-500 text-white' :
                    s.status === 'rejected' ? 'bg-red-500 text-white' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {s.status === 'signed' ? '✓' : s.status === 'rejected' ? '×' : idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.user_name}</p>
                    <p className="text-xs text-gray-500">
                      {s.status === 'signed' ? `已签署 · ${s.signed_at?.split(' ')[0]}` :
                       s.status === 'rejected' ? `已拒签 · ${s.reject_reason}` :
                       '待签署'}
                    </p>
                    {s.status === 'signed' && s.signature_data && (
                      <img src={s.signature_data} className="mt-1 max-w-[100px] max-h-[40px]" />
                    )}
                  </div>
                </div>
              ))}
              {(contract.signers || []).length === 0 && (
                <p className="text-xs text-gray-400">暂未设置签署人</p>
              )}
            </div>
          </div>

          {latestReview && latestReview.risks && latestReview.risks.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-indigo-500" />
                风险概览
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> 高风险
                  </span>
                  <span className="font-medium">{latestReview.high_count} 项</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-yellow-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> 中风险
                  </span>
                  <span className="font-medium">{latestReview.medium_count} 项</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-green-600 flex items-center gap-1">
                    <Info className="w-3 h-3" /> 低风险
                  </span>
                  <span className="font-medium">{latestReview.low_count} 项</span>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <div className={`text-center py-2 rounded-lg text-sm font-medium ${
                    latestReview.can_sign
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {latestReview.can_sign ? '✓ 可以发起签署' : '✗ 存在未处理高风险，禁止签署'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {contract.void_initiated_by && !contract.is_voided && (
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
              <h3 className="font-semibold text-sm text-orange-700 mb-2 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                作废确认流程
              </h3>
              <p className="text-xs text-orange-600 mb-3">
                <span className="font-medium">作废原因：</span>{voidInfo?.void_reason || '-'}
              </p>
              <div className="space-y-2">
                {voidConfirmations.map((v) => (
                  <div key={v.id} className="flex items-center justify-between text-xs bg-white/60 p-2 rounded">
                    <span className="text-gray-700 font-medium">{v.user_name}</span>
                    <span className={`flex items-center gap-1 ${v.confirmed ? 'text-green-600' : 'text-gray-400'}`}>
                      {v.confirmed ? (
                        <><CheckCircle className="w-3.5 h-3.5" /> 已确认</>
                      ) : (
                        <><Clock className="w-3.5 h-3.5" /> 待确认</>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-orange-200">
                <div className="w-full bg-orange-200 rounded-full h-1.5">
                  <div
                    className="bg-orange-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${voidConfirmations.length > 0 ? (voidConfirmations.filter((v) => v.confirmed).length / voidConfirmations.length) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-orange-600 mt-1.5 text-right">
                  {voidConfirmations.filter((v) => v.confirmed).length} / {voidConfirmations.length} 已确认
                </p>
              </div>
            </div>
          )}

          {contract.is_voided && (
            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
              <h3 className="font-semibold text-sm text-red-700 mb-1">作废原因</h3>
              <p className="text-xs text-red-600">{contract.void_reason || '-'}</p>
            </div>
          )}
        </div>
      </div>

      {showHistory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">版本历史</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              {(contract.versions || []).map((v) => (
                <div key={v.id} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">v{v.version}</span>
                    <span className="text-xs text-gray-500">{v.created_at}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">修改人：{v.changer_name || '-'}</p>
                  {v.change_reason && <p className="text-xs text-gray-500 mt-1">原因：{v.change_reason}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSigners && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold">设置签署人（按顺序）</h3>
              <button onClick={() => setShowSigners(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-2">
              {users.map((u) => (
                <label
                  key={u.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition ${
                    selectedSigners.includes(u.id)
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSigners.includes(u.id)}
                    onChange={() => toggleSigner(u.id)}
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.username}</p>
                  </div>
                  {selectedSigners.includes(u.id) && (
                    <span className="text-xs px-2 py-0.5 bg-indigo-600 text-white rounded-full">
                      {selectedSigners.indexOf(u.id) + 1}
                    </span>
                  )}
                </label>
              ))}
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowSigners(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleSaveSigners} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">保存</button>
            </div>
          </div>
        </div>
      )}

      {showVoid && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-red-600">作废合同</h3>
              <button onClick={() => setShowVoid(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">作废原因</label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="请填写作废原因"
              />
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowVoid(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleVoid} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">确认作废</button>
            </div>
          </div>
        </div>
      )}

      {exemptModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-purple-700">风险豁免申请</h3>
              <button onClick={() => setExemptModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm font-medium text-purple-800">{exemptModal.risk.rule_name}</p>
                <p className="text-xs text-purple-600 mt-1">{exemptModal.risk.description}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">豁免原因 *</label>
                <textarea
                  value={exemptModal.reason}
                  onChange={(e) => setExemptModal({ ...exemptModal, reason: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="请详细说明豁免此风险的原因..."
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setExemptModal(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleExemptSubmit} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">确认豁免</button>
            </div>
          </div>
        </div>
      )}

      {auditLogModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">处理日志</h3>
              <button onClick={() => setAuditLogModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-5">
              {auditLogModal.logs.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">暂无处理记录</div>
              ) : (
                <div className="space-y-3">
                  {auditLogModal.logs.map((log) => (
                    <div key={log.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-800">{log.operator_name}</span>
                        <span className="text-xs text-gray-500">{log.created_at}</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {log.old_status && (
                          <span className="text-gray-500">{STATUS_LABELS[log.old_status]} → </span>
                        )}
                        <span className="font-medium text-indigo-600">{log.action}</span>
                        {log.new_status && (
                          <span className="text-gray-500"> → {STATUS_LABELS[log.new_status]}</span>
                        )}
                      </p>
                      {log.reason && (
                        <p className="text-xs text-gray-500 mt-1 bg-white p-2 rounded">原因：{log.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
