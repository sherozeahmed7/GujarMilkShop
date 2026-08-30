const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: 'postgresql://gujjarmilkshop_owner:npg_vaCoIJQrKX62@ep-holy-waterfall-b3fzjq2j-pooler.c-4.ap-southeast-1.aws.neon.tech/gujjarmilkshop?sslmode=require&channel_binding=require',
    });
    await client.connect();
    
    // Sums
    const salesSum = await client.query('SELECT SUM(total_amount) as total_amount, SUM(paid_amount) as paid_amount FROM sales');
    const indPayments = await client.query('SELECT SUM(amount) as amount FROM payments');
    const colls = await client.query('SELECT SUM(amount) as amount, SUM(quantity) as quantity FROM supplier_collections');
    
    console.log('Neon Total Sales Amount: Rs. ' + salesSum.rows[0].total_amount);
    console.log('Neon Total Sales Paid: Rs. ' + salesSum.rows[0].paid_amount);
    console.log('Neon Total Independent Payments: Rs. ' + indPayments.rows[0].amount);
    console.log('Neon Supplier Collections Amount: Rs. ' + colls.rows[0].amount);
    console.log('Neon Supplier Collections Quantity: ' + colls.rows[0].quantity + ' liters');

    // Counts
    const tables = ['users', 'customers', 'sales', 'payments', 'suppliers', 'supplier_collections', 'supplier_payments', 'milk_product_daily_stocks', 'inventory_products', 'inventory_movements', 'shifts', 'daily_rates', 'sale_items', 'milk_product_transactions', 'butter_ghee_conversions', 'expenses', 'expense_payments', 'returns', 'return_items', 'audit_records', 'idempotency_log'];
    
    console.log('--- Counts ---');
    let totalBusinessRecords = 0;
    for (const table of tables) {
        const res = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`${table}: ${res.rows[0].count}`);
        if (table !== 'idempotency_log') {
            totalBusinessRecords += parseInt(res.rows[0].count);
        }
    }
    console.log(`Total Business Records: ${totalBusinessRecords}`);
    
    // Idempotency
    const idempotencyCount = await client.query('SELECT COUNT(*) FROM idempotency_log');
    console.log(`Total Idempotency Records: ${idempotencyCount.rows[0].count}`);
    
    // FK integrity check
    const invalidSaleItems = await client.query('SELECT COUNT(*) FROM sale_items WHERE sale_uuid NOT IN (SELECT id FROM sales)');
    console.log(`Invalid Sale Items (Orphaned): ${invalidSaleItems.rows[0].count}`);

    const invalidPayments = await client.query('SELECT COUNT(*) FROM payments WHERE sale_uuid NOT IN (SELECT id FROM sales)');
    console.log(`Invalid Payments (Orphaned): ${invalidPayments.rows[0].count}`);

    const invalidSupplierCollections = await client.query('SELECT COUNT(*) FROM supplier_collections WHERE supplier_uuid NOT IN (SELECT id FROM suppliers)');
    console.log(`Invalid Supplier Collections (Orphaned): ${invalidSupplierCollections.rows[0].count}`);
    
    const invalidSupplierPayments = await client.query('SELECT COUNT(*) FROM supplier_payments WHERE supplier_uuid NOT IN (SELECT id FROM suppliers)');
    console.log(`Invalid Supplier Payments (Orphaned): ${invalidSupplierPayments.rows[0].count}`);

    await client.end();
}
main().catch(console.error);
