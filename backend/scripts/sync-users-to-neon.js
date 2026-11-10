require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getNeonPool } = require('../dist/config/neonDb');

async function syncUsersToNeon() {
  const pool = getNeonPool();
  const localUsers = await prisma.user.findMany();
  console.log(`Syncing ${localUsers.length} local user(s) to Neon...`);

  for (const u of localUsers) {
    const screens = u.assignedScreens || '[]';
    await pool.query(`
      INSERT INTO users (id, local_id, device_id, name, email, password, role, status, assigned_screens, updated_at)
      VALUES (
        COALESCE($1::uuid, uuid_generate_v4()),
        $2,
        'DESKTOP_PRIMARY',
        $3,
        $4,
        $5,
        $6,
        $7,
        $8::jsonb,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (id) DO UPDATE SET
        local_id = EXCLUDED.local_id,
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        password = EXCLUDED.password,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        assigned_screens = EXCLUDED.assigned_screens,
        updated_at = CURRENT_TIMESTAMP
    `, [u.cloudUuid || null, u.id, u.name, u.email, u.password, u.role, u.status, screens]);
    console.log(`  ? Upserted ${u.email} (${u.role}) to Neon`);
  }

  const neonUsers = await pool.query('SELECT id, email, role, status, name FROM users');
  console.log('Neon users now:');
  console.table(neonUsers.rows);
  process.exit(0);
}

syncUsersToNeon().catch(e => {
  console.error('Error syncing users:', e);
  process.exit(1);
});
