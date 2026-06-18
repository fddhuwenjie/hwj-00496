import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type SignatureLog, type NodeDashboard } from '../lib/api';
import { STATUS_LABEL, STATUS_COLOR } from '../store';
import { BarChart3, Calendar, TrendingUp, Users, AlertTriangle, FileCheck, ListTodo, CalendarClock, CheckCircle, Clock } from 'lucide-react';

export default function Stats() {
  const [overview, setOverview] = useState<any>(null);
  const [overtime, setOvertime] = useState<any[]>([]);
  const [categoryDist, setCategoryDist] = useState<any[]>([]);
  const [logs, setLogs] = useState<SignatureLog[]>([]);
  const [calendarDate, setCalendarDate] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [nodeDashboard, setNodeDashboard] = useState<NodeDashboard | null>(null);
  const [nodeFilter, setNodeFilter] = useState<{ node_type: string; responsible_party: string }>({ node_type: '', responsible_party: '' });

  useEffect(() => {
    api.getStatsOverview().then(setOverview).catch(() => {});
    api.getPendingOvertime().then(setOvertime).catch(() => {});
    api.getCategoryDistribution().then(setCategoryDist).catch(() => {});
    api.getSignatureLogs({ pageSize: 20 }).then((r) => setLogs(r.list)).catch(() => {});
  }, []);

  useEffect(() => {
    api.getCalendarEvents(calendarDate.year, calendarDate.month).then(setCalendarEvents).catch(() => {});
  }, [calendarDate]);

  const loadNodeDashboard = () => {
    const params: any = {};
    if (nodeFilter.node_type) params.node_type = nodeFilter.node_type;
    if (nodeFilter.responsible_party) params.responsible_party = nodeFilter.responsible_party;
    api.getNodeDashboard(Object.keys(params).length ? params : undefined).then(setNodeDashboard).catch(() => {});
  };

  useEffect(() => {
    loadNodeDashboard();
  }, [nodeFilter]);


  const total = categoryDist.reduce((s, c) => s + c.cnt, 0) || 1;

  const colors: Record<string, string> = {
    '劳动合同': 'bg-blue-500',
    '采购合同': 'bg-green-500',
    '保密协议': 'bg-purple-500',
    '租赁合同': 'bg-orange-500',
  };

  const actionLabel: Record<string, string> = { sign: '签署', reject: '拒签', void: '作废' };

  const renderCalendar = () => {
    const { year, month } = calendarDate;
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const weeks: (number | null)[][] = [];
    let currentWeek: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) currentWeek.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      currentWeek.push(d);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }
    const fmt = (d: number) => `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const today = new Date().toISOString().split('T')[0];

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 font-medium">
          {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((d, di) => {
              if (!d) return <div key={di} className="h-16" />;
              const dateStr = fmt(d);
              const events = calendarEvents.filter((e) => e.expiry_date === dateStr);
              const isToday = dateStr === today;
              return (
                <div
                  key={di}
                  className={`h-16 p-1 rounded border text-xs overflow-hidden ${
                    isToday ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className={`text-right ${isToday ? 'font-bold text-indigo-600' : 'text-gray-500'}`}>{d}</div>
                  {events.slice(0, 2).map((e) => (
                    <div
                      key={e.id}
                      className={`text-[10px] truncate px-1 py-0.5 mt-0.5 rounded ${STATUS_COLOR[e.status]}`}
                      title={e.title}
                    >
                      {e.title.slice(0, 6)}
                    </div>
                  ))}
                  {events.length > 2 && (
                    <div className="text-[10px] text-gray-400">+{events.length - 2}</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const prevMonth = () => {
    if (calendarDate.month === 1) {
      setCalendarDate({ year: calendarDate.year - 1, month: 12 });
    } else {
      setCalendarDate({ ...calendarDate, month: calendarDate.month - 1 });
    }
  };
  const nextMonth = () => {
    if (calendarDate.month === 12) {
      setCalendarDate({ year: calendarDate.year + 1, month: 1 });
    } else {
      setCalendarDate({ ...calendarDate, month: calendarDate.month + 1 });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">本月新签</p>
              <p className="text-xl font-bold text-gray-800">{overview?.monthNewCount || 0} 份</p>
              <p className="text-xs text-gray-400">¥ {Number(overview?.monthNewAmount || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">各状态分布</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {(overview?.byStatus || []).map((s: any) => (
                  <span key={s.status} className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLOR[s.status]}`}>
                    {STATUS_LABEL[s.status]} {s.cnt}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">签署超时（超过3天）</p>
              <p className="text-xl font-bold text-red-600">{overview?.pendingOvertime || 0} 份</p>
              <p className="text-xs text-gray-400">需要催办</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">合同总类型</p>
              <p className="text-xl font-bold text-gray-800">{categoryDist.length} 类</p>
              <p className="text-xs text-gray-400">共 {total} 份</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            合同类型分布
          </h3>
          <div className="space-y-4">
            {categoryDist.map((c) => {
              const pct = Math.round((c.cnt / total) * 100);
              return (
                <div key={c.category}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-gray-700">{c.category || '无分类'}</span>
                    <span className="text-gray-500">{c.cnt} 份 · ¥{Number(c.total_amount).toLocaleString()} · {pct}%</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors[c.category] || 'bg-gray-400'} rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            待签署超时合同
          </h3>
          {overtime.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">暂无超时合同</div>
          ) : (
            <div className="space-y-2">
              {overtime.map((o) => (
                <div key={o.id} className="p-3 bg-red-50 border border-red-100 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-800">{o.title}</span>
                    <span className="text-xs text-red-600 font-medium">超时</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">待签：{o.signer_name}</span>
                    <Link to={`/contract/${o.contract_id}`} className="text-xs text-indigo-600 hover:underline">查看</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              合同到期日历
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="px-2 py-1 border border-gray-200 rounded text-sm hover:bg-gray-50">‹</button>
              <span className="text-sm font-medium">{calendarDate.year}年{calendarDate.month}月</span>
              <button onClick={nextMonth} className="px-2 py-1 border border-gray-200 rounded text-sm hover:bg-gray-50">›</button>
            </div>
          </div>
          {renderCalendar()}
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm max-h-[500px] overflow-auto">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            签章使用日志
          </h3>
          <div className="space-y-2">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">暂无记录</div>
            ) : (
              logs.map((l) => (
                <div key={l.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        l.action === 'sign' ? 'bg-green-100 text-green-700' :
                        l.action === 'reject' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {actionLabel[l.action] || l.action}
                      </span>
                      <span className="text-sm font-medium text-gray-700">{l.user_name}</span>
                    </div>
                    <span className="text-xs text-gray-400">{l.created_at?.split(' ')[0]}</span>
                  </div>
                  <p className="text-sm mt-1.5 text-gray-700">{l.contract_title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">IP: {l.sign_ip || '-'}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-indigo-500" />
            履约看板
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={nodeFilter.node_type}
              onChange={(e) => setNodeFilter({ ...nodeFilter, node_type: e.target.value })}
              className="px-2 py-1 border border-gray-200 rounded text-xs"
            >
              <option value="">全部类型</option>
              <option value="payment">付款节点</option>
              <option value="delivery">交付节点</option>
              <option value="acceptance">验收节点</option>
              <option value="other">其他节点</option>
            </select>
            <select
              value={nodeFilter.responsible_party}
              onChange={(e) => setNodeFilter({ ...nodeFilter, responsible_party: e.target.value })}
              className="px-2 py-1 border border-gray-200 rounded text-xs"
            >
              <option value="">全部责任方</option>
              {(nodeDashboard?.byResponsibleParty || []).map((r) => (
                <option key={r.responsible_party} value={r.responsible_party}>{r.responsible_party}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="p-3 bg-indigo-50 rounded-lg">
            <p className="text-xs text-indigo-600 flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" />本月应完成</p>
            <p className="text-2xl font-bold text-indigo-700">{nodeDashboard?.monthDueCount ?? 0}</p>
            <p className="text-[10px] text-indigo-400">计划 {nodeDashboard?.monthPlannedCount ?? 0} · 已完成 {nodeDashboard?.monthCompletedCount ?? 0}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg">
            <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />逾期节点数</p>
            <p className="text-2xl font-bold text-red-700">{nodeDashboard?.overdueCount ?? 0}</p>
            <p className="text-[10px] text-red-400">需要尽快处理</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />本月已完成</p>
            <p className="text-2xl font-bold text-green-700">{nodeDashboard?.monthCompletedCount ?? 0}</p>
            <p className="text-[10px] text-green-400">完成率 {nodeDashboard?.monthPlannedCount ? Math.round((nodeDashboard.monthCompletedCount / nodeDashboard.monthPlannedCount) * 100) : 0}%</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg">
            <p className="text-xs text-amber-600 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />待履约金额</p>
            <p className="text-xl font-bold text-amber-700">¥ {Number(nodeDashboard?.totalPendingAmount ?? 0).toLocaleString()}</p>
            <p className="text-[10px] text-amber-400">涉及 {nodeDashboard?.pendingAmountByContract?.length ?? 0} 个合同</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-gray-400" /> 按责任方统计完成率
            </h4>
            {(nodeDashboard?.byResponsibleParty || []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">暂无责任方数据</p>
            ) : (
              <div className="space-y-3">
                {nodeDashboard?.byResponsibleParty.map((r) => {
                  const rate = r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0;
                  return (
                    <div key={r.responsible_party}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700">{r.responsible_party}</span>
                        <span className="text-gray-500">{r.completed}/{r.total} · {rate}% · 逾期 {r.overdue}</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full transition-all" style={{ width: `${rate}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-gray-400" /> 合同金额待履约分布
            </h4>
            {(nodeDashboard?.pendingAmountByContract || []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">暂无待履约合同</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto pr-1">
                {nodeDashboard?.pendingAmountByContract.map((c) => {
                  const maxAmt = Math.max(...(nodeDashboard?.pendingAmountByContract || []).map((x) => x.pending_amount), 1);
                  const pct = Math.round((c.pending_amount / maxAmt) * 100);
                  return (
                    <Link to={`/contract/${c.id}`} key={c.id} className="block p-2 hover:bg-gray-50 rounded-lg">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 truncate max-w-[60%]">{c.title}</span>
                        <span className="text-indigo-600 font-medium">¥ {Number(c.pending_amount).toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-300 to-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">待履约节点 {c.node_total} 个</p>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {(nodeDashboard?.overdueList || []).length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> 逾期节点列表
            </h4>
            <div className="space-y-2 max-h-48 overflow-auto pr-1">
              {nodeDashboard?.overdueList.map((n) => (
                <Link to={`/contract/${n.contract_id}`} key={n.id} className="block p-2 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-800 truncate">{n.node_name}</span>
                    <span className="text-red-600">逾期</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-500 mt-0.5">
                    <span>{n.contract_title}</span>
                    <span>计划：{n.planned_date}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
