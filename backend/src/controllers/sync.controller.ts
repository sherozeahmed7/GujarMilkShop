import { Request, Response } from 'express';
import { getNeonPool } from '../config/neonDb';
import { claimEventUuid, ensurePermanentReplayGuard } from '../services/neonIdempotency.service';

// ─── Per-entity INSERT builders ───────────────────────────────────────────────
// Each returns { sql, vals } for the specific Neon table.
function buildInsert(entityType: string, p: any): { sql: string; vals: any[] } {
  switch (entityType) {

    case 'User':
      return {
        sql: `INSERT INTO users
                (id,local_id,device_id,name,email,password,role,status,assigned_screens,created_at,updated_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id, p.local_id, p.device_id, p.name, p.email, p.password,
               p.role, p.status, p.assigned_screens, p.created_at, p.updated_at],
      };

    case 'Supplier':
      return {
        sql: `INSERT INTO suppliers
                (id,local_id,device_id,name,code,phone,default_rate,cow_rate,buffalo_rate,cycle_type,is_active,guaranteed_advance,created_at,updated_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id,p.local_id,p.device_id,p.name,p.code,p.phone,
               p.default_rate,p.cow_rate,p.buffalo_rate,p.cycle_type,
               p.is_active,p.guaranteed_advance,p.created_at,p.updated_at],
      };

    case 'InventoryProduct':
      return {
        sql: `INSERT INTO inventory_products
                (id,local_id,device_id,code,name,description,category,unit,tax,low_stock_threshold,is_active,is_locked,created_at,updated_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id,p.local_id,p.device_id,p.code,p.name,p.description,p.category,
               p.unit,p.tax,p.low_stock_threshold,p.is_active,p.is_locked,p.created_at,p.updated_at],
      };

    case 'DailyRate':
      return {
        sql: `INSERT INTO daily_rates
                (id,local_id,device_id,milk_rate,yogurt_rate,lassi_rate,butter_rate,ghee_rate,updated_by_role,date,created_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id,p.local_id,p.device_id,p.milk_rate,p.yogurt_rate,p.lassi_rate,
               p.butter_rate,p.ghee_rate,p.updated_by_role,p.date,p.created_at],
      };

    case 'Customer':
      return {
        sql: `INSERT INTO customers
                (id,local_id,device_id,name,phone,address,customer_type,status,created_at,updated_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
              ON CONFLICT DO NOTHING`,
        vals: [p.id,p.local_id,p.device_id,p.name,p.phone,p.address,
               p.customer_type,p.status,p.created_at,p.updated_at],
      };

    case 'Shift':
      return {
        sql: `INSERT INTO shifts
                (id,local_id,device_id,shift_date,opened_by_uuid,closed_by_uuid,opened_at,closed_at,
                 opening_cash,opening_notes,expected_cash,counted_cash,difference,difference_status,closing_notes,status,created_at,updated_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id,p.local_id,p.device_id,p.shift_date,p.opened_by_uuid,p.closed_by_uuid,
               p.opened_at,p.closed_at,p.opening_cash,p.opening_notes,p.expected_cash,
               p.counted_cash,p.difference,p.difference_status,p.closing_notes,p.status,
               p.created_at,p.updated_at],
      };

    case 'SupplierCollection':
      return {
        sql: `INSERT INTO supplier_collections
                (id,local_id,device_id,supplier_uuid,date,shift,milk_type,quantity,rate,amount,notes,created_by_uuid,created_at,updated_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id,p.local_id,p.device_id,p.supplier_uuid,p.date,p.shift,
               p.milk_type,p.quantity,p.rate,p.amount,p.notes,p.created_by_uuid,
               p.created_at,p.updated_at],
      };

    case 'SupplierPayment':
      return {
        sql: `INSERT INTO supplier_payments
                (id,local_id,device_id,supplier_uuid,shift_uuid,date,amount,method,notes,created_by_uuid,created_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id,p.local_id,p.device_id,p.supplier_uuid,p.shift_uuid,p.date,p.amount,
               p.method,p.notes,p.created_by_uuid,p.created_at],
      };

    case 'Sale':
      return {
        sql: `INSERT INTO sales
                (id,local_id,device_id,sale_type,customer_uuid,customer_name,customer_phone,
                 total_amount,paid_amount,discount_amount,remaining_balance,status,token_number,created_at,updated_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id,p.local_id,p.device_id,p.sale_type,p.customer_uuid,p.customer_name,
               p.customer_phone,p.total_amount,p.paid_amount,p.discount_amount ?? 0,p.remaining_balance,
               p.status,p.token_number ?? null,p.created_at,p.updated_at],
      };

    case 'SaleItem':
      return {
        sql: `INSERT INTO sale_items
                (id,local_id,device_id,sale_uuid,item_name,quantity,unit_price,total_price,created_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id,p.local_id,p.device_id,p.sale_uuid,p.item_name,
               p.quantity,p.unit_price,p.total_price,p.created_at],
      };

    case 'Payment':
      return {
        sql: `INSERT INTO payments
                (id,local_id,device_id,sale_uuid,method,amount,status,created_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id,p.local_id,p.device_id,p.sale_uuid,p.method,p.amount,p.status,p.created_at],
      };

    case 'Expense':
      return {
        sql: `INSERT INTO expenses
                (id,local_id,device_id,date,category,description,quantity,unit_cost,gross_loss,
                 sold_recovery,net_expense,amount,paid_amount,remaining,reason,added_by,expense_type,created_at,updated_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id,p.local_id,p.device_id,p.date,p.category,p.description,p.quantity,
               p.unit_cost,p.gross_loss,p.sold_recovery,p.net_expense,p.amount,
               p.paid_amount,p.remaining,p.reason,p.added_by,p.expense_type || p.expenseType || 'SHOP',p.created_at,p.updated_at],
      };

    case 'ExpensePayment':
      return {
        sql: `INSERT INTO expense_payments
                (id,local_id,device_id,expense_uuid,shift_uuid,amount,date,added_by,created_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id,p.local_id,p.device_id,p.expense_uuid,p.shift_uuid,
               p.amount,p.date,p.added_by,p.created_at],
      };

    case 'InventoryMovement':
      return {
        sql: `INSERT INTO inventory_movements
                (id,local_id,device_id,product_uuid,quantity,movement_type,source,reference,
                 unit_cost,supplier_uuid,shift_uuid,user_uuid,date,created_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id,p.local_id,p.device_id,p.product_uuid,p.quantity,p.movement_type,
               p.source,p.reference,p.unit_cost,p.supplier_uuid,p.shift_uuid,
               p.user_uuid,p.date,p.created_at],
      };

    case 'ButterGheeConversion':
      return {
        sql: `INSERT INTO butter_ghee_conversions
                (id,local_id,device_id,date,butter_used,ghee_produced,notes,created_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id,p.local_id,p.device_id,p.date,p.butter_used,p.ghee_produced,p.notes,p.created_at],
      };

    case 'MilkProductDailyStock':
      return {
        sql: `INSERT INTO milk_product_daily_stocks
                (id,local_id,device_id,date,milk_total,lassi_produced,lassi_sold,lassi_remaining,
                 butter_opening,butter_produced,butter_sold,butter_converted,butter_closing,
                 ghee_opening,ghee_produced,ghee_sold,ghee_closing,created_at,updated_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id,p.local_id,p.device_id,p.date,p.milk_total,
               p.lassi_produced,p.lassi_sold,p.lassi_remaining,
               p.butter_opening,p.butter_produced,p.butter_sold,p.butter_converted,p.butter_closing,
               p.ghee_opening,p.ghee_produced,p.ghee_sold,p.ghee_closing,
               p.created_at,p.updated_at],
      };

    case 'Return':
      return {
        sql: `INSERT INTO returns
                (id,local_id,device_id,sale_uuid,bill_number,date,customer,return_type,
                 refund_amount,payment_method,reason,status,processed_by,created_at,updated_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id,p.local_id,p.device_id,p.sale_uuid,p.bill_number,p.date,p.customer,
               p.return_type,p.refund_amount,p.payment_method,p.reason,p.status,
               p.processed_by,p.created_at,p.updated_at],
      };

    case 'ReturnItem':
      return {
        sql: `INSERT INTO return_items
                (id,local_id,device_id,return_uuid,item_id,name,return_qty,unit_price,refund_amount)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id,p.local_id,p.device_id,p.return_uuid,p.item_id,p.name,
               p.return_qty,p.unit_price,p.refund_amount],
      };

    case 'AuditRecord':
      return {
        sql: `INSERT INTO audit_records
                (id,local_id,device_id,audit_date,executed_at,total_pos_bills,collected_receipts,
                 matched,missing,extra,duplicates,status,notes,audited_by,created_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id,p.local_id,p.device_id,p.audit_date,p.executed_at,p.total_pos_bills,
               p.collected_receipts,p.matched,p.missing,p.extra,p.duplicates,
               p.status,p.notes,p.audited_by,p.created_at],
      };

    // ── Phase 4A test type kept for backward-compatibility ──
    case 'TestCustomer':
      return {
        sql: `INSERT INTO customers (id,local_id,device_id,name,phone,customer_type)
              VALUES($1,$2,$3,$4,$5,$6)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [p.id ?? p.cloudUuid, p.local_id, p.device_id, p.name, p.phone ?? null, p.customer_type ?? 'retail'],
      };

    case 'ActivityLog':
      return {
        sql: `INSERT INTO activity_logs
                (id,local_id,device_id,timestamp,"user",user_role,action,module,description,entity_id,ip,status,created_at,updated_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
              ON CONFLICT(device_id,local_id) DO NOTHING`,
        vals: [
          p.id, p.local_id, p.device_id,
          p.timestamp, p.user, p.user_role,
          p.action, p.module, p.description,
          p.entity_id ?? null, p.ip ?? null, p.status,
          p.created_at, p.updated_at
        ],
      };

    default:
      throw new Error(`Unsupported entityType for migration: ${entityType}`);
  }
}

// ─── Controller ───────────────────────────────────────────────────────────────
export const migrateBatch = async (req: Request, res: Response): Promise<void> => {
  const { migrationId, batchId, payloads } = req.body;

  if (!migrationId || batchId === undefined || !Array.isArray(payloads)) {
    res.status(400).json({ error: 'Invalid migration request payload.' });
    return;
  }

  const pool = getNeonPool();
  const client = await pool.connect();

  let insertedCount = 0;
  let skippedCount = 0;

  try {
    await ensurePermanentReplayGuard(client);
    await client.query('BEGIN');

    for (const item of payloads) {
      const { eventUuid, deviceId, entityType, localId, cloudUuid, operation, payload } = item;

      if (!eventUuid || !deviceId || !entityType || localId === undefined || !cloudUuid || !operation || !payload) {
        throw new Error(`Malformed payload item: missing required fields (entity: ${entityType})`);
      }
      if (operation !== 'CREATE') {
        throw new Error(`Migration only supports CREATE operations. Got: ${operation}`);
      }

      // 1. Permanent idempotency claim — inside the migration transaction.
      if (!(await claimEventUuid(client, eventUuid))) {
        skippedCount++;
        continue;
      }

      // 2. Build and execute business INSERT
      const payloadObj = typeof payload === 'string' ? JSON.parse(payload) : payload;
      const { sql, vals } = buildInsert(entityType, payloadObj);
      await client.query(sql, vals);

      // 3. Replay protection is permanently handled by processed_event_keys (claimed above)

      insertedCount++;
    }

    await client.query('COMMIT');

    res.status(200).json({
      status: 'success',
      migrationId,
      batchId,
      recordsReceived: payloads.length,
      recordsInserted: insertedCount,
      recordsSkipped: skippedCount,
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error(`[Sync API] Batch ${batchId} (${migrationId}) ROLLED BACK:`, error.message);
    res.status(500).json({
      status: 'error',
      migrationId,
      batchId,
      error: error.message,
    });
  } finally {
    client.release();
  }
};
