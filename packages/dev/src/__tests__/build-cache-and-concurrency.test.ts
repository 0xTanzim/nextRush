/**
 * Tests for incremental build cache and concurrency (M1)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  hashSourceAndOptions,
  loadCache,
  saveCache,
  createEmptyCache,
  isCached,
  updateCacheEntry,
  type BuildCache,
} from '../commands/build/cache.js';
import { runConcurrent } from '../commands/build/concurrency.js';
import { NODE_FS_PROMISES, NODE_PATH } from '../runtime/node-modules.js';

describe('Incremental build cache (M1 — cache)', () => {
  let cacheFile: string;

  beforeEach(async () => {
    const path = await import(/* @vite-ignore */ NODE_PATH);
    cacheFile = path.join('/tmp', 'nextrush-cache-' + Date.now() + '.json');
  });

  afterEach(async () => {
    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    try {
      await fs.unlink(cacheFile);
    } catch {
      // Ignore
    }
  });

  it('should hash source content consistently', () => {
    const content = 'export const x = 1;';
    const options = { target: 'es2022', decoratorMetadata: true, sourcemap: false, minify: false };

    const hash1 = hashSourceAndOptions(content, options);
    const hash2 = hashSourceAndOptions(content, options);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]+$/); // stable hex content fingerprint
  });

  it('should invalidate hash on content change', () => {
    const options = { target: 'es2022', decoratorMetadata: true, sourcemap: false, minify: false };

    const hash1 = hashSourceAndOptions('export const x = 1;', options);
    const hash2 = hashSourceAndOptions('export const x = 2;', options);

    expect(hash1).not.toBe(hash2);
  });

  it('should invalidate hash on options change', () => {
    const content = 'export const x = 1;';

    const hash1 = hashSourceAndOptions(content, {
      target: 'es2022',
      decoratorMetadata: true,
      sourcemap: false,
      minify: false,
    });

    const hash2 = hashSourceAndOptions(content, {
      target: 'esnext',
      decoratorMetadata: true,
      sourcemap: false,
      minify: false,
    });

    expect(hash1).not.toBe(hash2);
  });

  it('should create empty cache', () => {
    const cache = createEmptyCache('abc123');
    expect(cache.version).toBe(1);
    expect(cache.optionsHash).toBe('abc123');
    expect(cache.entries).toEqual({});
  });

  it('should save and load cache', async () => {

    const cache: BuildCache = {
      version: 1,
      optionsHash: 'abc123',
      entries: {
        '/src/file.ts': {
          sourceHash: 'hash1',
          outputExists: true,
          timestamp: Date.now(),
        },
      },
    };

    await saveCache(cacheFile, cache);
    const loaded = await loadCache(cacheFile);

    expect(loaded).toEqual(cache);
  });

  it('should return null when cache file does not exist', async () => {
    const cache = await loadCache('/nonexistent/cache.json');
    expect(cache).toBeNull();
  });

  it('should detect cache hits', () => {
    const cache: BuildCache = {
      version: 1,
      optionsHash: 'options1',
      entries: {
        '/src/file.ts': {
          sourceHash: 'hash1',
          outputExists: true,
          timestamp: Date.now(),
        },
      },
    };

    const hit = isCached(cache, '/src/file.ts', 'hash1', 'options1');
    expect(hit).toBe(true);
  });

  it('should detect cache misses on options change', () => {
    const cache: BuildCache = {
      version: 1,
      optionsHash: 'options1',
      entries: {},
    };

    const hit = isCached(cache, '/src/file.ts', 'hash1', 'options2');
    expect(hit).toBe(false);
  });

  it('should detect cache misses on source hash change', () => {
    const cache: BuildCache = {
      version: 1,
      optionsHash: 'options1',
      entries: {
        '/src/file.ts': {
          sourceHash: 'hash1',
          outputExists: true,
          timestamp: Date.now(),
        },
      },
    };

    const hit = isCached(cache, '/src/file.ts', 'hash2', 'options1');
    expect(hit).toBe(false);
  });

  it('should detect cache misses when output does not exist', () => {
    const cache: BuildCache = {
      version: 1,
      optionsHash: 'options1',
      entries: {
        '/src/file.ts': {
          sourceHash: 'hash1',
          outputExists: false,
          timestamp: Date.now(),
        },
      },
    };

    const hit = isCached(cache, '/src/file.ts', 'hash1', 'options1');
    expect(hit).toBe(false);
  });

  it('should update cache entries', () => {
    const cache = createEmptyCache('options1');

    updateCacheEntry(cache, '/src/file.ts', 'hash1', true);

    expect(cache.entries['/src/file.ts']).toEqual({
      sourceHash: 'hash1',
      outputExists: true,
      timestamp: expect.any(Number),
    });
  });
});

describe('Bounded concurrency pool (M1 — concurrency)', () => {
  it('should execute tasks concurrently', async () => {
    const results: number[] = [];
    const tasks = Array.from({ length: 10 }, (_, i) => async () => {
      await new Promise((r) => setTimeout(r, 1));
      results.push(i);
      return i;
    });

    const output = await runConcurrent(tasks, { concurrency: 4 });

    expect(output).toEqual(Array.from({ length: 10 }, (_, i) => i));
    expect(output.length).toBe(10);
  });

  it('should respect concurrency limit', async () => {
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const tasks = Array.from({ length: 20 }, () => async () => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);

      await new Promise((r) => setTimeout(r, 1));
      currentConcurrent--;
    });

    await runConcurrent(tasks, { concurrency: 3 });

    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it('should preserve task order in results', async () => {
    const tasks = Array.from({ length: 10 }, (_, i) => async () => {
      await new Promise((r) => setTimeout(r, Math.random() * 10));
      return i;
    });

    const results = await runConcurrent(tasks);

    expect(results).toEqual(Array.from({ length: 10 }, (_, i) => i));
  });

  it('should handle task errors', async () => {
    const tasks = [
      async () => 'ok',
      async () => {
        throw new Error('Task failed');
      },
      async () => 'ok2',
    ];

    // runConcurrent should reject if any task fails
    await expect(runConcurrent(tasks)).rejects.toThrow('Task failed');
  }, 10000);

  it('should use reasonable default concurrency', async () => {
    const tasks = Array.from({ length: 100 }, (_, i) => async () => i);
    const results = await runConcurrent(tasks); // No explicit concurrency

    expect(results).toHaveLength(100);
    expect(results[0]).toBe(0);
  });
});
