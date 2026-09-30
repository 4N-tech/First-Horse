import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.ts';
import { requireAuth, requirePermission, AuthRequest } from '../middleware/auth.ts';
import { Customer, CustomerAddress } from '../../types/index.ts';

const router = Router();

// GET all customers with orders count - ADMIN & MANAGER
router.get('/', requireAuth, requirePermission('manage_customers'), async (req: AuthRequest, res: Response) => {
  try {
    const customers = await query<Customer>(
      `SELECT c.*, COUNT(o.id) as orders_count 
       FROM customers c 
       LEFT JOIN orders o ON c.id = o.customer_id 
       GROUP BY c.id 
       ORDER BY c.id DESC`
    );
    return res.json({ success: true, data: customers });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET single customer with addresses
router.get('/:id', requireAuth, requirePermission('manage_customers'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const customer = await queryOne<Customer>('SELECT * FROM customers WHERE id = ?', [id]);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'العميل غير موجود' });
    }

    const addresses = await query<CustomerAddress>('SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY id DESC', [id]);
    return res.json({ success: true, data: { ...customer, addresses } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Create Customer
router.post('/', requireAuth, requirePermission('manage_customers'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, governorate, city, address, notes } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'اسم العميل ورقم الهاتف مطلوبان' });
    }

    const custResult = await execute('INSERT INTO customers (name, phone) VALUES (?, ?)', [name.trim(), phone.trim()]);
    const customerId = custResult.lastInsertRowid;

    if (governorate && city && address) {
      await execute(
        'INSERT INTO customer_addresses (customer_id, governorate, city, address, notes) VALUES (?, ?, ?, ?, ?)',
        [customerId, governorate.trim(), city.trim(), address.trim(), notes || null]
      );
    }

    const customer = await queryOne<Customer>('SELECT * FROM customers WHERE id = ?', [customerId]);
    return res.status(201).json({ success: true, data: customer, message: 'تم إضافة العميل بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
