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
    const execDir: string = path.dirname(process.execPath);
    const candidates: string[] = [
      path.join(execDir, 'template.db'),
      path.join(execDir, '..', 'template.db'),
    ];
    for (const tpl of candidates) {
      if (fs.existsSync(tpl)) {
        fs.copyFileSync(tpl, dbPath);
        console.log('[Bootstrap] Seeded DB from template: ' + tpl + ' -> ' + dbPath);
        break;
      }
    }
  }

  process.env.DATABASE_URL = 'file:' + dbPath;
  console.log('[Bootstrap] DATABASE_URL = ' + process.env.DATABASE_URL);
} else if (IS_PKG) {
  console.log('[Bootstrap] DATABASE_URL already set: ' + process.env.DATABASE_URL);
}

// 4. Resolve Prisma query engine for pkg sidecar
if (IS_PKG && !process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  const execDir: string = path.dirname(process.execPath);
  const engineName = 'query_engine-windows.dll.node';
  const candidates: string[] = [
    path.join(execDir, engineName),
    path.join(execDir, '..', engineName),
  ];
  for (const ep of candidates) {
    if (fs.existsSync(ep)) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = ep;
      console.log('[Bootstrap] PRISMA_QUERY_ENGINE_LIBRARY = ' + ep);
      break;
    }
  }
  if (!process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
    console.warn('[Bootstrap] WARNING: ' + engineName + ' not found next to exe!');
  }
}

// 5. Now load the real server (env is guaranteed to be set)
require('./server');
