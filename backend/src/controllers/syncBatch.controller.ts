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

function buildQuery(operation: string, entityType: string, cloudUuid: string, deviceId: string, p: any): { sql: string; vals: any[] } {
  const table = TABLE_MAP[entityType];
  if (!table) throw new Error(`Unsupported entityType: ${entityType}`);

  if (operation === 'DELETE') {
    return { sql: `DELETE FROM ${table} WHERE id=$1`, vals: [cloudUuid] };
  }

  if (operation === 'CREATE') {
    const cols = Object.keys(p);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES(${placeholders}) ON CONFLICT(id) DO NOTHING`;
    return { sql, vals: cols.map(c => p[c]) };
  }

  if (operation === 'UPDATE') {
    const cols = Object.keys(p).filter(k => k !== 'id' && k !== 'local_id' && k !== 'device_id');
    const setStr = cols.map((c, i) => `${c}=$${i + 2}`).join(', ');
    const sql = `UPDATE ${table} SET ${setStr} WHERE id=$1`;
    return { sql, vals: [cloudUuid, ...cols.map(c => p[c])] };
  }

  if (operation === 'UPSERT') {
    if (entityType === 'MilkProductDailyStock') {
      const cols = Object.keys(p);
      const updateCols = cols.filter(k => k !== 'id' && k !== 'local_id' && k !== 'device_id' && k !== 'date');
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
      const setStr = updateCols.map(c => `${c}=EXCLUDED.${c}`).join(', ');
      
      const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES(${placeholders})
                   ON CONFLICT(device_id, date) DO UPDATE SET ${setStr}`;
      return { sql, vals: cols.map(c => p[c]) };
    } else {
      // generic upsert on id
      const cols = Object.keys(p);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
      const updateCols = cols.filter(k => k !== 'id' && k !== 'local_id' && k !== 'device_id');
      const setStr = updateCols.map(c => `${c}=EXCLUDED.${c}`).join(', ');
      
      const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES(${placeholders})
                   ON CONFLICT(id) DO UPDATE SET ${setStr}`;
      return { sql, vals: cols.map(c => p[c]) };
    }
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
        
        // 1. Idempotency check
        const idem = await client.query('SELECT 1 FROM idempotency_log WHERE event_uuid=$1 FOR UPDATE', [eventUuid]);
        if (idem.rowCount && idem.rowCount > 0) {
          await client.query('COMMIT');
          results.push({ eventUuid, status: 'SYNCED', message: 'Skipped (already processed)' });
          continue;
        }

        // 2. Execute SQL
        const rawPayload = typeof payload === 'string' ? JSON.parse(payload) : (payload || {});
        
        // Convert camelCase keys to snake_case
        const payloadObj: Record<string, any> = {};
        for (const [key, value] of Object.entries(rawPayload)) {
          const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          if (snakeKey.endsWith('_id') && snakeKey !== 'device_id' && snakeKey !== 'local_id') {
            continue; // strip local foreign keys (e.g. customer_id, sale_id)
          }
          payloadObj[snakeKey] = value;
        }
        
        // ensure id and device_id are injected for CREATE/UPSERT
        if (operation === 'CREATE' || operation === 'UPSERT') {
          payloadObj.id = cloudUuid;
          payloadObj.device_id = deviceId;
          payloadObj.local_id = localId;
        }
        
        const { sql, vals } = buildQuery(operation, entityType, cloudUuid, deviceId, payloadObj);
        await client.query(sql, vals);

        // 3. Record idempotency
        await client.query(
          `INSERT INTO idempotency_log (event_uuid,device_id,entity_type,operation) VALUES($1,$2,$3,$4)`,
          [eventUuid, deviceId, entityType, operation]
        );

        // 4. Append to downstream event log (enables downstream sync by other devices)
        // Payload stored as JSONB for structured downstream consumption
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
          retryable: isRetryableError(err) 
        });
      }
    }

    res.status(200).json({ status: 'success', batchId, results });
  } finally {
    client.release();
  }
};

function isRetryableError(err: any): boolean {
  // PostgreSQL error codes
  if (err.code) {
    if (err.code.startsWith('08') || err.code.startsWith('53') || err.code === '40001' || err.code === '40P01') {
      return true; // Connection exception, insufficient resources, serialization failure, deadlock detected
    }
    // Foreign key violation (23503) implies parent is missing. In our case, worker enforces it, 
    // but if it hits here, it might be permanent unless parent is in-flight.
    if (err.code === '23503') return true; // we allow retry for FK violation in case parent just hasn't arrived
  }
  return false;
}
