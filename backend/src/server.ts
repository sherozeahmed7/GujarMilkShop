import app from './app';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import { startSyncWorker } from './workers/syncWorker';
import { startDownstreamSyncWorker } from './workers/downstreamSyncWorker';
import { startLassiMidnightReset } from './services/lassiMidnightReset.service';
import { startAutoBackupWorker } from './workers/autoBackupWorker';

// Load environment variables from .env file
dotenv.config();

const PORT = process.env.PORT || 5000;

// Connect to database and start Express server
async function startServer() {
  await connectDB();
  
  const server = app.listen(PORT, () => {
    console.log(`🚀 Express server is running on port ${PORT}`);
    
    // Start background workers
    startSyncWorker();
    startDownstreamSyncWorker();
    startAutoBackupWorker();
    const lassiResetTimer = startLassiMidnightReset();

    (server as any).lassiResetTimer = lassiResetTimer;
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use by another application. Please free port ${PORT} and restart the POS.`);
      process.exit(98);
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });

  const gracefulShutdown = () => {
    console.log('Stopping POS backend server...');
    const lassiResetTimer = (server as any).lassiResetTimer;
    if (lassiResetTimer) clearTimeout(lassiResetTimer);
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
    // Force close after 2 seconds if not completed
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  process.on('message', (msg) => {
    if (msg === 'shutdown') {
      gracefulShutdown();
    }
  });

  return server;
}

const serverPromise = startServer();

export default serverPromise;

