import { useEffect, useState } from 'react';
import { api, type RiskDashboard as RiskDashboardType, type RiskRecord } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, TrendingUp, BarChart3, AlertCircle, Info, Filter, Calendar, FileText, Shield, ChevronRight } from 'lucide-react';

const RISK_LEVEL_COLORS: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const RISK_LEVEL_BG: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
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

export default function RiskDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<RiskDashboardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    contract_type: '',
    risk_level: '',
    startDate: '',
    endDate: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filters.contract_type) params.contract_type = filters.contract_type;
      if (filters.risk_level) params.risk_level = filters.risk_level;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const result = await api.getRiskDashboard(
        Object.keys(params).length ? params : undefined,
      );
      setData(result);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    setFilters({
      contract_type: '',
      risk_level: '',
      startDate: '',
      endDate: '',
    });
  };

  const maxTotal = data?.type_distribution.length
    ? Math.max(...data.type_distribution.map((d) => d.total))
    : 1;
  const maxTopRisk = data?.top_risks.length
    ? Math.max(...data.top_risks.map((d) => d.total))
    : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">合同风险看板</h1>
        <p className="text-sm text-gray-500 mt-1">监控合同风险分布、高频风险规则和待处理风险</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">筛选条件</span>
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">合同类型</label>
            <select
              value={filters.contract_type}
              onChange={(e) => handleFilterChange('contract_type', e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">全部类型</option>
              <option value="劳动合同">劳动合同</option>
              <option value="采购合同">采购合同</option>
              <option value="保密协议">保密协议</option>
              <option value="租赁合同">租赁合同</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">风险等级</label>
            <select
              value={filters.risk_level}
              onChange={(e) => handleFilterChange('risk_level', e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">全部等级</option>
              <option value="high">高风险</option>
              <option value="medium">中风险</option>
              <option value="low">低风险</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">开始日期</label>
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">结束日期</label>
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={resetFilters}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
            >
              重置筛选
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">本月高风险合同</p>
                  <p className="text-3xl font-bold text-red-600 mt-1">{data?.month_high_risk || 0}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">待处理风险总数</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-1">{data?.pending_list.length || 0}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">涉及合同类型</p>
                  <p className="text-3xl font-bold text-indigo-600 mt-1">{data?.type_distribution.length || 0}</p>
                </div>
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">高频风险规则</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{data?.top_risks.length || 0}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                各合同类型风险分布
              </h3>
              {data?.type_distribution.length === 0 ? (
                <div className="text-center py-8 text-gray-400">暂无数据</div>
              ) : (
                <div className="space-y-4">
                  {data?.type_distribution.map((item) => (
                    <div key={item.contract_type}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          {item.contract_type || '未分类'}
                        </span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-red-600">高 {item.high_count}</span>
                          <span className="text-yellow-600">中 {item.medium_count}</span>
                          <span className="text-green-600">低 {item.low_count}</span>
                          <span className="font-semibold text-gray-700">共 {item.total}</span>
                        </div>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full ${RISK_LEVEL_COLORS.high}`}
                          style={{ width: `${(item.high_count / maxTotal) * 100}%` }}
                        />
                        <div
                          className={`h-full ${RISK_LEVEL_COLORS.medium}`}
                          style={{ width: `${(item.medium_count / maxTotal) * 100}%` }}
                        />
                        <div
                          className={`h-full ${RISK_LEVEL_COLORS.low}`}
                          style={{ width: `${(item.low_count / maxTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-600" />
                TOP10 高频风险规则
              </h3>
              {data?.top_risks.length === 0 ? (
                <div className="text-center py-8 text-gray-400">暂无数据</div>
              ) : (
                <div className="space-y-3">
                  {data?.top_risks.map((item, index) => (
                    <div key={item.rule_name} className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index < 3 ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 truncate">{item.rule_name}</span>
                          <span className="text-xs text-gray-500 ml-2">{item.total} 次</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                            style={{ width: `${(item.total / maxTopRisk) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                待处理风险列表
              </h3>
            </div>
            {data?.pending_list.length === 0 ? (
              <div className="text-center py-12 text-gray-400">暂无待处理风险</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data?.pending_list.map((risk: RiskRecord) => (
                  <div
                    key={risk.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition"
                    onClick={() => navigate(`/contract/${risk.contract_id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RISK_LEVEL_BG[risk.risk_level]}`}>
                            {risk.risk_level === 'high' ? '高风险' : risk.risk_level === 'medium' ? '中风险' : '低风险'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[risk.status]}`}>
                            {STATUS_LABELS[risk.status]}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{risk.rule_name}</span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-1">{risk.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {risk.contract_no} - {risk.contract_title}
                          </span>
                          {risk.reviewed_at && (
                            <span>{new Date(risk.reviewed_at).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
