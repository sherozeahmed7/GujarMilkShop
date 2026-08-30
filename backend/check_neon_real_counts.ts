const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: 'postgresql://gujjarmilkshop_owner:npg_vaCoIJQrKX62@ep-holy-waterfall-b3fzjq2j-pooler.c-4.ap-southeast-1.aws.neon.tech/gujjarmilkshop?sslmode=require&channel_binding=require',
    });
    await client.connect();
    
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log(`Total Tables: ${res.rows.length}`);
    for (const row of res.rows) {
        try {
            const countRes = await client.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
            console.log(`${row.table_name}: ${countRes.rows[0].count}`);
        } catch (e) {
            console.log(`${row.table_name}: ERROR - ${e.message}`);
        }
    }
    await client.end();
}
main().catch(console.error);
