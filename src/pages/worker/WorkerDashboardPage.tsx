import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  CheckCircle2,
  Clock,
  Layers,
  Phone,
  MapPin,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  FileText,
  RefreshCw,
  LogOut,
  Shirt,
  ShieldCheck,
  Send,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context.tsx';
import { useI18n } from '../../lib/i18n.tsx';
import { Order, OrderStatus, ORDER_STATUS_LABELS_AR } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { OrderStatusBadge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';

interface WorkerDashboardPageProps {
  onLogout?: () => void;
  onNavigateStorefront?: () => void;
}

export const WorkerDashboardPage: React.FC<WorkerDashboardPageProps> = ({
  onLogout,
  onNavigateStorefront,
}) => {
  const { user, logout } = useAuth();
  const { t, lang } = useI18n();

  const [workspaceData, setWorkspaceData] = useState<{
    kpis: {
      total_assigned: number;
      new_orders: number;
      in_progress: number;
      ready: number;
      completed: number;
    };
    orders: Order[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status Filter Tab (all, new, processing, ready, completed)
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'processing' | 'ready' | 'completed'>('all');

  // Selected Order for Detail View
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Status update modal / action
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusActionNote, setStatusActionNote] = useState('');
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    orderId: number;
    newStatus: OrderStatus;
    actionLabel: string;
  } | null>(null);

  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  const loadWorkspace = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.orders.getWorkerWorkspace();
      if (res.success && res.data) {
        setWorkspaceData(res.data);
      } else {
        setError('تعذر تحميل بيانات خط التشغيل');
      }
    } catch (err: any) {
      setError(err.message || 'فشل في تحميل مساحة عمل فني التشغيل');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, []);

  const handleOpenStatusAction = (order: Order, newStatus: OrderStatus, actionLabel: string) => {
    setPendingStatusChange({ orderId: order.id, newStatus, actionLabel });
    setStatusActionNote('');
  };

  const handleConfirmStatusChange = async () => {
    if (!pendingStatusChange) return;

    setIsUpdatingStatus(true);
    try {
      const res = await api.orders.updateStatus(
        pendingStatusChange.orderId,
        pendingStatusChange.newStatus,
        statusActionNote
      );

      if (res.success) {
        setSuccessBanner(`تم ${pendingStatusChange.actionLabel} بنجاح وتسجيلها في خط التشغيل.`);
        setTimeout(() => setSuccessBanner(null), 4000);
        setPendingStatusChange(null);
        if (selectedOrder && selectedOrder.id === pendingStatusChange.orderId) {
          setSelectedOrder(res.data);
        }
        await loadWorkspace();
      }
    } catch (err: any) {
      alert(err.message || 'فشل في تحديث حالة الطلب');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleOpenOrderDetail = async (ord: Order) => {
    setSelectedOrder(ord);
    setIsDetailModalOpen(true);
    try {
      const full = await api.orders.getOne(ord.id);
      if (full.success && full.data) {
        setSelectedOrder(full.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) return <LoadingState message="جاري تجهيز مساحة عمل فني التشغيل..." />;
  if (error || !workspaceData) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <ErrorState title="خطأ في النظام" message={error || 'تعذر جلب البيانات'} onRetry={loadWorkspace} />
      </div>
    );
  }

  // Filter orders according to activeTab
  const filteredOrders = workspaceData.orders.filter((ord) => {
    if (activeTab === 'new') return ord.status === 'PENDING' || ord.status === 'CONFIRMED';
    if (activeTab === 'processing') return ord.status === 'PROCESSING';
    if (activeTab === 'ready') return ord.status === 'READY';
    if (activeTab === 'completed') return ord.status === 'SHIPPED' || ord.status === 'DELIVERED';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Worker App Header (Mobile-first) */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Shirt className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white leading-tight">خط التشغيل والتصنيع</h1>
              <p className="text-[11px] text-slate-400">
                مرحباً، <span className="text-indigo-300 font-bold">{user?.name}</span> (فني خياطة وتشغيل)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadWorkspace}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={onLogout || logout}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {successBanner && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{successBanner}</span>
            </div>
            <button onClick={() => setSuccessBanner(null)} className="text-emerald-700 text-xs hover:underline cursor-pointer">
              إغلاق
            </button>
          </div>
        )}

        {/* 4 KPIs Cards (Requirement 14, 20) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            onClick={() => setActiveTab('new')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'new'
                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200'
                : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-amber-600">
              <span className="text-[11px] font-bold">طلبات جديدة</span>
              <Clock className="h-4 w-4" />
            </div>
            <span className="text-2xl font-black text-amber-700 block mt-1">
              {workspaceData.kpis.new_orders}
            </span>
            <span className="text-[10px] text-slate-400">بانتظار البدء</span>
          </div>

          <div
            onClick={() => setActiveTab('processing')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'processing'
                ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200'
                : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-indigo-600">
              <span className="text-[11px] font-bold">قيد التنفيذ</span>
              <Layers className="h-4 w-4" />
            </div>
            <span className="text-2xl font-black text-indigo-700 block mt-1">
              {workspaceData.kpis.in_progress}
            </span>
            <span className="text-[10px] text-slate-400">على خط الحياكة</span>
          </div>

          <div
            onClick={() => setActiveTab('ready')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'ready'
                ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200'
                : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-emerald-600">
              <span className="text-[11px] font-bold">جاهزة للتسليم</span>
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <span className="text-2xl font-black text-emerald-700 block mt-1">
              {workspaceData.kpis.ready}
            </span>
            <span className="text-[10px] text-slate-400">جاهزة للشحن</span>
          </div>

          <div
            onClick={() => setActiveTab('completed')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'completed'
                ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-300'
                : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-[11px] font-bold">مكتملة</span>
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-2xl font-black text-slate-800 block mt-1">
              {workspaceData.kpis.completed}
            </span>
            <span className="text-[10px] text-slate-400">تم شحنها / تسليمها</span>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer shrink-0 ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            جميع طلباتي ({workspaceData.orders.length})
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer shrink-0 ${
              activeTab === 'new'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            جديدة ({workspaceData.kpis.new_orders})
          </button>
          <button
            onClick={() => setActiveTab('processing')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer shrink-0 ${
              activeTab === 'processing'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            قيد التجهيز ({workspaceData.kpis.in_progress})
          </button>
          <button
            onClick={() => setActiveTab('ready')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer shrink-0 ${
              activeTab === 'ready'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            جاهزة ({workspaceData.kpis.ready})
          </button>
        </div>

        {/* Orders List (Requirement 14 & 25 Mobile-First) */}
        <div className="space-y-3">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider">
            قائمة الطلبات المسندة لخطك:
          </h2>

          {filteredOrders.length > 0 ? (
            filteredOrders.map((ord) => {
              const canStartProcessing = ord.status === 'CONFIRMED';
              const canMarkReady = ord.status === 'PROCESSING';

              return (
                <div
                  key={ord.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3 transition-shadow hover:shadow-xs"
                >
                  {/* Top line: Order Number & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                        #{ord.order_number}
                      </span>
                      <OrderStatusBadge status={ord.status} />
                    </div>

                    <span className="text-[11px] text-slate-400 font-mono">
                      {ord.created_at?.slice(0, 16)}
                    </span>
                  </div>

                  {/* Customer Information Preview */}
                  <div className="text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{ord.customer_name}</span>
                      <a
                        href={`tel:${ord.customer_phone}`}
                        className="text-indigo-600 font-mono font-bold hover:underline inline-flex items-center gap-1"
                      >
                        <Phone className="h-3 w-3" />
                        <span>{ord.customer_phone}</span>
                      </a>
                    </div>
                  </div>

                  {/* Items summary */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-slate-700">
                      <span>القطع المطلوبة:</span>
                      <span className="font-bold text-slate-900">{ord.total_pieces} قطعة</span>
                    </div>
                    {ord.items && ord.items.length > 0 && (
                      <div className="text-[11px] text-slate-600 space-y-0.5 pt-1 border-t border-slate-200/60">
                        {ord.items.map((it) => (
                          <div key={it.id} className="flex justify-between">
                            <span className="truncate">{it.product_name_snapshot} ({it.variant_snapshot})</span>
                            <span className="font-bold shrink-0 ps-2">{it.quantity}×</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Operational Action Buttons (Touch-friendly & Role-safe) */}
                  <div className="flex items-center gap-2 pt-1">
                    {canStartProcessing && (
                      <button
                        type="button"
                        onClick={() => handleOpenStatusAction(ord, 'PROCESSING', 'بدء تجهيز الطلب')}
                        className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
                      >
                        <Layers className="h-4 w-4" />
                        <span>بدء التجهيز (CONFIRMED ← PROCESSING)</span>
                      </button>
                    )}

                    {canMarkReady && (
                      <button
                        type="button"
                        onClick={() => handleOpenStatusAction(ord, 'READY', 'تأكيد جاهزية الطلب')}
                        className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>جاهز للتسليم (PROCESSING ← READY)</span>
                      </button>
                    )}

                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => handleOpenOrderDetail(ord)}
                      className="px-3"
                    >
                      التفاصيل
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <ShoppingBag className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">
                {activeTab === 'all'
                  ? 'لا توجد طلبات مسندة إليك.'
                  : 'لا توجد طلبات في هذا التصنيف حالياً.'}
              </p>
              <p className="text-[11px] text-slate-400">
                سيقوم مدير النظام أو مشرف الإنتاج بإسناد الطلبات الجديدة لخطك فور توفرها.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Confirmation Modal for Worker Status Transition with Optional Note */}
      {pendingStatusChange && (
        <Modal
          isOpen={true}
          onClose={() => setPendingStatusChange(null)}
          title={`تأكيد الإجراء: ${pendingStatusChange.actionLabel}`}
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 leading-relaxed">
              هل أنت متأكد من تحديث حالة الطلب إلى (
              <span className="font-bold text-indigo-700">
                {ORDER_STATUS_LABELS_AR[pendingStatusChange.newStatus]}
              </span>
              )؟ سيتم تسجيل اسمك ووقت التحديث في السجل الزمني للطلب.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">
                ملاحظة على خط التشغيل (اختياري):
              </label>
              <textarea
                rows={2}
                placeholder="مثال: تم قص القماش وبدء الحياكة، أو تم الكي وفحص الجودة وجاهز للتغليف..."
                value={statusActionNote}
                onChange={(e) => setStatusActionNote(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setPendingStatusChange(null)}>
                إلغاء
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmStatusChange}
                isLoading={isUpdatingStatus}
              >
                تأكيد وتسجيل في خط التشغيل
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Order Detail Modal for Worker */}
      {selectedOrder && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`ملف الطلب #${selectedOrder.order_number}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 text-[10px] block">رقم الطلب:</span>
                <span className="font-mono font-bold text-indigo-700 text-sm">#{selectedOrder.order_number}</span>
              </div>
              <OrderStatusBadge status={selectedOrder.status} size="md" />
            </div>

            {/* Customer & Address */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">المستلم:</span>
                  <span className="font-bold text-slate-900">{selectedOrder.customer_name}</span>
                </div>
                <a
                  href={`tel:${selectedOrder.customer_phone}`}
                  className="font-mono font-bold text-indigo-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 hover:bg-indigo-50"
                >
                  <Phone className="h-3 w-3" />
                  <span>{selectedOrder.customer_phone}</span>
                </a>
              </div>

              {selectedOrder.customer_address && (
                <div className="pt-2 border-t border-slate-200/60">
                  <span className="text-[10px] text-slate-400 block">عنوان التوصيل:</span>
                  <span className="text-slate-800 font-medium">{selectedOrder.customer_address}</span>
                </div>
              )}

              {selectedOrder.customer_notes && (
                <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-[11px]">
                  <span className="font-bold block">ملاحظات العميل:</span>
                  <p>{selectedOrder.customer_notes}</p>
                </div>
              )}
            </div>

            {/* Products List */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900">مواصفات المنتجات والكميات:</h4>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                {selectedOrder.items?.map((it) => (
                  <div key={it.id} className="p-3 bg-white flex items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-slate-900 block">{it.product_name_snapshot}</span>
                      <span className="text-[11px] text-slate-500 font-mono">{it.variant_snapshot}</span>
                    </div>
                    <span className="font-black text-indigo-700 text-sm bg-indigo-50 px-2.5 py-1 rounded-lg">
                      {it.quantity} قطعة
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Worker Actions */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              {selectedOrder.status === 'CONFIRMED' && (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full text-xs font-bold"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenStatusAction(selectedOrder, 'PROCESSING', 'بدء تجهيز الطلب');
                  }}
                  icon={<Layers className="h-4 w-4" />}
                >
                  بدء التجهيز الآن (CONFIRMED ← PROCESSING)
                </Button>
              )}

              {selectedOrder.status === 'PROCESSING' && (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenStatusAction(selectedOrder, 'READY', 'تأكيد جاهزية الطلب');
                  }}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                >
                  تأكيد جاهزية الطلب للتسليم (PROCESSING ← READY)
                </Button>
              )}

              <Button
                variant="secondary"
                size="md"
                className="w-full"
                onClick={() => setIsDetailModalOpen(false)}
              >
                إغلاق
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
