import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type NodeReminders, type PerformanceNode, type NodeType, type Contract } from '../lib/api';
import { STATUS_LABEL, STATUS_COLOR } from '../store';
import { CalendarClock, AlertTriangle, Bell, RefreshCw, FileText } from 'lucide-react';

const NODE_TYPE_LABEL: Record<NodeType, string> = {
  payment: '付款节点', delivery: '交付节点', acceptance: '验收节点', other: '其他节点',
};
const NODE_TYPE_COLOR: Record<NodeType, string> = {
  payment: 'bg-amber-100 text-amber-700', delivery: 'bg-blue-100 text-blue-700', acceptance: 'bg-green-100 text-green-700', other: 'bg-gray-100 text-gray-700',
};

const TAB_THEME: Record<'due' | 'overdue' | 'expiring', { active: string; badge: string; border: string }> = {
  due: { active: 'border-amber-500 text-amber-600', badge: 'bg-amber-100 text-amber-700', border: 'border-amber-400 bg-amber-50' },
  overdue: { active: 'border-red-500 text-red-600', badge: 'bg-red-100 text-red-700', border: 'border-red-400 bg-red-50' },
  expiring: { active: 'border-indigo-500 text-indigo-600', badge: 'bg-indigo-100 text-indigo-700', border: 'border-indigo-400 bg-indigo-50' },
};

function daysBetween(dateStr: string, today: string): number {
  return Math.ceil((new Date(dateStr).getTime() - new Date(today).getTime()) / 86400000);
}

