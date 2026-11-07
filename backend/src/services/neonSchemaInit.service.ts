import { getNeonPool } from '../config/neonDb';

export const NEON_POSTGRES_SCHEMA = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Master Data Tables
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  password VARCHAR NOT NULL,
  role VARCHAR NOT NULL DEFAULT 'cashier',
  status VARCHAR NOT NULL DEFAULT 'active',
  assigned_screens JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS daily_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  milk_rate DECIMAL NOT NULL,
  yogurt_rate DECIMAL NOT NULL,
  lassi_rate DECIMAL NOT NULL DEFAULT 0,
  butter_rate DECIMAL NOT NULL DEFAULT 0,
  ghee_rate DECIMAL NOT NULL DEFAULT 0,
  updated_by_role VARCHAR NOT NULL,
  date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  phone VARCHAR,
  address TEXT,
  customer_type VARCHAR NOT NULL DEFAULT 'retail',
  status VARCHAR NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  code VARCHAR UNIQUE NOT NULL,
  phone VARCHAR,
  default_rate DECIMAL NOT NULL DEFAULT 0,
  cow_rate DECIMAL NOT NULL DEFAULT 0,
  buffalo_rate DECIMAL NOT NULL DEFAULT 0,
  cycle_type VARCHAR NOT NULL DEFAULT 'weekly',
  is_active BOOLEAN NOT NULL DEFAULT true,
  guaranteed_advance DECIMAL NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS inventory_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  code VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  category VARCHAR NOT NULL,
  unit VARCHAR NOT NULL,
  tax VARCHAR NOT NULL DEFAULT 'exempt',
  low_stock_threshold DECIMAL NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

-- Transaction Tables
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  shift_date VARCHAR NOT NULL,
  opened_by_uuid UUID REFERENCES users(id),
  closed_by_uuid UUID REFERENCES users(id),
  opened_at TIMESTAMP NOT NULL,
  closed_at TIMESTAMP,
  opening_cash DECIMAL NOT NULL,
  opening_notes TEXT,
  expected_cash DECIMAL,
  counted_cash DECIMAL,
  difference DECIMAL,
  difference_status VARCHAR,
  closing_notes TEXT,
  status VARCHAR NOT NULL DEFAULT 'Open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  sale_type VARCHAR NOT NULL DEFAULT 'retail',
  customer_uuid UUID REFERENCES customers(id),
  customer_name VARCHAR,
  customer_phone VARCHAR,
  total_amount DECIMAL NOT NULL,
  paid_amount DECIMAL NOT NULL,
  discount_amount DECIMAL NOT NULL DEFAULT 0,
  remaining_balance DECIMAL NOT NULL DEFAULT 0,
  status VARCHAR NOT NULL DEFAULT 'completed',
  token_number VARCHAR,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  sale_uuid UUID REFERENCES sales(id) ON DELETE CASCADE,
  item_name VARCHAR NOT NULL,
  quantity DECIMAL NOT NULL,
  unit_price DECIMAL NOT NULL,
  total_price DECIMAL NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  sale_uuid UUID REFERENCES sales(id) ON DELETE CASCADE,
  method VARCHAR NOT NULL,
  amount DECIMAL NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS supplier_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  supplier_uuid UUID REFERENCES suppliers(id),
  date VARCHAR NOT NULL,
  shift VARCHAR NOT NULL,
  milk_type VARCHAR NOT NULL,
  quantity DECIMAL NOT NULL,
  rate DECIMAL NOT NULL,
  amount DECIMAL NOT NULL,
  notes TEXT,
  created_by_uuid UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  supplier_uuid UUID REFERENCES suppliers(id),
  shift_uuid UUID REFERENCES shifts(id),
  date VARCHAR NOT NULL,
  amount DECIMAL NOT NULL,
  method VARCHAR NOT NULL,
  notes TEXT,
  created_by_uuid UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  product_uuid UUID REFERENCES inventory_products(id),
  quantity DECIMAL NOT NULL,
  movement_type VARCHAR NOT NULL,
  source VARCHAR NOT NULL,
  reference VARCHAR,
  unit_cost DECIMAL,
  supplier_uuid UUID REFERENCES suppliers(id),
  shift_uuid UUID REFERENCES shifts(id),
  user_uuid UUID REFERENCES users(id),
  date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  date VARCHAR NOT NULL,
  category VARCHAR NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL,
  unit_cost DECIMAL,
  gross_loss DECIMAL,
  sold_recovery DECIMAL,
  net_expense DECIMAL,
  amount DECIMAL NOT NULL,
  paid_amount DECIMAL NOT NULL DEFAULT 0,
  remaining DECIMAL NOT NULL,
  reason TEXT,
  added_by VARCHAR NOT NULL,
  expense_type VARCHAR NOT NULL DEFAULT 'SHOP',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS expense_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  expense_uuid UUID REFERENCES expenses(id) ON DELETE CASCADE,
  shift_uuid UUID REFERENCES shifts(id),
  amount DECIMAL NOT NULL,
  date VARCHAR NOT NULL,
  added_by VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  sale_uuid UUID REFERENCES sales(id),
  bill_number VARCHAR,
  date VARCHAR NOT NULL,
  customer VARCHAR NOT NULL,
  return_type VARCHAR NOT NULL,
  refund_amount DECIMAL NOT NULL,
  payment_method VARCHAR,
  reason TEXT,
  status VARCHAR NOT NULL DEFAULT 'completed',
  processed_by VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  return_uuid UUID REFERENCES returns(id) ON DELETE CASCADE,
  item_id VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  return_qty DECIMAL NOT NULL,
  unit_price DECIMAL NOT NULL,
  refund_amount DECIMAL NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS butter_ghee_conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  butter_used DECIMAL NOT NULL,
  ghee_produced DECIMAL NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS milk_product_daily_stocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  milk_total DECIMAL NOT NULL DEFAULT 0,
  lassi_produced DECIMAL NOT NULL DEFAULT 0,
  lassi_sold DECIMAL NOT NULL DEFAULT 0,
  lassi_remaining DECIMAL NOT NULL DEFAULT 0,
  butter_opening DECIMAL NOT NULL DEFAULT 0,
  butter_produced DECIMAL NOT NULL DEFAULT 0,
  butter_sold DECIMAL NOT NULL DEFAULT 0,
  butter_converted DECIMAL NOT NULL DEFAULT 0,
  butter_closing DECIMAL NOT NULL DEFAULT 0,
  ghee_opening DECIMAL NOT NULL DEFAULT 0,
  ghee_produced DECIMAL NOT NULL DEFAULT 0,
  ghee_sold DECIMAL NOT NULL DEFAULT 0,
  ghee_closing DECIMAL NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id),
  UNIQUE(device_id, date)
);

