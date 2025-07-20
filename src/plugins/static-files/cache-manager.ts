/**
 * 💾 Static Files Cache Manager
 * Intelligent LRU-based caching with automatic eviction
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import { CacheEntry } from './types';

/**
 * LRU cache node for efficient cache management
 */
interface CacheNode {
  key: string;
  entry: CacheEntry;
  accessTime: number;
  accessCount: number;
  prev: CacheNode | null;
  next: CacheNode | null;
}

/**
 * Cache statistics tracking
 */
interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  entryCount: number;
}

/**
 * Intelligent cache manager for static files
 */
export class CacheManager {
  private cache = new Map<string, CacheNode>();
  private head: CacheNode | null = null;
  private tail: CacheNode | null = null;
  private currentSize = 0;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
    entryCount: 0,
  };

  constructor(
    private maxSize: number = 100 * 1024 * 1024, // 100MB
    private maxFileSize: number = 2 * 1024 * 1024 // 2MB
  ) {}

  /**
   * Get cached entry
   */
  get(key: string): CacheEntry | null {
    const node = this.cache.get(key);
    if (!node) {
      this.stats.misses++;
      return null;
    }

    // Update access information
    node.accessTime = Date.now();
    node.accessCount++;

    // Move to head (most recently used)
    this.moveToHead(node);

    this.stats.hits++;
    return node.entry;
  }

  /**
   * Cache entry with intelligent eviction
   */
  set(key: string, entry: CacheEntry): boolean {
    // Check if file is too large to cache
    if (entry.size > this.maxFileSize) {
      return false;
    }

    // Check if entry already exists
    const existingNode = this.cache.get(key);
    if (existingNode) {
      // Update existing entry
      this.currentSize -= existingNode.entry.size;
      existingNode.entry = entry;
      existingNode.accessTime = Date.now();
      existingNode.accessCount++;
      this.moveToHead(existingNode);
      this.currentSize += entry.size;
      this.updateStats();
      return true;
    }

    // Create new node
    const node: CacheNode = {
      key,
      entry,
      accessTime: Date.now(),
      accessCount: 1,
      prev: null,
      next: null,
    };

    // Ensure space is available
    this.ensureSpace(entry.size);

    // Add to cache
    this.cache.set(key, node);
    this.addToHead(node);
    this.currentSize += entry.size;
    this.updateStats();

    return true;
  }

  /**
   * Check if entry exists and is still valid
   */
  has(key: string, lastModified: Date): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    // Check if file has been modified
    if (node.entry.lastModified < lastModified) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove entry from cache
   */
  delete(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    this.cache.delete(key);
    this.removeNode(node);
    this.currentSize -= node.entry.size;
    this.updateStats();

    return true;
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.currentSize = 0;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
      entryCount: 0,
    };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate =
      totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  /**
   * Generate cache key for file
   */
  generateKey(filePath: string, stats: fs.Stats): string {
    return `${filePath}:${stats.mtime.getTime()}:${stats.size}`;
  }

  /**
   * Generate ETag for file
   */
  generateETag(content: Buffer, stats: fs.Stats): string {
    const hash = crypto
      .createHash('md5')
      .update(`${stats.mtime.getTime()}-${stats.size}`)
      .digest('hex');
    return `"${hash}"`;
  }

  /**
   * Set cache size limits
   */
  setLimits(maxSize: number, maxFileSize: number): void {
    this.maxSize = maxSize;
    this.maxFileSize = maxFileSize;

    // Trigger cleanup if current size exceeds new limit
    this.ensureSpace(0);
  }

  /**
   * Ensure sufficient space for new entry
   */
  private ensureSpace(requiredSize: number): void {
    while (this.currentSize + requiredSize > this.maxSize && this.tail) {
      this.evictLRU();
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (!this.tail) return;

    const evicted = this.tail;
    this.cache.delete(evicted.key);
    this.removeNode(evicted);
    this.currentSize -= evicted.entry.size;
    this.stats.evictions++;
  }

  /**
   * Move node to head of LRU list
   */
  private moveToHead(node: CacheNode): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  /**
   * Add node to head of LRU list
   */
  private addToHead(node: CacheNode): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Remove node from LRU list
   */
  private removeNode(node: CacheNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  /**
   * Update internal statistics
   */
  private updateStats(): void {
    this.stats.totalSize = this.currentSize;
    this.stats.entryCount = this.cache.size;
  }

  /**
   * Perform cache maintenance (remove stale entries)
   */
  performMaintenance(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [key, node] of this.cache.entries()) {
      // Remove entries older than max age with low access count
      if (now - node.accessTime > maxAge && node.accessCount < 3) {
        this.delete(key);
      }
    }
  }
}
