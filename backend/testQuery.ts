import { getNeonPool } from './src/config/neonDb';
async function run() {
  const pool = getNeonPool();
  const res = await pool.query('SELECT id, device_id, local_id, shift_date, status FROM shifts ORDER BY created_at DESC LIMIT 5');
  console.log('Shifts:', JSON.stringify(res.rows, null, 2));
  const res2 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='shifts' ORDER BY ordinal_position");
  console.log('Columns:', res2.rows.map((r: any) => r.column_name).join(', '));
  pool.end();
}
run().catch(console.error);
