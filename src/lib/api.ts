import { User, Category, Product, Order, Customer, DashboardKPIs, InventoryItem, InventoryMovement, InventorySummary } from '../types/index.ts';

const TOKEN_KEY = 'nassij_auth_token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  remove: () => localStorage.removeItem(TOKEN_KEY),
};

async function fetchApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStorage.get();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }

  return data;
}

export const api = {
  // Auth
  auth: {
    login: (credentials: { email: string; password: string }) =>
      fetchApi<{ success: boolean; user: User; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    me: () => fetchApi<{ success: boolean; user: User }>('/api/auth/me'),
    logout: () => fetchApi<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
    demoAccounts: () => fetchApi<{ success: boolean; demoUsers: any[] }>('/api/auth/demo-accounts'),
  },

  // Categories
  categories: {
    getAll: () => fetchApi<{ success: boolean; data: Category[] }>('/api/categories'),
    getAdminAll: () => fetchApi<{ success: boolean; data: Category[] }>('/api/categories/admin'),
    getOne: (idOrSlug: string | number) => fetchApi<{ success: boolean; data: Category }>(`/api/categories/${idOrSlug}`),
    create: (payload: Partial<Category>) =>
      fetchApi<{ success: boolean; data: Category; message: string }>('/api/categories', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (id: number, payload: Partial<Category>) =>
      fetchApi<{ success: boolean; data: Category; message: string }>(`/api/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    toggleStatus: (id: number) =>
      fetchApi<{ success: boolean; data: { id: number; is_active: number }; message: string }>(`/api/categories/${id}/toggle-status`, {
        method: 'PATCH',
      }),
    moveProducts: (id: number, target_category_id: number, and_delete: boolean = false) =>
      fetchApi<{ success: boolean; message: string }>(`/api/categories/${id}/move-products`, {
        method: 'POST',
        body: JSON.stringify({ target_category_id, and_delete }),
      }),
    delete: (id: number) => fetchApi<{ success: boolean; message: string; error?: string; product_count?: number }>(`/api/categories/${id}`, { method: 'DELETE' }),
  },

  // Products
  products: {
    getAll: (params?: { category_id?: number; category_slug?: string; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.category_id) q.set('category_id', String(params.category_id));
      if (params?.category_slug) q.set('category_slug', params.category_slug);
      if (params?.search) q.set('search', params.search);
      const qs = q.toString() ? `?${q.toString()}` : '';
      return fetchApi<{ success: boolean; data: Product[] }>(`/api/products${qs}`);
    },
    getAdminAll: (params?: { page?: number; limit?: number; category_id?: number; search?: string; status?: string }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.category_id) q.set('category_id', String(params.category_id));
      if (params?.search) q.set('search', params.search);
      if (params?.status) q.set('status', params.status);
      const qs = q.toString() ? `?${q.toString()}` : '';
      return fetchApi<{
        success: boolean;
        data: Product[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      }>(`/api/products/admin${qs}`);
    },
    getOne: (idOrSlug: string | number) => fetchApi<{ success: boolean; data: Product }>(`/api/products/${idOrSlug}`),
    create: (payload: any) =>
      fetchApi<{ success: boolean; data: Product; message: string }>('/api/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (id: number, payload: any) =>
      fetchApi<{ success: boolean; data: Product; message: string }>(`/api/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    toggleStatus: (id: number) =>
      fetchApi<{ success: boolean; data: { id: number; is_active: number }; message: string }>(`/api/products/${id}/toggle-status`, {
        method: 'PATCH',
      }),
    duplicate: (id: number) =>
      fetchApi<{ success: boolean; data: Product; message: string }>(`/api/products/${id}/duplicate`, {
        method: 'POST',
      }),
    delete: (id: number) => fetchApi<{ success: boolean; message: string }>(`/api/products/${id}`, { method: 'DELETE' }),
  },

  // Upload
  upload: {
    image: (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      return fetchApi<{ success: boolean; url: string; filename: string }>('/api/upload', {
        method: 'POST',
        body: formData,
      });
    },
  },

  // Orders
  orders: {
    getAll: (params?: {
      status?: string;
      assigned_to?: string | number;
      date_range?: string;
      date_from?: string;
      date_to?: string;
      search?: string;
    }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.assigned_to !== undefined && params?.assigned_to !== '') q.set('assigned_to', String(params.assigned_to));
      if (params?.date_range) q.set('date_range', params.date_range);
      if (params?.date_from) q.set('date_from', params.date_from);
      if (params?.date_to) q.set('date_to', params.date_to);
      if (params?.search) q.set('search', params.search);
      const qs = q.toString() ? `?${q.toString()}` : '';
      return fetchApi<{ success: boolean; data: Order[] }>(`/api/orders${qs}`);
    },
    getOne: (id: number) => fetchApi<{ success: boolean; data: Order }>(`/api/orders/${id}`),
    getByNumber: (orderNumber: string) => fetchApi<{ success: boolean; data: Order }>(`/api/orders/by-number/${encodeURIComponent(orderNumber)}`),
    updateStatus: (id: number, status: string, note?: string, is_override?: boolean) =>
      fetchApi<{ success: boolean; data: Order; message: string }>(`/api/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note, is_override }),
      }),
    assignWorker: (id: number, assigned_to: number | null, note?: string) =>
      fetchApi<{ success: boolean; data?: Order; message: string }>(`/api/orders/${id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ assigned_to, note }),
      }),
    getWorkerWorkspace: () =>
      fetchApi<{ success: boolean; data: { kpis: { total_assigned: number; new_orders: number; in_progress: number; ready: number; completed: number }; orders: Order[] } }>('/api/orders/worker/workspace'),
    getActivityLogs: () =>
      fetchApi<{ success: boolean; data: any[] }>('/api/orders/audit/activity-logs'),
    getNotifications: () =>
      fetchApi<{ success: boolean; data: any[]; unread_count: number }>('/api/orders/user/notifications'),
    markNotificationRead: (id: number) =>
      fetchApi<{ success: boolean; message: string }>(`/api/orders/user/notifications/${id}/read`, {
        method: 'PATCH',
      }),
    markAllNotificationsRead: () =>
      fetchApi<{ success: boolean; message: string }>('/api/orders/user/notifications/mark-all-read', {
        method: 'PATCH',
      }),
    // Phase 3 Public Customer Order endpoints
    checkout: (payload: any) =>
      fetchApi<{ success: boolean; data: any; message: string }>('/api/orders/checkout', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    validateCart: (items: { product_id: number; variant_id: number; quantity: number }[]) =>
      fetchApi<{ success: boolean; is_valid: boolean; items: any[] }>('/api/orders/validate-cart', {
        method: 'POST',
        body: JSON.stringify({ items }),
      }),
    getPublicOrder: (orderNumber: string) =>
      fetchApi<{ success: boolean; data: any }>(`/api/orders/public/${encodeURIComponent(orderNumber)}`),
    lookupOrder: (order_number: string, phone: string) =>
      fetchApi<{ success: boolean; data: any }>('/api/orders/lookup', {
        method: 'POST',
        body: JSON.stringify({ order_number, phone }),
      }),
  },

  // Employees (Admin Only)
  employees: {
    getAll: () => fetchApi<{ success: boolean; data: User[] }>('/api/admin/employees'),
    getProfile: (id: number) => fetchApi<{ success: boolean; data: any }>(`/api/admin/employees/${id}`),
    getAssignableWorkers: () => fetchApi<{ success: boolean; data: User[] }>('/api/admin/employees/assignable-workers'),
    create: (payload: any) =>
      fetchApi<{ success: boolean; data: User; message: string }>('/api/admin/employees', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (id: number, payload: any) =>
      fetchApi<{ success: boolean; data: User; message: string }>(`/api/admin/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    delete: (id: number) =>
      fetchApi<{ success: boolean; message: string }>(`/api/admin/employees/${id}`, {
        method: 'DELETE',
      }),
  },

  // Customers (Admin & Manager)
  customers: {
    getAll: () => fetchApi<{ success: boolean; data: Customer[] }>('/api/admin/customers'),
    getOne: (id: number) => fetchApi<{ success: boolean; data: Customer & { addresses: any[] } }>(`/api/admin/customers/${id}`),
  },

  // Inventory & Stock Control (Phase 5 - Admin & Manager)
  inventory: {
    getSummary: () =>
      fetchApi<{ success: boolean; data: InventorySummary }>('/api/inventory/summary'),
    getItems: (params?: {
      category_id?: number;
      product_id?: number;
      size?: string;
      color?: string;
      stock_status?: string;
      is_active?: number;
      search?: string;
      page?: number;
      limit?: number;
    }) => {
      const q = new URLSearchParams();
      if (params?.category_id) q.set('category_id', String(params.category_id));
      if (params?.product_id) q.set('product_id', String(params.product_id));
      if (params?.size) q.set('size', params.size);
      if (params?.color) q.set('color', params.color);
      if (params?.stock_status) q.set('stock_status', params.stock_status);
      if (params?.is_active !== undefined) q.set('is_active', String(params.is_active));
      if (params?.search) q.set('search', params.search);
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return fetchApi<{
        success: boolean;
        data: InventoryItem[];
        pagination: { total: number; page: number; limit: number; total_pages: number };
      }>(`/api/inventory${qs}`);
    },
    getMovements: (params?: {
      date_range?: string;
      date_from?: string;
      date_to?: string;
      variant_id?: number;
      product_id?: number;
      movement_type?: string;
      created_by?: number;
      search?: string;
      page?: number;
      limit?: number;
    }) => {
      const q = new URLSearchParams();
      if (params?.date_range) q.set('date_range', params.date_range);
      if (params?.date_from) q.set('date_from', params.date_from);
      if (params?.date_to) q.set('date_to', params.date_to);
      if (params?.variant_id) q.set('variant_id', String(params.variant_id));
      if (params?.product_id) q.set('product_id', String(params.product_id));
      if (params?.movement_type) q.set('movement_type', params.movement_type);
      if (params?.created_by) q.set('created_by', String(params.created_by));
      if (params?.search) q.set('search', params.search);
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return fetchApi<{
        success: boolean;
        data: InventoryMovement[];
        pagination: { total: number; page: number; limit: number; total_pages: number };
      }>(`/api/inventory/movements${qs}`);
    },
    adjustStock: (payload: {
      variant_id: number;
      adjustment_type: 'ADD' | 'REMOVE';
      quantity: number;
      note: string;
    }) =>
      fetchApi<{
        success: boolean;
        data: any;
        message: string;
      }>('/api/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateThreshold: (variantId: number, low_stock_threshold: number) =>
      fetchApi<{ success: boolean; data: any; message: string }>(
        `/api/inventory/variants/${variantId}/threshold`,
        {
          method: 'PATCH',
          body: JSON.stringify({ low_stock_threshold }),
        }
      ),
  },

  // Dashboard & KPIs
  dashboard: {
    getKPIs: () => fetchApi<{ success: boolean; data: DashboardKPIs & { is_worker_view?: boolean } }>('/api/admin/dashboard/kpis'),
    getReports: () => fetchApi<{ success: boolean; data: any }>('/api/admin/dashboard/reports'),
    getSettings: () => fetchApi<{ success: boolean; data: any }>('/api/admin/dashboard/settings'),
  },
};
