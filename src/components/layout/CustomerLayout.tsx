import React, { useState, useEffect } from 'react';
import { ShoppingBag, Lock, Layers, Globe, Menu, X, ArrowLeft, Shirt } from 'lucide-react';
import { useI18n } from '../../lib/i18n.tsx';
import { useAuth } from '../../lib/auth-context.tsx';
import { Category } from '../../types/index.ts';
import { api } from '../../lib/api.ts';

interface CustomerLayoutProps {
  children: React.ReactNode;
  activeCategorySlug?: string;
  onNavigateHome: () => void;
  onNavigateCategory: (slug: string) => void;
  onNavigateLogin: () => void;
  onNavigateAdmin: () => void;
}

export const CustomerLayout: React.FC<CustomerLayoutProps> = ({
  children,
  activeCategorySlug,
  onNavigateHome,
  onNavigateCategory,
  onNavigateLogin,
  onNavigateAdmin,
}) => {
  const { t, lang, toggleLang } = useI18n();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCartDrawer, setShowCartDrawer] = useState(false);

  useEffect(() => {
    api.categories.getAll().then((res) => {
      if (res.success && res.data) {
        setCategories(res.data);
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Announcement Bar */}
      <div className="bg-slate-900 text-slate-300 text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{t.factorySubtitle} | {t.phaseNotice}</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleLang}
              className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-[11px]"
            >
              <Globe className="h-3 w-3" />
              <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
            </button>
            {user ? (
              <button
                onClick={onNavigateAdmin}
                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors font-medium cursor-pointer"
              >
                <Layers className="h-3 w-3" />
                <span>{t.navDashboard} ({user.name.split(' ')[0]})</span>
              </button>
            ) : (
              <button
                onClick={onNavigateLogin}
                className="flex items-center gap-1 hover:text-white transition-colors text-[11px] cursor-pointer"
              >
                <Lock className="h-3 w-3" />
                <span>{t.navLogin}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo & Brand */}
            <div className="flex items-center gap-3">
              <button
                onClick={onNavigateHome}
                className="flex items-center gap-2.5 text-start group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs group-hover:bg-indigo-700 transition-colors">
                  <Shirt className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-lg font-black tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors block leading-none">
                    {t.appName}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium block mt-1">
                    خطوط إنتاج وتصنيع الملابس
                  </span>
                </div>
              </button>
            </div>

            {/* Desktop Categories Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              <button
                onClick={onNavigateHome}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  !activeCategorySlug
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {t.all}
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onNavigateCategory(c.slug)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeCategorySlug === c.slug
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {c.name}
                  {c.product_count !== undefined && (
                    <span className="ms-1.5 text-[10px] opacity-70 bg-slate-200/60 px-1.5 py-0.5 rounded-full">
                      {c.product_count}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Cart & Mobile Hamburger */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCartDrawer(true)}
                className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium border border-slate-200"
                title={t.navCart}
              >
                <ShoppingBag className="h-4 w-4 text-indigo-600" />
                <span className="hidden sm:inline text-xs font-semibold">{t.navCart}</span>
                <span className="bg-indigo-600 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                  0
                </span>
              </button>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-1 shadow-lg">
            <button
              onClick={() => {
                onNavigateHome();
                setMobileMenuOpen(false);
              }}
              className="block w-full text-start px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              {t.all}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onNavigateCategory(c.slug);
                  setMobileMenuOpen(false);
                }}
                className={`block w-full text-start px-3 py-2 rounded-lg text-sm font-semibold ${
                  activeCategorySlug === c.slug
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {c.name}
              </button>
            ))}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={onNavigateLogin}
                className="text-xs text-indigo-600 font-semibold flex items-center gap-1"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>{t.navLogin}</span>
              </button>
              <button onClick={toggleLang} className="text-xs text-slate-500 font-medium">
                {lang === 'ar' ? 'English' : 'العربية'}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Page Content */}
      <main className="flex-1">{children}</main>

      {/* Cart Placeholder Drawer */}
      {showCartDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="fixed inset-0 bg-slate-900/60 transition-opacity" onClick={() => setShowCartDrawer(false)} />
          <div className="fixed inset-y-0 end-0 max-w-full flex">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-bold text-base text-slate-900">{t.navCart}</h3>
                </div>
                <button
                  onClick={() => setShowCartDrawer(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mb-3">
                  <ShoppingBag className="h-8 w-8" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm">سلة المشتريات فارغة حالياً</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  هذا العنصر هو واجهة تجريبية للمرحلة الأولى. ستتاح وظائف إضافة السلة وإتمام الطلبات بالتفصيل في المرحلة القادمة.
                </p>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <button
                  onClick={() => setShowCartDrawer(false)}
                  className="w-full bg-slate-900 text-white rounded-xl py-2.5 text-xs font-bold hover:bg-slate-800"
                >
                  متابعة التصفح
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-16 text-slate-600 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white">
                <Shirt className="h-3.5 w-3.5" />
              </div>
              <span className="font-bold text-slate-800">{t.factoryName}</span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-500 text-[11px]">{t.phaseNotice}</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-500">
              <button onClick={onNavigateHome} className="hover:text-indigo-600 cursor-pointer">
                {t.navHome}
              </button>
              <button onClick={onNavigateLogin} className="hover:text-indigo-600 cursor-pointer">
                {t.navLogin}
              </button>
              <span>{t.footerCopyright}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
