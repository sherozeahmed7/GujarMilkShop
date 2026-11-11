import { Router, Response, NextFunction } from 'express';
import { queryWithRetry } from '../config/neonDb';
import { ApiResponse } from '../utils/apiResponse';
import { authenticateCloudJWT, CloudAuthRequest, requireCloudScreen } from './cloudAuth.middleware';

const router = Router();
router.use(authenticateCloudJWT);

// GET /api/suppliers/next-code
router.get('/next-code', requireCloudScreen('Suppliers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await queryWithRetry('SELECT code FROM suppliers WHERE code ILIKE \'SUP-%\'');
    let maxNum = 0;
    for (const row of result.rows) {
      const match = String(row.code).trim().match(/^SUP-(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    }
    const candidate = `SUP-${String(maxNum + 1).padStart(4, '0')}`;
    return ApiResponse.success(res, 'Next supplier code generated', candidate, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/suppliers
router.get('/', requireCloudScreen('Suppliers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    const cycleType = req.query.cycleType as string;
    const isActive = req.query.isActive;

    let query = `
      SELECT 
        s.id, s.local_id, s.name, s.code, s.phone,
        s.default_rate, s.cow_rate, s.buffalo_rate, s.cycle_type,
        s.is_active, s.guaranteed_advance, s.created_at, s.updated_at,
        COALESCE(SUM(sc.amount), 0)::float AS total_purchased,
        COALESCE(SUM(sp.amount), 0)::float AS total_paid
      FROM suppliers s
      LEFT JOIN supplier_collections sc ON s.id = sc.supplier_uuid
      LEFT JOIN supplier_payments sp ON s.id = sp.supplier_uuid
    `;
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (search) {
      conditions.push(`(LOWER(s.name) LIKE $${pIdx} OR LOWER(s.code) LIKE $${pIdx})`);
      params.push(`%${search.toLowerCase()}%`);
      pIdx++;
    }
    if (cycleType && cycleType !== 'All') {
      conditions.push(`s.cycle_type = $${pIdx++}`);
      params.push(cycleType);
    }
    if (isActive !== undefined && isActive !== '') {
      conditions.push(`s.is_active = $${pIdx++}`);
      params.push(String(isActive) === 'true');
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += `
      GROUP BY s.id, s.local_id, s.name, s.code, s.phone,
               s.default_rate, s.cow_rate, s.buffalo_rate, s.cycle_type,
               s.is_active, s.guaranteed_advance, s.created_at, s.updated_at
      ORDER BY s.name ASC
    `;

    const result = await queryWithRetry(query, params);
    const shaped = result.rows.map((row: any) => {
      const purchased = Number(row.total_purchased || 0);
      const paid = Number(row.total_paid || 0);
      const advance = Number(row.guaranteed_advance || 0);
      const remainingBalance = Math.round((purchased - paid - advance) * 100) / 100;

      return {
        id: String(row.local_id || row.id),
        name: row.name,
        code: row.code,
        phone: row.phone || '',
        defaultRate: Number(row.default_rate || 0),
        cowRate: Number(row.cow_rate || 0),
        buffaloRate: Number(row.buffalo_rate || 0),
        cycleType: row.cycle_type || 'Monthly Cycle',
        isActive: Boolean(row.is_active),
        guaranteedAdvance: advance,
        openingBalance: 0,
        grossPayable: Math.round((purchased - paid) * 100) / 100,
        currentAmount: purchased,
        previousAmount: 0,
        totalAmount: purchased,
        paidAmount: paid,
        remainingBalance,
        payableBalance: remainingBalance,
        nextCycleCredit: advance,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : '',
      };
    });

    return ApiResponse.success(res, 'Suppliers fetched from Neon', shaped, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/suppliers/:id/entries
router.get('/:id/entries', requireCloudScreen('Suppliers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id';

    const supRes = await queryWithRetry(`SELECT * FROM suppliers WHERE ${whereField} = $1`, [id]);
    if (supRes.rows.length === 0) {
      return ApiResponse.error(res, 'Supplier not found', 404);
    }
    const supplier = supRes.rows[0];

    const [collectionsRes, paymentsRes] = await Promise.all([
      queryWithRetry('SELECT * FROM supplier_collections WHERE supplier_uuid = $1 ORDER BY date DESC', [supplier.id]),
      queryWithRetry(`
        SELECT sp.*, s.shift_date AS "shiftDate", s.status AS "shiftStatus"
        FROM supplier_payments sp
        LEFT JOIN shifts s ON sp.shift_uuid = s.id
        WHERE sp.supplier_uuid = $1
        ORDER BY sp.date DESC
      `, [supplier.id]),
    ]);

    return ApiResponse.success(res, 'Supplier entries fetched', {
      collections: collectionsRes.rows,
      payments: paymentsRes.rows,
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/suppliers/:id
router.get('/:id', requireCloudScreen('Suppliers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id';

    const supRes = await queryWithRetry(`SELECT * FROM suppliers WHERE ${whereField} = $1`, [id]);
    if (supRes.rows.length === 0) {
      return ApiResponse.error(res, 'Supplier not found', 404);
    }
    const supplier = supRes.rows[0];

    const [collectionsRes, paymentsRes] = await Promise.all([
      queryWithRetry('SELECT * FROM supplier_collections WHERE supplier_uuid = $1 ORDER BY date DESC LIMIT 50', [supplier.id]),
      queryWithRetry('SELECT * FROM supplier_payments WHERE supplier_uuid = $1 ORDER BY date DESC LIMIT 50', [supplier.id]),
    ]);

    supplier.recentCollections = collectionsRes.rows;
    supplier.recentPayments = paymentsRes.rows;

    return ApiResponse.success(res, 'Supplier fetched', supplier, 200);
  } catch (err) {
    next(err);
  }
});

export default router;
