import { Router, Response, NextFunction } from 'express';
import { queryWithRetry } from '../config/neonDb';
import { ApiResponse } from '../utils/apiResponse';
import { authenticateCloudJWT, CloudAuthRequest, requireCloudScreen } from './cloudAuth.middleware';

const router = Router();
router.use(authenticateCloudJWT);

// GET /api/inventory/products
router.get('/products', requireCloudScreen('Inventory'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const productsRes = await queryWithRetry('SELECT * FROM inventory_products ORDER BY name ASC');
    return ApiResponse.success(res, 'Inventory products fetched', productsRes.rows, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/movements
router.get('/movements', requireCloudScreen('Inventory'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string || '50', 10)));
    const movementsRes = await queryWithRetry(`
      SELECT m.*, p.name as product_name, p.code as product_code
      FROM inventory_movements m
      LEFT JOIN inventory_products p ON m.product_uuid = p.id
      ORDER BY m.date DESC
      LIMIT $1
    `, [limit]);

    return ApiResponse.success(res, 'Inventory movements fetched', movementsRes.rows, 200);
  } catch (err) {
    next(err);
  }
});

// Fallback for /api/inventory
router.get('/', requireCloudScreen('Inventory'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const productsRes = await queryWithRetry('SELECT * FROM inventory_products ORDER BY name ASC');
    return ApiResponse.success(res, 'Inventory fetched', productsRes.rows, 200);
  } catch (err) {
    next(err);
  }
});

export default router;
