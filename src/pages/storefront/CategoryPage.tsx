import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Shirt, Search, X } from 'lucide-react';
import { useI18n } from '../../lib/i18n.tsx';
import { Category, Product } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';

interface CategoryPageProps {
  categorySlug: string;
  onSelectProduct: (slug: string) => void;
  onBackToHome: () => void;
}

export const CategoryPage: React.FC<CategoryPageProps> = ({
  categorySlug,
  onSelectProduct,
  onBackToHome,
}) => {
  const { t, lang } = useI18n();

  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let isCancelled = false;
    async function loadCategoryAndProducts() {
      setIsLoading(true);
      setError(null);
      try {
        const catRes = await api.categories.getOne(categorySlug);
        if (catRes.success && catRes.data) {
          if (!isCancelled) {
            setCategory(catRes.data);
            const prodRes = await api.products.getAll({
              category_id: catRes.data.id,
              search: debouncedSearch.trim() || undefined,
            });
            if (prodRes.success && !isCancelled) {
              setProducts(prodRes.data);
            }
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'فشل في تحميل بيانات هذا القسم');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadCategoryAndProducts();
    return () => {
      isCancelled = true;
    };
  }, [categorySlug, debouncedSearch]);

  const ArrowIcon = lang === 'ar' ? ArrowRight : ArrowLeft;

  if (isLoading && !category) {
    return <LoadingState message="جاري فتح القسم والمنتجات..." />;
  }

  if (error || !category) {
    return (
      <ErrorState
        title="القسم غير متوفر"
        message={error || 'قد يكون هذا القسم تم تعطيله أو غير متوفر حالياً.'}
        onRetry={onBackToHome}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb Navigation */}
      <div>
        <button
          onClick={onBackToHome}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-4 cursor-pointer"
        >
          <ArrowIcon className="h-3.5 w-3.5" />
          <span>الرجوع إلى جميع الأقسام</span>
        </button>

        {/* Category Header Banner */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xs">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md">
                قسم إنتاج المصنع
              </span>
              <span className="text-xs text-slate-400 font-medium">({products.length} منتجات متاحة)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{category.name}</h1>
            {category.description && (
              <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                {category.description}
              </p>
            )}
          </div>

          {/* Search inside Category */}
          <div className="w-full md:w-72">
            <div className="relative">
              <Search className="absolute inset-y-0 start-3 my-auto h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={`ابحث داخل قسم ${category.name}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-300 ps-9 pe-8 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 end-2.5 my-auto text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid or Empty States */}
      {products.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-16 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Shirt className="h-8 w-8" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">
            {debouncedSearch
              ? 'لم نجد منتجات مطابقة لبحثك.'
              : 'لا توجد منتجات متاحة في هذا القسم حاليًا.'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {debouncedSearch
              ? 'جرّب البحث بكلمة أخرى أو تصفح باقي الأقسام.'
              : 'يمكنك تصفح باقي تشكيلة المصنع في الأقسام الأخرى.'}
          </p>
          <div className="pt-2">
            <button
              onClick={onBackToHome}
              className="text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
            >
              <span>العودة للرئيسية</span>
              <ArrowIcon className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              onClick={() => onSelectProduct(product.slug)}
              className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-lg transition-all duration-200 flex flex-col cursor-pointer"
            >
              <div className="aspect-square w-full bg-slate-100 overflow-hidden relative">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-slate-300">
                    <Shirt className="h-12 w-12" />
                  </div>
                )}
                {product.variants && product.variants.length > 0 && (
                  <span className="absolute bottom-2.5 start-2.5 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                    {product.variants.length} مقاسات/ألوان
                  </span>
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                    {product.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {product.description || 'ملابس بجودة مصنعية معتمدة.'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">سعر المصنع</span>
                    <span className="text-base font-black text-slate-900">
                      {product.base_price} {t.priceCurrency}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    عرض الخيارات
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
