import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Contract } from '../lib/api';
import { STATUS_LABEL, STATUS_COLOR } from '../store';
import { Search, Plus, Filter } from 'lucide-react';

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [party, setParty] = useState('');

  const load = () => {
    setLoading(true);
    const params: Record<string, any> = {};
    if (status) params.status = status;
    if (keyword) params.keyword = keyword;
    if (party) params.party = party;
    api.getContracts(params).then((r) => {
      setContracts(r);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSearch = () => load();

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索合同标题/编号"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <input
            type="text"
            placeholder="甲/乙方名称"
            value={party}
            onChange={(e) => setParty(e.target.value)}
            className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="pending">待签署</option>
            <option value="signed">已签署</option>
            <option value="expired">已过期</option>
            <option value="voided">已作废</option>
          </select>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm flex items-center gap-1.5"
          >
            <Filter className="w-4 h-4" />
            搜索
          </button>
          <Link
            to="/contracts/create"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            新建合同
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">加载中...</div>
        ) : contracts.length === 0 ? (
          <div className="p-10 text-center text-gray-400">暂无合同数据</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">合同编号</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">标题</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">甲方 / 乙方</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">金额</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">状态</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">有效期</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.contract_no}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{c.title}</td>
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
                    {c.effective_date} ~ {c.expiry_date}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      to={`/contract/${c.id}`}
                      className="text-indigo-600 hover:text-indigo-800 text-xs"
                    >
                      查看详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
