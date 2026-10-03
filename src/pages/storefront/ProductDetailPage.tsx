import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Shirt,
  Check,
  ShoppingBag,
  ShieldCheck,
  Factory,
  Truck,
  AlertCircle,
  Info,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useI18n } from '../../lib/i18n.tsx';
import { useCart } from '../../lib/cart-context.tsx';
import { Product, ProductVariant } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { Button } from '../../components/ui/Button.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';

interface ProductDetailPageProps {
  productSlug: string;
  onBack: () => void;
  onSelectCategory: (slug: string) => void;
  onNavigateCart?: () => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  productSlug,
  onBack,
  onSelectCategory,
  onNavigateCart,
}) => {
  const { t, lang } = useI18n();
  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderFeedback, setOrderFeedback] = useState<string | null>(null);
  const [isSuccessFeedback, setIsSuccessFeedback] = useState<boolean>(true);

  useEffect(() => {
    async function loadProduct() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.products.getOne(productSlug);
        if (res.success && res.data) {
          const prod = res.data;
          setProduct(prod);
          setSelectedImage(prod.image_url || '');

          // Filter only active variants for storefront
          const activeVariants = (prod.variants || []).filter((v) => v.is_active === 1);

          if (activeVariants.length > 0) {
            // Find first in-stock variant or fallback to first
            const defaultVariant = activeVariants.find((v) => v.stock_quantity > 0) || activeVariants[0];
            setSelectedVariant(defaultVariant);
            setSelectedSize(defaultVariant.size);
            setSelectedColor(defaultVariant.color);
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

  const ArrowIcon = lang === 'ar' ? ArrowRight : ArrowLeft;

  if (isLoading) return <LoadingState message="جاري تجهيز مواصفات ومقاسات المنتج..." />;
  if (error || !product) {
    return (
      <ErrorState
        title="المنتج غير متوفر"
        message={error || 'هذا المنتج غير متاح حالياً أو تم إيقافه.'}
        onRetry={onBack}
      />
    );
  }

  // Active variants only
  const activeVariants = (product.variants || []).filter((v) => v.is_active === 1);

  // Unique available sizes and colors from active variants
  const availableColors = Array.from(new Set(activeVariants.map((v) => v.color)));
  const availableSizes = Array.from(new Set(activeVariants.map((v) => v.size)));

  // All gallery images
  const allImages = [
    ...(product.image_url ? [product.image_url] : []),
    ...(product.additional_images || []),
  ];

  // Helper to handle color click
  const handleColorClick = (color: string) => {
    setSelectedColor(color);
    const matchingVariant = activeVariants.find((v) => v.color === color && v.size === selectedSize)
      || activeVariants.find((v) => v.color === color);

    if (matchingVariant) {
      setSelectedVariant(matchingVariant);
      setSelectedSize(matchingVariant.size);
    }
  };

  // Sizes produced for currently selected color
  const sizesForSelectedColor = activeVariants
    .filter((v) => v.color === selectedColor)
    .map((v) => v.size);

  // Helper to handle size click
  const handleSizeClick = (size: string) => {
    setSelectedSize(size);
    const matchingVariant = activeVariants.find((v) => v.size === size && v.color === selectedColor);
    if (matchingVariant) {
      setSelectedVariant(matchingVariant);
    }
  };

  // Effective price: variant price if defined and > 0, otherwise product base price
  const effectivePrice = selectedVariant && selectedVariant.price ? selectedVariant.price : product.base_price;
  const isAvailable = selectedVariant ? selectedVariant.stock_quantity > 0 && selectedVariant.is_active === 1 : false;

  const handleAddToCart = () => {
    if (!product || product.is_active !== 1) {
      setIsSuccessFeedback(false);
      setOrderFeedback('هذا المنتج غير متاح حاليًا.');
      return;
    }

    if (!selectedVariant || selectedVariant.is_active !== 1) {
      setIsSuccessFeedback(false);
      setOrderFeedback('من فضلك اختر المقاس واللون.');
      return;
    }

    if (quantity <= 0) {
      setIsSuccessFeedback(false);
      setOrderFeedback('يجب أن تكون الكمية أكبر من صفر.');
      return;
    }

    if (quantity > selectedVariant.stock_quantity) {
      setIsSuccessFeedback(false);
      setOrderFeedback('الكمية المطلوبة غير متاحة بالمخزن حالياً.');
      return;
    }

    const result = addItem(
      {
        product_id: product.id,
        variant_id: selectedVariant.id,
        product_name: product.name,
        product_slug: product.slug,
        color: selectedVariant.color,
        size: selectedVariant.size,
        sku: selectedVariant.sku,
        price: effectivePrice,
        image_url: selectedImage || product.image_url,
        stock_quantity: selectedVariant.stock_quantity,
        is_active: true,
      },
      quantity
    );

    if (result.success) {
      setIsSuccessFeedback(true);
      setOrderFeedback('تمت إضافة المنتج إلى السلة.');
      setTimeout(() => setOrderFeedback(null), 5000);
    } else {
      setIsSuccessFeedback(false);
      setOrderFeedback(result.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Return button */}
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
        >
          <ArrowIcon className="h-3.5 w-3.5" />
          <span>الرجوع للمنتجات</span>
        </button>
      </div>

      {/* Product Detail Layout */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 sm:p-10">
        {/* Left: Image Gallery */}
        <div className="space-y-4">
          <div className="aspect-square rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden relative flex items-center justify-center">
            {selectedImage ? (
              <img
                src={selectedImage}
                alt={product.name}
                className="h-full w-full object-cover object-center transition-all duration-300"
              />
            ) : (
              <Shirt className="h-24 w-24 text-slate-300" />
            )}

            {selectedVariant && (
              <div className="absolute top-4 start-4 bg-slate-950/85 backdrop-blur-xs text-white text-[11px] font-mono px-2.5 py-1 rounded-md">
                SKU: {selectedVariant.sku}
              </div>
            )}
          </div>

          {/* Additional Images Thumbnail Selector (Gallery) */}
          {allImages.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                    selectedImage === img
                      ? 'border-indigo-600 shadow-md ring-2 ring-indigo-100'
                      : 'border-slate-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="thumbnail" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Quality Assurance Badges */}
          <div className="grid grid-cols-3 gap-3 text-center text-xs text-slate-600 pt-2">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center gap-1">
              <Factory className="h-4 w-4 text-indigo-600" />
              <span className="font-semibold text-[11px]">مباشرة من المصنع</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center gap-1">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="font-semibold text-[11px]">خامة معتمدة</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center gap-1">
              <Truck className="h-4 w-4 text-indigo-600" />
              <span className="font-semibold text-[11px]">شحن لجميع المحافظات</span>
            </div>
          </div>
        </div>

        {/* Right: Info & Variant Selection */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            {/* Category tag */}
            {product.category_name && (
              <button
                onClick={() => product.category_slug && onSelectCategory(product.category_slug)}
                className="inline-block text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-md transition-colors cursor-pointer"
              >
                {product.category_name}
              </button>
            )}

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-snug">
              {product.name}
            </h1>

            {/* Effective Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-slate-900">
                {effectivePrice} {t.priceCurrency}
              </span>
              <span className="text-xs text-slate-400 font-medium">سعر المصنع للقطعة</span>
            </div>

            {/* Description */}
            <div className="border-t border-b border-slate-100 py-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                مواصفات وخامة المنتج:
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                {product.description || 'ملابس جاهزة مصنعة من أجود الخامات القطنية بأعلى معايير الحياكة والتقفيل.'}
              </p>
            </div>

            {/* Color selection */}
            {availableColors.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900">
                    اللون: <span className="text-indigo-600">{selectedColor}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map((color) => {
                    const isSelected = selectedColor === color;
                    return (
                      <button
                        key={color}
                        onClick={() => handleColorClick(color)}
                        className={`h-9 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
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

            {/* Size selection */}
            {availableSizes.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900">
                    المقاس: <span className="text-indigo-600">{selectedSize}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map((size) => {
                    const isSelected = selectedSize === size;
                    const isAvailableInColor = sizesForSelectedColor.includes(size);
                    return (
                      <button
                        key={size}
                        disabled={!isAvailableInColor}
                        onClick={() => handleSizeClick(size)}
                        className={`min-w-12 h-9 px-3.5 rounded-xl text-xs font-bold transition-all border ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-200'
                            : isAvailableInColor
                            ? 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 cursor-pointer'
                            : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50 line-through'
                        }`}
                        title={isAvailableInColor ? `مقاس ${size}` : `هذا المقاس غير متوفر بلون ${selectedColor}`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Availability Status */}
            <div>
              {isAvailable ? (
                <div className="inline-flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>متوفر بالمخزون ({selectedVariant?.stock_quantity} قطعة جاهزة للتسليم)</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>غير متاح حاليًا (المقاس أو اللون المحدد غير متوفر بالمخزن)</span>
                </div>
              )}
            </div>

            {/* Quantity Selector */}
            {isAvailable && (
              <div className="flex items-center gap-4 pt-1">
                <span className="text-xs font-bold text-slate-900">الكمية المطلوبة:</span>
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
                    onClick={() =>
                      setQuantity((prev) => Math.min(selectedVariant?.stock_quantity || 99, prev + 1))
                    }
                    className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-e-xl text-sm font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-6 border-t border-slate-100 space-y-3">
            <Button
              variant="primary"
              size="lg"
              onClick={handleAddToCart}
              disabled={!isAvailable}
              icon={<ShoppingBag className="h-5 w-5" />}
              className="w-full text-base font-bold py-3.5 shadow-md shadow-indigo-600/20"
            >
              {!selectedVariant
                ? 'من فضلك اختر المقاس واللون'
                : !isAvailable
                ? 'غير متوفر بالمخزن (المخزون 0)'
                : 'إضافة للسلة'}
            </Button>

            {orderFeedback && (
              <div
                className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 ${
                  isSuccessFeedback
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isSuccessFeedback ? (
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                  )}
                  <span>{orderFeedback}</span>
                </div>
                {isSuccessFeedback && onNavigateCart && (
                  <button
                    type="button"
                    onClick={onNavigateCart}
                    className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer shrink-0"
                  >
                    عرض السلة
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>تسوق آمن ومباشر من المصنع — الدفع عند الاستلام بعد فحص الجودة</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
