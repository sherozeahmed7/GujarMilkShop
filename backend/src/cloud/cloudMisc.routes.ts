import { Router, Response, NextFunction } from 'express';
import { queryWithRetry } from '../config/neonDb';
import { ApiResponse } from '../utils/apiResponse';
import { authenticateCloudJWT, CloudAuthRequest, requireCloudScreen } from './cloudAuth.middleware';

const router = Router();
router.use(authenticateCloudJWT);

// GET /api/expenses/summary
router.get('/expenses/summary', requireCloudScreen('Expenses'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;
    let query = 'SELECT * FROM expenses';
    const params: any[] = [];
    if (from && to) {
      query += ' WHERE date >= $1 AND date <= $2';
      params.push(from, to);
    }
    const result = await queryWithRetry(query, params);

    const rows = result.rows;
    const grossLoss = rows.reduce((s: number, r: any) => s + (Number(r.gross_loss || r.amount) || 0), 0);
    const netExpense = rows.reduce((s: number, r: any) => s + (Number(r.net_expense || r.amount) || 0), 0);
    const paid = rows.reduce((s: number, r: any) => s + (Number(r.paid_amount) || 0), 0);
    const remaining = rows.reduce((s: number, r: any) => s + (Number(r.remaining) || 0), 0);

    const personal = rows.filter((r: any) => r.expense_type === 'PERSONAL');
    const totalPersonalExpense = personal.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
    const totalCashReceived = personal.reduce((s: number, r: any) => s + (Number(r.paid_amount) || 0), 0);
    const personalRemaining = personal.reduce((s: number, r: any) => s + (Number(r.remaining) || 0), 0);

    return ApiResponse.success(res, 'Expense summary fetched', {
      stock: 0,
      avgCost: 0,
      grossLoss,
      netExpense,
      paid,
      remaining,
      totalPersonalExpense,
      totalCashReceived,
      remainingBalance: personalRemaining,
      personalCount: personal.length,
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/expenses/breakdown
router.get('/expenses/breakdown', requireCloudScreen('Expenses'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const typeParam = req.query.expenseType ? String(req.query.expenseType).toUpperCase() : undefined;
    const now = new Date();
    const yyyyMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let query = `
      SELECT category, COALESCE(SUM(amount), 0)::float AS amount
      FROM expenses
      WHERE date LIKE $1
    `;
    const params: any[] = [`${yyyyMM}%`];
    if (typeParam) {
      query += ` AND UPPER(expense_type) = $2`;
      params.push(typeParam);
    }
    query += ` GROUP BY category ORDER BY amount DESC`;

    let result = await queryWithRetry(query, params);
    
    // If no records in current month, fallback to all-time breakdown so chart is not empty
    if (result.rows.length === 0) {
      let fallbackQuery = `
        SELECT category, COALESCE(SUM(amount), 0)::float AS amount
        FROM expenses
      `;
      const fallbackParams: any[] = [];
      if (typeParam) {
        fallbackQuery += ` WHERE UPPER(expense_type) = $1`;
        fallbackParams.push(typeParam);
      }
      fallbackQuery += ` GROUP BY category ORDER BY amount DESC`;
      result = await queryWithRetry(fallbackQuery, fallbackParams);
    }

    const totalAmount = result.rows.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
    const rows = result.rows.map((r: any) => {
      const amount = Number(r.amount || 0);
      return {
        category: r.category || 'Other',
        amount,
        total: amount,
        percentage: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
      };
    });

    return ApiResponse.success(res, 'Expense breakdown fetched', rows, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/expense-customers
router.get('/expense-customers', requireCloudScreen('Expenses'), async (req: CloudAuthRequest, res: Response) => {
  return ApiResponse.success(res, 'Expense customers fetched', [], 200);
});

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
    const rows = result.rows.map((row: any) => ({
      id: String(row.local_id || row.id),
      date: row.date,
      category: row.category,
      description: row.description || '',
      quantity: Number(row.quantity || 0),
      unitCost: Number(row.unit_cost || 0),
      grossLoss: Number(row.gross_loss || row.amount || 0),
      soldRecovery: Number(row.sold_recovery || 0),
      netExpense: Number(row.net_expense || row.amount || 0),
      amount: Number(row.amount || 0),
      paidAmount: Number(row.paid_amount || 0),
      remaining: Number(row.remaining || 0),
      reason: row.reason || '',
      addedBy: row.added_by || 'Admin',
      expenseType: row.expense_type || 'SHOP',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
      payments: [],
    }));

    return ApiResponse.success(res, 'Expenses fetched', rows, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/shifts/:id/ledger
router.get('/shifts/:id/ledger', requireCloudScreen('Shifts'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id';

    const shiftRes = await queryWithRetry(`SELECT * FROM shifts WHERE ${whereField} = $1`, [id]);
    if (shiftRes.rows.length === 0) {
      return ApiResponse.error(res, 'Shift not found', 404);
    }
    const s = shiftRes.rows[0];

    return ApiResponse.success(res, 'Shift ledger fetched', {
      shift: {
        id: String(s.local_id || s.id),
        date: s.shift_date,
        openedAt: s.opened_at,
        closedAt: s.closed_at,
        openingCash: Number(s.opening_cash || 0),
        status: s.status,
      },
      items: [],
      totals: {
        cashIn: 0,
        cashOut: 0,
        netCash: 0,
      },
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/shifts
router.get('/shifts', requireCloudScreen('Shifts'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await queryWithRetry(`
      SELECT 
        s.*,
        u_open.name AS opened_by_name,
        u_close.name AS closed_by_name
      FROM shifts s
      LEFT JOIN users u_open ON s.opened_by_uuid = u_open.id
      LEFT JOIN users u_close ON s.closed_by_uuid = u_close.id
      ORDER BY s.opened_at DESC
      LIMIT 50
    `);

    const rows = result.rows.map((s: any) => ({
      id: String(s.local_id || s.id),
      date: s.shift_date,
      openedBy: s.opened_by_name || 'System',
      openedAt: s.opened_at ? new Date(s.opened_at).toISOString() : '',
      openingCash: Number(s.opening_cash || 0),
      openingNotes: s.opening_notes || '',
      closedBy: s.closed_by_name || null,
      closedAt: s.closed_at ? new Date(s.closed_at).toISOString() : null,
      expectedCash: Number(s.expected_cash || 0),
      countedCash: s.counted_cash !== null ? Number(s.counted_cash) : undefined,
      difference: s.difference !== null ? Number(s.difference) : undefined,
      differenceStatus: s.difference_status || undefined,
      closingNotes: s.closing_notes || '',
      status: s.status || 'Open',
      billsCount: 0,
      grossSales: 0,
      cashSales: 0,
      onlineSales: 0,
      khataSales: 0,
    }));

    return ApiResponse.success(res, 'Shifts fetched', rows, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/rates/standard-prices
router.get('/rates/standard-prices', requireCloudScreen('Daily Rates'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const rateRes = await queryWithRetry('SELECT * FROM daily_rates ORDER BY date DESC LIMIT 1');
    const r = rateRes.rows[0] || {};
    const milkRate = Number(r.milk_rate || 0);
    const yogurtRate = Number(r.yogurt_rate || 0);
    const lassiRate = Number(r.lassi_rate || 0);
    const butterRate = Number(r.butter_rate || 0);
    const gheeRate = Number(r.ghee_rate || 0);

    const milkWeights = [0.5, 0.75, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6];
    const milk = milkWeights.map((weight) => ({
      weight,
      label: `${weight} kg`,
      price: Math.round(weight * milkRate),
    }));

    const milkAmounts = [50, 100, 150, 200, 300, 400];
    const milkByAmount = milkAmounts.map((amount) => ({
      amount,
      label: `Rs. ${amount}`,
      weight: milkRate > 0 ? parseFloat((amount / milkRate).toFixed(2)) : 0,
    }));

    const yogurtWeights = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 3.5, 4.0];
    const yogurtByWeight = yogurtWeights.map((weight) => ({
      weight,
      label: `${weight} kg`,
      price: Math.round(weight * yogurtRate),
    }));

    const yogurtAmounts = [50, 100, 150, 200, 300, 400];
    const yogurtByAmount = yogurtAmounts.map((amount) => ({
      amount,
      label: `Rs. ${amount}`,
      weight: yogurtRate > 0 ? parseFloat((amount / yogurtRate).toFixed(2)) : 0,
    }));

    return ApiResponse.success(res, 'Standard prices fetched', {
      milkRatePerKg: milkRate,
      yogurtRatePerKg: yogurtRate,
      lassiRatePerKg: lassiRate,
      butterRatePerKg: butterRate,
      gheeRatePerKg: gheeRate,
      lastUpdated: r.date ? new Date(r.date).toISOString() : null,
      milk,
      milkByAmount,
      yogurtByWeight,
      yogurtByAmount,
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/rates
router.get('/rates', requireCloudScreen('Daily Rates'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await queryWithRetry('SELECT * FROM daily_rates ORDER BY date DESC LIMIT 50');
    const history = result.rows.map((row: any) => ({
      id: row.local_id || row.id,
      milkRate: Number(row.milk_rate || 0),
      yogurtRate: Number(row.yogurt_rate || 0),
      lassiRate: Number(row.lassi_rate || 0),
      butterRate: Number(row.butter_rate || 0),
      gheeRate: Number(row.ghee_rate || 0),
      updatedByRole: row.updated_by_role || 'Admin',
      date: row.date ? new Date(row.date).toISOString().split('T')[0] : '',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
    }));

    const latest = history[0] || {};
    return ApiResponse.success(res, 'Daily rates fetched', {
      history,
      currentMilkRate: latest.milkRate || 0,
      currentYogurtRate: latest.yogurtRate || 0,
      currentLassiRate: latest.lassiRate || 0,
      currentButterRate: latest.butterRate || 0,
      currentGheeRate: latest.gheeRate || 0,
      lastUpdated: latest.createdAt || null,
    }, 200);
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

// GET /api/returns/bill/:billNumber
router.get('/returns/bill/:billNumber', requireCloudScreen('Returns'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const billNumber = req.params.billNumber;
    const saleRes = await queryWithRetry('SELECT * FROM sales WHERE token_number = $1 OR local_id::text = $1 LIMIT 1', [billNumber]);
    if (saleRes.rows.length === 0) {
      return ApiResponse.error(res, 'Bill not found', 404);
    }
    const sale = saleRes.rows[0];
    const itemsRes = await queryWithRetry('SELECT * FROM sale_items WHERE sale_uuid = $1', [sale.id]);

    return ApiResponse.success(res, 'Bill fetched for return', {
      billNumber: sale.token_number || String(sale.local_id),
      date: sale.created_at,
      customer: sale.customer_name || 'Walk-in',
      totalAmount: Number(sale.total_amount),
      paidAmount: Number(sale.paid_amount),
      items: itemsRes.rows.map((i: any) => ({
        id: String(i.local_id || i.id),
        name: i.item_name,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unit_price),
        totalPrice: Number(i.total_price),
      })),
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/returns
router.get('/returns', requireCloudScreen('Returns'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await queryWithRetry('SELECT * FROM returns ORDER BY created_at DESC LIMIT 50');
    const rows = result.rows.map((r: any) => ({
      returnId: `RET-${String(r.local_id || r.id).padStart(4, '0')}`,
      billNumber: r.bill_number || '',
      date: r.date,
      customer: r.customer || 'Walk-in',
      returnType: r.return_type || 'Refund',
      refundAmount: Number(r.refund_amount || 0),
      paymentMethod: r.payment_method || 'Cash',
      reason: r.reason || '',
      status: r.status || 'completed',
      items: [],
      processedBy: r.processed_by || 'Admin',
    }));
    return ApiResponse.success(res, 'Returns fetched', rows, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/audits/bills
router.get('/audits/bills', requireCloudScreen('Receipt Audit'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const date = req.query.date as string || new Date().toISOString().split('T')[0];
    const result = await queryWithRetry(`
      SELECT local_id, token_number, created_at
      FROM sales
      WHERE created_at::date = $1::date
      ORDER BY created_at ASC
    `, [date]);

    const bills = result.rows.map((row: any) => ({
      billNumber: row.token_number ? String(row.token_number) : String(row.local_id),
      date,
    }));

    return ApiResponse.success(res, 'Bills fetched for audit', bills, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/audits
router.get('/audits', requireCloudScreen('Receipt Audit'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await queryWithRetry('SELECT * FROM audit_records ORDER BY audit_date DESC LIMIT 50');
    const rows = result.rows.map((r: any) => ({
      id: String(r.local_id || r.id),
      auditDate: r.audit_date,
      executedAt: r.executed_at ? new Date(r.executed_at).toISOString() : '',
      totalPosBills: Number(r.total_pos_bills || 0),
      collectedReceipts: Number(r.collected_receipts || 0),
      matched: r.matched || [],
      missing: r.missing || [],
      extra: r.extra || [],
      duplicates: r.duplicates || [],
      status: r.status || 'Matched',
      notes: r.notes || '',
      auditedBy: r.audited_by || 'Admin',
    }));
    return ApiResponse.success(res, 'Audit records fetched', rows, 200);
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
      SELECT id, local_id, email, name, role, status, assigned_screens AS "assignedScreens", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM users
      ORDER BY name ASC
    `);
    const users = result.rows.map((u: any) => ({
      id: String(u.local_id || u.id),
      name: u.name || 'User',
      email: u.email || '',
      role: u.role || 'cashier',
      assignedRole: u.role || 'cashier',
      assignedScreens: Array.isArray(u.assignedScreens) ? u.assignedScreens : (typeof u.assignedScreens === 'string' ? JSON.parse(u.assignedScreens || '[]') : []),
      status: u.status === 'active' || u.status === 'Active' ? 'Active' : 'Inactive',
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : '',
    }));
    return ApiResponse.success(res, 'Users fetched from Neon', users, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/users/roles
router.get('/users/roles', requireCloudScreen('Users & Roles'), async (req: CloudAuthRequest, res: Response) => {
  return ApiResponse.success(res, 'User roles fetched', ['super_admin', 'cashier', 'store cash'], 200);
});

// GET /api/pos-config
router.get('/pos-config', async (req: CloudAuthRequest, res: Response) => {
  return ApiResponse.success(res, 'POS Config fetched', {
    receiptHeader: 'Gujar Milk Shop',
    receiptFooter: 'Thank you for your business!',
    phone: '',
    address: '',
    taxRate: 0,
    printerType: 'none',
  }, 200);
});

// In-memory sync state for web cloud portal
let cloudSyncSettings = {
  syncEnabled: true,
  downstreamEnabled: true,
  lastSuccessfulSync: new Date().toISOString(),
  lastChecked: new Date().toISOString(),
};

// GET /api/sync/status
router.get('/sync/status', async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const [salesCount, custCount, supCount] = await Promise.all([
      queryWithRetry('SELECT count(*)::int as count FROM sales'),
      queryWithRetry('SELECT count(*)::int as count FROM customers'),
      queryWithRetry('SELECT count(*)::int as count FROM suppliers'),
    ]);

    cloudSyncSettings.lastChecked = new Date().toISOString();

    const payload = {
      cloudConnected: true,
      syncEnabled: cloudSyncSettings.syncEnabled,
      downstreamEnabled: cloudSyncSettings.downstreamEnabled,
      localSyncEnabled: cloudSyncSettings.syncEnabled,
      localDownstreamEnabled: cloudSyncSettings.downstreamEnabled,
      syncing: 0,
      pending: 0,
      failed: 0,
      deviceId: 'web-portal',
      lastChecked: cloudSyncSettings.lastChecked,
      lastSuccessfulSync: cloudSyncSettings.lastSuccessfulSync,
      connected: true,
      mode: 'cloud',
      syncedSales: salesCount.rows[0].count,
      syncedCustomers: custCount.rows[0].count,
      syncedSuppliers: supCount.rows[0].count,
      pendingQueue: 0,
      serverTime: new Date().toISOString(),
    };

    // Return payload both at root level (for desktop compatibility) and wrapped in data
    return res.status(200).json({
      status: 'success',
      message: 'Neon Sync mirror status',
      ...payload,
      data: payload,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/sync/queue
router.get('/sync/queue', async (req: CloudAuthRequest, res: Response) => {
  return res.status(200).json({
    status: 'success',
    message: 'Sync queue is clear in cloud mode',
    items: [],
    total: 0,
    data: { items: [], total: 0 },
  });
});

// POST /api/sync/toggle (handles reconnect and disconnect buttons)
router.post('/sync/toggle', async (req: CloudAuthRequest, res: Response) => {
  const { syncEnabled, downstreamEnabled } = req.body || {};
  if (typeof syncEnabled === 'boolean') {
    cloudSyncSettings.syncEnabled = syncEnabled;
  } else {
    cloudSyncSettings.syncEnabled = true;
  }
  if (typeof downstreamEnabled === 'boolean') {
    cloudSyncSettings.downstreamEnabled = downstreamEnabled;
  }
  cloudSyncSettings.lastChecked = new Date().toISOString();

  const payload = {
    success: true,
    syncEnabled: cloudSyncSettings.syncEnabled,
    downstreamEnabled: cloudSyncSettings.downstreamEnabled,
    cloudConnected: true,
  };

  return res.status(200).json({
    status: 'success',
    message: 'Cloud sync status updated',
    ...payload,
    data: payload,
  });
});

// POST /api/sync/trigger (handles sync now button)
router.post('/sync/trigger', async (req: CloudAuthRequest, res: Response) => {
  cloudSyncSettings.lastSuccessfulSync = new Date().toISOString();
  cloudSyncSettings.lastChecked = new Date().toISOString();
  return res.status(200).json({
    status: 'success',
    success: true,
    message: 'Neon cloud mirror is current and live',
    data: {
      success: true,
      message: 'Neon cloud mirror is current and live',
    },
  });
});

// POST /api/sync/check-connection (handles check connection button)
router.post('/sync/check-connection', async (req: CloudAuthRequest, res: Response) => {
  try {
    await queryWithRetry('SELECT 1');
    cloudSyncSettings.lastChecked = new Date().toISOString();
    return res.status(200).json({
      status: 'success',
      connected: true,
      cloudConnected: true,
      message: 'Neon connection healthy',
      data: { connected: true, cloudConnected: true },
    });
  } catch {
    return res.status(503).json({
      status: 'error',
      connected: false,
      cloudConnected: false,
      message: 'Failed to connect to Neon',
    });
  }
});

// POST /api/sync/retry-failed
router.post('/sync/retry-failed', async (req: CloudAuthRequest, res: Response) => {
  return res.status(200).json({
    status: 'success',
    message: 'No failed items in cloud mode',
    retried: 0,
    data: { retried: 0 },
  });
});

// POST /api/sync/auto-repair
router.post('/sync/auto-repair', async (req: CloudAuthRequest, res: Response) => {
  cloudSyncSettings.syncEnabled = true;
  cloudSyncSettings.lastChecked = new Date().toISOString();
  return res.status(200).json({
    status: 'success',
    success: true,
    message: 'Cloud sync is in healthy online state',
    data: {
      success: true,
      message: 'Cloud sync is in healthy online state',
    },
  });
});

// POST /api/sync/restore
router.post('/sync/restore', async (req: CloudAuthRequest, res: Response) => {
  try {
    const [salesCount, custCount, supCount, ratesCount] = await Promise.all([
      queryWithRetry('SELECT count(*)::int as count FROM sales'),
      queryWithRetry('SELECT count(*)::int as count FROM customers'),
      queryWithRetry('SELECT count(*)::int as count FROM suppliers'),
      queryWithRetry('SELECT count(*)::int as count FROM daily_rates'),
    ]);

    const restoredCounts: Record<string, number> = {
      Sales: salesCount.rows[0].count,
      Customers: custCount.rows[0].count,
      Suppliers: supCount.rows[0].count,
      DailyRates: ratesCount.rows[0].count,
    };

    const totalRestored = Object.values(restoredCounts).reduce((a, b) => a + b, 0);

    const payload = {
      success: true,
      message: `Direct cloud web mode is live and synchronized with Neon PostgreSQL (${totalRestored} total records verified).`,
      backupPath: 'Neon Cloud Database (ep-holy-waterfall)',
      totalRestored,
      restoredCounts,
    };

    return res.status(200).json({
      status: 'success',
      ...payload,
      data: payload,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      success: false,
      message: err.message || 'Failed to verify cloud restore data',
    });
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
