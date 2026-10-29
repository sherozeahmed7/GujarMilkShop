/**
 * Frontend Token Allocator — Safe Pre-Reserved Block Strategy
 *
 * How it works:
 *  1. On first use, invoke `reserve_token_block` in Tauri, which atomically
 *     queries MAX(tokenNumber) for the current month inside an EXCLUSIVE
 *     transaction and returns a reserved range [start, end].
 *  2. Cash OK consumes the next number from the in-memory block instantly (0ms).
 *  3. When <= LOW_WATER remaining, a background refill is triggered automatically.
 *  4. Monthly reset: the Tauri command always counts from the current month, so
 *     if the month rolls over the next reservation naturally starts from 1 again.
 *  5. Idempotency: the same checkoutUuid always gets the same tokenNumber because
 *     the token is baked into the immutable snapshot before any network call.
 */

import { invoke } from '@tauri-apps/api/core';

const BLOCK_SIZE = 20; // tokens reserved per batch
const LOW_WATER  = 5;  // refill when fewer than this many remain

interface TokenBlock {
  next:  number; // next token to hand out
  end:   number; // inclusive end of reserved block
  month: string; // 'YYYY-MM' this block was reserved for
}

function currentYearMonth(): string {
  const d    = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

// Module-level singleton state
let block: TokenBlock | null = null;
let refillInFlight = false;
let pendingResolvers: Array<(token: number) => void> = [];

async function reserveBlock(): Promise<{ start: number; end: number }> {
  return invoke<{ start: number; end: number }>('reserve_token_block', {
    blockSize: BLOCK_SIZE,
  });
}

async function backgroundRefill(): Promise<void> {
  if (refillInFlight) return;
  refillInFlight = true;
  try {
    const month = currentYearMonth();
    const range = await reserveBlock();
    if (currentYearMonth() === month) {
      if (!block || range.start > block.next) {
        block = { next: range.start, end: range.end, month };
      }
    }
    // Flush any callers that were waiting
    while (pendingResolvers.length > 0 && block && block.next <= block.end) {
      const resolve = pendingResolvers.shift()!;
      resolve(block.next++);
    }
  } catch (err) {
    console.warn('[TokenAllocator] Background refill failed:', err);
    block = null;
  } finally {
    refillInFlight = false;
  }
}

/**
 * Returns the next safe token number for the current month.
 * Instant if a pre-reserved block is available; awaits Tauri only when exhausted.
 */
export async function nextToken(): Promise<number> {
  const month = currentYearMonth();

  // Invalidate on month rollover
  if (block && block.month !== month) {
    block = null;
  }

  // Happy path: instant from memory
  if (block && block.next <= block.end) {
    const token = block.next++;
    if (block.end - block.next + 1 <= LOW_WATER) {
      backgroundRefill();
    }
    return token;
  }

  // Block exhausted — must request fresh reservation
  if (refillInFlight) {
    return new Promise<number>((resolve) => {
      pendingResolvers.push(resolve);
    });
  }

  try {
    const range = await reserveBlock();
    block = { next: range.start, end: range.end, month };
    return block.next++;
  } catch (err) {
    console.error('[TokenAllocator] reserve_token_block failed, using emergency fallback:', err);
    // Emergency: use a large timestamp-mod token so receipt is never empty.
    // SQLite save_pos_sale will honour the frontend-supplied tokenNumber, so the
    // receipt and the DB row will still match. Fallback range 1000-9999 avoids
    // collision with normal daily sequence.
    return ((Date.now() % 9000) + 1000);
  }
}

/**
 * Pre-warm the allocator at POS mount so the first checkout is always instant.
 */
export function prewarmTokenAllocator(): void {
  if (!block || block.next > block.end || block.month !== currentYearMonth()) {
    backgroundRefill();
  }
}
