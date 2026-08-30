import { getNeonPool } from './config/neonDb';
import dotenv from 'dotenv';
dotenv.config();

async function fix() {
  const pool = getNeonPool();
  try {
    await pool.query('ALTER TABLE expenses ALTER COLUMN description DROP NOT NULL;');
    await pool.query('ALTER TABLE users ALTER COLUMN name DROP NOT NULL;');
    console.log('Fixed schema.');
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
fix();
