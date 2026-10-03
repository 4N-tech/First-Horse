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
  assigned_orders_count?: number;
  completed_orders_count?: number;
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
  low_stock_threshold?: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  name: string;
  slug: string;
  description?: string | null;
  base_price: number;
  image_url?: string | null;
  additional_images?: string[];
  is_active: number;
  created_at: string;
  updated_at: string;
  variants?: ProductVariant[];
  variants_count?: number;
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

export const ORDER_STATUS_LABELS_AR: Record<OrderStatus, string> = {
  PENDING: 'معلق',
  CONFIRMED: 'تم التأكيد',
  PROCESSING: 'جاري التجهيز',
  READY: 'جاهز',
  SHIPPED: 'تم الشحن',
  DELIVERED: 'تم التسليم',
  CANCELLED: 'ملغي',
};

export interface OrderStatusHistory {
  id: number;
  order_id: number;
  old_status?: OrderStatus | null;
  new_status: OrderStatus;
  changed_by?: number | null;
  changed_by_name?: string | null;
  changed_by_role?: UserRole | null;
  note?: string | null;
  is_override?: boolean | number;
  created_at: string;
}

export interface OrderAssignmentHistory {
  id: number;
  order_id: number;
  previous_employee_id?: number | null;
  previous_employee_name?: string | null;
  new_employee_id?: number | null;
  new_employee_name?: string | null;
  assigned_by?: number | null;
  assigned_by_name?: string | null;
  note?: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  actor_id?: number | null;
  actor_name?: string | null;
  actor_role?: string | null;
  action: string;
  entity_type: string;
  entity_id?: number | null;
  metadata?: string | null;
  created_at: string;
}

export interface InternalNotification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT';
  entity_type?: string | null;
  entity_id?: number | null;
  is_read: number;
  created_at: string;
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
  image_url?: string | null;
  created_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  governorate?: string;
  city?: string;
  address?: string;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  total: number;
  total_pieces?: number;
  customer_notes?: string | null;
  assigned_to?: number | null;
  assigned_worker_name?: string | null;
  assigned_worker_is_active?: number;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  status_history?: OrderStatusHistory[];
  assignment_history?: OrderAssignmentHistory[];
}

export interface DashboardKPIs {
  total_products: number;
  active_products: number;
  total_categories: number;
  active_categories: number;
  total_orders?: number;
  pending_orders?: number;
  in_progress_orders?: number;
  processing_orders?: number;
  ready_orders?: number;
  delivered_orders?: number;
  cancelled_orders?: number;
  unassigned_orders_count?: number;
  total_customers?: number;
  total_revenue?: number;
  active_workers?: number;
  is_worker_view?: boolean;
  latest_orders?: Order[];
  unassigned_orders?: Order[];
}

export interface CartItem {
  product_id: number;
  variant_id: number;
  product_name: string;
  product_slug: string;
  color: string;
  size: string;
  sku: string;
  price: number;
  image_url?: string | null;
  quantity: number;
  stock_quantity: number;
  is_active?: boolean;
  error_message?: string;
}

export interface CheckoutCustomer {
  name: string;
  phone: string;
}

export interface CheckoutAddress {
  governorate: string;
  city: string;
  address: string;
  notes?: string;
}

export interface CheckoutPayload {
  customer: CheckoutCustomer;
  address: CheckoutAddress;
  items: {
    product_id: number;
    variant_id: number;
    quantity: number;
  }[];
  customer_notes?: string;
  idempotency_key?: string;
}

export type Permission =
  | 'view_dashboard'
  | 'manage_products'
  | 'manage_categories'
  | 'manage_inventory'
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
    'manage_inventory',
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
    'manage_inventory',
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

// ==========================================
// PHASE 5: Inventory & Stock Control Types
// ==========================================

export type InventoryMovementType =
  | 'INITIAL'
  | 'PURCHASE'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'ORDER_RESERVATION'
  | 'ORDER_RELEASE'
  | 'ORDER_DEDUCTION'
  | 'RETURN';

export const INVENTORY_MOVEMENT_LABELS_AR: Record<InventoryMovementType, string> = {
  INITIAL: 'رصيد افتتاحي',
  PURCHASE: 'شراء / توريد',
  ADJUSTMENT_IN: 'تسوية بالزيادة (+)',
  ADJUSTMENT_OUT: 'تسوية بالعجز (-)',
  ORDER_RESERVATION: 'حجز طلب',
  ORDER_RELEASE: 'إلغاء حجز / استرجاع مخزون',
  ORDER_DEDUCTION: 'صرف طلب عميل (-)',
  RETURN: 'مرتجع عميل (+)',
};

export interface InventoryMovement {
  id: number;
  variant_id: number;
  movement_type: InventoryMovementType;
  quantity_delta: number;
  stock_before: number;
  stock_after: number;
  reference_type?: string | null;
  reference_id?: number | string | null;
  note?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
  // Joined fields for display
  product_name?: string;
  product_id?: number;
  sku?: string;
  size?: string;
  color?: string;
  order_number?: string | null;
}

export type StockStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';

export interface InventoryItem {
  variant_id: number;
  product_id: number;
  product_name: string;
  product_slug: string;
  category_id: number;
  category_name: string;
  image_url?: string | null;
  sku: string;
  size: string;
  color: string;
  price: number;
  current_stock: number;
  low_stock_threshold: number;
  is_active: number;
  stock_status: StockStatus;
  last_updated?: string;
}

export interface InventorySummary {
  total_variants: number;
  out_of_stock_count: number;
  low_stock_count: number;
  total_units: number;
}
