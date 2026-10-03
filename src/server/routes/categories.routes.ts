import { Router, Request, Response } from 'express';
import { query, queryOne, execute, transaction } from '../db/database.ts';
import { requireAuth, requirePermission, AuthRequest } from '../middleware/auth.ts';
import { Category } from '../../types/index.ts';

const router = Router();

// Helper to generate a clean URL-friendly slug from Arabic/English text
function slugify(text: string): string {
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/[\s\t\n]+/g, '-')
    .replace(/[^\w\u0600-\u06FF\-]/g, '')
    .replace(/-+/g, '-');
  return cleaned || `cat-${Date.now()}`;
}

// Public: Get all active categories with product counts (ordered by sort_order)
router.get('/', async (req: Request, res: Response) => {
  try {
    const categories = await query<Category>(
      `SELECT c.*, COUNT(p.id) as product_count 
       FROM categories c 
       LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1 
       WHERE c.is_active = 1 
       GROUP BY c.id 
       ORDER BY c.sort_order ASC, c.id ASC`
    );
    return res.json({ success: true, data: categories });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Get all categories including inactive ones with full product count
router.get('/admin', requireAuth, requirePermission('manage_categories'), async (req: AuthRequest, res: Response) => {
  try {
    const categories = await query<Category>(
      `SELECT c.*, COUNT(p.id) as product_count 
       FROM categories c 
       LEFT JOIN products p ON c.id = p.category_id 
       GROUP BY c.id 
       ORDER BY c.sort_order ASC, c.id ASC`
    );
    return res.json({ success: true, data: categories });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Public: Get category by slug or ID
router.get('/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const param = req.params.idOrSlug;
    const isNumeric = /^\d+$/.test(param);
    const category = await queryOne<Category>(
      isNumeric
        ? 'SELECT * FROM categories WHERE id = ?'
        : 'SELECT * FROM categories WHERE slug = ?',
      [isNumeric ? Number(param) : param]
    );

    if (!category) {
      return res.status(404).json({ success: false, error: 'التصنيف غير موجود' });
    }

    return res.json({ success: true, data: category });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Create Category
router.post('/', requireAuth, requirePermission('manage_categories'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, image_url, sort_order, is_active } = req.body;
    let { slug } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'اسم القسم مطلوب ولا يمكن تركه فارغاً' });
    }

    // Auto-generate slug if not provided
    if (!slug || !slug.trim()) {
      slug = slugify(name);
    } else {
      slug = slugify(slug);
    }

    // Check duplicate name
    const existingName = await queryOne('SELECT id FROM categories WHERE LOWER(TRIM(name)) = LOWER(?)', [name.trim()]);
    if (existingName) {
      return res.status(400).json({ success: false, error: 'اسم هذا القسم مستخدم بالفعل، يرجى اختيار اسم فريد' });
    }

    // Check duplicate slug
    const existingSlug = await queryOne('SELECT id FROM categories WHERE slug = ?', [slug]);
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const sortOrderNum = !isNaN(Number(sort_order)) ? Number(sort_order) : 0;
    const activeStatus = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    const result = await execute(
      `INSERT INTO categories (name, slug, description, image_url, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        slug,
        description ? description.trim() : null,
        image_url ? image_url.trim() : null,
        sortOrderNum,
        activeStatus,
      ]
    );

    const created = await queryOne<Category>('SELECT * FROM categories WHERE id = ?', [result.lastInsertRowid]);
    return res.status(201).json({ success: true, data: created, message: 'تم إنشاء القسم بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Update Category
router.put('/:id', requireAuth, requirePermission('manage_categories'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, description, image_url, sort_order, is_active } = req.body;
    let { slug } = req.body;

    const existing = await queryOne<Category>('SELECT * FROM categories WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'القسم المطلوب غير موجود' });
    }

    if (name && name.trim()) {
      const duplicateName = await queryOne(
        'SELECT id FROM categories WHERE LOWER(TRIM(name)) = LOWER(?) AND id != ?',
        [name.trim(), id]
      );
      if (duplicateName) {
        return res.status(400).json({ success: false, error: 'اسم هذا القسم مستخدم بالفعل في قسم آخر' });
      }
    }

    if (slug && slug.trim()) {
      slug = slugify(slug);
      const duplicateSlug = await queryOne(
        'SELECT id FROM categories WHERE slug = ? AND id != ?',
        [slug, id]
      );
      if (duplicateSlug) {
        return res.status(400).json({ success: false, error: 'الرابط الدلالي (Slug) مستخدم بالفعل لقسم آخر' });
      }
    }

    await execute(
      `UPDATE categories SET 
        name = COALESCE(?, name),
        slug = COALESCE(?, slug),
        description = COALESCE(?, description),
        image_url = COALESCE(?, image_url),
        sort_order = COALESCE(?, sort_order),
        is_active = COALESCE(?, is_active),
        updated_at = datetime('now')
       WHERE id = ?`,
      [
        name ? name.trim() : null,
        slug ? slug : null,
        description !== undefined ? description : null,
        image_url !== undefined ? image_url : null,
        sort_order !== undefined && !isNaN(Number(sort_order)) ? Number(sort_order) : null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        id,
      ]
    );

    const updated = await queryOne<Category>('SELECT * FROM categories WHERE id = ?', [id]);
    return res.json({ success: true, data: updated, message: 'تم تحديث بيانات القسم بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Toggle Active/Inactive Status
router.patch('/:id/toggle-status', requireAuth, requirePermission('manage_categories'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await queryOne<Category>('SELECT id, is_active, name FROM categories WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'القسم غير موجود' });
    }

    const newStatus = existing.is_active === 1 ? 0 : 1;
    await execute("UPDATE categories SET is_active = ?, updated_at = datetime('now') WHERE id = ?", [newStatus, id]);

    return res.json({
      success: true,
      data: { id, is_active: newStatus },
      message: newStatus === 1 ? `تم تفعيل قسم (${existing.name}) بنجاح` : `تم تعطيل قسم (${existing.name}) بنجاح`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Move products from one category to another (Optionally delete the source category)
router.post('/:id/move-products', requireAuth, requirePermission('manage_categories'), async (req: AuthRequest, res: Response) => {
  try {
    const sourceId = Number(req.params.id);
    const { target_category_id, and_delete } = req.body;

    if (!target_category_id || Number(target_category_id) === sourceId) {
      return res.status(400).json({ success: false, error: 'يرجى اختيار قسم وجهة مختلف لنقل المنتجات إليه' });
    }

    const targetCategory = await queryOne('SELECT id, name FROM categories WHERE id = ?', [Number(target_category_id)]);
    if (!targetCategory) {
      return res.status(404).json({ success: false, error: 'القسم المستهدف لنقل المنتجات غير موجود' });
    }

    await transaction(async () => {
      // Move all products
      await execute(
        "UPDATE products SET category_id = ?, updated_at = datetime('now') WHERE category_id = ?",
        [Number(target_category_id), sourceId]
      );

      // If delete requested, safely delete empty source category
      if (and_delete) {
        await execute('DELETE FROM categories WHERE id = ?', [sourceId]);
      }
    });

    return res.json({
      success: true,
      message: `تم نقل المنتجات بنجاح إلى قسم (${targetCategory.name})${and_delete ? ' وحذف القسم السابق' : ''}`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Safe Delete Category
router.delete('/:id', requireAuth, requirePermission('manage_categories'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const category = await queryOne<Category>('SELECT id, name FROM categories WHERE id = ?', [id]);
    if (!category) {
      return res.status(404).json({ success: false, error: 'القسم غير موجود' });
    }

    const productCount = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
      [id]
    );

    const count = productCount?.count || 0;
    if (count > 0) {
      return res.status(400).json({
        success: false,
        error: 'لا يمكن حذف هذا القسم لأنه يحتوي على منتجات.',
        product_count: count,
        can_move_or_deactivate: true,
        category_id: id,
        category_name: category.name,
      });
    }

    await execute('DELETE FROM categories WHERE id = ?', [id]);
    return res.json({ success: true, message: `تم حذف قسم (${category.name}) بنجاح` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
