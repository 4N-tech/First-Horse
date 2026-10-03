import { Router } from 'express';
import type { Request, Response } from 'express';
import { query, queryOne, execute, transaction } from '../db/database.ts';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { Order, OrderItem, OrderStatus } from '../../types/index.ts';
import { recordInventoryMovement } from './inventory.routes.ts';

const router = Router();

// Idempotency cache to prevent duplicate accidental submissions
const processedIdempotencyKeys = new Map<string, { orderNumber: string; orderId: number; timestamp: number }>();

// Clear older keys every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of processedIdempotencyKeys.entries()) {
    if (now - val.timestamp > 10 * 60 * 1000) {
      processedIdempotencyKeys.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Egyptian Mobile Validation and Normalization
export function normalizeEgyptianPhone(input: string): { isValid: boolean; normalized: string; error?: string } {
  if (!input || typeof input !== 'string') {
    return { isValid: false, normalized: '', error: 'رقم الهاتف مطلوب' };
  }

  // Remove spaces, hyphens, parentheses, plus signs
  let cleaned = input.replace(/[\s\-\(\)\+]/g, '');

  // Handle leading double zeros e.g. 00201...
  if (cleaned.startsWith('002')) {
    cleaned = cleaned.slice(2);
  }

  // If starts with 010, 011, 012, 015 (11 digits): replace leading 0 with 20
  if (/^01[0125]\d{8}$/.test(cleaned)) {
    cleaned = '2' + cleaned;
  }

  // Check if matches 201[0125]xxxxxxxx (12 digits)
  if (/^201[0125]\d{8}$/.test(cleaned)) {
    return { isValid: true, normalized: cleaned };
  }

  return {
    isValid: false,
    normalized: '',
    error: 'رقم الهاتف غير صالح. يرجى إدخال رقم محمول مصري صحيح (مثال: 01012345678 أو 011 أو 012 أو 015)',
  };
}

const VALID_STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'READY',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

// Allowed normal workflow state machine
export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY', 'CANCELLED'],
  READY: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

// Allowed operational transitions for WORKER
export const WORKER_ALLOWED_TRANSITIONS: Record<string, OrderStatus[]> = {
  CONFIRMED: ['PROCESSING'],
  PROCESSING: ['READY'],
};

// Get orders list (Role-filtered & Advanced Filters)
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { status, assigned_to, date_range, date_from, date_to, search } = req.query;

    let sql = `
      SELECT o.*, 
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
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    // WORKER role restriction: strictly only see assigned orders
    if (user.role === 'WORKER') {
      sql += ' AND o.assigned_to = ?';
      params.push(user.id);
    } else {
      // ADMIN & MANAGER filters
      if (assigned_to === 'unassigned') {
        sql += ' AND o.assigned_to IS NULL';
      } else if (assigned_to && !isNaN(Number(assigned_to))) {
        sql += ' AND o.assigned_to = ?';
        params.push(Number(assigned_to));
      }
    }

    if (status && VALID_STATUSES.includes(status as OrderStatus)) {
      sql += ' AND o.status = ?';
      params.push(String(status));
    }

    // Date range filtering
    if (date_range === 'today') {
      sql += " AND date(o.created_at) = date('now')";
    } else if (date_range === 'yesterday') {
      sql += " AND date(o.created_at) = date('now', '-1 day')";
    } else if (date_range === '7days') {
      sql += " AND date(o.created_at) >= date('now', '-7 days')";
    } else if (date_range === 'this_month') {
      sql += " AND strftime('%Y-%m', o.created_at) = strftime('%Y-%m', 'now')";
    } else if (date_range === 'custom') {
      if (date_from) {
        sql += ' AND date(o.created_at) >= date(?)';
        params.push(String(date_from));
      }
      if (date_to) {
        sql += ' AND date(o.created_at) <= date(?)';
        params.push(String(date_to));
      }
    }

    // Search by order number, customer name, or phone
    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      sql += ' AND (o.order_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
      params.push(term, term, term);
    }

    sql += ' ORDER BY o.id DESC';

    const orders = await query<Order>(sql, params);

    // Fetch order items with snapshots
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      const items = await query<OrderItem>(
        `SELECT oi.*, p.image_url 
         FROM order_items oi 
         LEFT JOIN products p ON oi.product_id = p.id 
         WHERE oi.order_id IN (${placeholders}) 
         ORDER BY oi.id ASC`,
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

// Helper to load complete order with snapshot items, address, and histories
async function loadFullOrderDetails(orderId: number, user: AuthRequest['user']): Promise<{ success: boolean; data?: Order; error?: string; status?: number }> {
  const order = await queryOne<Order>(
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
     WHERE o.id = ?`,
    [orderId]
  );

  if (!order) {
    return { success: false, error: 'الطلب غير موجود', status: 404 };
  }

  // WORKER authorization check: only see assigned orders
  if (user?.role === 'WORKER' && order.assigned_to !== user.id) {
    return {
      success: false,
      error: 'غير مصرح لك بالاطلاع على هذا الطلب لأنه غير مسند إليك',
      status: 403,
    };
  }

  // Fetch items with images
  const items = await query<OrderItem>(
    `SELECT oi.*, p.image_url 
     FROM order_items oi 
     LEFT JOIN products p ON oi.product_id = p.id 
     WHERE oi.order_id = ? 
     ORDER BY oi.id ASC`,
    [orderId]
  );
  order.items = items;

  // Fetch full address details
  const address = await queryOne(
    'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY id DESC LIMIT 1',
    [order.customer_id]
  );
  if (address) {
    order.governorate = address.governorate;
    order.city = address.city;
    order.address = address.address;
    order.customer_address = `${address.governorate} - ${address.city} - ${address.address}`;
  }

  // Fetch status history timeline
  const statusHistory = await query<any>(
    `SELECT osh.*, u.name as changed_by_name, u.role as changed_by_role
     FROM order_status_history osh
     LEFT JOIN users u ON osh.changed_by = u.id
     WHERE osh.order_id = ?
     ORDER BY osh.id DESC`,
    [orderId]
  );
  order.status_history = statusHistory;

  // Fetch assignment history timeline
  const assignmentHistory = await query<any>(
    `SELECT oah.*, 
            u1.name as previous_employee_name, 
            u2.name as new_employee_name, 
            u3.name as assigned_by_name
     FROM order_assignment_history oah
     LEFT JOIN users u1 ON oah.previous_employee_id = u1.id
     LEFT JOIN users u2 ON oah.new_employee_id = u2.id
     LEFT JOIN users u3 ON oah.assigned_by = u3.id
     WHERE oah.order_id = ?
     ORDER BY oah.id DESC`,
    [orderId]
  );
  order.assignment_history = assignmentHistory;

  return { success: true, data: order };
}

