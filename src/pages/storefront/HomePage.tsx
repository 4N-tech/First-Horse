import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Shirt,
  Search,
  CheckCircle2,
  Shield,
  Sparkles,
  Filter,
  Layers,
  X,
} from 'lucide-react';
import { useI18n } from '../../lib/i18n.tsx';
import { Category, Product } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';

interface HomePageProps {
  onSelectCategory: (slug: string) => void;
  onSelectProduct: (slug: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onSelectCategory, onSelectProduct }) => {
  const { t, lang } = useI18n();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search query by 300ms to avoid unnecessary database queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load Categories (Active only)
  useEffect(() => {
    api.categories
      .getAll()
      .then((res) => {
        if (res.success) setCategories(res.data);
      })
      .catch((e) => console.error(e));
  }, []);

  // Load Products (Active only) whenever category filter or search query changes
  useEffect(() => {
    let isCancelled = false;
    async function fetchProducts() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.products.getAll({
          category_slug: selectedCategorySlug || undefined,
          search: debouncedSearch.trim() || undefined,
        });

        if (!isCancelled && res.success) {
          setProducts(res.data);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'فشل في تحميل قائمة المنتجات');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchProducts();
    return () => {
      isCancelled = true;
    };
  }, [selectedCategorySlug, debouncedSearch]);

  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 text-white py-14 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="relative max-w-4xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-400/20 text-indigo-300 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>منتجات ملابس أصلية مباشرة من خطوط إنتاج المصنع</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            {t.heroTitle}
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            {t.heroSubtitle}
          </p>

          {/* Search Bar in Hero */}
          <div className="pt-2 max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute inset-y-0 start-4 my-auto h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث باسم المنتج أو نوع الملابس..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 ps-12 pe-10 py-3.5 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white/20 transition-all shadow-lg"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 end-3.5 my-auto h-5 w-5 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Categories Carousel / Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-6 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">{t.featuredCategories}</h2>
            <p className="text-xs text-slate-500 mt-0.5">تصفح أقسام المصنع النشطة</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {categories.map((category) => (
            <div
              key={category.id}
              onClick={() => onSelectCategory(category.slug)}
              className="group relative rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col"
            >
              <div className="aspect-4/3 w-full bg-slate-100 overflow-hidden relative">
                {category.image_url ? (
                  <img
                    src={category.image_url}
                    alt={category.name}
                    className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-slate-400">
                    <Shirt className="h-10 w-10" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
                <div className="absolute bottom-2.5 start-3 end-3 text-white">
                  <h3 className="font-bold text-sm sm:text-base">{category.name}</h3>
                  <span className="text-[11px] text-slate-200 font-medium">
                    {category.product_count || 0} منتج متوفر
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Catalog & Filter Section */}
      <section id="products-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">{t.featuredProducts}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {debouncedSearch
                ? `نتائج البحث عن "${debouncedSearch}"`
                : selectedCategorySlug
                ? `منتجات قسم ${categories.find((c) => c.slug === selectedCategorySlug)?.name || ''}`
                : 'جميع المنتجات الجاهزة للشحن والتوريد'}
            </p>
          </div>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setSelectedCategorySlug('')}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                !selectedCategorySlug
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              كل المنتجات
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategorySlug(c.slug)}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  selectedCategorySlug === c.slug
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <LoadingState message="جاري جلب أحدث المنتجات..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setSelectedCategorySlug('')} />
        ) : products.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <Shirt className="h-8 w-8" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">
              {debouncedSearch
                ? 'لم نجد منتجات مطابقة لبحثك.'
                : selectedCategorySlug
                ? 'لا توجد منتجات متاحة في هذا القسم حاليًا.'
                : 'لا توجد منتجات متاحة حاليًا.'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {debouncedSearch ? 'جرّب البحث بكلمة أخرى أو تصفح الأقسام مباشرة.' : 'تابعنا قريباً للمزيد من تشكيلات المصنع الجديدة.'}
            </p>
            {debouncedSearch && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 inline-flex items-center text-xs font-bold text-indigo-600 hover:underline"
              >
                إلغاء البحث وعرض كل المنتجات
              </button>
            )}
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

                  {product.category_name && (
                    <span className="absolute top-3 start-3 bg-white/95 backdrop-blur-xs text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded shadow-xs">
                      {product.category_name}
                    </span>
                  )}

                  {product.variants && product.variants.length > 0 && (
                    <span className="absolute bottom-2.5 start-2.5 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                      {product.variants.length} مقاسات وألوان
                    </span>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {product.description || 'ملابس قطنية معالجة ومصنعة بعناية.'}
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
      </section>
    </div>
  );
};
