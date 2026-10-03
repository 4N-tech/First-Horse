import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  Eye,
  User,
  Calendar,
  Check,
  AlertCircle,
  RefreshCw,
  Filter,
  Search,
  UserCheck,
  Clock,
  ChevronRight,
  AlertTriangle,
  X
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context.tsx';
import { useI18n } from '../../lib/i18n.tsx';
import { Order, OrderStatus, User as UserType, ORDER_STATUS_LABELS_AR } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { Table, Column } from '../../components/ui/Table.tsx';
import { OrderStatusBadge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';

const ALL_STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'READY',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

interface AdminOrdersPageProps {
  onSelectOrder?: (orderNumber: string) => void;
}

export const AdminOrdersPage: React.FC<AdminOrdersPageProps> = ({ onSelectOrder }) => {
  const { user } = useAuth();
  const { t } = useI18n();

  const [orders, setOrders] = useState<Order[]>([]);
  const [workers, setWorkers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [workerFilter, setWorkerFilter] = useState<string>('');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');

  // Debounced search
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Quick Action Modals
  const [quickOrder, setQuickOrder] = useState<Order | null>(null);
  const [isQuickStatusModalOpen, setIsQuickStatusModalOpen] = useState(false);
  const [quickTargetStatus, setQuickTargetStatus] = useState<OrderStatus>('CONFIRMED');
  const [quickStatusNote, setQuickStatusNote] = useState('');
  const [isQuickAssignModalOpen, setIsQuickAssignModalOpen] = useState(false);
  const [quickTargetWorker, setQuickTargetWorker] = useState<string>('');
  const [quickAssignNote, setQuickAssignNote] = useState('');
  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Debounce search effect (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const loadOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.orders.getAll({
        status: statusFilter || undefined,
        assigned_to: workerFilter || undefined,
        date_range: dateRangeFilter || undefined,
        date_from: dateRangeFilter === 'custom' ? customDateFrom || undefined : undefined,
        date_to: dateRangeFilter === 'custom' ? customDateTo || undefined : undefined,
        search: debouncedSearch || undefined,
      });

      if (res.success) {
        setOrders(res.data);
      }

      if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
        const workersRes = await api.employees.getAssignableWorkers().catch(() => ({ success: false, data: [] }));
        if (workersRes.success) {
          setWorkers(workersRes.data);
        }
      }
    } catch (err: any) {
      setError(err.message || 'فشل في تحميل الطلبات');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter, workerFilter, dateRangeFilter, customDateFrom, customDateTo, debouncedSearch, user?.role]);

  // Reset all filters
  const handleResetFilters = () => {
    setStatusFilter('');
    setWorkerFilter('');
    setDateRangeFilter('');
    setCustomDateFrom('');
    setCustomDateTo('');
    setSearchInput('');
  };

  const hasActiveFilters = Boolean(
    statusFilter || workerFilter || dateRangeFilter || customDateFrom || customDateTo || searchInput
  );

  // Open Quick Status Modal
  const handleOpenQuickStatus = (order: Order) => {
    setQuickOrder(order);
    setQuickTargetStatus(order.status);
    setQuickStatusNote('');
    setIsQuickStatusModalOpen(true);
  };

  const handleSubmitQuickStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickOrder) return;

    setIsSubmittingQuick(true);
    try {
      const res = await api.orders.updateStatus(quickOrder.id, quickTargetStatus, quickStatusNote);
      if (res.success) {
        setActionSuccess(`تم تحديث حالة الطلب #${quickOrder.order_number} بنجاح`);
        setIsQuickStatusModalOpen(false);
        await loadOrders();
      }
    } catch (err: any) {
      alert(err.message || 'فشل تحديث الحالة');
    } finally {
      setIsSubmittingQuick(false);
    }
  };

  // Open Quick Assign Modal
  const handleOpenQuickAssign = (order: Order) => {
    setQuickOrder(order);
    setQuickTargetWorker(order.assigned_to ? String(order.assigned_to) : '');
    setQuickAssignNote('');
    setIsQuickAssignModalOpen(true);
  };

  const handleSubmitQuickAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickOrder) return;

    setIsSubmittingQuick(true);
    try {
      const workerVal = quickTargetWorker ? Number(quickTargetWorker) : null;
      const res = await api.orders.assignWorker(quickOrder.id, workerVal, quickAssignNote);
      if (res.success) {
        setActionSuccess(`تم تحديث إسناد الطلب #${quickOrder.order_number} بنجاح`);
        setIsQuickAssignModalOpen(false);
        await loadOrders();
      }
    } catch (err: any) {
      alert(err.message || 'فشل إسناد الطلب');
    } finally {
      setIsSubmittingQuick(false);
    }
  };

  // Table Columns (Requirement 1)
  const columns: Column<Order>[] = [
    {
      key: 'order_number',
      header: 'رقم الطلب',
      render: (o) => (
        <button
          onClick={() => onSelectOrder ? onSelectOrder(o.order_number) : null}
          className="font-mono font-bold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 hover:text-indigo-800 transition-colors px-2 py-1 rounded text-xs cursor-pointer inline-flex items-center gap-1"
          title="عرض تفاصيل الطلب كاملة"
        >
          <span>#{o.order_number}</span>
          <ChevronRight className="h-3 w-3 rtl:rotate-180" />
        </button>
      ),
    },
    {
      key: 'customer_name',
      header: 'اسم العميل',
      render: (o) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs truncate max-w-[140px]">
            {o.customer_name || 'عميل نقدي'}
          </span>
        </div>
      ),
    },
    {
      key: 'customer_phone',
      header: 'رقم الهاتف',
      render: (o) => (
        <span className="font-mono text-xs text-slate-600 block" dir="ltr">
          {o.customer_phone || '-'}
        </span>
      ),
    },
    {
      key: 'total_pieces',
      header: 'عدد القطع',
      align: 'center',
      render: (o) => (
        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full text-xs">
          {o.total_pieces || (o.items ? o.items.reduce((s, i) => s + i.quantity, 0) : 0)}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'الإجمالي',
      render: (o) => (
        <span className="font-mono font-bold text-slate-900 text-xs">
          {o.total} {t.priceCurrency}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (o) => (
        <div className="flex items-center gap-1.5">
          <OrderStatusBadge status={o.status} />
        </div>
      ),
    },
    {
      key: 'assigned_worker_name',
      header: 'الموظف المسؤول',
      render: (o) => {
        if (!o.assigned_worker_name) {
          return (
            <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium">
              غير مسند
            </span>
          );
        }

        return (
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-slate-900 block truncate max-w-[120px]">
              {o.assigned_worker_name}
            </span>
            {o.assigned_worker_is_active === 0 && (
              <span className="text-[10px] text-red-600 font-bold block">
                الموظف غير نشط
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'created_at',
      header: 'تاريخ الإنشاء',
      render: (o) => (
        <span className="text-[11px] text-slate-500 font-mono block">
          {o.created_at?.slice(0, 16) || '-'}
        </span>
      ),
    },
    {
      key: 'updated_at',
      header: 'آخر تحديث',
      render: (o) => (
        <span className="text-[11px] text-slate-400 font-mono block">
          {o.updated_at?.slice(0, 16) || '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      align: 'end',
      render: (o) => (
        <div className="flex items-center justify-end gap-1.5">
          {/* Quick status change button */}
          <button
            type="button"
            onClick={() => handleOpenQuickStatus(o)}
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
            title="تحديث سريع للحالة"
          >
            <Clock className="h-4 w-4" />
          </button>

          {/* Quick assign button */}
          {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
            <button
              type="button"
              onClick={() => handleOpenQuickAssign(o)}
              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
              title="إسناد فني التشغيل"
            >
              <UserCheck className="h-4 w-4" />
            </button>
          )}

          {/* View complete order details */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSelectOrder ? onSelectOrder(o.order_number) : null}
            icon={<Eye className="h-3.5 w-3.5" />}
          >
            التفاصيل
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">
            {user?.role === 'WORKER' ? 'طلبات خط التشغيل المسندة إليك' : 'إدارة ومتابعة طلبات المصنع'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {user?.role === 'WORKER'
              ? 'متابعة وتجهيز الطلبات الموكلة إليك خطوة بخطوة مع فحص المقاسات والكميات.'
              : 'نظام إدارة دورة حياة الطلبات، توزيع عمال التشغيل، وتتبع السجل الزمني للتحديثات.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadOrders}
            isLoading={isLoading}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            تحديث القائمة
          </Button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 text-xs hover:underline cursor-pointer">
            إغلاق
          </button>
        </div>
      )}

      {/* Advanced Filters Bar (Requirement 2 & 3) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-indigo-600" />
            <span>فلترة وبحث الطلبات (Filters & Search)</span>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-indigo-600 hover:text-indigo-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span>إعادة ضبط الفلاتر</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* 1. Debounced Search Input */}
          <div className="relative">
            <Search className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث برقم الطلب، اسم العميل، الهاتف..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full ps-9 pe-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* 2. Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">جميع الحالات</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABELS_AR[s]} ({s})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Worker Assignment Filter (Admin & Manager only) */}
          {user?.role !== 'WORKER' && (
            <div>
              <select
                value={workerFilter}
                onChange={(e) => setWorkerFilter(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">جميع الموظفين (المسند وغير المسند)</option>
                <option value="unassigned">⚠️ الطلبات غير المسندة فقط</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    المسند إلى: {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 4. Date Range Filter */}
          <div>
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">كل التواريخ</option>
              <option value="today">اليوم</option>
              <option value="yesterday">أمس</option>
              <option value="7days">آخر 7 أيام</option>
              <option value="this_month">هذا الشهر</option>
              <option value="custom">تاريخ مخصص...</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Picker when 'custom' is selected */}
        {dateRangeFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-semibold">من تاريخ:</span>
            <input
              type="date"
              value={customDateFrom}
              onChange={(e) => setCustomDateFrom(e.target.value)}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
            <span className="text-slate-500 font-semibold">إلى تاريخ:</span>
            <input
              type="date"
              value={customDateTo}
              onChange={(e) => setCustomDateTo(e.target.value)}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>
        )}
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <LoadingState message="جاري جلب الطلبات وفق الفلاتر المحددة..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadOrders} />
      ) : (
        <Table
          columns={columns}
          data={orders}
          keyExtractor={(o) => o.id}
          emptyMessage={
            hasActiveFilters
              ? 'لا توجد نتائج مطابقة لمعايير البحث والفلترة المحددة.'
              : user?.role === 'WORKER'
              ? 'لا توجد طلبات مسندة إليك.'
              : 'لا توجد طلبات حاليًا.'
          }
        />
      )}

      {/* Quick Status Modal */}
      {quickOrder && (
        <Modal
          isOpen={isQuickStatusModalOpen}
          onClose={() => setIsQuickStatusModalOpen(false)}
          title={`تحديث حالة الطلب: #${quickOrder.order_number}`}
          maxWidth="sm"
        >
          <form onSubmit={handleSubmitQuickStatus} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1.5">
                اختر الحالة الجديدة:
              </label>
              <select
                value={quickTargetStatus}
                onChange={(e) => setQuickTargetStatus(e.target.value as OrderStatus)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:ring-1 focus:ring-indigo-500"
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS_LABELS_AR[s]} ({s})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">
                ملاحظة (اختياري):
              </label>
              <textarea
                rows={2}
                placeholder="أضف ملاحظة توثق سبب التغيير في السجل الزمني..."
                value={quickStatusNote}
                onChange={(e) => setQuickStatusNote(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setIsQuickStatusModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmittingQuick}>
                تأكيد التحديث
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick Assign Modal */}
      {quickOrder && (
        <Modal
          isOpen={isQuickAssignModalOpen}
          onClose={() => setIsQuickAssignModalOpen(false)}
          title={`إسناد فني التشغيل للطلب: #${quickOrder.order_number}`}
          maxWidth="sm"
        >
          <form onSubmit={handleSubmitQuickAssign} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1.5">
                فني التشغيل المسند (Worker):
              </label>
              <select
                value={quickTargetWorker}
                onChange={(e) => setQuickTargetWorker(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- بدون إسناد (إلغاء التعيين) --</option>
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
                placeholder="تعليمات خاصة لفني التشغيل..."
                value={quickAssignNote}
                onChange={(e) => setQuickAssignNote(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setIsQuickAssignModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmittingQuick}>
                تأكيد الإسناد
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
