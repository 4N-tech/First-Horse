import React, { useState, useEffect } from 'react';
import { ShoppingBag, Clock, Layers, Users, ShieldAlert, ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../lib/auth-context.tsx';
import { useI18n } from '../../lib/i18n.tsx';
import { api } from '../../lib/api.ts';
import { DashboardKPIs } from '../../types/index.ts';
import { Card } from '../../components/ui/Card.tsx';
import { RoleBadge } from '../../components/ui/Badge.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';
import { AdminRoute } from '../../components/layout/AdminLayout.tsx';

interface AdminDashboardPageProps {
  onNavigate: (route: AdminRoute) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [isWorkerData, setIsWorkerData] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadKPIs() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.dashboard.getKPIs();
        if (res.success && res.data) {
          setKpis(res.data);
          setIsWorkerData(!!res.data.is_worker_view);
        }
      } catch (err: any) {
        setError(err.message || 'فشل في تحميل مؤشرات لوحة التحكم');
      } finally {
        setIsLoading(false);
      }
    }
    loadKPIs();
  }, [user?.role]);

  if (isLoading) return <LoadingState message="جاري تجهيز مؤشرات المصنع..." />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-6 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-indigo-300">أهلاً بك مجدداً</span>
            <RoleBadge role={user?.role || 'WORKER'} />
          </div>
          <h1 className="text-xl sm:text-2xl font-black">{user?.name}</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            {user?.role === 'ADMIN'
              ? 'لديك صلاحيات كاملة لإدارة المنتجات، خطوط الإنتاج، الموظفين، وضبط إعدادات المصنع.'
              : user?.role === 'MANAGER'
              ? 'يمكنك إدارة كتالوج المنتجات، التصنيفات، فحص دورة حياة الطلبات والعملاء، والتقارير الأساسية.'
              : 'يمكنك استعراض الطلبات المسندة إلى خط عملك فقط وتحديث حالات التشغيل خطوة بخطوة.'}
          </p>
        </div>

        <button
          onClick={() => onNavigate('orders')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
        >
          <span>{user?.role === 'WORKER' ? 'الطلبات المسندة لي' : 'متابعة الطلبات'}</span>
          <ArrowIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 4 Required KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Orders */}
        <Card hoverable className="border-s-4 border-s-indigo-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                {isWorkerData ? 'طلباتك المسندة' : t.totalOrders}
              </p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{kpis?.total_orders ?? 0}</h3>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {isWorkerData ? 'إجمالي الطلبات في مسار عملك' : 'مسجلة في قاعدة البيانات'}
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </div>
        </Card>

        {/* KPI 2: Pending Orders */}
        <Card hoverable className="border-s-4 border-s-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                {isWorkerData ? 'طلبات قيد المعالجة' : t.pendingOrders}
              </p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{kpis?.pending_orders ?? 0}</h3>
              <span className="text-[10px] text-amber-600 mt-0.5 block font-medium">تحتاج إلى متابعة وحالة</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </div>
        </Card>

        {/* KPI 3: Products */}
        <Card hoverable className="border-s-4 border-s-emerald-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">{t.totalProducts}</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{kpis?.total_products ?? 0}</h3>
              <span className="text-[10px] text-slate-400 mt-0.5 block">منتج مع متغيرات المقاس واللون</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
          </div>
        </Card>

        {/* KPI 4: Customers */}
        <Card hoverable className="border-s-4 border-s-sky-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                {isWorkerData ? 'طلبات مكتملة / جاهزة' : t.totalCustomers}
              </p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{kpis?.total_customers ?? 0}</h3>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {isWorkerData ? 'جاهزة للشحن والتسليم' : 'عملاء مسجلون بالطلبات'}
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Role & Permissions Security Verification Card */}
      <Card>
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-900">
              صلاحيات الدور الحالي المحققة برمجياً وقاعدياً (RBAC Architecture)
            </h3>
          </div>
          <span className="text-[11px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
            Role: {user?.role}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="font-bold text-slate-800 block mb-1">الوصول للطلبات:</span>
            <p className="text-slate-600 text-[11px]">
              {user?.role === 'WORKER'
                ? 'مقصور فقط على الطلبات المسندة إلى معرفك الشخصي. لا يمكنك رؤية طلبات العمال الآخرين.'
                : 'كامل: إمكانية فحص جميع الطلبات وتعيين عمال التشغيل وتعديل الحالات.'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="font-bold text-slate-800 block mb-1">المنتجات والتصنيفات:</span>
            <p className="text-slate-600 text-[11px]">
              {user?.role === 'WORKER'
                ? 'محظور تماماً من الواجهة والخادم (403 Forbidden).'
                : 'مصرح: إمكانية إنشاء وتعديل وحذف المنتجات والمتغيرات والتصنيفات.'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="font-bold text-slate-800 block mb-1">الموظفين وإعدادات النظام:</span>
            <p className="text-slate-600 text-[11px]">
              {user?.role === 'ADMIN'
                ? 'مصرح: إدارة حسابات الموظفين بالكامل وضبط إعدادات المصنع والعملة والمنطقة الزمنية.'
                : 'محظور أمنياً: لا يمكن للمشرف أو العامل الوصول لحسابات الإدارة أو الإعدادات الحرجة.'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
