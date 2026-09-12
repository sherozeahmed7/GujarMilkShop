import { Request, Response } from 'express';
import { getNeonPool } from '../config/neonDb';

const TABLE_MAP: Record<string, string> = {
  User: 'users',
  Supplier: 'suppliers',
  InventoryProduct: 'inventory_products',
  DailyRate: 'daily_rates',
  Customer: 'customers',
  Shift: 'shifts',
  SupplierCollection: 'supplier_collections',
  SupplierPayment: 'supplier_payments',
  Sale: 'sales',
  SaleItem: 'sale_items',
  Payment: 'payments',
  Expense: 'expenses',
  ExpensePayment: 'expense_payments',
  InventoryMovement: 'inventory_movements',
  MilkProductTransaction: 'milk_product_transactions',
  ButterGheeConversion: 'butter_ghee_conversions',
  MilkProductDailyStock: 'milk_product_daily_stocks',
  Return: 'returns',
  ReturnItem: 'return_items',
  AuditRecord: 'audit_records',
};

/** Allowed Neon columns per entity (snake_case). Extra keys are dropped. */
const ALLOWED_COLUMNS: Record<string, Set<string>> = {
  User: new Set(['name', 'email', 'password', 'role', 'status', 'assigned_screens', 'created_at', 'updated_at']),
  Supplier: new Set([
    'name', 'code', 'phone', 'default_rate', 'cow_rate', 'buffalo_rate', 'cycle_type',
    'is_active', 'guaranteed_advance', 'created_at', 'updated_at',
  ]),
  InventoryProduct: new Set([
    'code', 'name', 'description', 'category', 'unit', 'tax', 'low_stock_threshold',
    'is_active', 'is_locked', 'created_at', 'updated_at',
  ]),
  DailyRate: new Set([
    'milk_rate', 'yogurt_rate', 'lassi_rate', 'butter_rate', 'ghee_rate',
    'updated_by_role', 'date', 'created_at',
  ]),
  Customer: new Set([
    'name', 'phone', 'address', 'customer_type', 'status', 'created_at', 'updated_at',
  ]),
  Shift: new Set([
    'shift_date', 'opened_by_uuid', 'closed_by_uuid', 'opened_at', 'closed_at',
    'opening_cash', 'opening_notes', 'expected_cash', 'counted_cash', 'difference',
    'difference_status', 'closing_notes', 'status', 'created_at', 'updated_at',
  ]),
  SupplierCollection: new Set([
    'supplier_uuid', 'date', 'shift', 'milk_type', 'quantity', 'rate', 'amount',
    'notes', 'created_by_uuid', 'created_at', 'updated_at',
  ]),
  SupplierPayment: new Set([
    'supplier_uuid', 'shift_uuid', 'date', 'amount', 'method', 'notes', 'created_by_uuid', 'created_at',
  ]),
  Sale: new Set([
    'sale_type', 'customer_uuid', 'customer_name', 'customer_phone', 'total_amount',
    'paid_amount', 'remaining_balance', 'status', 'created_at', 'updated_at',
  ]),
  SaleItem: new Set([
    'sale_uuid', 'item_name', 'quantity', 'unit_price', 'total_price', 'created_at',
  ]),
  Payment: new Set(['sale_uuid', 'method', 'amount', 'status', 'created_at']),
  Expense: new Set([
    'date', 'category', 'description', 'quantity', 'unit_cost', 'gross_loss',
    'sold_recovery', 'net_expense', 'amount', 'paid_amount', 'remaining', 'reason',
    'added_by', 'created_at', 'updated_at',
  ]),
  ExpensePayment: new Set([
    'expense_uuid', 'shift_uuid', 'amount', 'date', 'added_by', 'created_at',
  ]),
  InventoryMovement: new Set([
    'product_uuid', 'quantity', 'movement_type', 'source', 'reference', 'unit_cost',
    'supplier_uuid', 'shift_uuid', 'user_uuid', 'date', 'created_at',
  ]),
  MilkProductTransaction: new Set([
    'date', 'product', 'type', 'quantity', 'reference', 'notes', 'created_at',
  ]),
  ButterGheeConversion: new Set([
    'date', 'butter_used', 'ghee_produced', 'notes', 'created_at',
  ]),
  MilkProductDailyStock: new Set([
    'date', 'milk_total', 'lassi_produced', 'lassi_sold', 'lassi_remaining',
    'butter_opening', 'butter_produced', 'butter_sold', 'butter_converted', 'butter_closing',
    'ghee_opening', 'ghee_produced', 'ghee_sold', 'ghee_closing', 'created_at', 'updated_at',
  ]),
  Return: new Set([
    'sale_uuid', 'bill_number', 'date', 'customer', 'return_type', 'refund_amount',
    'payment_method', 'reason', 'status', 'processed_by', 'created_at', 'updated_at',
  ]),
  ReturnItem: new Set([
    'return_uuid', 'item_id', 'name', 'return_qty', 'unit_price', 'refund_amount',
  ]),
  AuditRecord: new Set([
    'audit_date', 'executed_at', 'total_pos_bills', 'collected_receipts', 'matched',
    'missing', 'extra', 'duplicates', 'status', 'notes', 'audited_by', 'created_at',
  ]),
};

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function sanitizePayload(entityType: string, rawPayload: Record<string, any>): Record<string, any> {
  const allowed = ALLOWED_COLUMNS[entityType];
  const out: Record<string, any> = {};

  for (const [key, value] of Object.entries(rawPayload)) {
    const snakeKey = key.includes('_') ? key : toSnake(key);

    // Drop local integer FKs; keep *_uuid
    if (snakeKey.endsWith('_id') && snakeKey !== 'device_id' && snakeKey !== 'local_id' && snakeKey !== 'item_id') {
      continue;
    }

    if (allowed && !allowed.has(snakeKey)) {
      continue;
    }

    out[snakeKey] = value;
  }

  return out;
}

