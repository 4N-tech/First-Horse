import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Shirt, ArrowRightCircle } from 'lucide-react';
import { useI18n } from '../../lib/i18n.tsx';
import { Category, Product } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCategoryData() {
      setIsLoading(true);
      setError(null);
      try {
        const catRes = await api.categories.getOne(categorySlug);
        if (catRes.success) {
          setCategory(catRes.data);
          const prodRes = await api.products.getAll({ category_id: catRes.data.id });
          if (prodRes.success) {
            setProducts(prodRes.data);
          }
        }
      } catch (err: any) {
        setError(err.message || 'فشل في تحميل بيانات التصنيف');
      } finally {
        setIsLoading(false);
      }
    }
    loadCategoryData();
  }, [categorySlug]);

  if (isLoading) return <LoadingState message="جاري تحميل منتجات القسم..." />;
  if (error || !category) return <ErrorState message={error || 'التصنيف غير موجود'} onRetry={onBackToHome} />;

  const ArrowIcon = lang === 'ar' ? ArrowRight : ArrowLeft;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb & Header */}
      <div>
        <button
          onClick={onBackToHome}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-4 cursor-pointer"
        >
          <ArrowIcon className="h-3.5 w-3.5" />
          <span>العودة لجميع الأقسام</span>
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                قسم إنتاج المصنع
              </span>
              <span className="text-xs text-slate-400 font-medium">({products.length} منتجات متوفرة)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{category.name}</h1>
            {category.description && (
              <p className="mt-2 text-sm text-slate-600 max-w-2xl leading-relaxed">
                {category.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <EmptyState
          title="لا توجد منتجات مسجلة في هذا القسم حالياً"
          description="يمكن لإدارة المصنع إضافة منتجات جديدة وتحديد متغيرات المقاسات والألوان من لوحة التحكم."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              onClick={() => onSelectProduct(product.slug)}
              className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col cursor-pointer"
            >
              <div className="aspect-4/4 w-full bg-slate-100 overflow-hidden relative">
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
                  <span className="absolute bottom-2 start-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded">
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
                    {product.description}
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