function NodeCard({ node, today }: { node: PerformanceNode; today: string }) {
  const days = daysBetween(node.planned_date, today);
  return (
    <Link
      to={`/contract/${node.contract_id}`}
      className="block p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-sm transition"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${NODE_TYPE_COLOR[node.node_type]}`}>
            {NODE_TYPE_LABEL[node.node_type]}
          </span>
          <span className="text-sm font-medium text-gray-800 truncate">{node.node_name}</span>
        </div>
        <span className={`text-xs font-medium flex-shrink-0 ${days < 0 ? 'text-red-600' : 'text-amber-600'}`}>
          {days < 0 ? `已逾期 ${Math.abs(days)} 天` : `${days} 天后到期`}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 flex-wrap gap-1">
        <span className="truncate max-w-[50%]">{node.contract_title || '-'}</span>
        <span className="flex items-center gap-2">
          {node.responsible_party && <span>责任方：{node.responsible_party}</span>}
          <span className="flex items-center gap-1">
            <CalendarClock className="w-3 h-3" />{node.planned_date}
          </span>
          {Number(node.amount) > 0 && <span className="text-indigo-600">¥{Number(node.amount).toLocaleString()}</span>}
        </span>
      </div>
    </Link>
  );
}

function ExpiringContractCard({ c, today }: { c: Contract & { template_name?: string }; today: string }) {
  const days = c.expiry_date ? daysBetween(c.expiry_date, today) : 0;
  return (
    <Link
      to={`/contract/${c.id}`}
      className="block p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-sm transition"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-800 truncate">{c.title}</span>
        </div>
        <span className={`text-xs font-medium flex-shrink-0 ${days < 0 ? 'text-red-600' : 'text-amber-600'}`}>
          {days < 0 ? `已逾期 ${Math.abs(days)} 天` : `${days} 天后到期`}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 flex-wrap gap-1">
        <span>{c.party_b}</span>
        <span className="flex items-center gap-2">
          {c.contract_no && <span>{c.contract_no}</span>}
          <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLOR[c.status as keyof typeof STATUS_COLOR] || 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABEL[c.status as keyof typeof STATUS_LABEL] || c.status}
          </span>
          {Number(c.amount) > 0 && <span className="text-indigo-600">¥{Number(c.amount).toLocaleString()}</span>}
        </span>
      </div>
      <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
        <CalendarClock className="w-3 h-3" />
        到期日：{c.expiry_date}
      </div>
    </Link>
  );
}

export default function Reminders() {
  const [data, setData] = useState<NodeReminders | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'due' | 'overdue' | 'expiring'>('due');

  const load = () => {
    setLoading(true);
    api.getNodeReminders()
      .then((r) => setData(r))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const today = data?.today || new Date().toISOString().split('T')[0];
  const dueCount = data?.dueIn7Days.length ?? 0;
  const overdueCount = data?.overdue.length ?? 0;
  const expiringCount = data?.expiringContracts.length ?? 0;

  const tabs = [
    { key: 'due' as const, label: '7天内到期节点', count: dueCount, icon: CalendarClock, color: 'amber' },
    { key: 'overdue' as const, label: '已逾期节点', count: overdueCount, icon: AlertTriangle, color: 'red' },
    { key: 'expiring' as const, label: '合同即将到期', count: expiringCount, icon: FileText, color: 'indigo' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-500" />
            到期与逾期提醒
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">参考日期：{today} · 系统根据节点计划完成日期与合同到期日生成提醒</p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          onClick={() => setTab('due')}
          className={`p-4 rounded-xl border text-left transition ${tab === 'due' ? TAB_THEME.due.border : 'border-gray-200 bg-white hover:border-amber-200'}`}
        >
          <div className="flex items-center justify-between">
            <CalendarClock className="w-5 h-5 text-amber-500" />
            <span className="text-2xl font-bold text-amber-600">{dueCount}</span>
          </div>
          <p className="text-sm font-medium text-gray-700 mt-1">7天内到期节点</p>
          <p className="text-xs text-gray-400">截至 {data?.within7Date || '-'}</p>
        </button>
        <button
          onClick={() => setTab('overdue')}
          className={`p-4 rounded-xl border text-left transition ${tab === 'overdue' ? TAB_THEME.overdue.border : 'border-gray-200 bg-white hover:border-red-200'}`}
        >
          <div className="flex items-center justify-between">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-2xl font-bold text-red-600">{overdueCount}</span>
          </div>
          <p className="text-sm font-medium text-gray-700 mt-1">已逾期节点</p>
          <p className="text-xs text-gray-400">需尽快处理</p>
        </button>
        <button
          onClick={() => setTab('expiring')}
          className={`p-4 rounded-xl border text-left transition ${tab === 'expiring' ? TAB_THEME.expiring.border : 'border-gray-200 bg-white hover:border-indigo-200'}`}
        >
          <div className="flex items-center justify-between">
            <FileText className="w-5 h-5 text-indigo-500" />
            <span className="text-2xl font-bold text-indigo-600">{expiringCount}</span>
          </div>
          <p className="text-sm font-medium text-gray-700 mt-1">合同即将到期</p>
          <p className="text-xs text-gray-400">30天内到期</p>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="border-b border-gray-100 flex">
          {tabs.map((t) => {
            const Icon = t.icon;
            const theme = TAB_THEME[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition ${
                  tab === t.key ? theme.active : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? theme.badge : 'bg-gray-100 text-gray-500'}`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center py-12 text-gray-400">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-2" />
              加载中...
            </div>
          ) : tab === 'due' ? (
            data && data.dueIn7Days.length > 0 ? (
              <div className="space-y-2">
                {data.dueIn7Days.map((n) => <NodeCard key={n.id} node={n} today={today} />)}
              </div>
            ) : (
              <EmptyState icon={CalendarClock} text="未来7天内暂无到期节点" />
            )
          ) : tab === 'overdue' ? (
            data && data.overdue.length > 0 ? (
              <div className="space-y-2">
                {data.overdue.map((n) => <NodeCard key={n.id} node={n} today={today} />)}
              </div>
            ) : (
              <EmptyState icon={AlertTriangle} text="暂无逾期节点" />
            )
          ) : (
            data && data.expiringContracts.length > 0 ? (
              <div className="space-y-2">
                {data.expiringContracts.map((c) => <ExpiringContractCard key={c.id} c={c} today={today} />)}
              </div>
            ) : (
              <EmptyState icon={FileText} text="30天内暂无到期合同" />
            )
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <Icon className="w-14 h-14 mx-auto text-gray-300 mb-3" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
