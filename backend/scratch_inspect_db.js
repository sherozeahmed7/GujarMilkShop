const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function testDb(dbPath) {
  console.log('\n--- Testing DB:', dbPath);
  if (!fs.existsSync(dbPath)) {
    console.log('File does not exist!');
    return;
  }
  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}` } }
  });
  try {
    const count = await prisma.syncQueue.count();
    console.log('Total syncQueue count:', count);
    const rows = await prisma.syncQueue.findMany({
      where: {
        eventUuid: {
          in: [
            '8663e41e-4e5e-4e67-832a-74adcb6cfaac',
            '8191c924-8da9-45da-af75-71b27411b2aa',
            '8f1f35a3-8935-4f8c-91ca-407652e96be0'
          ]
        }
      }
    });
    console.log('Found rows matching errors:', JSON.stringify(rows, null, 2));

    const failedCount = await prisma.syncQueue.count({ where: { status: 'FAILED' } });
    console.log('Failed count:', failedCount);
    const pendingCount = await prisma.syncQueue.count({ where: { status: 'PENDING' } });
    console.log('Pending count:', pendingCount);
  } catch (err) {
    console.error('Error querying DB:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await testDb('E:/Documents/Gujar Milk Shop/backend/prisma/dev.db');
  await testDb('E:/Documents/Gujar Milk Shop/backend/prisma/prisma/dev.db');
  await testDb('E:/Documents/Gujar Milk Shop/backend/prisma/template.db');
  await testDb('E:/Documents/Gujar Milk Shop/frontend/src-tauri/bin/template.db');
  await testDb('E:/Documents/Gujar Milk Shop/frontend/src-tauri/prisma/dev.db');
}

main();
