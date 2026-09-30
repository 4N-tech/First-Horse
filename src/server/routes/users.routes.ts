import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, execute } from '../db/database.ts';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.ts';
import { User } from '../../types/index.ts';

const router = Router();

// GET all employees - ADMIN ONLY
router.get('/', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const users = await query<Omit<User, 'password_hash'>>(
      'SELECT id, name, email, phone, role, avatar, is_active, created_at, updated_at FROM users ORDER BY id ASC'
    );
    return res.json({ success: true, data: users });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET assignable workers list (Accessible by ADMIN & MANAGER for assignment)
router.get('/assignable-workers', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const workers = await query<Pick<User, 'id' | 'name' | 'role'>>(
      "SELECT id, name, role FROM users WHERE role = 'WORKER' AND is_active = 1 ORDER BY name ASC"
    );
    return res.json({ success: true, data: workers });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// CREATE employee - ADMIN ONLY
router.post('/', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, error: 'الاسم والبريد الإلكتروني وكلمة المرور والرتبة مطلوبة' });
    }

    if (!['ADMIN', 'MANAGER', 'WORKER'].includes(role)) {
      return res.status(400).json({ success: false, error: 'الرتبة المحددة غير صحيحة' });
    }

    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing) {
      return res.status(400).json({ success: false, error: 'البريد الإلكتروني مسجل بالفعل لموظف آخر' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await execute(
      `INSERT INTO users (name, email, password_hash, phone, role, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [name.trim(), email.trim().toLowerCase(), password_hash, phone || null, role]
    );

    const newUser = await queryOne<User>(
      'SELECT id, name, email, phone, role, avatar, is_active, created_at, updated_at FROM users WHERE id = ?',
      [result.lastInsertRowid]
    );

    return res.status(201).json({ success: true, data: newUser, message: 'تم إضافة الموظف بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// UPDATE employee status/role - ADMIN ONLY
router.put('/:id', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, phone, role, is_active, password } = req.body;

    const existing = await queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'الموظف غير موجود' });
    }

    // Prevent deactivating own account
    if (req.user!.id === id && is_active === false) {
      return res.status(400).json({ success: false, error: 'لا يمكنك تعطيل حسابك الحالي' });
    }

    let passwordHashUpdate = null;
    if (password && password.trim()) {
      passwordHashUpdate = await bcrypt.hash(password.trim(), 10);
    }

    await execute(
      `UPDATE users SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        role = COALESCE(?, role),
        is_active = COALESCE(?, is_active),
        password_hash = COALESCE(?, password_hash),
        updated_at = datetime('now')
       WHERE id = ?`,
      [
        name ? name.trim() : null,
        phone !== undefined ? phone : null,
        role || null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        passwordHashUpdate,
        id,
      ]
    );

    const updated = await queryOne<User>(
      'SELECT id, name, email, phone, role, avatar, is_active, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    return res.json({ success: true, data: updated, message: 'تم تحديث بيانات الموظف بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
