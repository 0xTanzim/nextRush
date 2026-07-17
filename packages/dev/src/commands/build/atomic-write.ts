/* eslint-disable nextrush/no-runtime-identity-capability -- dev CLI runtime-specific file write; platform optimization */
/**
 * Atomic file write operations using temp file + rename pattern
 *
 * Ensures file consistency: either the new content is fully written,
 * or the original file remains unchanged. No partial writes.
 */

import { detectRuntime } from '../../runtime/detect.js';
import { NODE_FS_PROMISES } from '../../runtime/node-modules.js';

const runtime = detectRuntime();

/**
 * Generate a random suffix for temp files (collision-resistant)
 */
function generateTempSuffix(): string {
  // Use Date.now + random number for better cross-runtime compatibility
  return `${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Atomically write a file using temp + rename pattern
 *
 * Node.js/Bun: fs.writeFile + fs.rename
 * Deno: Deno.writeTextFile + Deno.rename
 */
export async function writeFileAtomic(path: string, content: string): Promise<void> {
  if (runtime === 'deno') {
    const tempPath = `${path}.${generateTempSuffix()}.tmp`;
    try {
      // @ts-expect-error Deno.writeTextFile exists in Deno runtime
      await globalThis.Deno.writeTextFile(tempPath, content);
      // @ts-expect-error Deno.rename exists in Deno runtime
      await globalThis.Deno.rename(tempPath, path);
    } catch (err) {
      try {
        // @ts-expect-error Deno.remove exists in Deno runtime
        await globalThis.Deno.remove(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw err;
    }
    return;
  }

  // Node.js / Bun
  const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);

  const suffix = generateTempSuffix();
  const tempPath = `${path}.${suffix}.tmp`;

  try {
    await fs.writeFile(tempPath, content, 'utf-8');
    // Atomic rename
    await fs.rename(tempPath, path);
  } catch (err) {
    try {
      // Clean up temp file on failure
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}
