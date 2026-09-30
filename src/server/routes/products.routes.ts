import { Router, Request, Response } from 'express';
import { query, queryOne, execute, transaction } from '../db/database.ts';
import { requireAuth, requirePermission, AuthRequest } from '../middleware/auth.ts';
import { Product, ProductVariant } from '../../types/index.ts';

const router = Router();

// Public: Get all active products (with category filter and search)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category_id, category_slug, search } = req.query;

    let sql = `
      SELECT p.*, c.name as category_name 
      FROM products p
      INNER JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
    `;
    const params: (string | number)[] = [];

    if (category_id) {
      sql += ' AND p.category_id = ?';
      params.push(Number(category_id));
    } else if (category_slug) {
      sql += ' AND c.slug = ?';
      params.push(String(category_slug));
    }

    if (search) {
      sql += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY p.id DESC';

    const products = await query<Product>(sql, params);

    // Fetch variants for each product
    const productIds = products.map((p) => p.id);
    if (productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',');
      const variants = await query<ProductVariant>(
        `SELECT * FROM product_variants WHERE product_id IN (${placeholders}) AND is_active = 1 ORDER BY id ASC`,
        productIds
      );

      const variantsByProduct = new Map<number, ProductVariant[]>();
      for (const v of variants) {
        if (!variantsByProduct.has(v.product_id)) {
          variantsByProduct.set(v.product_id, []);
        }
        variantsByProduct.get(v.product_id)!.push(v);
      }

      for (const p of products) {
        p.variants = variantsByProduct.get(p.id) || [];
      }
    }

    return res.json({ success: true, data: products });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Get all products (including inactive)
