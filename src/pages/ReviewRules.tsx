import { useEffect, useState } from 'react';
import { api, type ReviewRule } from '../lib/api';
import { useStore } from '../store';
import { Plus, Edit2, Trash2, Power, PowerOff, X, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const CONTRACT_TYPES = ['all', '劳动合同', '采购合同', '保密协议', '租赁合同'];
const RISK_LEVELS: { value: 'high' | 'medium' | 'low'; label: string; color: string; icon: any }[] = [
  { value: 'high', label: '高风险', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
  { value: 'medium', label: '中风险', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: AlertCircle },
  { value: 'low', label: '低风险', color: 'bg-green-100 text-green-700 border-green-200', icon: Info },
];

export default function ReviewRules() {
  const user = useStore((s) => s.user);
  const [rules, setRules] = useState<ReviewRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ReviewRule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterEnabled, setFilterEnabled] = useState<boolean | undefined>(undefined);
  const [formData, setFormData] = useState<Partial<ReviewRule>>({
    name: '',
    contract_type: 'all',
    risk_level: 'medium',
    pattern: '',
    is_regex: 0,
    description: '',
    suggestion: '',
    is_enabled: 1,
  });

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await api.getReviewRules(
        filterType === 'all' ? undefined : filterType,
        filterEnabled,
      );
      setRules(data);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, [filterType, filterEnabled]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRule) {
        await api.updateReviewRule(editingRule.id, formData);
      } else {
        await api.createReviewRule(formData);
      }
      setShowModal(false);
      setEditingRule(null);
      resetForm();
      loadRules();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleEdit = (rule: ReviewRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      contract_type: rule.contract_type,
      risk_level: rule.risk_level,
      pattern: rule.pattern,
      is_regex: rule.is_regex,
      description: rule.description,
      suggestion: rule.suggestion,
      is_enabled: rule.is_enabled,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteReviewRule(id);
      setDeleteConfirm(null);
      loadRules();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleToggleEnabled = async (rule: ReviewRule) => {
    try {
      await api.updateReviewRule(rule.id, { is_enabled: rule.is_enabled ? 0 : 1 });
      loadRules();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contract_type: 'all',
      risk_level: 'medium',
      pattern: '',
      is_regex: 0,
      description: '',
      suggestion: '',
      is_enabled: 1,
    });
  };

  const getRiskLevelInfo = (level: string) => {
    return RISK_LEVELS.find((r) => r.value === level) || RISK_LEVELS[1];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">审查规则管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理合同智能审查的规则库，支持关键字和正则表达式匹配</p>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => {
              setEditingRule(null);
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" />
            新增规则
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">适用合同类型</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">全部类型</option>
              <option value="劳动合同">劳动合同</option>
              <option value="采购合同">采购合同</option>
              <option value="保密协议">保密协议</option>
              <option value="租赁合同">租赁合同</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">启用状态</label>
            <select
              value={filterEnabled === undefined ? '' : filterEnabled ? '1' : '0'}
              onChange={(e) => setFilterEnabled(e.target.value === '' ? undefined : e.target.value === '1')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">全部</option>
              <option value="1">已启用</option>
              <option value="0">已禁用</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
          暂无审查规则
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">规则名称</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">适用类型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">风险等级</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">匹配模式</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建人</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rules.map((rule) => {
                const levelInfo = getRiskLevelInfo(rule.risk_level);
                const LevelIcon = levelInfo.icon;
                return (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{rule.name}</div>
                      <div className="text-xs text-gray-500 mt-1 line-clamp-1">{rule.description}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {rule.contract_type === 'all' ? '全部类型' : rule.contract_type}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${levelInfo.color}`}>
                        <LevelIcon className="w-3 h-3" />
                        {levelInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900 font-mono text-xs bg-gray-100 px-2 py-1 rounded max-w-xs truncate">
                        {rule.pattern || '(空)'}
                      </div>
                      {rule.is_regex === 1 && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">正则</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        rule.is_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {rule.is_enabled ? '已启用' : '已禁用'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {rule.creator_name}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user?.role === 'admin' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleEnabled(rule)}
                            className={`p-1.5 rounded-lg transition ${
                              rule.is_enabled
                                ? 'text-yellow-600 hover:bg-yellow-50'
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={rule.is_enabled ? '禁用' : '启用'}
                          >
                            {rule.is_enabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleEdit(rule)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(rule.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingRule ? '编辑规则' : '新增规则'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingRule(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">规则名称 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="请输入规则名称"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">适用合同类型</label>
                  <select
                    value={formData.contract_type}
                    onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {CONTRACT_TYPES.map((t) => (
                      <option key={t} value={t}>{t === 'all' ? '全部类型' : t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">风险等级</label>
                  <select
                    value={formData.risk_level}
                    onChange={(e) => setFormData({ ...formData, risk_level: e.target.value as 'high' | 'medium' | 'low' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {RISK_LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_regex === 1}
                      onChange={(e) => setFormData({ ...formData, is_regex: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span className="text-sm text-gray-700">使用正则表达式</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  匹配模式（关键词或正则表达式） *
                </label>
                <input
                  type="text"
                  value={formData.pattern}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  placeholder={formData.is_regex ? '例如：(违约|赔偿).*条款' : '例如：违约责任'}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">风险说明</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="描述该风险的具体内容和影响"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">修改建议</label>
                <textarea
                  value={formData.suggestion}
                  onChange={(e) => setFormData({ ...formData, suggestion: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="给出具体的修改建议"
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_enabled === 1}
                    onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked ? 1 : 0 })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm text-gray-700">启用此规则</span>
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingRule(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                >
                  {editingRule ? '保存修改' : '创建规则'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">确认删除</h3>
            <p className="text-gray-600 text-sm mb-6">确定要删除此审查规则吗？删除后无法恢复。</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
