const path = require('path');
const os = require('os');
const { PrismaClient } = require('@prisma/client');

const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dbPath = path.join(appData, 'com.shero.tauri-app', 'pos.db');
process.env.DATABASE_URL = 'file:' + dbPath;

const prisma = new PrismaClient();

async function check() {
  const users = await prisma.syncQueue.findMany({
    where: { entityType: 'User' },
  });
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

check();
