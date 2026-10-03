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
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.avatar, u.is_active, u.created_at, u.updated_at,
              (SELECT COUNT(*) FROM orders o WHERE o.assigned_to = u.id) as assigned_orders_count,
              (SELECT COUNT(*) FROM orders o WHERE o.assigned_to = u.id AND o.status = 'DELIVERED') as completed_orders_count
       FROM users u 
       ORDER BY u.id ASC`
    );
    return res.json({ success: true, data: users });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET single employee profile with assigned orders and statistics - ADMIN ONLY
router.get('/:id', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const emp = await queryOne<User>(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.avatar, u.is_active, u.created_at, u.updated_at,
              (SELECT COUNT(*) FROM orders o WHERE o.assigned_to = u.id) as assigned_orders_count,
              (SELECT COUNT(*) FROM orders o WHERE o.assigned_to = u.id AND o.status = 'DELIVERED') as completed_orders_count
       FROM users u
       WHERE u.id = ?`,
      [id]
    );

    if (!emp) {
      return res.status(404).json({ success: false, error: 'الموظف غير موجود' });
    }

    // Get recent assigned orders
    const assignedOrders = await query<any>(
      `SELECT o.id, o.order_number, o.status, o.total, o.created_at, c.name as customer_name
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE o.assigned_to = ?
       ORDER BY o.id DESC
       LIMIT 20`,
      [id]
    );

    // Get recent activity by this employee
    const activity = await query<any>(
      `SELECT osh.id, osh.order_id, osh.old_status, osh.new_status, osh.note, osh.created_at, o.order_number
       FROM order_status_history osh
       JOIN orders o ON osh.order_id = o.id
       WHERE osh.changed_by = ?
       ORDER BY osh.id DESC
       LIMIT 10`,
      [id]
    );

    return res.json({
      success: true,
      data: {
        ...emp,
        assigned_orders: assignedOrders,
        recent_activity: activity,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET assignable workers list (Accessible by ADMIN & MANAGER for assignment)
router.get('/assignable-workers', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const workers = await query<Pick<User, 'id' | 'name' | 'role' | 'is_active'>>(
      "SELECT id, name, role, is_active FROM users WHERE role = 'WORKER' AND is_active = 1 ORDER BY name ASC"
    );
    return res.json({ success: true, data: workers });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// CREATE employee - ADMIN ONLY
router.post('/', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, phone, role, is_active = 1 } = req.body;

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
    const activeVal = is_active ? 1 : 0;

    const result = await execute(
      `INSERT INTO users (name, email, password_hash, phone, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), email.trim().toLowerCase(), password_hash, phone || null, role, activeVal]
    );

    const newId = result.lastInsertRowid;

    // Log administrative action
    await execute(
      `INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, metadata)
       VALUES (?, 'EMPLOYEE_CREATED', 'USER', ?, ?)`,
      [req.user!.id, newId, JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), role })]
    );

    const newUser = await queryOne<User>(
      'SELECT id, name, email, phone, role, avatar, is_active, created_at, updated_at FROM users WHERE id = ?',
      [newId]
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

    // Audit log
    await execute(
      `INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, metadata)
       VALUES (?, 'EMPLOYEE_UPDATED', 'USER', ?, ?)`,
      [req.user!.id, id, JSON.stringify({ role, is_active })]
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

// DELETE employee with historical protection - ADMIN ONLY
router.delete('/:id', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (req.user!.id === id) {
      return res.status(400).json({ success: false, error: 'لا يمكنك حذف حسابك الحالي' });
    }

    // Requirement 10: Do not delete employees who have historical orders
    const orderCount = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM orders WHERE assigned_to = ?',
      [id]
    );

    const historyCount = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM order_assignment_history WHERE previous_employee_id = ? OR new_employee_id = ?',
      [id, id]
    );

    const statusChangesCount = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM order_status_history WHERE changed_by = ?',
      [id]
    );

    const totalLinked = (orderCount?.count || 0) + (historyCount?.count || 0) + (statusChangesCount?.count || 0);

    if (totalLinked > 0) {
      return res.status(400).json({
        success: false,
        error: `لا يمكن حذف هذا الموظف لوجود ${totalLinked} سجلات تاريخية أو طلبات مرتبطة به. يرجى تعطيل حسابه بدلاً من الحذف للحفاظ على سلامة البيانات.`,
      });
    }

    await execute('DELETE FROM users WHERE id = ?', [id]);

    await execute(
      `INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, metadata)
       VALUES (?, 'EMPLOYEE_DELETED', 'USER', ?, ?)`,
      [req.user!.id, id, JSON.stringify({ employee_id: id })]
    );

    return res.json({ success: true, message: 'تم حذف الموظف بنجاح لعدم وجود طلبات تاريخية مرتبطة به' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
