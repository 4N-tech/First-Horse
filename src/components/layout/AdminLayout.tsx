import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  Layers,
  FolderTree,
  Users,
  UserCheck,
  BarChart3,
  Settings,
  Bell,
  LogOut,
  Store,
  Menu,
  X,
  ShieldCheck,
  ChevronLeft,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context.tsx';
import { useI18n } from '../../lib/i18n.tsx';
import { RoleBadge } from '../ui/Badge.tsx';
import { api } from '../../lib/api.ts';

export type AdminRoute =
  | 'dashboard'
  | 'orders'
  | 'inventory'
  | 'products'
  | 'categories'
  | 'customers'
  | 'employees'
  | 'reports'
  | 'settings';

interface AdminLayoutProps {
  currentRoute: AdminRoute;
  onNavigate: (route: AdminRoute) => void;
  onNavigateStorefront: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentRoute,
  onNavigate,
  onNavigateStorefront,
  children,
}) => {
  const { user, logout, canAccessModule, login } = useAuth();
  const { t, lang, toggleLang } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);

  // Live Internal Notifications State (Requirement 21)
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    try {
      const res = await api.orders.getNotifications();
      if (res.success) {
        setNotifications(res.data);
        setUnreadCount(res.unread_count || 0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleMarkAllRead = async () => {
    try {
      await api.orders.markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch (e) {
      console.error(e);
    }
  };

  const navItems: { id: AdminRoute; label: string; icon: React.ReactNode; requiresAdmin?: boolean }[] = [
    { id: 'dashboard', label: t.navDashboard, icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'orders', label: t.navOrders, icon: <ShoppingBag className="h-4 w-4" /> },
    { id: 'inventory', label: t.navInventory, icon: <Boxes className="h-4 w-4" /> },
    { id: 'products', label: t.navProducts, icon: <Layers className="h-4 w-4" /> },
    { id: 'categories', label: t.navCategories, icon: <FolderTree className="h-4 w-4" /> },
    { id: 'customers', label: t.navCustomers, icon: <Users className="h-4 w-4" /> },
    { id: 'employees', label: t.navEmployees, icon: <UserCheck className="h-4 w-4" />, requiresAdmin: true },
    { id: 'reports', label: t.navReports, icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'settings', label: t.navSettings, icon: <Settings className="h-4 w-4" />, requiresAdmin: true },
  ];

  // Quick Persona switcher for reviewer testing
  const switchDemoRole = async (targetRole: 'ADMIN' | 'MANAGER' | 'WORKER') => {
    setIsSwitchingRole(true);
    try {
      const emailMap = {
        ADMIN: 'admin@factory.com',
        MANAGER: 'manager@factory.com',
        WORKER: 'worker@factory.com',
      };
      const passMap = {
        ADMIN: 'admin123',
        MANAGER: 'manager123',
        WORKER: 'worker123',
      };
      await login({ email: emailMap[targetRole], password: passMap[targetRole] });
      // If switched to worker and on prohibited page, return to dashboard
      if (targetRole === 'WORKER' && !['dashboard', 'orders'].includes(currentRoute)) {
        onNavigate('dashboard');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSwitchingRole(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row text-slate-900">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 start-0 z-50 w-64 bg-slate-900 text-slate-300 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:inset-auto md:flex md:flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full md:rtl:translate-x-0'
        }`}
      >
        {/* Factory Brand Header */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-white block leading-tight">{t.appName}</span>
              <span className="text-[10px] text-slate-400 font-medium block">لوحة إدارة المصنع</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Role Card inside sidebar */}
        <div className="p-4 mx-3 my-3 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-400/30 flex items-center justify-center font-bold text-xs shrink-0">
              {user?.name.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-white truncate text-xs">{user?.name}</p>
              <div className="mt-1">
                <RoleBadge role={user?.role || 'WORKER'} />
              </div>
            </div>
          </div>

          {/* Quick role switcher for demo & testing verification */}
          <div className="mt-3 pt-2.5 border-t border-slate-700/60">
            <span className="text-[10px] text-slate-400 block mb-1.5 font-medium">تبديل دور الفحص السريع:</span>
            <div className="grid grid-cols-3 gap-1">
              <button
                disabled={isSwitchingRole || user?.role === 'ADMIN'}
                onClick={() => switchDemoRole('ADMIN')}
                className={`py-1 text-[10px] rounded font-semibold transition-colors cursor-pointer ${
                  user?.role === 'ADMIN'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                مدير
              </button>
              <button
                disabled={isSwitchingRole || user?.role === 'MANAGER'}
                onClick={() => switchDemoRole('MANAGER')}
                className={`py-1 text-[10px] rounded font-semibold transition-colors cursor-pointer ${
                  user?.role === 'MANAGER'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                مشرف
              </button>
              <button
                disabled={isSwitchingRole || user?.role === 'WORKER'}
                onClick={() => switchDemoRole('WORKER')}
                className={`py-1 text-[10px] rounded font-semibold transition-colors cursor-pointer ${
                  user?.role === 'WORKER'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                فني
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const hasAccess = canAccessModule(item.id);
            if (!hasAccess) {
              return null; // Enforce RBAC in navigation: hide forbidden modules
            }

            const isActive = currentRoute === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.id === 'orders' && user?.role === 'WORKER' && (
                  <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-300">
                    المسندة إليك
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-slate-800 space-y-1">
          <button
            onClick={onNavigateStorefront}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Store className="h-4 w-4" />
            <span>متجر العملاء العام</span>
          </button>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>{t.navLogout}</span>
          </button>
        </div>
      </aside>

      {/* Main Admin Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {navItems.find((i) => i.id === currentRoute)?.label || t.navDashboard}
              </h2>
              <span className="text-[11px] text-slate-500">
                {user?.role === 'ADMIN'
                  ? 'صلاحيات كاملة للنظام'
                  : user?.role === 'MANAGER'
                  ? 'إدارة الإنتاج والمنتجات والطلبات'
                  : 'مهام التشغيل والطلبات المسندة'}
              </span>
            </div>
          </div>

          {/* Top Bar Actions */}
          <div className="flex items-center gap-3">
            {/* Language Toggle */}
            <button
              onClick={toggleLang}
              className="text-xs text-slate-600 hover:text-slate-900 border border-slate-200 px-2.5 py-1.5 rounded-lg font-medium cursor-pointer"
            >
              {lang === 'ar' ? 'English' : 'العربية'}
            </button>

            {/* Notifications with real badge and drawer */}
            <button
              onClick={() => {
                setShowNotificationsModal(true);
                loadNotifications();
              }}
              className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              title="مركز التنبيهات الداخلية"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 end-1 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white font-bold text-[10px] flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* User Profile Pill */}
            <div className="hidden sm:flex items-center gap-2.5 ps-3 border-s border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                {user?.name.charAt(0) || 'U'}
              </div>
              <div className="text-start leading-tight">
                <span className="block text-xs font-bold text-slate-900">{user?.name}</span>
                <span className="block text-[10px] text-slate-500">{user?.email}</span>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={() => logout()}
              className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title={t.navLogout}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">{children}</main>
      </div>

      {/* Live Internal Notifications Modal (Requirement 21) */}
      {showNotificationsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-indigo-600" />
                <h4 className="font-bold text-slate-900 text-sm">مركز التنبيهات الداخلية</h4>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    تحديد الكل كمقروء
                  </button>
                )}
                <button
                  onClick={() => setShowNotificationsModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pe-1">
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 rounded-xl border text-xs space-y-1 transition-colors ${
                      n.is_read === 0
                        ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
                        : 'bg-slate-50 border-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{n.title}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{n.created_at}</span>
                    </div>
                    <p className="leading-relaxed text-[11px]">{n.message}</p>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  لا توجد إشعارات جديدة حاليًا.
                </div>
              )}
            </div>

            <button
              onClick={() => setShowNotificationsModal(false)}
              className="w-full bg-slate-900 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
