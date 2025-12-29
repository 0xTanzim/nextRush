import { DEFAULT_CLEANUP_INTERVAL, DEFAULT_MAX_ENTRIES } from '../constants';
import type { RateLimitStore, StoreEntry } from '../types';

/**
 * In-memory store options
 */
export interface MemoryStoreOptions {
  /** Cleanup interval in milliseconds (default: 60000) */
  cleanupInterval?: number;
  /** Disable automatic cleanup */
  disableCleanup?: boolean;
  /** Maximum number of entries to prevent DoS (default: 100000) */
  maxEntries?: number;
}

/**
 * In-memory rate limit store
 *
 * Features:
 * - Automatic cleanup of expired entries
 * - O(1) operations for get/set/increment
 * - Maximum entries limit to prevent DoS
 * - Suitable for single-server deployments
 *
 * Limitations:
 * - Not shared across server instances
 * - Lost on server restart
 * - Memory grows with unique keys (capped by maxEntries)
 *
 * For distributed systems, use Redis store.
 */
export class MemoryStore implements RateLimitStore {
  private readonly entries = new Map<string, StoreEntry & { expiresAt: number }>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private readonly maxEntries: number;

  constructor(options: MemoryStoreOptions = {}) {
    const {
      cleanupInterval = DEFAULT_CLEANUP_INTERVAL,
      disableCleanup = false,
      maxEntries = DEFAULT_MAX_ENTRIES,
    } = options;

    this.maxEntries = maxEntries;

    if (!disableCleanup && cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup().catch(() => {});
      }, cleanupInterval);

      if (this.cleanupTimer.unref) {
        this.cleanupTimer.unref();
      }
    }
  }

  async get(key: string): Promise<StoreEntry | null> {
    const entry = this.entries.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }

    const { expiresAt: _, ...storeEntry } = entry;
    return storeEntry;
  }

  async set(key: string, entry: StoreEntry, ttlMs: number): Promise<void> {
    // Enforce max entries limit to prevent DoS
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      // Evict oldest entry (first in Map iteration order)
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey) {
        this.entries.delete(oldestKey);
      }
    }

    this.entries.set(key, {
      ...entry,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    const now = Date.now();
    const entry = this.entries.get(key);

    if (!entry || now > entry.expiresAt) {
      // Enforce max entries limit to prevent DoS
      if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
        const oldestKey = this.entries.keys().next().value;
        if (oldestKey) {
          this.entries.delete(oldestKey);
        }
      }

      this.entries.set(key, {
        count: 1,
        windowStart: now,
        expiresAt: now + ttlMs,
      });
      return 1;
    }

    entry.count += 1;
    return entry.count;
  }

  async decrement(key: string): Promise<void> {
    const entry = this.entries.get(key);
    if (entry && entry.count > 0) {
      entry.count -= 1;
    }
  }

  async reset(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async cleanup(): Promise<void> {
    const now = Date.now();

    for (const [key, entry] of this.entries) {
      if (now > entry.expiresAt) {
        this.entries.delete(key);
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

/**
 * Create a new in-memory store
 */
export function createMemoryStore(options?: MemoryStoreOptions): MemoryStore {
  return new MemoryStore(options);
}
