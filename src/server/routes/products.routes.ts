import { Router, Request, Response } from 'express';
import { query, queryOne, execute, transaction } from '../db/database.ts';
import { requireAuth, requirePermission, AuthRequest } from '../middleware/auth.ts';
import { Product, ProductVariant } from '../../types/index.ts';

const router = Router();

function slugify(text: string): string {
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/[\s\t\n]+/g, '-')
    .replace(/[^\w\u0600-\u06FF\-]/g, '')
    .replace(/-+/g, '-');
  return cleaned || `prod-${Date.now()}`;
}

function parseAdditionalImages(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

// Public: Get all active products belonging to active categories
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category_id, category_slug, search } = req.query;

    let sql = `
      SELECT p.*, c.name as category_name 
      FROM products p
      INNER JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1 AND c.is_active = 1
    `;
    const params: (string | number)[] = [];

    if (category_id) {
      sql += ' AND p.category_id = ?';
      params.push(Number(category_id));
    } else if (category_slug) {
      sql += ' AND c.slug = ?';
      params.push(String(category_slug));
    }

    if (search && String(search).trim()) {
      const s = String(search).trim();
      sql += ' AND (p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?)';
      params.push(`%${s}%`, `%${s}%`, `%${s}%`);
    }

    sql += ' ORDER BY p.id DESC';

    const rawProducts = await query<any>(sql, params);
    const products: Product[] = rawProducts.map((p) => ({
      ...p,
      additional_images: parseAdditionalImages(p.additional_images),
    }));

    // Fetch active variants for each product
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

