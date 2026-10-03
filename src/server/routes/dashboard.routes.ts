import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.ts';
import { requireAuth, requireRole, requirePermission, AuthRequest } from '../middleware/auth.ts';
import { DashboardKPIs, Order } from '../../types/index.ts';

const router = Router();

// GET KPI statistics for dashboard shell
router.get('/kpis', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;

    if (user.role === 'WORKER') {
      // Worker-specific KPIs
      const totalWorkerOrders = await queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM orders WHERE assigned_to = ?',
        [user.id]
      );
      const pendingWorkerOrders = await queryOne<{ count: number }>(
        "SELECT COUNT(*) as count FROM orders WHERE assigned_to = ? AND status IN ('PENDING', 'CONFIRMED')",
        [user.id]
      );
      const inProgressWorkerOrders = await queryOne<{ count: number }>(
        "SELECT COUNT(*) as count FROM orders WHERE assigned_to = ? AND status = 'PROCESSING'",
        [user.id]
      );
      const readyWorkerOrders = await queryOne<{ count: number }>(
        "SELECT COUNT(*) as count FROM orders WHERE assigned_to = ? AND status = 'READY'",
        [user.id]
      );
      const completedWorkerOrders = await queryOne<{ count: number }>(
        "SELECT COUNT(*) as count FROM orders WHERE assigned_to = ? AND status IN ('SHIPPED', 'DELIVERED')",
        [user.id]
      );

      return res.json({
        success: true,
        data: {
          total_orders: totalWorkerOrders?.count || 0,
          pending_orders: pendingWorkerOrders?.count || 0,
          processing_orders: inProgressWorkerOrders?.count || 0,
          ready_orders: readyWorkerOrders?.count || 0,
          delivered_orders: completedWorkerOrders?.count || 0,
          is_worker_view: true,
        },
      });
    }

    // Admin & Manager global KPIs (Real Database Data)
    const totalProductsRes = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM products');
    const activeProductsRes = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM products WHERE is_active = 1');
    const totalCategoriesRes = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM categories');
    const activeCategoriesRes = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM categories WHERE is_active = 1');

    const totalOrdersRes = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM orders');
    const pendingOrdersRes = await queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM orders WHERE status = 'PENDING'"
    );
    const processingOrdersRes = await queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM orders WHERE status IN ('CONFIRMED', 'PROCESSING')"
    );
    const readyOrdersRes = await queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM orders WHERE status = 'READY'"
    );
    const deliveredOrdersRes = await queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM orders WHERE status = 'DELIVERED'"
    );
    const cancelledOrdersRes = await queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM orders WHERE status = 'CANCELLED'"
    );
    const unassignedCountRes = await queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM orders WHERE assigned_to IS NULL AND status != 'CANCELLED'"
    );

    const revenueRes = await queryOne<{ total: number }>('SELECT COALESCE(SUM(total), 0) as total FROM orders');
    const customersRes = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM customers');

    // Requirement 19: Latest 10 orders
    const latestOrders = await query<Order>(
      `SELECT o.*, 
              c.name as customer_name, 
              c.phone as customer_phone, 
              u.name as assigned_worker_name,
              u.is_active as assigned_worker_is_active,
              COALESCE(oi_sum.total_pieces, 0) as total_pieces
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       LEFT JOIN users u ON o.assigned_to = u.id
       LEFT JOIN (
         SELECT order_id, SUM(quantity) as total_pieces 
         FROM order_items 
         GROUP BY order_id
       ) oi_sum ON oi_sum.order_id = o.id
       ORDER BY o.id DESC
       LIMIT 10`
    );

    // Requirement 19: Unassigned orders
    const unassignedOrders = await query<Order>(
      `SELECT o.*, 
              c.name as customer_name, 
              c.phone as customer_phone, 
              COALESCE(oi_sum.total_pieces, 0) as total_pieces
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       LEFT JOIN (
         SELECT order_id, SUM(quantity) as total_pieces 
         FROM order_items 
         GROUP BY order_id
       ) oi_sum ON oi_sum.order_id = o.id
       WHERE o.assigned_to IS NULL AND o.status != 'CANCELLED'
       ORDER BY o.id DESC
       LIMIT 10`
    );

    const kpis: DashboardKPIs = {
      total_products: totalProductsRes?.count || 0,
      active_products: activeProductsRes?.count || 0,
      total_categories: totalCategoriesRes?.count || 0,
      active_categories: activeCategoriesRes?.count || 0,
      total_orders: totalOrdersRes?.count || 0,
      pending_orders: pendingOrdersRes?.count || 0,
      processing_orders: processingOrdersRes?.count || 0,
      ready_orders: readyOrdersRes?.count || 0,
      delivered_orders: deliveredOrdersRes?.count || 0,
      cancelled_orders: cancelledOrdersRes?.count || 0,
      unassigned_orders_count: unassignedCountRes?.count || 0,
      total_revenue: revenueRes?.total || 0,
      total_customers: customersRes?.count || 0,
      latest_orders: latestOrders,
      unassigned_orders: unassignedOrders,
    };

    return res.json({ success: true, data: kpis });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Reports summary (ADMIN & MANAGER only)
router.get('/reports', requireAuth, requirePermission('view_reports'), async (req: AuthRequest, res: Response) => {
  try {
    const statusCounts = await queryOne<any>(`
      SELECT 
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'READY' THEN 1 ELSE 0 END) as ready,
        SUM(CASE WHEN status = 'SHIPPED' THEN 1 ELSE 0 END) as shipped,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
        SUM(total) as gross_revenue
      FROM orders
    `);

    return res.json({ success: true, data: statusCounts });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// System Settings (ADMIN ONLY)
router.get('/settings', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  return res.json({
    success: true,
    data: {
      factory_name: 'مصنع نسيج للملابس الجاهزة والتصنيع',
      factory_code: 'NSJ-EG-01',
      default_currency: 'EGP (جنيه مصري)',
      timezone: 'Africa/Cairo',
      delivery_fee_default: 50,
      phase: 'Phase 1 - Architecture & Foundation',
      system_version: '1.0.0',
    },
  });
});

export default router;
