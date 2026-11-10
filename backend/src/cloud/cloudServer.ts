import dotenv from 'dotenv';
dotenv.config();

// Enforce cloud mode
process.env.APP_MODE = 'cloud';

import { createCloudApp } from './cloudApp';
import { ensureNeonSchema } from '../services/neonSchemaInit.service';
import { queryWithRetry } from '../config/neonDb';

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = process.env.HOST || '0.0.0.0';

process.on('uncaughtException', (err: any) => {
  console.error('[Cloud Process] uncaughtException:', err?.message || String(err));
});
process.on('unhandledRejection', (reason: any) => {
  console.error('[Cloud Process] unhandledRejection:', reason?.message || String(reason));
});

async function startCloudServer() {
  console.log('?? Starting Gujar Milk Shop Cloud API (APP_MODE=cloud)...');
  console.log('?? Verifying Neon PostgreSQL connection and schema...');

  if (!process.env.NEON_DATABASE_URL) {
    console.error('? FATAL: NEON_DATABASE_URL is not set in environment variables.');
    process.exit(1);
  }

  try {
    await ensureNeonSchema();
    await queryWithRetry('SELECT 1');
    console.log('? Connected to Neon PostgreSQL successfully.');
  } catch (err: any) {
    console.error('?? Warning: Initial Neon connection test failed:', err.message);
  }

  const app = createCloudApp();

  const server = app.listen(PORT, HOST, () => {
    console.log(`?? Cloud Express API running at http://${HOST}:${PORT}`);
    console.log(`?? Health check available at http://${HOST}:${PORT}/health`);
  });

  const gracefulShutdown = () => {
    console.log('?? Stopping Cloud Express API...');
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

startCloudServer().catch((err) => {
  console.error('? Failed to start Cloud Server:', err);
  process.exit(1);
});
