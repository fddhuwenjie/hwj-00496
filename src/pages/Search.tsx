import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Contract } from '../lib/api';
import { STATUS_LABEL, STATUS_COLOR } from '../store';
import { Search, Filter } from 'lucide-react';

export default function ContractSearch() {
  const [params, setParams] = useState<Record<string, any>>({});
  const [results, setResults] = useState<Contract[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const r = await api.getContracts(params);
      setResults(r);
    } finally {
      setLoading(false);
    }
  };

  const updateParam = (k: string, v: any) => {
    setParams({ ...params, [k]: v });
  };

  const reset = () => {
    setParams({});
    setResults([]);
    setSearched(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-indigo-500" />
          合同检索
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">关键词（标题/编号）</label>
            <input
              type="text"
              value={params.keyword || ''}
              onChange={(e) => updateParam('keyword', e.target.value)}
              placeholder="输入关键词"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">合同状态</label>
            <select
              value={params.status || ''}
              onChange={(e) => updateParam('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">全部</option>
              <option value="draft">草稿</option>
              <option value="pending">待签署</option>
              <option value="signed">已签署</option>
              <option value="expired">已过期</option>
              <option value="voided">已作废</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">甲方/乙方</label>
            <input
              type="text"
              value={params.party || ''}
              onChange={(e) => updateParam('party', e.target.value)}
              placeholder="甲乙方名称"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">模板分类</label>
            <select
              value={params.category || ''}
              onChange={(e) => updateParam('category', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">全部</option>
              <option value="劳动合同">劳动合同</option>
              <option value="采购合同">采购合同</option>
              <option value="保密协议">保密协议</option>
              <option value="租赁合同">租赁合同</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">创建日期 从</label>
            <input
              type="date"
              value={params.startDate || ''}
              onChange={(e) => updateParam('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">创建日期 至</label>
            <input
              type="date"
              value={params.endDate || ''}
              onChange={(e) => updateParam('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">最低金额</label>
            <input
              type="number"
              value={params.minAmount || ''}
              onChange={(e) => updateParam('minAmount', e.target.value)}
              placeholder="¥"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">最高金额</label>
            <input
              type="number"
              value={params.maxAmount || ''}
              onChange={(e) => updateParam('maxAmount', e.target.value)}
              placeholder="¥"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={reset} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            重置
          </button>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 text-sm flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            {loading ? '搜索中...' : '搜索'}
          </button>
        </div>
      </div>

      {searched && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-600">
            搜索结果：共 {results.length} 份合同
          </div>
          {results.length === 0 ? (
            <div className="p-10 text-center text-gray-400">未找到匹配的合同</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">编号</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">标题</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">分类</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">甲方/乙方</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">金额</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">状态</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.contract_no}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{c.title}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{c.template_category || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{c.party_a} / {c.party_b}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">¥ {Number(c.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link to={`/contract/${c.id}`} className="text-indigo-600 hover:text-indigo-800 text-xs">查看</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