router.get('/admin', requireAuth, requirePermission('manage_products'), async (req: AuthRequest, res: Response) => {
  try {
    const products = await query<Product>(
      `SELECT p.*, c.name as category_name 
       FROM products p
       INNER JOIN categories c ON p.category_id = c.id
       ORDER BY p.id DESC`
    );

    const variants = await query<ProductVariant>('SELECT * FROM product_variants ORDER BY id ASC');
    const variantsByProduct = new Map<number, ProductVariant[]>();
    for (const v of variants) {
      if (!variantsByProduct.has(v.product_id)) {
        variantsByProduct.set(v.product_id, []);
      }
      variantsByProduct.get(v.product_id)!.push(v);
    }

    for (const p of products) {
      p.variants = variantsByProduct.get(p.id) || [];
    }

    return res.json({ success: true, data: products });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Public: Get single product by ID or Slug
router.get('/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const param = req.params.idOrSlug;
    const isNumeric = /^\d+$/.test(param);

    const product = await queryOne<Product>(
      isNumeric
        ? `SELECT p.*, c.name as category_name 
           FROM products p 
           JOIN categories c ON p.category_id = c.id 
           WHERE p.id = ?`
        : `SELECT p.*, c.name as category_name 
           FROM products p 
           JOIN categories c ON p.category_id = c.id 
           WHERE p.slug = ?`,
      [isNumeric ? Number(param) : param]
    );

    if (!product) {
      return res.status(404).json({ success: false, error: 'المنتج غير موجود' });
    }

    const variants = await query<ProductVariant>(
      'SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY id ASC',
      [product.id]
    );
    product.variants = variants;

    return res.json({ success: true, data: product });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Create Product with Variants
router.post('/', requireAuth, requirePermission('manage_products'), async (req: AuthRequest, res: Response) => {
  try {
    const { category_id, name, slug, description, base_price, image_url, variants } = req.body;

    if (!category_id || !name || !slug || base_price === undefined) {
      return res.status(400).json({
        success: false,
        error: 'جميع الحقول الأساسية مطلوبة (التصنيف، اسم المنتج، الرابط الدلالي، السعر الأساسي)',
      });
    }

    // Check category exists
    const category = await queryOne('SELECT id FROM categories WHERE id = ?', [Number(category_id)]);
    if (!category) {
      return res.status(400).json({ success: false, error: 'التصنيف المختار غير موجود' });
    }

    // Check slug uniqueness
    const existingSlug = await queryOne('SELECT id FROM products WHERE slug = ?', [slug.trim().toLowerCase()]);
    if (existingSlug) {
      return res.status(400).json({ success: false, error: 'الرابط الدلالي (Slug) مستخدم بالفعل لمنتج آخر' });
    }

    const createdProduct = await transaction(async () => {
      const prodResult = await execute(
        `INSERT INTO products (category_id, name, slug, description, base_price, image_url, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          Number(category_id),
          name.trim(),
          slug.trim().toLowerCase(),
          description || null,
          Number(base_price),
          image_url || null,
        ]
      );

      const productId = prodResult.lastInsertRowid;

      if (Array.isArray(variants) && variants.length > 0) {
        for (const v of variants) {
          if (!v.sku || !v.size || !v.color) continue;
          await execute(
            `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [
              productId,
              v.sku.trim(),
              v.size.trim(),
              v.color.trim(),
              Number(v.price || base_price),
              Number(v.stock_quantity || 0),
            ]
          );
        }
      }

      return await queryOne<Product>('SELECT * FROM products WHERE id = ?', [productId]);
    });

    return res.status(201).json({ success: true, data: createdProduct, message: 'تم إضافة المنتج بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Update Product
router.put('/:id', requireAuth, requirePermission('manage_products'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { category_id, name, slug, description, base_price, image_url, is_active } = req.body;

    const existing = await queryOne<Product>('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'المنتج غير موجود' });
    }

    if (slug && slug !== existing.slug) {
      const duplicate = await queryOne('SELECT id FROM products WHERE slug = ? AND id != ?', [slug.trim().toLowerCase(), id]);
      if (duplicate) {
        return res.status(400).json({ success: false, error: 'الرابط الدلالي (Slug) مستخدم بالفعل' });
      }
    }

    await execute(
      `UPDATE products SET
        category_id = COALESCE(?, category_id),
        name = COALESCE(?, name),
        slug = COALESCE(?, slug),
        description = COALESCE(?, description),
        base_price = COALESCE(?, base_price),
        image_url = COALESCE(?, image_url),
        is_active = COALESCE(?, is_active),
        updated_at = datetime('now')
       WHERE id = ?`,
      [
        category_id ? Number(category_id) : null,
        name ? name.trim() : null,
        slug ? slug.trim().toLowerCase() : null,
        description !== undefined ? description : null,
        base_price !== undefined ? Number(base_price) : null,
        image_url !== undefined ? image_url : null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        id,
      ]
    );

    const updated = await queryOne<Product>('SELECT * FROM products WHERE id = ?', [id]);
    return res.json({ success: true, data: updated, message: 'تم تحديث بيانات المنتج بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Delete Product
router.delete('/:id', requireAuth, requirePermission('manage_products'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);

    // Check if product is in order_items
    const orderItemsCount = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM order_items WHERE product_id = ?',
      [id]
    );

    if (orderItemsCount && orderItemsCount.count > 0) {
      // Soft-delete to preserve order history
      await execute("UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?", [id]);
      return res.json({
        success: true,
        message: 'تم أرشفة المنتج وتعطيله بنجاح حفاظاً على سجلات الطلبات السابقة',
      });
    }

    // Hard-delete if never ordered
    await execute('DELETE FROM products WHERE id = ?', [id]);
    return res.json({ success: true, message: 'تم حذف المنتج بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Add Variant to Product
router.post('/:id/variants', requireAuth, requirePermission('manage_products'), async (req: AuthRequest, res: Response) => {
  try {
    const productId = Number(req.params.id);
    const { sku, size, color, price, stock_quantity } = req.body;

    if (!sku || !size || !color || price === undefined) {
      return res.status(400).json({ success: false, error: 'بيانات المتغير (SKU، المقاس، اللون، السعر) مطلوبة' });
    }

    const existingSku = await queryOne('SELECT id FROM product_variants WHERE sku = ?', [sku.trim()]);
    if (existingSku) {
      return res.status(400).json({ success: false, error: 'كود المتغير (SKU) مستخدم بالفعل' });
    }

    const result = await execute(
      `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [productId, sku.trim(), size.trim(), color.trim(), Number(price), Number(stock_quantity || 0)]
    );

    const created = await queryOne<ProductVariant>('SELECT * FROM product_variants WHERE id = ?', [result.lastInsertRowid]);
    return res.status(201).json({ success: true, data: created, message: 'تم إضافة متغير المنتج بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
