const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: "postgresql://gujjarmilkshop_owner:npg_vaCoIJQrKX62@ep-holy-waterfall-b3fzjq2j-pooler.c-4.ap-southeast-1.aws.neon.tech/gujjarmilkshop?sslmode=require&channel_binding=require",
    });
    await client.connect();

    const tables = [
        'User', 'Supplier', 'SupplierCollection', 'SupplierPayment', 'InventoryProduct', 
        'InventoryMovement', 'Shift', 'DailyRate', 'Customer', 'Sale', 'SaleItem', 
        'Payment', 'MilkProductDailyStock', 'MilkProductTransaction', 'ButterGheeConversion', 
        'Expense', 'ExpensePayment', 'Return', 'ReturnItem', 'AuditRecord',
        'IdempotencyRecord', 'FailedMigration'
    ];

    console.log("Neon Table Counts:");
    for (const table of tables) {
        try {
            const res = await client.query(`SELECT COUNT(*) FROM "${table}"`);
            console.log(`${table}: ${res.rows[0].count}`);
        } catch (e: any) {
            console.log(`${table}: ERROR - ${e.message}`);
        }
    }

    try {
        const res = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
        console.log(`Total Tables: ${res.rows.length}`);
    } catch (e: any) {}

    await client.end();
}

main().catch(console.error);
