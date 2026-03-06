/**
 * @nextrush/multipart - Disk Storage
 *
 * Streams uploaded files directly to the filesystem.
 * Suitable for large files that shouldn't be held in memory.
 *
 * Note: This storage strategy requires filesystem access and is only
 * available on Node.js, Bun, and Deno. Not available on Edge runtimes.
 *
 * @packageDocumentation
 */

import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { Errors } from '../errors.js';
import type { FileInfo, StorageResult, StorageStrategy } from '../types.js';

export interface DiskStorageOptions {
  /** Destination directory for uploaded files. Will be created if it doesn't exist. */
  dest: string;
  /**
   * Custom filename generator. Receives file info and returns the filename.
   * Default: uses the sanitized filename with a timestamp prefix.
   */
  filename?: (info: FileInfo) => string;
}

/**
 * Storage strategy that streams files to disk.
 *
 * Requires filesystem access (Node.js, Bun, Deno only — not Edge).
 *
 * @example
 * ```typescript
 * import { multipart, DiskStorage } from '@nextrush/multipart';
 *
 * app.use(multipart({
 *   storage: new DiskStorage({ dest: './uploads' }),
 *   limits: { maxFileSize: '50mb' },
 * }));
 * ```
 */
export class DiskStorage implements StorageStrategy {
  private readonly dest: string;
  private readonly filenameFn: (info: FileInfo) => string;
  private dirCreated = false;

  constructor(options: DiskStorageOptions) {
    this.dest = resolve(options.dest);
    this.filenameFn = options.filename ?? DiskStorage.defaultFilename;
  }

  async handle(stream: ReadableStream<Uint8Array>, info: FileInfo): Promise<StorageResult> {
    await this.ensureDir();

    const filename = this.filenameFn(info);
    const filepath = join(this.dest, filename);

    // Security: verify the resolved path is within the destination directory
    const resolved = resolve(filepath);
    if (!resolved.startsWith(this.dest)) {
      throw Errors.storageError('Path traversal detected in generated filename');
    }

    let size = 0;

    try {
      // Convert Web ReadableStream to Node.js Readable for filesystem piping
      const nodeStream = Readable.fromWeb(
        stream as import('node:stream/web').ReadableStream<Uint8Array>
      );
      const writeStream = createWriteStream(resolved);

      // Track size as data flows through
      nodeStream.on('data', (chunk: Buffer | Uint8Array) => {
        size += chunk.length;
      });

      await pipeline(nodeStream, writeStream);
    } catch (error: unknown) {
      // Cleanup partial file on error
      await this.removeFile(resolved);
      const message = error instanceof Error ? error.message : 'Unknown write error';
      throw Errors.storageError(message);
    }

    return { size, path: resolved };
  }

  async remove(result: StorageResult): Promise<void> {
    if (result.path) {
      await this.removeFile(result.path);
    }
  }

  private async ensureDir(): Promise<void> {
    if (!this.dirCreated) {
      await mkdir(this.dest, { recursive: true });
      this.dirCreated = true;
    }
  }

  private async removeFile(filepath: string): Promise<void> {
    try {
      await unlink(filepath);
    } catch {
      // File may not exist if write failed early — ignore
    }
  }

  private static defaultFilename(info: FileInfo): string {
    return `${globalThis.crypto.randomUUID()}-${info.sanitizedName}`;
  }
}
