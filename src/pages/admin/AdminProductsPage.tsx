import React, { useState, useEffect } from 'react';
import { Layers, Plus, Trash2, Edit2, ShieldAlert, Check, RefreshCw } from 'lucide-react';
import { useAuth } from '../../lib/auth-context.tsx';
import { useI18n } from '../../lib/i18n.tsx';
import { Product, Category, ProductVariant } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { Table, Column } from '../../components/ui/Table.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';

export const AdminProductsPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Variants in creation
  const [variantsList, setVariantsList] = useState<{ sku: string; size: string; color: string; price: number; stock: number }[]>([
    { sku: '', size: 'M', color: 'أسود', price: 0, stock: 20 },
  ]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [prodRes, catRes] = await Promise.all([
        api.products.getAdminAll(),
        api.categories.getAll(),
      ]);
      if (prodRes.success) setProducts(prodRes.data);
      if (catRes.success) setCategories(catRes.data);
    } catch (err: any) {
      setError(err.message || 'فشل في تحميل قائمة المنتجات');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Strict RBAC check: Workers cannot access this module
  if (user?.role === 'WORKER') {
    return (
      <div className="p-8 bg-red-50 rounded-2xl border border-red-200 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-red-600 mx-auto" />
        <h3 className="font-bold text-red-950 text-base">غير مصرح بالوصول</h3>
        <p className="text-xs text-red-700 max-w-md mx-auto">
          صلاحيات فني التشغيل محددة فقط في استعراض وتحديث الطلبات المسندة إليه. لا يمكن لعمال التشغيل إدارة كتالوج منتجات المصنع.
        </p>
      </div>
    );
  }

  const handleAddVariantRow = () => {
    setVariantsList([
      ...variantsList,
      { sku: '', size: 'L', color: 'أبيض', price: Number(basePrice) || 0, stock: 15 },
    ]);
  };

  const handleRemoveVariantRow = (idx: number) => {
    setVariantsList(variantsList.filter((_, i) => i !== idx));
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug || !categoryId || !basePrice) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name,
        slug,
        category_id: Number(categoryId),
        description,
        base_price: Number(basePrice),
        image_url: imageUrl || null,
        variants: variantsList
          .filter((v) => v.sku.trim() !== '')
          .map((v) => ({
            sku: v.sku,
            size: v.size,
            color: v.color,
            price: v.price || Number(basePrice),
            stock_quantity: v.stock,
          })),
      };

      const res = await api.products.create(payload);
      if (res.success) {
        setIsModalOpen(false);
        // Reset form
        setName('');
        setSlug('');
        setCategoryId('');
        setDescription('');
        setBasePrice('');
        setImageUrl('');
        setVariantsList([{ sku: '', size: 'M', color: 'أسود', price: 0, stock: 20 }]);
        await loadData();
      }
    } catch (err: any) {
      alert(err.message || 'فشل في حفظ المنتج');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف أو أرشفة هذا المنتج؟')) return;
    try {
      const res = await api.products.delete(id);
      if (res.success) {
        await loadData();
      }
    } catch (err: any) {
      alert(err.message || 'فشل الحذف');
    }
  };

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'المنتج',
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold">
                P
              </div>
            )}
          </div>
          <div>
            <span className="font-bold text-slate-900 block text-xs">{p.name}</span>
            <span className="text-[11px] text-slate-500 font-mono">slug: {p.slug}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'category_name',
      header: 'القسم / التصنيف',
      render: (p) => (
        <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
          {p.category_name}
        </span>
      ),
    },
    {
      key: 'base_price',
      header: 'السعر الأساسي',
      render: (p) => (
        <span className="font-bold text-slate-900 text-xs">
          {p.base_price} {t.priceCurrency}
        </span>
      ),
    },
    {
      key: 'variants',
      header: 'المتغيرات (المقاسات والألوان)',
      render: (p) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {p.variants && p.variants.length > 0 ? (
            p.variants.map((v) => (
              <span
                key={v.id}
                className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
                title={`SKU: ${v.sku} - مخزون: ${v.stock_quantity}`}
              >
                {v.size} / {v.color}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-slate-400">بدون متغيرات</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      align: 'end',
      render: (p) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleDeleteProduct(p.id)}
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          icon={<Trash2 className="h-3.5 w-3.5" />}
        >
          حذف / أرشفة
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">كتالوج منتجات المصنع والمتغيرات</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            إدارة موديلات الملابس ومواصفات كل منتج من مقاسات وألوان وأكواد SKU ومخزون.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            icon={<Plus className="h-4 w-4" />}
          >
            إضافة منتج جديد
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} icon={<RefreshCw className="h-3.5 w-3.5" />}>
            تحديث
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="جاري جلب المنتجات..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <Table columns={columns} data={products} keyExtractor={(p) => p.id} emptyMessage="لا توجد منتجات مسجلة" />
      )}

      {/* Add Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="إضافة منتج جديد إلى خطوط الإنتاج"
        description="تسجيل البيانات الأساسية وتحديد المقاسات والألوان كمتغيرات مستقلة مرتبطة بالمنتج"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="اسم المنتج *"
              placeholder="مثال: تيشيرت بولو صيفي 240 جرام"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) {
                  setSlug(e.target.value.trim().replace(/\s+/g, '-').toLowerCase());
                }
              }}
              required
            />
            <Input
              label="الرابط الدلالي (Slug) *"
              placeholder="summer-polo-tshirt"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="التصنيف / القسم *"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="-- اختر القسم --"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            />
            <Input
              label="السعر الأساسي (ج.م) *"
              type="number"
              min="0"
              step="1"
              placeholder="350"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              required
            />
          </div>

          <Input
            label="رابط صورة المنتج (URL)"
            placeholder="https://images.unsplash.com/..."
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">وصف المنتج ومواصفات الخامة</label>
            <textarea
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              rows={3}
              placeholder="تفاصيل التقفيل، نسبة القطن، تعليمات الغسيل..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Variants section */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">متغيرات المنتج (Variants)</h4>
                <p className="text-[11px] text-slate-500">لا تنشئ منتجاً مستقلاً لكل مقاس؛ اربط المتغيرات هنا</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={handleAddVariantRow} icon={<Plus className="h-3 w-3" />}>
                إضافة مقاس/لون
              </Button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {variantsList.map((v, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <input
                    placeholder="كود SKU *"
                    value={v.sku}
                    onChange={(e) => {
                      const updated = [...variantsList];
                      updated[idx].sku = e.target.value;
                      setVariantsList(updated);
                    }}
                    className="w-28 text-xs p-1.5 border border-slate-300 rounded bg-white"
                    required
                  />
                  <input
                    placeholder="المقاس *"
                    value={v.size}
                    onChange={(e) => {
                      const updated = [...variantsList];
                      updated[idx].size = e.target.value;
                      setVariantsList(updated);
                    }}
                    className="w-20 text-xs p-1.5 border border-slate-300 rounded bg-white"
                    required
                  />
                  <input
                    placeholder="اللون *"
                    value={v.color}
                    onChange={(e) => {
                      const updated = [...variantsList];
                      updated[idx].color = e.target.value;
                      setVariantsList(updated);
                    }}
                    className="w-20 text-xs p-1.5 border border-slate-300 rounded bg-white"
                    required
                  />
                  <input
                    type="number"
                    placeholder="السعر"
                    value={v.price || ''}
                    onChange={(e) => {
                      const updated = [...variantsList];
                      updated[idx].price = Number(e.target.value);
                      setVariantsList(updated);
                    }}
                    className="w-20 text-xs p-1.5 border border-slate-300 rounded bg-white"
                  />
                  <input
                    type="number"
                    placeholder="المخزون"
                    value={v.stock || ''}
                    onChange={(e) => {
                      const updated = [...variantsList];
                      updated[idx].stock = Number(e.target.value);
                      setVariantsList(updated);
                    }}
                    className="w-16 text-xs p-1.5 border border-slate-300 rounded bg-white"
                  />
                  {variantsList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveVariantRow(idx)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              حفظ المنتج والمتغيرات
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
