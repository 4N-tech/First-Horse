import { Router } from 'express';
import type { Response } from 'express';
import { query, queryOne, execute, transaction } from '../db/database.ts';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.ts';
import type {
  InventoryMovement,
  InventoryMovementType,
  InventoryItem,
  InventorySummary,
  StockStatus,
} from '../../types/index.ts';

const router = Router();

export interface RecordMovementParams {
  variant_id: number;
  movement_type: InventoryMovementType;
  quantity_delta: number;
  reference_type?: string | null;
  reference_id?: number | string | null;
  note?: string | null;
  created_by?: number | null;
}

/**
 * Server-authoritative atomic inventory movement recorder.
 * Checks current stock, prevents negative stock, records immutable movement entry.
 * Must be executed within a database transaction when part of a larger operation.
 */
export async function recordInventoryMovement(params: RecordMovementParams): Promise<{
  stock_before: number;
  stock_after: number;
  movement_id: number;
}> {
  const {
    variant_id,
    movement_type,
    quantity_delta,
    reference_type = null,
    reference_id = null,
    note = null,
    created_by = null,
  } = params;

  // 1. Fetch current authoritative stock
  const variant = await queryOne<{ id: number; stock_quantity: number; sku: string }>(
    'SELECT id, stock_quantity, sku FROM product_variants WHERE id = ?',
    [variant_id]
  );

  if (!variant) {
    throw new Error(`متغير المنتج (ID: ${variant_id}) غير موجود في النظام`);
  }

  const stock_before = variant.stock_quantity;
  const stock_after = stock_before + quantity_delta;

  // 2. Strict negative stock protection
  if (stock_after < 0) {
    throw new Error(
      `رصيد المخزون غير كافٍ للرمز (${variant.sku}). المتوفر حالياً: ${stock_before}، والكمية المطلوبة: ${Math.abs(quantity_delta)}`
    );
  }

  // 3. Atomically update variant stock
  const updateRes = await execute(
    "UPDATE product_variants SET stock_quantity = ?, updated_at = datetime('now') WHERE id = ?",
    [stock_after, variant_id]
  );

  if (updateRes.changes === 0) {
    throw new Error(`فشل تحديث رصيد المخزون لمتغير المنتج (ID: ${variant_id})`);
  }

  // 4. Insert immutable inventory movement record
  const moveRes = await execute(
    `INSERT INTO inventory_movements (
      variant_id, movement_type, quantity_delta, stock_before, stock_after,
      reference_type, reference_id, note, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      variant_id,
      movement_type,
      quantity_delta,
      stock_before,
      stock_after,
      reference_type,
      reference_id ? Number(reference_id) : null,
      note ? note.trim() : null,
      created_by,
    ]
  );

  return {
    stock_before,
    stock_after,
    movement_id: moveRes.lastInsertRowid,
  };
}

// ==========================================
// 1. GET /api/inventory/summary (KPI Cards)
// ==========================================
router.get('/summary', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (_req: AuthRequest, res: Response) => {
  try {
    const summary = await queryOne<InventorySummary>(`
      SELECT 
        COUNT(*) as total_variants,
        COALESCE(SUM(stock_quantity), 0) as total_units,
        COALESCE(SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END), 0) as out_of_stock_count,
        COALESCE(SUM(CASE WHEN stock_quantity > 0 AND stock_quantity <= COALESCE(low_stock_threshold, 10) THEN 1 ELSE 0 END), 0) as low_stock_count
      FROM product_variants
    `);

    return res.json({
      success: true,
      data: summary || {
        total_variants: 0,
        out_of_stock_count: 0,
        low_stock_count: 0,
        total_units: 0,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'فشل تحميل إحصائيات المخزون' });
  }
});

// ==========================================
// 2. GET /api/inventory (Paginated List & Filters)
// ==========================================
router.get('/', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const {
      category_id,
      product_id,
      size,
      color,
      stock_status,
      is_active,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let baseSql = `
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (category_id && !isNaN(Number(category_id))) {
      baseSql += ' AND c.id = ?';
      params.push(Number(category_id));
    }

    if (product_id && !isNaN(Number(product_id))) {
      baseSql += ' AND p.id = ?';
      params.push(Number(product_id));
    }

    if (size && String(size).trim()) {
      baseSql += ' AND pv.size = ?';
      params.push(String(size).trim());
    }

    if (color && String(color).trim()) {
      baseSql += ' AND pv.color = ?';
      params.push(String(color).trim());
    }

    if (is_active !== undefined && is_active !== '') {
      baseSql += ' AND pv.is_active = ?';
      params.push(Number(is_active) === 1 ? 1 : 0);
    }

    if (stock_status) {
      if (stock_status === 'out_of_stock') {
        baseSql += ' AND pv.stock_quantity = 0';
      } else if (stock_status === 'low_stock') {
        baseSql += ' AND pv.stock_quantity > 0 AND pv.stock_quantity <= COALESCE(pv.low_stock_threshold, 10)';
      } else if (stock_status === 'in_stock') {
        baseSql += ' AND pv.stock_quantity > COALESCE(pv.low_stock_threshold, 10)';
      }
    }

    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      baseSql += ' AND (p.name LIKE ? OR pv.sku LIKE ?)';
      params.push(term, term);
    }

    // Count total matching
    const countRow = await queryOne<{ count: number }>(`SELECT COUNT(*) as count ${baseSql}`, params);
    const total = countRow?.count || 0;

    // Fetch page items with stock_status calculation
    const selectSql = `
      SELECT 
        pv.id as variant_id,
        pv.product_id,
        p.name as product_name,
        p.slug as product_slug,
        p.image_url,
        c.id as category_id,
        c.name as category_name,
        pv.sku,
        pv.size,
        pv.color,
        pv.price,
        pv.stock_quantity as current_stock,
        COALESCE(pv.low_stock_threshold, 10) as low_stock_threshold,
        pv.is_active,
        pv.updated_at as last_updated,
        CASE 
          WHEN pv.stock_quantity = 0 THEN 'OUT_OF_STOCK'
          WHEN pv.stock_quantity <= COALESCE(pv.low_stock_threshold, 10) THEN 'LOW_STOCK'
          ELSE 'IN_STOCK'
        END as stock_status
      ${baseSql}
      ORDER BY 
        CASE 
          WHEN pv.stock_quantity = 0 THEN 1
          WHEN pv.stock_quantity <= COALESCE(pv.low_stock_threshold, 10) THEN 2
          ELSE 3
        END ASC,
        pv.stock_quantity ASC,
        p.name ASC
      LIMIT ? OFFSET ?
    `;

    const items = await query<InventoryItem>(selectSql, [...params, limitNum, offset]);

    return res.json({
      success: true,
      data: items,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'فشل جلب قائمة المخزون' });
  }
});

