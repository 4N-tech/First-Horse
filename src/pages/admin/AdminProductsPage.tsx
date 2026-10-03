import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Eye,
  Power,
  Upload,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context.tsx';
import { useI18n } from '../../lib/i18n.tsx';
import { Product, Category, ProductVariant } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { Table, Column } from '../../components/ui/Table.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';

interface VariantRow {
  id?: number;
  sku: string;
  size: string;
  color: string;
  price: string | number;
  stock_quantity: string | number;
  is_active: boolean;
}

const PRESET_COLORS = [
  'أسود',
  'أبيض',
  'كحلي',
  'رمادي',
  'بيج',
  'أحمر',
  'أزرق',
  'زيتي',
  'أخضر',
  'بني',
  'كافيه',
  'عنابي',
];

const PRESET_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '38', '40', '42', '44', '46'];

export const AdminProductsPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();

  // Product List & Pagination State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Form Modal (Add / Edit)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [mainImageUrl, setMainImageUrl] = useState('');
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [newAdditionalImageUrl, setNewAdditionalImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingMain, setIsUploadingMain] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);

  // Bulk Variant Generator State
  const [isBulkGeneratorOpen, setIsBulkGeneratorOpen] = useState(false);
  const [selectedBulkColors, setSelectedBulkColors] = useState<string[]>(['أسود', 'أبيض']);
  const [selectedBulkSizes, setSelectedBulkSizes] = useState<string[]>(['M', 'L', 'XL']);
  const [customColorInput, setCustomColorInput] = useState('');
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [bulkDefaultStock, setBulkDefaultStock] = useState('20');
  const [bulkCustomPrice, setBulkCustomPrice] = useState('');

  // View Preview Modal
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Load Categories & Products
  const loadCategories = async () => {
    try {
      const res = await api.categories.getAdminAll();
      if (res.success) setCategories(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.products.getAdminAll({
        page: currentPage,
        limit: pageSize,
        category_id: selectedCategoryFilter ? Number(selectedCategoryFilter) : undefined,
        search: searchQuery.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });

      if (res.success) {
        setProducts(res.data);
        if (res.pagination) {
          setTotalCount(res.pagination.total);
          setTotalPages(res.pagination.totalPages);
        }
      }
    } catch (err: any) {
      setError(err.message || 'فشل تحميل المنتجات');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [currentPage, pageSize, selectedCategoryFilter, statusFilter]);

  // Handle Search submit / debounce
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadProducts();
  };

  // Worker role check
  if (user?.role === 'WORKER') {
    return (
      <div className="p-8 bg-red-50 rounded-2xl border border-red-200 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-red-600 mx-auto" />
        <h3 className="font-bold text-red-950 text-base">غير مصرح بالوصول</h3>
        <p className="text-xs text-red-700 max-w-md mx-auto">
          صلاحيات فني التشغيل محددة في استعراض وتحديث الطلبات المسندة فقط.
        </p>
      </div>
    );
  }

  // Auto SKU generator helper
  const suggestSku = (prodName: string, color: string, size: string) => {
    const pPrefix = prodName
      ? prodName
          .trim()
          .split(' ')
          .slice(0, 2)
          .map((w) => w.charAt(0))
          .join('')
          .toUpperCase()
      : 'PR';

    const colorMap: Record<string, string> = {
      أسود: 'BLK',
      أبيض: 'WHT',
      كحلي: 'NVY',
      أزرق: 'BLU',
      أحمر: 'RED',
      رمادي: 'GRY',
      بيج: 'BEI',
      زيتي: 'OLV',
      أصفر: 'YEL',
      بني: 'BRN',
      أخضر: 'GRN',
    };

    const cCode = colorMap[color.trim()] || color.trim().slice(0, 3).toUpperCase() || 'COL';
    const sCode = size.trim().toUpperCase() || 'SZ';
    const randomSuffix = Math.floor(10 + Math.random() * 90);

    return `${pPrefix}-${cCode}-${sCode}-${randomSuffix}`;
  };

  // Bulk Variant Generator Handlers
  const handleToggleBulkColor = (color: string) => {
    setSelectedBulkColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  const handleToggleBulkSize = (size: string) => {
    setSelectedBulkSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const handleAddCustomColor = () => {
    const val = customColorInput.trim();
    if (!val) return;
    if (!selectedBulkColors.includes(val)) {
      setSelectedBulkColors((prev) => [...prev, val]);
    }
    setCustomColorInput('');
  };

  const handleAddCustomSize = () => {
    const val = customSizeInput.trim().toUpperCase();
    if (!val) return;
    if (!selectedBulkSizes.includes(val)) {
      setSelectedBulkSizes((prev) => [...prev, val]);
    }
    setCustomSizeInput('');
  };

  const handleGenerateBulkVariants = () => {
    if (selectedBulkColors.length === 0 || selectedBulkSizes.length === 0) {
      alert('يرجى اختيار لون واحد ومقاس واحد على الأقل للتوليد');
      return;
    }

    const currentVariants = [...variants];
    const seenCombos = new Set(
      currentVariants.map((v) => `${v.size.trim().toLowerCase()}__${v.color.trim().toLowerCase()}`)
    );
    let addedCount = 0;

    for (const color of selectedBulkColors) {
      for (const size of selectedBulkSizes) {
        const comboKey = `${size.trim().toLowerCase()}__${color.trim().toLowerCase()}`;
        if (!seenCombos.has(comboKey)) {
          const sku = suggestSku(name, color, size);
          currentVariants.push({
            sku,
            size: size.trim(),
            color: color.trim(),
            price: bulkCustomPrice.trim() !== '' ? bulkCustomPrice.trim() : '',
            stock_quantity: !isNaN(Number(bulkDefaultStock)) ? Number(bulkDefaultStock) : 20,
            is_active: true,
          });
          seenCombos.add(comboKey);
          addedCount++;
        }
      }
    }

    setVariants(currentVariants);
    setIsBulkGeneratorOpen(false);
    setNotice({
      type: 'success',
      message: `تم توليد وإضافة ${addedCount} متغير بنجاح (من إجمالي ${selectedBulkColors.length * selectedBulkSizes.length} توافق)`,
    });
  };

  // Open Add Product Modal
  const handleOpenCreate = () => {
    setEditingProduct(null);
    setName('');
    setSlug('');
    setCategoryId(categories.length > 0 ? String(categories[0].id) : '');
    setDescription('');
    setBasePrice('');
    setMainImageUrl('');
    setAdditionalImages([]);
    setIsActive(true);
    setVariants([
      { sku: 'TS-BLK-M', size: 'M', color: 'أسود', price: '', stock_quantity: 20, is_active: true },
      { sku: 'TS-BLK-L', size: 'L', color: 'أسود', price: '', stock_quantity: 20, is_active: true },
    ]);
    setIsFormModalOpen(true);
  };

  // Open Edit Product Modal
  const handleOpenEdit = async (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name);
    setSlug(prod.slug);
    setCategoryId(String(prod.category_id));
    setDescription(prod.description || '');
    setBasePrice(String(prod.base_price));
    setMainImageUrl(prod.image_url || '');
    setAdditionalImages(prod.additional_images || []);
    setIsActive(prod.is_active === 1);

    // Map existing variants
    if (prod.variants && prod.variants.length > 0) {
      setVariants(
        prod.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          price: v.price !== prod.base_price ? v.price : '',
          stock_quantity: v.stock_quantity,
          is_active: v.is_active === 1,
        }))
      );
    } else {
      setVariants([]);
    }

    setIsFormModalOpen(true);
  };

  // Duplicate Product Action
  const handleDuplicate = async (prod: Product) => {
    if (!window.confirm(`هل ترغب في إنشاء نسخة مكررة من منتج (${prod.name}) مع جميع متغيراته؟`)) return;
    try {
      const res = await api.products.duplicate(prod.id);
      if (res.success) {
        setNotice({ type: 'success', message: res.message });
        await loadProducts();
      }
    } catch (err: any) {
      alert(err.message || 'فشل تكرار المنتج');
    }
  };

  // Toggle Product Active Status
  const handleToggleProductStatus = async (prod: Product) => {
    try {
      const res = await api.products.toggleStatus(prod.id);
      if (res.success) {
        setNotice({ type: 'success', message: res.message });
        await loadProducts();
      }
    } catch (err: any) {
      alert(err.message || 'فشل تغيير حالة المنتج');
    }
  };

  // Delete Product
  const handleDeleteProduct = async (prod: Product) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف أو أرشفة المنتج (${prod.name})؟`)) return;
    try {
      const res = await api.products.delete(prod.id);
      if (res.success) {
        setNotice({ type: 'success', message: res.message });
        await loadProducts();
      }
    } catch (err: any) {
      alert(err.message || 'فشل الحذف');
    }
  };

  // Main Image Upload
  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingMain(true);
    try {
      const res = await api.upload.image(file);
      if (res.success && res.url) {
        setMainImageUrl(res.url);
      }
    } catch (err: any) {
      alert(err.message || 'فشل رفع الصورة');
    } finally {
      setIsUploadingMain(false);
    }
  };

  // Gallery Image Upload
  const handleGalleryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingGallery(true);
    try {
      const res = await api.upload.image(file);
      if (res.success && res.url) {
        setAdditionalImages((prev) => [...prev, res.url]);
      }
    } catch (err: any) {
      alert(err.message || 'فشل رفع الصورة');
    } finally {
      setIsUploadingGallery(false);
    }
  };

  const handleAddGalleryUrl = () => {
    if (!newAdditionalImageUrl.trim()) return;
    setAdditionalImages((prev) => [...prev, newAdditionalImageUrl.trim()]);
    setNewAdditionalImageUrl('');
  };

  const handleRemoveGalleryImage = (idx: number) => {
    setAdditionalImages((prev) => prev.filter((_, i) => i !== idx));
  };

  // Variant Rows Management
  const handleAddVariantRow = () => {
    const defaultColor = 'أسود';
    const defaultSize = 'M';
    const generatedSku = suggestSku(name, defaultColor, defaultSize);

    setVariants([
      ...variants,
      {
        sku: generatedSku,
        size: defaultSize,
        color: defaultColor,
        price: '',
        stock_quantity: 15,
        is_active: true,
      },
    ]);
  };

  const handleRemoveVariantRow = (idx: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit Product Form
  const handleSubmitProductForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('اسم المنتج مطلوب');
      return;
    }
    if (!categoryId) {
      alert('يرجى اختيار القسم التابع له المنتج');
      return;
    }
    if (!basePrice || isNaN(Number(basePrice)) || Number(basePrice) < 0) {
      alert('السعر الأساسي يجب أن يكون رقماً موجباً');
      return;
    }

    // Business Logic: Product must have at least one active variant before it can be activated
    if (isActive) {
      const activeCount = variants.filter((v) => v.is_active).length;
      if (activeCount === 0) {
        alert('يجب إضافة وتفعيل متغير واحد على الأقل (مقاس ولون) قبل تفعيل المنتج للعملاء في المتجر.');
        return;
      }
    }

    // Client-side Duplicate Variant Validation
    const seenCombos = new Set<string>();
    const seenSkus = new Set<string>();

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v.sku.trim()) {
        alert(`يرجى كتابة كود SKU للمتغير رقم ${i + 1}`);
        return;
      }
      if (!v.size.trim() || !v.color.trim()) {
        alert(`يرجى تحديد المقاس واللون للمتغير رقم ${i + 1}`);
        return;
      }

      const skuClean = v.sku.trim().toUpperCase();
      if (seenSkus.has(skuClean)) {
        alert(`كود SKU (${skuClean}) مكرر في قائمة المتغيرات`);
        return;
      }
      seenSkus.add(skuClean);

      const comboKey = `${v.size.trim().toLowerCase()}__${v.color.trim().toLowerCase()}`;
      if (seenCombos.has(comboKey)) {
        alert(`المتغير (المقاس: ${v.size} واللون: ${v.color}) مكرر لهذا المنتج، يرجى إزالة التكرار`);
        return;
      }
      seenCombos.add(comboKey);
    }

    setIsSubmitting(true);
    setNotice(null);
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        category_id: Number(categoryId),
        description: description.trim() || null,
        base_price: Number(basePrice),
        image_url: mainImageUrl.trim() || null,
        additional_images: additionalImages,
        is_active: isActive ? 1 : 0,
        variants: variants.map((v) => ({
          id: v.id,
          sku: v.sku.trim().toUpperCase(),
          size: v.size.trim(),
          color: v.color.trim(),
          price: v.price !== '' && !isNaN(Number(v.price)) ? Number(v.price) : Number(basePrice),
          stock_quantity: !isNaN(Number(v.stock_quantity)) ? Number(v.stock_quantity) : 0,
          is_active: v.is_active ? 1 : 0,
        })),
      };

      if (editingProduct) {
        const res = await api.products.update(editingProduct.id, payload);
        if (res.success) {
          setNotice({ type: 'success', message: 'تم تحديث بيانات المنتج والمتغيرات بنجاح' });
        }
      } else {
        const res = await api.products.create(payload);
        if (res.success) {
          setNotice({ type: 'success', message: 'تم إنشاء المنتج والمتغيرات بنجاح' });
        }
      }

      setIsFormModalOpen(false);
      await loadProducts();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حفظ المنتج');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Columns definition
  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'المنتج',
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
            ) : (
              <Layers className="h-6 w-6 text-slate-300" />
            )}
          </div>
          <div>
            <span className="font-bold text-slate-900 block text-xs">{p.name}</span>
            <span className="text-[11px] text-slate-400 font-mono">slug: {p.slug}</span>
            {p.additional_images && p.additional_images.length > 0 && (
              <span className="text-[10px] text-indigo-600 block mt-0.5 font-medium">
                + {p.additional_images.length} صور في المعرض
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'category_name',
      header: 'القسم',
      render: (p) => (
        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
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
      key: 'variants_count',
      header: 'المتغيرات',
      render: (p) => {
        const count = p.variants?.length ?? p.variants_count ?? 0;
        return (
          <span className="inline-flex items-center text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
            {count} مقاس ولون
          </span>
        );
      },
    },
    {
      key: 'is_active',
      header: 'الحالة',
      render: (p) => (
        <button
          onClick={() => handleToggleProductStatus(p)}
          className="cursor-pointer"
          title="انقر لتغيير حالة التفعيل"
        >
          {p.is_active === 1 ? <Badge variant="success">نشط</Badge> : <Badge variant="neutral">معطل</Badge>}
        </button>
      ),
    },
    {
      key: 'created_at',
      header: 'تاريخ الإضافة',
      render: (p) => <span className="text-[11px] text-slate-500 font-mono">{p.created_at?.slice(0, 10)}</span>,
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      align: 'end',
      render: (p) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setPreviewProduct(p);
              setIsPreviewModalOpen(true);
            }}
            icon={<Eye className="h-3.5 w-3.5" />}
            title="معاينة تفاصيل المنتج والمعرض"
          >
            معاينة
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenEdit(p)}
            icon={<Edit2 className="h-3.5 w-3.5" />}
          >
            تعديل
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDuplicate(p)}
            className="text-indigo-600 hover:bg-indigo-50"
            icon={<Copy className="h-3.5 w-3.5" />}
            title="تكرار المنتج (Duplicate)"
          >
            نسخ
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleToggleProductStatus(p)}
            className={p.is_active === 1 ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}
            icon={<Power className="h-3.5 w-3.5" />}
            title={p.is_active === 1 ? 'تعطيل المنتج' : 'تفعيل المنتج'}
          >
            {p.is_active === 1 ? 'تعطيل' : 'تفعيل'}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteProduct(p)}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            icon={<Trash2 className="h-3.5 w-3.5" />}
          >
            حذف
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">إدارة كتالوج المنتجات والمتغيرات</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            إضافة وتعديل موديلات الملابس، معرض الصور، ضبط الأسعار، وإدارة مقاسات وألوان كل منتج.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={handleOpenCreate} icon={<Plus className="h-4 w-4" />}>
            إضافة منتج جديد
          </Button>
          <Button variant="outline" size="sm" onClick={loadProducts} icon={<RefreshCw className="h-3.5 w-3.5" />}>
            تحديث
          </Button>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            notice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{notice.message}</span>
          </div>
          <button onClick={() => setNotice(null)} className="hover:underline text-xs">
            إغلاق
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute inset-y-0 start-3 my-auto h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث باسم المنتج أو الرابط أو القسم..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-300 ps-9 pe-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            بحث
          </Button>
        </form>

        {/* Category & Status Filters */}
        <div className="flex items-center gap-2">
          <select
            value={selectedCategoryFilter}
            onChange={(e) => {
              setSelectedCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-700"
          >
            <option value="">جميع الأقسام</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-700"
          >
            <option value="all">كل الحالات</option>
            <option value="active">النشطة فقط</option>
            <option value="inactive">المعطلة فقط</option>
          </select>

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="text-xs rounded-xl border border-slate-300 px-2.5 py-2 bg-white text-slate-700"
            title="عدد النتائج في الصفحة"
          >
            <option value="20">20 في الصفحة</option>
            <option value="50">50 في الصفحة</option>
            <option value="100">100 في الصفحة</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingState message="جاري جلب المنتجات..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadProducts} />
      ) : (
        <div className="space-y-3">
          <Table
            columns={columns}
            data={products}
            keyExtractor={(p) => p.id}
            emptyMessage="لا توجد منتجات مسجلة تطابق معايير البحث."
          />

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 text-xs text-slate-600">
              <div>
                إجمالي المنتجات: <span className="font-bold text-slate-900">{totalCount}</span> | صفحة{' '}
                <span className="font-bold">{currentPage}</span> من <span className="font-bold">{totalPages}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  icon={<ChevronRight className="h-3.5 w-3.5" />}
                >
                  السابق
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-slate-400">...</span>}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={`min-w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                          currentPage === p
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}

                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  icon={<ChevronLeft className="h-3.5 w-3.5" />}
                >
                  التالي
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingProduct ? `تعديل منتج: ${editingProduct.name}` : 'إضافة منتج جديد وتحديد متغيراته'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmitProductForm} className="space-y-6 text-xs">
          {/* Section 1: Basic Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase text-indigo-900 border-b border-slate-100 pb-1.5">
              1. البيانات الأساسية للمنتج
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="اسم المنتج *"
                placeholder="مثال: تيشيرت قطن ممشط فاخر 220 جرام"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editingProduct && !slug) {
                    setSlug(e.target.value.trim().replace(/\s+/g, '-').toLowerCase());
                  }
                }}
                required
              />

              <Input
                label="الرابط الدلالي (Slug) *"
                placeholder="classic-cotton-tshirt"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Select
                  label="القسم / التصنيف *"
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  placeholder="-- اختر القسم --"
                  required
                />
              </div>

              <div>
                <Input
                  label="السعر الأساسي (ج.م) *"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="280"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">وصف المنتج ومواصفات الخامة</label>
              <textarea
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                rows={2}
                placeholder="تفاصيل التقفيل، نسبة القطن، تعليمات الغسيل والملمس..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="prod_active_checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="prod_active_checkbox" className="text-xs font-semibold text-slate-800 cursor-pointer">
                المنتج نشط ومتاح للظهور في المتجر العام
              </label>
            </div>
          </div>

          {/* Section 2: Product Images & Gallery */}
          <div className="space-y-4 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-black uppercase text-indigo-900 border-b border-slate-100 pb-1.5">
              2. صورة المنتج الرئيسية ومعرض الصور الإضافية
            </h4>

            {/* Main Image */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                الصورة الرئيسية (تظهر في الكروت والنتائج وصفحة المنتج)
              </label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                  {mainImageUrl ? (
                    <img src={mainImageUrl} alt="الرئيسية" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{isUploadingMain ? 'جاري الرفع...' : 'رفع صورة من الجهاز'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handleMainImageUpload}
                        disabled={isUploadingMain}
                      />
                    </label>
                    {mainImageUrl && (
                      <button
                        type="button"
                        onClick={() => setMainImageUrl('')}
                        className="text-xs text-red-600 hover:underline"
                      >
                        إزالة
                      </button>
                    )}
                  </div>
                  <Input
                    placeholder="أو ضع رابط صورة مباشر (URL)"
                    value={mainImageUrl}
                    onChange={(e) => setMainImageUrl(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Additional Images (Gallery) */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-800">معرض الصور الإضافية (Gallery)</label>
                  <p className="text-[10px] text-slate-500">تظهر هذه الصور في معرض التبديل داخل صفحة تفاصيل المنتج</p>
                </div>
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{isUploadingGallery ? 'جاري الرفع...' : 'إضافة صورة للمعرض'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleGalleryImageUpload}
                    disabled={isUploadingGallery}
                  />
                </label>
              </div>

              {/* Add by URL */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="أو اكتب رابط صورة إضافية ثم اضغط إضافة..."
                  value={newAdditionalImageUrl}
                  onChange={(e) => setNewAdditionalImageUrl(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 p-1.5 text-xs bg-white"
                />
                <Button type="button" size="sm" variant="outline" onClick={handleAddGalleryUrl}>
                  إضافة
                </Button>
              </div>

              {/* Gallery Thumbnails List */}
              {additionalImages.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {additionalImages.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative w-16 h-16 rounded-lg bg-white border border-slate-300 overflow-hidden group"
                    >
                      <img src={img} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveGalleryImage(idx)}
                        className="absolute inset-0 bg-red-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="حذف الصورة من المعرض"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Product Variants */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
              <div>
                <h4 className="text-xs font-black uppercase text-indigo-900">
                  3. متغيرات المنتج (المقاسات والألوان وأكواد SKU)
                </h4>
                <p className="text-[11px] text-slate-500">
                  يمنع النظام تكرار نفس المقاس واللون للمنتج، ويضمن تفرد كود SKU.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsBulkGeneratorOpen((prev) => !prev)}
                  className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                  icon={<Sparkles className="h-3.5 w-3.5 text-indigo-600" />}
                >
                  {isBulkGeneratorOpen ? 'إغلاق التوليد السريع' : 'توليد سريع للمتغيرات (Bulk Generator) ⚡'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleAddVariantRow} icon={<Plus className="h-3 w-3" />}>
                  إضافة مقاس/لون مفرد
                </Button>
              </div>
            </div>

            {/* Collapsible Bulk Variant Generator Panel */}
            {isBulkGeneratorOpen && (
              <div className="p-4 bg-gradient-to-br from-indigo-50/70 via-slate-50 to-white rounded-2xl border border-indigo-200 shadow-xs space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    <h5 className="font-bold text-xs text-indigo-950">
                      التوليد التلقائي لجميع توافقات المقاسات والألوان (Bulk Variant Generator)
                    </h5>
                  </div>
                  <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                    {selectedBulkColors.length * selectedBulkSizes.length} متغير متوقع
                  </span>
                </div>

                {/* Colors Selection */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700">
                    1. اختر الألوان المراد إنتاجها لهذا المنتج:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COLORS.map((col) => {
                      const isSelected = selectedBulkColors.includes(col);
                      return (
                        <button
                          type="button"
                          key={col}
                          onClick={() => handleToggleBulkColor(col)}
                          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          {isSelected ? `✓ ${col}` : col}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="أو اكتب لوناً إضافياً (مثال: بترولي)..."
                      value={customColorInput}
                      onChange={(e) => setCustomColorInput(e.target.value)}
                      className="text-xs p-1.5 rounded-lg border border-slate-300 bg-white w-48"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={handleAddCustomColor}>
                      إضافة لون
                    </Button>
                  </div>
                </div>

                {/* Sizes Selection */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700">
                    2. اختر المقاسات المراد إنتاجها لكل لون:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_SIZES.map((sz) => {
                      const isSelected = selectedBulkSizes.includes(sz);
                      return (
                        <button
                          type="button"
                          key={sz}
                          onClick={() => handleToggleBulkSize(sz)}
                          className={`text-xs px-2.5 py-1 rounded-lg border font-bold font-mono transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          {isSelected ? `✓ ${sz}` : sz}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="أو اكتب مقاساً إضافياً (مثال: 5XL)..."
                      value={customSizeInput}
                      onChange={(e) => setCustomSizeInput(e.target.value)}
                      className="text-xs p-1.5 rounded-lg border border-slate-300 bg-white w-48 uppercase font-mono"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={handleAddCustomSize}>
                      إضافة مقاس
                    </Button>
                  </div>
                </div>

                {/* Defaults: Stock & Price */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-indigo-100">
                  <Input
                    label="المخزون الافتراضي لكل متغير جديد"
                    type="number"
                    min="0"
                    value={bulkDefaultStock}
                    onChange={(e) => setBulkDefaultStock(e.target.value)}
                    placeholder="20"
                  />
                  <Input
                    label="سعر خاص للمتغيرات (اتركه فارغاً لاستخدام السعر الأساسي للمنتج)"
                    type="number"
                    min="0"
                    value={bulkCustomPrice}
                    onChange={(e) => setBulkCustomPrice(e.target.value)}
                    placeholder={basePrice ? `${basePrice} ج.م (الأساسي)` : 'استخدام السعر الأساسي'}
                  />
                </div>

                {/* Action button */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <p className="text-[11px] text-slate-500">
                    سيتم تخطي أي توليفة مقاس ولون موجودة مسبقاً وتوليد كود SKU تلقائي فريد لكل توليفة جديدة.
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleGenerateBulkVariants}
                    icon={<Sparkles className="h-4 w-4" />}
                  >
                    توليد وإدراج ({selectedBulkColors.length * selectedBulkSizes.length}) متغير في الجدول
                  </Button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold text-[11px]">
                  <tr>
                    <th className="p-2.5 text-start">كود SKU *</th>
                    <th className="p-2.5 text-start">اللون *</th>
                    <th className="p-2.5 text-start">المقاس *</th>
                    <th className="p-2.5 text-start">السعر (فارغ = الأساسي)</th>
                    <th className="p-2.5 text-start">المخزون</th>
                    <th className="p-2.5 text-center">الحالة</th>
                    <th className="p-2.5 text-end">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {variants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-slate-400">
                        لم تتم إضافة متغيرات بعد. اضغط "إضافة مقاس/لون" لإنشاء متغيرات.
                      </td>
                    </tr>
                  ) : (
                    variants.map((v, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <input
                              className="w-32 font-mono text-xs p-1.5 border border-slate-300 rounded bg-white"
                              placeholder="TS-BLK-M"
                              value={v.sku}
                              onChange={(e) => {
                                const copy = [...variants];
                                copy[idx].sku = e.target.value.toUpperCase();
                                setVariants(copy);
                              }}
                              required
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const copy = [...variants];
                                copy[idx].sku = suggestSku(name, v.color, v.size);
                                setVariants(copy);
                              }}
                              className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                              title="توليد SKU تلقائي"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>

                        <td className="p-2">
                          <input
                            className="w-24 text-xs p-1.5 border border-slate-300 rounded bg-white"
                            placeholder="أسود"
                            value={v.color}
                            onChange={(e) => {
                              const copy = [...variants];
                              copy[idx].color = e.target.value;
                              setVariants(copy);
                            }}
                            required
                          />
                        </td>

                        <td className="p-2">
                          <input
                            className="w-20 text-xs p-1.5 border border-slate-300 rounded bg-white"
                            placeholder="M, L, XL"
                            value={v.size}
                            onChange={(e) => {
                              const copy = [...variants];
                              copy[idx].size = e.target.value;
                              setVariants(copy);
                            }}
                            required
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            className="w-24 text-xs p-1.5 border border-slate-300 rounded bg-white"
                            placeholder={basePrice ? `${basePrice}` : 'الأساسي'}
                            value={v.price}
                            onChange={(e) => {
                              const copy = [...variants];
                              copy[idx].price = e.target.value;
                              setVariants(copy);
                            }}
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            className="w-20 text-xs p-1.5 border border-slate-300 rounded bg-white"
                            placeholder="10"
                            value={v.stock_quantity}
                            onChange={(e) => {
                              const copy = [...variants];
                              copy[idx].stock_quantity = e.target.value;
                              setVariants(copy);
                            }}
                          />
                        </td>

                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const copy = [...variants];
                              copy[idx].is_active = !copy[idx].is_active;
                              setVariants(copy);
                            }}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer ${
                              v.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {v.is_active ? 'نشط' : 'معطل'}
                          </button>
                        </td>

                        <td className="p-2 text-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveVariantRow(idx)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                            title="حذف المتغير"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsFormModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {editingProduct ? 'حفظ تعديلات المنتج' : 'حفظ ونشر المنتج'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Product Preview Modal */}
      {previewProduct && (
        <Modal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          title={`معاينة: ${previewProduct.name}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="aspect-square rounded-xl bg-slate-100 border border-slate-200 overflow-hidden mb-2">
                  {previewProduct.image_url ? (
                    <img src={previewProduct.image_url} alt={previewProduct.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Layers className="h-12 w-12" />
                    </div>
                  )}
                </div>

                {previewProduct.additional_images && previewProduct.additional_images.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {previewProduct.additional_images.map((img, i) => (
                      <img key={i} src={img} alt="gallery" className="w-12 h-12 rounded object-cover border" />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <span className="inline-block text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                  {previewProduct.category_name}
                </span>
                <h3 className="font-black text-base text-slate-900">{previewProduct.name}</h3>
                <div className="text-xl font-black text-slate-900">
                  {previewProduct.base_price} {t.priceCurrency}
                </div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  {previewProduct.description || 'لا يوجد وصف مدخل.'}
                </p>
                <div className="pt-2 text-[11px] text-slate-500 font-mono">slug: {previewProduct.slug}</div>
              </div>
            </div>

            {/* Variants table */}
            <div className="pt-3 border-t border-slate-200">
              <h4 className="font-bold text-slate-900 mb-2">المتغيرات المسجلة ({previewProduct.variants?.length || 0}):</h4>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50 text-slate-600 text-[11px]">
                    <tr>
                      <th className="p-2 text-start">SKU</th>
                      <th className="p-2 text-start">المقاس</th>
                      <th className="p-2 text-start">اللون</th>
                      <th className="p-2 text-end">السعر الفعلي</th>
                      <th className="p-2 text-end">المخزون</th>
                      <th className="p-2 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewProduct.variants && previewProduct.variants.length > 0 ? (
                      previewProduct.variants.map((v) => (
                        <tr key={v.id}>
                          <td className="p-2 font-mono text-[11px]">{v.sku}</td>
                          <td className="p-2 font-bold">{v.size}</td>
                          <td className="p-2">{v.color}</td>
                          <td className="p-2 text-end font-bold">{v.price} ج.م</td>
                          <td className="p-2 text-end">{v.stock_quantity}</td>
                          <td className="p-2 text-center">
                            {v.is_active === 1 ? (
                              <Badge variant="success" size="sm">نشط</Badge>
                            ) : (
                              <Badge variant="neutral" size="sm">معطل</Badge>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-3 text-center text-slate-400">
                          لا توجد متغيرات مسجلة
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
