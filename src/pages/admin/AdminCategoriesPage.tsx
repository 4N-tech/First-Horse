import React, { useState, useEffect } from 'react';
import { FolderTree, Plus, Trash2, ShieldAlert, RefreshCw } from 'lucide-react';
import { useAuth } from '../../lib/auth-context.tsx';
import { Category } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { Table, Column } from '../../components/ui/Table.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';

export const AdminCategoriesPage: React.FC = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.categories.getAdminAll();
      if (res.success) setCategories(res.data);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل التصنيفات');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) return;
    setIsSubmitting(true);
    try {
      const res = await api.categories.create({
        name,
        slug,
        description,
        image_url: imageUrl || null,
        sort_order: Number(sortOrder) || 0,
      });
      if (res.success) {
        setIsModalOpen(false);
        setName('');
        setSlug('');
        setDescription('');
        setImageUrl('');
        setSortOrder('0');
        await loadData();
      }
    } catch (err: any) {
      alert(err.message || 'فشل إضافة التصنيف');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا التصنيف؟')) return;
    try {
      const res = await api.categories.delete(id);
      if (res.success) {
        await loadData();
      }
    } catch (err: any) {
      alert(err.message || 'فشل حذف التصنيف');
    }
  };

  const columns: Column<Category>[] = [
    {
      key: 'name',
      header: 'التصنيف / القسم',
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
            {c.image_url ? (
              <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xs">
                C
              </div>
            )}
          </div>
          <div>
            <span className="font-bold text-slate-900 block text-xs">{c.name}</span>
            <span className="text-[11px] text-slate-500 font-mono">slug: {c.slug}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'الوصف',
      render: (c) => <span className="text-xs text-slate-600 line-clamp-1">{c.description || '-'}</span>,
    },
    {
      key: 'product_count',
      header: 'المنتجات المرتبطة',
      render: (c) => (
        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
          {c.product_count || 0} منتجات
        </span>
      ),
    },
    {
      key: 'sort_order',
      header: 'الترتيب',
      render: (c) => <span className="text-xs font-mono text-slate-700">{c.sort_order}</span>,
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      align: 'end',
      render: (c) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleDelete(c.id)}
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          icon={<Trash2 className="h-3.5 w-3.5" />}
        >
          حذف
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">أقسام وتصنيفات المصنع</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            تقسيم خطوط الإنتاج والكتالوج (تيشيرتات، بناطيل، ترنجات، ملابس أطفال...)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            icon={<Plus className="h-4 w-4" />}
          >
            إضافة تصنيف جديد
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} icon={<RefreshCw className="h-3.5 w-3.5" />}>
            تحديث
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="جاري جلب التصنيفات..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <Table columns={columns} data={categories} keyExtractor={(c) => c.id} emptyMessage="لا توجد تصنيفات مسجلة" />
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="إضافة تصنيف إنتاجي جديد"
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <Input
            label="اسم التصنيف *"
            placeholder="مثال: قمصان شتوية"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug) setSlug(e.target.value.trim().replace(/\s+/g, '-').toLowerCase());
            }}
            required
          />
          <Input
            label="الرابط الدلالي (Slug) *"
            placeholder="winter-shirts"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
          />
          <Input
            label="رابط صورة الغلاف"
            placeholder="https://..."
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
          <Input
            label="ترتيب العرض"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">الوصف</label>
            <textarea
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              حفظ
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
