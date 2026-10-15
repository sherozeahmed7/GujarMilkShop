import { PoolClient, Pool } from 'pg';
import { getNeonPool } from '../config/neonDb';

/**
 * Service to manage permanent daily Walk-In aggregations in Neon PostgreSQL.
 * Provides idempotent rollup calculations and upsert operations.
 */
export class WalkInAggregationService {
  /**
   * Ensure the summary tables exist in Neon PostgreSQL.
   */
  static async ensureNeonSummaryTables(client?: PoolClient | Pool): Promise<void> {
    const db = client || getNeonPool();
    await db.query(`
      CREATE TABLE IF NOT EXISTS walk_in_daily_summaries (
        id                BIGSERIAL PRIMARY KEY,
        business_date     DATE NOT NULL,
        bill_count        INTEGER NOT NULL DEFAULT 0,
        gross_sales       NUMERIC(12,2) NOT NULL DEFAULT 0,
        discount_total    NUMERIC(12,2) NOT NULL DEFAULT 0,
        return_total      NUMERIC(12,2) NOT NULL DEFAULT 0,
        net_sales         NUMERIC(12,2) NOT NULL DEFAULT 0,
        cash_collected    NUMERIC(12,2) NOT NULL DEFAULT 0,
        online_collected  NUMERIC(12,2) NOT NULL DEFAULT 0,
        cost_of_goods     NUMERIC(12,2) NOT NULL DEFAULT 0,
        gross_profit      NUMERIC(12,2) NOT NULL DEFAULT 0,
        return_bill_count INTEGER NOT NULL DEFAULT 0,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(business_date)
      );

      CREATE TABLE IF NOT EXISTS walk_in_daily_item_summaries (
        id              BIGSERIAL PRIMARY KEY,
        business_date   DATE NOT NULL,
        product_uuid    UUID NOT NULL REFERENCES inventory_products(id),
        product_name    VARCHAR(100) NOT NULL,
        quantity_sold   NUMERIC(10,3) NOT NULL DEFAULT 0,
        gross_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
        discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        return_quantity NUMERIC(10,3) NOT NULL DEFAULT 0,
        return_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
        cost_per_unit   NUMERIC(10,4),
        cost_total      NUMERIC(12,2) NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(business_date, product_uuid)
      );

      CREATE INDEX IF NOT EXISTS idx_wids_date ON walk_in_daily_item_summaries(business_date);
    `);
  }

