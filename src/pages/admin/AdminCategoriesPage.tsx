import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  Plus,
  Trash2,
  Edit2,
  Power,
  ArrowRightLeft,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context.tsx';
import { Category } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { Table, Column } from '../../components/ui/Table.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';

export const AdminCategoriesPage: React.FC = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Add/Edit Modal
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Safe Deletion & Product Moving Modal
  const [isDeleteWarningOpen, setIsDeleteWarningOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [targetCategoryId, setTargetCategoryId] = useState<string>('');
  const [isMovingOrDeleting, setIsMovingOrDeleting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.categories.getAdminAll();
      if (res.success) {
        setCategories(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'فشل تحميل بيانات الأقسام');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Worker role check
  if (user?.role === 'WORKER') {
    return (
      <div className="p-8 bg-red-50 rounded-2xl border border-red-200 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-red-600 mx-auto" />
        <h3 className="font-bold text-red-950 text-base">غير مصرح بالوصول</h3>
        <p className="text-xs text-red-700 max-w-md mx-auto">
          صلاحيات فني التشغيل محددة في استعراض وتحديث الطلبات المسندة فقط، ولا يمكنه إدارة أقسام الكتالوج.
        </p>
      </div>
    );
  }

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingCategory(null);
    setName('');
    setSlug('');
    setDescription('');
    setImageUrl('');
    setSortOrder('0');
    setIsActive(true);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || '');
    setImageUrl(cat.image_url || '');
    setSortOrder(String(cat.sort_order));
    setIsActive(cat.is_active === 1);
    setIsFormModalOpen(true);
  };

  // Automatic Slug generator
  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingCategory) {
      const autoSlug = val
        .trim()
        .toLowerCase()
        .replace(/[\s\t\n]+/g, '-')
        .replace(/[^\w\u0600-\u06FF\-]/g, '');
      setSlug(autoSlug);
    }
  };

  // Image File Upload Handler
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const res = await api.upload.image(file);
      if (res.success && res.url) {
        setImageUrl(res.url);
      }
    } catch (err: any) {
      alert(err.message || 'فشل رفع الصورة');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Submit Create or Update
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('اسم القسم مطلوب ولا يمكن تركه فارغاً');
      return;
    }

    setIsSubmitting(true);
    setActionNotice(null);
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
        sort_order: Number(sortOrder) || 0,
        is_active: isActive ? 1 : 0,
      };

      if (editingCategory) {
        const res = await api.categories.update(editingCategory.id, payload);
        if (res.success) {
          setActionNotice({ type: 'success', message: 'تم تحديث بيانات القسم بنجاح' });
        }
      } else {
        const res = await api.categories.create(payload);
        if (res.success) {
          setActionNotice({ type: 'success', message: 'تم إضافة القسم الجديد بنجاح' });
        }
      }

      setIsFormModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حفظ القسم');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Category Active Status
  const handleToggleStatus = async (cat: Category) => {
    try {
      const res = await api.categories.toggleStatus(cat.id);
      if (res.success) {
        setActionNotice({ type: 'success', message: res.message });
        await loadData();
      }
    } catch (err: any) {
      alert(err.message || 'فشل تغيير حالة القسم');
    }
  };

  // Safe Delete / Warning trigger
  const handleDeleteClick = async (cat: Category) => {
    if (cat.product_count && cat.product_count > 0) {
      setCategoryToDelete(cat);
      // Choose first available other category as default target
      const other = categories.find((c) => c.id !== cat.id);
      setTargetCategoryId(other ? String(other.id) : '');
      setIsDeleteWarningOpen(true);
      return;
    }

    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف قسم (${cat.name})؟`)) return;

    try {
      const res = await api.categories.delete(cat.id);
      if (res.success) {
        setActionNotice({ type: 'success', message: res.message });
        await loadData();
      }
    } catch (err: any) {
      alert(err.message || 'فشل حذف القسم');
    }
  };

  // Deactivate instead of deleting
  const handleDeactivateInstead = async () => {
    if (!categoryToDelete) return;
    setIsMovingOrDeleting(true);
    try {
      await api.categories.update(categoryToDelete.id, { is_active: 0 });
      setActionNotice({
        type: 'success',
        message: `تم تعطيل قسم (${categoryToDelete.name}) بدلاً من حذفه للحفاظ على المنتجات المرتبطة`,
      });
      setIsDeleteWarningOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'فشل تعطيل القسم');
    } finally {
      setIsMovingOrDeleting(false);
    }
  };

  // Move products to another category and delete source
  const handleMoveProductsAndDelete = async () => {
    if (!categoryToDelete || !targetCategoryId) {
      alert('يرجى اختيار القسم البديل لنقل المنتجات إليه');
      return;
    }

    setIsMovingOrDeleting(true);
    try {
      const res = await api.categories.moveProducts(categoryToDelete.id, Number(targetCategoryId), true);
      if (res.success) {
        setActionNotice({ type: 'success', message: res.message });
        setIsDeleteWarningOpen(false);
        await loadData();
      }
    } catch (err: any) {
      alert(err.message || 'فشل نقل المنتجات');
    } finally {
      setIsMovingOrDeleting(false);
    }
  };

  const columns: Column<Category>[] = [
    {
      key: 'name',
      header: 'القسم',
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
            {c.image_url ? (
              <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
            ) : (
              <FolderTree className="h-6 w-6 text-slate-400" />
            )}
          </div>
          <div>
            <span className="font-bold text-slate-900 block text-xs">{c.name}</span>
            <span className="text-[11px] text-slate-400 font-mono">slug: {c.slug}</span>
            {c.description && <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{c.description}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'product_count',
      header: 'عدد المنتجات',
      render: (c) => (
        <span className="inline-flex items-center text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
          {c.product_count || 0} منتج
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'الحالة',
      render: (c) => (
        <button
          onClick={() => handleToggleStatus(c)}
          className="cursor-pointer"
          title="انقر لتغيير الحالة"
        >
          {c.is_active === 1 ? (
            <Badge variant="success">نشط</Badge>
          ) : (
            <Badge variant="neutral">معطل</Badge>
          )}
        </button>
      ),
    },
    {
      key: 'sort_order',
      header: 'ترتيب العرض',
      render: (c) => <span className="font-mono text-xs font-bold text-slate-700">{c.sort_order}</span>,
    },
    {
      key: 'created_at',
      header: 'تاريخ الإنشاء',
      render: (c) => <span className="text-[11px] text-slate-500 font-mono">{c.created_at?.slice(0, 10)}</span>,
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      align: 'end',
      render: (c) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenEdit(c)}
            icon={<Edit2 className="h-3.5 w-3.5" />}
          >
            تعديل
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleToggleStatus(c)}
            className={c.is_active === 1 ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}
            icon={<Power className="h-3.5 w-3.5" />}
            title={c.is_active === 1 ? 'تعطيل القسم' : 'تفعيل القسم'}
          >
            {c.is_active === 1 ? 'تعطيل' : 'تفعيل'}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteClick(c)}
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">إدارة أقسام وتصنيفات المصنع</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            التحكم في تصنيفات خطوط الإنتاج والترتيب وحالات التنشيط وحماية المنتجات من الحذف المفاجئ.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreate}
            icon={<Plus className="h-4 w-4" />}
          >
            إضافة قسم جديد
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} icon={<RefreshCw className="h-3.5 w-3.5" />}>
            تحديث
          </Button>
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{actionNotice.message}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="hover:underline text-xs">
            إغلاق
          </button>
        </div>
      )}

      {isLoading ? (
        <LoadingState message="جاري جلب أقسام المصنع..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <Table
          columns={columns}
          data={categories}
          keyExtractor={(c) => c.id}
          emptyMessage="لم تتم إضافة أقسام بعد."
        />
      )}

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingCategory ? `تعديل قسم: ${editingCategory.name}` : 'إضافة قسم جديد لكتالوج المصنع'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
          <Input
            label="اسم القسم *"
            placeholder="مثال: ترنجات شتوية"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
          />

          <Input
            label="الرابط الدلالي (Slug) *"
            placeholder="winter-tracksuits"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            helperText="يتم توليده تلقائياً من الاسم أو يمكنك تخصيصه للرابط المباشر."
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">صورة القسم</label>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                {imageUrl ? (
                  <img src={imageUrl} alt="معاينة" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-slate-300" />
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{isUploadingImage ? 'جاري الرفع...' : 'رفع صورة من الجهاز'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleImageFileChange}
                      disabled={isUploadingImage}
                    />
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-xs text-red-600 hover:underline"
                    >
                      إزالة
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">JPG, PNG, WEBP حتى 5 ميجابايت</p>
              </div>
            </div>
            <Input
              placeholder="أو ضع رابط صورة خارجي مباشر (URL)"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="ترتيب العرض (رقمي)"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              helperText="الأرقام الأقل تظهر أولاً."
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">حالة التفعيل</label>
              <div className="flex items-center gap-2 pt-1.5">
                <input
                  type="checkbox"
                  id="cat_active_checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="cat_active_checkbox" className="text-xs font-medium text-slate-700 cursor-pointer">
                  قسم نشط وظاهر للمتسوقين
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">وصف القسم</label>
            <textarea
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              rows={2}
              placeholder="نبذة عن نوعية ومواصفات الملابس في هذا القسم..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsFormModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {editingCategory ? 'حفظ التعديلات' : 'إنشاء القسم'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Safe Delete & Move Products Warning Modal */}
      {categoryToDelete && (
        <Modal
          isOpen={isDeleteWarningOpen}
          onClose={() => setIsDeleteWarningOpen(false)}
          title="تحذير أمان: لا يمكن حذف هذا القسم مباشرة"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs mb-1">لا يمكن حذف هذا القسم لأنه يحتوي على منتجات.</p>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  يحتوي قسم ({categoryToDelete.name}) على ({categoryToDelete.product_count}) منتج نشط. للحفاظ على
                  سجلات الكتالوج، يمنع النظام الحذف التلقائي للمنتجات. يمكنك اختيار أحد الحلين أدناه:
                </p>
              </div>
            </div>

            {/* Option 1: Move Products */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <ArrowRightLeft className="h-4 w-4 text-indigo-600" />
                <span>الخيار الأول: نقل المنتجات إلى قسم آخر ثم الحذف</span>
              </div>
              <Select
                label="اختر القسم الوجهة لنقل المنتجات إليه:"
                options={categories
                  .filter((c) => c.id !== categoryToDelete.id)
                  .map((c) => ({ value: c.id, label: `${c.name} (${c.product_count || 0} منتج حالياً)` }))}
                value={targetCategoryId}
                onChange={(e) => setTargetCategoryId(e.target.value)}
                placeholder="-- اختر القسم البديل --"
              />
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={handleMoveProductsAndDelete}
                isLoading={isMovingOrDeleting}
                disabled={!targetCategoryId}
              >
                نقل المنتجات وحذف هذا القسم
              </Button>
            </div>

            {/* Option 2: Deactivate */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Power className="h-4 w-4 text-slate-600" />
                <span>الخيار الثاني: تعطيل القسم وإخفائه عن المتسوقين</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                سيبقى القسم ومنتجاته محفوظة في قاعدة البيانات ومتاحة للإدارة فقط، ولن تظهر للعملاء في المتجر.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleDeactivateInstead}
                isLoading={isMovingOrDeleting}
              >
                تعطيل القسم فقط (موصى به)
              </Button>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={() => setIsDeleteWarningOpen(false)}>
                إلغاء الأمر
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
