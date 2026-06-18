import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, type Contract, type Signature } from '../lib/api';
import { useStore } from '../store';
import { ArrowLeft, CheckCircle, XCircle, FileSignature, RefreshCw } from 'lucide-react';

export default function ContractSign() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const [contract, setContract] = useState<Contract | null>(null);
  const [mySignatures, setMySignatures] = useState<Signature[]>([]);
  const [signatureData, setSignatureData] = useState('');
  const [showDraw, setShowDraw] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const load = async () => {
    const c = await api.getContract(Number(id));
    setContract(c);
    const sigs = await api.getMySignatures();
    setMySignatures(sigs);
    if (sigs.length > 0) setSignatureData(sigs[0].signature_data);
  };

  useEffect(() => { load(); }, [id]);

  if (!contract) {
    return <div className="p-10 text-center text-gray-400">加载中...</div>;
  }

  const mySigner = (contract.signers || []).find((s) => s.user_id === user?.id);
  const canSign = mySigner && mySigner.status === 'pending';

  const prevSigners = (contract.signers || []).filter((s) => s.sign_order < (mySigner?.sign_order || 999));
  const allPrevSigned = prevSigners.every((s) => s.status === 'signed');

  const startDraw = () => {
    setShowDraw(true);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
    }, 50);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    lastPosRef.current = {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !lastPosRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPosRef.current = { x, y };
  };

  const handleMouseUp = () => {
    drawingRef.current = false;
    lastPosRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const useCanvasSign = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL('image/png');
    setSignatureData(data);
    await api.saveSignature(data);
    setShowDraw(false);
    load();
  };

  const handleSign = async () => {
    if (!signatureData) {
      alert('请先选择或创建签章');
      return;
    }
    if (!confirm('确认签署此合同？签署后不可撤销。')) return;
    try {
      await api.signContract(contract.id, signatureData);
      alert('签署成功');
      navigate(`/contract/${contract.id}`);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleReject = async () => {
    if (!rejectReason) {
      alert('请填写拒签原因');
      return;
    }
    if (!confirm('确认拒签此合同？')) return;
    try {
      await api.rejectContract(contract.id, rejectReason);
      alert('已拒签');
      navigate(`/contract/${contract.id}`);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/contract/${contract.id}`} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-xl font-semibold">签署合同 - {contract.title}</h2>
            <p className="text-sm text-gray-500">编号：{contract.contract_no}</p>
          </div>
        </div>
      </div>

      {!allPrevSigned && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm">
          请等待前序签署人完成签署后再进行操作。
        </div>
      )}

      {mySigner?.status === 'signed' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          您已完成签署。
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold">合同正文（请仔细阅读）</h3>
            </div>
            <div className="p-6 bg-gray-50 max-h-[70vh] overflow-auto">
              <div
                className="bg-white shadow p-10 mx-auto max-w-3xl"
                dangerouslySetInnerHTML={{ __html: contract.content }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <h3 className="font-semibold text-sm mb-3">签署人信息</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">签署人</span>
                <span className="text-gray-800 font-medium">{user?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">签署顺序</span>
                <span className="text-gray-800">第 {mySigner?.sign_order} 位</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">状态</span>
                <span className={mySigner?.status === 'signed' ? 'text-green-600' : 'text-amber-600'}>
                  {mySigner?.status === 'signed' ? '已签署' : '待签署'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                <FileSignature className="w-4 h-4 text-indigo-500" />
                我的签章
              </h3>
              <button
                onClick={startDraw}
                className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                新建签章
              </button>
            </div>

            {mySignatures.length > 0 && (
              <div className="space-y-2 mb-3">
                {mySignatures.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setSignatureData(s.signature_data)}
                    className={`p-2 border rounded-lg cursor-pointer transition ${
                      signatureData === s.signature_data
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <img src={s.signature_data} className="max-h-12 mx-auto" />
                  </div>
                ))}
              </div>
            )}

            {signatureData && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1">当前选择：</p>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <img src={signatureData} className="max-h-16 mx-auto" />
                </div>
              </div>
            )}

            {!signatureData && (
              <p className="text-xs text-gray-400 text-center py-3">暂无签章，请新建</p>
            )}
          </div>

          {canSign && allPrevSigned && (
            <div className="space-y-2">
              <button
                onClick={handleSign}
                disabled={!signatureData}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition text-sm font-medium flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                确认签署
              </button>
              <button
                onClick={() => setShowReject(true)}
                className="w-full py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                拒绝签署
              </button>
            </div>
          )}
        </div>
      </div>

      {showDraw && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold">绘制签章</h3>
              <button onClick={() => setShowDraw(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-3">请在下方画布中用鼠标绘制您的签名：</p>
              <canvas
                ref={canvasRef}
                width={500}
                height={200}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg bg-white cursor-crosshair"
                style={{ height: '200px' }}
              />
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-between">
              <button onClick={clearCanvas} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">清空</button>
              <div className="flex gap-3">
                <button onClick={() => setShowDraw(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">取消</button>
                <button onClick={useCanvasSign} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">使用此签章</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-red-600">拒签合同</h3>
              <button onClick={() => setShowReject(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">拒签原因</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="请填写拒签原因"
              />
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowReject(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleReject} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">确认拒签</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
