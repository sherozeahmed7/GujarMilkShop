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

// Setup log file in APPDATA for production debugging
const appDataDir = (process.env.APPDATA as string) || path.join(os.homedir(), 'AppData', 'Roaming');
const logDir = path.join(appDataDir, 'com.shero.tauri-app');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, 'backend.log');

function writeToLog(type: string, args: any[]) {
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  const line = `[${new Date().toISOString()}] [${type}] ${msg}\n`;
  try {
    fs.appendFileSync(logFile, line);
  } catch (_) {}
}

const originalLog = console.log;
const originalErr = console.error;
const originalWarn = console.warn;

console.log = function (...args: any[]) {
  writeToLog('INFO', args);
  originalLog.apply(console, args);
};

console.error = function (...args: any[]) {
  writeToLog('ERROR', args);
  originalErr.apply(console, args);
};

console.warn = function (...args: any[]) {
  writeToLog('WARN', args);
  originalWarn.apply(console, args);
};

function log(msg: string) {
  console.log(msg);
}

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

// 1. Load .env (supports dev cwd, packaged sidecar resources, and AppData config)
const dotenv = require('dotenv');
dotenv.config();

const resolvedEnv = resolveResource('.env');
if (resolvedEnv) {
  dotenv.config({ path: resolvedEnv });
}
const appDataEnv = path.join(logDir, '.env');
if (fs.existsSync(appDataEnv)) {
  dotenv.config({ path: appDataEnv });
}

// 2. Detect pkg sidecar context
const IS_PKG = !!(process as any).pkg;

log('[Bootstrap] Starting backend process. IS_PKG=' + IS_PKG + ', execPath=' + process.execPath);

// 3. Synthesise DATABASE_URL for pkg sidecar
if (IS_PKG) {
  // Tauri stores app data at: %APPDATA%\com.shero.tauri-app
  const appDataBase: string =
    (process.env.APPDATA as string) || path.join(os.homedir(), 'AppData', 'Roaming');
  const dbDir: string = path.join(appDataBase, 'com.shero.tauri-app');

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath: string = path.join(dbDir, 'pos.db');

  // If pos.db does not exist or is empty (0 bytes), seed it from the bundled template.db.
  const dbExists = fs.existsSync(dbPath);
  let dbSize = 0;
  if (dbExists) {
    try {
      dbSize = fs.statSync(dbPath).size;
    } catch (_) {}
  }

  if (!dbExists || dbSize === 0) {
    const tplPath = resolveResource('template.db');
    if (tplPath && fs.existsSync(tplPath)) {
      const tplSize = fs.statSync(tplPath).size;
      if (tplSize > 0) {
        fs.copyFileSync(tplPath, dbPath);
        log('[Bootstrap] Seeded DB from template (' + tplSize + ' bytes): ' + tplPath + ' -> ' + dbPath);
      } else {
        log('[Bootstrap] WARNING: template.db found at ' + tplPath + ' but has 0 bytes!');
      }
    } else {
      log('[Bootstrap] WARNING: template.db not found! Database might not initialize properly.');
    }
  }

  // In packaged binary mode, always point DATABASE_URL to the absolute pos.db path in AppData
  process.env.DATABASE_URL = 'file:' + dbPath;
  log('[Bootstrap] IS_PKG active: DATABASE_URL set to ' + process.env.DATABASE_URL);
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