CREATE TABLE IF NOT EXISTS audit_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  audit_date VARCHAR NOT NULL,
  executed_at TIMESTAMP NOT NULL,
  total_pos_bills INT NOT NULL,
  collected_receipts INT NOT NULL,
  matched JSONB NOT NULL,
  missing JSONB NOT NULL,
  extra JSONB NOT NULL,
  duplicates JSONB NOT NULL,
  status VARCHAR NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  audited_by VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS cash_persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  phone VARCHAR,
  address VARCHAR,
  type VARCHAR NOT NULL,
  description TEXT,
  opening_balance DECIMAL NOT NULL DEFAULT 0,
  customer_type VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS cashbook_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  cash_person_uuid UUID REFERENCES cash_persons(id) ON DELETE CASCADE,
  cash_person_name VARCHAR NOT NULL,
  transaction_type VARCHAR NOT NULL,
  amount DECIMAL NOT NULL,
  description TEXT,
  date VARCHAR NOT NULL,
  created_by VARCHAR NOT NULL DEFAULT 'Admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT NOT NULL,
  device_id VARCHAR NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "user" VARCHAR NOT NULL,
  user_role VARCHAR NOT NULL,
  action VARCHAR NOT NULL,
  module VARCHAR NOT NULL,
  description TEXT NOT NULL,
  entity_id VARCHAR,
  ip VARCHAR,
  status VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, local_id)
);

CREATE TABLE IF NOT EXISTS processed_event_keys (
  event_uuid UUID PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS idempotency_log (
  event_uuid UUID PRIMARY KEY,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  device_id VARCHAR NOT NULL,
  entity_type VARCHAR NOT NULL,
  operation VARCHAR NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_single_walk_in_key
ON customers (customer_type) WHERE customer_type = 'walk_in';

CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_uuid);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_uuid);
CREATE INDEX IF NOT EXISTS idx_inventory_product_date ON inventory_movements(product_uuid, date);
CREATE INDEX IF NOT EXISTS idx_supplier_date ON supplier_collections(supplier_uuid, date);
CREATE INDEX IF NOT EXISTS idx_returns_sale ON returns(sale_uuid);
CREATE INDEX IF NOT EXISTS idx_expense_payments_expense ON expense_payments(expense_uuid);
CREATE INDEX IF NOT EXISTS idx_cashbook_person ON cashbook_transactions(cash_person_uuid);
CREATE INDEX IF NOT EXISTS idx_cashbook_date ON cashbook_transactions(date);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
`;

let schemaInitialized = false;

export async function ensureNeonSchema(): Promise<void> {
  if (schemaInitialized) return;
  if (!process.env.NEON_DATABASE_URL) return;

  try {
    const pool = getNeonPool();
    const client = await pool.connect();
    try {
      await client.query(NEON_POSTGRES_SCHEMA);
      // Additive column for existing Neon databases
      await client.query(`
        ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS expense_type VARCHAR NOT NULL DEFAULT 'SHOP';
        ALTER TABLE IF EXISTS sales ADD COLUMN IF NOT EXISTS discount_amount DECIMAL NOT NULL DEFAULT 0;
        ALTER TABLE IF EXISTS returns ALTER COLUMN customer DROP NOT NULL;
        ALTER TABLE IF EXISTS shifts DROP CONSTRAINT IF EXISTS shifts_device_id_shift_date_key;
        CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(expense_type);
        CREATE INDEX IF NOT EXISTS idx_expenses_type_date ON expenses(expense_type, date);
        CREATE INDEX IF NOT EXISTS idx_sales_discount_amount ON sales(discount_amount);
        INSERT INTO customers (id, local_id, device_id, name, customer_type, status)
        VALUES ('00000000-0000-4000-8000-000000000001', 0, 'SYSTEM', 'Walk-in Customer', 'walk_in', 'active')
        ON CONFLICT (id) DO NOTHING;
      `);
      schemaInitialized = true;
      console.log('✅ [Neon] Cloud PostgreSQL schema verified and ready.');
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('⚠️ [Neon] Failed to verify/create cloud PostgreSQL schema:', err.message);
  }
}
