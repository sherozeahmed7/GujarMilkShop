import app from './app';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import { startSyncWorker } from './workers/syncWorker';
import { startDownstreamSyncWorker } from './workers/downstreamSyncWorker';
import { startLassiMidnightReset } from './services/lassiMidnightReset.service';
import { startAutoBackupWorker } from './workers/autoBackupWorker';
import { ensureNeonSchema } from './services/neonSchemaInit.service';

// Load environment variables from .env file
dotenv.config();

const PORT = process.env.PORT || 5000;

// Connect to database and start Express server
async function startServer() {
  await connectDB();
  await ensureNeonSchema();
  
  const server = app.listen(PORT, () => {
    console.log(`🚀 Express server is running on port ${PORT}`);
    
    // Start background workers
    startSyncWorker();
    startDownstreamSyncWorker();
    startAutoBackupWorker();
    const lassiResetTimer = startLassiMidnightReset();

    // Auto-close past midnight shifts on startup and every 60 seconds
    import('./services/shift.service').then(({ ShiftService }) => {
      ShiftService.autoClosePastMidnightShifts().catch(err => {
        console.error('[STARTUP] Error in autoClosePastMidnightShifts:', err.message);
      });
      const shiftAutoCloseInterval = setInterval(() => {
        ShiftService.autoClosePastMidnightShifts().catch(() => {});
      }, 60_000);
      (server as any).shiftAutoCloseInterval = shiftAutoCloseInterval;
    });

    // Trigger daily startup sync queue retention check asynchronously
    import('./services/syncRetention.service').then(({ SyncRetentionService }) => {
      SyncRetentionService.runStartupRetentionCheck().catch(err => {
        console.error('[STARTUP] Error running sync retention check:', err.message);
      });
    });

    // Trigger daily startup technical tables maintenance check asynchronously
    import('./services/databaseMaintenance.service').then(({ DatabaseMaintenanceService }) => {
      DatabaseMaintenanceService.runStartupMaintenanceCheck().catch(err => {
        console.error('[STARTUP] Error running database maintenance check:', err.message);
      });
    });

    // Run Neon storage pruning (rolls up Walk-In sales and prunes old raw rows to keep cloud footprint minimal)
    import('./services/neonPruning.service').then(({ pruneEligibleWalkInDetail }) => {
      pruneEligibleWalkInDetail({ retentionDays: 30 }).catch(err => {
        // Silently catch if Neon is unreachable or tables do not exist
      });
    });

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
    const shiftInterval = (server as any).shiftAutoCloseInterval;
    if (shiftInterval) clearInterval(shiftInterval);
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

