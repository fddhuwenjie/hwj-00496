import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Contract } from '../lib/api';
import { STATUS_LABEL, STATUS_COLOR, useStore } from '../store';
import {
  FileText, FileSignature, Clock, AlertTriangle, TrendingUp,
  Calendar, ArrowRight, FileCheck, FileX
} from 'lucide-react';

export default function Dashboard() {
  const user = useStore((s) => s.user);
  const [stats, setStats] = useState<any>(null);
  const [pending, setPending] = useState<Contract[]>([]);
  const [expiring, setExpiring] = useState<Contract[]>([]);
  const [recent, setRecent] = useState<Contract[]>([]);

  useEffect(() => {
    api.getStatsOverview().then(setStats).catch(() => {});
    api.getPendingSign().then(setPending).catch(() => {});
    api.getExpiring().then(setExpiring).catch(() => {});
    api.getContracts().then((r) => setRecent(r.slice(0, 5))).catch(() => {});
  }, []);

  const statusStats = stats?.byStatus || [];
  const getStatusCount = (s: string) => statusStats.find((x: any) => x.status === s)?.cnt || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">本月新签合同</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats?.monthNewCount || 0}</p>
              <p className="text-xs text-gray-400 mt-1">
                金额：¥ {Number(stats?.monthNewAmount || 0).toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">待签署合同</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{getStatusCount('pending')}</p>
              {stats?.pendingOvertime > 0 && (
                <p className="text-xs text-red-500 mt-1">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  {stats.pendingOvertime} 份已超时
                </p>
              )}
            </div>
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">已签署合同</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{getStatusCount('signed')}</p>
              <p className="text-xs text-gray-400 mt-1">
                <FileCheck className="w-3 h-3 inline mr-1" />
                生效中
              </p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
              <FileSignature className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">即将到期 (30天内)</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{expiring.length}</p>
              <p className="text-xs text-orange-500 mt-1">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                请及时处理
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">待我签署</h3>
            <Link to="/pending" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
              查看全部 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {pending.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <FileSignature className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>暂无待签署合同</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {pending.map((c) => (
                <Link
                  key={c.id}
                  to={`/contract/${c.id}/sign`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800">{c.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {c.party_a} × {c.party_b} · ¥{Number(c.amount).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">{c.created_at?.split(' ')[0]}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">合同类型分布</h3>
          </div>
          <div className="p-5 space-y-3">
            {(stats?.byCategory || []).map((c: any) => {
              const total = (stats?.byCategory || []).reduce((s: number, x: any) => s + x.cnt, 0) || 1;
              const pct = Math.round((c.cnt / total) * 100);
              const colors: Record<string, string> = {
                '劳动合同': 'bg-blue-500',
                '采购合同': 'bg-green-500',
                '保密协议': 'bg-purple-500',
                '租赁合同': 'bg-orange-500',
              };
              return (
                <div key={c.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{c.category || '无分类'}</span>
                    <span className="text-gray-500">{c.cnt} 份 · {pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors[c.category] || 'bg-gray-400'} rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {(!stats?.byCategory || stats.byCategory.length === 0) && (
              <p className="text-center text-gray-400 text-sm py-6">暂无数据</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">即将到期合同</h3>
          </div>
          {expiring.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>暂无即将到期合同</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {expiring.map((c) => {
                const days = Math.ceil((new Date(c.expiry_date!).getTime() - Date.now()) / 86400000);
                return (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <p className="font-medium text-sm text-gray-800">{c.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">到期日：{c.expiry_date}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      days <= 7 ? 'bg-red-100 text-red-700' : days <= 15 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {days}天后到期
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">最近合同</h3>
            <Link to="/contracts" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
              全部 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>暂无合同</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recent.map((c) => (
                <Link
                  key={c.id}
                  to={`/contract/${c.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-gray-800">{c.title}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">编号：{c.contract_no}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
