import { Router, Response, NextFunction } from 'express';
import { queryWithRetry } from '../config/neonDb';
import { ApiResponse } from '../utils/apiResponse';
import { authenticateCloudJWT, CloudAuthRequest, requireCloudScreen } from './cloudAuth.middleware';

const router = Router();
router.use(authenticateCloudJWT);

// GET /api/sales - List sales with pagination and filters
router.get('/', requireCloudScreen('Sales Report'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
    const offset = (page - 1) * limit;

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const saleType = req.query.saleType as string;

    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (startDate) {
      conditions.push(`created_at >= $${pIdx++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`created_at <= $${pIdx++}`);
      params.push(endDate);
    }
    if (saleType) {
      conditions.push(`sale_type = $${pIdx++}`);
      params.push(saleType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await queryWithRetry(`SELECT COUNT(*)::int AS total FROM sales ${whereClause}`, params);
    const total = countRes.rows[0].total;

    params.push(limit);
    const limitIdx = pIdx++;
    params.push(offset);
    const offsetIdx = pIdx++;

    const listRes = await queryWithRetry(`
      SELECT 
        s.id, s.local_id, s.device_id, s.sale_type, s.customer_name, s.customer_phone,
        s.total_amount::float, s.paid_amount::float, s.discount_amount::float,
        s.remaining_balance::float, s.status, s.token_number, s.created_at
      FROM sales s
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, params);

    return ApiResponse.success(res, 'Sales fetched', {
      sales: listRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/sales/:id - Sale details with items and payments
router.get('/:id', requireCloudScreen('Sales Report'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const saleId = req.params.id;
    // Support lookup by UUID or local_id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saleId);
    const whereField = isUuid ? 'id' : 'local_id';

    const saleRes = await queryWithRetry(`SELECT * FROM sales WHERE ${whereField} = $1`, [saleId]);
    if (saleRes.rows.length === 0) {
      return ApiResponse.error(res, 'Sale not found', 404);
    }

    const sale = saleRes.rows[0];
    const [itemsRes, paymentsRes] = await Promise.all([
      queryWithRetry('SELECT * FROM sale_items WHERE sale_uuid = $1 ORDER BY id ASC', [sale.id]),
      queryWithRetry('SELECT * FROM payments WHERE sale_uuid = $1 ORDER BY id ASC', [sale.id]),
    ]);

    sale.items = itemsRes.rows;
    sale.payments = paymentsRes.rows;

    return ApiResponse.success(res, 'Sale details fetched', sale, 200);
  } catch (err) {
    next(err);
  }
});

// Read-only block on mutations for web/cloud portal safety
router.post('/', (req, res) => {
  return ApiResponse.error(res, 'Remote sales creation is disabled in web viewing mode.', 403);
});

export default router;
