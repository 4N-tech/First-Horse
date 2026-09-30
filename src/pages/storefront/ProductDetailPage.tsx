import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Shirt, Check, ShoppingBag, ShieldCheck, Factory, Truck, Info } from 'lucide-react';
import { useI18n } from '../../lib/i18n.tsx';
import { Product, ProductVariant } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { Button } from '../../components/ui/Button.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';

interface ProductDetailPageProps {
  productSlug: string;
  onBack: () => void;
  onSelectCategory: (slug: string) => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  productSlug,
  onBack,
  onSelectCategory,
}) => {
  const { t, lang } = useI18n();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartFeedback, setCartFeedback] = useState<string | null>(null);

  useEffect(() => {
    async function loadProduct() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.products.getOne(productSlug);
        if (res.success && res.data) {
          const prod = res.data;
          setProduct(prod);

          if (prod.variants && prod.variants.length > 0) {
            const firstVariant = prod.variants[0];
            setSelectedVariant(firstVariant);
            setSelectedSize(firstVariant.size);
            setSelectedColor(firstVariant.color);
          }
        }
      } catch (err: any) {
        setError(err.message || 'فشل في تحميل بيانات المنتج');
      } finally {
        setIsLoading(false);
      }
    }
    loadProduct();
  }, [productSlug]);

  // Update selected variant when size or color changes
  const handleSizeSelect = (size: string) => {
    setSelectedSize(size);
    if (!product?.variants) return;
    const match = product.variants.find((v) => v.size === size && v.color === selectedColor)
      || product.variants.find((v) => v.size === size);
    if (match) {
      setSelectedVariant(match);
      setSelectedColor(match.color);
    }
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    if (!product?.variants) return;
    const match = product.variants.find((v) => v.color === color && v.size === selectedSize)
      || product.variants.find((v) => v.color === color);
    if (match) {
      setSelectedVariant(match);
      setSelectedSize(match.size);
    }
  };

  const handleAddToCart = () => {
    setCartFeedback(`تم اختيار ${quantity} قطعة (${selectedVariant?.size || ''} - ${selectedVariant?.color || ''}) بنجاح. وظائف إتمام الطلب مجهزة للمرحلة الثانية.`);
    setTimeout(() => setCartFeedback(null), 4500);
  };

  if (isLoading) return <LoadingState message="جاري فحص تفاصيل المنتج والمقاسات المتاحة..." />;
  if (error || !product) return <ErrorState message={error || 'المنتج غير موجود'} onRetry={onBack} />;

  const ArrowIcon = lang === 'ar' ? ArrowRight : ArrowLeft;

  // Extract unique sizes & colors
  const availableSizes = Array.from(new Set(product.variants?.map((v) => v.size) || []));
  const availableColors = Array.from(new Set(product.variants?.map((v) => v.color) || []));
  const currentPrice = selectedVariant?.price || product.base_price;
  const isOutOfStock = selectedVariant ? selectedVariant.stock_quantity <= 0 : false;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button */}
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
        >
          <ArrowIcon className="h-3.5 w-3.5" />
          <span>الرجوع للمنتجات</span>
        </button>
      </div>

      {/* Main Product Showcase Card */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 sm:p-10">
        {/* Left: Product Image */}
        <div className="space-y-4">
          <div className="aspect-square rounded-2xl bg-slate-100 overflow-hidden border border-slate-200 relative flex items-center justify-center">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <Shirt className="h-24 w-24 text-slate-300" />
            )}
            {selectedVariant && (
              <div className="absolute top-4 start-4 bg-slate-950/80 backdrop-blur-xs text-white text-[11px] font-mono font-medium px-2.5 py-1 rounded-md">
                SKU: {selectedVariant.sku}
              </div>
            )}
          </div>

          {/* Factory Quality Badges */}
          <div className="grid grid-cols-3 gap-3 text-center text-xs text-slate-600">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center gap-1">
              <Factory className="h-4 w-4 text-indigo-600" />
              <span className="font-semibold text-[11px]">مباشرة من المصنع</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center gap-1">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="font-semibold text-[11px]">معتمد ضد الانكماش</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center gap-1">
              <Truck className="h-4 w-4 text-indigo-600" />
              <span className="font-semibold text-[11px]">شحن لجميع المحافظات</span>
            </div>
          </div>
        </div>

        {/* Right: Product Info & Variant Selectors */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            {/* Category badge */}
            {product.category_name && (
              <span className="inline-block text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                {product.category_name}
              </span>
            )}

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-snug">
              {product.name}
            </h1>

            {/* Price section */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-slate-900">
                {currentPrice} {t.priceCurrency}
              </span>
              <span className="text-xs text-slate-500 font-medium">سعر الجملة والتجزئة للمصنع</span>
            </div>

            {/* Description */}
            <div className="border-t border-b border-slate-100 py-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                مواصفات وتفاصيل المنتج:
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                {product.description || 'خامات قطنية مصرية فاخرة مع درزات متينة وتقفيل احترافي مناسب للاستخدام المتكرر.'}
              </p>
            </div>

            {/* Available Variants Selector: Size */}
            {availableSizes.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900">
                    {t.size}: <span className="text-indigo-600">{selectedSize}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map((size) => {
                    const isSelected = selectedSize === size;
                    return (
                      <button
                        key={size}
                        onClick={() => handleSizeSelect(size)}
                        className={`min-w-12 h-10 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Available Variants Selector: Color */}
            {availableColors.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900">
                    {t.color}: <span className="text-indigo-600">{selectedColor}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map((color) => {
                    const isSelected = selectedColor === color;
                    return (
                      <button
                        key={color}
                        onClick={() => handleColorSelect(color)}
                        className={`h-10 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {color}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stock status */}
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2.5 h-2.5 rounded-full ${isOutOfStock ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <span className="font-semibold text-slate-700">
                {isOutOfStock
                  ? t.outOfStock
                  : `${selectedVariant?.stock_quantity || 0} ${t.stockAvailable}`}
              </span>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center gap-4 pt-2">
              <span className="text-xs font-bold text-slate-900">{t.quantity}:</span>
              <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white shadow-2xs">
                <button
                  type="button"
                  onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-s-xl text-sm font-bold cursor-pointer"
                >
                  -
                </button>
                <span className="w-10 text-center text-xs font-bold text-slate-900">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((prev) => prev + 1)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-e-xl text-sm font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-6 border-t border-slate-100 space-y-3">
            {cartFeedback && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{cartFeedback}</span>
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              icon={<ShoppingBag className="h-5 w-5" />}
              className="w-full text-base font-bold py-3.5 shadow-md shadow-indigo-600/20"
            >
              {t.addToCart}
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
              <Info className="h-3.5 w-3.5 text-slate-400" />
              <span>المرحلة الأولى: تجربة واجهة المنتج وحساب المتغيرات. السلة الكاملة في المرحلة التالية.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
