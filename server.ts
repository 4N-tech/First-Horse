import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDb } from './src/server/db/database.ts';

// Route imports
import authRoutes from './src/server/routes/auth.routes.ts';
import categoriesRoutes from './src/server/routes/categories.routes.ts';
import productsRoutes from './src/server/routes/products.routes.ts';
import ordersRoutes from './src/server/routes/orders.routes.ts';
import usersRoutes from './src/server/routes/users.routes.ts';
import customersRoutes from './src/server/routes/customers.routes.ts';
import dashboardRoutes from './src/server/routes/dashboard.routes.ts';
import uploadRoutes from './src/server/routes/upload.routes.ts';
import inventoryRoutes from './src/server/routes/inventory.routes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Body and cookie parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Ensure uploads directory exists and is served statically
  const uploadsDir = path.resolve(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Initialize SQLite database
  await getDb();
  console.log('Database initialized successfully.');

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/categories', categoriesRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/admin/employees', usersRoutes);
  app.use('/api/admin/customers', customersRoutes);
  app.use('/api/admin/dashboard', dashboardRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/admin/inventory', inventoryRoutes);
  app.use('/api/upload', uploadRoutes);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      app: 'First Horse Factory Web App',
      phase: 2,
      timestamp: new Date().toISOString(),
    });
  });

  // Vite middleware in dev or static files in production
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({
      success: false,
      error: 'حدث خطأ داخلي في الخادم',
      details: isProd ? undefined : err.message,
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
