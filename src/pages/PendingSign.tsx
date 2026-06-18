import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Contract } from '../lib/api';
import { STATUS_LABEL, STATUS_COLOR } from '../store';
import { FileSignature } from 'lucide-react';

export default function PendingSign() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPendingSign().then((r) => {
      setContracts(r);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">加载中...</div>
        ) : contracts.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <FileSignature className="w-16 h-16 mx-auto mb-3 opacity-30" />
            <p className="text-lg">暂无待签署合同</p>
            <p className="text-sm mt-1">所有合同均已处理完毕</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">合同编号</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">标题</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">甲方 / 乙方</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">金额</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">状态</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">创建时间</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {contracts.map((c) => {
                const days = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
                const overtime = days > 3;
                return (
                  <tr key={c.id} className={`hover:bg-gray-50 ${overtime ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.contract_no}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {c.title}
                      {overtime && <span className="ml-2 text-xs text-red-600 font-medium">（超时）</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {c.party_a} / {c.party_b}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      ¥ {Number(c.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2.5 py-1 rounded-full ${STATUS_COLOR[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {c.created_at?.split(' ')[0]}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        to={`/contract/${c.id}/sign`}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                      >
                        去签署
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
