/**
 * Phase 5C: Fix Neon constraints, user mapping, and recover shifts safely.
 */
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });

async function executePhase5C() {
  const neon = await pool.connect();
  try {
    console.log('--- STEP 1: Inspect and drop UNIQUE(device_id, shift_date) constraint on Neon shifts ---');
    const constraintCheck = await neon.query(`
      SELECT conname FROM pg_constraint 
      WHERE conrelid = 'shifts'::regclass AND conname = 'shifts_device_id_shift_date_key'
    `);
    if (constraintCheck.rows.length > 0) {
      console.log('Dropping shifts_device_id_shift_date_key from Neon...');
      await neon.query('ALTER TABLE shifts DROP CONSTRAINT shifts_device_id_shift_date_key');
      console.log('Constraint dropped successfully.');
    } else {
      console.log('Constraint shifts_device_id_shift_date_key already absent.');
    }

    console.log('\n--- STEP 2: Correct Stale User 1 LocalToCloudMapping in SQLite ---');
    const neonUser1 = await neon.query(`SELECT id FROM users WHERE email='admin@gujarmilkshop.com' LIMIT 1`);
    if (neonUser1.rows.length > 0) {
      const realNeonUser1Uuid = neonUser1.rows[0].id;
      console.log('Neon User 1 Real UUID:', realNeonUser1Uuid);
      const updatedUserMap = await prisma.localToCloudMapping.updateMany({
        where: { entityType: 'User', localId: 1 },
        data: { cloudUuid: realNeonUser1Uuid }
      });
      console.log(`Updated User 1 localToCloudMapping (${updatedUserMap.count} rows) to ${realNeonUser1Uuid}`);
    }

    console.log('\n--- STEP 3: Audit SQLite Shifts and recover missing Neon records ---');
    const sqliteShifts = await prisma.shift.findMany({ orderBy: { id: 'asc' } });
    console.log(`Total SQLite shifts: ${sqliteShifts.length}`);

    // Get device ID from existing local mappings or default
    const sampleMap = await prisma.localToCloudMapping.findFirst();
    const defaultDeviceId = sampleMap?.deviceId || '156862fe-ea8a-4b4b-91dc-ff09a9b427e3';

    for (const shift of sqliteShifts) {
      // Find or create local mapping
      let mapping = await prisma.localToCloudMapping.findFirst({
        where: { entityType: 'Shift', localId: shift.id }
      });

      if (!mapping) {
        mapping = await prisma.localToCloudMapping.create({
          data: {
            deviceId: defaultDeviceId,
            entityType: 'Shift',
            localId: shift.id,
            cloudUuid: crypto.randomUUID()
          }
        });
      }

      // Check if Neon has a shift for this device_id and local_id or by id
      const neonRes = await neon.query(
        'SELECT id FROM shifts WHERE (device_id = $1 AND local_id = $2) OR id = $3',
        [mapping.deviceId, shift.id, mapping.cloudUuid]
      );

      // Resolve opened_by_uuid and closed_by_uuid
      let openedByUuid: string | null = null;
      if (shift.openedById) {
        const openedUserMap = await prisma.localToCloudMapping.findFirst({
          where: { entityType: 'User', localId: shift.openedById }
        });
        if (openedUserMap) {
          openedByUuid = openedUserMap.cloudUuid;
        } else {
          // fallback to User 1
          openedByUuid = (await prisma.localToCloudMapping.findFirst({ where: { entityType: 'User', localId: 1 } }))?.cloudUuid || null;
        }
      }

      let closedByUuid: string | null = null;
      if (shift.closedById) {
        const closedUserMap = await prisma.localToCloudMapping.findFirst({
          where: { entityType: 'User', localId: shift.closedById }
        });
        if (closedUserMap) {
          closedByUuid = closedUserMap.cloudUuid;
        }
      }

      if (neonRes.rows.length === 0) {
        console.log(`Inserting missing Shift localId=${shift.id} into Neon with cloudUuid=${mapping.cloudUuid}...`);
        await neon.query(
          `INSERT INTO shifts (
            id, device_id, local_id, shift_date, opened_by_uuid, closed_by_uuid, 
            opened_at, closed_at, opening_cash, opening_notes, expected_cash, 
            counted_cash, difference, difference_status, closing_notes, status, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
          )`,
          [
            mapping.cloudUuid,
            mapping.deviceId,
            shift.id,
            shift.shiftDate,
            openedByUuid,
            closedByUuid,
            shift.openedAt,
            shift.closedAt,
            shift.openingCash,
            shift.openingNotes,
            shift.expectedCash,
            shift.countedCash,
            shift.difference,
            shift.differenceStatus,
            shift.closingNotes,
            shift.status,
            shift.createdAt,
            shift.updatedAt
          ]
        );
      } else {
        const existingNeonId = neonRes.rows[0].id;
        console.log(`Shift localId=${shift.id} already exists in Neon with id=${existingNeonId}. Ensuring mapping is aligned.`);
        if (mapping.cloudUuid !== existingNeonId) {
          await prisma.localToCloudMapping.update({
            where: { id: mapping.id },
            data: { cloudUuid: existingNeonId }
          });
        }
        // Update fields to match current sqlite state
        await neon.query(
          `UPDATE shifts SET 
            shift_date=$1, opened_by_uuid=$2, closed_by_uuid=$3, opened_at=$4, closed_at=$5, 
            opening_cash=$6, opening_notes=$7, expected_cash=$8, counted_cash=$9, difference=$10, 
            difference_status=$11, closing_notes=$12, status=$13, updated_at=$14
           WHERE id=$15`,
          [
            shift.shiftDate, openedByUuid, closedByUuid, shift.openedAt, shift.closedAt,
            shift.openingCash, shift.openingNotes, shift.expectedCash, shift.countedCash, shift.difference,
            shift.differenceStatus, shift.closingNotes, shift.status, shift.updatedAt, existingNeonId
          ]
        );
      }

      // Update or create SyncQueue event as SYNCED
      const existingQ = await prisma.syncQueue.findFirst({
        where: { entityType: 'Shift', localId: shift.id }
      });
      if (existingQ) {
        await prisma.syncQueue.update({
          where: { eventUuid: existingQ.eventUuid },
          data: { status: 'SYNCED', cloudUuid: mapping.cloudUuid, error: null }
        });
      }
    }

    console.log('\n--- STEP 4: Verification of Neon Shifts and SyncQueue ---');
    const neonShiftsCount = await neon.query('SELECT COUNT(*) FROM shifts');
    console.log(`Total Shifts in Neon: ${neonShiftsCount.rows[0].count}`);

    const queuePending = await prisma.syncQueue.count({ where: { status: { in: ['PENDING', 'SYNCING', 'FAILED'] } } });
    console.log(`Pending / Syncing / Failed in SyncQueue: ${queuePending}`);

  } catch (err: any) {
    console.error('Phase 5C Execution Error:', err);
    throw err;
  } finally {
    neon.release();
    await pool.end();
    await prisma.$disconnect();
  }
}

executePhase5C();
