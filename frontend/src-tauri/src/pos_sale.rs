use chrono::{Datelike, Local, NaiveDate, Utc};
use rusqlite::{params, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct SaleItemInput {
    #[serde(rename = "itemName")]
    pub item_name: String,
    pub quantity: f64,
    #[serde(rename = "unitPrice")]
    pub unit_price: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct CreateSalePayload {
    #[serde(rename = "saleType")]
    pub sale_type: String,
    pub items: Vec<SaleItemInput>,
    #[serde(rename = "totalAmount")]
    pub total_amount: f64,
    #[serde(rename = "paidAmount")]
    pub paid_amount: Option<f64>,
    #[serde(rename = "paymentMethod")]
    pub payment_method: Option<String>,
    #[serde(rename = "customerId")]
    pub customer_id: Option<i64>,
    #[serde(rename = "customerName")]
    pub customer_name: Option<String>,
    #[serde(rename = "customerPhone")]
    pub customer_phone: Option<String>,
    #[serde(rename = "discountAmount")]
    pub discount_amount: Option<f64>,
    #[serde(rename = "checkoutUuid")]
    pub checkout_uuid: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SavedSaleItem {
    pub id: i64,
    #[serde(rename = "saleId")]
    pub sale_id: i64,
    #[serde(rename = "itemName")]
    pub item_name: String,
    pub quantity: f64,
    #[serde(rename = "unitPrice")]
    pub unit_price: f64,
    #[serde(rename = "totalPrice")]
    pub total_price: f64,
    #[serde(rename = "cloudUuid")]
    pub cloud_uuid: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SavedSalePayment {
    pub id: i64,
    #[serde(rename = "saleId")]
    pub sale_id: i64,
    pub method: String,
    pub amount: f64,
    pub status: String,
    #[serde(rename = "cloudUuid")]
    pub cloud_uuid: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SavedSaleResponse {
    pub id: i64,
    #[serde(rename = "saleType")]
    pub sale_type: String,
    #[serde(rename = "customerId")]
    pub customer_id: Option<i64>,
    #[serde(rename = "customerName")]
    pub customer_name: Option<String>,
    #[serde(rename = "customerPhone")]
    pub customer_phone: Option<String>,
    #[serde(rename = "totalAmount")]
    pub total_amount: f64,
    #[serde(rename = "paidAmount")]
    pub paid_amount: f64,
    #[serde(rename = "discountAmount")]
    pub discount_amount: f64,
    #[serde(rename = "remainingBalance")]
    pub remaining_balance: f64,
    pub status: String,
    #[serde(rename = "tokenNumber")]
    pub token_number: i64,
    #[serde(rename = "cloudUuid")]
    pub cloud_uuid: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    pub items: Vec<SavedSaleItem>,
    pub payments: Vec<SavedSalePayment>,
}

fn round_money(val: f64) -> f64 {
    (val * 100.0).round() / 100.0
}

/// Resolves path to the production SQLite pos.db
pub fn get_sqlite_db_path() -> PathBuf {
    if let Ok(app_data) = std::env::var("APPDATA") {
        let p = PathBuf::from(app_data)
            .join("com.shero.tauri-app")
            .join("pos.db");
        if p.exists() {
            return p;
        }
    }

    // Fallbacks for dev environments
    let dev_candidates = [
        "../../backend/prisma/pos.db",
        "../backend/prisma/pos.db",
        "backend/prisma/pos.db",
    ];

    for candidate in &dev_candidates {
        let p = PathBuf::from(candidate);
        if p.exists() {
            return p;
        }
    }

    // Default to APPDATA location even if not yet created
    let app_data = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
    PathBuf::from(app_data)
        .join("com.shero.tauri-app")
        .join("pos.db")
}

/// Reads deviceId from .device-id file in %APPDATA%\com.shero.tauri-app or generates/saves one
pub fn get_device_id() -> String {
    let app_data = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
    let dev_id_path = PathBuf::from(app_data)
        .join("com.shero.tauri-app")
        .join(".device-id");

    if dev_id_path.exists() {
        if let Ok(id) = std::fs::read_to_string(&dev_id_path) {
            let trimmed = id.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }

    let new_id = Uuid::new_v4().to_string();
    if let Some(parent) = dev_id_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(&dev_id_path, &new_id);
    new_id
}

pub fn get_journal_path() -> PathBuf {
    let app_data = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
    let dir = PathBuf::from(app_data).join("com.shero.tauri-app");
    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    dir.join("pending_checkout.journal")
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PendingJournalEntry {
    pub checkout_uuid: String,
    pub timestamp: String,
    pub payload: CreateSalePayload,
}

/// Durably write a tiny PENDING recovery record in append-only format
#[tauri::command]
pub fn write_pending_journal(payload: CreateSalePayload) -> Result<(), String> {
    let checkout_uuid = payload
        .checkout_uuid
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let timestamp = Utc::now().to_rfc3339();

    let entry = PendingJournalEntry {
        checkout_uuid,
        timestamp,
        payload,
    };

    let line = serde_json::to_string(&entry)
        .map_err(|e| format!("Failed to serialize journal entry: {e}"))?;

    let journal_path = get_journal_path();
    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&journal_path)
        .map_err(|e| format!("Failed to open journal file {:?}: {e}", journal_path))?;

    writeln!(file, "{}", line)
        .map_err(|e| format!("Failed to write journal entry: {e}"))?;
    file.sync_data()
        .map_err(|e| format!("Failed to sync journal entry to disk: {e}"))?;

    Ok(())
}

/// Remove a committed checkoutUuid from the pending journal
#[tauri::command]
pub fn clear_pending_journal(checkout_uuid: String) -> Result<(), String> {
    let journal_path = get_journal_path();
    if !journal_path.exists() {
        return Ok(());
    }

    let content = match std::fs::read_to_string(&journal_path) {
        Ok(c) => c,
        Err(_) => return Ok(()),
    };

    let mut remaining_lines: Vec<String> = Vec::new();
    let mut removed = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Ok(entry) = serde_json::from_str::<PendingJournalEntry>(trimmed) {
            if entry.checkout_uuid == checkout_uuid {
                removed = true;
                continue;
            }
        }
        remaining_lines.push(trimmed.to_string());
    }

    if removed {
        use std::io::Write;
        let mut temp_path = journal_path.clone();
        temp_path.set_extension("journal.tmp");

        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&temp_path)
            .map_err(|e| format!("Failed to open temp journal: {e}"))?;

        for r_line in &remaining_lines {
            writeln!(file, "{}", r_line).map_err(|e| e.to_string())?;
        }
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);

        let _ = std::fs::rename(&temp_path, &journal_path);
    }

    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecoveryReport {
    pub total_journal_entries: usize,
    pub already_committed: usize,
    pub recovered_and_committed: usize,
    pub failed_retries: usize,
}

/// Scan pending checkout journal on startup, verify with SQLite, and retry any uncommitted sales
#[tauri::command]
pub async fn recover_pending_journal() -> Result<RecoveryReport, String> {
    tauri::async_runtime::spawn_blocking(move || execute_recover_pending_journal())
        .await
        .map_err(|e| format!("Recovery worker thread failed: {e}"))?
}

fn execute_recover_pending_journal() -> Result<RecoveryReport, String> {
    let journal_path = get_journal_path();
    if !journal_path.exists() {
        return Ok(RecoveryReport {
            total_journal_entries: 0,
            already_committed: 0,
            recovered_and_committed: 0,
            failed_retries: 0,
        });
    }

    let content = match std::fs::read_to_string(&journal_path) {
        Ok(c) => c,
        Err(e) => return Err(format!("Could not read journal file: {e}")),
    };

    let lines: Vec<&str> = content.lines().filter(|l| !l.trim().is_empty()).collect();
    let total = lines.len();
    if total == 0 {
        return Ok(RecoveryReport {
            total_journal_entries: 0,
            already_committed: 0,
            recovered_and_committed: 0,
            failed_retries: 0,
        });
    }

    let db_path = get_sqlite_db_path();
    if !db_path.exists() {
        return Err("Database not found for recovery".into());
    }

    let conn = Connection::open_with_flags(
        &db_path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("Failed to open DB during recovery: {e}"))?;

    let mut already_committed = 0;
    let mut recovered_and_committed = 0;
    let mut failed_retries = 0;
    let mut still_pending: Vec<String> = Vec::new();

    for line in lines {
        if let Ok(entry) = serde_json::from_str::<PendingJournalEntry>(line) {
            let exists: Result<i64, _> = conn.query_row(
                "SELECT id FROM Sale WHERE cloudUuid = ?1 LIMIT 1",
                params![&entry.checkout_uuid],
                |row| row.get(0),
            );

            match exists {
                Ok(_) => {
                    // Already in SQLite: remove from journal
                    already_committed += 1;
                }
                Err(_) => {
                    // Not in SQLite: attempt idempotent commit
                    match execute_save_pos_sale(entry.payload.clone()) {
                        Ok(_) => {
                            recovered_and_committed += 1;
                        }
                        Err(e) => {
                            eprintln!("[RECOVERY] Failed to commit uncommitted sale {}: {}", entry.checkout_uuid, e);
                            failed_retries += 1;
                            still_pending.push(line.to_string());
                        }
                    }
                }
            }
        }
    }

    // Rewrite journal with only failed retries (if any)
    use std::io::Write;
    let mut temp_path = journal_path.clone();
    temp_path.set_extension("journal.tmp");

    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&temp_path)
        .map_err(|e| format!("Failed to rewrite journal: {e}"))?;

    for r_line in &still_pending {
        writeln!(file, "{}", r_line).map_err(|e| e.to_string())?;
    }
    file.sync_all().map_err(|e| e.to_string())?;
    drop(file);

    let _ = std::fs::rename(&temp_path, &journal_path);

    Ok(RecoveryReport {
        total_journal_entries: total,
        already_committed,
        recovered_and_committed,
        failed_retries,
    })
}

/// Dedicated Tauri command to execute atomic Cash OK sale directly in local SQLite
#[tauri::command]
pub async fn save_pos_sale(payload: CreateSalePayload) -> Result<SavedSaleResponse, String> {
    tauri::async_runtime::spawn_blocking(move || execute_save_pos_sale(payload))
        .await
        .map_err(|e| format!("Worker thread failed: {e}"))?
}

fn execute_save_pos_sale(payload: CreateSalePayload) -> Result<SavedSaleResponse, String> {
    let db_path = get_sqlite_db_path();
    if !db_path.exists() {
        return Err(format!(
            "SQLite database not found at {:?}. Please ensure the application is initialized.",
            db_path
        ));
    }

    let mut conn = Connection::open_with_flags(
        &db_path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("Failed to open SQLite database: {e}"))?;

    // Set busy timeout so if background worker holds a short write lock, we wait up to 5000ms
    conn.busy_timeout(std::time::Duration::from_millis(5000))
        .map_err(|e| format!("Failed to set SQLite busy timeout: {e}"))?;

    // Basic Validation
    if payload.items.is_empty() {
        return Err("Items array cannot be empty".into());
    }
    let total = round_money(payload.total_amount);
    if total <= 0.0 {
        return Err("Total amount must be greater than 0".into());
    }

    let mut items_sum = 0.0;
    for it in &payload.items {
        if it.quantity <= 0.0 {
            return Err("Item quantity must be greater than 0".into());
        }
        if it.unit_price < 0.0 {
            return Err("Item unit price cannot be negative".into());
        }
        let line_total = round_money(it.quantity * it.unit_price);
        items_sum = round_money(items_sum + line_total);
    }

    if (items_sum - total).abs() > 0.01 {
        return Err(format!(
            "Total amount ({}) does not match sum of items ({})",
            total, items_sum
        ));
    }

    let checkout_uuid = payload
        .checkout_uuid
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    // 1. Idempotency Check (outside write transaction for speed)
    let existing: Result<(i64, i64, f64, f64, f64, f64, String, String, String), _> = conn.query_row(
        "SELECT id, tokenNumber, totalAmount, paidAmount, discountAmount, remainingBalance, status, createdAt, updatedAt 
         FROM Sale WHERE cloudUuid = ?1 LIMIT 1",
        params![&checkout_uuid],
        |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4).unwrap_or(0.0),
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
                row.get(8)?,
            ))
        },
    );

    if let Ok((id, token, tot, paid, disc, rem, st, created_at, updated_at)) = existing {
        // Fetch existing items & payments
        let mut item_stmt = conn
            .prepare("SELECT id, saleId, itemName, quantity, unitPrice, totalPrice, cloudUuid FROM SaleItem WHERE saleId = ?1")
            .map_err(|e| e.to_string())?;
        let existing_items = item_stmt
            .query_map(params![id], |row| {
                Ok(SavedSaleItem {
                    id: row.get(0)?,
                    sale_id: row.get(1)?,
                    item_name: row.get(2)?,
                    quantity: row.get(3)?,
                    unit_price: row.get(4)?,
                    total_price: row.get(5)?,
                    cloud_uuid: row.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut pay_stmt = conn
            .prepare("SELECT id, saleId, method, amount, status, cloudUuid FROM Payment WHERE saleId = ?1")
            .map_err(|e| e.to_string())?;
        let existing_payments = pay_stmt
            .query_map(params![id], |row| {
                Ok(SavedSalePayment {
                    id: row.get(0)?,
                    sale_id: row.get(1)?,
                    method: row.get(2)?,
                    amount: row.get(3)?,
                    status: row.get(4)?,
                    cloud_uuid: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        return Ok(SavedSaleResponse {
            id,
            sale_type: payload.sale_type,
            customer_id: payload.customer_id,
            customer_name: payload.customer_name,
            customer_phone: payload.customer_phone,
            total_amount: tot,
            paid_amount: paid,
            discount_amount: disc,
            remaining_balance: rem,
            status: st,
            token_number: token,
            cloud_uuid: Some(checkout_uuid),
            created_at,
            updated_at,
            items: existing_items,
            payments: existing_payments,
        });
    }

    // 2. Butter & Ghee inventory stock gate (assert sufficient stock)
    for it in &payload.items {
        let lower = it.item_name.to_lowercase();
        if lower == "butter" || lower == "ghee" {
            let available: f64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(im.quantity), 0.0) 
                     FROM InventoryMovement im
                     JOIN InventoryProduct ip ON ip.id = im.productId
                     WHERE UPPER(ip.code) = UPPER(?1) OR UPPER(ip.name) = UPPER(?1)",
                    params![&lower],
                    |row| row.get(0),
                )
                .unwrap_or(0.0);

            if available < it.quantity {
                let label = if lower == "butter" { "Butter" } else { "Ghee" };
                if available <= 0.0 {
                    return Err(format!(
                        "Cannot sell {label}. Inventory stock is 0 kg. Add {label} stock in Inventory first."
                    ));
                }
                return Err(format!(
                    "Cannot sell {} kg {label}. Only {} kg available in Inventory. Add more stock or reduce quantity.",
                    it.quantity, available
                ));
            }
        }
    }

    // 3. Resolve Customer ID
    let final_customer_id: Option<i64> = if payload.sale_type == "walk_in" {
        // Canonical walk-in customer lookup
        let c_id: Result<i64, _> = conn.query_row(
            "SELECT id FROM Customer WHERE customerType = 'walk_in' ORDER BY id ASC LIMIT 1",
            [],
            |row| row.get(0),
        );
        match c_id {
            Ok(id) => Some(id),
            Err(_) => {
                // Insert walk-in customer if missing
                // Use Unix ms (i64) to match Prisma's DateTime storage format
                let now_ms = Utc::now().timestamp_millis();
                conn.execute(
                    "INSERT INTO Customer (name, customerType, status, cloudUuid, createdAt, updatedAt) 
                     VALUES (?1, 'walk_in', 'active', '00000000-0000-4000-8000-000000000001', ?2, ?2)",
                    params!["Walk-In Customer", now_ms],
                ).map_err(|e| format!("Failed to create walk-in customer: {e}"))?;
                Some(conn.last_insert_rowid())
            }
        }
    } else {
        payload.customer_id
    };

    let is_ledger = payload.sale_type == "ledger_daily" || payload.sale_type == "ledger_monthly";
    let default_paid = if is_ledger { 0.0 } else { total };
    let paid_amt = round_money(payload.paid_amount.unwrap_or(default_paid));
    let discount_amt = round_money(payload.discount_amount.unwrap_or(0.0).max(0.0));
    let remaining_balance = round_money(total - paid_amt);
    let sale_status = if remaining_balance <= 0.0 {
        "paid".to_string()
    } else if paid_amt > 0.0 {
        "partial".to_string()
    } else {
        "pending".to_string()
    };

    let device_id = get_device_id();
    let now_utc = Utc::now();
    // Use Unix milliseconds (i64) — Prisma stores DateTime as Unix ms in SQLite.
    // RFC3339 strings are incompatible with Prisma's integer bounds in WHERE clauses.
    let now_ms: i64 = now_utc.timestamp_millis();
    // Keep an ISO string only for JSON sync payloads (not stored in SQLite directly)
    let now_iso_json = now_utc.to_rfc3339();

    // 4. BEGIN IMMEDIATE EXCLUSIVE TRANSACTION
    let tx = conn
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(|e| format!("Failed to begin SQLite write transaction: {e}"))?;

    // A. Allocate token number safely (monthly increment)
    // Compute month-start as Unix ms for correct comparison against Prisma-stored OR Rust-stored integers
    let local_now = Local::now();
    let month_start = NaiveDate::from_ymd_opt(local_now.year(), local_now.month(), 1)
        .unwrap_or_default()
        .and_hms_opt(0, 0, 0)
        .unwrap_or_default();
    // Convert to UTC Unix ms for comparison with createdAt (stored as Unix ms by Prisma & now by Rust)
    let month_start_ms = month_start
        .and_utc()
        .timestamp_millis();

    let max_token: Option<i64> = tx
        .query_row(
            "SELECT MAX(tokenNumber) FROM Sale WHERE createdAt >= ?1",
            params![month_start_ms],
            |row| row.get(0),
        )
        .unwrap_or(None);
    let next_token = max_token.unwrap_or(0) + 1;

    // B. Insert Sale — store createdAt/updatedAt as Unix ms (i64) to match Prisma format
    tx.execute(
        "INSERT INTO Sale (
            saleType, customerId, customerName, customerPhone, totalAmount, paidAmount,
            discountAmount, remainingBalance, status, tokenNumber, cloudUuid, createdAt, updatedAt
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)",
        params![
            &payload.sale_type,
            final_customer_id,
            &payload.customer_name,
            &payload.customer_phone,
            total,
            paid_amt,
            discount_amt,
            remaining_balance,
            &sale_status,
            next_token,
            &checkout_uuid,
            now_ms,
        ],
    )
    .map_err(|e| format!("Failed to insert Sale: {e}"))?;

    let sale_id = tx.last_insert_rowid();

    // C. Insert SaleItems — use Unix ms for createdAt
    let mut saved_items: Vec<SavedSaleItem> = Vec::new();
    for it in &payload.items {
        let item_uuid = Uuid::new_v4().to_string();
        let line_total = round_money(it.quantity * it.unit_price);

        tx.execute(
            "INSERT INTO SaleItem (
                saleId, itemName, quantity, unitPrice, totalPrice, cloudUuid, createdAt
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                sale_id,
                &it.item_name,
                it.quantity,
                it.unit_price,
                line_total,
                &item_uuid,
                now_ms,
            ],
        )
        .map_err(|e| format!("Failed to insert SaleItem: {e}"))?;

        let item_id = tx.last_insert_rowid();
        saved_items.push(SavedSaleItem {
            id: item_id,
            sale_id,
            item_name: it.item_name.clone(),
            quantity: it.quantity,
            unit_price: it.unit_price,
            total_price: line_total,
            cloud_uuid: Some(item_uuid),
        });
    }

    // D. Insert Payment (if paid_amt > 0) — use Unix ms for createdAt
    let mut saved_payments: Vec<SavedSalePayment> = Vec::new();
    let payment_uuid = Uuid::new_v4().to_string();
    let method = payload
        .payment_method
        .clone()
        .unwrap_or_else(|| "cash".to_string());

    if paid_amt > 0.0 {
        tx.execute(
            "INSERT INTO Payment (
                saleId, method, amount, status, cloudUuid, createdAt
            ) VALUES (?1, ?2, ?3, 'completed', ?4, ?5)",
            params![sale_id, &method, paid_amt, &payment_uuid, now_ms],
        )
        .map_err(|e| format!("Failed to insert Payment: {e}"))?;

        let payment_id = tx.last_insert_rowid();
        saved_payments.push(SavedSalePayment {
            id: payment_id,
            sale_id,
            method: method.clone(),
            amount: paid_amt,
            status: "completed".to_string(),
            cloud_uuid: Some(payment_uuid.clone()),
        });
    }

    // E. F2 Stock Deduction (Lassi, Butter, Ghee)
    let mut lassi_sold_delta = 0.0;
    let mut butter_sold_delta = 0.0;
    let mut ghee_sold_delta = 0.0;

    for it in &payload.items {
        let name_lower = it.item_name.to_lowercase();
        if name_lower == "lassi" {
            lassi_sold_delta = round_money(lassi_sold_delta + it.quantity);
        } else if name_lower == "butter" {
            butter_sold_delta = round_money(butter_sold_delta + it.quantity);
        } else if name_lower == "ghee" {
            ghee_sold_delta = round_money(ghee_sold_delta + it.quantity);
        }
    }

    if lassi_sold_delta > 0.0 || butter_sold_delta > 0.0 || ghee_sold_delta > 0.0 {
        // Calculate start and end of local day in Unix ms to match Prisma's DateTime format
        let local_day_start = local_now.date_naive()
            .and_hms_opt(0, 0, 0)
            .unwrap_or_default();
        let local_day_end = local_now.date_naive()
            .and_hms_opt(23, 59, 59)
            .unwrap_or_default();
        let day_start_ms = local_day_start.and_utc().timestamp_millis();
        let day_end_ms = local_day_end.and_utc().timestamp_millis() + 999;

        let stock_row: Result<(i64, f64, f64, f64, f64, f64, f64), _> = tx.query_row(
            "SELECT id, lassiSold, lassiRemaining, butterSold, butterClosing, gheeSold, gheeClosing 
             FROM MilkProductDailyStock 
             WHERE date >= ?1 AND date <= ?2 LIMIT 1",
            params![day_start_ms, day_end_ms],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                ))
            },
        );

        let stock_id = match stock_row {
            Ok((id, l_sold, l_rem, b_sold, b_clos, g_sold, g_clos)) => {
                let new_l_sold = round_money(l_sold + lassi_sold_delta);
                let new_l_rem = round_money(l_rem - lassi_sold_delta);
                let new_b_sold = round_money(b_sold + butter_sold_delta);
                let new_b_clos = round_money(b_clos - butter_sold_delta);
                let new_g_sold = round_money(g_sold + ghee_sold_delta);
                let new_g_clos = round_money(g_clos - ghee_sold_delta);

                tx.execute(
                    "UPDATE MilkProductDailyStock SET 
                        lassiSold = ?1, lassiRemaining = ?2,
                        butterSold = ?3, butterClosing = ?4,
                        gheeSold = ?5, gheeClosing = ?6,
                        updatedAt = ?7
                     WHERE id = ?8",
                    params![
                        new_l_sold,
                        new_l_rem,
                        new_b_sold,
                        new_b_clos,
                        new_g_sold,
                        new_g_clos,
                        now_ms,
                        id,
                    ],
                )
                .map_err(|e| format!("Failed to update MilkProductDailyStock: {e}"))?;
                id
            }
            Err(_) => {
                let stock_uuid = Uuid::new_v4().to_string();
                tx.execute(
                    "INSERT INTO MilkProductDailyStock (
                        date, lassiSold, lassiRemaining, butterSold, butterClosing,
                        gheeSold, gheeClosing, cloudUuid, createdAt, updatedAt
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
                    params![
                        day_start_ms,
                        lassi_sold_delta,
                        -lassi_sold_delta,
                        butter_sold_delta,
                        -butter_sold_delta,
                        ghee_sold_delta,
                        -ghee_sold_delta,
                        &stock_uuid,
                        now_ms,
                    ],
                )
                .map_err(|e| format!("Failed to insert MilkProductDailyStock: {e}"))?;
                tx.last_insert_rowid()
            }
        };

        // Enqueue SyncQueue for MilkProductDailyStock update
        let f2_sync_uuid = Uuid::new_v4().to_string();
        let f2_payload = serde_json::json!({
            "id": stock_id,
            "lassiSoldDelta": lassi_sold_delta,
            "butterSoldDelta": butter_sold_delta,
            "gheeSoldDelta": ghee_sold_delta,
        });
        let _ = tx.execute(
            "INSERT INTO SyncQueue (
                eventUuid, deviceId, entityType, localId, cloudUuid, operation,
                payload, status, layer, retryCount, createdAt, updatedAt
            ) VALUES (?1, ?2, 'MilkProductDailyStock', ?3, '', 'UPDATE', ?4, 'PENDING', 2, 0, ?5, ?5)",
            params![
                &f2_sync_uuid,
                &device_id,
                stock_id,
                f2_payload.to_string(),
                now_ms
            ],
        );
    }

    // F. InventoryMovement Records (deduct sold quantities from stock)
    // Find active open shift if any
    let active_shift_id: Option<i64> = tx
        .query_row(
            "SELECT id FROM Shift WHERE status = 'Open' ORDER BY openedAt ASC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .ok();

    for it in &payload.items {
        let lower = it.item_name.to_lowercase();
        let product: Result<(i64, Option<String>), _> = tx.query_row(
            "SELECT id, cloudUuid FROM InventoryProduct 
             WHERE UPPER(code) = UPPER(?1) OR UPPER(name) = UPPER(?1) LIMIT 1",
            params![&lower],
            |row| Ok((row.get(0)?, row.get(1)?)),
        );

        if let Ok((prod_id, prod_cloud_uuid)) = product {
            let reference = format!("sale-{sale_id}-{lower}");
            let movement_uuid = Uuid::new_v4().to_string();
            let qty_neg = round_money(-it.quantity);

            let res = tx.execute(
                "INSERT OR IGNORE INTO InventoryMovement (
                    productId, quantity, movementType, source, reference,
                    shiftId, date, cloudUuid, createdAt
                ) VALUES (?1, ?2, 'SALE', 'Point of Sale', ?3, ?4, ?5, ?6, ?5)",
                params![
                    prod_id,
                    qty_neg,
                    &reference,
                    active_shift_id,
                    now_ms,
                    &movement_uuid,
                ],
            );

            if let Ok(inserted_rows) = res {
                if inserted_rows > 0 {
                    let movement_id = tx.last_insert_rowid();
                    let movement_event_uuid = Uuid::new_v4().to_string();
                    let movement_payload = serde_json::json!({
                        "productUuid": prod_cloud_uuid.unwrap_or_default(),
                        "quantity": qty_neg,
                        "movementType": "SALE",
                        "source": "Point of Sale",
                        "reference": reference,
                        "date": now_iso_json,
                        "createdAt": now_iso_json,
                    });

                    let _ = tx.execute(
                        "INSERT INTO SyncQueue (
                            eventUuid, deviceId, entityType, localId, cloudUuid, operation,
                            payload, status, layer, retryCount, createdAt, updatedAt
                        ) VALUES (?1, ?2, 'InventoryMovement', ?3, ?4, 'CREATE', ?5, 'PENDING', 2, 0, ?6, ?6)",
                        params![
                            &movement_event_uuid,
                            &device_id,
                            movement_id,
                            &movement_uuid,
                            movement_payload.to_string(),
                            now_ms
                        ],
                    );
                }
            }
        }
    }

    // G. Enqueue SyncQueue for Sale (Layer 1)
    // Sync payloads use ISO string for cloud compatibility; only DB columns use Unix ms
    let sale_event_uuid = Uuid::new_v4().to_string();
    let walk_in_customer_uuid = "00000000-0000-4000-8000-000000000001";
    let sale_payload = serde_json::json!({
        "saleType": payload.sale_type,
        "customerUuid": if payload.sale_type == "walk_in" { Some(walk_in_customer_uuid) } else { None },
        "customerName": payload.customer_name,
        "customerPhone": payload.customer_phone,
        "totalAmount": total,
        "paidAmount": paid_amt,
        "discountAmount": discount_amt,
        "remainingBalance": remaining_balance,
        "status": sale_status,
        "tokenNumber": next_token,
        "createdAt": now_iso_json,
        "updatedAt": now_iso_json,
    });

    tx.execute(
        "INSERT INTO SyncQueue (
            eventUuid, deviceId, entityType, localId, cloudUuid, operation,
            payload, status, layer, retryCount, createdAt, updatedAt
        ) VALUES (?1, ?2, 'Sale', ?3, ?4, 'CREATE', ?5, 'PENDING', 1, 0, ?6, ?6)",
        params![
            &sale_event_uuid,
            &device_id,
            sale_id,
            &checkout_uuid,
            sale_payload.to_string(),
            now_ms
        ],
    )
    .map_err(|e| format!("Failed to enqueue Sale SyncQueue: {e}"))?;

    // H. Enqueue SyncQueue for SaleItems (Layer 2)
    for it in &saved_items {
        let item_event_uuid = Uuid::new_v4().to_string();
        let item_payload = serde_json::json!({
            "saleUuid": checkout_uuid,
            "itemName": it.item_name,
            "quantity": it.quantity,
            "unitPrice": it.unit_price,
            "totalPrice": it.total_price,
            "createdAt": now_iso_json,
        });

        tx.execute(
            "INSERT INTO SyncQueue (
                eventUuid, deviceId, entityType, localId, cloudUuid, operation,
                payload, status, layer, retryCount, createdAt, updatedAt
            ) VALUES (?1, ?2, 'SaleItem', ?3, ?4, 'CREATE', ?5, 'PENDING', 2, 0, ?6, ?6)",
            params![
                &item_event_uuid,
                &device_id,
                it.id,
                it.cloud_uuid.as_deref().unwrap_or(""),
                item_payload.to_string(),
                now_ms
            ],
        )
        .map_err(|e| format!("Failed to enqueue SaleItem SyncQueue: {e}"))?;
    }

    // I. Enqueue SyncQueue for Payments (Layer 2)
    for p in &saved_payments {
        let payment_event_uuid = Uuid::new_v4().to_string();
        let pay_payload = serde_json::json!({
            "saleUuid": checkout_uuid,
            "method": p.method,
            "amount": p.amount,
            "status": p.status,
            "createdAt": now_iso_json,
        });

        tx.execute(
            "INSERT INTO SyncQueue (
                eventUuid, deviceId, entityType, localId, cloudUuid, operation,
                payload, status, layer, retryCount, createdAt, updatedAt
            ) VALUES (?1, ?2, 'Payment', ?3, ?4, 'CREATE', ?5, 'PENDING', 2, 0, ?6, ?6)",
            params![
                &payment_event_uuid,
                &device_id,
                p.id,
                p.cloud_uuid.as_deref().unwrap_or(""),
                pay_payload.to_string(),
                now_ms
            ],
        )
        .map_err(|e| format!("Failed to enqueue Payment SyncQueue: {e}"))?;
    }

    // COMMIT
    tx.commit()
        .map_err(|e| format!("Failed to commit SQLite transaction: {e}"))?;

    Ok(SavedSaleResponse {
        id: sale_id,
        sale_type: payload.sale_type,
        customer_id: final_customer_id,
        customer_name: payload.customer_name,
        customer_phone: payload.customer_phone,
        total_amount: total,
        paid_amount: paid_amt,
        discount_amount: discount_amt,
        remaining_balance,
        status: sale_status,
        token_number: next_token,
        cloud_uuid: Some(checkout_uuid),
        // Return ISO string to frontend (display purposes only, not stored)
        created_at: now_iso_json.clone(),
        updated_at: now_iso_json,
        items: saved_items,
        payments: saved_payments,
    })
}
