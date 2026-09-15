/**
 * Global mutex for Restore Cloud Data operations.
 * When a restore is running, sync workers and POS transaction mutators
 * are paused to guarantee zero race conditions or interleaved writes.
 */
let isRestoreActive = false;

export function isRestoreInProgress(): boolean {
  return isRestoreActive;
}

export function setRestoreInProgress(active: boolean): void {
  isRestoreActive = active;
}
