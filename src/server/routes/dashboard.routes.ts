import { Router, Response } from 'express';
import { queryOne, execute } from '../db/database.ts';
import { requireAuth, requireRole, requirePermission, AuthRequest } from '../middleware/auth.ts';
import { DashboardKPIs } from '../../types/index.ts';

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
        "SELECT COUNT(*) as count FROM orders WHERE assigned_to = ? AND status IN ('PENDING', 'PROCESSING', 'CONFIRMED')",
        [user.id]
      );
      const readyWorkerOrders = await queryOne<{ count: number }>(
        "SELECT COUNT(*) as count FROM orders WHERE assigned_to = ? AND status = 'READY'",
        [user.id]
      );
      const productsCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM products WHERE is_active = 1');

      return res.json({
        success: true,
        data: {
          total_orders: totalWorkerOrders?.count || 0,
          pending_orders: pendingWorkerOrders?.count || 0,
          total_products: productsCount?.count || 0,
          total_customers: readyWorkerOrders?.count || 0, // In worker view, shows ready/processed
          is_worker_view: true,
        },
      });
    }

    // Admin & Manager global KPIs
    const totalOrdersRes = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM orders');
    const pendingOrdersRes = await queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM orders WHERE status = 'PENDING'"
    );
    const productsRes = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM products WHERE is_active = 1');
    const customersRes = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM customers');

    const kpis: DashboardKPIs = {
      total_orders: totalOrdersRes?.count || 0,
      pending_orders: pendingOrdersRes?.count || 0,
      total_products: productsRes?.count || 0,
      total_customers: customersRes?.count || 0,
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
