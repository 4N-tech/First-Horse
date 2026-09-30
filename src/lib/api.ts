import { User, Category, Product, Order, Customer, DashboardKPIs } from '../types/index.ts';

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
    delete: (id: number) => fetchApi<{ success: boolean; message: string }>(`/api/categories/${id}`, { method: 'DELETE' }),
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
    getAdminAll: () => fetchApi<{ success: boolean; data: Product[] }>('/api/products/admin'),
    getOne: (idOrSlug: string | number) => fetchApi<{ success: boolean; data: Product }>(`/api/products/${idOrSlug}`),
    create: (payload: any) =>
      fetchApi<{ success: boolean; data: Product; message: string }>('/api/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (id: number, payload: Partial<Product>) =>
      fetchApi<{ success: boolean; data: Product; message: string }>(`/api/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    delete: (id: number) => fetchApi<{ success: boolean; message: string }>(`/api/products/${id}`, { method: 'DELETE' }),
  },

  // Orders
  orders: {
    getAll: (params?: { status?: string; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.search) q.set('search', params.search);
      const qs = q.toString() ? `?${q.toString()}` : '';
      return fetchApi<{ success: boolean; data: Order[] }>(`/api/orders${qs}`);
    },
    getOne: (id: number) => fetchApi<{ success: boolean; data: Order }>(`/api/orders/${id}`),
    updateStatus: (id: number, status: string) =>
      fetchApi<{ success: boolean; data: Order; message: string }>(`/api/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    assignWorker: (id: number, assigned_to: number | null) =>
      fetchApi<{ success: boolean; message: string }>(`/api/orders/${id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ assigned_to }),
      }),
  },

  // Employees (Admin Only)
  employees: {
    getAll: () => fetchApi<{ success: boolean; data: User[] }>('/api/admin/employees'),
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
  },

  // Customers (Admin & Manager)
  customers: {
    getAll: () => fetchApi<{ success: boolean; data: Customer[] }>('/api/admin/customers'),
    getOne: (id: number) => fetchApi<{ success: boolean; data: Customer & { addresses: any[] } }>(`/api/admin/customers/${id}`),
  },

  // Dashboard & KPIs
  dashboard: {
    getKPIs: () => fetchApi<{ success: boolean; data: DashboardKPIs & { is_worker_view?: boolean } }>('/api/admin/dashboard/kpis'),
    getReports: () => fetchApi<{ success: boolean; data: any }>('/api/admin/dashboard/reports'),
    getSettings: () => fetchApi<{ success: boolean; data: any }>('/api/admin/dashboard/settings'),
  },
};