// Admin: Get products with pagination and filters
router.get('/admin', requireAuth, requirePermission('manage_products'), async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const { category_id, search, status } = req.query;

    let baseSql = `
      FROM products p
      INNER JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (category_id) {
      baseSql += ' AND p.category_id = ?';
      params.push(Number(category_id));
    }

    if (status === 'active') {
      baseSql += ' AND p.is_active = 1';
    } else if (status === 'inactive') {
      baseSql += ' AND p.is_active = 0';
    }

    if (search && String(search).trim()) {
      const s = String(search).trim();
      baseSql += ' AND (p.name LIKE ? OR p.slug LIKE ? OR c.name LIKE ?)';
      params.push(`%${s}%`, `%${s}%`, `%${s}%`);
    }

    // Count total products matching filters
    const totalCountRes = await queryOne<{ count: number }>(`SELECT COUNT(p.id) as count ${baseSql}`, params);
    const total = totalCountRes?.count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Fetch paginated products
    const dataSql = `
      SELECT p.*, c.name as category_name,
        (SELECT COUNT(pv.id) FROM product_variants pv WHERE pv.product_id = p.id) as variants_count
      ${baseSql}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
    `;
    const paginatedParams = [...params, limit, offset];

    const rawProducts = await query<any>(dataSql, paginatedParams);
    const products: Product[] = rawProducts.map((p) => ({
      ...p,
      additional_images: parseAdditionalImages(p.additional_images),
    }));

    // Fetch variants for loaded products
    const productIds = products.map((p) => p.id);
    if (productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',');
      const variants = await query<ProductVariant>(
        `SELECT * FROM product_variants WHERE product_id IN (${placeholders}) ORDER BY id ASC`,
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

    return res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Public: Get single product by ID or Slug with active variants & gallery
router.get('/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const param = req.params.idOrSlug;
    const isNumeric = /^\d+$/.test(param);

    const product = await queryOne<any>(
      isNumeric
        ? `SELECT p.*, c.name as category_name, c.slug as category_slug, c.is_active as category_active
           FROM products p 
           JOIN categories c ON p.category_id = c.id 
           WHERE p.id = ?`
        : `SELECT p.*, c.name as category_name, c.slug as category_slug, c.is_active as category_active 
           FROM products p 
           JOIN categories c ON p.category_id = c.id 
           WHERE p.slug = ?`,
      [isNumeric ? Number(param) : param]
    );

    if (!product) {
      return res.status(404).json({ success: false, error: 'المنتج غير موجود' });
    }

    product.additional_images = parseAdditionalImages(product.additional_images);

    // Fetch variants: include inactive flag for admin, but storefront filters them
    const variants = await query<ProductVariant>(
      'SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC',
      [product.id]
    );
    product.variants = variants;

    return res.json({ success: true, data: product });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Create Product with Category, Images, and Variants
router.post('/', requireAuth, requirePermission('manage_products'), async (req: AuthRequest, res: Response) => {
  try {
    const { category_id, name, description, base_price, image_url, additional_images, is_active, variants } = req.body;
    let { slug } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'اسم المنتج مطلوب' });
    }

    if (!category_id) {
      return res.status(400).json({ success: false, error: 'يجب اختيار قسم صالح للمنتج' });
    }

    if (base_price === undefined || base_price === null || isNaN(Number(base_price)) || Number(base_price) < 0) {
      return res.status(400).json({ success: false, error: 'السعر الأساسي يجب أن يكون رقماً موجباً' });
    }

    // Verify category exists
    const category = await queryOne('SELECT id, name FROM categories WHERE id = ?', [Number(category_id)]);
    if (!category) {
      return res.status(400).json({ success: false, error: 'القسم المحدد غير موجود' });
    }

    if (!slug || !slug.trim()) {
      slug = slugify(name);
    } else {
      slug = slugify(slug);
    }

    // Check slug uniqueness
    const existingSlug = await queryOne('SELECT id FROM products WHERE slug = ?', [slug]);
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    // Validate variants before inserting
    if (Array.isArray(variants) && variants.length > 0) {
      const seenVariantCombos = new Set<string>();
      const seenSkus = new Set<string>();

      for (const v of variants) {
        if (!v.sku || !v.sku.trim()) {
          return res.status(400).json({ success: false, error: 'كود الـ SKU مطلوب لكل متغير' });
        }
        if (!v.size || !v.size.trim() || !v.color || !v.color.trim()) {
          return res.status(400).json({ success: false, error: 'المقاس واللون مطلوبان لكل متغير' });
        }

        const skuClean = v.sku.trim().toUpperCase();
        if (seenSkus.has(skuClean)) {
          return res.status(400).json({ success: false, error: `كود SKU (${skuClean}) مكرر في بيانات المنتج` });
        }
        seenSkus.add(skuClean);

        // Check if SKU exists in DB
        const dbSku = await queryOne('SELECT id FROM product_variants WHERE UPPER(sku) = ?', [skuClean]);
        if (dbSku) {
          return res.status(400).json({ success: false, error: `كود SKU (${skuClean}) مستخدم بالفعل في متغير آخر في النظام` });
        }

        const comboKey = `${v.size.trim().toLowerCase()}__${v.color.trim().toLowerCase()}`;
        if (seenVariantCombos.has(comboKey)) {
          return res.status(400).json({
            success: false,
            error: `المتغير (المقاس: ${v.size} واللون: ${v.color}) مكرر لهذا المنتج، يرجى إزالة التكرار`,
          });
        }
        seenVariantCombos.add(comboKey);
      }
    }

    const additionalImagesStr = JSON.stringify(parseAdditionalImages(additional_images));
    const activeVal = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    // Requirement: A product must have at least one variant before it can be activated for customers
    if (activeVal === 1) {
      const hasActiveVariant = Array.isArray(variants) && variants.some(
        (v) => v.is_active === undefined || v.is_active === 1 || v.is_active === true
      );
      if (!hasActiveVariant) {
        return res.status(400).json({
          success: false,
          error: 'يجب إضافة وتفعيل متغير واحد على الأقل (مقاس ولون) قبل تفعيل المنتج للعملاء في المتجر.',
        });
      }
    }

    const createdProduct = await transaction(async () => {
      const prodResult = await execute(
        `INSERT INTO products (category_id, name, slug, description, base_price, image_url, additional_images, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Number(category_id),
          name.trim(),
          slug,
          description ? description.trim() : null,
          Number(base_price),
          image_url ? image_url.trim() : null,
          additionalImagesStr,
          activeVal,
        ]
      );

      const productId = prodResult.lastInsertRowid;

      if (Array.isArray(variants) && variants.length > 0) {
        for (const v of variants) {
          const varPrice = v.price !== undefined && v.price !== null && v.price !== '' && !isNaN(Number(v.price))
            ? Number(v.price)
            : Number(base_price);

          const varStock = !isNaN(Number(v.stock_quantity)) ? Number(v.stock_quantity) : 0;
          const varActive = v.is_active !== undefined ? (v.is_active ? 1 : 0) : 1;

          await execute(
            `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              productId,
              v.sku.trim().toUpperCase(),
              v.size.trim(),
              v.color.trim(),
              varPrice,
              varStock,
              varActive,
            ]
          );
        }
      }

      return await queryOne<Product>('SELECT * FROM products WHERE id = ?', [productId]);
    });

    return res.status(201).json({ success: true, data: createdProduct, message: 'تم إنشاء المنتج بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Update Product & Sync Variants
router.put('/:id', requireAuth, requirePermission('manage_products'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { category_id, name, description, base_price, image_url, additional_images, is_active, variants } = req.body;
    let { slug } = req.body;

    const existing = await queryOne<Product>('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'المنتج غير موجود' });
    }

    if (category_id) {
      const cat = await queryOne('SELECT id FROM categories WHERE id = ?', [Number(category_id)]);
      if (!cat) {
        return res.status(400).json({ success: false, error: 'القسم المحدد غير موجود' });
      }
    }

    if (slug && slug.trim()) {
      slug = slugify(slug);
      const duplicateSlug = await queryOne('SELECT id FROM products WHERE slug = ? AND id != ?', [slug, id]);
      if (duplicateSlug) {
        return res.status(400).json({ success: false, error: 'الرابط الدلالي (Slug) مستخدم بالفعل' });
      }
    }

    // Validate variants if provided
    if (Array.isArray(variants)) {
      const seenCombos = new Set<string>();
      const seenSkus = new Set<string>();

      for (const v of variants) {
        if (!v.sku || !v.sku.trim() || !v.size || !v.size.trim() || !v.color || !v.color.trim()) {
          return res.status(400).json({ success: false, error: 'الـ SKU والمقاس واللون مطلوبة لجميع المتغيرات' });
        }

        const skuClean = v.sku.trim().toUpperCase();
        if (seenSkus.has(skuClean)) {
          return res.status(400).json({ success: false, error: `كود SKU (${skuClean}) مكرر داخل المتغيرات` });
        }
        seenSkus.add(skuClean);

        // Check SKU uniqueness in DB for variants not belonging to this product variant
        const dbSku = await queryOne<any>(
          'SELECT id, product_id FROM product_variants WHERE UPPER(sku) = ?',
          [skuClean]
        );
        if (dbSku && (!v.id || dbSku.id !== Number(v.id))) {
          return res.status(400).json({ success: false, error: `كود SKU (${skuClean}) مستخدم بالفعل لمنتج آخر` });
        }

        const comboKey = `${v.size.trim().toLowerCase()}__${v.color.trim().toLowerCase()}`;
        if (seenCombos.has(comboKey)) {
          return res.status(400).json({
            success: false,
            error: `المتغير (المقاس: ${v.size} واللون: ${v.color}) مكرر، يرجى عدم تكرار نفس المقاس واللون للمنتج`,
          });
        }
        seenCombos.add(comboKey);
      }
    }

    // Requirement: A product must have at least one variant before it can be activated for customers
    const targetActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;
    if (targetActive === 1) {
      if (Array.isArray(variants)) {
        const hasActive = variants.some(
          (v) => v.is_active === undefined || v.is_active === 1 || v.is_active === true
        );
        if (!hasActive) {
          return res.status(400).json({
            success: false,
            error: 'يجب أن يحتوي المنتج على متغير واحد نشط على الأقل (مقاس ولون) قبل تفعيله للعملاء.',
          });
        }
      } else {
        const activeCount = await queryOne<{ count: number }>(
          'SELECT COUNT(*) as count FROM product_variants WHERE product_id = ? AND is_active = 1',
          [id]
        );
        if (!activeCount || activeCount.count === 0) {
          return res.status(400).json({
            success: false,
            error: 'يجب أن يحتوي المنتج على متغير واحد نشط على الأقل (مقاس ولون) قبل تفعيله للعملاء.',
          });
        }
      }
    }

    const additionalImagesStr = additional_images !== undefined ? JSON.stringify(parseAdditionalImages(additional_images)) : undefined;

    await transaction(async () => {
      await execute(
        `UPDATE products SET
          category_id = COALESCE(?, category_id),
          name = COALESCE(?, name),
          slug = COALESCE(?, slug),
          description = COALESCE(?, description),
          base_price = COALESCE(?, base_price),
          image_url = COALESCE(?, image_url),
          additional_images = COALESCE(?, additional_images),
          is_active = COALESCE(?, is_active),
          updated_at = datetime('now')
         WHERE id = ?`,
        [
          category_id ? Number(category_id) : null,
          name ? name.trim() : null,
          slug ? slug : null,
          description !== undefined ? description : null,
          base_price !== undefined ? Number(base_price) : null,
          image_url !== undefined ? image_url : null,
          additionalImagesStr,
          is_active !== undefined ? (is_active ? 1 : 0) : null,
          id,
        ]
      );

      // If variants are supplied, sync variants
      if (Array.isArray(variants)) {
        const keptVariantIds: number[] = [];
        const currentBasePrice = base_price !== undefined ? Number(base_price) : existing.base_price;

        for (const v of variants) {
          const varPrice = v.price !== undefined && v.price !== null && v.price !== '' && !isNaN(Number(v.price))
            ? Number(v.price)
            : currentBasePrice;
          const varStock = !isNaN(Number(v.stock_quantity)) ? Number(v.stock_quantity) : 0;
          const varActive = v.is_active !== undefined ? (v.is_active ? 1 : 0) : 1;

          if (v.id) {
            // Update existing variant
            await execute(
              `UPDATE product_variants SET
                sku = ?,
                size = ?,
                color = ?,
                price = ?,
                stock_quantity = ?,
                is_active = ?,
                updated_at = datetime('now')
               WHERE id = ? AND product_id = ?`,
              [v.sku.trim().toUpperCase(), v.size.trim(), v.color.trim(), varPrice, varStock, varActive, Number(v.id), id]
            );
            keptVariantIds.push(Number(v.id));
          } else {
            // Insert new variant
            const insRes = await execute(
              `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [id, v.sku.trim().toUpperCase(), v.size.trim(), v.color.trim(), varPrice, varStock, varActive]
            );
            keptVariantIds.push(insRes.lastInsertRowid);
          }
        }

        // Delete variants that were removed by user (check order items first to avoid deleting ordered ones)
        if (keptVariantIds.length > 0) {
          const placeholders = keptVariantIds.map(() => '?').join(',');
          await execute(
            `DELETE FROM product_variants WHERE product_id = ? AND id NOT IN (${placeholders})`,
            [id, ...keptVariantIds]
          );
        }
      }
    });

    const updated = await queryOne<Product>('SELECT * FROM products WHERE id = ?', [id]);
    return res.json({ success: true, data: updated, message: 'تم تحديث بيانات المنتج والمتغيرات بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Toggle Active/Inactive Status
router.patch('/:id/toggle-status', requireAuth, requirePermission('manage_products'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await queryOne<Product>('SELECT id, name, is_active FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'المنتج غير موجود' });
    }

    const newStatus = existing.is_active === 1 ? 0 : 1;
    if (newStatus === 1) {
      const activeCount = await queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM product_variants WHERE product_id = ? AND is_active = 1',
        [id]
      );
      if (!activeCount || activeCount.count === 0) {
        return res.status(400).json({
          success: false,
          error: 'لا يمكن تفعيل هذا المنتج لعدم وجود أي مقاس أو لون (متغير) نشط له. يرجى إضافة مقاس ولون نشط للمنتج أولاً.',
        });
      }
    }
    await execute("UPDATE products SET is_active = ?, updated_at = datetime('now') WHERE id = ?", [newStatus, id]);

    return res.json({
      success: true,
      data: { id, is_active: newStatus },
      message: newStatus === 1 ? `تم تفعيل المنتج (${existing.name}) بنجاح` : `تم تعطيل المنتج (${existing.name}) بنجاح`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Duplicate Product with all its variants
router.post('/:id/duplicate', requireAuth, requirePermission('manage_products'), async (req: AuthRequest, res: Response) => {
  try {
    const sourceId = Number(req.params.id);
    const source = await queryOne<Product>('SELECT * FROM products WHERE id = ?', [sourceId]);
    if (!source) {
      return res.status(404).json({ success: false, error: 'المنتج الأصلي غير موجود' });
    }

    const variants = await query<ProductVariant>('SELECT * FROM product_variants WHERE product_id = ?', [sourceId]);

    const newProduct = await transaction(async () => {
      const newName = `نسخة من ${source.name}`;
      const newSlug = `${source.slug}-copy-${Date.now().toString().slice(-4)}`;

      const prodRes = await execute(
        `INSERT INTO products (category_id, name, slug, description, base_price, image_url, additional_images, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          source.category_id,
          newName,
          newSlug,
          source.description,
          source.base_price,
          source.image_url,
          (source as any).additional_images || '[]',
        ]
      );

      const newId = prodRes.lastInsertRowid;

      for (const v of variants) {
        const randomSuffix = Math.floor(100 + Math.random() * 900);
        const newSku = `${v.sku}-COPY-${randomSuffix}`;

        await execute(
          `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newId, newSku, v.size, v.color, v.price, v.stock_quantity, v.is_active]
        );
      }

      return await queryOne<Product>('SELECT * FROM products WHERE id = ?', [newId]);
    });

    return res.status(201).json({
      success: true,
      data: newProduct,
      message: `تم تكرار المنتج بنجاح باسم (${newProduct?.name})`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Safe Delete or Deactivate Product
router.delete('/:id', requireAuth, requirePermission('manage_products'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await queryOne<Product>('SELECT id, name FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'المنتج غير موجود' });
    }

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
        message: `تم تعطيل وأرشفة المنتج (${existing.name}) بنجاح حفاظاً على سجلات ${orderItemsCount.count} طلب مرتبط به`,
        is_archived: true,
      });
    }

    // Hard-delete if never ordered
    await execute('DELETE FROM products WHERE id = ?', [id]);
    return res.json({ success: true, message: `تم حذف المنتج (${existing.name}) نهائياً بنجاح` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Add Variant to an existing Product
router.post('/:id/variants', requireAuth, requirePermission('manage_products'), async (req: AuthRequest, res: Response) => {
  try {
    const productId = Number(req.params.id);
    const { sku, size, color, price, stock_quantity, is_active } = req.body;

    if (!sku || !sku.trim() || !size || !size.trim() || !color || !color.trim()) {
      return res.status(400).json({ success: false, error: 'كود الـ SKU والمقاس واللون مطلوبة' });
    }

    const skuClean = sku.trim().toUpperCase();
    const existingSku = await queryOne('SELECT id FROM product_variants WHERE UPPER(sku) = ?', [skuClean]);
    if (existingSku) {
      return res.status(400).json({ success: false, error: `كود الـ SKU (${skuClean}) مستخدم بالفعل` });
    }

    // Check duplicate (size, color) for this product
    const existingCombo = await queryOne(
      'SELECT id FROM product_variants WHERE product_id = ? AND LOWER(size) = LOWER(?) AND LOWER(color) = LOWER(?)',
      [productId, size.trim(), color.trim()]
    );
    if (existingCombo) {
      return res.status(400).json({
        success: false,
        error: `المتغير (المقاس: ${size} واللون: ${color}) موجود بالفعل لهذا المنتج`,
      });
    }

    const prod = await queryOne<Product>('SELECT base_price FROM products WHERE id = ?', [productId]);
    const finalPrice = price !== undefined && price !== null && price !== '' && !isNaN(Number(price))
      ? Number(price)
      : (prod?.base_price || 0);

    const result = await execute(
      `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        productId,
        skuClean,
        size.trim(),
        color.trim(),
        finalPrice,
        !isNaN(Number(stock_quantity)) ? Number(stock_quantity) : 0,
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
      ]
    );

    const created = await queryOne<ProductVariant>('SELECT * FROM product_variants WHERE id = ?', [result.lastInsertRowid]);
    return res.status(201).json({ success: true, data: created, message: 'تم إضافة المتغير بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Update Variant
router.put('/variants/:variantId', requireAuth, requirePermission('manage_products'), async (req: AuthRequest, res: Response) => {
  try {
    const variantId = Number(req.params.variantId);
    const { sku, size, color, price, stock_quantity, is_active } = req.body;

    const existing = await queryOne<ProductVariant>('SELECT * FROM product_variants WHERE id = ?', [variantId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'المتغير غير موجود' });
    }

    if (sku && sku.trim()) {
      const skuClean = sku.trim().toUpperCase();
      const duplicateSku = await queryOne('SELECT id FROM product_variants WHERE UPPER(sku) = ? AND id != ?', [skuClean, variantId]);
      if (duplicateSku) {
        return res.status(400).json({ success: false, error: `كود SKU (${skuClean}) مستخدم بالفعل في متغير آخر` });
      }
    }

    const newSize = size ? size.trim() : existing.size;
    const newColor = color ? color.trim() : existing.color;

    // Check duplicate (size, color)
    const duplicateCombo = await queryOne(
      'SELECT id FROM product_variants WHERE product_id = ? AND LOWER(size) = LOWER(?) AND LOWER(color) = LOWER(?) AND id != ?',
      [existing.product_id, newSize, newColor, variantId]
    );
    if (duplicateCombo) {
      return res.status(400).json({
        success: false,
        error: `يوجد متغير آخر بنفس المقاس (${newSize}) واللون (${newColor}) لهذا المنتج`,
      });
    }

    await execute(
      `UPDATE product_variants SET
        sku = COALESCE(?, sku),
        size = COALESCE(?, size),
        color = COALESCE(?, color),
        price = COALESCE(?, price),
        stock_quantity = COALESCE(?, stock_quantity),
        is_active = COALESCE(?, is_active),
        updated_at = datetime('now')
       WHERE id = ?`,
      [
        sku ? sku.trim().toUpperCase() : null,
        size ? size.trim() : null,
        color ? color.trim() : null,
        price !== undefined && !isNaN(Number(price)) ? Number(price) : null,
        stock_quantity !== undefined && !isNaN(Number(stock_quantity)) ? Number(stock_quantity) : null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        variantId,
      ]
    );

    const updated = await queryOne<ProductVariant>('SELECT * FROM product_variants WHERE id = ?', [variantId]);
    return res.json({ success: true, data: updated, message: 'تم تحديث المتغير بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Delete Variant
router.delete('/variants/:variantId', requireAuth, requirePermission('manage_products'), async (req: AuthRequest, res: Response) => {
  try {
    const variantId = Number(req.params.variantId);
    const existing = await queryOne<ProductVariant>('SELECT * FROM product_variants WHERE id = ?', [variantId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'المتغير غير موجود' });
    }

    // Check if ordered in order_items
    const orderItemsCount = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM order_items WHERE variant_id = ?',
      [variantId]
    );

    if (orderItemsCount && orderItemsCount.count > 0) {
      // Soft-deactivate
      await execute("UPDATE product_variants SET is_active = 0, updated_at = datetime('now') WHERE id = ?", [variantId]);
      return res.json({
        success: true,
        message: 'تم تعطيل المتغير بنجاح حفاظاً على سجلات الطلبات التاريخية',
      });
    }

    await execute('DELETE FROM product_variants WHERE id = ?', [variantId]);
    return res.json({ success: true, message: 'تم حذف المتغير بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
