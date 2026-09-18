/**
 * Comprehensive verification of Phase 5C
 */
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });

async function verify() {
  const neon = await pool.connect();
  try {
    console.log('=== VERIFICATION SUMMARY ===');
    
    // 1. Shift Counts
    const sqliteShifts = await prisma.shift.findMany({ orderBy: { id: 'asc' } });
    const neonShifts = await neon.query('SELECT id, device_id, local_id, shift_date, status FROM shifts ORDER BY local_id ASC');
    console.log(`SQLite Shifts Count: ${sqliteShifts.length}`);
    console.log(`Neon Shifts Count:   ${neonShifts.rows.length}`);

    // 2. LocalToCloudMapping Verification for Shifts
    const shiftMappings = await prisma.localToCloudMapping.findMany({ where: { entityType: 'Shift' } });
    console.log(`Shift Mappings Count: ${shiftMappings.length}`);

    let brokenShiftMappings = 0;
    for (const m of shiftMappings) {
      const existsInNeon = neonShifts.rows.some(r => r.id === m.cloudUuid);
      if (!existsInNeon) {
        console.error(`Broken shift mapping for localId=${m.localId}: ${m.cloudUuid} not in Neon!`);
        brokenShiftMappings++;
      }
    }
    console.log(`Broken Shift Mappings: ${brokenShiftMappings}`);

    // 3. User 1 Mapping
    const user1Mapping = await prisma.localToCloudMapping.findFirst({ where: { entityType: 'User', localId: 1 } });
    const neonUser1 = await neon.query(`SELECT id, email, name FROM users WHERE id=$1`, [user1Mapping?.cloudUuid]);
    console.log(`User 1 Mapping: localId=1 -> cloudUuid=${user1Mapping?.cloudUuid}`);
    console.log(`User 1 in Neon:`, neonUser1.rows[0]);

    // 4. SyncQueue Status
    const queueCounts = await prisma.syncQueue.groupBy({
      by: ['status'],
      _count: { status: true }
    });
    console.log(`SyncQueue Status:`, queueCounts);

    // 5. Test 2 distinct shifts on the same date simulation
    console.log('\n--- SIMULATING 2 DISTINCT SHIFTS ON THE SAME DATE VIA SYNC BATCH CONTROLLER LOGIC ---');
    const testDeviceId = 'test-device-uuid-' + Date.now();
    const testUuid1 = '11111111-1111-4111-8111-111111111111';
    const testUuid2 = '22222222-2222-4222-8222-222222222222';
    const sameDate = '2026-10-01';

    // Insert Shift 1 via client query directly mimicking syncBatch logic
    await neon.query(`
      INSERT INTO shifts (id, device_id, local_id, shift_date, status, opened_at, opening_cash, expected_cash)
      VALUES ($1, $2, $3, $4, $5, NOW(), 500, 500)
    `, [testUuid1, testDeviceId, 101, sameDate, 'Closed']);

    // Insert Shift 2 on the SAME DATE for the SAME DEVICE with distinct local_id
    await neon.query(`
      INSERT INTO shifts (id, device_id, local_id, shift_date, status, opened_at, opening_cash, expected_cash)
      VALUES ($1, $2, $3, $4, $5, NOW(), 1000, 1000)
    `, [testUuid2, testDeviceId, 102, sameDate, 'Open']);

    const testVerify = await neon.query(`
      SELECT id, device_id, local_id, shift_date, status, opening_cash 
      FROM shifts WHERE device_id=$1 ORDER BY local_id ASC
    `, [testDeviceId]);

    console.log(`Test Result for Same Date Multiple Shifts: Created ${testVerify.rows.length} distinct shifts on ${sameDate}:`);
    console.log(JSON.stringify(testVerify.rows, null, 2));

    // Clean up test shifts cleanly
    await neon.query('DELETE FROM shifts WHERE device_id=$1', [testDeviceId]);
    console.log('Cleaned up test shifts.');

  } finally {
    neon.release();
    await pool.end();
    await prisma.$disconnect();
  }
}

verify();
