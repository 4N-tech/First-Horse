import React, { useState } from 'react';
import { Search, Clock, ArrowLeft, ArrowRight, Layers, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api.ts';
import { useI18n } from '../../lib/i18n.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';

interface OrderLookupPageProps {
  initialOrderNumber?: string;
  onNavigateHome: () => void;
}

export const OrderLookupPage: React.FC<OrderLookupPageProps> = ({
  initialOrderNumber = '',
  onNavigateHome,
}) => {
  const { t, lang } = useI18n();
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim() || !phone.trim()) {
      setError('يرجى إدخال كل من رقم الطلب ورقم الهاتف المسجل.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setOrder(null);

    try {
      const res = await api.orders.lookupOrder(orderNumber.trim(), phone.trim());
      if (res.success && res.data) {
        setOrder(res.data);
      } else {
        setError('لم نتمكن من العثور على طلب مطابق.');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء البحث عن الطلب.');
    } finally {
      setIsLoading(false);
    }
  };

  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
          <Search className="h-7 w-7 text-indigo-600" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">تتبع حالة طلبك</h1>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          أدخل رقم الطلب المسجل ورقم الهاتف المحمول للاطلاع على حالة التجهيز والشحن في المصنع.
        </p>
      </div>

      {/* Lookup Form */}
      <form onSubmit={handleLookup} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="رقم الطلب *"
            placeholder="مثال: ORD-100001"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            required
          />

          <Input
            label="رقم الهاتف المسجل *"
            type="tel"
            placeholder="01012345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full"
          isLoading={isLoading}
          icon={<Search className="h-4 w-4" />}
        >
          بحث عن الطلب
        </Button>
      </form>

      {/* Results View */}
      {order && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[11px] font-semibold text-slate-400">رقم الطلب</span>
              <h3 className="text-xl font-black font-mono text-indigo-700">#{order.order_number}</h3>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
              <Clock className="h-3.5 w-3.5 text-amber-600 animate-spin" />
              <span>الحالة: {order.status === 'PENDING' ? 'قيد المراجعة في المصنع' : order.status}</span>
            </div>
          </div>

          {/* Customer & Total info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400 block text-[11px]">اسم العميل</span>
              <span className="font-bold text-slate-800 block mt-0.5">{order.customer_name}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400 block text-[11px]">عدد القطع</span>
              <span className="font-bold text-slate-800 block mt-0.5">{order.items_count} قطعة</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400 block text-[11px]">الإجمالي</span>
              <span className="font-black text-indigo-700 block mt-0.5">{order.total} ج.م</span>
            </div>
          </div>

          {/* Items snapshot */}
          <div className="space-y-2 pt-2">
            <h4 className="font-bold text-xs text-slate-800">المنتجات المطلوبة:</h4>
            {order.items?.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 text-xs">
                <div>
                  <span className="font-bold text-slate-900 block">{item.product_name_snapshot}</span>
                  <span className="text-[11px] text-slate-500">{item.variant_snapshot}</span>
                </div>
                <span className="font-bold text-slate-900">
                  {item.quantity} × {item.unit_price} ج.م
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Return link */}
      <div className="text-center pt-2">
        <Button variant="ghost" onClick={onNavigateHome} icon={<ArrowIcon className="h-4 w-4" />}>
          العودة لتصفح منتجات المصنع
        </Button>
      </div>
    </div>
  );
};
