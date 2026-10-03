import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ar' | 'en';

export interface Translations {
  appName: string;
  factoryName: string;
  factorySubtitle: string;
  // Navigation
  navHome: string;
  navCategories: string;
  navProducts: string;
  navCart: string;
  navDashboard: string;
  navOrders: string;
  navInventory: string;
  navCustomers: string;
  navEmployees: string;
  navReports: string;
  navSettings: string;
  navLogin: string;
  navLogout: string;
  // Common Actions
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  add: string;
  search: string;
  filter: string;
  all: string;
  viewDetails: string;
  back: string;
  refresh: string;
  status: string;
  actions: string;
  active: string;
  inactive: string;
  // Dashboard KPIs
  totalOrders: string;
  pendingOrders: string;
  totalProducts: string;
  totalCustomers: string;
  // Roles
  roleAdmin: string;
  roleManager: string;
  roleWorker: string;
  // Storefront
  heroTitle: string;
  heroSubtitle: string;
  shopNow: string;
  featuredCategories: string;
  featuredProducts: string;
  priceCurrency: string;
  addToCart: string;
  selectVariant: string;
  size: string;
  color: string;
  quantity: string;
  stockAvailable: string;
  outOfStock: string;
  // Statuses
  statusPending: string;
  statusConfirmed: string;
  statusProcessing: string;
  statusReady: string;
  statusShipped: string;
  statusDelivered: string;
  statusCancelled: string;
  // Footer
  footerCopyright: string;
  phaseNotice: string;
}

const translations: Record<Language, Translations> = {
  ar: {
    appName: 'مصنع نسيج',
    factoryName: 'مصنع نسيج للملابس الجاهزة',
    factorySubtitle: 'جودة تصنيع مصرية بمعايير عالمية',
    navHome: 'الرئيسية',
    navCategories: 'الأقسام والتصنيفات',
    navProducts: 'المنتجات',
    navCart: 'سلة المشتريات',
    navDashboard: 'لوحة التحكم',
    navOrders: 'إدارة الطلبات',
    navInventory: 'المخزون وحركة الرصيد',
    navCustomers: 'سجل العملاء',
    navEmployees: 'فريق العمل والموظفين',
    navReports: 'التقارير والمؤشرات',
    navSettings: 'إعدادات النظام',
    navLogin: 'دخول الموظفين',
    navLogout: 'تسجيل الخروج',
    save: 'حفظ التغييرات',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    add: 'إضافة جديد',
    search: 'بحث...',
    filter: 'تصفية',
    all: 'الكل',
    viewDetails: 'عرض التفاصيل',
    back: 'رجوع',
    refresh: 'تحديث',
    status: 'الحالة',
    actions: 'الإجراءات',
    active: 'نشط',
    inactive: 'معطل',
    totalOrders: 'إجمالي الطلبات',
    pendingOrders: 'طلبات قيد الانتظار',
    totalProducts: 'إجمالي المنتجات',
    totalCustomers: 'قاعدة العملاء',
    roleAdmin: 'مدير عام (Admin)',
    roleManager: 'مشرف إنتاج (Manager)',
    roleWorker: 'فني تشغيل (Worker)',
    heroTitle: 'ملابس جاهزة عالية الجودة مباشرة من خطوط الإنتاج',
    heroSubtitle: 'خامات قطنية ممشطة فاخرة، تقفيل مصنعي متين، وتشكيلة متنوعة من التيشيرتات والبناطيل والترنجات.',
    shopNow: 'تصفح الكتالوج',
    featuredCategories: 'أقسام المصنع الرئيسية',
    featuredProducts: 'أحدث منتجات خطوط الإنتاج',
    priceCurrency: 'ج.م',
    addToCart: 'إضافة للطلب (تجريبي)',
    selectVariant: 'اختر المقاس واللون',
    size: 'المقاس',
    color: 'اللون',
    quantity: 'الكمية',
    stockAvailable: 'قطعة متوفرة بالمخزون',
    outOfStock: 'نفد من المخزن',
    statusPending: 'قيد الانتظار',
    statusConfirmed: 'مؤكد',
    statusProcessing: 'قيد التجهيز / التصنيع',
    statusReady: 'جاهز للاستلام / الشحن',
    statusShipped: 'تم الشحن',
    statusDelivered: 'تم التسليم',
    statusCancelled: 'ملغي',
    footerCopyright: 'جميع الحقوق محفوظة لمصنع نسيج © 2026',
    phaseNotice: 'المرحلة الأولى: الهيكل الأساسي وقاعدة البيانات ونظام الصلاحيات',
  },
  en: {
    appName: 'Nassij Factory',
    factoryName: 'Nassij Apparel Manufacturing Factory',
    factorySubtitle: 'Egyptian Craftsmanship & Industrial Quality',
    navHome: 'Home',
    navCategories: 'Categories',
    navProducts: 'Products',
    navCart: 'Cart',
    navDashboard: 'Dashboard',
    navOrders: 'Orders',
    navInventory: 'Inventory & Stock',
    navCustomers: 'Customers',
    navEmployees: 'Employees',
    navReports: 'Reports',
    navSettings: 'Settings',
    navLogin: 'Staff Login',
    navLogout: 'Sign Out',
    save: 'Save Changes',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add New',
    search: 'Search...',
    filter: 'Filter',
    all: 'All',
    viewDetails: 'View Details',
    back: 'Back',
    refresh: 'Refresh',
    status: 'Status',
    actions: 'Actions',
    active: 'Active',
    inactive: 'Inactive',
    totalOrders: 'Total Orders',
    pendingOrders: 'Pending Orders',
    totalProducts: 'Total Products',
    totalCustomers: 'Total Customers',
    roleAdmin: 'Administrator',
    roleManager: 'Production Manager',
    roleWorker: 'Factory Worker',
    heroTitle: 'Premium Ready-Made Apparel Direct from Factory Lines',
    heroSubtitle: 'Finest combed cotton, industrial stitching durability, and versatile clothing collections.',
    shopNow: 'Browse Catalog',
    featuredCategories: 'Factory Categories',
    featuredProducts: 'Latest Production Releases',
    priceCurrency: 'EGP',
    addToCart: 'Add to Order (Preview)',
    selectVariant: 'Select Size & Color',
    size: 'Size',
    color: 'Color',
    quantity: 'Quantity',
    stockAvailable: 'items in stock',
    outOfStock: 'Out of Stock',
    statusPending: 'Pending',
    statusConfirmed: 'Confirmed',
    statusProcessing: 'Processing',
    statusReady: 'Ready',
    statusShipped: 'Shipped',
    statusDelivered: 'Delivered',
    statusCancelled: 'Cancelled',
    footerCopyright: 'All rights reserved © Nassij Factory 2026',
    phaseNotice: 'Phase 1: Architecture, Database Foundation & RBAC System',
  },
};

interface I18nContextType {
  lang: Language;
  t: Translations;
  dir: 'rtl' | 'ltr';
  setLang: (lang: Language) => void;
  toggleLang: () => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('nassij_lang') as Language) || 'ar';
  });

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    localStorage.setItem('nassij_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const toggleLang = () => {
    setLang((prev) => (prev === 'ar' ? 'en' : 'ar'));
  };

  return (
    <I18nContext.Provider
      value={{
        lang,
        t: translations[lang],
        dir,
        setLang,
        toggleLang,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
