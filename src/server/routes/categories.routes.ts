import { Router, Request, Response } from 'express';
import { query, queryOne, execute } from '../db/database.ts';
import { requireAuth, requirePermission, AuthRequest } from '../middleware/auth.ts';
import { Category } from '../../types/index.ts';

const router = Router();

// Public: Get all active categories
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

// Admin: Get all categories including inactive ones
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
    const { name, slug, description, image_url, sort_order } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ success: false, error: 'اسم التصنيف والرابط الدلالي (Slug) مطلوبان' });
    }

    // Check slug uniqueness
    const existing = await queryOne('SELECT id FROM categories WHERE slug = ?', [slug.trim().toLowerCase()]);
    if (existing) {
      return res.status(400).json({ success: false, error: 'الرابط الدلالي (Slug) مستخدم بالفعل' });
    }

    const result = await execute(
      `INSERT INTO categories (name, slug, description, image_url, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [
        name.trim(),
        slug.trim().toLowerCase(),
        description || null,
        image_url || null,
        sort_order !== undefined ? Number(sort_order) : 0,
      ]
    );

    const created = await queryOne<Category>('SELECT * FROM categories WHERE id = ?', [result.lastInsertRowid]);
    return res.status(201).json({ success: true, data: created, message: 'تم إنشاء التصنيف بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Update Category
router.put('/:id', requireAuth, requirePermission('manage_categories'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, slug, description, image_url, sort_order, is_active } = req.body;

    const existing = await queryOne<Category>('SELECT * FROM categories WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'التصنيف غير موجود' });
    }

    if (slug && slug !== existing.slug) {
      const duplicate = await queryOne('SELECT id FROM categories WHERE slug = ? AND id != ?', [slug.trim().toLowerCase(), id]);
      if (duplicate) {
        return res.status(400).json({ success: false, error: 'الرابط الدلالي (Slug) مستخدم بالفعل في تصنيف آخر' });
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
        slug ? slug.trim().toLowerCase() : null,
        description !== undefined ? description : null,
        image_url !== undefined ? image_url : null,
        sort_order !== undefined ? Number(sort_order) : null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        id,
      ]
    );

    const updated = await queryOne<Category>('SELECT * FROM categories WHERE id = ?', [id]);
    return res.json({ success: true, data: updated, message: 'تم تحديث التصنيف بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin/Manager: Delete Category (enforcing foreign key safety)
router.delete('/:id', requireAuth, requirePermission('manage_categories'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const productCount = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
      [id]
    );

    if (productCount && productCount.count > 0) {
      return res.status(400).json({
        success: false,
        error: `لا يمكن حذف هذا التصنيف لوجود (${productCount.count}) منتج مرتبط به. يرجى نقل أو حذف المنتجات أولاً.`,
      });
    }

    await execute('DELETE FROM categories WHERE id = ?', [id]);
    return res.json({ success: true, message: 'تم حذف التصنيف بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
