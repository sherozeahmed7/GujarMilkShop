import { Router, Response, NextFunction } from 'express';
import { queryWithRetry } from '../config/neonDb';
import { ApiResponse } from '../utils/apiResponse';
import { authenticateCloudJWT, CloudAuthRequest, requireCloudScreen } from './cloudAuth.middleware';
import crypto from 'crypto';

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
    const name = (req.query.name as string || 'milk').trim();
    const rateRes = await queryWithRetry('SELECT * FROM daily_rates ORDER BY date DESC LIMIT 1');
    const rate = rateRes.rows[0] || {};

    const lname = name.toLowerCase();
    let sellingPrice = Number(rate.milk_rate || 0);
    if (lname.includes('yogurt') || lname.includes('dahi')) sellingPrice = Number(rate.yogurt_rate || rate.milk_rate || 0);
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
    const rows = productsRes.rows.map((p: any) => ({
      id: String(p.local_id || p.id),
      code: p.code,
      name: p.name,
      description: p.description || '',
      category: p.category || 'General',
      unit: p.unit || 'kg',
      stock: 0,
      sellPrice: 0,
      cost: 0,
      lowStockThreshold: Number(p.low_stock_threshold || 10),
      status: p.is_active ? 'In Stock' : 'Out of Stock',
      isLocked: Boolean(p.is_locked),
    }));
    return ApiResponse.success(res, 'Inventory products fetched', rows, 200);
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

