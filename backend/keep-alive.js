#!/usr/bin/env node
/**
 * Self-restarting wrapper for the POS backend server.
 * If the server process exits unexpectedly (non-zero or non-graceful),
 * this wrapper automatically restarts it after a brief delay.
 *
 * Usage: node keep-alive.js
 */

const { spawn } = require('child_process');
const path = require('path');

const SERVER_SCRIPT = path.join(__dirname, 'dist', 'server.js');
const RESTART_DELAY_MS = 3000;
const MAX_RESTARTS = 50;

let restartCount = 0;
let isShuttingDown = false;

function startServer() {
  if (isShuttingDown) return;

  console.log(`[KeepAlive] Starting server (attempt ${restartCount + 1})...`);

  const child = spawn(process.execPath, [SERVER_SCRIPT], {
    stdio: 'inherit',
    env: process.env,
    cwd: __dirname,
  });

  child.on('exit', (code, signal) => {
    if (isShuttingDown) {
      console.log('[KeepAlive] Server exited cleanly during shutdown.');
      process.exit(0);
      return;
    }

    // Exit code 98 = EADDRINUSE — do NOT restart
    if (code === 98) {
      console.error('[KeepAlive] Port already in use. Not restarting. Free port 5000 first.');
      process.exit(98);
      return;
    }

    // Exit code 0 = clean/intentional shutdown
    if (code === 0 && !signal) {
      console.log('[KeepAlive] Server exited cleanly (code 0). Not restarting.');
      process.exit(0);
      return;
    }

    restartCount++;
    if (restartCount > MAX_RESTARTS) {
      console.error(`[KeepAlive] Max restarts (${MAX_RESTARTS}) reached. Giving up.`);
      process.exit(1);
      return;
    }

    console.warn(`[KeepAlive] Server crashed (code=${code}, signal=${signal}). Restarting in ${RESTART_DELAY_MS}ms... (restart #${restartCount})`);
    setTimeout(startServer, RESTART_DELAY_MS);
  });

  child.on('error', (err) => {
    console.error('[KeepAlive] Failed to start server process:', err.message);
    if (!isShuttingDown) {
      setTimeout(startServer, RESTART_DELAY_MS);
    }
  });
}

// Forward termination signals to initiate clean shutdown
process.on('SIGTERM', () => {
  isShuttingDown = true;
  console.log('[KeepAlive] Received SIGTERM. Shutting down...');
});

process.on('SIGINT', () => {
  isShuttingDown = true;
  console.log('[KeepAlive] Received SIGINT. Shutting down...');
  process.exit(0);
});

startServer();
