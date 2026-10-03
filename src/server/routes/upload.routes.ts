import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, requirePermission, AuthRequest } from '../middleware/auth.ts';

const router = Router();

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

// File filter validation
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('نوع الملف غير مدعوم، يرجى اختيار صورة بصيغة JPG أو PNG أو WEBP أو GIF'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter,
});

// Upload single image (for products or categories)
router.post(
  '/',
  requireAuth,
  requirePermission('manage_products'),
  (req: Request, res: Response) => {
    upload.single('image')(req, res, (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'حجم الصورة يتجاوز الحد المسموح به (5 ميجابايت)',
          });
        }
        return res.status(400).json({
          success: false,
          error: err.message || 'فشل في رفع الصورة',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'لم يتم اختيار أي ملف للرفع',
        });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      return res.json({
        success: true,
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
      });
    });
  }
);

export default router;
