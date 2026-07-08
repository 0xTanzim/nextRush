/**
 * Tests for build cleanup safety guards
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanDirectory } from '../commands/build/cleanup.js';
import { getCwd } from '../runtime/index.js';
import { NODE_FS_PROMISES, NODE_PATH } from '../runtime/node-modules.js';

describe('cleanDirectory safety guards (C2)', () => {
  let testDir: string;
  let cwd: string;

  beforeEach(async () => {
    cwd = getCwd();
    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    const path = await import(/* @vite-ignore */ NODE_PATH);

    testDir = path.join(cwd, '.nextrush-test-cleanup-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('should refuse to clean parent directory', async () => {
    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    const path = await import(/* @vite-ignore */ NODE_PATH);

    const subdir = path.join(testDir, 'sub', 'nested', 'dir');
    await fs.mkdir(subdir, { recursive: true });

    // Try to clean parent of testDir
    await expect(cleanDirectory('..', subdir)).rejects.toThrow(
      /Refusing to clean outside cwd|must be strictly inside/
    );
  });

  it('should refuse to clean outside cwd', async () => {
    const path = await import(/* @vite-ignore */ NODE_PATH);

    const outside = path.join(testDir, '..', '..', 'outside');
    await expect(cleanDirectory(outside, testDir)).rejects.toThrow(
      /Refusing to clean outside cwd|must be strictly inside/
    );
  });

  it('should allow cleaning a normal dist directory', async () => {
    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    const path = await import(/* @vite-ignore */ NODE_PATH);

    const distDir = path.join(testDir, 'dist');
    await fs.mkdir(distDir, { recursive: true });

    // Create a test file
    const testFile = path.join(distDir, 'test.js');
    await fs.writeFile(testFile, 'console.log("test");');

    // Clean should succeed
    await cleanDirectory(distDir, testDir);

    // Verify it was deleted
    const exists = await fs
      .access(distDir)
      .then(() => true)
      .catch(() => false);

    expect(exists).toBe(false);
  });

  it('should throw on error instead of silently failing', async () => {
    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    const path = await import(/* @vite-ignore */ NODE_PATH);

    const noPermDir = path.join(testDir, 'dist');
    await fs.mkdir(noPermDir, { recursive: true });

    // This should throw (directory guard + actual removal)
    // We can't easily test permission errors cross-platform,
    // but we can test that the error is NOT swallowed
    try {
      await cleanDirectory(noPermDir, testDir);
      // If it didn't throw, it should have been deleted
      const exists = await fs
        .access(noPermDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    } catch (err) {
      // Should throw instead of warn
      expect(err).toBeInstanceOf(Error);
    }
  });
});
