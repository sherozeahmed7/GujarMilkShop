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

const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10 MB per log segment
const MAX_BACKUPS = 3;

function rotateLogIfNeeded() {
  try {
    if (!fs.existsSync(logFile)) return;
    const stats = fs.statSync(logFile);
    if (stats.size < MAX_LOG_SIZE) return;

    // If existing log is huge (> 100MB, e.g. legacy 1.63GB production log), preserve it with timestamped archive
    if (stats.size > 100 * 1024 * 1024) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const archivePath = path.join(logDir, `backend.archive_${stamp}.log`);
      try {
        fs.renameSync(logFile, archivePath);
        return;
      } catch (_) {
        // If rename fails due to open Windows file handle, truncate safely or write to fresh segment
      }
    }

    // Standard numbered rotation: backend.3.log -> removed, backend.2.log -> backend.3.log, backend.1.log -> backend.2.log, backend.log -> backend.1.log
    for (let i = MAX_BACKUPS; i >= 1; i--) {
      const current = path.join(logDir, `backend.${i}.log`);
      if (i === MAX_BACKUPS && fs.existsSync(current)) {
        fs.unlinkSync(current);
      } else if (fs.existsSync(current)) {
        const next = path.join(logDir, `backend.${i + 1}.log`);
        try { fs.renameSync(current, next); } catch (_) {}
      }
    }
    const backup1 = path.join(logDir, 'backend.1.log');
    try { fs.renameSync(logFile, backup1); } catch (_) {}
  } catch (err) {
    // Fail silently to never crash backend bootstrap
  }
}

// Perform check once on initial startup
try { rotateLogIfNeeded(); } catch (_) {}

let logCounter = 0;
function writeToLog(type: string, args: any[]) {
  logCounter++;
  if (logCounter >= 250) {
    logCounter = 0;
    rotateLogIfNeeded();
  }

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
  try {
    originalLog.apply(console, args);
  } catch (_) {}
};

console.error = function (...args: any[]) {
  writeToLog('ERROR', args);
  try {
    originalErr.apply(console, args);
  } catch (_) {}
};

console.warn = function (...args: any[]) {
  writeToLog('WARN', args);
  try {
    originalWarn.apply(console, args);
  } catch (_) {}
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
  process.env.DATABASE_URL = 'file:' + dbPath + '?connection_limit=1&socket_timeout=3';
  log('[Bootstrap] LOCAL_DB_PATH=' + dbPath);
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

