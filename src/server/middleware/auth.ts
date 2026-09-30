import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/database.ts';
import { User, UserRole, Permission, ROLE_PERMISSIONS } from '../../types/index.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'nassij-factory-secret-key-phase1-2026';

export interface AuthRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.cookies?.auth_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'غير مصرح: يرجى تسجيل الدخول أولاً',
        code: 'UNAUTHORIZED',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string; role: UserRole };
    const user = await queryOne<User>(
      'SELECT id, name, email, phone, role, avatar, is_active, created_at, updated_at FROM users WHERE id = ? AND is_active = 1',
      [decoded.id]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'الحساب غير موجود أو تم تعطيله',
        code: 'ACCOUNT_INACTIVE',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'جلسة تسجيل الدخول منتهية أو غير صالحة',
      code: 'INVALID_TOKEN',
    });
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'يرجى تسجيل الدخول أولاً',
        code: 'UNAUTHORIZED',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `غير مصرح: هذه العملية تتطلب صلاحية (${allowedRoles.join(' أو ')})، بينما صلاحيتك الحالية هي (${req.user.role})`,
        code: 'FORBIDDEN_ROLE',
      });
    }

    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'يرجى تسجيل الدخول أولاً',
        code: 'UNAUTHORIZED',
      });
    }

    const userPermissions = ROLE_PERMISSIONS[req.user.role] || [];
    if (!userPermissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: `غير مصرح لك بتنفيذ هذه العملية (${permission})`,
        code: 'FORBIDDEN_PERMISSION',
      });
    }

    next();
  };
}
