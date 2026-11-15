import { Router, Response, NextFunction } from 'express';
import { queryWithRetry } from '../config/neonDb';
import { ApiResponse } from '../utils/apiResponse';
import { authenticateCloudJWT, CloudAuthRequest, requireCloudScreen } from './cloudAuth.middleware';
import crypto from 'crypto';

const router = Router();
router.use(authenticateCloudJWT);

// GET /api/suppliers/payments
router.get('/payments', requireCloudScreen('Suppliers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const fromDate = req.query.fromDate as string;
    const toDate = req.query.toDate as string;
    let query = `
      SELECT sp.*, s.name as supplier_name, s.code as supplier_code
      FROM supplier_payments sp
      LEFT JOIN suppliers s ON sp.supplier_uuid = s.id
    `;
    const params: any[] = [];
    if (fromDate && toDate) {
      query += ` WHERE sp.date >= $1 AND sp.date <= $2`;
      params.push(fromDate, toDate);
    }
    query += ` ORDER BY sp.date DESC LIMIT 100`;
    const result = await queryWithRetry(query, params);
    const rows = result.rows.map((r: any) => ({
      id: String(r.local_id || r.id),
      supplierId: String(r.supplier_uuid),
      supplierName: r.supplier_name || 'Unknown',
      date: r.date,
      amount: Number(r.amount),
      paymentMethod: r.method || 'cash',
      notes: r.notes || '',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
    }));
    return ApiResponse.success(res, 'Supplier payments fetched', rows, 200);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/suppliers/collections/:id
router.delete('/collections/:id', requireCloudScreen('Suppliers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';
    await queryWithRetry(`DELETE FROM supplier_collections WHERE ${whereField} = $1`, [id]);
    return ApiResponse.success(res, 'Collection deleted', null, 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/suppliers - Create supplier
router.post('/', requireCloudScreen('Suppliers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, phone, defaultRate, cowRate, buffaloRate, cycleType, guaranteedAdvance } = req.body;
    if (!name || !name.trim()) return ApiResponse.error(res, 'Supplier name is required', 400);

    const cloudUuid = crypto.randomUUID();
    const maxIdRes = await queryWithRetry('SELECT COALESCE(MAX(local_id), 0) + 1 AS next_id FROM suppliers');
    const nextLocalId = maxIdRes.rows[0]?.next_id || 1;

    let code = req.body.code;
    if (!code) {
      const codeRes = await queryWithRetry("SELECT code FROM suppliers WHERE code ILIKE 'SUP-%'");
      let maxNum = 0;
      for (const row of codeRes.rows) {
        const m = String(row.code).trim().match(/^SUP-(\d+)$/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      }
      code = `SUP-${String(maxNum + 1).padStart(4, '0')}`;
    }

    const insertRes = await queryWithRetry(`
      INSERT INTO suppliers (
        id, local_id, device_id, name, code, phone,
        default_rate, cow_rate, buffalo_rate, cycle_type,
        is_active, guaranteed_advance, created_at, updated_at
      ) VALUES ($1, $2, 'web-portal', $3, $4, $5, $6, $7, $8, $9, true, $10, NOW(), NOW())
      RETURNING *
    `, [
      cloudUuid, nextLocalId, name.trim(), code, phone || null,
      Number(defaultRate || 0), Number(cowRate || 0), Number(buffaloRate || 0),
      cycleType || 'Monthly Cycle', Number(guaranteedAdvance || 0)
    ]);

    const s = insertRes.rows[0];
    return ApiResponse.success(res, 'Supplier created successfully', {
      id: String(s.local_id || s.id),
      name: s.name,
      code: s.code,
      phone: s.phone || '',
      defaultRate: Number(s.default_rate),
      cowRate: Number(s.cow_rate),
      buffaloRate: Number(s.buffalo_rate),
      cycleType: s.cycle_type,
      isActive: true,
      guaranteedAdvance: Number(s.guaranteed_advance),
      payableBalance: 0,
    }, 201);
  } catch (err) {
    next(err);
  }
});

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
    const whereField = isUuid ? 'id' : 'local_id::text';

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

// PUT /api/suppliers/:id - Update supplier
router.put('/:id', requireCloudScreen('Suppliers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';

    const { name, phone, defaultRate, cowRate, buffaloRate, cycleType, guaranteedAdvance, isActive } = req.body;
    const supRes = await queryWithRetry(`SELECT * FROM suppliers WHERE ${whereField} = $1`, [id]);
    if (supRes.rows.length === 0) {
      return ApiResponse.error(res, 'Supplier not found', 404);
    }
    const current = supRes.rows[0];

    const updatedRes = await queryWithRetry(`
      UPDATE suppliers
      SET 
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        default_rate = COALESCE($3, default_rate),
        cow_rate = COALESCE($4, cow_rate),
        buffalo_rate = COALESCE($5, buffalo_rate),
        cycle_type = COALESCE($6, cycle_type),
        guaranteed_advance = COALESCE($7, guaranteed_advance),
        is_active = COALESCE($8, is_active),
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `, [
      name !== undefined ? name.trim() : null,
      phone !== undefined ? phone : null,
      defaultRate !== undefined ? Number(defaultRate) : null,
      cowRate !== undefined ? Number(cowRate) : null,
      buffaloRate !== undefined ? Number(buffaloRate) : null,
      cycleType !== undefined ? cycleType : null,
      guaranteedAdvance !== undefined ? Number(guaranteedAdvance) : null,
      isActive !== undefined ? Boolean(isActive) : null,
      current.id
    ]);

    const s = updatedRes.rows[0];
    return ApiResponse.success(res, 'Supplier updated successfully', {
      id: String(s.local_id || s.id),
      name: s.name,
      code: s.code,
      phone: s.phone || '',
      defaultRate: Number(s.default_rate),
      cowRate: Number(s.cow_rate),
      buffaloRate: Number(s.buffalo_rate),
      cycleType: s.cycle_type,
      isActive: Boolean(s.is_active),
      guaranteedAdvance: Number(s.guaranteed_advance),
      payableBalance: 0,
    }, 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/suppliers/:id/collections - Add milk collection
router.post('/:id/collections', requireCloudScreen('Suppliers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';

    const supRes = await queryWithRetry(`SELECT * FROM suppliers WHERE ${whereField} = $1`, [id]);
    if (supRes.rows.length === 0) {
      return ApiResponse.error(res, 'Supplier not found', 404);
    }
    const supplier = supRes.rows[0];

    const { date, shift, milkType, quantity, rate, notes } = req.body;
    const qty = Number(quantity || 0);
    const r = Number(rate || supplier.default_rate || 0);
    const amount = Math.round(qty * r * 100) / 100;

    const cloudUuid = crypto.randomUUID();
    const maxIdRes = await queryWithRetry('SELECT COALESCE(MAX(local_id), 0) + 1 AS next_id FROM supplier_collections');
    const nextLocalId = maxIdRes.rows[0]?.next_id || 1;

    const insertRes = await queryWithRetry(`
      INSERT INTO supplier_collections (
        id, local_id, device_id, supplier_uuid, date, shift, milk_type,
        quantity, rate, amount, notes, created_at, updated_at
      ) VALUES ($1, $2, 'web-portal', $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `, [
      cloudUuid, nextLocalId, supplier.id,
      date || new Date().toISOString().split('T')[0],
      shift || 'Morning',
      milkType || 'Mixed',
      qty, r, amount, notes || null
    ]);

    const c = insertRes.rows[0];
    return ApiResponse.success(res, 'Milk collection saved', {
      id: String(c.local_id || c.id),
      supplierId: String(supplier.local_id || supplier.id),
      date: c.date,
      shift: c.shift,
      milkType: c.milk_type,
      quantity: Number(c.quantity),
      rate: Number(c.rate),
      amount: Number(c.amount),
      notes: c.notes || '',
      createdAt: c.created_at ? new Date(c.created_at).toISOString() : '',
    }, 201);
  } catch (err) {
    next(err);
  }
});

// POST /api/suppliers/:id/payments - Record supplier payment
router.post('/:id/payments', requireCloudScreen('Suppliers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';

    const supRes = await queryWithRetry(`SELECT * FROM suppliers WHERE ${whereField} = $1`, [id]);
    if (supRes.rows.length === 0) {
      return ApiResponse.error(res, 'Supplier not found', 404);
    }
    const supplier = supRes.rows[0];

    const { date, amount, paymentMethod, method, notes } = req.body;
    const payAmount = Number(amount || 0);
    const payMethod = paymentMethod || method || 'cash';

    const cloudUuid = crypto.randomUUID();
    const maxIdRes = await queryWithRetry('SELECT COALESCE(MAX(local_id), 0) + 1 AS next_id FROM supplier_payments');
    const nextLocalId = maxIdRes.rows[0]?.next_id || 1;

    const insertRes = await queryWithRetry(`
      INSERT INTO supplier_payments (
        id, local_id, device_id, supplier_uuid, date, amount, method, notes, created_at, updated_at
      ) VALUES ($1, $2, 'web-portal', $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `, [
      cloudUuid, nextLocalId, supplier.id,
      date || new Date().toISOString().split('T')[0],
      payAmount, payMethod, notes || null
    ]);

    const p = insertRes.rows[0];
    return ApiResponse.success(res, 'Supplier payment recorded', {
      id: String(p.local_id || p.id),
      supplierId: String(supplier.local_id || supplier.id),
      date: p.date,
      amount: Number(p.amount),
      paymentMethod: p.method,
      notes: p.notes || '',
      createdAt: p.created_at ? new Date(p.created_at).toISOString() : '',
    }, 201);
  } catch (err) {
    next(err);
  }
});

export default router;
