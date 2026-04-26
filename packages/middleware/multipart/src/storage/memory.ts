/**
 * @nextrush/multipart - Memory Storage
 *
 * Stores uploaded files in memory as Uint8Array.
 * Suitable for small files or when files are processed immediately.
 *
 * Works on all runtimes: Node.js, Bun, Deno, Edge.
 *
 * @packageDocumentation
 */

import { Errors } from '../errors.js';
import type { FileInfo, StorageResult, StorageStrategy } from '../types.js';

/**
 * Storage strategy that buffers file data in memory.
 *
 * @example
 * ```typescript
 * import { multipart, MemoryStorage } from '@nextrush/multipart';
 *
 * app.use(multipart({
 *   storage: new MemoryStorage(),
 *   limits: { maxFileSize: '5mb' },
 * }));
 * ```
 */
export class MemoryStorage implements StorageStrategy {
  async handle(stream: ReadableStream<Uint8Array>, _info: FileInfo): Promise<StorageResult> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.length;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown read error';
      throw Errors.storageError(message);
    } finally {
      reader.releaseLock();
    }

    // Concatenate chunks into a single Uint8Array
    let buffer: Uint8Array;
    if (chunks.length === 0) {
      buffer = new Uint8Array(0);
    } else if (chunks.length === 1) {
      buffer = chunks[0]!;
    } else {
      buffer = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }
    }

    return { size, buffer };
  }
}
