/**
 * @nextrush/multipart - Tests
 *
 * Comprehensive tests for all multipart modules:
 * - Utility functions (sanitize, mime, limit)
 * - Storage strategies (memory, disk)
 * - Parser (zero-dep Web API parser)
 * - Middleware factory
 * - Error handling
 * - Boundary scanner
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MultipartError } from '../errors.js';
import { multipart } from '../middleware.js';
import { parseMultipart } from '../parser.js';
import { BoundaryScanner } from '../scanner.js';
import { DiskStorage } from '../storage/disk.js';
import { MemoryStorage } from '../storage/memory.js';
import type { StorageStrategy, UploadedFile } from '../types.js';
import { parseLimit } from '../utils/limit.js';
import { isAllowedType } from '../utils/mime.js';
import { sanitizeFilename } from '../utils/sanitize.js';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

const BOUNDARY = '----TestBoundary1234567890';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function createMultipartBody(
  parts: Array<{ name: string; filename?: string; type?: string; content: string | Uint8Array }>
): Uint8Array {
  const segments: Uint8Array[] = [];

  for (const part of parts) {
    segments.push(encoder.encode(`--${BOUNDARY}\r\n`));

    if (part.filename !== undefined) {
      segments.push(
        encoder.encode(
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`
        )
      );
      segments.push(encoder.encode(`Content-Type: ${part.type ?? 'application/octet-stream'}\r\n`));
    } else {
      segments.push(encoder.encode(`Content-Disposition: form-data; name="${part.name}"\r\n`));
    }

    segments.push(encoder.encode('\r\n'));

    if (part.content instanceof Uint8Array) {
      segments.push(part.content);
    } else {
      segments.push(encoder.encode(part.content));
    }

    segments.push(encoder.encode('\r\n'));
  }

  segments.push(encoder.encode(`--${BOUNDARY}--\r\n`));

  // Concatenate all segments
  const totalLength = segments.reduce((acc, s) => acc + s.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const seg of segments) {
    result.set(seg, offset);
    offset += seg.length;
  }
  return result;
}

function uint8ArrayToReadableStream(data: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

interface MockContext {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  state: Record<string, unknown>;
  raw: {
    req: unknown;
    res: unknown;
  };
  bodySource?: {
    consumed: boolean;
    stream: () => ReadableStream<Uint8Array>;
    contentLength: number | undefined;
    contentType: string | undefined;
    text: () => Promise<string>;
    buffer: () => Promise<Uint8Array>;
    json: () => Promise<unknown>;
  };
}

function createMockContext(method: string, body: Uint8Array, contentType?: string): MockContext {
  const ct = contentType ?? `multipart/form-data; boundary=${BOUNDARY}`;
  const headers: Record<string, string | string[] | undefined> = {
    'content-type': ct,
  };

  return {
    method,
    path: '/upload',
    headers,
    state: {},
    raw: { req: {}, res: {} },
    bodySource: {
      consumed: false,
      stream: () => uint8ArrayToReadableStream(body),
      contentLength: body.length,
      contentType: ct,
      text: async () => decoder.decode(body),
      buffer: async () => body,
      json: async () => JSON.parse(decoder.decode(body)),
    },
  };
}

// ---------------------------------------------------------------------------
// sanitizeFilename
// ---------------------------------------------------------------------------

describe('sanitizeFilename', () => {
  it('returns the filename unchanged for safe names', () => {
    expect(sanitizeFilename('document.pdf')).toBe('document.pdf');
  });

  it('strips path components (unix)', () => {
    expect(sanitizeFilename('/etc/passwd')).toBe('passwd');
  });

  it('strips path components (windows)', () => {
    expect(sanitizeFilename('C:\\Users\\file.txt')).toBe('file.txt');
  });

  it('replaces null bytes with underscores', () => {
    expect(sanitizeFilename('file\x00name.txt')).toBe('file_name.txt');
  });

  it('replaces control characters with underscores', () => {
    expect(sanitizeFilename('file\x01\x02name.txt')).toBe('file_name.txt');
  });

  it('strips leading dots', () => {
    expect(sanitizeFilename('.hidden')).toBe('hidden');
    expect(sanitizeFilename('...hidden')).toBe('hidden');
  });

  it('replaces consecutive dots', () => {
    expect(sanitizeFilename('file..name')).toBe('file.name');
  });

  it('generates UUID fallback for empty result', () => {
    expect(sanitizeFilename('')).toMatch(/^upload-[\da-f-]+/i);
    expect(sanitizeFilename('...')).toMatch(/^upload-[\da-f-]+/i);
  });

  it('truncates long filenames', () => {
    const longName = 'a'.repeat(300) + '.txt';
    const result = sanitizeFilename(longName);
    expect(result.length).toBeLessThanOrEqual(255);
  });

  it('handles filenames with only unsafe characters', () => {
    // Unsafe chars become underscores, may collapse to a short result
    const result = sanitizeFilename('<>:"/\\|?*');
    expect(result).toBeTruthy();
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('prefixes Windows reserved device names', () => {
    expect(sanitizeFilename('CON')).toBe('_CON');
    expect(sanitizeFilename('CON.txt')).toBe('_CON.txt');
    expect(sanitizeFilename('PRN')).toBe('_PRN');
    expect(sanitizeFilename('AUX.log')).toBe('_AUX.log');
    expect(sanitizeFilename('NUL')).toBe('_NUL');
    expect(sanitizeFilename('COM1')).toBe('_COM1');
    expect(sanitizeFilename('LPT9.dat')).toBe('_LPT9.dat');
  });

  it('does not prefix non-reserved names that contain reserved words', () => {
    expect(sanitizeFilename('CONTACT.txt')).toBe('CONTACT.txt');
    expect(sanitizeFilename('convert.doc')).toBe('convert.doc');
  });
});

// ---------------------------------------------------------------------------
// isAllowedType (MIME matching)
// ---------------------------------------------------------------------------

describe('isAllowedType', () => {
  it('matches exact MIME types', () => {
    expect(isAllowedType('image/png', ['image/png'])).toBe(true);
  });

  it('rejects non-matching MIME types', () => {
    expect(isAllowedType('image/png', ['image/jpeg'])).toBe(false);
  });

  it('supports wildcard matching', () => {
    expect(isAllowedType('image/png', ['image/*'])).toBe(true);
    expect(isAllowedType('image/jpeg', ['image/*'])).toBe(true);
    expect(isAllowedType('application/pdf', ['image/*'])).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isAllowedType('IMAGE/PNG', ['image/png'])).toBe(true);
  });

  it('matches against multiple allowed types', () => {
    expect(isAllowedType('application/pdf', ['image/*', 'application/pdf'])).toBe(true);
  });

  it('returns false when no types are specified (empty array)', () => {
    // Empty array means no patterns match — the parser skips the check when allowedTypes is undefined
    expect(isAllowedType('anything/here', [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseLimit
// ---------------------------------------------------------------------------

describe('parseLimit', () => {
  it('returns number values directly', () => {
    expect(parseLimit(1024, 0)).toBe(1024);
  });

  it('parses human-readable sizes', () => {
    expect(parseLimit('5mb', 0)).toBe(5 * 1024 * 1024);
    expect(parseLimit('1kb', 0)).toBe(1024);
    expect(parseLimit('2gb', 0)).toBe(2 * 1024 * 1024 * 1024);
  });

  it('returns default for undefined', () => {
    expect(parseLimit(undefined, 42)).toBe(42);
  });

  it('handles plain numbers as strings', () => {
    expect(parseLimit('1024', 0)).toBe(1024);
  });

  it('is case-insensitive', () => {
    expect(parseLimit('5MB', 0)).toBe(5 * 1024 * 1024);
  });

  it('returns default for invalid strings', () => {
    expect(parseLimit('invalid', 99)).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// MemoryStorage
// ---------------------------------------------------------------------------

describe('MemoryStorage', () => {
  it('buffers file content in memory', async () => {
    const storage = new MemoryStorage();
    const content = encoder.encode('hello world');
    const stream = uint8ArrayToReadableStream(content);

    const result = await storage.handle(stream, {
      fieldName: 'file',
      originalName: 'test.txt',
      sanitizedName: 'test.txt',
      encoding: '7bit',
      mimeType: 'text/plain',
    });

    expect(result.size).toBe(11);
    expect(result.buffer).toBeDefined();
    expect(decoder.decode(result.buffer!)).toBe('hello world');
    expect(result.path).toBeUndefined();
  });

  it('handles empty files', async () => {
    const storage = new MemoryStorage();
    const stream = uint8ArrayToReadableStream(new Uint8Array(0));

    const result = await storage.handle(stream, {
      fieldName: 'file',
      originalName: 'empty.txt',
      sanitizedName: 'empty.txt',
      encoding: '7bit',
      mimeType: 'text/plain',
    });

    expect(result.size).toBe(0);
    expect(result.buffer!.length).toBe(0);
  });

  it('handles large binary content', async () => {
    const storage = new MemoryStorage();
    const content = new Uint8Array(1024 * 100).fill(0xff); // 100KB
    const stream = uint8ArrayToReadableStream(content);

    const result = await storage.handle(stream, {
      fieldName: 'file',
      originalName: 'large.bin',
      sanitizedName: 'large.bin',
      encoding: '7bit',
      mimeType: 'application/octet-stream',
    });

    expect(result.size).toBe(1024 * 100);
    // Compare Uint8Array contents
    expect(result.buffer!.length).toBe(content.length);
    expect(result.buffer!.every((b, i) => b === content[i])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DiskStorage
// ---------------------------------------------------------------------------

describe('DiskStorage', () => {
  const tmpDir = join(tmpdir(), `nextrush-multipart-test-${Date.now()}`);

  beforeEach(() => {
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('writes file to disk', async () => {
    const storage = new DiskStorage({ dest: tmpDir });
    const content = encoder.encode('disk content');
    const stream = uint8ArrayToReadableStream(content);

    const result = await storage.handle(stream, {
      fieldName: 'file',
      originalName: 'test.txt',
      sanitizedName: 'test.txt',
      encoding: '7bit',
      mimeType: 'text/plain',
    });

    expect(result.size).toBe(12);
    expect(result.path).toBeDefined();
    expect(existsSync(result.path!)).toBe(true);

    const written = readFileSync(result.path!);
    expect(written.toString()).toBe('disk content');
  });

  it('uses custom filename generator', async () => {
    const storage = new DiskStorage({
      dest: tmpDir,
      filename: (info) => `custom-${info.sanitizedName}`,
    });
    const stream = uint8ArrayToReadableStream(encoder.encode('data'));

    const result = await storage.handle(stream, {
      fieldName: 'file',
      originalName: 'test.txt',
      sanitizedName: 'test.txt',
      encoding: '7bit',
      mimeType: 'text/plain',
    });

    expect(result.path!).toContain('custom-test.txt');
  });

  it('removes files on cleanup', async () => {
    const storage = new DiskStorage({ dest: tmpDir });
    const stream = uint8ArrayToReadableStream(encoder.encode('cleanup test'));

    const result = await storage.handle(stream, {
      fieldName: 'file',
      originalName: 'cleanup.txt',
      sanitizedName: 'cleanup.txt',
      encoding: '7bit',
      mimeType: 'text/plain',
    });

    expect(existsSync(result.path!)).toBe(true);
    await storage.remove(result);
    expect(existsSync(result.path!)).toBe(false);
  });

  it('creates destination directory if it does not exist', async () => {
    const nestedDir = join(tmpDir, 'nested', 'dir');
    const storage = new DiskStorage({ dest: nestedDir });
    const stream = uint8ArrayToReadableStream(encoder.encode('nested'));

    const result = await storage.handle(stream, {
      fieldName: 'file',
      originalName: 'nested.txt',
      sanitizedName: 'nested.txt',
      encoding: '7bit',
      mimeType: 'text/plain',
    });

    expect(existsSync(result.path!)).toBe(true);
  });

  it('rejects path traversal in generated filenames', async () => {
    const storage = new DiskStorage({
      dest: tmpDir,
      filename: () => '../../../etc/passwd',
    });
    const stream = uint8ArrayToReadableStream(encoder.encode('traversal'));

    await expect(
      storage.handle(stream, {
        fieldName: 'file',
        originalName: 'evil.txt',
        sanitizedName: 'evil.txt',
        encoding: '7bit',
        mimeType: 'text/plain',
      })
    ).rejects.toThrow('Path traversal');
  });
});

// ---------------------------------------------------------------------------
// MultipartError
// ---------------------------------------------------------------------------

describe('MultipartError', () => {
  it('has correct properties', () => {
    const error = new MultipartError('test', 400, 'PARSE_ERROR');

    expect(error.name).toBe('MultipartError');
    expect(error.message).toBe('test');
    expect(error.status).toBe(400);
    expect(error.code).toBe('PARSE_ERROR');
    expect(error.expose).toBe(true);
  });

  it('does not expose 5xx errors', () => {
    const error = new MultipartError('internal', 500, 'STORAGE_ERROR');
    expect(error.expose).toBe(false);
  });

  it('serializes to JSON properly', () => {
    const error = new MultipartError('file too large', 413, 'FILE_TOO_LARGE');
    const json = error.toJSON();

    expect(json).toEqual({
      name: 'MultipartError',
      message: 'file too large',
      status: 413,
      code: 'FILE_TOO_LARGE',
    });
  });
});

// ---------------------------------------------------------------------------
// parseMultipart (Parser)
// ---------------------------------------------------------------------------

describe('parseMultipart', () => {
  it('parses a single file upload', async () => {
    const body = createMultipartBody([
      { name: 'avatar', filename: 'photo.png', type: 'image/png', content: 'PNG file data' },
    ]);

    const result = await parseMultipart(body, BOUNDARY);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].fieldName).toBe('avatar');
    expect(result.files[0].originalName).toBe('photo.png');
    expect(result.files[0].mimeType).toBe('image/png');
    expect(decoder.decode(result.files[0].buffer!)).toBe('PNG file data');
  });

  it('parses multiple files', async () => {
    const body = createMultipartBody([
      { name: 'file1', filename: 'a.txt', type: 'text/plain', content: 'file A' },
      { name: 'file2', filename: 'b.txt', type: 'text/plain', content: 'file B' },
    ]);

    const result = await parseMultipart(body, BOUNDARY);

    expect(result.files).toHaveLength(2);
    expect(result.files[0].originalName).toBe('a.txt');
    expect(result.files[1].originalName).toBe('b.txt');
  });

  it('parses non-file fields', async () => {
    const body = createMultipartBody([
      { name: 'username', content: 'johndoe' },
      { name: 'email', content: 'john@example.com' },
    ]);

    const result = await parseMultipart(body, BOUNDARY);

    expect(result.files).toHaveLength(0);
    expect(result.fields.username).toBe('johndoe');
    expect(result.fields.email).toBe('john@example.com');
  });

  it('parses mixed files and fields', async () => {
    const body = createMultipartBody([
      { name: 'title', content: 'My Document' },
      { name: 'doc', filename: 'report.pdf', type: 'application/pdf', content: 'PDF data' },
    ]);

    const result = await parseMultipart(body, BOUNDARY);

    expect(result.files).toHaveLength(1);
    expect(result.fields.title).toBe('My Document');
  });

  it('sanitizes filenames', async () => {
    const body = createMultipartBody([
      { name: 'file', filename: '../../../etc/passwd', type: 'text/plain', content: 'evil' },
    ]);

    const result = await parseMultipart(body, BOUNDARY);

    expect(result.files[0].sanitizedName).toBe('passwd');
  });

  it('rejects prototype pollution in field names', async () => {
    const body = createMultipartBody([{ name: '__proto__', content: 'polluted' }]);

    await expect(parseMultipart(body, BOUNDARY)).rejects.toThrow('Invalid field name');
  });

  it('rejects prototype pollution in file field names', async () => {
    const body = createMultipartBody([
      { name: 'constructor', filename: 'file.txt', type: 'text/plain', content: 'x' },
    ]);

    await expect(parseMultipart(body, BOUNDARY)).rejects.toThrow('Invalid field name');
  });

  it('filters by allowed MIME types', async () => {
    const body = createMultipartBody([
      { name: 'file', filename: 'script.js', type: 'application/javascript', content: 'code' },
    ]);

    await expect(
      parseMultipart(body, BOUNDARY, {
        allowedTypes: ['image/*', 'application/pdf'],
      })
    ).rejects.toThrow('not in allowed types');
  });

  it('accepts files matching wildcard MIME types', async () => {
    const body = createMultipartBody([
      { name: 'file', filename: 'photo.png', type: 'image/png', content: 'png data' },
    ]);

    const result = await parseMultipart(body, BOUNDARY, {
      allowedTypes: ['image/*'],
    });

    expect(result.files).toHaveLength(1);
  });

  it('skips files without a filename (empty file input)', async () => {
    const body = createMultipartBody([
      { name: 'file', filename: '', type: 'application/octet-stream', content: '' },
    ]);

    const result = await parseMultipart(body, BOUNDARY);

    expect(result.files).toHaveLength(0);
  });

  it('uses custom storage strategy', async () => {
    const stored: Array<{ name: string; size: number }> = [];
    const customStorage: StorageStrategy = {
      async handle(stream, info) {
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          size += value.length;
        }
        reader.releaseLock();
        const buffer = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          buffer.set(chunk, offset);
          offset += chunk.length;
        }
        stored.push({ name: info.sanitizedName, size });
        return { size, buffer };
      },
    };

    const body = createMultipartBody([
      { name: 'file', filename: 'test.txt', type: 'text/plain', content: 'custom storage' },
    ]);

    await parseMultipart(body, BOUNDARY, { storage: customStorage });

    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('test.txt');
    expect(stored[0].size).toBe(14);
  });

  it('throws on body with no boundary marker', async () => {
    const body = encoder.encode('this is not multipart data');

    await expect(parseMultipart(body, BOUNDARY)).rejects.toThrow('No boundary found');
  });

  it('parses from a ReadableStream', async () => {
    const body = createMultipartBody([
      { name: 'msg', content: 'streamed' },
    ]);

    const stream = uint8ArrayToReadableStream(body);
    const result = await parseMultipart(stream, BOUNDARY);

    expect(result.fields.msg).toBe('streamed');
  });

  // -----------------------------------------------------------------------
  // Limit Enforcement Tests
  // -----------------------------------------------------------------------

  it('throws when file exceeds maxFileSize', async () => {
    const largeContent = 'x'.repeat(1000);
    const body = createMultipartBody([
      { name: 'file', filename: 'big.txt', type: 'text/plain', content: largeContent },
    ]);

    await expect(
      parseMultipart(body, BOUNDARY, { limits: { maxFileSize: 100 } })
    ).rejects.toThrow('exceeds the');
  });

  it('throws when maxFiles is exceeded', async () => {
    const body = createMultipartBody([
      { name: 'f1', filename: 'a.txt', type: 'text/plain', content: 'a' },
      { name: 'f2', filename: 'b.txt', type: 'text/plain', content: 'b' },
      { name: 'f3', filename: 'c.txt', type: 'text/plain', content: 'c' },
    ]);

    await expect(
      parseMultipart(body, BOUNDARY, { limits: { maxFiles: 2 } })
    ).rejects.toThrow('Maximum number of files');
  });

  it('throws when maxFields is exceeded', async () => {
    const body = createMultipartBody([
      { name: 'a', content: '1' },
      { name: 'b', content: '2' },
      { name: 'c', content: '3' },
    ]);

    await expect(
      parseMultipart(body, BOUNDARY, { limits: { maxFields: 2 } })
    ).rejects.toThrow('Maximum number of fields');
  });

  it('throws when maxParts is exceeded', async () => {
    const body = createMultipartBody([
      { name: 'a', content: '1' },
      { name: 'b', content: '2' },
      { name: 'f', filename: 'x.txt', type: 'text/plain', content: 'x' },
    ]);

    await expect(
      parseMultipart(body, BOUNDARY, { limits: { maxParts: 2 } })
    ).rejects.toThrow('Maximum number of parts');
  });

  it('throws when field value exceeds maxFieldSize', async () => {
    const body = createMultipartBody([
      { name: 'big', content: 'x'.repeat(500) },
    ]);

    await expect(
      parseMultipart(body, BOUNDARY, { limits: { maxFieldSize: 100 } })
    ).rejects.toThrow('exceeds maximum size');
  });

  it('throws when field name exceeds maxFieldNameSize', async () => {
    const longName = 'x'.repeat(300);
    const body = createMultipartBody([
      { name: longName, content: 'value' },
    ]);

    await expect(
      parseMultipart(body, BOUNDARY, { limits: { maxFieldNameSize: 50 } })
    ).rejects.toThrow('exceeds maximum length');
  });

  it('throws when boundary exceeds RFC 2046 maximum length', async () => {
    const longBoundary = 'x'.repeat(71);
    const body = encoder.encode(`--${longBoundary}\r\nContent-Disposition: form-data; name="f"\r\n\r\nval\r\n--${longBoundary}--\r\n`);

    await expect(
      parseMultipart(body, longBoundary)
    ).rejects.toThrow('RFC 2046 maximum');
  });

  it('throws when request body stream exceeds maxBodySize', async () => {
    const largeBody = createMultipartBody([
      { name: 'file', filename: 'big.txt', type: 'text/plain', content: 'x'.repeat(2000) },
    ]);

    const stream = uint8ArrayToReadableStream(largeBody);

    await expect(
      parseMultipart(stream, BOUNDARY, { limits: { maxBodySize: 500 } })
    ).rejects.toThrow('body exceeds');
  });
});

// ---------------------------------------------------------------------------
// multipart middleware
// ---------------------------------------------------------------------------

describe('multipart middleware', () => {
  it('parses multipart request and populates ctx.state', async () => {
    const body = createMultipartBody([
      { name: 'title', content: 'My Upload' },
      { name: 'file', filename: 'photo.jpg', type: 'image/jpeg', content: 'JPEG data' },
    ]);

    const ctx = createMockContext('POST', body);
    const mw = multipart();
    const next = vi.fn();

    await mw(ctx as unknown as Parameters<typeof mw>[0], next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.state.files).toHaveLength(1);
    expect((ctx.state.files as UploadedFile[])[0].originalName).toBe('photo.jpg');
    expect(ctx.state.fields).toEqual({ title: 'My Upload' });
  });

  it('skips GET requests', async () => {
    const body = createMultipartBody([
      { name: 'file', filename: 'a.txt', type: 'text/plain', content: 'data' },
    ]);

    const ctx = createMockContext('GET', body);
    const mw = multipart();
    const next = vi.fn();

    await mw(ctx as unknown as Parameters<typeof mw>[0], next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.state.files).toBeUndefined();
  });

  it('skips HEAD requests', async () => {
    const ctx = createMockContext('HEAD', new Uint8Array(0));
    const mw = multipart();
    const next = vi.fn();

    await mw(ctx as unknown as Parameters<typeof mw>[0], next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.state.files).toBeUndefined();
  });

  it('skips non-multipart content types', async () => {
    const body = encoder.encode('{"name":"json"}');
    const ctx = createMockContext('POST', body, 'application/json');
    const mw = multipart();
    const next = vi.fn();

    await mw(ctx as unknown as Parameters<typeof mw>[0], next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.state.files).toBeUndefined();
  });

  it('passes options to parser', async () => {
    const body = createMultipartBody([
      { name: 'file', filename: 'script.js', type: 'application/javascript', content: 'code' },
    ]);

    const ctx = createMockContext('POST', body);
    const mw = multipart({ allowedTypes: ['image/*'] });
    const next = vi.fn();

    await expect(mw(ctx as unknown as Parameters<typeof mw>[0], next)).rejects.toThrow(
      'not in allowed types'
    );
  });

  it('calls next() after successful parsing', async () => {
    const body = createMultipartBody([{ name: 'data', content: 'value' }]);

    const ctx = createMockContext('POST', body);
    const mw = multipart();
    const steps: string[] = [];

    await mw(ctx as unknown as Parameters<typeof mw>[0], async () => {
      steps.push('next');
    });

    expect(steps).toEqual(['next']);
  });

  it('handles empty multipart request', async () => {
    const body = encoder.encode(`--${BOUNDARY}--\r\n`);
    const ctx = createMockContext('POST', body);
    const mw = multipart();
    const next = vi.fn();

    await mw(ctx as unknown as Parameters<typeof mw>[0], next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.state.files).toEqual([]);
    expect(ctx.state.fields).toEqual({});
  });

  it('handles request with only fields (no files)', async () => {
    const body = createMultipartBody([
      { name: 'key1', content: 'value1' },
      { name: 'key2', content: 'value2' },
    ]);

    const ctx = createMockContext('POST', body);
    const mw = multipart();
    const next = vi.fn();

    await mw(ctx as unknown as Parameters<typeof mw>[0], next);

    expect(ctx.state.files).toEqual([]);
    expect(ctx.state.fields).toEqual({ key1: 'value1', key2: 'value2' });
  });

  it('uses DiskStorage when configured', async () => {
    const tmpDir = join(tmpdir(), `nextrush-mw-test-${Date.now()}`);

    try {
      const body = createMultipartBody([
        { name: 'file', filename: 'test.txt', type: 'text/plain', content: 'disk test' },
      ]);

      const ctx = createMockContext('POST', body);
      const mw = multipart({
        storage: new DiskStorage({ dest: tmpDir }),
      });
      const next = vi.fn();

      await mw(ctx as unknown as Parameters<typeof mw>[0], next);

      const files = ctx.state.files as UploadedFile[];
      expect(files).toHaveLength(1);
      expect(files[0].path).toBeDefined();
      expect(existsSync(files[0].path!)).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// BoundaryScanner
// ---------------------------------------------------------------------------

describe('BoundaryScanner', () => {
  it('finds boundary at known position', () => {
    const scanner = new BoundaryScanner(BOUNDARY);
    const body = createMultipartBody([
      { name: 'x', content: 'hello' },
    ]);

    // find \r\n--BOUNDARY in the body (after first part)
    const idx = scanner.indexOf(body, 0);
    expect(idx).toBeGreaterThan(0);
  });

  it('returns -1 when boundary is not present', () => {
    const scanner = new BoundaryScanner(BOUNDARY);
    const data = encoder.encode('no boundary here');
    expect(scanner.indexOf(data)).toBe(-1);
  });

  it('detects final boundary', () => {
    const scanner = new BoundaryScanner(BOUNDARY);
    const data = encoder.encode(`\r\n--${BOUNDARY}--\r\n`);
    const idx = scanner.indexOf(data);
    expect(idx).toBe(0);
    const afterBoundary = idx + scanner.length;
    expect(scanner.isFinalBoundary(data, afterBoundary)).toBe(true);
  });

  it('detects non-final boundary', () => {
    const scanner = new BoundaryScanner(BOUNDARY);
    const data = encoder.encode(`\r\n--${BOUNDARY}\r\nContent-Disposition: form-data; name="x"\r\n\r\ndata`);
    const idx = scanner.indexOf(data);
    expect(idx).toBe(0);
    const afterBoundary = idx + scanner.length;
    expect(scanner.isFinalBoundary(data, afterBoundary)).toBe(false);
  });

  it('reports correct length', () => {
    const scanner = new BoundaryScanner('abc');
    // Pattern is \r\n--abc → length 7
    expect(scanner.length).toBe(7);
  });
});
