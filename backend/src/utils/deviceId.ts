import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

let cachedDeviceId: string | null = null;

function getDeviceIdFilePath(): string {
  const isPkg = !!(process as any).pkg;
  const appDataBase = (process.env.APPDATA as string) || path.join(os.homedir(), 'AppData', 'Roaming');
  const appDataDir = path.join(appDataBase, 'com.shero.tauri-app');

  // In production / packaged mode, always use %APPDATA%\com.shero.tauri-app\.device-id
  if (isPkg || process.cwd().toLowerCase().includes('system32')) {
    if (!fs.existsSync(appDataDir)) {
      try {
        fs.mkdirSync(appDataDir, { recursive: true });
      } catch (_) {}
    }
    return path.join(appDataDir, '.device-id');
  }

  // In development, check if workspace root has .device-id first
  const devFile = path.join(process.cwd(), '.device-id');
  if (fs.existsSync(devFile)) {
    return devFile;
  }

  return devFile;
}

/**
 * Retrieves a stable device ID for this physical POS installation.
 * It reads from `.device-id` in AppData or workspace. If the file doesn't exist,
 * it generates a new UUID, saves it to AppData, and returns it.
 */
export function getDeviceId(): string {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  const deviceIdFile = getDeviceIdFilePath();

  if (fs.existsSync(deviceIdFile)) {
    try {
      const id = fs.readFileSync(deviceIdFile, 'utf-8').trim();
      if (id) {
        cachedDeviceId = id;
        return cachedDeviceId;
      }
    } catch (_) {}
  }

  // Check AppData fallback location
  const appDataBase = (process.env.APPDATA as string) || path.join(os.homedir(), 'AppData', 'Roaming');
  const appDataFile = path.join(appDataBase, 'com.shero.tauri-app', '.device-id');
  if (fs.existsSync(appDataFile)) {
    try {
      const id = fs.readFileSync(appDataFile, 'utf-8').trim();
      if (id) {
        cachedDeviceId = id;
        return cachedDeviceId;
      }
    } catch (_) {}
  }

  // Generate a new stable ID if it doesn't exist
  const newDeviceId = crypto.randomUUID();
  try {
    const targetDir = path.dirname(deviceIdFile);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(deviceIdFile, newDeviceId, 'utf-8');
  } catch (err) {
    console.warn('[DeviceId] Could not persist .device-id to target path, trying AppData fallback:', err);
    try {
      const fallbackDir = path.dirname(appDataFile);
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }
      fs.writeFileSync(appDataFile, newDeviceId, 'utf-8');
    } catch (_) {}
  }

  cachedDeviceId = newDeviceId;
  return cachedDeviceId;
}