// POST /api/inventory/movements (Stock Adjustment)
router.post('/movements', requireCloudScreen('Inventory'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const { productId, quantity, movementType, source, reference } = req.body;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(productId));
    const whereField = isUuid ? 'id' : 'local_id::text';

    const prodRes = await queryWithRetry(`SELECT id FROM inventory_products WHERE ${whereField} = $1`, [String(productId)]);
    const prodUuid = prodRes.rows[0]?.id || null;
    const cloudUuid = crypto.randomUUID();

    const maxIdRes = await queryWithRetry('SELECT COALESCE(MAX(local_id), 0) + 1 AS next_id FROM inventory_movements');
    const nextLocalId = maxIdRes.rows[0]?.next_id || 1;

    await queryWithRetry(`
      INSERT INTO inventory_movements (id, local_id, device_id, product_uuid, quantity, movement_type, source, reference, date, created_at, updated_at)
      VALUES ($1, $2, 'web-portal', $3, $4, $5, $6, $7, NOW(), NOW(), NOW())
    `, [cloudUuid, nextLocalId, prodUuid, Number(quantity || 0), movementType || 'ADJUSTMENT', source || 'Manual Adjustment', reference || `adj-${Date.now()}`]);

    return ApiResponse.success(res, 'Stock movement recorded successfully', { id: nextLocalId }, 201);
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory - Create Product
router.post('/', requireCloudScreen('Inventory'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, code, category, unit, description, lowStockThreshold } = req.body;
    if (!name || !name.trim()) return ApiResponse.error(res, 'Product name is required', 400);
    const prodCode = (code || name.slice(0, 4)).toUpperCase().trim();
    const cloudUuid = crypto.randomUUID();

    const maxIdRes = await queryWithRetry('SELECT COALESCE(MAX(local_id), 0) + 1 AS next_id FROM inventory_products');
    const nextLocalId = maxIdRes.rows[0]?.next_id || 1;

    const insertRes = await queryWithRetry(`
      INSERT INTO inventory_products (id, local_id, device_id, code, name, description, category, unit, tax, low_stock_threshold, is_active, is_locked, created_at, updated_at)
      VALUES ($1, $2, 'web-portal', $3, $4, $5, $6, $7, '0', $8, true, false, NOW(), NOW())
      RETURNING *
    `, [cloudUuid, nextLocalId, prodCode, name.trim(), description || '', category || 'Dairy', unit || 'kg', Number(lowStockThreshold || 10)]);

    const p = insertRes.rows[0];
    return ApiResponse.success(res, 'Product created successfully', {
      id: String(p.local_id || p.id),
      code: p.code,
      name: p.name,
      description: p.description || '',
      category: p.category,
      unit: p.unit,
      stock: 0,
      sellPrice: 0,
      cost: 0,
      lowStockThreshold: Number(p.low_stock_threshold || 10),
      status: 'In Stock',
      isLocked: false,
    }, 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/:id
router.get('/:id', requireCloudScreen('Inventory'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';

    const prodRes = await queryWithRetry(`SELECT * FROM inventory_products WHERE ${whereField} = $1`, [id]);
    if (prodRes.rows.length === 0) return ApiResponse.error(res, 'Product not found', 404);
    const p = prodRes.rows[0];
    return ApiResponse.success(res, 'Product fetched', {
      id: String(p.local_id || p.id),
      code: p.code,
      name: p.name,
      description: p.description || '',
      category: p.category,
      unit: p.unit,
      stock: 0,
      sellPrice: 0,
      cost: 0,
      lowStockThreshold: Number(p.low_stock_threshold || 10),
      status: p.is_active ? 'In Stock' : 'Out of Stock',
      isLocked: Boolean(p.is_locked),
    }, 200);
  } catch (err) {
    next(err);
  }
});

// PUT /api/inventory/:id - Update Product
router.put('/:id', requireCloudScreen('Inventory'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';

    const { name, category, unit, description, lowStockThreshold } = req.body;
    const updateRes = await queryWithRetry(`
      UPDATE inventory_products
      SET name = COALESCE($1, name),
          category = COALESCE($2, category),
          unit = COALESCE($3, unit),
          description = COALESCE($4, description),
          low_stock_threshold = COALESCE($5, low_stock_threshold),
          updated_at = NOW()
      WHERE ${whereField} = $6
      RETURNING *
    `, [name, category, unit, description, lowStockThreshold, id]);

    if (updateRes.rows.length === 0) return ApiResponse.error(res, 'Product not found', 404);
    const p = updateRes.rows[0];
    return ApiResponse.success(res, 'Product updated successfully', {
      id: String(p.local_id || p.id),
      code: p.code,
      name: p.name,
      description: p.description || '',
      category: p.category,
      unit: p.unit,
      lowStockThreshold: Number(p.low_stock_threshold || 10),
    }, 200);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/inventory/:id - Soft Delete Product
router.delete('/:id', requireCloudScreen('Inventory'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';

    await queryWithRetry(`UPDATE inventory_products SET is_active = false, updated_at = NOW() WHERE ${whereField} = $1`, [id]);
    return ApiResponse.success(res, 'Product deleted successfully', null, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory
router.get('/', requireCloudScreen('Inventory'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const search = (req.query.search as string || '').toLowerCase().trim();
    let query = 'SELECT * FROM inventory_products WHERE is_active = true';
    const params: any[] = [];
    if (search) {
      query += ' AND (LOWER(name) LIKE $1 OR LOWER(code) LIKE $1 OR LOWER(category) LIKE $1)';
      params.push(`%${search}%`);
    }
    query += ' ORDER BY name ASC';
    const productsRes = await queryWithRetry(query, params);
    const rows = productsRes.rows.map((p: any) => ({
      id: String(p.local_id || p.id),
      code: p.code,
      name: p.name,
      description: p.description || '',
      category: p.category || 'General',
      unit: p.unit || 'kg',
      stock: 0,
      sellPrice: 0,
      cost: 0,
      lowStockThreshold: Number(p.low_stock_threshold || 10),
      status: p.is_active ? 'In Stock' : 'Out of Stock',
      isLocked: Boolean(p.is_locked),
    }));
    return ApiResponse.success(res, 'Inventory fetched', rows, 200);
  } catch (err) {
    next(err);
  }
});

export default router;
