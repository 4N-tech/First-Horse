import React, { useState } from 'react';
import { I18nProvider } from './lib/i18n.tsx';
import { AuthProvider, useAuth } from './lib/auth-context.tsx';
import { CustomerLayout } from './components/layout/CustomerLayout.tsx';
import { AdminLayout, AdminRoute } from './components/layout/AdminLayout.tsx';

// Storefront Pages
import { HomePage } from './pages/storefront/HomePage.tsx';
import { CategoryPage } from './pages/storefront/CategoryPage.tsx';
import { ProductDetailPage } from './pages/storefront/ProductDetailPage.tsx';

// Auth Page
import { LoginPage } from './pages/auth/LoginPage.tsx';

// Admin Pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.tsx';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage.tsx';
import { AdminProductsPage } from './pages/admin/AdminProductsPage.tsx';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage.tsx';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage.tsx';
import { AdminEmployeesPage } from './pages/admin/AdminEmployeesPage.tsx';
import { AdminReportsPage } from './pages/admin/AdminReportsPage.tsx';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage.tsx';

type MainView = 'storefront' | 'login' | 'admin';

function AppContent() {
  const { user, isLoading } = useAuth();

  const [mainView, setMainView] = useState<MainView>('storefront');
  const [storefrontSubView, setStorefrontSubView] = useState<'home' | 'category' | 'product'>('home');
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('');
  const [selectedProductSlug, setSelectedProductSlug] = useState<string>('');
  const [adminRoute, setAdminRoute] = useState<AdminRoute>('dashboard');

  // Handle category selection
  const handleSelectCategory = (slug: string) => {
    setSelectedCategorySlug(slug);
    setStorefrontSubView('category');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle product selection
  const handleSelectProduct = (slug: string) => {
    setSelectedProductSlug(slug);
    setStorefrontSubView('product');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Return to home
  const handleBackToHome = () => {
    setStorefrontSubView('home');
    setSelectedCategorySlug('');
    setSelectedProductSlug('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Login page view
  if (mainView === 'login') {
    return (
      <LoginPage
        onSuccess={() => {
          setMainView('admin');
          setAdminRoute('dashboard');
        }}
        onBackToStorefront={() => setMainView('storefront')}
      />
    );
  }

  // Admin Dashboard views (Protected Area)
  if (mainView === 'admin') {
    if (!user && !isLoading) {
      // If session expired or logged out, show login
      return (
        <LoginPage
          onSuccess={() => setMainView('admin')}
          onBackToStorefront={() => setMainView('storefront')}
        />
      );
    }

    return (
      <AdminLayout
        currentRoute={adminRoute}
        onNavigate={(route) => setAdminRoute(route)}
        onNavigateStorefront={() => setMainView('storefront')}
      >
        {adminRoute === 'dashboard' && <AdminDashboardPage onNavigate={setAdminRoute} />}
        {adminRoute === 'orders' && <AdminOrdersPage />}
        {adminRoute === 'products' && <AdminProductsPage />}
        {adminRoute === 'categories' && <AdminCategoriesPage />}
        {adminRoute === 'customers' && <AdminCustomersPage />}
        {adminRoute === 'employees' && <AdminEmployeesPage />}
        {adminRoute === 'reports' && <AdminReportsPage />}
        {adminRoute === 'settings' && <AdminSettingsPage />}
      </AdminLayout>
    );
  }

  // Customer Storefront views (Public Area)
  return (
    <CustomerLayout
      activeCategorySlug={storefrontSubView === 'category' ? selectedCategorySlug : undefined}
      onNavigateHome={handleBackToHome}
      onNavigateCategory={handleSelectCategory}
      onNavigateLogin={() => setMainView('login')}
      onNavigateAdmin={() => setMainView('admin')}
    >
      {storefrontSubView === 'home' && (
        <HomePage
          onSelectCategory={handleSelectCategory}
          onSelectProduct={handleSelectProduct}
        />
      )}
      {storefrontSubView === 'category' && (
        <CategoryPage
          categorySlug={selectedCategorySlug}
          onSelectProduct={handleSelectProduct}
          onBackToHome={handleBackToHome}
        />
      )}
      {storefrontSubView === 'product' && (
        <ProductDetailPage
          productSlug={selectedProductSlug}
          onBack={() => {
            if (selectedCategorySlug) {
              setStorefrontSubView('category');
            } else {
              setStorefrontSubView('home');
            }
          }}
          onSelectCategory={handleSelectCategory}
        />
      )}
    </CustomerLayout>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </I18nProvider>
  );
}
