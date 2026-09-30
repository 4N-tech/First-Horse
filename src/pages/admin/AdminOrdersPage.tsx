import React, { useState, useEffect } from 'react';
import { ShoppingBag, Eye, User, Calendar, Check, AlertCircle, RefreshCw, Filter } from 'lucide-react';
import { useAuth } from '../../lib/auth-context.tsx';
import { useI18n } from '../../lib/i18n.tsx';
import { Order, OrderStatus, User as UserType } from '../../types/index.ts';
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

export const AdminOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [workers, setWorkers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.orders.getAll({ status: statusFilter || undefined });
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
  }, [statusFilter, user?.role]);

  const handleUpdateStatus = async (orderId: number, newStatus: string) => {
    setIsUpdating(true);
    setActionSuccess(null);
    try {
      const res = await api.orders.updateStatus(orderId, newStatus);
      if (res.success) {
        setActionSuccess(`تم تغيير حالة الطلب بنجاح إلى (${newStatus})`);
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder({ ...selectedOrder, status: newStatus as OrderStatus });
        }
        await loadOrders();
      }
    } catch (err: any) {
      alert(err.message || 'فشل تحديث حالة الطلب');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssignWorker = async (orderId: number, workerId: number | null) => {
    setIsUpdating(true);
    try {
      const res = await api.orders.assignWorker(orderId, workerId);
      if (res.success) {
        setActionSuccess('تم تعيين فني التشغيل المسؤول بنجاح');
        await loadOrders();
      }
    } catch (err: any) {
      alert(err.message || 'فشل تعيين العامل');
    } finally {
      setIsUpdating(false);
    }
  };

  const viewOrderDetails = async (order: Order) => {
    setSelectedOrder(order);
    setIsDetailModalOpen(true);
    try {
      const full = await api.orders.getOne(order.id);
      if (full.success) {
        setSelectedOrder(full.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const columns: Column<Order>[] = [
    {
      key: 'order_number',
      header: 'رقم الطلب',
      render: (o) => (
        <span className="font-mono font-bold text-indigo-700 bg-indigo-50/70 px-2 py-1 rounded text-xs">
          {o.order_number}
        </span>
      ),
    },
    {
      key: 'customer_name',
      header: 'العميل',
      render: (o) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs">{o.customer_name || 'عميل نقدي'}</span>
          <span className="text-[11px] text-slate-500 font-mono">{o.customer_phone}</span>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'الإجمالي',
      render: (o) => (
        <span className="font-bold text-slate-900 text-xs">
          {o.total} {t.priceCurrency}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (o) => <OrderStatusBadge status={o.status} />,
    },
    {
      key: 'assigned_worker_name',
      header: 'فني التشغيل المسند',
      render: (o) => {
        if (user?.role === 'WORKER') {
          return (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              مسندة إليك
            </span>
          );
        }

        return (
          <select
            value={o.assigned_to || ''}
            onChange={(e) => handleAssignWorker(o.id, e.target.value ? Number(e.target.value) : null)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">-- غير مسند --</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      align: 'end',
      render: (o) => (
        <div className="flex items-center justify-end gap-2">
          {/* Quick status updater */}
          <select
            value={o.status}
            onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
            disabled={isUpdating}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-slate-700 font-medium cursor-pointer"
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <Button
            size="sm"
            variant="outline"
            onClick={() => viewOrderDetails(o)}
            icon={<Eye className="h-3.5 w-3.5" />}
          >
            تفاصيل
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
              ? 'صلاحياتك محصورة في تحديث حالة التصنيع والتجهيز للطلبات الموكلة إليك.'
              : 'إدارة دورة حياة الطلبات كاملة من الاستلام إلى التسليم، مع إسناد المهام للعمال.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            options={[
              { value: '', label: 'جميع الحالات' },
              ...ALL_STATUSES.map((s) => ({ value: s, label: s })),
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-40 text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={loadOrders}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            تحديث
          </Button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 text-xs hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {/* Orders Table */}
      {isLoading ? (
        <LoadingState message="جاري جلب سجل الطلبات..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadOrders} />
      ) : (
        <Table
          columns={columns}
          data={orders}
          keyExtractor={(o) => o.id}
          emptyMessage={
            user?.role === 'WORKER'
              ? 'لا توجد طلبات مسندة إليك حالياً في هذا التصنيف'
              : 'لا توجد طلبات مسجلة'
          }
        />
      )}

      {/* Order Details & Snapshots Modal */}
      {selectedOrder && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`تفاصيل الطلب: ${selectedOrder.order_number}`}
          description={`تاريخ الإنشاء: ${selectedOrder.created_at}`}
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold">تحديث الحالة:</span>
                <select
                  value={selectedOrder.status}
                  onChange={(e) => handleUpdateStatus(selectedOrder.id, e.target.value)}
                  className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setIsDetailModalOpen(false)}>
                إغلاق
              </Button>
            </div>
          }
        >
          <div className="space-y-5 text-xs">
            {/* Customer & Shipping Summary */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">العميل:</span>
                <span className="font-bold text-slate-900 block">{selectedOrder.customer_name || 'عميل'}</span>
                <span className="text-slate-500 font-mono block">{selectedOrder.customer_phone}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">الحالة الحالية:</span>
                <div className="mt-1">
                  <OrderStatusBadge status={selectedOrder.status} />
                </div>
              </div>
              {selectedOrder.customer_address && (
                <div className="col-span-2 pt-2 border-t border-slate-200/60">
                  <span className="text-[10px] text-slate-400 block font-medium">عنوان التوصيل:</span>
                  <span className="text-slate-700 font-medium block">{selectedOrder.customer_address}</span>
                </div>
              )}
            </div>

            {/* Historical Snapshot Items Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-900">
                  بنود الطلب مع النسخ التاريخية (Snapshots):
                </h4>
                <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-mono">
                  Order Items Snapshots
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-100 text-slate-600 text-[11px]">
                    <tr>
                      <th className="p-2.5 text-start">المنتج (نسخة ثابتة)</th>
                      <th className="p-2.5 text-start">المتغير (المقاس واللون)</th>
                      <th className="p-2.5 text-center">الكمية</th>
                      <th className="p-2.5 text-end">سعر الوحدة</th>
                      <th className="p-2.5 text-end">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map((it) => (
                        <tr key={it.id}>
                          <td className="p-2.5 font-bold text-slate-900">{it.product_name_snapshot}</td>
                          <td className="p-2.5 text-slate-600 font-mono text-[11px]">{it.variant_snapshot}</td>
                          <td className="p-2.5 text-center font-bold">{it.quantity}</td>
                          <td className="p-2.5 text-end">{it.unit_price} ج.م</td>
                          <td className="p-2.5 text-end font-bold text-slate-900">{it.total_price} ج.م</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400">
                          لا توجد بنود مسجلة
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial summary */}
            <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between font-bold">
              <span>إجمالي قيمة الطلب:</span>
              <span className="text-base text-emerald-400">{selectedOrder.total} ج.م</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
