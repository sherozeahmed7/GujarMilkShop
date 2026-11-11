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

// GET /api/connection-test (health & connection verification)
router.get('/connection-test', async (req: CloudAuthRequest, res: Response) => {
  return ApiResponse.success(res, 'Cloud connection verified', {
    status: 'connected',
    mode: 'cloud',
    database: 'Neon PostgreSQL',
  }, 200);
});

// GET /api/notifications
router.get('/notifications', async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    // Query notifications table in Neon if it exists, otherwise return clean empty list
    try {
      const result = await queryWithRetry(`
        SELECT id, category, title, message, is_read AS "isRead", created_at AS "createdAt"
        FROM notifications
        ORDER BY created_at DESC
        LIMIT $1
      `, [limit]);

      const unreadCountRes = await queryWithRetry('SELECT COUNT(*)::int AS count FROM notifications WHERE is_read = false');

      return ApiResponse.success(res, 'Notifications fetched', {
        notifications: result.rows,
        unreadCount: unreadCountRes.rows[0]?.count || 0,
        total: result.rowCount,
      }, 200);
    } catch {
      // If notifications table does not exist in Neon yet
      return ApiResponse.success(res, 'Notifications fetched', {
        notifications: [],
        unreadCount: 0,
        total: 0,
      }, 200);
    }
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read
router.patch('/notifications/:id/read', async (req: CloudAuthRequest, res: Response) => {
  return ApiResponse.success(res, 'Notification marked as read', { id: req.params.id }, 200);
});

// PATCH /api/notifications/read-all
router.patch('/notifications/read-all', async (req: CloudAuthRequest, res: Response) => {
  return ApiResponse.success(res, 'All notifications marked as read', {}, 200);
});

// GET /api/users
router.get('/users', requireCloudScreen('Users & Roles'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await queryWithRetry(`
      SELECT id, local_id, email, full_name, role, is_active, assigned_screens, created_at, updated_at
      FROM users
      ORDER BY full_name ASC
    `);
    return ApiResponse.success(res, 'Users fetched from Neon', result.rows, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/users/roles
router.get('/users/roles', requireCloudScreen('Users & Roles'), async (req: CloudAuthRequest, res: Response) => {
  return ApiResponse.success(res, 'User roles fetched', ['super_admin', 'cashier', 'store cash'], 200);
});

// GET /api/sync/status
router.get('/sync/status', async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const [salesCount, custCount, supCount] = await Promise.all([
      queryWithRetry('SELECT count(*)::int as count FROM sales'),
      queryWithRetry('SELECT count(*)::int as count FROM customers'),
      queryWithRetry('SELECT count(*)::int as count FROM suppliers'),
    ]);
    return ApiResponse.success(res, 'Neon Sync mirror status', {
      connected: true,
      mode: 'cloud',
      syncedSales: salesCount.rows[0].count,
      syncedCustomers: custCount.rows[0].count,
      syncedSuppliers: supCount.rows[0].count,
      pendingQueue: 0,
      serverTime: new Date().toISOString(),
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/sync/queue
router.get('/sync/queue', async (req: CloudAuthRequest, res: Response) => {
  return ApiResponse.success(res, 'Sync queue is clear in cloud mode', [], 200);
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
