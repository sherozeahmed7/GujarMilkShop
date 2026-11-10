import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { queryWithRetry } from '../config/neonDb';
import cloudAuthRoutes from './cloudAuth.routes';
import cloudDashboardRoutes from './cloudDashboard.routes';
import cloudSalesRoutes from './cloudSales.routes';
import cloudCustomersRoutes from './cloudCustomers.routes';
import cloudSuppliersRoutes from './cloudSuppliers.routes';
import cloudInventoryRoutes from './cloudInventory.routes';
import cloudReportsRoutes from './cloudReports.routes';
import cloudMiscRoutes from './cloudMisc.routes';
import { errorHandler } from '../middleware/errorHandler';

export function createCloudApp(): Application {
  const app: Application = express();

  app.set('etag', false);

  // Security headers with Helmet
  app.use(helmet({
    contentSecurityPolicy: false, // API only
    crossOriginEmbedderPolicy: false,
  }));

  // CORS whitelist
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : ['*'];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
  }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Safe health check (no secrets, no paths)
  app.get('/health', async (req: Request, res: Response) => {
    let neonConnected = false;
    try {
      await queryWithRetry('SELECT 1');
      neonConnected = true;
    } catch {
      neonConnected = false;
    }

    res.status(neonConnected ? 200 : 503).json({
      status: neonConnected ? 'healthy' : 'degraded',
      mode: 'cloud',
      neonConnected,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // /api/health compatibility
  app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'success', message: 'Cloud API is running', mode: 'cloud' });
  });

  // Mount Cloud Routes
  app.use('/api/auth', cloudAuthRoutes);
  app.use('/api/dashboard', cloudDashboardRoutes);
  app.use('/api/sales', cloudSalesRoutes);
  app.use('/api/customers', cloudCustomersRoutes);
  app.use('/api/suppliers', cloudSuppliersRoutes);
  app.use('/api/inventory', cloudInventoryRoutes);
  app.use('/api/reports', cloudReportsRoutes);
  app.use('/api/expenses', cloudMiscRoutes);
  app.use('/api', cloudMiscRoutes);

  // Error handling
  app.use(errorHandler);

  return app;
}
