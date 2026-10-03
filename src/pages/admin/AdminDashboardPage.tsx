import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Clock,
  Layers,
  Users,
  ShieldAlert,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Check,
  Truck,
  XCircle,
  UserCheck,
  ChevronRight,
  Eye,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context.tsx';
import { useI18n } from '../../lib/i18n.tsx';
import { api } from '../../lib/api.ts';
import { DashboardKPIs, Order, User as UserType } from '../../types/index.ts';
import { Card } from '../../components/ui/Card.tsx';
import { RoleBadge, OrderStatusBadge } from '../../components/ui/Badge.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';
import { AdminRoute } from '../../components/layout/AdminLayout.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Modal } from '../../components/ui/Modal.tsx';

interface AdminDashboardPageProps {
  onNavigate: (route: AdminRoute) => void;
  onSelectOrder?: (orderNumber: string) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onNavigate, onSelectOrder }) => {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [workers, setWorkers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick Assign Modal
  const [selectedUnassignedOrder, setSelectedUnassignedOrder] = useState<Order | null>(null);
  const [targetWorkerId, setTargetWorkerId] = useState<string>('');
  const [assignNote, setAssignNote] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadKPIs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.dashboard.getKPIs();
      if (res.success && res.data) {
        setKpis(res.data);
      }

      if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
        const workersRes = await api.employees.getAssignableWorkers().catch(() => ({ success: false, data: [] }));
        if (workersRes.success) {
          setWorkers(workersRes.data);
        }
      }
    } catch (err: any) {
      setError(err.message || 'فشل في تحميل مؤشرات لوحة التحكم');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKPIs();
  }, [user?.role]);

  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  const handleOpenAssignModal = (ord: Order) => {
    setSelectedUnassignedOrder(ord);
    setTargetWorkerId('');
    setAssignNote('');
  };

  const handleConfirmAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnassignedOrder || !targetWorkerId) return;

    setIsAssigning(true);
    try {
      const res = await api.orders.assignWorker(selectedUnassignedOrder.id, Number(targetWorkerId), assignNote);
      if (res.success) {
        setActionSuccess(`تم إسناد الطلب #${selectedUnassignedOrder.order_number} بنجاح.`);
        setTimeout(() => setActionSuccess(null), 4000);
        setSelectedUnassignedOrder(null);
        await loadKPIs();
      }
    } catch (err: any) {
      alert(err.message || 'فشل إسناد الطلب');
    } finally {
      setIsAssigning(false);
    }
  };

  if (isLoading) return <LoadingState message="جاري تجهيز مؤشرات ومخططات المصنع..." />;
  if (error) return <ErrorState message={error} onRetry={loadKPIs} />;

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
              ? 'لديك صلاحيات كاملة لإدارة كتالوج المنتجات، خطوط الإنتاج، إسناد الطلبات، وإدارة حسابات الموظفين.'
              : 'يمكنك متابعة وتوزيع دورة حياة الطلبات والتحقق من سير العمل وتحديث الحالات.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('orders')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-md shadow-indigo-600/30"
          >
            <span>إدارة جميع الطلبات</span>
            <ArrowIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 text-xs hover:underline cursor-pointer">
            إغلاق
          </button>
        </div>
      )}

      {/* 6 Required Order KPIs (Requirement 19) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* KPI 1: Total Orders */}
        <Card hoverable className="border-s-4 border-s-slate-800 p-3.5">
          <p className="text-[11px] font-bold text-slate-500">إجمالي الطلبات</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">{kpis?.total_orders ?? 0}</h3>
          <span className="text-[10px] text-slate-400 mt-0.5 block">كل السجلات</span>
        </Card>

        {/* KPI 2: New Orders (Pending) */}
        <Card hoverable className="border-s-4 border-s-amber-500 p-3.5">
          <p className="text-[11px] font-bold text-amber-700">طلبات جديدة</p>
          <h3 className="text-2xl font-black text-amber-600 mt-1">{kpis?.pending_orders ?? 0}</h3>
          <span className="text-[10px] text-amber-600 mt-0.5 block">معلقة (PENDING)</span>
        </Card>

        {/* KPI 3: Processing (Confirmed + Processing) */}
        <Card hoverable className="border-s-4 border-s-indigo-600 p-3.5">
          <p className="text-[11px] font-bold text-indigo-700">قيد التجهيز</p>
          <h3 className="text-2xl font-black text-indigo-600 mt-1">{kpis?.processing_orders ?? 0}</h3>
          <span className="text-[10px] text-indigo-600 mt-0.5 block">تجهيز وتشغيل</span>
        </Card>

        {/* KPI 4: Ready */}
        <Card hoverable className="border-s-4 border-s-emerald-500 p-3.5">
          <p className="text-[11px] font-bold text-emerald-700">جاهزة</p>
          <h3 className="text-2xl font-black text-emerald-600 mt-1">{kpis?.ready_orders ?? 0}</h3>
          <span className="text-[10px] text-emerald-600 mt-0.5 block">جاهزة للشحن</span>
        </Card>

        {/* KPI 5: Delivered */}
        <Card hoverable className="border-s-4 border-s-teal-600 p-3.5">
          <p className="text-[11px] font-bold text-teal-700">تم التسليم</p>
          <h3 className="text-2xl font-black text-teal-700 mt-1">{kpis?.delivered_orders ?? 0}</h3>
          <span className="text-[10px] text-teal-600 mt-0.5 block">مكتملة وناجحة</span>
        </Card>

        {/* KPI 6: Cancelled */}
        <Card hoverable className="border-s-4 border-s-rose-500 p-3.5">
          <p className="text-[11px] font-bold text-rose-700">ملغاة</p>
          <h3 className="text-2xl font-black text-rose-600 mt-1">{kpis?.cancelled_orders ?? 0}</h3>
          <span className="text-[10px] text-rose-500 mt-0.5 block">طلبات ملغية</span>
        </Card>
      </div>

      {/* Two Critical Tables Grid (Requirement 19: Unassigned Orders + Latest 10 Orders) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: الطلبات غير المسندة (Unassigned Orders) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">الطلبات غير المسندة</h3>
                <p className="text-[11px] text-slate-400">بانتظار تعيين فني تشغيل وخياطة للمتابعة</p>
              </div>
            </div>

            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
              {kpis?.unassigned_orders_count ?? 0} طلب
            </span>
          </div>

          <div className="overflow-x-auto">
            {kpis?.unassigned_orders && kpis.unassigned_orders.length > 0 ? (
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 text-slate-500 text-[11px]">
                  <tr>
                    <th className="p-2.5 text-start">رقم الطلب</th>
                    <th className="p-2.5 text-start">العميل</th>
                    <th className="p-2.5 text-center">القطع</th>
                    <th className="p-2.5 text-end">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kpis.unassigned_orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-indigo-700">
                        #{ord.order_number}
                      </td>
                      <td className="p-2.5 font-medium text-slate-800 truncate max-w-[120px]">
                        {ord.customer_name}
                      </td>
                      <td className="p-2.5 text-center font-bold text-slate-700">
                        {ord.total_pieces}
                      </td>
                      <td className="p-2.5 text-end">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleOpenAssignModal(ord)}
                          className="text-[11px] py-1 px-2.5"
                          icon={<UserCheck className="h-3 w-3" />}
                        >
                          إسناد
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-center text-slate-400 space-y-1">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto" />
                <p className="text-xs font-bold text-slate-700">جميع الطلبات تم إسنادها.</p>
                <p className="text-[11px] text-slate-400">لا توجد طلبات معلقة بدون فني مسؤول.</p>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: آخر الطلبات (Latest 10 Orders) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">آخر الطلبات (Latest Orders)</h3>
                <p className="text-[11px] text-slate-400">أحدث 10 طلبات مسجلة في المصنع</p>
              </div>
            </div>

            <button
              onClick={() => onNavigate('orders')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>عرض الكل</span>
              <ChevronRight className="h-3 w-3 rtl:rotate-180" />
            </button>
          </div>

          <div className="overflow-x-auto">
            {kpis?.latest_orders && kpis.latest_orders.length > 0 ? (
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 text-slate-500 text-[11px]">
                  <tr>
                    <th className="p-2.5 text-start">رقم الطلب</th>
                    <th className="p-2.5 text-start">العميل</th>
                    <th className="p-2.5 text-center">الحالة</th>
                    <th className="p-2.5 text-end">الإجمالي</th>
                    <th className="p-2.5 text-end">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kpis.latest_orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-indigo-700">
                        #{ord.order_number}
                      </td>
                      <td className="p-2.5 font-medium text-slate-800 truncate max-w-[110px]">
                        {ord.customer_name}
                      </td>
                      <td className="p-2.5 text-center">
                        <OrderStatusBadge status={ord.status} />
                      </td>
                      <td className="p-2.5 text-end font-mono font-bold text-slate-900">
                        {ord.total} ج.م
                      </td>
                      <td className="p-2.5 text-end">
                        <button
                          onClick={() => onSelectOrder ? onSelectOrder(ord.order_number) : onNavigate('orders')}
                          className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                          title="عرض تفاصيل الطلب"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-center text-slate-400 space-y-1">
                <ShoppingBag className="h-6 w-6 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">لا توجد طلبات حاليًا.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Assign Modal */}
      {selectedUnassignedOrder && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedUnassignedOrder(null)}
          title={`إسناد الطلب: #${selectedUnassignedOrder.order_number}`}
          maxWidth="sm"
        >
          <form onSubmit={handleConfirmAssignment} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1.5">
                اختر فني التشغيل المسؤول (Workers):
              </label>
              <select
                value={targetWorkerId}
                onChange={(e) => setTargetWorkerId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:ring-1 focus:ring-indigo-500"
                required
              >
                <option value="">-- اختر الموظف --</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.is_active === 0 ? '- [غير نشط]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">
                ملاحظة الإسناد (اختياري):
              </label>
              <textarea
                rows={2}
                placeholder="تعليمات خاصة لفني التشغيل على خط الإنتاج..."
                value={assignNote}
                onChange={(e) => setAssignNote(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setSelectedUnassignedOrder(null)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" isLoading={isAssigning} disabled={!targetWorkerId}>
                تأكيد الإسناد
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
