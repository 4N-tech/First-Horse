import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../db/database.ts';
import { generateToken, requireAuth, AuthRequest } from '../middleware/auth.ts';
import { User } from '../../types/index.ts';

const router = Router();

// Staff Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'البريد الإلكتروني وكلمة المرور مطلوبان',
      });
    }

    const userWithHash = await queryOne<User & { password_hash: string }>(
      'SELECT id, name, email, password_hash, phone, role, avatar, is_active, created_at, updated_at FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (!userWithHash || !userWithHash.password_hash) {
      return res.status(401).json({
        success: false,
        error: 'بيانات الدخول غير صحيحة، يرجى التأكد من البريد الإلكتروني وكلمة المرور',
      });
    }

    if (userWithHash.is_active !== 1) {
      return res.status(403).json({
        success: false,
        error: 'هذا الحساب تم تعطيله، يرجى مراجعة إدارة المصنع',
      });
    }

    const isMatch = await bcrypt.compare(password, userWithHash.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'بيانات الدخول غير صحيحة، يرجى التأكد من البريد الإلكتروني وكلمة المرور',
      });
    }

    // Never return password_hash to the client
    const { password_hash, ...safeUser } = userWithHash;
    const token = generateToken(safeUser as User);

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    return res.json({
      success: true,
      user: safeUser,
      token,
      message: 'تم تسجيل الدخول بنجاح',
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'حدث خطأ غير متوقع أثناء تسجيل الدخول',
    });
  }
});

// Current User profile
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  return res.json({
    success: true,
    user: req.user,
  });
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('auth_token');
  return res.json({
    success: true,
    message: 'تم تسجيل الخروج بنجاح',
  });
});

// Demo accounts endpoint for testing
router.get('/demo-accounts', async (req: Request, res: Response) => {
  try {
    const demoUsers = await query<Omit<User, 'password_hash'>>(
      'SELECT id, name, email, phone, role, avatar, is_active FROM users WHERE is_active = 1 ORDER BY id ASC'
    );
    return res.json({
      success: true,
      demoUsers: demoUsers.map((u) => ({
        ...u,
        defaultPassword: u.role.toLowerCase() + '123',
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
