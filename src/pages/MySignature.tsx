import { useEffect, useRef, useState } from 'react';
import { api, type Signature, type SignatureLog } from '../lib/api';
import { FileSignature, Plus, Trash2, History } from 'lucide-react';

export default function MySignature() {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [logs, setLogs] = useState<SignatureLog[]>([]);
  const [showDraw, setShowDraw] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const load = async () => {
    const sigs = await api.getMySignatures();
    setSignatures(sigs);
    const logData = await api.getSignatureLogs({ pageSize: 20 });
    setLogs(logData.list);
  };

  useEffect(() => { load(); }, []);

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

  const saveSign = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL('image/png');
    await api.saveSignature(data);
    setShowDraw(false);
    load();
  };

  const deleteSign = async (id: number) => {
    if (!confirm('删除此签章？')) return;
    await api.deleteSignature(id);
    load();
  };

  const actionLabel: Record<string, string> = { sign: '签署', reject: '拒签', void: '作废' };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-indigo-500" />
              我的签章
            </h3>
            <button
              onClick={startDraw}
              className="text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              新建签章
            </button>
          </div>
          {signatures.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <FileSignature className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>暂无签章，点击右上角新建</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {signatures.map((s) => (
                <div key={s.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <img src={s.signature_data} className="max-h-20 mx-auto" />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{s.created_at?.split(' ')[0]}</span>
                    <button
                      onClick={() => deleteSign(s.id)}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm max-h-[80vh] overflow-auto">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-500" />
          签章使用日志
        </h3>
        <div className="space-y-3">
          {logs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">暂无记录</p>
          ) : (
            logs.map((l) => (
              <div key={l.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    l.action === 'sign' ? 'bg-green-100 text-green-700' :
                    l.action === 'reject' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {actionLabel[l.action] || l.action}
                  </span>
                  <span className="text-xs text-gray-400">{l.created_at?.split(' ')[0]}</span>
                </div>
                <p className="text-sm mt-1.5 text-gray-700">{l.contract_title}</p>
                <p className="text-xs text-gray-500 mt-0.5">IP: {l.sign_ip || '-'}</p>
              </div>
            ))
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
                <button onClick={saveSign} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">保存签章</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
