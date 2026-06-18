import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore, STATUS_LABEL, STATUS_COLOR } from '../store';
import { api, type Notification } from '../lib/api';
import {
  LayoutDashboard, FileText, FilePlus, FileSignature, Search, BarChart3,
  Bell, LogOut, User, Menu, X, ChevronRight
} from 'lucide-react';

const navItems = [
  { path: '/', label: '工作台', icon: LayoutDashboard },
  { path: '/templates', label: '合同模板', icon: FileText },
  { path: '/contracts', label: '合同列表', icon: FilePlus },
  { path: '/contracts/create', label: '创建合同', icon: FilePlus },
  { path: '/pending', label: '待我签署', icon: FileSignature },
  { path: '/signature', label: '我的签章', icon: FileSignature },
  { path: '/search', label: '合同检索', icon: Search },
  { path: '/stats', label: '统计报表', icon: BarChart3 },
];

export default function Layout() {
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);

  useEffect(() => {
    if (user) api.getNotifications().then(setNotifs).catch(() => {});
  }, [user]);

  const unreadCount = notifs.filter((n) => n.is_read === 0).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const readAll = async () => {
    await api.readAllNotifications();
    setNotifs(notifs.map((n) => ({ ...n, is_read: 1 })));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className={`${sidebarOpen ? 'w-60' : 'w-0'} bg-slate-800 text-white transition-all overflow-hidden flex-shrink-0`}>
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <FileSignature className="w-7 h-7 text-indigo-400" />
            <span className="font-bold text-lg">电子签章系统</span>
          </div>
        </div>
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path ||
              (item.path === '/contracts' && location.pathname.startsWith('/contract/'));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  active ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg">
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h2 className="text-lg font-semibold text-gray-800">
              {navItems.find((n) => location.pathname === n.path)?.label || '合同管理'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg relative"
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-96 overflow-auto">
                  <div className="p-3 border-b border-gray-100 flex justify-between items-center">
                    <span className="font-medium">通知消息</span>
                    <button onClick={readAll} className="text-xs text-indigo-600 hover:underline">全部已读</button>
                  </div>
                  {notifs.length === 0 ? (
                    <div className="p-6 text-center text-gray-400 text-sm">暂无通知</div>
                  ) : (
                    notifs.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 border-b border-gray-50 text-sm ${n.is_read ? 'text-gray-500' : 'bg-indigo-50'}`}
                      >
                        <p className="line-clamp-2">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{n.created_at}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div className="text-sm">
                <div className="font-medium text-gray-800">{user?.name}</div>
                <div className="text-xs text-gray-500">
                  {user?.role === 'admin' ? '管理员' : '签署人'}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition"
                title="退出"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
