import React, { useState, useEffect } from 'react';
import {
  Boxes,
  History,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Minus,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Layers,
  FileText,
  Calendar,
  User,
  ShoppingBag,
  ArrowRight,
  Tag
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context.tsx';
import { useI18n } from '../../lib/i18n.tsx';
import { api } from '../../lib/api.ts';
import type {
  InventoryItem,
  InventoryMovement,
  InventorySummary,
  InventoryMovementType,
  Category,
  StockStatus,
} from '../../types/index.ts';
import { StockStatusBadge, MovementTypeBadge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';

export const AdminInventoryPage: React.FC = () => {
  const { user } = useAuth();
  const { t, lang } = useI18n();

  // Active view tab: 'current' (Inventory items) | 'movements' (Ledger)
  const [activeTab, setActiveTab] = useState<'current' | 'movements'>('current');

  // Summary KPIs
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  // Current Inventory State
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsTotalPages, setItemsTotalPages] = useState(1);
  const [itemsTotalCount, setItemsTotalCount] = useState(0);

  // Current Inventory Filters
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedStockStatus, setSelectedStockStatus] = useState<string>('');
  const [selectedIsActive, setSelectedIsActive] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Movements Ledger State
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);
  const [movementsError, setMovementsError] = useState<string | null>(null);
  const [movementsPage, setMovementsPage] = useState(1);
  const [movementsTotalPages, setMovementsTotalPages] = useState(1);
  const [movementsTotalCount, setMovementsTotalCount] = useState(0);

  // Movements Filters
  const [movementDateRange, setMovementDateRange] = useState<string>('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('');
  const [movementSearchInput, setMovementSearchInput] = useState<string>('');
  const [debouncedMovementSearch, setDebouncedMovementSearch] = useState<string>('');

  // Modals State
  const [selectedVariantForAdjust, setSelectedVariantForAdjust] = useState<InventoryItem | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'ADD' | 'REMOVE'>('ADD');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<number>(1);
  const [adjustmentNote, setAdjustmentNote] = useState<string>('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);

  // Threshold Edit Modal
  const [selectedVariantForThreshold, setSelectedVariantForThreshold] = useState<InventoryItem | null>(null);
  const [newThreshold, setNewThreshold] = useState<number>(10);
  const [isSubmittingThreshold, setIsSubmittingThreshold] = useState(false);

  // Feedback Notification
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Debounce search input for items
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setItemsPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Debounce search input for movements
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedMovementSearch(movementSearchInput.trim());
      setMovementsPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [movementSearchInput]);

  // Load Categories & KPIs once
  useEffect(() => {
    loadSummary();
    loadCategories();
  }, []);

  const loadSummary = async () => {
    try {
      const res = await api.inventory.getSummary();
      if (res.success) setSummary(res.data);
    } catch (e) {
      console.error('Failed to load summary:', e);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await api.categories.getAll();
      if (res.success) setCategories(res.data);
    } catch (e) {
      console.error('Failed to load categories:', e);
    }
  };

  // Load Inventory Items
  const loadInventoryItems = async () => {
    setIsLoadingItems(true);
    setItemsError(null);
    try {
      const res = await api.inventory.getItems({
        category_id: selectedCategoryId ? Number(selectedCategoryId) : undefined,
        stock_status: selectedStockStatus || undefined,
        is_active: selectedIsActive !== '' ? Number(selectedIsActive) : undefined,
        search: debouncedSearch || undefined,
        page: itemsPage,
        limit: 15,
      });

      if (res.success) {
        setItems(res.data);
        setItemsTotalPages(res.pagination.total_pages);
        setItemsTotalCount(res.pagination.total);
      }
    } catch (err: any) {
      setItemsError(err.message || 'فشل في تحميل بيانات المخزون');
    } finally {
      setIsLoadingItems(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'current') {
      loadInventoryItems();
    }
  }, [
    activeTab,
    selectedCategoryId,
    selectedStockStatus,
    selectedIsActive,
    debouncedSearch,
    itemsPage,
  ]);

  // Load Movements Ledger
  const loadMovements = async () => {
    setIsLoadingMovements(true);
    setMovementsError(null);
    try {
      const res = await api.inventory.getMovements({
        date_range: movementDateRange || undefined,
        movement_type: movementTypeFilter || undefined,
        search: debouncedMovementSearch || undefined,
        page: movementsPage,
        limit: 20,
      });

      if (res.success) {
        setMovements(res.data);
        setMovementsTotalPages(res.pagination.total_pages);
        setMovementsTotalCount(res.pagination.total);
      }
    } catch (err: any) {
      setMovementsError(err.message || 'فشل في تحميل سجل حركات المخزون');
    } finally {
      setIsLoadingMovements(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'movements') {
      loadMovements();
    }
  }, [
    activeTab,
    movementDateRange,
    movementTypeFilter,
    debouncedMovementSearch,
    movementsPage,
  ]);

  // Open Adjust Modal
  const handleOpenAdjust = (item: InventoryItem) => {
    setSelectedVariantForAdjust(item);
    setAdjustmentType('ADD');
    setAdjustmentQuantity(1);
    setAdjustmentNote('');
    setConfirmRemoval(false);
    setActionError(null);
  };

  // Submit Stock Adjustment
  const handleSubmitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantForAdjust) return;

    if (adjustmentQuantity <= 0 || !Number.isInteger(Number(adjustmentQuantity))) {
      setActionError('الكمية يجب أن تكون عدداً صحيحاً أكبر من الصفر');
      return;
    }

    if (!adjustmentNote.trim()) {
      setActionError('بيان / سبب التسوية مطلوب لتوثيق الحركة في سجل المخزون');
      return;
    }

    if (adjustmentType === 'REMOVE' && adjustmentQuantity > selectedVariantForAdjust.current_stock) {
      setActionError(`لا يمكن صرف كمية أكبر من المتوفر بالمخزون (${selectedVariantForAdjust.current_stock} قطعة)`);
      return;
    }

    if (adjustmentType === 'REMOVE' && !confirmRemoval) {
      setConfirmRemoval(true);
      return;
    }

    setIsSubmittingAdjust(true);
    setActionError(null);

    try {
      const res = await api.inventory.adjustStock({
        variant_id: selectedVariantForAdjust.variant_id,
        adjustment_type: adjustmentType,
        quantity: adjustmentQuantity,
        note: adjustmentNote.trim(),
      });

      if (res.success) {
        const deltaStr = adjustmentType === 'ADD' ? `+${adjustmentQuantity}` : `-${adjustmentQuantity}`;
        setActionSuccess(
          `تمت تسوية رصيد المتغير (${selectedVariantForAdjust.sku}) بمقدار (${deltaStr} قطعة). الرصيد الجديد: ${res.data.stock_after} قطعة.`
        );
        setSelectedVariantForAdjust(null);
        setTimeout(() => setActionSuccess(null), 6000);

        // Refresh data
        await Promise.all([loadInventoryItems(), loadSummary()]);
        if (activeTab === 'movements') {
          await loadMovements();
        }
      }
    } catch (err: any) {
      setActionError(err.message || 'فشل في تسوية المخزون');
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // Open Threshold Modal
  const handleOpenThreshold = (item: InventoryItem) => {
    setSelectedVariantForThreshold(item);
    setNewThreshold(item.low_stock_threshold || 10);
    setActionError(null);
  };

  // Submit Threshold Update
  const handleSubmitThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantForThreshold) return;

    if (newThreshold < 0 || !Number.isInteger(Number(newThreshold))) {
      setActionError('حد التنبيه يجب أن يكون رقماً صحيحاً (0 أو أكبر)');
      return;
    }

    setIsSubmittingThreshold(true);
    setActionError(null);

    try {
      const res = await api.inventory.updateThreshold(
        selectedVariantForThreshold.variant_id,
        newThreshold
      );

      if (res.success) {
        setActionSuccess(
          `تم تحديث حد التنبيه لمتغير (${selectedVariantForThreshold.sku}) إلى (${newThreshold} قطعة) بنجاح.`
        );
        setSelectedVariantForThreshold(null);
        setTimeout(() => setActionSuccess(null), 5000);
        await Promise.all([loadInventoryItems(), loadSummary()]);
      }
    } catch (err: any) {
      setActionError(err.message || 'فشل في تحديث حد التنبيه');
    } finally {
      setIsSubmittingThreshold(false);
    }
  };

  // RBAC Server-authoritative Guard Check: Only ADMIN & MANAGER
  if (user?.role === 'WORKER') {
    return (
      <div className="p-8 bg-red-50 rounded-2xl border border-red-200 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-red-600 mx-auto" />
        <h3 className="font-bold text-red-950 text-base">غير مصرح بالوصول لمراقبة وإدارة المخزون</h3>
        <p className="text-xs text-red-700 max-w-md mx-auto leading-relaxed">
          إدارة المخزون، وسجل الحركات، وتسوية الأرصدة محصورة بمدير النظام ومشرف الإنتاج (ADMIN & MANAGER). عمال التشغيل مخصص لهم مساحة عمل خطوط الإنتاج والتصنيع فقط.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Boxes className="h-6 w-6 text-indigo-600" />
            <span>إدارة المخزون ومراقبة الأرصدة (Stock Control)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            متابعة أرصدة المقاسات والألوان، وسجل حركات المخزون غير القابل للتعديل، والتسويات اليدوية.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadSummary();
              if (activeTab === 'current') loadInventoryItems();
              else loadMovements();
            }}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            تحديث البيانات
          </Button>
        </div>
      </div>

      {/* Success / Alert Banner */}
      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* KPI Cards (Section 7) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Variants */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>إجمالي المتغيرات (SKUs)</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {summary ? summary.total_variants : '...'}
          </div>
          <p className="text-[11px] text-slate-400">كافة مقاسات وألوان المنتجات</p>
        </div>

        {/* Card 2: Out of Stock */}
        <div className="bg-white rounded-2xl p-4 border border-rose-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-rose-600 text-xs font-bold">
            <span>نفد من المخزن (Out of Stock)</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-700 font-mono">
            {summary ? summary.out_of_stock_count : '...'}
          </div>
          <p className="text-[11px] text-rose-500 font-medium">الرصيد = 0 قطعة حالياً</p>
        </div>

        {/* Card 3: Low Stock */}
        <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-amber-600 text-xs font-bold">
            <span>مخزون منخفض (Low Stock)</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 font-mono">
            {summary ? summary.low_stock_count : '...'}
          </div>
          <p className="text-[11px] text-amber-600 font-medium">أقل من أو يساوي حد التنبيه</p>
        </div>

        {/* Card 4: Total Units */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-indigo-600 text-xs font-bold">
            <span>إجمالي قطع المخزون المتاحة</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-900 font-mono">
            {summary ? summary.total_units : '...'}
          </div>
          <p className="text-[11px] text-slate-400">إجمالي الوحدات الجاهزة بالمستودع</p>
        </div>
      </div>

      {/* Main Tabs (Current Inventory vs Movement Ledger) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab('current')}
          className={`py-3 px-4 font-bold text-xs rounded-t-xl transition-all cursor-pointer inline-flex items-center gap-2 ${
            activeTab === 'current'
              ? 'bg-white border-t border-x border-slate-200 text-indigo-600 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
          }`}
        >
          <Boxes className="h-4 w-4" />
          <span>أرصدة المخزون الحالية ({itemsTotalCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`py-3 px-4 font-bold text-xs rounded-t-xl transition-all cursor-pointer inline-flex items-center gap-2 ${
            activeTab === 'movements'
              ? 'bg-white border-t border-x border-slate-200 text-indigo-600 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
          }`}
        >
          <History className="h-4 w-4" />
          <span>سجل حركات المخزون (Ledger)</span>
        </button>
      </div>

      {/* TAB 1: CURRENT INVENTORY */}
      {activeTab === 'current' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Filter className="h-4 w-4 text-indigo-600" />
                <span>تصفية المخزون:</span>
              </span>
              {(selectedCategoryId || selectedStockStatus || selectedIsActive || searchInput) && (
                <button
                  onClick={() => {
                    setSelectedCategoryId('');
                    setSelectedStockStatus('');
                    setSelectedIsActive('');
                    setSearchInput('');
                  }}
                  className="text-indigo-600 hover:underline cursor-pointer"
                >
                  إعادة ضبط الفلاتر
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث باسم المنتج أو الرمز (SKU)..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full ps-9 pe-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Category */}
              <Select
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value);
                  setItemsPage(1);
                }}
                options={[
                  { value: '', label: 'جميع الأقسام' },
                  ...categories.map((c) => ({ value: String(c.id), label: c.name })),
                ]}
              />

              {/* Stock Status Filter */}
              <Select
                value={selectedStockStatus}
                onChange={(e) => {
                  setSelectedStockStatus(e.target.value);
                  setItemsPage(1);
                }}
                options={[
                  { value: '', label: 'كافة حالات الرصيد' },
                  { value: 'out_of_stock', label: 'نفد من المخزن (0 قطعة)' },
                  { value: 'low_stock', label: 'مخزون منخفض (أقل من حد التنبيه)' },
                  { value: 'in_stock', label: 'متوفر بالمخزن' },
                ]}
              />

              {/* Active/Inactive */}
              <Select
                value={selectedIsActive}
                onChange={(e) => {
                  setSelectedIsActive(e.target.value);
                  setItemsPage(1);
                }}
                options={[
                  { value: '', label: 'كافة المنتجات (نشط ومعطل)' },
                  { value: '1', label: 'المنتجات النشطة فقط' },
                  { value: '0', label: 'المنتجات المعطلة' },
                ]}
              />
            </div>
          </div>

          {/* Items Table */}
          {isLoadingItems ? (
            <LoadingState message="جاري جلب بيانات أرصدة المخزون..." />
          ) : itemsError ? (
            <ErrorState title="خطأ في تحميل المخزون" message={itemsError} onRetry={loadInventoryItems} />
          ) : items.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <Boxes className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-sm">لا توجد منتجات مطابقة لشروط البحث</h3>
              <p className="text-xs text-slate-400">جرّب تغيير فلاتر التصفية أو مسح عبارة البحث.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50 text-slate-600 text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-start font-bold">المنتج والقسم</th>
                      <th className="p-3 text-start font-bold">المتغير (المقاس / اللون)</th>
                      <th className="p-3 text-start font-bold">الرمز (SKU)</th>
                      <th className="p-3 text-center font-bold">الرصيد الحالي</th>
                      <th className="p-3 text-center font-bold">حالة التوفر</th>
                      <th className="p-3 text-center font-bold">حد التنبيه</th>
                      <th className="p-3 text-center font-bold">حالة المنتج</th>
                      <th className="p-3 text-end font-bold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <tr key={item.variant_id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Product */}
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                              ) : (
                                <Boxes className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block text-xs">{item.product_name}</span>
                              <span className="text-[10px] text-slate-400">{item.category_name}</span>
                            </div>
                          </div>
                        </td>

                        {/* Variant */}
                        <td className="p-3">
                          <div className="font-semibold text-slate-800">
                            <span>{item.color}</span>
                            <span className="text-slate-300 mx-1">/</span>
                            <span>{item.size}</span>
                          </div>
                        </td>

                        {/* SKU */}
                        <td className="p-3">
                          <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            {item.sku}
                          </span>
                        </td>

                        {/* Current Stock */}
                        <td className="p-3 text-center">
                          <span
                            className={`font-mono text-sm font-black px-2.5 py-0.5 rounded-lg inline-block ${
                              item.current_stock === 0
                                ? 'text-rose-700 bg-rose-50'
                                : item.current_stock <= item.low_stock_threshold
                                ? 'text-amber-700 bg-amber-50'
                                : 'text-slate-900 bg-slate-100'
                            }`}
                          >
                            {item.current_stock}
                          </span>
                        </td>

                        {/* Stock Status Badge */}
                        <td className="p-3 text-center">
                          <StockStatusBadge status={item.stock_status} />
                        </td>

                        {/* Low stock threshold */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenThreshold(item)}
                            className="inline-flex items-center gap-1 font-mono text-xs text-slate-600 hover:text-indigo-600 hover:underline cursor-pointer bg-slate-50 hover:bg-indigo-50 px-2 py-0.5 rounded border border-slate-200"
                            title="تعديل حد التنبيه"
                          >
                            <span>{item.low_stock_threshold}</span>
                            <Sliders className="h-3 w-3 text-slate-400" />
                          </button>
                        </td>

                        {/* Active/Inactive */}
                        <td className="p-3 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.is_active === 1
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {item.is_active === 1 ? 'نشط' : 'معطل'}
                          </span>
                        </td>

                        {/* Actions: Adjust Stock */}
                        <td className="p-3 text-end">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleOpenAdjust(item)}
                            className="text-xs font-bold"
                            icon={<Sliders className="h-3.5 w-3.5" />}
                          >
                            تسوية الرصيد
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {itemsTotalPages > 1 && (
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <span>
                    الصفحة <strong className="text-slate-900 font-mono">{itemsPage}</strong> من{' '}
                    <strong className="text-slate-900 font-mono">{itemsTotalPages}</strong> (إجمالي {itemsTotalCount} متغير)
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={itemsPage <= 1}
                      onClick={() => setItemsPage((p) => Math.max(1, p - 1))}
                    >
                      السابق
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={itemsPage >= itemsTotalPages}
                      onClick={() => setItemsPage((p) => Math.min(itemsTotalPages, p + 1))}
                    >
                      التالي
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INVENTORY MOVEMENTS LEDGER */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          {/* Movement Filters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Filter className="h-4 w-4 text-indigo-600" />
                <span>تصفية سجل الحركات:</span>
              </span>
              {(movementDateRange || movementTypeFilter || movementSearchInput) && (
                <button
                  onClick={() => {
                    setMovementDateRange('');
                    setMovementTypeFilter('');
                    setMovementSearchInput('');
                  }}
                  className="text-indigo-600 hover:underline cursor-pointer"
                >
                  إعادة ضبط الفلاتر
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث برقم الطلب، SKU، أو اسم المنتج..."
                  value={movementSearchInput}
                  onChange={(e) => setMovementSearchInput(e.target.value)}
                  className="w-full ps-9 pe-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Date Range */}
              <Select
                value={movementDateRange}
                onChange={(e) => {
                  setMovementDateRange(e.target.value);
                  setMovementsPage(1);
                }}
                options={[
                  { value: '', label: 'كافة الفترات الزمنية' },
                  { value: 'today', label: 'حركات اليوم' },
                  { value: 'yesterday', label: 'حركات أمس' },
                  { value: '7days', label: 'آخر 7 أيام' },
                  { value: 'this_month', label: 'هذا الشهر' },
                ]}
              />

              {/* Movement Type */}
              <Select
                value={movementTypeFilter}
                onChange={(e) => {
                  setMovementTypeFilter(e.target.value);
                  setMovementsPage(1);
                }}
                options={[
                  { value: '', label: 'كافة أنواع الحركات' },
                  { value: 'ADJUSTMENT_IN', label: 'تسوية بالزيادة (+)' },
                  { value: 'ADJUSTMENT_OUT', label: 'تسوية بالعجز (-)' },
                  { value: 'ORDER_DEDUCTION', label: 'صرف لطلب عميل (-)' },
                  { value: 'ORDER_RELEASE', label: 'إلغاء حجز / استرجاع (+)' },
                  { value: 'PURCHASE', label: 'توريد / شراء (+)' },
                  { value: 'RETURN', label: 'مرتجع عميل (+)' },
                  { value: 'INITIAL', label: 'رصيد افتتاحي' },
                ]}
              />
            </div>
          </div>

          {/* Movements Ledger Table */}
          {isLoadingMovements ? (
            <LoadingState message="جاري جلب سجل حركات المخزون..." />
          ) : movementsError ? (
            <ErrorState title="خطأ في تحميل سجل الحركات" message={movementsError} onRetry={loadMovements} />
          ) : movements.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <History className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-sm">لا توجد حركات مخزون مسجلة</h3>
              <p className="text-xs text-slate-400">ستظهر هنا أي عمليات تسوية يدوية أو حركات خصم/إلغاء ناتجة عن الطلبات.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50 text-slate-600 text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-start font-bold">التاريخ والتوقيت</th>
                      <th className="p-3 text-start font-bold">المنتج والمتغير</th>
                      <th className="p-3 text-start font-bold">الرمز (SKU)</th>
                      <th className="p-3 text-center font-bold">نوع الحركة</th>
                      <th className="p-3 text-center font-bold">التغير في الكمية</th>
                      <th className="p-3 text-center font-bold">الرصيد قبل ← بعد</th>
                      <th className="p-3 text-start font-bold">المرجع</th>
                      <th className="p-3 text-start font-bold">البيان / الملاحظة</th>
                      <th className="p-3 text-start font-bold">المنفّذ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {movements.map((move) => {
                      const isPositive = move.quantity_delta > 0;
                      return (
                        <tr key={move.id} className="hover:bg-slate-50/60">
                          {/* Date */}
                          <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {move.created_at}
                          </td>

                          {/* Product */}
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block truncate max-w-[150px]">
                              {move.product_name}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {move.color} - {move.size}
                            </span>
                          </td>

                          {/* SKU */}
                          <td className="p-3">
                            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                              {move.sku}
                            </span>
                          </td>

                          {/* Movement Type */}
                          <td className="p-3 text-center">
                            <MovementTypeBadge type={move.movement_type} />
                          </td>

                          {/* Quantity Delta */}
                          <td className="p-3 text-center">
                            <span
                              className={`font-mono text-xs font-black px-2 py-0.5 rounded ${
                                isPositive
                                  ? 'text-emerald-700 bg-emerald-50'
                                  : 'text-rose-700 bg-rose-50'
                              }`}
                            >
                              {isPositive ? `+${move.quantity_delta}` : move.quantity_delta}
                            </span>
                          </td>

                          {/* Stock Before -> After */}
                          <td className="p-3 text-center font-mono text-xs text-slate-700 whitespace-nowrap">
                            <span className="text-slate-500">{move.stock_before}</span>
                            <span className="text-slate-300 mx-1">←</span>
                            <span className="font-bold text-slate-900">{move.stock_after}</span>
                          </td>

                          {/* Reference */}
                          <td className="p-3">
                            {move.order_number ? (
                              <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded">
                                #{move.order_number}
                              </span>
                            ) : move.reference_type === 'MANUAL_ADJUSTMENT' ? (
                              <span className="text-[11px] text-slate-500 font-medium">تسوية يدوية</span>
                            ) : (
                              <span className="text-[11px] text-slate-400">-</span>
                            )}
                          </td>

                          {/* Note */}
                          <td className="p-3 max-w-[200px]">
                            <p className="text-[11px] text-slate-600 truncate" title={move.note || undefined}>
                              {move.note || '-'}
                            </p>
                          </td>

                          {/* Created by */}
                          <td className="p-3 text-[11px] text-slate-600 whitespace-nowrap">
                            {move.created_by_name ? (
                              <span className="font-medium text-slate-800">{move.created_by_name}</span>
                            ) : (
                              <span className="text-slate-400 italic">نظام الطلبات التلقائي</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {movementsTotalPages > 1 && (
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <span>
                    الصفحة <strong className="text-slate-900 font-mono">{movementsPage}</strong> من{' '}
                    <strong className="text-slate-900 font-mono">{movementsTotalPages}</strong> (إجمالي {movementsTotalCount} حركة مسجلة)
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={movementsPage <= 1}
                      onClick={() => setMovementsPage((p) => Math.max(1, p - 1))}
                    >
                      السابق
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={movementsPage >= movementsTotalPages}
                      onClick={() => setMovementsPage((p) => Math.min(movementsTotalPages, p + 1))}
                    >
                      التالي
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Stock Adjustment (Section 5) */}
      {selectedVariantForAdjust && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedVariantForAdjust(null)}
          title="تسوية رصيد المخزون (Manual Stock Adjustment)"
          maxWidth="md"
        >
          <form onSubmit={handleSubmitAdjust} className="space-y-4 text-xs">
            {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Target Variant Info */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] text-slate-400 block font-bold">بيانات المتغير المراد تسويته:</span>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{selectedVariantForAdjust.product_name}</h4>
                  <p className="text-slate-500 font-mono text-xs">
                    {selectedVariantForAdjust.color} - {selectedVariantForAdjust.size} (SKU: {selectedVariantForAdjust.sku})
                  </p>
                </div>
                <div className="text-end">
                  <span className="text-[10px] text-slate-400 block">الرصيد الفعلي الحالي</span>
                  <span className="text-lg font-black text-indigo-700 font-mono">
                    {selectedVariantForAdjust.current_stock} قطعة
                  </span>
                </div>
              </div>
            </div>

            {/* Adjustment Type Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-900">نوع التسوية *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustmentType('ADD');
                    setConfirmRemoval(false);
                  }}
                  className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    adjustmentType === 'ADD'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-200'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Plus className="h-4 w-4 text-emerald-600" />
                  <span>إضافة رصيد (+ ADJUSTMENT_IN)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAdjustmentType('REMOVE')}
                  className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    adjustmentType === 'REMOVE'
                      ? 'bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-200'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Minus className="h-4 w-4 text-rose-600" />
                  <span>صرف / عجز (- ADJUSTMENT_OUT)</span>
                </button>
              </div>
            </div>

            {/* Quantity Input */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-900">الكمية المراد تسويتها (قطع) *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={adjustmentQuantity}
                onChange={(e) => {
                  setAdjustmentQuantity(Math.max(1, Number(e.target.value) || 1));
                  setConfirmRemoval(false);
                }}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Stock After Preview */}
            <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">الرصيد بعد تنفيذ الحركة:</span>
              <span className="font-mono text-sm font-black text-indigo-900">
                {adjustmentType === 'ADD'
                  ? selectedVariantForAdjust.current_stock + adjustmentQuantity
                  : Math.max(0, selectedVariantForAdjust.current_stock - adjustmentQuantity)}{' '}
                قطعة
              </span>
            </div>

            {/* Negative stock prevention notice */}
            {adjustmentType === 'REMOVE' && adjustmentQuantity > selectedVariantForAdjust.current_stock && (
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-[11px] font-bold">
                ⚠️ تحذير: الكمية المراد إنقاصها تتجاوز الرصيد الحالي! يمنع النظام تماماً الأرصدة السالبة.
              </div>
            )}

            {/* Destructive Removal Confirmation */}
            {adjustmentType === 'REMOVE' && confirmRemoval && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-900 text-[11px] space-y-1">
                <span className="font-bold block">⚠️ تأكيد عملية الخصم من المخزون:</span>
                <p>أنت على وشك صرف {adjustmentQuantity} قطعة من الرصيد. هل أنت متأكد من صحة هذه التسوية؟</p>
              </div>
            )}

            {/* Reason / Note Input (Required) */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-900">
                سبب / بيان التسوية لتوثيق الحركة *
              </label>
              <textarea
                rows={2}
                placeholder="مثال: جرد فعلي لمستودع المصنع، استلام تشغيلة جديدة من المغسلة، هالك قص وخياطة..."
                value={adjustmentNote}
                onChange={(e) => setAdjustmentNote(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setSelectedVariantForAdjust(null)}>
                إلغاء
              </Button>
              <Button
                type="submit"
                variant={adjustmentType === 'REMOVE' ? 'danger' : 'primary'}
                isLoading={isSubmittingAdjust}
                disabled={adjustmentType === 'REMOVE' && adjustmentQuantity > selectedVariantForAdjust.current_stock}
              >
                {adjustmentType === 'REMOVE' && !confirmRemoval
                  ? 'متابعة وتأكيد الصرف'
                  : 'اعتماد التسوية وتسجيل الحركة'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: Threshold Edit (Section 7) */}
      {selectedVariantForThreshold && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedVariantForThreshold(null)}
          title="تعديل حد تنبيه المخزون المنخفض"
          maxWidth="sm"
        >
          <form onSubmit={handleSubmitThreshold} className="space-y-4 text-xs">
            {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                {actionError}
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">{selectedVariantForThreshold.product_name}</span>
              <span className="text-[11px] text-slate-500 font-mono">
                {selectedVariantForThreshold.color} - {selectedVariantForThreshold.size} ({selectedVariantForThreshold.sku})
              </span>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-900">
                حد التنبيه للمخزون (الافتراضي: 10 قطع) *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={newThreshold}
                onChange={(e) => setNewThreshold(Math.max(0, Number(e.target.value) || 0))}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:ring-1 focus:ring-indigo-500"
                required
              />
              <p className="text-[11px] text-slate-400">
                سيتم إظهار وسم (مخزون منخفض) عندما يصل الرصيد الفعلي لهذا المقاس إلى هذا الرقم أو أقل.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setSelectedVariantForThreshold(null)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmittingThreshold}>
                حفظ حد التنبيه
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