// Get single order details by ID
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const orderId = Number(req.params.id);
    if (isNaN(orderId)) {
      return res.status(400).json({ success: false, error: 'معرف الطلب غير صحيح' });
    }

    const result = await loadFullOrderDetails(orderId, req.user);
    if (!result.success) {
      return res.status(result.status || 500).json({ success: false, error: result.error });
    }

    return res.json({ success: true, data: result.data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get single order details by human-friendly Order Number (e.g. /admin/orders/:orderNumber)
router.get('/by-number/:orderNumber', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const orderNumber = req.params.orderNumber.trim();
    const orderRow = await queryOne<{ id: number }>('SELECT id FROM orders WHERE order_number = ?', [orderNumber]);
    if (!orderRow) {
      return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
    }

    const result = await loadFullOrderDetails(orderRow.id, req.user);
    if (!result.success) {
      return res.status(result.status || 500).json({ success: false, error: result.error });
    }

    return res.json({ success: true, data: result.data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Update Order Status with Workflow, History, and Role Permissions
router.patch('/:id/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const orderId = Number(req.params.id);
    const { status, note, is_override } = req.body;

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

    const currentStatus = order.status;
    if (currentStatus === status) {
      return res.json({ success: true, data: order, message: 'الطلب بالفعل في هذه الحالة' });
    }

    let isOverrideRecord = 0;

    // WORKER Role Enforcement (Requirement 15, 16)
    if (user.role === 'WORKER') {
      if (order.assigned_to !== user.id) {
        return res.status(403).json({
          success: false,
          error: 'غير مصرح: يمكنك فقط تحديث حالة الطلبات المسندة إليك مباشرة',
        });
      }

      const workerAllowed = WORKER_ALLOWED_TRANSITIONS[currentStatus] || [];
      if (!workerAllowed.includes(status as OrderStatus)) {
        return res.status(403).json({
          success: false,
          error: `غير مصرح لفني التشغيل بهذا الإجراء. يُسمح لك فقط بـ (بدء التجهيز: CONFIRMED ← PROCESSING) أو (تأكيد الجاهزية: PROCESSING ← READY). لا يمكنك إلغاء الطلبات أو تسليمها.`,
        });
      }
    }

    // MANAGER Role Enforcement (Requirement 5)
    if (user.role === 'MANAGER') {
      const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(status as OrderStatus)) {
        return res.status(400).json({
          success: false,
          error: `الانتقال من حالة (${currentStatus}) إلى (${status}) غير مسموح في دورة العمل الطبيعية. يتطلب تدخلاً وتجاوزاً إدارياً من المدير العام (Admin Override).`,
        });
      }
    }

    // ADMIN Role Handling (Requirement 5: Controlled Override allowed)
    if (user.role === 'ADMIN') {
      const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(status as OrderStatus)) {
        isOverrideRecord = 1; // Explicit Admin Override recorded in history
      }
      if (is_override) {
        isOverrideRecord = 1;
      }
    }

    // Execute atomic status change with history record
    await transaction(async () => {
      await execute(
        "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?",
        [status, orderId]
      );

      // Record in order_status_history
      await execute(
        `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, note, is_override)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, currentStatus, status, user.id, note ? String(note).trim() : null, isOverrideRecord]
      );

      // Record in activity_logs
      await execute(
        `INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, metadata)
         VALUES (?, 'ORDER_STATUS_CHANGED', 'ORDER', ?, ?)`,
        [
          user.id,
          orderId,
          JSON.stringify({
            order_number: order.order_number,
            old_status: currentStatus,
            new_status: status,
            is_override: !!isOverrideRecord,
            note: note || null,
          }),
        ]
      );

      // Phase 5 Cancellation & Release Safety (Requirements 8 & 9):
      // When an order is CANCELLED, release its stock back to inventory exactly once
      if (status === 'CANCELLED' && currentStatus !== 'CANCELLED') {
        const existingRelease = await queryOne<{ id: number }>(
          "SELECT id FROM inventory_movements WHERE reference_type = 'ORDER' AND reference_id = ? AND movement_type = 'ORDER_RELEASE' LIMIT 1",
          [orderId]
        );

        if (!existingRelease) {
          const orderItems = await query<{ variant_id: number; quantity: number }>(
            'SELECT variant_id, quantity FROM order_items WHERE order_id = ? AND variant_id IS NOT NULL',
            [orderId]
          );

          for (const it of orderItems) {
            if (it.variant_id) {
              await recordInventoryMovement({
                variant_id: it.variant_id,
                movement_type: 'ORDER_RELEASE',
                quantity_delta: it.quantity,
                reference_type: 'ORDER',
                reference_id: orderId,
                note: note ? `إلغاء الطلب: ${note}` : `إلغاء الطلب #${order.order_number} واسترجاع المخزون`,
                created_by: user.id,
              });
            }
          }
        }
      }

      // If an order was previously CANCELLED and an ADMIN overrides back to active status, re-deduct
      if (currentStatus === 'CANCELLED' && status !== 'CANCELLED') {
        const existingRelease = await queryOne<{ id: number }>(
          "SELECT id FROM inventory_movements WHERE reference_type = 'ORDER' AND reference_id = ? AND movement_type = 'ORDER_RELEASE' LIMIT 1",
          [orderId]
        );

        if (existingRelease) {
          const orderItems = await query<{ variant_id: number; quantity: number }>(
            'SELECT variant_id, quantity FROM order_items WHERE order_id = ? AND variant_id IS NOT NULL',
            [orderId]
          );

          for (const it of orderItems) {
            if (it.variant_id) {
              await recordInventoryMovement({
                variant_id: it.variant_id,
                movement_type: 'ORDER_DEDUCTION',
                quantity_delta: -it.quantity,
                reference_type: 'ORDER',
                reference_id: orderId,
                note: `إعادة تنشيط الطلب #${order.order_number} بعد الإلغاء`,
                created_by: user.id,
              });
            }
          }
        }
      }

      // Notification placeholder for assigned worker if changed by admin/manager
      if (order.assigned_to && order.assigned_to !== user.id) {
        await execute(
          `INSERT INTO internal_notifications (user_id, title, message, type, entity_type, entity_id)
           VALUES (?, 'تحديث حالة الطلب', ?, 'INFO', 'ORDER', ?)`,
          [
            order.assigned_to,
            `تم تحديث حالة الطلب #${order.order_number} من (${currentStatus}) إلى (${status}) بواسطة ${user.name}.`,
            orderId,
          ]
        );
      }
    });

    const updatedResult = await loadFullOrderDetails(orderId, user);
    return res.json({
      success: true,
      data: updatedResult.data,
      message: `تم تحديث حالة الطلب إلى (${status}) بنجاح وتسجيلها في السجل الزمني`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Assign/Reassign Order to Worker (ADMIN and MANAGER only)
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
    const { assigned_to, note } = req.body;

    const order = await queryOne<Order>('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
    }

    let targetWorker: { id: number; name: string; role: string; is_active: number } | null = null;

    if (assigned_to !== null && assigned_to !== undefined && assigned_to !== '') {
      targetWorker = await queryOne(
        'SELECT id, name, role, is_active FROM users WHERE id = ?',
        [Number(assigned_to)]
      );

      if (!targetWorker) {
        return res.status(400).json({ success: false, error: 'الموظف المحدد غير موجود' });
      }

      // Requirement 17: Inactive workers cannot receive assignments
      if (targetWorker.is_active !== 1) {
        return res.status(400).json({
          success: false,
          error: 'لا يمكن إسناد الطلب إلى موظف معطل أو غير نشط في النظام.',
        });
      }

      if (targetWorker.role !== 'WORKER') {
        return res.status(400).json({
          success: false,
          error: 'يمكن إسناد الطلبات فقط لفنيي التشغيل والعمال (Workers).',
        });
      }
    }

    const previousWorkerId = order.assigned_to;
    const newWorkerId = targetWorker ? targetWorker.id : null;

    await transaction(async () => {
      await execute(
        "UPDATE orders SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?",
        [newWorkerId, orderId]
      );

      // Record in order_assignment_history
      await execute(
        `INSERT INTO order_assignment_history (order_id, previous_employee_id, new_employee_id, assigned_by, note)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, previousWorkerId ?? null, newWorkerId, user.id, note ? String(note).trim() : null]
      );

      // Record in activity_logs
      await execute(
        `INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, metadata)
         VALUES (?, 'ORDER_ASSIGNED', 'ORDER', ?, ?)`,
        [
          user.id,
          orderId,
          JSON.stringify({
            order_number: order.order_number,
            previous_worker_id: previousWorkerId,
            new_worker_id: newWorkerId,
            worker_name: targetWorker?.name || 'إلغاء الإسناد',
            note: note || null,
          }),
        ]
      );

      // Notification placeholder for new worker
      if (newWorkerId) {
        await execute(
          `INSERT INTO internal_notifications (user_id, title, message, type, entity_type, entity_id)
           VALUES (?, 'إسناد طلب جديد', ?, 'INFO', 'ORDER', ?)`,
          [
            newWorkerId,
            `تم إسناد الطلب #${order.order_number} إليك للمتابعة والتجهيز بواسطة ${user.name}.`,
            orderId,
          ]
        );
      }
    });

    const updatedResult = await loadFullOrderDetails(orderId, user);
    return res.json({
      success: true,
      data: updatedResult.data,
      message: targetWorker
        ? `تم إسناد الطلب إلى (${targetWorker.name}) وتسجيل العملية في سجل التوزيع التاريخي`
        : 'تم إلغاء إسناد الطلب بنجاح',
    });
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

        if (item.variant_id) {
          await recordInventoryMovement({
            variant_id: Number(item.variant_id),
            movement_type: 'ORDER_DEDUCTION',
            quantity_delta: -Number(item.quantity),
            reference_type: 'ORDER',
            reference_id: orderId,
            note: `إنشاء طلب إداري #${orderNumber}`,
            created_by: user.id,
          });
        }
      }

      return await queryOne<Order>('SELECT * FROM orders WHERE id = ?', [orderId]);
    });

    return res.status(201).json({ success: true, data: newOrder, message: 'تم إنشاء الطلب وحفظ النسخ التاريخية للبنود بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// PHASE 3: Public Customer Checkout & Order Creation
// ==========================================

// Public: Validate cart items against live database data
router.post('/validate-cart', async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'قائمة بنود السلة غير صالحة' });
    }

    const validatedItems: any[] = [];
    let isEntireCartValid = true;

    for (const item of items) {
      const prodId = Number(item.product_id);
      const varId = Number(item.variant_id);
      const reqQty = Math.max(1, Number(item.quantity) || 1);

      const prod = await queryOne<any>(
        'SELECT id, name, slug, image_url, base_price, is_active FROM products WHERE id = ?',
        [prodId]
      );
      const variant = await queryOne<any>(
        'SELECT id, sku, size, color, price, stock_quantity, is_active FROM product_variants WHERE id = ? AND product_id = ?',
        [varId, prodId]
      );

      if (!prod || prod.is_active !== 1 || !variant || variant.is_active !== 1) {
        isEntireCartValid = false;
        validatedItems.push({
          product_id: prodId,
          variant_id: varId,
          product_name: prod ? prod.name : 'منتج غير معروف',
          is_available: false,
          error_message: 'هذا المنتج لم يعد متاحًا.',
        });
        continue;
      }

      const authoritativePrice =
        variant.price !== undefined && variant.price !== null && Number(variant.price) > 0
          ? Number(variant.price)
          : Number(prod.base_price);

      const isStockSufficient = variant.stock_quantity >= reqQty;
      if (!isStockSufficient) {
        isEntireCartValid = false;
      }

      validatedItems.push({
        product_id: prod.id,
        variant_id: variant.id,
        product_name: prod.name,
        product_slug: prod.slug,
        image_url: prod.image_url,
        color: variant.color,
        size: variant.size,
        sku: variant.sku,
        unit_price: authoritativePrice,
        stock_quantity: variant.stock_quantity,
        requested_quantity: reqQty,
        is_available: true,
        is_stock_sufficient: isStockSufficient,
        error_message: !isStockSufficient
          ? `الكمية المطلوبة (${reqQty}) غير متاحة حالياً. المتوفر: ${variant.stock_quantity}`
          : undefined,
      });
    }

    return res.json({
      success: true,
      is_valid: isEntireCartValid,
      items: validatedItems,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Public: Submit Customer Checkout & Create Order (Strict Security & Atomicity)
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const { customer, address, items, customer_notes, idempotency_key } = req.body;

    // 1. Idempotency Check: prevent duplicate accidental double-clicks
    if (idempotency_key && typeof idempotency_key === 'string' && processedIdempotencyKeys.has(idempotency_key)) {
      const cached = processedIdempotencyKeys.get(idempotency_key)!;
      return res.status(200).json({
        success: true,
        order_number: cached.orderNumber,
        order_id: cached.orderId,
        is_duplicate_prevented: true,
        message: 'تم استقبال طلبك بالفعل.',
      });
    }

    // 2. Validate customer information
    if (!customer || !customer.name || !customer.name.trim()) {
      return res.status(400).json({ success: false, error: 'الاسم الكامل للعميل مطلوب' });
    }
    if (customer.name.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال الاسم بالكامل (3 أحرف على الأقل)' });
    }

    // 3. Egyptian Mobile Validation & Normalization
    const phoneCheck = normalizeEgyptianPhone(customer.phone);
    if (!phoneCheck.isValid) {
      return res.status(400).json({ success: false, error: phoneCheck.error });
    }
    const normalizedPhone = phoneCheck.normalized;

    // 4. Validate Address
    if (!address || !address.governorate || !address.governorate.trim()) {
      return res.status(400).json({ success: false, error: 'المحافظة مطلوبة' });
    }
    if (!address.city || !address.city.trim()) {
      return res.status(400).json({ success: false, error: 'المدينة أو المركز مطلوب' });
    }
    if (!address.address || !address.address.trim()) {
      return res.status(400).json({
        success: false,
        error: 'العنوان بالتفصيل مطلوب (الشارع، رقم العقار، أو علامة مميزة)',
      });
    }

    // 5. Validate Cart Items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'السلة فارغة. يرجى إضافة منتجات صالحة أولاً.' });
    }

    // 6. Execute atomic transaction (Security, Stock Check, Authoritative calculation)
    const createdOrder = await transaction(async () => {
      let calculatedSubtotal = 0;
      const validatedItems: {
        product_id: number;
        variant_id: number;
        product_name: string;
        variant_snapshot: string;
        quantity: number;
        unit_price: number;
        total_price: number;
      }[] = [];

      for (const item of items) {
        const prodId = Number(item.product_id);
        const varId = Number(item.variant_id);
        const qty = Number(item.quantity);

        if (!prodId || !varId || !qty || isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
          throw new Error('بيانات بنود السلة غير صالحة');
        }

        // Fetch product authoritative data
        const prod = await queryOne<{ id: number; name: string; base_price: number; is_active: number }>(
          'SELECT id, name, base_price, is_active FROM products WHERE id = ?',
          [prodId]
        );
        if (!prod || prod.is_active !== 1) {
          throw new Error(`المنتج (${prod?.name || prodId}) لم يعد متاحًا.`);
        }

        // Fetch variant authoritative data
        const variant = await queryOne<{
          id: number;
          product_id: number;
          sku: string;
          size: string;
          color: string;
          price: number;
          stock_quantity: number;
          is_active: number;
        }>(
          'SELECT id, product_id, sku, size, color, price, stock_quantity, is_active FROM product_variants WHERE id = ? AND product_id = ?',
          [varId, prodId]
        );

        if (!variant || variant.is_active !== 1) {
          throw new Error(`المقاس أو اللون المطلوب للمنتج (${prod.name}) لم يعد متاحًا.`);
        }

        // Check stock availability
        if (variant.stock_quantity < qty) {
          throw new Error(
            `الكمية المطلوبة لم تعد متاحة من (${prod.name} - ${variant.color} / ${variant.size}). المتوفر بالمخزن: ${variant.stock_quantity} فقط. برجاء تحديث السلة.`
          );
        }

        // Authoritative Price Calculation (NEVER trust client price)
        const authoritativeUnitPrice =
          variant.price !== undefined && variant.price !== null && Number(variant.price) > 0
            ? Number(variant.price)
            : Number(prod.base_price);

        const itemTotal = authoritativeUnitPrice * qty;
        calculatedSubtotal += itemTotal;

        validatedItems.push({
          product_id: prod.id,
          variant_id: variant.id,
          product_name: prod.name,
          variant_snapshot: `${variant.color} / ${variant.size} (SKU: ${variant.sku})`,
          quantity: qty,
          unit_price: authoritativeUnitPrice,
          total_price: itemTotal,
        });
      }

      // Delivery fee is 0 for this phase (ready for future delivery fee calculation)
      const deliveryFee = 0;
      const finalTotal = calculatedSubtotal + deliveryFee;

      // 7. Customer Record (search by normalized phone to reuse existing customer)
      let customerId: number;
      const existingCustomer = await queryOne<{ id: number; name: string }>(
        'SELECT id, name FROM customers WHERE phone = ?',
        [normalizedPhone]
      );

      if (existingCustomer) {
        customerId = existingCustomer.id;
        if (customer.name.trim() && existingCustomer.name !== customer.name.trim()) {
          await execute("UPDATE customers SET name = ?, updated_at = datetime('now') WHERE id = ?", [
            customer.name.trim(),
            customerId,
          ]);
        }
      } else {
        const newCustRes = await execute(
          'INSERT INTO customers (name, phone) VALUES (?, ?)',
          [customer.name.trim(), normalizedPhone]
        );
        customerId = newCustRes.lastInsertRowid;
      }

      // 8. Save Customer Address
      const cleanAddress = address.address.trim();
      const cleanCity = address.city.trim();
      const cleanGov = address.governorate.trim();
      const addressNotes = address.notes ? address.notes.trim() : null;

      await execute(
        `INSERT INTO customer_addresses (customer_id, governorate, city, address, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [customerId, cleanGov, cleanCity, cleanAddress, addressNotes]
      );

      // 9. Generate Human-Friendly Unique Order Number (e.g. ORD-100001)
      const countRes = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM orders');
      const maxIdRes = await queryOne<{ max_id: number }>('SELECT MAX(id) as max_id FROM orders');
      const baseNum = 100000 + Math.max(countRes?.count || 0, maxIdRes?.max_id || 0) + 1;
      const orderNumber = `ORD-${baseNum}`;

      // 10. Insert Order with initial status PENDING
      const orderRes = await execute(
        `INSERT INTO orders (order_number, customer_id, status, subtotal, delivery_fee, total, customer_notes)
         VALUES (?, ?, 'PENDING', ?, ?, ?, ?)`,
        [
          orderNumber,
          customerId,
          calculatedSubtotal,
          deliveryFee,
          finalTotal,
          customer_notes ? customer_notes.trim() : null,
        ]
      );
      const orderId = orderRes.lastInsertRowid;

      // 11. Insert Order Items Snapshots & Atomically Reserve/Decrease Stock
      for (const item of validatedItems) {
        await execute(
          `INSERT INTO order_items (order_id, product_id, variant_id, product_name_snapshot, variant_snapshot, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            item.product_id,
            item.variant_id,
            item.product_name,
            item.variant_snapshot,
            item.quantity,
            item.unit_price,
            item.total_price,
          ]
        );

        // Atomic stock decrement with immutable inventory movement ledger record
        await recordInventoryMovement({
          variant_id: item.variant_id,
          movement_type: 'ORDER_DEDUCTION',
          quantity_delta: -item.quantity,
          reference_type: 'ORDER',
          reference_id: orderId,
          note: `طلب عميل #${orderNumber}`,
          created_by: null,
        });
      }

      return {
        orderId,
        orderNumber,
        subtotal: calculatedSubtotal,
        deliveryFee,
        total: finalTotal,
        itemsCount: validatedItems.reduce((acc, i) => acc + i.quantity, 0),
        customerName: customer.name.trim(),
        customerPhone: normalizedPhone,
      };
    });

    if (idempotency_key && typeof idempotency_key === 'string') {
      processedIdempotencyKeys.set(idempotency_key, {
        orderNumber: createdOrder.orderNumber,
        orderId: createdOrder.orderId,
        timestamp: Date.now(),
      });
    }

    return res.status(201).json({
      success: true,
      data: createdOrder,
      message: 'تم إرسال طلبك بنجاح.',
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message || 'فشل في إنشاء الطلب' });
  }
});

