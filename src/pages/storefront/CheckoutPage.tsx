import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Truck,
  MapPin,
  User,
  Phone,
  FileText,
  AlertCircle,
  Clock,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useCart } from '../../lib/cart-context.tsx';
import { useI18n } from '../../lib/i18n.tsx';
import { api } from '../../lib/api.ts';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Select } from '../../components/ui/Select.tsx';

const EGYPTIAN_GOVERNORATES = [
  'القاهرة',
  'الجيزة',
  'الإسكندرية',
  'الغربية',
  'الدقهلية',
  'القليوبية',
  'الشرقية',
  'المنوفية',
  'البحيرة',
  'كفر الشيخ',
  'دمياط',
  'بورسعيد',
  'الإسماعيلية',
  'السويس',
  'الفيوم',
  'بني سويف',
  'المنيا',
  'أسيوط',
  'سوهاج',
  'قنا',
  'الأقصر',
  'أسوان',
  'البحر الأحمر',
  'الوادي الجديد',
  'مطروح',
  'شمال سيناء',
  'جنوب سيناء',
];

interface CheckoutPageProps {
  onNavigateHome: () => void;
  onNavigateCart: () => void;
  onOrderCompleted: (orderNumber: string) => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  onNavigateHome,
  onNavigateCart,
  onOrderCompleted,
}) => {
  const { items, totalItemsCount, subtotal, deliveryFee, total, clearCart, revalidateWithServer } = useCart();
  const { t, lang } = useI18n();

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [governorate, setGovernorate] = useState('الغربية');
  const [city, setCity] = useState('');
  const [addressDetails, setAddressDetails] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  // Form validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate an idempotency key once per checkout session
  const [idempotencyKey] = useState<string>(() => `checkout_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (items.length > 0) {
      revalidateWithServer();
    }
  }, []);

  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  // If cart is empty, redirect to cart
  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
          <ShoppingBag className="h-8 w-8 text-indigo-500" />
        </div>
        <h2 className="text-xl font-black text-slate-900">سلة المشتريات فارغة</h2>
        <p className="text-xs text-slate-500">لا يمكن إتمام الطلب وسلة المشتريات فارغة. يرجى إضافة منتجات أولاً.</p>
        <Button variant="primary" onClick={onNavigateHome}>
          تصفح المنتجات
        </Button>
      </div>
    );
  }

  // Validate Egyptian mobile format locally for live UX
  const validatePhoneLocally = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    if (/^01[0125]\d{8}$/.test(cleaned)) return true;
    if (/^201[0125]\d{8}$/.test(cleaned)) return true;
    if (/^00201[0125]\d{8}$/.test(cleaned)) return true;
    return false;
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent double submission

    const newErrors: Record<string, string> = {};

    if (!customerName.trim() || customerName.trim().length < 3) {
      newErrors.name = 'يرجى إدخال الاسم بالكامل (3 أحرف على الأقل)';
    }

    if (!customerPhone.trim()) {
      newErrors.phone = 'رقم الهاتف مطلوب لتأكيد الطلب';
    } else if (!validatePhoneLocally(customerPhone)) {
      newErrors.phone = 'رقم هاتف غير صالح. يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015 ويتكون من 11 رقم';
    }

    if (!governorate.trim()) {
      newErrors.governorate = 'يرجى اختيار المحافظة';
    }

    if (!city.trim()) {
      newErrors.city = 'يرجى إدخال المدينة أو المركز';
    }

    if (!addressDetails.trim() || addressDetails.trim().length < 5) {
      newErrors.address = 'يرجى إدخال العنوان بالتفصيل (الشارع، رقم العمارة، علامة مميزة)';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        customer: {
          name: customerName.trim(),
          phone: customerPhone.trim(),
        },
        address: {
          governorate: governorate.trim(),
          city: city.trim(),
          address: addressDetails.trim(),
          notes: customerNotes.trim() || null,
        },
        items: items.map((i) => ({
          product_id: i.product_id,
          variant_id: i.variant_id,
          quantity: i.quantity,
        })),
        customer_notes: customerNotes.trim() || null,
        idempotency_key: idempotencyKey,
      };

      const res = await api.orders.checkout(payload);

      if (res.success && res.data) {
        clearCart();
        onOrderCompleted(res.data.orderNumber);
      } else {
        setSubmitError(res.message || 'حدث خطأ أثناء تسجيل الطلب');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'فشل في إرسال الطلب. يرجى التأكد من توفر المخزون والمحاولة ثانية.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb Navigation */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
          <button onClick={onNavigateHome} className="hover:text-indigo-600 cursor-pointer">
            الرئيسية
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400 rtl:rotate-180" />
          <button onClick={onNavigateCart} className="hover:text-indigo-600 cursor-pointer">
            سلة المشتريات
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400 rtl:rotate-180" />
          <span className="text-slate-700">إتمام الشراء</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">إتمام الطلب وتأكيد البيانات</h1>
      </div>

      {/* Visual Checkout Steps Indicator */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex items-center justify-between max-w-3xl mx-auto text-xs font-bold">
          {/* Step 1 */}
          <div className="flex items-center gap-2 text-emerald-600">
            <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs">✓</span>
            <span className="hidden sm:inline">1. السلة</span>
          </div>
          <div className="flex-1 h-0.5 bg-emerald-200 mx-2" />

          {/* Step 2 */}
          <div className="flex items-center gap-2 text-indigo-600">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">2</span>
            <span>2. بيانات العميل</span>
          </div>
          <div className="flex-1 h-0.5 bg-indigo-200 mx-2" />

          {/* Step 3 */}
          <div className="flex items-center gap-2 text-indigo-600">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">3</span>
            <span className="hidden sm:inline">3. العنوان</span>
          </div>
          <div className="flex-1 h-0.5 bg-slate-200 mx-2" />

          {/* Step 4 */}
          <div className="flex items-center gap-2 text-slate-500">
            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs">4</span>
            <span className="hidden sm:inline">4. مراجعة الطلب</span>
          </div>
          <div className="flex-1 h-0.5 bg-slate-200 mx-2" />

          {/* Step 5 */}
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs">5</span>
            <span className="hidden sm:inline">5. التأكيد</span>
          </div>
        </div>
      </div>

      {submitError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Main Checkout Form & Summary */}
      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Form: Customer & Shipping Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">بيانات المستلم والتواصل</h3>
                <p className="text-[11px] text-slate-500">لا يلزم تسجيل حساب، يتم استخدام البيانات للتوصيل فقط.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="الاسم الكامل *"
                placeholder="مثال: أحمد محمد مصطفى"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                error={errors.name}
                required
              />

              <div>
                <Input
                  label="رقم الهاتف المحمول (مصر) *"
                  type="tel"
                  placeholder="01012345678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  error={errors.phone}
                  helperText="يقبل أرقام 010 أو 011 أو 012 أو 015"
                  icon={<Phone className="h-4 w-4 text-slate-400" />}
                  required
                />
              </div>
            </div>
          </div>

          {/* Address Information Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">عنوان الشحن والتسليم</h3>
                <p className="text-[11px] text-slate-500">يتم إرسال الشحنة مباشرة من مقر المصنع إلى هذا العنوان.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="المحافظة *"
                options={EGYPTIAN_GOVERNORATES.map((g) => ({ value: g, label: g }))}
                value={governorate}
                onChange={(e) => setGovernorate(e.target.value)}
                error={errors.governorate}
                required
              />

              <Input
                label="المدينة / المركز *"
                placeholder="مثال: المحلة الكبرى / طنطا / المعادي"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                error={errors.city}
                required
              />
            </div>

            <Input
              label="العنوان بالتفصيل *"
              placeholder="مثال: شارع النصر، عمارة 14، الدور الثالث، بجوار مسجد السلام"
              value={addressDetails}
              onChange={(e) => setAddressDetails(e.target.value)}
              error={errors.address}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ملاحظات خاصة بالتسليم أو المقاسات (اختياري)
              </label>
              <textarea
                rows={2}
                placeholder="مثال: يرجى الاتصال قبل الوصول بنصف ساعة، أو تعليمات خاصة بموعد الاستلام..."
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Right Side: Order Review & Confirmation Box */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6 sticky top-20">
            <h3 className="font-black text-slate-900 text-base border-b border-slate-100 pb-3">
              مراجعة الطلب النهائي
            </h3>

            {/* Items Summary Snapshot */}
            <div className="space-y-3 max-h-64 overflow-y-auto pe-1">
              {items.map((item) => (
                <div key={item.variant_id} className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                      ) : (
                        <Layers className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                    <div className="truncate">
                      <span className="font-bold text-slate-900 block truncate">{item.product_name}</span>
                      <span className="text-[11px] text-slate-500">
                        {item.color} — {item.size} ({item.quantity} × {item.price} ج.م)
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 shrink-0">
                    {item.price * item.quantity} {t.priceCurrency}
                  </span>
                </div>
              ))}
            </div>

            {/* Price Calculations */}
            <div className="space-y-2.5 border-t border-slate-100 pt-4 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>إجمالي المنتجات ({totalItemsCount} قطعة)</span>
                <span className="font-bold text-slate-900">
                  {subtotal} {t.priceCurrency}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>مصاريف الشحن والتوصيل</span>
                <span className="font-bold text-emerald-600">
                  {deliveryFee === 0 ? 'مجانًا (المرحلة 3)' : `${deliveryFee} ${t.priceCurrency}`}
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-2 border-t border-slate-100 text-slate-900">
                <span className="text-sm font-black">المبلغ الإجمالي</span>
                <span className="text-2xl font-black text-indigo-600">
                  {total} {t.priceCurrency}
                </span>
              </div>
            </div>

            {/* Confirm Order Button with Anti-Duplicate Loading Lock */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full text-base font-bold py-3.5 shadow-md shadow-indigo-600/25"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              icon={<CheckCircle2 className="h-5 w-5" />}
            >
              {isSubmitting ? 'جاري تأكيد وإرسال الطلب...' : 'تأكيد وإرسال الطلب الآن'}
            </Button>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                <Clock className="h-3.5 w-3.5 text-indigo-600" />
                <span>حالة الطلب المبدئية: قيد المراجعة (PENDING)</span>
              </div>
              <p className="leading-relaxed">
                سيقوم فريق المصنع بمراجعة وتجهيز الطلب مباشرة. يتم حفظ المنتجات والأسعار والمخزون بشكل فوري.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
