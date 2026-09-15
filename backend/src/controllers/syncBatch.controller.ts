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

/** 
 * Tries to find an existing entity deterministically. 
 * Resolves by Mapping Identity -> Cloud UUID -> Business Key.
 * Returns { id: string } or null.
 */
async function resolveEntity(client: any, entityType: string, cloudUuid: string, deviceId: string, localId: number, payloadObj: any): Promise<string | null> {
  const table = TABLE_MAP[entityType];
  
  // 1. Try mapping identity (device_id, local_id)
  const mapRes = await client.query(`SELECT id FROM ${table} WHERE device_id=$1 AND local_id=$2 FOR UPDATE`, [deviceId, localId]);
  let mappedId: string | null = null;
  if (mapRes.rowCount && mapRes.rowCount > 0) {
    mappedId = mapRes.rows[0].id;
  }

  // 2. Try incoming cloud UUID
  const uuidRes = await client.query(`SELECT id FROM ${table} WHERE id=$1 FOR UPDATE`, [cloudUuid]);
  let incomingUuidId: string | null = null;
  if (uuidRes.rowCount && uuidRes.rowCount > 0) {
    incomingUuidId = uuidRes.rows[0].id;
  }

  // 3. Try Business Key
  let bkId: string | null = null;
  if (entityType === 'InventoryProduct' && payloadObj.code) {
    const bkRes = await client.query(`SELECT id FROM ${table} WHERE code=$1 FOR UPDATE`, [payloadObj.code]);
    if (bkRes.rowCount && bkRes.rowCount > 0) bkId = bkRes.rows[0].id;
  } else if (entityType === 'Supplier' && payloadObj.code) {
    const bkRes = await client.query(`SELECT id FROM ${table} WHERE code=$1 FOR UPDATE`, [payloadObj.code]);
    if (bkRes.rowCount && bkRes.rowCount > 0) bkId = bkRes.rows[0].id;
  } else if (entityType === 'User' && payloadObj.email) {
    const bkRes = await client.query(`SELECT id FROM ${table} WHERE email=$1 FOR UPDATE`, [payloadObj.email]);
    if (bkRes.rowCount && bkRes.rowCount > 0) bkId = bkRes.rows[0].id;
  } else if (entityType === 'MilkProductDailyStock' && payloadObj.date) {
    const bkRes = await client.query(`SELECT id FROM ${table} WHERE device_id=$1 AND date=$2::timestamp FOR UPDATE`, [deviceId, payloadObj.date]);
    if (bkRes.rowCount && bkRes.rowCount > 0) bkId = bkRes.rows[0].id;
  }

  // Identity Conflict Check
  const foundIds = new Set([mappedId, incomingUuidId, bkId].filter(Boolean));
  if (foundIds.size > 1) {
    // Strict conflict: if mappedId is present and disagrees, this is genuine corruption.
    if (mappedId && (incomingUuidId || bkId) && mappedId !== incomingUuidId && mappedId !== bkId) {
      throw new Error(`IDENTITY CONFLICT: Mapped ID ${mappedId}, Incoming UUID ${incomingUuidId}, Business Key ID ${bkId} resolve to different records. Manual intervention required.`);
    }

    // Soft conflict: mappedId is null but incomingUuidId and bkId disagree.
    // For entities with true unique business keys, trust the BK record as authoritative.
    // This handles the case where two cloud records drifted under different UUIDs for the
    // same real-world entity (e.g. MILK product duplicated in Neon under two UUIDs).
    if (!mappedId && bkId && incomingUuidId && bkId !== incomingUuidId) {
      const hasTrueBusinessKey = entityType === 'InventoryProduct' || entityType === 'Supplier' || entityType === 'User';
      if (hasTrueBusinessKey) {
        console.warn(`[SyncBatch] Business key reconciliation: ${entityType} incoming UUID ${incomingUuidId} conflicts with BK record ${bkId}. Applying to BK record (authoritative).`);
        return bkId;
      }
      // For entities without a reliable business key, keep the strict guard
      throw new Error(`IDENTITY CONFLICT: Mapped ID ${mappedId}, Incoming UUID ${incomingUuidId}, Business Key ID ${bkId} resolve to different records. Manual intervention required.`);
    }
  }

  if (mappedId) return mappedId;
  if (incomingUuidId) return incomingUuidId;
  if (bkId) return bkId;

  return null;
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

        // Idempotency: Protect against concurrent delivery of exact same event
        const idemRes = await client.query(
          `INSERT INTO idempotency_log (event_uuid, device_id, entity_type, operation) 
           VALUES ($1, $2, $3, $4) 
           ON CONFLICT (event_uuid) DO NOTHING RETURNING event_uuid`,
          [eventUuid, deviceId, entityType, operation]
        );

        if (idemRes.rowCount === 0) {
          await client.query('COMMIT');
          results.push({ eventUuid, status: 'SYNCED', message: 'Skipped (already processed)' });
          continue;
        }

        const rawPayload = typeof payload === 'string' ? JSON.parse(payload) : payload || {};
        const payloadObj = sanitizePayload(entityType, rawPayload);

        // Provision missing required FKs safely
        if (operation === 'CREATE' || operation === 'UPSERT') {
          if (entityType === 'SaleItem' && !payloadObj.sale_uuid) throw new Error('SaleItem missing sale_uuid');
          if (entityType === 'Payment' && !payloadObj.sale_uuid) throw new Error('Payment missing sale_uuid');
          if (entityType === 'InventoryMovement') {
            if (!payloadObj.product_uuid) throw new Error('InventoryMovement missing product_uuid');
            
            // Auto-provision product
            let pCheck = await client.query('SELECT id FROM inventory_products WHERE id=$1', [payloadObj.product_uuid]);
            if (pCheck.rowCount === 0) {
              const productCode = rawPayload.productCode || rawPayload.name;
              const fallback = await client.query(
                `SELECT id FROM inventory_products WHERE (device_id=$1 AND local_id=$2) OR local_id=$2 OR ($3::text IS NOT NULL AND code=$3::text) LIMIT 1`,
                [deviceId, rawPayload.productId || 1, productCode || null]
              );
              if (fallback.rowCount && fallback.rowCount > 0) {
                payloadObj.product_uuid = fallback.rows[0].id;
              } else {
                let pSuccess = false;
                for(let pTry = 0; pTry < 3 && !pSuccess; pTry++) {
                  try {
                    await client.query('SAVEPOINT prov_p');
                    const insertRes = await client.query(
                      `INSERT INTO inventory_products (id, device_id, local_id, code, name, unit, category, tax, low_stock_threshold, is_active, is_locked)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
                      [
                        payloadObj.product_uuid, deviceId, rawPayload.productId || 1,
                        productCode || `PRODUCT_${deviceId.slice(0, 4)}_${rawPayload.productId || 1}`,
                        rawPayload.productName || productCode || 'Milk', 'kg', 'Dairy', 'Exempt', 10, true, true,
                      ]
                    );
                    if (insertRes.rowCount && insertRes.rowCount > 0) payloadObj.product_uuid = insertRes.rows[0].id;
                    await client.query('RELEASE SAVEPOINT prov_p');
                    pSuccess = true;
                  } catch (e: any) {
                    await client.query('ROLLBACK TO SAVEPOINT prov_p');
                    if (e.code === '23505') {
                       // Concurrent creation caught. Resolve it.
                       const fb2 = await client.query(`SELECT id FROM inventory_products WHERE code=$1 OR (device_id=$2 AND local_id=$3) LIMIT 1`, [productCode || null, deviceId, rawPayload.productId || 1]);
                       if (fb2.rowCount && fb2.rowCount > 0) {
                         payloadObj.product_uuid = fb2.rows[0].id;
                         pSuccess = true;
                       }
                    } else throw e;
                  }
                }
              }
            }

            // Auto-provision user
            if (payloadObj.user_uuid) {
              let uCheck = await client.query('SELECT id FROM users WHERE id=$1', [payloadObj.user_uuid]);
              if (uCheck.rowCount === 0) {
                const uFallback = await client.query('SELECT id FROM users WHERE (device_id=$1 AND local_id=$2) OR local_id=$2 LIMIT 1', [deviceId, rawPayload.userId || rawPayload.createdById || 1]);
                if (uFallback.rowCount && uFallback.rowCount > 0) {
                  payloadObj.user_uuid = uFallback.rows[0].id;
                } else {
                   let uSuccess = false;
                   for(let uTry = 0; uTry < 3 && !uSuccess; uTry++) {
                     try {
                       await client.query('SAVEPOINT prov_u');
                       const uInsertRes = await client.query(
                         `INSERT INTO users (id, device_id, local_id, name, email, password, role, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                         [
                           payloadObj.user_uuid, deviceId, rawPayload.userId || rawPayload.createdById || 1,
                           rawPayload.userName || rawPayload.createdByName || 'Unknown User',
                           `placeholder_${payloadObj.user_uuid}@local.invalid`, 'placeholder', rawPayload.userRole || 'cashier', 'active'
                         ]
                       );
                       if (uInsertRes.rowCount && uInsertRes.rowCount > 0) payloadObj.user_uuid = uInsertRes.rows[0].id;
                       await client.query('RELEASE SAVEPOINT prov_u');
                       uSuccess = true;
                     } catch(e: any) {
                       await client.query('ROLLBACK TO SAVEPOINT prov_u');
                       if (e.code === '23505') {
                         const fb2 = await client.query('SELECT id FROM users WHERE (device_id=$1 AND local_id=$2) LIMIT 1', [deviceId, rawPayload.userId || rawPayload.createdById || 1]);
                         if (fb2.rowCount && fb2.rowCount > 0) {
                           payloadObj.user_uuid = fb2.rows[0].id;
                           uSuccess = true;
                         }
                       } else throw e;
                     }
                   }
                }
              }
            }

            // Auto-resolve shift_uuid — the shift may have been reconciled to a different UUID in Neon
            if (payloadObj.shift_uuid) {
              const sCheck = await client.query('SELECT id FROM shifts WHERE id=$1', [payloadObj.shift_uuid]);
              if (sCheck.rowCount === 0) {
                // Shift doesn't exist at that UUID — find it by device_id+local_id (the shift's local integer id)
                const sLocalId = rawPayload.shiftId || rawPayload.shiftLocalId || null;
                let sResolved = false;
                if (sLocalId) {
                  const sFallback = await client.query(
                    'SELECT id FROM shifts WHERE device_id=$1 AND local_id=$2 LIMIT 1',
                    [deviceId, sLocalId]
                  );
                  if (sFallback.rowCount && sFallback.rowCount > 0) {
                    payloadObj.shift_uuid = sFallback.rows[0].id;
                    sResolved = true;
                  }
                }
                if (!sResolved) {
                  // Last resort: find any open shift on the same date for this device
                  const shiftDate = rawPayload.date ? rawPayload.date.slice(0, 10) : null;
                  if (shiftDate) {
                    const sDateFallback = await client.query(
                      `SELECT id FROM shifts WHERE shift_date=$1 ORDER BY created_at DESC LIMIT 1`,
                      [shiftDate]
                    );
                    if (sDateFallback.rowCount && sDateFallback.rowCount > 0) {
                      payloadObj.shift_uuid = sDateFallback.rows[0].id;
                      sResolved = true;
                    }
                  }
                }
                if (!sResolved) {
                  // Cannot resolve — clear it to avoid FK violation (movement still records product/quantity correctly)
                  console.warn(`[Sync] InventoryMovement ${cloudUuid}: could not resolve shift_uuid ${rawPayload.shiftUuid}, clearing it.`);
                  delete payloadObj.shift_uuid;
                }
              }
            }
          }
          if (entityType === 'SupplierCollection' && (!payloadObj.shift || !payloadObj.shift.trim())) {
            payloadObj.shift = rawPayload.shift || 'Morning';
          }
          if ((entityType === 'SupplierCollection' || entityType === 'SupplierPayment') && !payloadObj.supplier_uuid) {
            throw new Error(`${entityType} missing supplier_uuid`);
          }
        }

        const table = TABLE_MAP[entityType];
        let resolvedUuid = cloudUuid;

        // Apply entity-specific defaults for required NOT NULL columns
        if (operation === 'CREATE' || operation === 'UPSERT') {
          if (entityType === 'InventoryProduct') {
            if (!payloadObj.category) payloadObj.category = 'Dairy';
            if (!payloadObj.unit) payloadObj.unit = 'kg';
            if (!payloadObj.tax) payloadObj.tax = 'Exempt';
            if (payloadObj.low_stock_threshold == null) payloadObj.low_stock_threshold = 0;
            if (payloadObj.is_active == null) payloadObj.is_active = true;
            if (payloadObj.is_locked == null) payloadObj.is_locked = false;
          } else if (entityType === 'Supplier') {
            if (payloadObj.default_rate == null) payloadObj.default_rate = 0;
            if (payloadObj.cow_rate == null) payloadObj.cow_rate = 0;
            if (payloadObj.buffalo_rate == null) payloadObj.buffalo_rate = 0;
            if (!payloadObj.cycle_type) payloadObj.cycle_type = 'Monthly Cycle';
            if (payloadObj.is_active == null) payloadObj.is_active = true;
            if (payloadObj.guaranteed_advance == null) payloadObj.guaranteed_advance = 0;
          } else if (entityType === 'Shift') {
            if (payloadObj.opening_cash == null) payloadObj.opening_cash = 0;
            if (payloadObj.expected_cash == null) payloadObj.expected_cash = 0;
            if (!payloadObj.status) payloadObj.status = 'Open';
          } else if (entityType === 'User') {
            if (!payloadObj.role) payloadObj.role = 'user';
            if (!payloadObj.status) payloadObj.status = 'active';
          }
        }

        if (operation === 'DELETE') {
           const mapRes = await client.query(`SELECT id FROM ${table} WHERE device_id=$1 AND local_id=$2 FOR UPDATE`, [deviceId, localId]);
           const targetId = (mapRes.rowCount && mapRes.rowCount > 0) ? mapRes.rows[0].id : cloudUuid;
           resolvedUuid = targetId;

           try {
             await client.query('SAVEPOINT del_sp');
             await client.query(`DELETE FROM ${table} WHERE id=$1`, [targetId]);
             await client.query('RELEASE SAVEPOINT del_sp');
           } catch (delErr: any) {
             await client.query('ROLLBACK TO SAVEPOINT del_sp');
             // 23503 = foreign_key_violation. If entity has status field (User, Customer, Supplier, InventoryProduct), soft-deactivate to preserve historical integrity.
             if (delErr.code === '23503') {
               const colsRes = await client.query(
                 `SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name IN ('status', 'is_active')`,
                 [table]
               );
               const cols = colsRes.rows.map((r: any) => r.column_name);
               if (cols.includes('status')) {
                 await client.query(`UPDATE ${table} SET status='inactive', updated_at=NOW() WHERE id=$1`, [targetId]);
                 console.log(`[SyncBatch] Foreign key reference exists for ${entityType} ${targetId}. Soft-deactivated to status='inactive' to preserve ledger history.`);
               } else if (cols.includes('is_active')) {
                 await client.query(`UPDATE ${table} SET is_active=false, updated_at=NOW() WHERE id=$1`, [targetId]);
                 console.log(`[SyncBatch] Foreign key reference exists for ${entityType} ${targetId}. Soft-deactivated to is_active=false to preserve ledger history.`);
               } else {
                 throw delErr;
               }
             } else {
               throw delErr;
             }
           }
        } else {
          // Deterministic resolution loop for CREATE/UPSERT/UPDATE
          let attempt = 0;
          let opSuccess = false;
          while (attempt < 3 && !opSuccess) {
            attempt++;
            try {
              await client.query('SAVEPOINT op_sp');
              
              const existingId = await resolveEntity(client, entityType, cloudUuid, deviceId, localId, payloadObj);
              
              if (existingId) {
                // Entity exists. UPDATE it safely, preserving its true UUID.
                resolvedUuid = existingId;
                const cols = Object.keys(payloadObj).filter(k => k !== 'id' && k !== 'local_id' && k !== 'device_id');
                if (cols.length > 0) {
                   const setStr = cols.map((c, i) => `${c}=$${i + 2}`).join(', ');
                   await client.query(`UPDATE ${table} SET ${setStr} WHERE id=$1`, [resolvedUuid, ...cols.map(c => payloadObj[c])]);
                }
              } else {
                // Entity not found. Safe to INSERT.
                payloadObj.id = cloudUuid;
                payloadObj.device_id = deviceId;
                payloadObj.local_id = localId;
                const cols = Object.keys(payloadObj);
                const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
                await client.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES(${placeholders})`, cols.map(c => payloadObj[c]));
                resolvedUuid = cloudUuid;
              }
              
              await client.query('RELEASE SAVEPOINT op_sp');
              opSuccess = true;
            } catch (err: any) {
              await client.query('ROLLBACK TO SAVEPOINT op_sp');
              if (err.code === '23505') {
                 // 23505 = unique_violation. This means a concurrent transaction inserted it right after our SELECT.
                 // We loop again, which will now find the existing record and UPDATE it safely.
                 if (attempt === 3) throw new Error(`Persistent unique violation after 3 retries: ${err.message}`);
                 continue;
              }
              throw err;
            }
          }
        }

        // Record the event for downstream distribution using the resolved UUID
        await client.query(
          `INSERT INTO cloud_sync_events (event_uuid, device_id, entity_type, cloud_uuid, operation, payload)
           VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
          [eventUuid, deviceId, entityType, resolvedUuid, operation, JSON.stringify(payloadObj)]
        );

        await client.query('COMMIT');
        results.push({ eventUuid, status: 'SYNCED', resolvedUuid });
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
