/**
 * bootstrap.ts — pkg sidecar entry point
 *
 * This file MUST be the pkg entry point (package.json "main" / "bin").
 * It uses require() — not ES import — so env vars are set BEFORE any module
 * that instantiates PrismaClient is required.
 *
 * When running via ts-node (npm run dev), this file is loaded first,
 * immediately requires server.ts, and is otherwise transparent.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const fs   = require('fs');
const os   = require('os');

// 1. Load .env (works in npm run dev; no-op inside pkg snapshot)
const dotenv = require('dotenv');
dotenv.config();

// 2. Detect pkg sidecar context
const IS_PKG = !!(process as any).pkg;

// Setup log file in APPDATA for production debugging
const appDataDir = (process.env.APPDATA as string) || path.join(os.homedir(), 'AppData', 'Roaming');
const logDir = path.join(appDataDir, 'com.shero.tauri-app');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, 'backend.log');

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  try {
    fs.appendFileSync(logFile, line);
  } catch (_) {}
}

log('[Bootstrap] Starting backend process. IS_PKG=' + IS_PKG + ', execPath=' + process.execPath);

function resolveResource(filename: string): string | null {
  const execDir = path.dirname(process.execPath);
  const cwd = process.cwd();
  
  const candidates = [
    // 1. Next to the executable (Tauri dev, or flattened prod if externalBin isn't preserved)
    path.join(execDir, filename),
    // 2. In a 'bin' subfolder relative to executable (Tauri prod places resources in 'bin/' if specified as 'bin/file')
    path.join(execDir, 'bin', filename),
    // 3. In '_up_' relative to executable (Tauri resource unpack structures)
    path.join(execDir, '_up_', filename),
    path.join(execDir, '_up_', 'bin', filename),
    // 4. One level up
    path.join(execDir, '..', filename),
    // 5. One level up + 'bin'
    path.join(execDir, '..', 'bin', filename),
    // 6. Fallback relative to cwd
    path.join(cwd, 'bin', filename),
    path.join(cwd, filename)
  ];
  
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      log('[Bootstrap] Resolved ' + filename + ' -> ' + c);
      return c;
    }
  }
  log('[Bootstrap] Failed to resolve resource: ' + filename + '. Searched candidates: ' + JSON.stringify(candidates));
  return null;
}

// 3. Synthesise DATABASE_URL for pkg sidecar
if (IS_PKG && !process.env.DATABASE_URL) {
  // Tauri stores app data at: %APPDATA%\com.shero.tauri-app
  const appDataBase: string =
    (process.env.APPDATA as string) || path.join(os.homedir(), 'AppData', 'Roaming');
  const dbDir: string = path.join(appDataBase, 'com.shero.tauri-app');

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath: string = path.join(dbDir, 'pos.db');

  // If pos.db does not yet exist, seed it from the bundled template.db.
  if (!fs.existsSync(dbPath)) {
    const tplPath = resolveResource('template.db');
    if (tplPath) {
      fs.copyFileSync(tplPath, dbPath);
      log('[Bootstrap] Seeded DB from template: ' + tplPath + ' -> ' + dbPath);
    } else {
      log('[Bootstrap] WARNING: template.db not found! Database might not initialize properly.');
    }
  }

  process.env.DATABASE_URL = 'file:' + dbPath;
  log('[Bootstrap] DATABASE_URL = ' + process.env.DATABASE_URL);
} else if (IS_PKG) {
  log('[Bootstrap] DATABASE_URL already set: ' + process.env.DATABASE_URL);
}

// 4. Resolve Prisma query engine and schema for pkg sidecar
if (IS_PKG) {
  if (!process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
    const engineName = 'query_engine-windows.dll.node';
    const enginePath = resolveResource(engineName);
    
    if (enginePath) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = enginePath;
      log('[Bootstrap] PRISMA_QUERY_ENGINE_LIBRARY = ' + enginePath);
    } else {
      log('[Bootstrap] ERROR: ' + engineName + ' not found in any expected location!');
    }
  }
  
  // Verify schema.prisma presence (Prisma reads this internally in pkg environments)
  const schemaPath = resolveResource('schema.prisma');
  if (schemaPath) {
    log('[Bootstrap] Found schema.prisma at: ' + schemaPath);
  } else {
    log('[Bootstrap] ERROR: schema.prisma not found! Prisma might fail to start.');
  }
}

process.on('uncaughtException', (err: any) => {
  log('[Bootstrap] FATAL uncaughtException: ' + (err?.stack || err?.message || err));
});

process.on('unhandledRejection', (reason: any) => {
  log('[Bootstrap] FATAL unhandledRejection: ' + (reason?.stack || reason?.message || reason));
});

// 5. Now load the real server (env is guaranteed to be set)
log('[Bootstrap] Requiring server.ts...');
require('./server');