// Public: Get Order Details by Order Number (Safe public view)
router.get('/public/:orderNumber', async (req: Request, res: Response) => {
  try {
    const orderNumber = req.params.orderNumber.trim();
    const order = await queryOne<any>(
      `SELECT o.id, o.order_number, o.status, o.subtotal, o.delivery_fee, o.total, o.customer_notes, o.created_at,
              c.name as customer_name, c.phone as customer_phone
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE o.order_number = ?`,
      [orderNumber]
    );

    if (!order) {
      return res.status(404).json({ success: false, error: 'الطلب غير موجود. تأكد من صحة رقم الطلب.' });
    }

    // Customer Address
    const address = await queryOne<any>(
      'SELECT governorate, city, address, notes FROM customer_addresses WHERE customer_id = (SELECT customer_id FROM orders WHERE id = ?) ORDER BY id DESC LIMIT 1',
      [order.id]
    );

    // Items with snapshots
    const items = await query<any>(
      `SELECT id, product_id, variant_id, product_name_snapshot, variant_snapshot, quantity, unit_price, total_price 
       FROM order_items 
       WHERE order_id = ? 
       ORDER BY id ASC`,
      [order.id]
    );

    return res.json({
      success: true,
      data: {
        order_number: order.order_number,
        status: order.status,
        subtotal: order.subtotal,
        delivery_fee: order.delivery_fee,
        total: order.total,
        customer_notes: order.customer_notes,
        created_at: order.created_at,
        customer: {
          name: order.customer_name,
          phone: order.customer_phone,
        },
        address: address
          ? {
              governorate: address.governorate,
              city: address.city,
              address: address.address,
              notes: address.notes,
            }
          : null,
        items,
        total_items_count: items.reduce((acc: number, i: any) => acc + i.quantity, 0),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Public: Customer Order Lookup Preparation (order_number + phone)
router.post('/lookup', async (req: Request, res: Response) => {
  try {
    const { order_number, phone } = req.body;
    if (!order_number || !phone) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال رقم الطلب ورقم الهاتف المسجل' });
    }

    const phoneCheck = normalizeEgyptianPhone(phone);
    if (!phoneCheck.isValid) {
      return res.status(400).json({ success: false, error: phoneCheck.error });
    }

    const cleanOrderNumber = order_number.trim().toUpperCase();

    const order = await queryOne<any>(
      `SELECT o.id, o.order_number, o.status, o.subtotal, o.delivery_fee, o.total, o.created_at,
              c.name as customer_name, c.phone as customer_phone
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE UPPER(o.order_number) = ? AND c.phone = ?`,
      [cleanOrderNumber, phoneCheck.normalized]
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'لم يتم العثور على طلب مطابق لرقم الطلب ورقم الهاتف المدخلين.',
      });
    }

    const items = await query<any>(
      'SELECT product_name_snapshot, variant_snapshot, quantity, unit_price, total_price FROM order_items WHERE order_id = ? ORDER BY id ASC',
      [order.id]
    );

    return res.json({
      success: true,
      data: {
        order_number: order.order_number,
        status: order.status,
        created_at: order.created_at,
        customer_name: order.customer_name,
        total: order.total,
        items,
        items_count: items.reduce((acc: number, i: any) => acc + i.quantity, 0),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Phase 4: Worker Workspace & Audit Endpoints
// ==========================================

// Worker Workspace Data (Requirement 14, 20)
router.get('/worker/workspace', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== 'WORKER' && user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'هذه المساحة مخصصة لفنيي التشغيل والعمال' });
    }

    const workerId = user.id;

    // Worker KPIs based strictly on orders assigned to this worker
    const totalAssigned = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM orders WHERE assigned_to = ?',
      [workerId]
    );

    const newOrders = await queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM orders WHERE assigned_to = ? AND status IN ('PENDING', 'CONFIRMED')",
      [workerId]
    );

    const inProgress = await queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM orders WHERE assigned_to = ? AND status = 'PROCESSING'",
      [workerId]
    );

    const ready = await queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM orders WHERE assigned_to = ? AND status = 'READY'",
      [workerId]
    );

    const completed = await queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM orders WHERE assigned_to = ? AND status IN ('SHIPPED', 'DELIVERED')",
      [workerId]
    );

    // List of assigned orders
    const orders = await query<Order>(
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
       WHERE o.assigned_to = ?
       ORDER BY CASE 
         WHEN o.status = 'CONFIRMED' THEN 1
         WHEN o.status = 'PROCESSING' THEN 2
         WHEN o.status = 'READY' THEN 3
         ELSE 4
       END, o.id DESC`,
      [workerId]
    );

    // Attach items
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      const items = await query<OrderItem>(
        `SELECT oi.*, p.image_url 
         FROM order_items oi 
         LEFT JOIN products p ON oi.product_id = p.id 
         WHERE oi.order_id IN (${placeholders}) 
         ORDER BY oi.id ASC`,
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

    return res.json({
      success: true,
      data: {
        kpis: {
          total_assigned: totalAssigned?.count || 0,
          new_orders: newOrders?.count || 0,
          in_progress: inProgress?.count || 0,
          ready: ready?.count || 0,
          completed: completed?.count || 0,
        },
        orders,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Activity Logs (Requirement 22)
router.get('/audit/activity-logs', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return res.status(403).json({ success: false, error: 'غير مصرح بالاطلاع على سجل التدقيق والأنشطة' });
    }

    const logs = await query<any>(
      `SELECT al.*, u.name as actor_name, u.role as actor_role
       FROM activity_logs al
       LEFT JOIN users u ON al.actor_id = u.id
       ORDER BY al.id DESC
       LIMIT 50`
    );

    return res.json({ success: true, data: logs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Internal Notifications (Requirement 21)
router.get('/user/notifications', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const notifs = await query<any>(
      'SELECT * FROM internal_notifications WHERE user_id = ? ORDER BY id DESC LIMIT 20',
      [user.id]
    );

    const unreadCount = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM internal_notifications WHERE user_id = ? AND is_read = 0',
      [user.id]
    );

    return res.json({
      success: true,
      data: notifs,
      unread_count: unreadCount?.count || 0,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/user/notifications/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const notifId = Number(req.params.id);

    await execute(
      'UPDATE internal_notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [notifId, user.id]
    );

    return res.json({ success: true, message: 'تم تحديد الإشعار كمقروء' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/user/notifications/mark-all-read', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    await execute('UPDATE internal_notifications SET is_read = 1 WHERE user_id = ?', [user.id]);
    return res.json({ success: true, message: 'تم تحديد جميع الإشعارات كمقروءة' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