  /**
   * Deterministically calculates and upserts both the financial and item-level
   * daily summaries for a given business date from detailed Neon tables.
   */
  static async upsertDailySummaryForDate(businessDate: string, client?: PoolClient | Pool): Promise<{
    financialSummaryUpserted: boolean;
    itemSummariesUpserted: number;
    businessDate: string;
    grossSales: number;
    billCount: number;
  }> {
    const db = client || getNeonPool();
    await this.ensureNeonSummaryTables(db);

    // 1. Calculate Financial Totals for Walk-In sales on this date
    const finRes = await db.query(
      `
      WITH day_sales AS (
        SELECT 
          id,
          total_amount,
          paid_amount,
          remaining_balance,
          created_at
        FROM sales
        WHERE sale_type = 'walk_in'
          AND (created_at AT TIME ZONE 'Asia/Karachi')::date = $1::date
      ),
      day_payments AS (
        SELECT 
          p.method,
          p.amount
        FROM payments p
        JOIN day_sales s ON p.sale_uuid = s.id
      ),
      day_returns AS (
        SELECT 
          r.refund_amount,
          r.id
        FROM returns r
        WHERE (r.created_at AT TIME ZONE 'Asia/Karachi')::date = $1::date
      )
      SELECT 
        (SELECT COUNT(*) FROM day_sales) AS bill_count,
        COALESCE((SELECT SUM(total_amount) FROM day_sales), 0) AS gross_sales,
        COALESCE((SELECT SUM(amount) FROM day_payments WHERE LOWER(method) = 'cash'), 0) AS cash_collected,
        COALESCE((SELECT SUM(amount) FROM day_payments WHERE LOWER(method) IN ('online', 'card', 'bank', 'easypaisa', 'jazzcash')), 0) AS online_collected,
        COALESCE((SELECT SUM(refund_amount) FROM day_returns), 0) AS return_total,
        COALESCE((SELECT COUNT(*) FROM day_returns), 0) AS return_bill_count
      `,
      [businessDate]
    );

    const row = finRes.rows[0] || {
      bill_count: 0,
      gross_sales: 0,
      cash_collected: 0,
      online_collected: 0,
      return_total: 0,
      return_bill_count: 0,
    };

    const billCount = parseInt(row.bill_count || '0', 10);
    const grossSales = parseFloat(row.gross_sales || '0');
    const returnTotal = parseFloat(row.return_total || '0');
    const netSales = grossSales - returnTotal;
    const cashCollected = parseFloat(row.cash_collected || '0');
    const onlineCollected = parseFloat(row.online_collected || '0');

    // UPSERT walk_in_daily_summaries
    await db.query(
      `
      INSERT INTO walk_in_daily_summaries (
        business_date, bill_count, gross_sales, discount_total, return_total,
        net_sales, cash_collected, online_collected, cost_of_goods, gross_profit,
        return_bill_count, updated_at
      )
      VALUES ($1, $2, $3, 0, $4, $5, $6, $7, 0, 0, $8, NOW())
      ON CONFLICT (business_date) DO UPDATE SET
        bill_count = EXCLUDED.bill_count,
        gross_sales = EXCLUDED.gross_sales,
        return_total = EXCLUDED.return_total,
        net_sales = EXCLUDED.net_sales,
        cash_collected = EXCLUDED.cash_collected,
        online_collected = EXCLUDED.online_collected,
        return_bill_count = EXCLUDED.return_bill_count,
        updated_at = NOW()
      `,
      [businessDate, billCount, grossSales, returnTotal, netSales, cashCollected, onlineCollected, row.return_bill_count]
    );

    // 2. Calculate Item Summaries for Walk-In sales on this date (case-insensitive product match)
    const itemRes = await db.query(
      `
      SELECT 
        p.id AS product_uuid,
        p.name AS product_name,
        COALESCE(SUM(si.quantity), 0) AS quantity_sold,
        COALESCE(SUM(si.total_price), 0) AS gross_amount
      FROM sales s
      JOIN sale_items si ON si.sale_uuid = s.id
      JOIN inventory_products p ON (LOWER(p.name) = LOWER(si.item_name) OR p.id::text = si.item_name)
      WHERE s.sale_type = 'walk_in'
        AND (s.created_at AT TIME ZONE 'Asia/Karachi')::date = $1::date
      GROUP BY p.id, p.name
      `,
      [businessDate]
    );

    let itemsUpserted = 0;
    for (const iRow of itemRes.rows) {
      await db.query(
        `
        INSERT INTO walk_in_daily_item_summaries (
          business_date, product_uuid, product_name, quantity_sold, gross_amount,
          discount_amount, return_quantity, return_amount, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 0, 0, 0, NOW())
        ON CONFLICT (business_date, product_uuid) DO UPDATE SET
          product_name = EXCLUDED.product_name,
          quantity_sold = EXCLUDED.quantity_sold,
          gross_amount = EXCLUDED.gross_amount,
          updated_at = NOW()
        `,
        [businessDate, iRow.product_uuid, iRow.product_name, iRow.quantity_sold, iRow.gross_amount]
      );
      itemsUpserted++;
    }

    return {
      financialSummaryUpserted: true,
      itemSummariesUpserted: itemsUpserted,
      businessDate,
      grossSales,
      billCount,
    };
  }

  /**
   * Backfill / regenerate daily summaries for all historical dates with Walk-In sales.
   */
  static async regenerateAllHistoricalSummaries(): Promise<{
    datesProcessed: number;
    details: Array<{ businessDate: string; billCount: number; grossSales: number }>;
  }> {
    const db = getNeonPool();
    await this.ensureNeonSummaryTables(db);

    const datesRes = await db.query(`
      SELECT DISTINCT (created_at AT TIME ZONE 'Asia/Karachi')::date::text AS b_date
      FROM sales
      WHERE sale_type = 'walk_in'
      ORDER BY b_date ASC
    `);

    const details: Array<{ businessDate: string; billCount: number; grossSales: number }> = [];

    for (const row of datesRes.rows) {
      const bDate = row.b_date;
      const res = await this.upsertDailySummaryForDate(bDate, db);
      details.push({
        businessDate: bDate,
        billCount: res.billCount,
        grossSales: res.grossSales,
      });
    }

    return {
      datesProcessed: details.length,
      details,
    };
  }
}
