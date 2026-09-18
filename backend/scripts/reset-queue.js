const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function run() { 
  await prisma.syncQueue.updateMany({ 
    where: { status: 'SYNCING' }, 
    data: { status: 'PENDING' } 
  }); 
  console.log('Reset SYNCING to PENDING'); 
  await prisma.$disconnect(); 
} 
run();
