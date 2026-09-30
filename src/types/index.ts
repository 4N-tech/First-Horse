/**
 * Nassij Factory - Core Application Types & Schemas
 */

export type UserRole = 'ADMIN' | 'MANAGER' | 'WORKER';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'READY'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  avatar?: string | null;
  is_active: number; // 1 or 0
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  product_count?: number;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  sku: string;
  size: string;
  color: string;
  price: number;
  stock_quantity: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  category_id: number;
  category_name?: string;
  name: string;
  slug: string;
  description?: string | null;
  base_price: number;
  image_url?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  variants?: ProductVariant[];
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  created_at: string;
  updated_at: string;
  orders_count?: number;
}

export interface CustomerAddress {
  id: number;
  customer_id: number;
  governorate: string;
  city: string;
  address: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  variant_id?: number | null;
  product_name_snapshot: string;
  variant_snapshot: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  total: number;
  customer_notes?: string | null;
  assigned_to?: number | null;
  assigned_worker_name?: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface DashboardKPIs {
  total_orders: number;
  pending_orders: number;
  total_products: number;
  total_customers: number;
  total_revenue?: number;
  active_workers?: number;
}

export type Permission =
  | 'view_dashboard'
  | 'manage_products'
  | 'manage_categories'
  | 'manage_orders_all'
  | 'manage_orders_assigned'
  | 'update_order_status'
  | 'manage_customers'
  | 'manage_employees'
  | 'view_reports'
  | 'manage_settings';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    'view_dashboard',
    'manage_products',
    'manage_categories',
    'manage_orders_all',
    'manage_orders_assigned',
    'update_order_status',
    'manage_customers',
    'manage_employees',
    'view_reports',
    'manage_settings',
  ],
  MANAGER: [
    'view_dashboard',
    'manage_products',
    'manage_categories',
    'manage_orders_all',
    'manage_orders_assigned',
    'update_order_status',
    'manage_customers',
    'view_reports',
  ],
  WORKER: [
    'view_dashboard',
    'manage_orders_assigned',
    'update_order_status',
  ],
};

export interface AuthResponse {
  user: User;
  token: string;
}