// ==========================================
// 3. GET /api/inventory/movements (Immutable Ledger)
// ==========================================
router.get('/movements', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const {
      date_range,
      date_from,
      date_to,
      variant_id,
      product_id,
      movement_type,
      created_by,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let baseSql = `
      FROM inventory_movements im
      JOIN product_variants pv ON im.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN users u ON im.created_by = u.id
      LEFT JOIN orders o ON (im.reference_type = 'ORDER' AND im.reference_id = o.id)
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (variant_id && !isNaN(Number(variant_id))) {
      baseSql += ' AND im.variant_id = ?';
      params.push(Number(variant_id));
    }

    if (product_id && !isNaN(Number(product_id))) {
      baseSql += ' AND pv.product_id = ?';
      params.push(Number(product_id));
    }

    if (movement_type && String(movement_type).trim()) {
      baseSql += ' AND im.movement_type = ?';
      params.push(String(movement_type).trim());
    }

    if (created_by && !isNaN(Number(created_by))) {
      baseSql += ' AND im.created_by = ?';
      params.push(Number(created_by));
    }

    // Date filters
    if (date_range === 'today') {
      baseSql += " AND date(im.created_at) = date('now')";
    } else if (date_range === 'yesterday') {
      baseSql += " AND date(im.created_at) = date('now', '-1 day')";
    } else if (date_range === '7days') {
      baseSql += " AND date(im.created_at) >= date('now', '-7 days')";
    } else if (date_range === 'this_month') {
      baseSql += " AND strftime('%Y-%m', im.created_at) = strftime('%Y-%m', 'now')";
    } else if (date_range === 'custom') {
      if (date_from) {
        baseSql += ' AND date(im.created_at) >= date(?)';
        params.push(String(date_from));
      }
      if (date_to) {
        baseSql += ' AND date(im.created_at) <= date(?)';
        params.push(String(date_to));
      }
    }

    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      baseSql += ' AND (pv.sku LIKE ? OR p.name LIKE ? OR o.order_number LIKE ? OR im.note LIKE ?)';
      params.push(term, term, term, term);
    }

    // Count
    const countRow = await queryOne<{ count: number }>(`SELECT COUNT(*) as count ${baseSql}`, params);
    const total = countRow?.count || 0;

    const selectSql = `
      SELECT 
        im.id,
        im.variant_id,
        im.movement_type,
        im.quantity_delta,
        im.stock_before,
        im.stock_after,
        im.reference_type,
        im.reference_id,
        im.note,
        im.created_by,
        im.created_at,
        p.id as product_id,
        p.name as product_name,
        pv.sku,
        pv.size,
        pv.color,
        u.name as created_by_name,
        o.order_number
      ${baseSql}
      ORDER BY im.id DESC
      LIMIT ? OFFSET ?
    `;

    const movements = await query<InventoryMovement>(selectSql, [...params, limitNum, offset]);

    return res.json({
      success: true,
      data: movements,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'فشل جلب سجل حركات المخزون' });
  }
});

// ==========================================
// 4. POST /api/inventory/adjust (Manual Stock Adjustment)
// ==========================================
router.post('/adjust', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { variant_id, adjustment_type, quantity, note } = req.body;

    const varId = Number(variant_id);
    const qty = Number(quantity);

    if (!varId || isNaN(varId)) {
      return res.status(400).json({ success: false, error: 'معرف متغير المنتج غير صالح' });
    }

    if (adjustment_type !== 'ADD' && adjustment_type !== 'REMOVE') {
      return res.status(400).json({ success: false, error: 'نوع التسوية يجب أن يكون إضافة (ADD) أو صرف (REMOVE)' });
    }

    if (!qty || isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
      return res.status(400).json({ success: false, error: 'الكمية يجب أن تكون عدداً صحيحاً أكبر من الصفر' });
    }

    if (!note || !String(note).trim()) {
      return res.status(400).json({ success: false, error: 'سبب / بيان التسوية مطلوب لتوثيق العملية في السجل' });
    }

    const cleanNote = String(note).trim();
    const movementType: InventoryMovementType = adjustment_type === 'ADD' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
    const delta = adjustment_type === 'ADD' ? qty : -qty;

    const result = await transaction(async () => {
      // 1. Record inventory movement atomically
      const move = await recordInventoryMovement({
        variant_id: varId,
        movement_type: movementType,
        quantity_delta: delta,
        reference_type: 'MANUAL_ADJUSTMENT',
        reference_id: null,
        note: cleanNote,
        created_by: user.id,
      });

      // 2. Audit log
      const variantInfo = await queryOne<{ sku: string; product_id: number; product_name: string }>(
        `SELECT pv.sku, pv.product_id, p.name as product_name 
         FROM product_variants pv 
         JOIN products p ON pv.product_id = p.id 
         WHERE pv.id = ?`,
        [varId]
      );

      await execute(
        `INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, metadata)
         VALUES (?, ?, 'PRODUCT_VARIANT', ?, ?)`,
        [
          user.id,
          adjustment_type === 'ADD' ? 'INVENTORY_ADJUSTMENT_IN' : 'INVENTORY_ADJUSTMENT_OUT',
          varId,
          JSON.stringify({
            sku: variantInfo?.sku,
            product_name: variantInfo?.product_name,
            delta,
            stock_before: move.stock_before,
            stock_after: move.stock_after,
            note: cleanNote,
          }),
        ]
      );

      return {
        variant_id: varId,
        sku: variantInfo?.sku,
        product_name: variantInfo?.product_name,
        stock_before: move.stock_before,
        stock_after: move.stock_after,
        quantity_delta: delta,
        movement_type: movementType,
        movement_id: move.movement_id,
      };
    });

    return res.json({
      success: true,
      data: result,
      message: `تمت تسوية المخزون بنجاح. الرصيد قبل: ${result.stock_before} ← الرصيد بعد: ${result.stock_after}`,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message || 'فشل في تسوية المخزون' });
  }
});

// ==========================================
// 5. PATCH /api/inventory/variants/:variantId/threshold
// ==========================================
router.patch('/variants/:variantId/threshold', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const variantId = Number(req.params.variantId);
    const { low_stock_threshold } = req.body;

    if (isNaN(variantId)) {
      return res.status(400).json({ success: false, error: 'معرف المتغير غير صحيح' });
    }

    const threshold = Number(low_stock_threshold);
    if (isNaN(threshold) || threshold < 0 || !Number.isInteger(threshold)) {
      return res.status(400).json({ success: false, error: 'حد التنبيه يجب أن يكون رقماً صحيحاً 0 أو أكبر' });
    }

    const variant = await queryOne<{ id: number; sku: string; low_stock_threshold: number }>(
      'SELECT id, sku, COALESCE(low_stock_threshold, 10) as low_stock_threshold FROM product_variants WHERE id = ?',
      [variantId]
    );

    if (!variant) {
      return res.status(404).json({ success: false, error: 'متغير المنتج غير موجود' });
    }

    await transaction(async () => {
      await execute(
        "UPDATE product_variants SET low_stock_threshold = ?, updated_at = datetime('now') WHERE id = ?",
        [threshold, variantId]
      );

      await execute(
        `INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, metadata)
         VALUES (?, 'LOW_STOCK_THRESHOLD_UPDATED', 'PRODUCT_VARIANT', ?, ?)`,
        [
          user.id,
          variantId,
          JSON.stringify({
            sku: variant.sku,
            old_threshold: variant.low_stock_threshold,
            new_threshold: threshold,
          }),
        ]
      );
    });

    return res.json({
      success: true,
      data: { variant_id: variantId, low_stock_threshold: threshold },
      message: `تم تحديث حد تنبيه المخزون للمتغير (${variant.sku}) إلى ${threshold} قطعة بنجاح`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'فشل تحديث حد التنبيه' });
  }
});

export default router;
