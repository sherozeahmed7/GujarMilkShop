import { Router, Response, NextFunction } from 'express';
import { queryWithRetry } from '../config/neonDb';
import { ApiResponse } from '../utils/apiResponse';
import { authenticateCloudJWT, CloudAuthRequest, requireCloudScreen } from './cloudAuth.middleware';

const router = Router();
router.use(authenticateCloudJWT);

// GET /api/expenses
router.get('/', requireCloudScreen('Expenses'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;

    let query = 'SELECT * FROM expenses';
    const params: any[] = [];
    if (from && to) {
      query += ' WHERE date >= $1 AND date <= $2';
      params.push(from, to);
    }
    query += ' ORDER BY date DESC';

    const result = await queryWithRetry(query, params);
    return ApiResponse.success(res, 'Expenses fetched', result.rows, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/shifts
router.get('/shifts', requireCloudScreen('Shifts'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await queryWithRetry('SELECT * FROM shifts ORDER BY opened_at DESC LIMIT 50');
    return ApiResponse.success(res, 'Shifts fetched', result.rows, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/rates
router.get('/rates', requireCloudScreen('Daily Rates'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await queryWithRetry('SELECT * FROM daily_rates ORDER BY date DESC LIMIT 10');
    return ApiResponse.success(res, 'Daily rates fetched', result.rows, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/activity-logs
router.get('/activity-logs', requireCloudScreen('Activity Logs'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await queryWithRetry('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100');
    return ApiResponse.success(res, 'Activity logs fetched', result.rows, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/returns
router.get('/returns', requireCloudScreen('Returns'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await queryWithRetry('SELECT * FROM returns ORDER BY created_at DESC LIMIT 50');
    return ApiResponse.success(res, 'Returns fetched', result.rows, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/sync/status
router.get('/sync-status', async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const [salesCount, custCount, supCount] = await Promise.all([
      queryWithRetry('SELECT count(*)::int as count FROM sales'),
      queryWithRetry('SELECT count(*)::int as count FROM customers'),
      queryWithRetry('SELECT count(*)::int as count FROM suppliers'),
    ]);
    return ApiResponse.success(res, 'Neon Sync mirror status', {
      connected: true,
      syncedSales: salesCount.rows[0].count,
      syncedCustomers: custCount.rows[0].count,
      syncedSuppliers: supCount.rows[0].count,
      serverTime: new Date().toISOString(),
    }, 200);
  } catch (err) {
    next(err);
  }
});

export default router;
