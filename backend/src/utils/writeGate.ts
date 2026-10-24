import EventEmitter from 'events';

/**
 * Priority Write Gate for SQLite
 *
 * SQLite supports only ONE active writer at a time.
 * To ensure cashier checkout NEVER stalls behind background workers (e.g. Wi-Fi
 * reconnecting and batch-updating 50-100 SyncQueue rows or downstream applies),
 * all writes pass through this small in-memory priority queue:
 *
 * - 'checkout' (HIGH PRIORITY): Enqueued immediately at head.
 * - 'background' (LOW PRIORITY): Enqueued at tail.
 *
 * If a checkout request is waiting, background workers must yield between short
 * chunks and CANNOT acquire the gate ahead of checkout.
 *
 * NOTE: Network/HTTP calls MUST NEVER be executed while holding this gate.
 */
class PriorityWriteGate extends EventEmitter {
  private activeWriter: boolean = false;
  private pendingHigh: Array<() => void> = [];
  private pendingLow: Array<() => void> = [];

  public get isCheckoutWaiting(): boolean {
    return this.pendingHigh.length > 0;
  }

  public async acquire(priority: 'checkout' | 'background' = 'background'): Promise<() => void> {
    if (!this.activeWriter && (priority === 'checkout' || this.pendingHigh.length === 0)) {
      this.activeWriter = true;
      return this.createRelease();
    }

    return new Promise<() => void>((resolve) => {
      const grant = () => {
        this.activeWriter = true;
        resolve(this.createRelease());
      };

      if (priority === 'checkout') {
        this.pendingHigh.push(grant);
      } else {
        this.pendingLow.push(grant);
      }
    });
  }

  private createRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.activeWriter = false;

      // Always grant HIGH priority (checkout) before background
      if (this.pendingHigh.length > 0) {
        const nextHigh = this.pendingHigh.shift()!;
        nextHigh();
      } else if (this.pendingLow.length > 0) {
        const nextLow = this.pendingLow.shift()!;
        nextLow();
      }
    };
  }

  /**
   * Helper to execute a short SQLite write transaction with priority.
   */
  public async execute<T>(
    priority: 'checkout' | 'background',
    fn: () => Promise<T>
  ): Promise<T> {
    const release = await this.acquire(priority);
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

export const writeGate = new PriorityWriteGate();
