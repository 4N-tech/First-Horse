import React, { useState } from 'react';
import { I18nProvider } from './lib/i18n.tsx';
import { AuthProvider, useAuth } from './lib/auth-context.tsx';
import { CartProvider } from './lib/cart-context.tsx';
import { CustomerLayout } from './components/layout/CustomerLayout.tsx';
import { AdminLayout, AdminRoute } from './components/layout/AdminLayout.tsx';

// Storefront Pages
import { HomePage } from './pages/storefront/HomePage.tsx';
import { CategoryPage } from './pages/storefront/CategoryPage.tsx';
import { ProductDetailPage } from './pages/storefront/ProductDetailPage.tsx';
import { CartPage } from './pages/storefront/CartPage.tsx';
import { CheckoutPage } from './pages/storefront/CheckoutPage.tsx';
import { OrderSuccessPage } from './pages/storefront/OrderSuccessPage.tsx';
import { OrderLookupPage } from './pages/storefront/OrderLookupPage.tsx';

// Auth Page
import { LoginPage } from './pages/auth/LoginPage.tsx';

// Admin Pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.tsx';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage.tsx';
import { AdminOrderDetailPage } from './pages/admin/AdminOrderDetailPage.tsx';
import { AdminInventoryPage } from './pages/admin/AdminInventoryPage.tsx';
import { AdminProductsPage } from './pages/admin/AdminProductsPage.tsx';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage.tsx';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage.tsx';
import { AdminEmployeesPage } from './pages/admin/AdminEmployeesPage.tsx';
import { AdminReportsPage } from './pages/admin/AdminReportsPage.tsx';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage.tsx';

// Worker Pages
import { WorkerDashboardPage } from './pages/worker/WorkerDashboardPage.tsx';

type MainView = 'storefront' | 'login' | 'admin';
type StorefrontSubView = 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'order-success' | 'order-lookup';

function AppContent() {
  const { user, isLoading } = useAuth();

  const [mainView, setMainView] = useState<MainView>('storefront');
  const [storefrontSubView, setStorefrontSubView] = useState<StorefrontSubView>('home');
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('');
  const [selectedProductSlug, setSelectedProductSlug] = useState<string>('');
  const [completedOrderNumber, setCompletedOrderNumber] = useState<string>('');
  const [adminRoute, setAdminRoute] = useState<AdminRoute>('dashboard');
  const [selectedAdminOrderNumber, setSelectedAdminOrderNumber] = useState<string | null>(null);

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

  // Navigate to Cart
  const handleNavigateCart = () => {
    setStorefrontSubView('cart');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Navigate to Checkout
  const handleNavigateCheckout = () => {
    setStorefrontSubView('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Order Completed
  const handleOrderCompleted = (orderNumber: string) => {
    setCompletedOrderNumber(orderNumber);
    setStorefrontSubView('order-success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Navigate to Order Lookup / Tracking
  const handleNavigateLookup = (orderNum?: string) => {
    if (orderNum) setCompletedOrderNumber(orderNum);
    setStorefrontSubView('order-lookup');
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

  // Admin & Worker Protected Views
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

    // Role Enforcement (Requirement 14): WORKER only sees their dedicated workspace
    if (user?.role === 'WORKER') {
      return (
        <WorkerDashboardPage
          onLogout={() => {
            setMainView('login');
          }}
          onNavigateStorefront={() => setMainView('storefront')}
        />
      );
    }

    return (
      <AdminLayout
        currentRoute={adminRoute}
        onNavigate={(route) => {
          setSelectedAdminOrderNumber(null);
          setAdminRoute(route);
        }}
        onNavigateStorefront={() => setMainView('storefront')}
      >
        {adminRoute === 'dashboard' && (
          <AdminDashboardPage
            onNavigate={(route) => {
              setSelectedAdminOrderNumber(null);
              setAdminRoute(route);
            }}
            onSelectOrder={(orderNumber) => {
              setSelectedAdminOrderNumber(orderNumber);
              setAdminRoute('orders');
            }}
          />
        )}
        {adminRoute === 'orders' && (
          selectedAdminOrderNumber ? (
            <AdminOrderDetailPage
              orderNumber={selectedAdminOrderNumber}
              onBack={() => setSelectedAdminOrderNumber(null)}
            />
          ) : (
            <AdminOrdersPage
              onSelectOrder={(orderNumber) => setSelectedAdminOrderNumber(orderNumber)}
            />
          )
        )}
        {adminRoute === 'inventory' && <AdminInventoryPage />}
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
      onNavigateCart={handleNavigateCart}
      onNavigateLookup={handleNavigateLookup}
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
          onNavigateCart={handleNavigateCart}
        />
      )}
      {storefrontSubView === 'cart' && (
        <CartPage
          onNavigateHome={handleBackToHome}
          onNavigateCheckout={handleNavigateCheckout}
          onSelectProduct={handleSelectProduct}
        />
      )}
      {storefrontSubView === 'checkout' && (
        <CheckoutPage
          onNavigateHome={handleBackToHome}
          onNavigateCart={handleNavigateCart}
          onOrderCompleted={handleOrderCompleted}
        />
      )}
      {storefrontSubView === 'order-success' && (
        <OrderSuccessPage
          orderNumber={completedOrderNumber}
          onNavigateHome={handleBackToHome}
          onNavigateLookup={handleNavigateLookup}
        />
      )}
      {storefrontSubView === 'order-lookup' && (
        <OrderLookupPage
          initialOrderNumber={completedOrderNumber}
          onNavigateHome={handleBackToHome}
        />
      )}
    </CustomerLayout>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
