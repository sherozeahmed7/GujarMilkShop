import { Router, Response, NextFunction } from 'express';
import { queryWithRetry } from '../config/neonDb';
import { ApiResponse } from '../utils/apiResponse';
import { authenticateCloudJWT, CloudAuthRequest, requireCloudScreen } from './cloudAuth.middleware';

const router = Router();
router.use(authenticateCloudJWT);

// GET /api/suppliers
router.get('/', requireCloudScreen('Suppliers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    let query = 'SELECT * FROM suppliers';
    const params: any[] = [];
    if (search) {
      query += ' WHERE LOWER(name) LIKE $1 OR LOWER(code) LIKE $1';
      params.push(`%${search.toLowerCase()}%`);
    }
    query += ' ORDER BY name ASC';

    const result = await queryWithRetry(query, params);
    return ApiResponse.success(res, 'Suppliers fetched from Neon', result.rows, 200);
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
