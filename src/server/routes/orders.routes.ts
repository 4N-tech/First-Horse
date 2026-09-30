import { Router, Request, Response } from 'express';
import { query, queryOne, execute, transaction } from '../db/database.ts';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { Order, OrderItem, OrderStatus } from '../../types/index.ts';

const router = Router();

const VALID_STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'READY',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

// Get orders list (Role-filtered)
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { status, search } = req.query;

    let sql = `
      SELECT o.*, c.name as customer_name, c.phone as customer_phone, u.name as assigned_worker_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      LEFT JOIN users u ON o.assigned_to = u.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    // WORKER role restriction: only see assigned orders
    if (user.role === 'WORKER') {
      sql += ' AND o.assigned_to = ?';
      params.push(user.id);
    }

    if (status && VALID_STATUSES.includes(status as OrderStatus)) {
      sql += ' AND o.status = ?';
      params.push(String(status));
    }

    if (search) {
      sql += ' AND (o.order_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY o.id DESC';

    const orders = await query<Order>(sql, params);

    // Fetch order items with snapshots
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      const items = await query<OrderItem>(
        `SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`,
        orderIds
      );

      const itemsByOrder = new Map<number, OrderItem[]>();
      for (const item of items) {
        if (!itemsByOrder.has(item.order_id)) {
          itemsByOrder.set(item.order_id, []);
        }
        itemsByOrder.get(item.order_id)!.push(item);
      }

      for (const o of orders) {
        o.items = itemsByOrder.get(o.id) || [];
      }
    }

    return res.json({ success: true, data: orders });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get single order details
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const orderId = Number(req.params.id);

    const order = await queryOne<Order>(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone, u.name as assigned_worker_name
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       LEFT JOIN users u ON o.assigned_to = u.id
       WHERE o.id = ?`,
      [orderId]
    );

    if (!order) {
      return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
    }

    // WORKER authorization check
    if (user.role === 'WORKER' && order.assigned_to !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'غير مصرح لك بالاطلاع على هذا الطلب لأنه غير مسند إليك',
      });
    }

    const items = await query<OrderItem>('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC', [orderId]);
    order.items = items;

    // Fetch primary address
    const address = await queryOne(
      'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY id DESC LIMIT 1',
      [order.customer_id]
    );
    if (address) {
      order.customer_address = `${address.governorate} - ${address.city} - ${address.address}`;
    }

    return res.json({ success: true, data: order });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Update Order Status (Worker can only update assigned orders status; Admin/Manager can update any)
router.patch('/:id/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const orderId = Number(req.params.id);
    const { status } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `حالة الطلب غير صالحة. الحالات المتاحة: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const order = await queryOne<Order>('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
    }

    // Role-based security check
    if (user.role === 'WORKER') {
      if (order.assigned_to !== user.id) {
        return res.status(403).json({
          success: false,
          error: 'غير مصرح: يمكنك فقط تحديث حالة الطلبات المسندة إليك مباشرة',
        });
      }
    }

    await execute(
      "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?",
      [status, orderId]
    );

    const updated = await queryOne<Order>('SELECT * FROM orders WHERE id = ?', [orderId]);
    return res.json({
      success: true,
      data: updated,
      message: `تم تحديث حالة الطلب إلى (${status}) بنجاح`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Assign Order to Worker (ADMIN and MANAGER only)
router.patch('/:id/assign', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.role === 'WORKER') {
      return res.status(403).json({
        success: false,
        error: 'غير مصرح لفني التشغيل بإسناد أو توزيع الطلبات',
      });
    }

    const orderId = Number(req.params.id);
    const { assigned_to } = req.body;

    if (assigned_to !== null && assigned_to !== undefined) {
      const worker = await queryOne('SELECT id, name, role FROM users WHERE id = ? AND is_active = 1', [Number(assigned_to)]);
      if (!worker) {
        return res.status(400).json({ success: false, error: 'الموظف المحدد غير موجود أو غير نشط' });
      }
    }

    await execute(
      "UPDATE orders SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?",
      [assigned_to ? Number(assigned_to) : null, orderId]
    );

    return res.json({ success: true, message: 'تم تحديث الموظف المسؤول عن الطلب بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Create Order with Snapshots (Phase 1 structure verification)
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.role === 'WORKER') {
      return res.status(403).json({ success: false, error: 'غير مصرح لعمال التشغيل بإنشاء طلبات جديدة' });
    }

    const { customer_id, items, delivery_fee = 50, customer_notes, assigned_to } = req.body;

    if (!customer_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'العميل وبنود الطلب مطلوبة' });
    }

    const newOrder = await transaction(async () => {
      const orderNumber = `ORD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      let subtotal = 0;
      for (const item of items) {
        subtotal += Number(item.unit_price) * Number(item.quantity);
      }
      const total = subtotal + Number(delivery_fee);

      const orderResult = await execute(
        `INSERT INTO orders (order_number, customer_id, status, subtotal, delivery_fee, total, customer_notes, assigned_to)
         VALUES (?, ?, 'PENDING', ?, ?, ?, ?, ?)`,
        [
          orderNumber,
          Number(customer_id),
          subtotal,
          Number(delivery_fee),
          total,
          customer_notes || null,
          assigned_to ? Number(assigned_to) : null,
        ]
      );

      const orderId = orderResult.lastInsertRowid;

      for (const item of items) {
        await execute(
          `INSERT INTO order_items (order_id, product_id, variant_id, product_name_snapshot, variant_snapshot, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            Number(item.product_id),
            item.variant_id ? Number(item.variant_id) : null,
            item.product_name_snapshot,
            item.variant_snapshot,
            Number(item.quantity),
            Number(item.unit_price),
            Number(item.unit_price) * Number(item.quantity),
          ]
        );
      }

      return await queryOne<Order>('SELECT * FROM orders WHERE id = ?', [orderId]);
    });

    return res.status(201).json({ success: true, data: newOrder, message: 'تم إنشاء الطلب وحفظ النسخ التاريخية للبنود بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
