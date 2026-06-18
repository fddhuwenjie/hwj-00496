import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, type Contract, type User } from '../lib/api';
import { STATUS_LABEL, STATUS_COLOR, useStore } from '../store';
import { ArrowLeft, Send, Edit2, FileX, History, Users, FileText } from 'lucide-react';

export default function ContractDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const [contract, setContract] = useState<Contract | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSigners, setShowSigners] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [selectedSigners, setSelectedSigners] = useState<number[]>([]);

  const load = async () => {
    const c = await api.getContract(Number(id));
    setContract(c);
    setSelectedSigners((c.signers || []).map((s) => s.user_id));
  };

  useEffect(() => {
    load();
    api.getUsers().then(setUsers).catch(() => {});
  }, [id]);

  if (!contract) {
    return <div className="p-10 text-center text-gray-400">加载中...</div>;
  }

  const canEdit = contract.status === 'draft' && !contract.is_voided;
  const canStartSign = contract.status === 'draft' && !contract.is_voided && (contract.signers || []).length > 0;
  const canVoid = !contract.is_voided && (user?.role === 'admin' || contract.created_by === user?.id);
  const isSigned = contract.status === 'signed';
  const isReadOnly = isSigned || contract.is_voided;

  const handleStartSign = async () => {
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
    if (!confirm('确认作废此合同？此操作不可撤销。')) return;
    try {
      await api.voidContract(contract.id, voidReason);
      setShowVoid(false);
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

  const renderContentWithSignatures = () => {
    let html = contract.content;
    (contract.signers || []).forEach((s) => {
      if (s.status === 'signed' && s.signature_data) {
        html += `<div style="display:inline-block;margin:10px;padding:5px;border:1px dashed #ccc;"><img src="${s.signature_data}" style="max-width:150px;max-height:60px;" /><div style="font-size:10px;color:#666;text-align:center;">${s.user_name}<br/>${s.signed_at?.split(' ')[0] || ''}</div></div>`;
      }
    });
    return html;
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
        <div className="flex items-center gap-2">
          <span className={`text-xs px-3 py-1 rounded-full ${STATUS_COLOR[contract.status]}`}>
            {contract.is_voided ? '已作废' : STATUS_LABEL[contract.status]}
          </span>
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
                  className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
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
    </div>
  );
}
