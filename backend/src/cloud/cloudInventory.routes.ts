import { Router, Response, NextFunction } from 'express';
import { queryWithRetry } from '../config/neonDb';
import { ApiResponse } from '../utils/apiResponse';
import { authenticateCloudJWT, CloudAuthRequest, requireCloudScreen } from './cloudAuth.middleware';

const router = Router();
router.use(authenticateCloudJWT);

// GET /api/inventory/summary
router.get('/summary', requireCloudScreen('Inventory'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const productsRes = await queryWithRetry('SELECT * FROM inventory_products WHERE is_active = true ORDER BY name ASC');
    const products = productsRes.rows;

    // Compute current stock per product from movements
    const stockRes = await queryWithRetry(`
      SELECT product_uuid, COALESCE(SUM(quantity), 0)::float AS stock
      FROM inventory_movements
      GROUP BY product_uuid
    `);
    const stockMap: Record<string, number> = {};
    for (const row of stockRes.rows) {
      stockMap[row.product_uuid] = Number(row.stock);
    }

    let totalProducts = products.length;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const p of products) {
      const stock = stockMap[p.id] || 0;
      const threshold = Number(p.low_stock_threshold) || 0;
      if (stock <= 0) outOfStockCount++;
      else if (threshold > 0 && stock <= threshold) lowStockCount++;
    }

    return ApiResponse.success(res, 'Inventory summary fetched', {
      totalProducts,
      stockValue: 0,
      lowStockCount,
      outOfStockCount,
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/stock-in
router.get('/stock-in', requireCloudScreen('Inventory'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const productId = req.query.productId as string;
    let query = `
      SELECT
        m.id, m.local_id, m.quantity, m.unit_cost, m.reference, m.source, m.date, m.created_at,
        p.id AS product_id, p.name AS product_name, p.code AS product_code, p.unit,
        s.name AS supplier_name
      FROM inventory_movements m
      LEFT JOIN inventory_products p ON m.product_uuid = p.id
      LEFT JOIN suppliers s ON m.supplier_uuid = s.id
      WHERE m.movement_type = 'STOCK_IN'
    `;
    const params: any[] = [];
    if (productId) {
      query += ` AND m.product_uuid = $1`;
      params.push(productId);
    }
    query += ` ORDER BY m.date DESC LIMIT 100`;

    const result = await queryWithRetry(query, params);

    const rows = result.rows.map((row: any) => ({
      id: row.id,
      date: new Date(row.date).toISOString(),
      reference: row.reference || '',
      productId: row.product_id,
      quantity: Number(row.quantity),
      unitCost: Number(row.unit_cost || 0),
      totalCost: Number(row.quantity || 0) * Number(row.unit_cost || 0),
      supplier: row.supplier_name || row.source || 'Unknown',
      addedBy: 'System',
    }));

    return ApiResponse.success(res, 'Stock-in records fetched', rows, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/pricing
router.get('/pricing', requireCloudScreen('Inventory'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const name = (req.query.name as string || '').trim();
    if (!name) return ApiResponse.error(res, 'Product name is required', 400);

    const rateRes = await queryWithRetry('SELECT * FROM daily_rates ORDER BY date DESC LIMIT 1');
    const rate = rateRes.rows[0] || {};

    const lname = name.toLowerCase();
    let sellingPrice = 0;
    if (lname.includes('milk')) sellingPrice = Number(rate.milk_rate || 0);
    else if (lname.includes('yogurt') || lname.includes('dahi')) sellingPrice = Number(rate.yogurt_rate || rate.milk_rate || 0);
    else if (lname.includes('lassi')) sellingPrice = Number(rate.lassi_rate || 0);
    else if (lname.includes('butter')) sellingPrice = Number(rate.butter_rate || 0);
    else if (lname.includes('ghee')) sellingPrice = Number(rate.ghee_rate || 0);

    const costRes = await queryWithRetry(`
      SELECT AVG(rate)::float AS avg_rate
      FROM supplier_collections
      WHERE quantity > 0 AND rate > 0
    `);
    const averageCost = Number(costRes.rows[0]?.avg_rate || 0);

    return ApiResponse.success(res, 'Inventory pricing fetched', { sellingPrice, averageCost }, 200);
  } catch (err) {
    next(err);
  }
});

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
