import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Trash2,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Truck,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useCart } from '../../lib/cart-context.tsx';
import { useI18n } from '../../lib/i18n.tsx';
import { Button } from '../../components/ui/Button.tsx';

interface CartPageProps {
  onNavigateHome: () => void;
  onNavigateCheckout: () => void;
  onSelectProduct: (slug: string) => void;
}

export const CartPage: React.FC<CartPageProps> = ({
  onNavigateHome,
  onNavigateCheckout,
  onSelectProduct,
}) => {
  const { items, totalItemsCount, subtotal, deliveryFee, total, updateQuantity, removeItem, clearCart, revalidateWithServer, isValidating } = useCart();
  const { t, lang } = useI18n();

  const [validationIssues, setValidationIssues] = useState<string[]>([]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (items.length > 0) {
      revalidateWithServer().then((res) => {
        setValidationIssues(res.issues);
      });
    }
  }, []);

  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  const hasInvalidItems = items.some((i) => i.is_active === false || (i.stock_quantity !== undefined && i.quantity > i.stock_quantity));

  // Empty Cart View
  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
          <ShoppingBag className="h-10 w-10 text-indigo-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900">السلة فارغة حاليًا.</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            لم تقم بإضافة أي ملابس أو منتجات إلى سلة المشتريات حتى الآن. استكشف كتالوج المصنع واختر المقاسات والألوان المفضلة.
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={onNavigateHome}
          icon={<ShoppingBag className="h-5 w-5" />}
          className="shadow-md shadow-indigo-600/20"
        >
          تصفح المنتجات
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <button onClick={onNavigateHome} className="hover:text-indigo-600 cursor-pointer">
              الرئيسية
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400 rtl:rotate-180" />
            <span className="text-slate-700">سلة المشتريات</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <span>سلة المشتريات</span>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
              {totalItemsCount} قطعة
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => revalidateWithServer()}
            isLoading={isValidating}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            تحديث الأسعار والمخزون
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCart}
            className="text-red-600 hover:bg-red-50"
            icon={<Trash2 className="h-3.5 w-3.5" />}
          >
            تفريغ السلة
          </Button>
        </div>
      </div>

      {/* Validation Notice Banner if issues detected */}
      {validationIssues.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>تنبيه بخصوص تحديثات المخزون والأسعار:</span>
          </div>
          <ul className="text-xs space-y-1 ps-6 list-disc text-amber-800">
            {validationIssues.map((issue, idx) => (
              <li key={idx}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Cart Content Layout: Items on Left/Center, Summary on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100">
            {items.map((item) => {
              const isInvalid = item.is_active === false;
              const isExceedingStock = item.stock_quantity !== undefined && item.quantity > item.stock_quantity;
              const lineTotal = item.price * item.quantity;

              return (
                <div
                  key={item.variant_id}
                  className={`p-4 sm:p-6 transition-colors ${
                    isInvalid ? 'bg-rose-50/60' : 'hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Product & Variant Details */}
                    <div className="flex items-start gap-4">
                      <div
                        onClick={() => onSelectProduct(item.product_slug)}
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer group"
                      >
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.product_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <Layers className="h-8 w-8 text-slate-300" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <button
                          onClick={() => onSelectProduct(item.product_slug)}
                          className="font-bold text-slate-900 text-sm sm:text-base hover:text-indigo-600 transition-colors text-start cursor-pointer block leading-tight"
                        >
                          {item.product_name}
                        </button>

                        {/* Selected Variant Attributes */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            <span>اللون:</span>
                            <span className="text-slate-900 font-bold">{item.color}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            <span>المقاس:</span>
                            <span className="text-slate-900 font-bold font-mono">{item.size}</span>
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            SKU: {item.sku}
                          </span>
                        </div>

                        {/* Unit Price */}
                        <div className="pt-1.5 flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-slate-500">سعر القطعة:</span>
                          <span className="font-bold text-slate-900 text-sm">
                            {item.price} {t.priceCurrency}
                          </span>
                        </div>

                        {/* Inactive or Stock Error Warnings */}
                        {isInvalid && (
                          <div className="pt-1 text-xs font-bold text-rose-600 flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>هذا المنتج لم يعد متاحًا. يرجى حذفه للمتابعة.</span>
                          </div>
                        )}
                        {!isInvalid && isExceedingStock && (
                          <div className="pt-1 text-xs font-bold text-amber-600 flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>الكمية المطلوبة غير متاحة حاليًا. المتوفر: {item.stock_quantity}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quantity Controls & Line Total */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                      {/* Line Total */}
                      <div className="text-start sm:text-end">
                        <span className="text-[11px] text-slate-400 block sm:hidden">الإجمالي:</span>
                        <span className="text-base sm:text-lg font-black text-slate-900">
                          {lineTotal} {t.priceCurrency}
                        </span>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-3">
                        <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white shadow-2xs">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.variant_id, item.quantity - 1)}
                            className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded-s-xl text-sm font-bold cursor-pointer"
                            title="تقليل الكمية"
                          >
                            -
                          </button>
                          <span className="w-9 text-center text-xs font-bold text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.variant_id, item.quantity + 1)}
                            disabled={item.quantity >= item.stock_quantity}
                            className={`px-2.5 py-1 rounded-e-xl text-sm font-bold ${
                              item.quantity >= item.stock_quantity
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-slate-600 hover:bg-slate-100 cursor-pointer'
                            }`}
                            title={
                              item.quantity >= item.stock_quantity
                                ? 'الحد الأقصى للمخزون'
                                : 'زيادة الكمية'
                            }
                          >
                            +
                          </button>
                        </div>

                        {/* Remove item button */}
                        <button
                          type="button"
                          onClick={() => removeItem(item.variant_id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                          title="حذف هذا المنتج من السلة"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Continue shopping link */}
          <div className="pt-2">
            <button
              onClick={onNavigateHome}
              className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
            >
              <ArrowIcon className="h-4 w-4" />
              <span>متابعة تصفح المزيد من منتجات المصنع</span>
            </button>
          </div>
        </div>

        {/* Order Summary Card */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
            <h3 className="font-black text-slate-900 text-base border-b border-slate-100 pb-3">
              ملخص الطلب
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>إجمالي القطع</span>
                <span className="font-bold text-slate-900">{totalItemsCount} قطعة</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>إجمالي المنتجات</span>
                <span className="font-bold text-slate-900">
                  {subtotal} {t.priceCurrency}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600 border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <span className="block font-semibold">مصاريف التوصيل</span>
                  <span className="text-[10px] text-slate-400 block">
                    سيتم تحديد مصاريف التوصيل عند تأكيد الطلب.
                  </span>
                </div>
                <span className="font-bold text-emerald-600">
                  {deliveryFee === 0 ? 'مجانًا / لاحقًا' : `${deliveryFee} ${t.priceCurrency}`}
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1 text-slate-900">
                <span className="text-sm font-black">الإجمالي النهائي</span>
                <span className="text-2xl font-black text-indigo-600">
                  {total} {t.priceCurrency}
                </span>
              </div>
            </div>

            {hasInvalidItems && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                يرجى إزالة أو تعديل المنتجات غير المتاحة من السلة قبل إتمام الطلب.
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              className="w-full text-base font-bold py-3.5 shadow-md shadow-indigo-600/20"
              onClick={onNavigateCheckout}
              disabled={hasInvalidItems}
              icon={<ArrowIcon className="h-5 w-5" />}
            >
              متابعة إتمام الطلب (Checkout)
            </Button>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>ضمان الجودة ومطابقة المواصفات مباشرة من خط الإنتاج</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>شحن سريع لجميع محافظات جمهورية مصر العربية</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
