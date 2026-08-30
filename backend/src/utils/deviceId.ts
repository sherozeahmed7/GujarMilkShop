import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DEVICE_ID_FILE = path.join(process.cwd(), '.device-id');

let cachedDeviceId: string | null = null;

/**
 * Retrieves a stable device ID for this physical POS installation.
 * It reads from `.device-id`. If the file doesn't exist, it generates a new UUID,
 * saves it to the file, and returns it. This ensures the ID remains the same
 * across server restarts and does not use any personal information.
 */
export function getDeviceId(): string {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  if (fs.existsSync(DEVICE_ID_FILE)) {
    const id = fs.readFileSync(DEVICE_ID_FILE, 'utf-8').trim();
    if (id) {
      cachedDeviceId = id;
      return cachedDeviceId;
    }
  }

  // Generate a new stable ID if it doesn't exist
  const newDeviceId = crypto.randomUUID();
  fs.writeFileSync(DEVICE_ID_FILE, newDeviceId, 'utf-8');
  cachedDeviceId = newDeviceId;
  
  return cachedDeviceId;
}
