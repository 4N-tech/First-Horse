import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Check,
  ShoppingBag,
  Clock,
  MapPin,
  User,
  Phone,
  Layers,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import { useI18n } from '../../lib/i18n.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';

interface OrderSuccessPageProps {
  orderNumber: string;
  onNavigateHome: () => void;
  onNavigateLookup?: (orderNumber?: string) => void;
}

export const OrderSuccessPage: React.FC<OrderSuccessPageProps> = ({
  orderNumber,
  onNavigateHome,
  onNavigateLookup,
}) => {
  const { t, lang } = useI18n();
  const [order, setOrder] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    async function loadOrder() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.orders.getPublicOrder(orderNumber);
        if (res.success && res.data) {
          setOrder(res.data);
        } else {
          setError('لم نتمكن من العثور على بيانات هذا الطلب.');
        }
      } catch (err: any) {
        setError(err.message || 'فشل في تحميل تفاصيل الطلب');
      } finally {
        setIsLoading(false);
      }
    }

    if (orderNumber) {
      loadOrder();
    }
  }, [orderNumber]);

  const handleCopyOrderNumber = () => {
    if (!orderNumber) return;
    navigator.clipboard.writeText(orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  if (isLoading) {
    return <LoadingState message="جاري تجهيز وتأكيد تفاصيل الطلب..." />;
  }

  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <ErrorState
          title="عذرًا، حدث خطأ"
          message={error || 'تعذر تحميل بيانات الطلب'}
          onRetry={onNavigateHome}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Success Hero Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-sm text-center space-y-5">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 animate-bounce" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full">
            تم تسجيل طلبك بنجاح
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            تم إرسال طلبك بنجاح.
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto">
            شكراً لثقتك في مصنعنا للملابس. تم استلام تفاصيل طلبك وحفظها، وبدأت دورة المراجعة والتجهيز من خطوط الإنتاج.
          </p>
        </div>

        {/* Order Number Box with Copy Button */}
        <div className="inline-flex flex-col sm:flex-row items-center gap-3 p-3 sm:px-6 sm:py-3 rounded-2xl bg-indigo-50/70 border border-indigo-200">
          <span className="text-xs font-semibold text-slate-600">رقم الطلب:</span>
          <span className="text-lg sm:text-xl font-black font-mono text-indigo-700">
            #{order.order_number}
          </span>
          <button
            onClick={handleCopyOrderNumber}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer shadow-2xs"
            title="نسخ رقم الطلب"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700">تم النسخ</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>نسخ الرقم</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-start">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 block">اسم العميل</span>
            <span className="text-xs font-bold text-slate-800 block truncate mt-0.5">
              {order.customer?.name}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 block">عدد القطع</span>
            <span className="text-xs font-bold text-slate-800 block mt-0.5">
              {order.total_items_count} قطعة
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 block">إجمالي الطلب</span>
            <span className="text-xs font-black text-indigo-700 block mt-0.5">
              {order.total} {t.priceCurrency}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 block">حالة الطلب</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 mt-0.5">
              <Clock className="h-3.5 w-3.5 text-amber-500 animate-spin" />
              <span>قيد المراجعة (PENDING)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Itemized Order Details & Address Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">
          تفاصيل المنتجات والعنوان
        </h3>

        {/* Items List */}
        <div className="space-y-3">
          {order.items?.map((item: any) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                  <Layers className="h-5 w-5 text-indigo-500" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 block text-xs sm:text-sm">
                    {item.product_name_snapshot}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {item.variant_snapshot}
                  </span>
                </div>
              </div>

              <div className="text-end">
                <span className="font-black text-slate-900 block text-xs sm:text-sm">
                  {item.total_price} {t.priceCurrency}
                </span>
                <span className="text-[11px] text-slate-400">
                  {item.quantity} × {item.unit_price} ج.م
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Delivery Address Summary */}
        {order.address && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <MapPin className="h-4 w-4 text-indigo-600" />
              <span>عنوان التسليم المحدد:</span>
            </div>
            <p className="text-slate-600 font-medium ps-6 leading-relaxed">
              {order.address.governorate} — {order.address.city} — {order.address.address}
            </p>
            {order.address.notes && (
              <p className="text-[11px] text-slate-500 ps-6">
                ملاحظات: {order.address.notes}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <Button
            variant="primary"
            size="lg"
            onClick={onNavigateHome}
            icon={<ArrowIcon className="h-4 w-4" />}
            className="w-full sm:w-auto shadow-md shadow-indigo-600/20"
          >
            العودة للمتجر وتصفح المنتجات
          </Button>

          {onNavigateLookup && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => onNavigateLookup(order.order_number)}
              icon={<Search className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              تتبع حالة طلبك
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
