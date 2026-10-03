import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  User,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Shirt,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UserCheck,
  RefreshCw,
  Send,
  Layers,
  ChevronRight,
  Check,
  AlertCircle,
  Tag,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context.tsx';
import { useI18n } from '../../lib/i18n.tsx';
import { Order, OrderStatus, User as UserType, ORDER_STATUS_LABELS_AR } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { OrderStatusBadge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';

// Allowed normal workflow state machine
const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY', 'CANCELLED'],
  READY: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

const ALL_STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'READY',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

interface AdminOrderDetailPageProps {
  orderNumber: string;
  onBack: () => void;
}

export const AdminOrderDetailPage: React.FC<AdminOrderDetailPageProps> = ({ orderNumber, onBack }) => {
  const { user } = useAuth();
  const { t, lang } = useI18n();

  const [order, setOrder] = useState<Order | null>(null);
  const [workers, setWorkers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status Change Modal State
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<OrderStatus>('CONFIRMED');
  const [statusNote, setStatusNote] = useState('');
  const [isAdminOverride, setIsAdminOverride] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Assign Worker Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [targetWorkerId, setTargetWorkerId] = useState<string>('');
  const [assignNote, setAssignNote] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Feedback banner
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  const ArrowIcon = lang === 'ar' ? ArrowRight : ArrowLeft;

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.orders.getByNumber(orderNumber);
      if (res.success && res.data) {
        setOrder(res.data);
      } else {
        setError('تعذر العثور على بيانات الطلب');
      }

      if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
        const workersRes = await api.employees.getAssignableWorkers().catch(() => ({ success: false, data: [] }));
        if (workersRes.success) {
          setWorkers(workersRes.data);
        }
      }
    } catch (err: any) {
      setError(err.message || 'فشل في تحميل تفاصيل الطلب');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [orderNumber]);

  if (isLoading) return <LoadingState message="جاري تحميل ملف وتفاصيل الطلب..." />;
  if (error || !order) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={onBack} icon={<ArrowIcon className="h-4 w-4" />}>
          الرجوع لقائمة الطلبات
        </Button>
        <ErrorState title="خطأ في تحميل الطلب" message={error || 'الطلب غير موجود'} onRetry={loadData} />
      </div>
    );
  }

  // Determine allowed transitions for current user
  const normalAllowed = ALLOWED_STATUS_TRANSITIONS[order.status] || [];
  const isWorker = user?.role === 'WORKER';
  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';

  // Open Status Change Modal
  const handleOpenStatusModal = () => {
    // Default target status to first normal allowed or current
    if (normalAllowed.length > 0) {
      setTargetStatus(normalAllowed[0]);
    } else {
      setTargetStatus(order.status);
    }
    setStatusNote('');
    setIsAdminOverride(false);
    setIsStatusModalOpen(true);
  };

  // Submit Status Change
  const handleSubmitStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    setIsUpdatingStatus(true);
    try {
      const res = await api.orders.updateStatus(order.id, targetStatus, statusNote, isAdminOverride);
      if (res.success) {
        setOrder(res.data);
        setIsStatusModalOpen(false);
        setSuccessFeedback(`تم تحديث حالة الطلب إلى (${ORDER_STATUS_LABELS_AR[targetStatus] || targetStatus}) وتسجيلها بنجاح.`);
        setTimeout(() => setSuccessFeedback(null), 5000);
      }
    } catch (err: any) {
      alert(err.message || 'فشل في تحديث حالة الطلب');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Open Assign Worker Modal
  const handleOpenAssignModal = () => {
    setTargetWorkerId(order.assigned_to ? String(order.assigned_to) : '');
    setAssignNote('');
    setIsAssignModalOpen(true);
  };

  // Submit Worker Assignment
  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    setIsAssigning(true);
    try {
      const workerVal = targetWorkerId ? Number(targetWorkerId) : null;
      const res = await api.orders.assignWorker(order.id, workerVal, assignNote);
      if (res.success) {
        if (res.data) setOrder(res.data);
        else await loadData();
        setIsAssignModalOpen(false);
        setSuccessFeedback('تم تحديث إسناد فني التشغيل المسؤول وحفظ السجل الزمني.');
        setTimeout(() => setSuccessFeedback(null), 5000);
      }
    } catch (err: any) {
      alert(err.message || 'فشل في إسناد الموظف');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <button onClick={onBack} className="hover:text-indigo-600 transition-colors cursor-pointer">
              إدارة الطلبات
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400 rtl:rotate-180" />
            <span className="text-slate-800 font-mono">#{order.order_number}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              #{order.order_number}
            </h1>
            <OrderStatusBadge status={order.status} size="md" />
            {order.assigned_worker_is_active === 0 && (
              <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                الموظف غير نشط
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Change Button */}
          {(isAdmin || isManager || (isWorker && normalAllowed.length > 0)) && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenStatusModal}
              icon={<Clock className="h-4 w-4" />}
            >
              تحديث الحالة
            </Button>
          )}

          {/* Assign Worker Button (Admin & Manager only) */}
          {(isAdmin || isManager) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenAssignModal}
              icon={<UserCheck className="h-4 w-4" />}
            >
              {order.assigned_to ? 'إعادة إسناد فني' : 'إسناد فني تشغيل'}
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={onBack} icon={<ArrowIcon className="h-4 w-4" />}>
            رجوع
          </Button>
        </div>
      </div>

      {successFeedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successFeedback}</span>
          </div>
          <button onClick={() => setSuccessFeedback(null)} className="text-emerald-700 text-xs hover:underline cursor-pointer">
            إغلاق
          </button>
        </div>
      )}

      {/* Main Grid: 2 columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Order Information & Products */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Order Key Information Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" />
                <span>معلومات الطلب الأساسية (Order Information)</span>
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">ID: {order.id}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">رقم الطلب</span>
                <span className="font-mono font-bold text-indigo-700 text-sm block mt-0.5">
                  #{order.order_number}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">تاريخ الطلب</span>
                <span className="font-semibold text-slate-800 block mt-0.5">
                  {order.created_at}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">الحالة الحالية</span>
                <div className="mt-1">
                  <OrderStatusBadge status={order.status} />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">الموظف المسؤول</span>
                <div className="mt-0.5">
                  {order.assigned_worker_name ? (
                    <div>
                      <span className="font-bold text-slate-900 block">{order.assigned_worker_name}</span>
                      {order.assigned_worker_is_active === 0 && (
                        <span className="text-[10px] text-red-600 font-bold block">حساب معطل</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400 italic font-medium">-- غير مسند --</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Customer Information Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="h-4 w-4 text-indigo-600" />
              <span>بيانات العميل والشحن (Customer & Shipping)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 text-[11px]">اسم العميل</span>
                <p className="font-bold text-slate-900 text-sm">{order.customer_name || 'عميل نقدي'}</p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 text-[11px]">رقم الهاتف</span>
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${order.customer_phone}`}
                    className="font-mono font-bold text-indigo-600 hover:underline inline-flex items-center gap-1.5"
                  >
                    <Phone className="h-3.5 w-3.5 text-indigo-500" />
                    <span>{order.customer_phone}</span>
                  </a>
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1 pt-2 border-t border-slate-100">
                <span className="text-slate-400 text-[11px] flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-slate-400" />
                  <span>عنوان التوصيل</span>
                </span>
                <p className="font-semibold text-slate-800 text-xs leading-relaxed">
                  {order.governorate && `${order.governorate} — `}
                  {order.city && `${order.city} — `}
                  {order.address || order.customer_address || 'لم يتم تسجيل تفاصيل العنوان'}
                </p>
              </div>

              {order.customer_notes && (
                <div className="sm:col-span-2 p-3 bg-amber-50/70 rounded-xl border border-amber-200/70 text-amber-900 text-xs">
                  <span className="font-bold block mb-1">ملاحظات العميل:</span>
                  <p className="leading-relaxed">{order.customer_notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* 3. Products Snapshot Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Shirt className="h-4 w-4 text-indigo-600" />
                <span>المنتجات والبنود (Order Items Snapshots)</span>
              </h2>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                إجمالي القطع: {order.items?.reduce((s, i) => s + i.quantity, 0) || order.total_pieces || 0}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 text-slate-500 text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-start">المنتج (نسخة ثابتة)</th>
                    <th className="p-3 text-start">المتغير (المقاس / اللون)</th>
                    <th className="p-3 text-center">الكمية</th>
                    <th className="p-3 text-end">سعر الوحدة</th>
                    <th className="p-3 text-end">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.product_name_snapshot} className="w-full h-full object-cover" />
                              ) : (
                                <Layers className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">
                              {item.product_name_snapshot}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-slate-600 font-mono text-xs">
                          {item.variant_snapshot}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-900">
                          {item.quantity}
                        </td>
                        <td className="p-3 text-end text-slate-700 font-mono">
                          {item.unit_price} {t.priceCurrency}
                        </td>
                        <td className="p-3 text-end font-bold text-slate-900 font-mono">
                          {item.total_price} {t.priceCurrency}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        لا توجد بنود مسجلة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <div className="w-full sm:w-72 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>إجمالي المنتجات (Subtotal):</span>
                  <span className="font-mono font-bold text-slate-900">{order.subtotal} {t.priceCurrency}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>مصاريف الشحن (Delivery Fee):</span>
                  <span className="font-mono font-semibold text-emerald-600">
                    {order.delivery_fee === 0 ? '0 (مجانًا)' : `${order.delivery_fee} ${t.priceCurrency}`}
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-2 border-t border-slate-200 text-slate-900 font-bold">
                  <span className="text-sm">المبلغ الإجمالي (Total):</span>
                  <span className="text-lg font-black text-indigo-700 font-mono">
                    {order.total} {t.priceCurrency}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Status & Assignment Timeline Histories */}
        <div className="space-y-6">
          {/* Quick Actions Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2.5">
              الإجراءات التشغيلية
            </h3>

            <div className="space-y-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleOpenStatusModal}
                className="w-full text-xs font-bold"
                icon={<Clock className="h-4 w-4" />}
              >
                تحديث حالة الطلب
              </Button>

              {(isAdmin || isManager) && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleOpenAssignModal}
                  className="w-full text-xs font-bold"
                  icon={<UserCheck className="h-4 w-4" />}
                >
                  {order.assigned_to ? 'تغيير فني التشغيل' : 'إسناد إلى فني تشغيل'}
                </Button>
              )}
            </div>
          </div>

          {/* 4. Status History Timeline (Requirement 6) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-600" />
                <span>سجل الحالات الزمني (Status History)</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-semibold">
                {order.status_history?.length || 0} سجلات
              </span>
            </div>

            {order.status_history && order.status_history.length > 0 ? (
              <div className="relative ps-6 space-y-4 before:absolute before:top-2 before:bottom-2 before:start-2.5 before:w-0.5 before:bg-slate-200">
                {order.status_history.map((hist) => (
                  <div key={hist.id} className="relative text-xs space-y-1">
                    {/* Circle Dot */}
                    <span className="absolute -start-6 top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-indigo-50" />

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                        {hist.old_status && (
                          <>
                            <span className="text-slate-500 font-medium">
                              {ORDER_STATUS_LABELS_AR[hist.old_status as OrderStatus] || hist.old_status}
                            </span>
                            <span className="text-slate-300">←</span>
                          </>
                        )}
                        <span className="text-indigo-700">
                          {ORDER_STATUS_LABELS_AR[hist.new_status as OrderStatus] || hist.new_status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{hist.created_at}</span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <span>بواسطة:</span>
                      <span className="font-semibold text-slate-700">{hist.changed_by_name || 'النظام'}</span>
                      {hist.changed_by_role && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                          {hist.changed_by_role}
                        </span>
                      )}
                      {hist.is_override ? (
                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1 rounded font-bold">
                          تجاوز إداري
                        </span>
                      ) : null}
                    </div>

                    {hist.note && (
                      <p className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-slate-700 text-[11px] leading-relaxed mt-1">
                        "{hist.note}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">
                لا توجد سجلات تاريخية سابقة لتغيير الحالة
              </p>
            )}
          </div>

          {/* 5. Assignment History Timeline (Requirement 13) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-indigo-600" />
                <span>سجل إسناد الموظفين (Assignment History)</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-semibold">
                {order.assignment_history?.length || 0} سجلات
              </span>
            </div>

            {order.assignment_history && order.assignment_history.length > 0 ? (
              <div className="relative ps-6 space-y-4 before:absolute before:top-2 before:bottom-2 before:start-2.5 before:w-0.5 before:bg-slate-200">
                {order.assignment_history.map((assign) => (
                  <div key={assign.id} className="relative text-xs space-y-1">
                    <span className="absolute -start-6 top-1 w-2.5 h-2.5 rounded-full bg-emerald-600 ring-4 ring-emerald-50" />

                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-slate-900">
                        {assign.new_employee_name ? (
                          <span>إسناد إلى: <span className="text-emerald-700 font-black">{assign.new_employee_name}</span></span>
                        ) : (
                          <span className="text-slate-500">إلغاء الإسناد</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{assign.created_at}</span>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      <span>بواسطة:</span>{' '}
                      <span className="font-semibold text-slate-700">{assign.assigned_by_name || 'المدير'}</span>
                    </div>

                    {assign.previous_employee_name && (
                      <div className="text-[10px] text-slate-400">
                        المسؤول السابق: {assign.previous_employee_name}
                      </div>
                    )}

                    {assign.note && (
                      <p className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-slate-700 text-[11px] leading-relaxed mt-1">
                        "{assign.note}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">
                لم يتم إسناد هذا الطلب بعد
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Update Order Status */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={`تحديث حالة الطلب: #${order.order_number}`}
        maxWidth="md"
      >
        <form onSubmit={handleSubmitStatusChange} className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-400 block text-[11px]">الحالة الحالية:</span>
            <div className="flex items-center gap-2">
              <OrderStatusBadge status={order.status} size="md" />
              <span className="text-slate-400 text-xs font-mono">({order.status})</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5">
              الحالة الجديدة المطلوبة:
            </label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as OrderStatus)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:ring-1 focus:ring-indigo-500"
            >
              {ALL_STATUSES.map((st) => {
                const isNormal = normalAllowed.includes(st);
                return (
                  <option key={st} value={st}>
                    {ORDER_STATUS_LABELS_AR[st]} ({st}) {isNormal ? '— مسار طبيعي' : isAdmin ? '— تجاوز إداري' : '— غير متاح'}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Warning if transition is non-standard */}
          {!normalAllowed.includes(targetStatus) && targetStatus !== order.status && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>تنبيه: مسار غير قياسي</span>
              </div>
              <p>
                الانتقال من ({ORDER_STATUS_LABELS_AR[order.status]}) إلى ({ORDER_STATUS_LABELS_AR[targetStatus]}) خارج التسلسل الطبيعي.
                {isAdmin ? ' بصفتك المدير العام، سيتم تسجيل هذه العملية كتجاوز إداري معتمد (Admin Override).' : ' هذا الانتقال غير مسموح لدورك.'}
              </p>
            </div>
          )}

          {isAdmin && (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isAdminOverride}
                onChange={(e) => setIsAdminOverride(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>تأكيد كإجراء تجاوز إداري معتمد (Force Override)</span>
            </label>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1">
              ملاحظة التحديث (اختياري — تحفظ في السجل الزمني):
            </label>
            <textarea
              rows={2}
              placeholder="مثال: تم التأكيد مع العميل هاتفياً، أو تم الانتهاء من فحص الجودة والمقاسات..."
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsStatusModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={isUpdatingStatus}>
              حفظ الحالة في السجل الزمني
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Assign Worker */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`إسناد فني التشغيل: #${order.order_number}`}
        maxWidth="md"
      >
        <form onSubmit={handleSubmitAssignment} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5">
              اختر فني التشغيل المسؤول (Workers فقط):
            </label>
            <select
              value={targetWorkerId}
              onChange={(e) => setTargetWorkerId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">-- بدون إسناد (إلغاء التعيين) --</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.role}) {w.is_active === 0 ? '- [غير نشط]' : ''}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-400 mt-1 block">
              يُسمح فقط بإسناد الطلبات للموظفين أصحاب الحسابات النشطة.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1">
              ملاحظة الإسناد أو التوزيع (اختياري):
            </label>
            <textarea
              rows={2}
              placeholder="مثال: تسليم خط التشغيل رقم 2، أولوية تسليم اليوم..."
              value={assignNote}
              onChange={(e) => setAssignNote(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsAssignModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={isAssigning}>
              تأكيد الإسناد
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
