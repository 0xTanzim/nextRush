/**
 * Tests for atomic file writes (M4)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileAtomic } from '../commands/build/atomic-write.js';
import { NODE_FS_PROMISES, NODE_PATH } from '../runtime/node-modules.js';

describe('Atomic file writes (M4)', () => {
  let testDir: string;

  beforeEach(async () => {
    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    const path = await import(/* @vite-ignore */ NODE_PATH);

    testDir = path.join('/tmp', 'nextrush-atomic-' + Date.now());
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

  it('should write a file atomically', async () => {
    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    const path = await import(/* @vite-ignore */ NODE_PATH);

    const filePath = path.join(testDir, 'test.txt');
    const content = 'Hello, World!';

    await writeFileAtomic(filePath, content);

    const written = await fs.readFile(filePath, 'utf-8');
    expect(written).toBe(content);
  });

  it('should not leave temp files on success', async () => {
    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    const path = await import(/* @vite-ignore */ NODE_PATH);

    const filePath = path.join(testDir, 'output.js');
    const content = 'console.log("test");';

    await writeFileAtomic(filePath, content);

    // List directory and ensure no .tmp files remain
    const files = await fs.readdir(testDir);
    const tmpFiles = files.filter((f: string) => f.endsWith('.tmp'));
    expect(tmpFiles).toHaveLength(0);
  });

  it('should overwrite existing files', async () => {
    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    const path = await import(/* @vite-ignore */ NODE_PATH);

    const filePath = path.join(testDir, 'data.json');

    // Write first time
    await writeFileAtomic(filePath, '{"v": 1}');

    // Write second time (overwrite)
    await writeFileAtomic(filePath, '{"v": 2}');

    const written = await fs.readFile(filePath, 'utf-8');
    expect(written).toBe('{"v": 2}');
  });

  it('should handle nested directories', async () => {
    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    const path = await import(/* @vite-ignore */ NODE_PATH);

    const nestedPath = path.join(testDir, 'deep', 'nested', 'file.txt');

    // Should NOT fail due to missing directories
    // (atomic-write doesn't create dirs — caller must)
    // This test documents the behavior
    const parentDir = path.dirname(nestedPath);
    await fs.mkdir(parentDir, { recursive: true });

    await writeFileAtomic(nestedPath, 'nested content');

    const written = await fs.readFile(nestedPath, 'utf-8');
    expect(written).toBe('nested content');
  });

  it('should maintain consistency on concurrent writes to different files', async () => {
    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    const path = await import(/* @vite-ignore */ NODE_PATH);

    const file1 = path.join(testDir, 'file1.txt');
    const file2 = path.join(testDir, 'file2.txt');

    // Write concurrently to different files
    await Promise.all([
      writeFileAtomic(file1, 'Content 1'),
      writeFileAtomic(file2, 'Content 2'),
    ]);

    const content1 = await fs.readFile(file1, 'utf-8');
    const content2 = await fs.readFile(file2, 'utf-8');

    expect(content1).toBe('Content 1');
    expect(content2).toBe('Content 2');
  });

  it('should clean up temp files on write error', async () => {
    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    const path = await import(/* @vite-ignore */ NODE_PATH);

    // Try to write to a path that doesn't have a parent directory
    // This should fail during write or rename
    const invalidPath = path.join(testDir, 'nonexistent', 'dir', 'file.txt');

    try {
      await writeFileAtomic(invalidPath, 'test');
    } catch (err) {
      // Expected to fail
      expect(err).toBeInstanceOf(Error);
    }

    // Check that no orphaned .tmp files exist in testDir root
    const files = await fs.readdir(testDir);
    const tmpFiles = files.filter((f: string) => f.endsWith('.tmp'));
    expect(tmpFiles).toHaveLength(0);
  });
});
