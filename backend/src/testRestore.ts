import { prisma } from './config/database';
import { getNeonPool } from './config/neonDb';
import axios from 'axios';
import { restoreCloudData } from './controllers/syncRestore.controller';

async function testRestore() {
  console.log('--- TESTING RESTORE CLOUD DATA SAFELY ---');

  // Simulate mock req / res
  let statusCode = 200;
  let jsonResult: any = null;

  const mockReq: any = {
    user: { id: 1, role: 'super_admin' }
  };

  const mockRes: any = {
    status: (code: number) => {
      statusCode = code;
      return mockRes;
    },
    json: (data: any) => {
      jsonResult = data;
      return mockRes;
    }
  };

  console.log('1. Executing restoreCloudData()...');
  await restoreCloudData(mockReq, mockRes);

  console.log(`HTTP Status: ${statusCode}`);
  console.log('Restore Result:', JSON.stringify(jsonResult, null, 2));

  // Verify DownstreamSyncState
  const state = await prisma.downstreamSyncState.findUnique({ where: { id: 1 } });
  console.log('Current downstream cursor:', state?.lastCursor?.toString());

  // Verify LocalToCloudMapping count
  const mappingCount = await prisma.localToCloudMapping.count();
  console.log('LocalToCloudMapping count:', mappingCount);

  // Check sync queue status
  const pending = await prisma.syncQueue.count({ where: { status: { not: 'SYNCED' } } });
  console.log('Pending sync queue items:', pending);

  console.log('--- TEST FINISHED ---');
}

testRestore().finally(() => {
  prisma.$disconnect();
  process.exit(0);
});