function buildQuery(
  operation: string,
  entityType: string,
  cloudUuid: string,
  deviceId: string,
  p: any
): { sql: string; vals: any[] } {
  const table = TABLE_MAP[entityType];
  if (!table) throw new Error(`Unsupported entityType: ${entityType}`);

  if (operation === 'DELETE') {
    return { sql: `DELETE FROM ${table} WHERE id=$1`, vals: [cloudUuid] };
  }

  if (operation === 'CREATE') {
    const cols = Object.keys(p);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES(${placeholders}) ON CONFLICT(id) DO NOTHING`;
    return { sql, vals: cols.map((c) => p[c]) };
  }

  if (operation === 'UPDATE') {
    const cols = Object.keys(p).filter((k) => k !== 'id' && k !== 'local_id' && k !== 'device_id');
    const setStr = cols.map((c, i) => `${c}=$${i + 2}`).join(', ');
    const sql = `UPDATE ${table} SET ${setStr} WHERE id=$1`;
    return { sql, vals: [cloudUuid, ...cols.map((c) => p[c])] };
  }

  if (operation === 'UPSERT') {
    if (entityType === 'MilkProductDailyStock') {
      const cols = Object.keys(p);
      const updateCols = cols.filter((k) => k !== 'id' && k !== 'local_id' && k !== 'device_id' && k !== 'date');
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
      const setStr = updateCols.map((c) => `${c}=EXCLUDED.${c}`).join(', ');

      const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES(${placeholders})
                   ON CONFLICT(device_id, date) DO UPDATE SET ${setStr}`;
      return { sql, vals: cols.map((c) => p[c]) };
    }

    const cols = Object.keys(p);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
    const updateCols = cols.filter((k) => k !== 'id' && k !== 'local_id' && k !== 'device_id');
    const setStr = updateCols.map((c) => `${c}=EXCLUDED.${c}`).join(', ');

    const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES(${placeholders})
                 ON CONFLICT(id) DO UPDATE SET ${setStr}`;
    return { sql, vals: cols.map((c) => p[c]) };
  }

  throw new Error(`Unsupported operation: ${operation}`);
}

export const syncBatch = async (req: Request, res: Response): Promise<void> => {
  const { batchId, payloads } = req.body;

  if (batchId === undefined || !Array.isArray(payloads)) {
    res.status(400).json({ error: 'Invalid batch request payload.' });
    return;
  }

  const pool = getNeonPool();
  const client = await pool.connect();
  const results: any[] = [];

  try {
    for (const item of payloads) {
      const { eventUuid, cloudUuid, entityType, deviceId, localId, operation, payload } = item;

      try {
        if (!eventUuid || !cloudUuid || !entityType || !deviceId || !operation) {
          throw new Error('Malformed payload item: missing required fields');
        }

        await client.query('BEGIN');

        const idem = await client.query(
          'SELECT 1 FROM idempotency_log WHERE event_uuid=$1 FOR UPDATE',
          [eventUuid]
        );
        if (idem.rowCount && idem.rowCount > 0) {
          await client.query('COMMIT');
          results.push({ eventUuid, status: 'SYNCED', message: 'Skipped (already processed)' });
          continue;
        }

        const rawPayload = typeof payload === 'string' ? JSON.parse(payload) : payload || {};
        const payloadObj = sanitizePayload(entityType, rawPayload);

        if (operation === 'CREATE' || operation === 'UPSERT') {
          payloadObj.id = cloudUuid;
          payloadObj.device_id = deviceId;
          payloadObj.local_id = localId;
        }

        // Required FK presence checks for child entities
        if (operation === 'CREATE' || operation === 'UPSERT') {
          if (entityType === 'SaleItem' && !payloadObj.sale_uuid) {
            throw new Error('SaleItem missing sale_uuid');
          }
          if (entityType === 'Payment' && !payloadObj.sale_uuid) {
            throw new Error('Payment missing sale_uuid');
          }
          if (entityType === 'InventoryMovement' && !payloadObj.product_uuid) {
            throw new Error('InventoryMovement missing product_uuid');
          }
          if (
            (entityType === 'SupplierCollection' || entityType === 'SupplierPayment') &&
            !payloadObj.supplier_uuid
          ) {
            throw new Error(`${entityType} missing supplier_uuid`);
          }
        }

        const { sql, vals } = buildQuery(operation, entityType, cloudUuid, deviceId, payloadObj);
        await client.query(sql, vals);

        await client.query(
          `INSERT INTO idempotency_log (event_uuid,device_id,entity_type,operation) VALUES($1,$2,$3,$4)`,
          [eventUuid, deviceId, entityType, operation]
        );

        await client.query(
          `INSERT INTO cloud_sync_events (event_uuid, device_id, entity_type, cloud_uuid, operation, payload)
           VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
          [eventUuid, deviceId, entityType, cloudUuid, operation, JSON.stringify(payloadObj)]
        );

        await client.query('COMMIT');
        results.push({ eventUuid, status: 'SYNCED' });
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(`[Sync API] Event ${eventUuid} FAILED:`, err.message);
        results.push({
          eventUuid,
          status: 'FAILED',
          error: err.message,
          retryable: isRetryableError(err),
        });
      }
    }

    res.status(200).json({ status: 'success', batchId, results });
  } finally {
    client.release();
  }
};

function isRetryableError(err: any): boolean {
  if (err.code) {
    if (
      err.code.startsWith('08') ||
      err.code.startsWith('53') ||
      err.code === '40001' ||
      err.code === '40P01'
    ) {
      return true;
    }
    if (err.code === '23503') return true;
  }
  return false;
}
