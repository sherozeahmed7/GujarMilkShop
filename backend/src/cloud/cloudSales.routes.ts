import { Router, Response, NextFunction } from 'express';
import { queryWithRetry } from '../config/neonDb';
import { ApiResponse } from '../utils/apiResponse';
import { authenticateCloudJWT, CloudAuthRequest, requireCloudScreen } from './cloudAuth.middleware';

const router = Router();
router.use(authenticateCloudJWT);

// GET /api/sales - List sales with pagination and filters OR return analytics report
router.get('/', requireCloudScreen('Sales Report'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const includeAnalytics = req.query.includeAnalytics === 'true' || String(req.query.includeAnalytics) === 'true';

    // Harmonize date query params: support both fromDate/toDate and startDate/endDate
    const startDate = (req.query.fromDate || req.query.startDate) as string;
    const endDate = (req.query.toDate || req.query.endDate) as string;
    const saleType = req.query.saleType as string;
    const customerId = req.query.customerId as string;

    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (startDate) {
      conditions.push(`s.created_at >= $${pIdx++}::timestamp`);
      params.push(startDate.includes('T') ? startDate : `${startDate} 00:00:00`);
    }
    if (endDate) {
      conditions.push(`s.created_at <= $${pIdx++}::timestamp`);
      params.push(endDate.includes('T') ? endDate : `${endDate} 23:59:59`);
    }
    if (saleType) {
      conditions.push(`s.sale_type = $${pIdx++}`);
      params.push(saleType);
    }
    if (customerId) {
      conditions.push(`(s.customer_uuid = $${pIdx} OR s.local_id::text = $${pIdx})`);
      pIdx++;
      params.push(customerId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    if (includeAnalytics) {
      // Fetch matching sales for report
      const reportRes = await queryWithRetry(`
        SELECT 
          s.id, s.local_id, s.device_id, s.sale_type, s.customer_name, s.customer_phone,
          s.total_amount::float, s.paid_amount::float, s.discount_amount::float,
          s.remaining_balance::float, s.status, s.token_number, s.created_at, s.updated_at,
          c.id AS cust_id, c.name AS cust_name, c.phone AS cust_phone
        FROM sales s
        LEFT JOIN customers c ON s.customer_uuid = c.id
        ${whereClause}
        ORDER BY s.created_at DESC
        LIMIT 500
      `, params);

      let netSales = 0;
      let cashSales = 0;
      let onlineSales = 0;
      let splitSales = 0;
      let totalDiscount = 0;
      const sales: any[] = [];

      for (const row of reportRes.rows) {
        const total = Number(row.total_amount || 0);
        const paid = Number(row.paid_amount || 0);
        const disc = Number(row.discount_amount || 0);

        netSales += total;
        totalDiscount += disc;

        if (row.sale_type === 'walk_in') {
          cashSales += paid;
        } else if (row.sale_type === 'online') {
          onlineSales += paid;
        } else if (row.sale_type === 'split') {
          splitSales += paid;
        } else {
          cashSales += paid;
        }

        sales.push({
          id: row.local_id || row.id,
          saleType: row.sale_type,
          customerId: row.cust_id ? (row.local_id || 1) : null,
          customerName: row.cust_name || row.customer_name || null,
          customerPhone: row.cust_phone || row.customer_phone || null,
          customer: row.cust_name ? { id: row.local_id || 1, name: row.cust_name, phone: row.cust_phone } : null,
          totalAmount: total,
          paidAmount: paid,
          discountAmount: disc,
          remainingBalance: Number(row.remaining_balance || 0),
          status: row.status,
          tokenNumber: row.token_number || undefined,
          createdById: null,
          createdByName: null,
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : '',
          items: [],
          payments: [],
        });
      }

      const totalBills = sales.length;

      return ApiResponse.success(res, 'Sales report with analytics fetched', {
        sales,
        analytics: {
          summary: {
            netSales,
            cashSales,
            onlineSales,
            splitSales,
            totalBills,
            totalDiscount,
          },
          trend: [],
          paymentMethods: [
            { name: 'Cash', amount: cashSales, value: cashSales },
            { name: 'Online', amount: onlineSales, value: onlineSales },
          ],
          categoryBreakdown: [],
          discountSales: [],
        },
      }, 200);
    }

    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
    const offset = (page - 1) * limit;

    const countRes = await queryWithRetry(`SELECT COUNT(*)::int AS total FROM sales s ${whereClause}`, params);
    const total = countRes.rows[0]?.total || 0;

    params.push(limit);
    const limitIdx = pIdx++;
    params.push(offset);
    const offsetIdx = pIdx++;

    const listRes = await queryWithRetry(`
      SELECT 
        s.id, s.local_id, s.device_id, s.sale_type, s.customer_name, s.customer_phone,
        s.total_amount::float, s.paid_amount::float, s.discount_amount::float,
        s.remaining_balance::float, s.status, s.token_number, s.created_at, s.updated_at
      FROM sales s
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, params);

    const formattedSales = listRes.rows.map((s: any) => ({
      id: s.local_id || s.id,
      saleType: s.sale_type,
      customerId: null,
      customerName: s.customer_name || null,
      customerPhone: s.customer_phone || null,
      totalAmount: Number(s.total_amount || 0),
      paidAmount: Number(s.paid_amount || 0),
      discountAmount: Number(s.discount_amount || 0),
      remainingBalance: Number(s.remaining_balance || 0),
      status: s.status,
      tokenNumber: s.token_number || undefined,
      createdAt: s.created_at ? new Date(s.created_at).toISOString() : '',
      updatedAt: s.updated_at ? new Date(s.updated_at).toISOString() : '',
    }));

    return ApiResponse.success(res, 'Sales fetched', {
      sales: formattedSales,
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
