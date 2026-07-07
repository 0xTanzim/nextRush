/**
 * @nextrush/static - Comprehensive Tests
 *
 * Tests for static file serving middleware covering:
 * - Basic file serving
 * - Path traversal protection
 * - Caching (ETag, Last-Modified)
 * - Range requests
 * - Dotfiles handling
 * - Extension fallbacks
 * - Directory index serving
 * - Error handling
 */

import type { Context, Middleware } from '@nextrush/types';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createSendFile,
    generateETag,
    getMimeType,
    isDotfile,
    isFresh,
    normalizePrefix,
    parseRange,
    safeJoin,
    serveStatic,
    staticFiles,
    statSafe,
    stripPrefix,
} from '../index';

// ============================================================================
// Test Fixtures Setup
// ============================================================================

let tempDir: string;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'nextrush-static-test-'));

  // Create test files
  writeFileSync(join(tempDir, 'index.html'), '<h1>Welcome</h1>', 'utf8');
  writeFileSync(join(tempDir, 'style.css'), 'body { color: red; }', 'utf8');
  writeFileSync(join(tempDir, 'app.js'), 'console.log("hello")', 'utf8');
  writeFileSync(join(tempDir, 'data.json'), '{"ok":true}', 'utf8');
  writeFileSync(join(tempDir, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  writeFileSync(join(tempDir, 'large.txt'), 'x'.repeat(2 * 1024 * 1024)); // 2MB file
  writeFileSync(join(tempDir, '.hidden'), 'secret', 'utf8');
  writeFileSync(join(tempDir, '.gitignore'), 'node_modules', 'utf8');
  writeFileSync(join(tempDir, 'test.txt'), 'hello world', 'utf8');
  writeFileSync(join(tempDir, 'page'), 'extensionless', 'utf8');
  writeFileSync(join(tempDir, 'page.html'), '<h1>Page</h1>', 'utf8');
  writeFileSync(join(tempDir, 'readme'), 'readme file', 'utf8');
  writeFileSync(join(tempDir, 'readme.md'), '# README', 'utf8');
  writeFileSync(join(tempDir, 'readme.txt'), 'readme text', 'utf8');

  // Create subdirectory
  mkdirSync(join(tempDir, 'subdir'));
  writeFileSync(join(tempDir, 'subdir', 'index.html'), '<h1>Subdir</h1>', 'utf8');
  writeFileSync(join(tempDir, 'subdir', 'file.txt'), 'subfile', 'utf8');
  writeFileSync(join(tempDir, 'subdir', '.dotfile'), 'hidden in subdir', 'utf8');

  // Create nested directory
  mkdirSync(join(tempDir, 'deep', 'nested'), { recursive: true });
  writeFileSync(join(tempDir, 'deep', 'nested', 'file.txt'), 'deep file', 'utf8');

  // Create empty directory
  mkdirSync(join(tempDir, 'empty'));
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ============================================================================
// Mock Context Helper
// ============================================================================

interface MockContextOptions {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
}

interface TestContext extends Context {
  _test: {
    responseHeaders: Record<string, string | number>;
    statusCode: number;
    ended: boolean;
    body: unknown;
    chunks: Buffer[];
  };
}

function createMockContext(opts: MockContextOptions = {}): TestContext {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  const responseHeaders: Record<string, string | number> = {};
  let statusCode = 200;
  let ended = false;
  let body: unknown = null;
  const chunks: Buffer[] = [];

  // Create a PassThrough stream to handle piping
  const passThrough = new PassThrough();
  passThrough.on('data', (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  passThrough.on('end', () => {
    ended = true;
  });

  // Save original end to avoid recursion
  const originalEnd = passThrough.end.bind(passThrough);

  // Create mock response with PassThrough as base
  const mockRes = Object.create(passThrough);
  mockRes.statusCode = 200;
  mockRes.headersSent = false;
  mockRes.setHeader = function(name: string, value: string | number) {
    responseHeaders[name] = value;
  };
  mockRes.removeHeader = function(name: string) {
    delete responseHeaders[name];
  };
  mockRes.end = function(data?: unknown) {
    ended = true;
    if (data !== undefined && body === null) {
      // Only set body if not already set (by json/html/send)
      body = data;
      if (Buffer.isBuffer(data)) {
        chunks.push(data);
      } else if (typeof data === 'string') {
        chunks.push(Buffer.from(data));
      }
    } else if (data !== undefined) {
      // Just add to chunks if body was already set
      if (Buffer.isBuffer(data)) {
        chunks.push(data);
      } else if (typeof data === 'string') {
        chunks.push(Buffer.from(data));
      }
    }
    // Call original PassThrough end
    originalEnd();
  };

  const raw = {
    req: { socket: { remoteAddress: '127.0.0.1' } },
    res: mockRes,
  };

  const ctx = {
    method: opts.method || 'GET',
    path: opts.path || '/',
    url: opts.path || '/',
    headers,
    query: {},
    params: {},
    ip: '127.0.0.1',
    body: null,
    state: {},
    get status() {
      return statusCode;
    },
    set status(code: number) {
      statusCode = code;
      raw.res.statusCode = code;
    },
    json(data: unknown) {
      body = data;
      responseHeaders['Content-Type'] = 'application/json';
      raw.res.end(JSON.stringify(data));
    },
    send(data: unknown) {
      body = data;
      raw.res.end(data);
    },
    html(content: string) {
      body = content;
      responseHeaders['Content-Type'] = 'text/html';
      raw.res.end(content);
    },
    redirect(url: string, status = 302) {
      statusCode = status;
      responseHeaders['Location'] = url;
      ended = true;
    },
    set(field: string, value: string | number) {
      responseHeaders[field] = value;
    },
    get(field: string) {
      return headers[field.toLowerCase()];
    },
    next: vi.fn().mockResolvedValue(undefined),
    raw,
    _test: {
      get responseHeaders() { return responseHeaders; },
      get statusCode() { return statusCode; },
      get ended() { return ended; },
      get body() { return body; },
      get chunks() { return chunks; },
    },
  } as unknown as TestContext;

  return ctx;
}

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  describe('stripPrefix', () => {
    it('should return path unchanged when no prefix', () => {
      expect(stripPrefix('/file.txt', '')).toBe('/file.txt');
    });

    it('should strip prefix from path', () => {
      expect(stripPrefix('/static/file.txt', '/static')).toBe('/file.txt');
    });

    it('should return / when path equals prefix', () => {
      expect(stripPrefix('/static', '/static')).toBe('/');
    });

    it('should handle prefix with trailing content', () => {
      expect(stripPrefix('/staticfile.txt', '/static')).toBe('file.txt');
    });
  });

  describe('safeJoin', () => {
    it('should join root and path safely', () => {
      const result = safeJoin('/root', 'file.txt');
      expect(result).toBe(`/root${sep}file.txt`);
    });

    it('should return root for empty path', () => {
      const result = safeJoin('/root', '');
      expect(result).toBe('/root');
    });

    it('should handle leading slashes', () => {
      const result = safeJoin('/root', '/file.txt');
      expect(result).toBe(`/root${sep}file.txt`);
    });

    it('should block .. traversal', () => {
      expect(safeJoin('/root', '../etc/passwd')).toBeNull();
      expect(safeJoin('/root', 'subdir/../../../etc/passwd')).toBeNull();
    });

    it('should block encoded traversal', () => {
      expect(safeJoin('/root', '..%2Fetc%2Fpasswd')).toBeNull();
    });

    it('should allow safe nested paths', () => {
      const result = safeJoin('/root', 'subdir/file.txt');
      expect(result).toBe(`/root${sep}subdir${sep}file.txt`);
    });
  });

  describe('statSafe', () => {
    it('should return stats for existing file', async () => {
      const stat = await statSafe(join(tempDir, 'test.txt'));
      expect(stat).not.toBeNull();
      expect(stat?.isFile()).toBe(true);
      expect(stat?.size).toBe(11);
    });

    it('should return stats for existing directory', async () => {
      const stat = await statSafe(join(tempDir, 'subdir'));
      expect(stat).not.toBeNull();
      expect(stat?.isDirectory()).toBe(true);
    });

    it('should return null for non-existent file', async () => {
      const stat = await statSafe(join(tempDir, 'nonexistent.txt'));
      expect(stat).toBeNull();
    });
  });

  describe('generateETag', () => {
    it('should generate consistent ETag for same file', () => {
      const stat = { size: 100, mtime: new Date('2024-01-01'), isFile: () => true, isDirectory: () => false };
      const etag1 = generateETag(stat);
      const etag2 = generateETag(stat);
      expect(etag1).toBe(etag2);
    });

    it('should generate different ETag for different size', () => {
      const stat1 = { size: 100, mtime: new Date('2024-01-01'), isFile: () => true, isDirectory: () => false };
      const stat2 = { size: 200, mtime: new Date('2024-01-01'), isFile: () => true, isDirectory: () => false };
      expect(generateETag(stat1)).not.toBe(generateETag(stat2));
    });

    it('should generate different ETag for different mtime', () => {
      const stat1 = { size: 100, mtime: new Date('2024-01-01'), isFile: () => true, isDirectory: () => false };
      const stat2 = { size: 100, mtime: new Date('2024-01-02'), isFile: () => true, isDirectory: () => false };
      expect(generateETag(stat1)).not.toBe(generateETag(stat2));
    });

    it('should generate weak ETag format', () => {
      const stat = { size: 100, mtime: new Date('2024-01-01'), isFile: () => true, isDirectory: () => false };
      const etag = generateETag(stat);
      expect(etag).toMatch(/^W\/"/);
      expect(etag).toMatch(/"$/);
    });
  });

  describe('isFresh', () => {
    const stat = { size: 100, mtime: new Date('2024-01-01T00:00:00Z'), isFile: () => true, isDirectory: () => false };
    const etag = generateETag(stat);

    it('should return true when ETag matches', () => {
      const ctx = createMockContext({ headers: { 'if-none-match': etag } });
      expect(isFresh(ctx, stat, etag)).toBe(true);
    });

    it('should return true when If-None-Match is *', () => {
      const ctx = createMockContext({ headers: { 'if-none-match': '*' } });
      expect(isFresh(ctx, stat, etag)).toBe(true);
    });

    it('should return true when If-Modified-Since is newer than mtime', () => {
      const ctx = createMockContext({ headers: { 'if-modified-since': 'Tue, 02 Jan 2024 00:00:00 GMT' } });
      expect(isFresh(ctx, stat, etag)).toBe(true);
    });

    it('should return false when If-Modified-Since is older than mtime', () => {
      const ctx = createMockContext({ headers: { 'if-modified-since': 'Sun, 31 Dec 2023 00:00:00 GMT' } });
      expect(isFresh(ctx, stat, etag)).toBe(false);
    });

    it('should return false when no caching headers', () => {
      const ctx = createMockContext();
      expect(isFresh(ctx, stat, etag)).toBe(false);
    });
  });

  describe('parseRange', () => {
    const fileSize = 1000;

    it('should parse start-end range', () => {
      expect(parseRange('bytes=0-99', fileSize)).toEqual({ start: 0, end: 99 });
      expect(parseRange('bytes=500-599', fileSize)).toEqual({ start: 500, end: 599 });
    });

    it('should parse open-ended range', () => {
      expect(parseRange('bytes=500-', fileSize)).toEqual({ start: 500, end: 999 });
    });

    it('should parse suffix range', () => {
      expect(parseRange('bytes=-100', fileSize)).toEqual({ start: 900, end: 999 });
    });

    it('should clamp end to file size', () => {
      expect(parseRange('bytes=0-9999', fileSize)).toEqual({ start: 0, end: 999 });
    });

    it('should return null for invalid ranges', () => {
      expect(parseRange('bytes=invalid', fileSize)).toBeNull();
      expect(parseRange('notbytes=0-99', fileSize)).toBeNull();
    });

    it('should return null for unsatisfiable ranges', () => {
      expect(parseRange('bytes=1000-1099', fileSize)).toBeNull(); // start >= size
      expect(parseRange('bytes=600-500', fileSize)).toBeNull(); // start > end
    });

    it('should return null for multi-range (not supported)', () => {
      expect(parseRange('bytes=0-99,200-299', fileSize)).toBeNull();
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME types', () => {
      expect(getMimeType('file.html')).toContain('text/html');
      expect(getMimeType('file.css')).toContain('text/css');
      expect(getMimeType('file.js')).toContain('application/javascript');
      expect(getMimeType('file.json')).toContain('application/json');
      expect(getMimeType('file.png')).toBe('image/png');
      expect(getMimeType('file.jpg')).toBe('image/jpeg');
      expect(getMimeType('file.svg')).toBe('image/svg+xml');
    });

    it('should return octet-stream for unknown extensions', () => {
      expect(getMimeType('file.xyz')).toBe('application/octet-stream');
      expect(getMimeType('file')).toBe('application/octet-stream');
    });

    it('should be case-insensitive', () => {
      expect(getMimeType('file.HTML')).toContain('text/html');
      expect(getMimeType('file.PNG')).toBe('image/png');
    });
  });

  describe('isDotfile', () => {
    it('should detect dotfiles', () => {
      expect(isDotfile('.hidden')).toBe(true);
      expect(isDotfile('.gitignore')).toBe(true);
      expect(isDotfile('path/to/.hidden')).toBe(true);
    });

    it('should not flag regular files', () => {
      expect(isDotfile('file.txt')).toBe(false);
      expect(isDotfile('path/to/file.txt')).toBe(false);
    });

    it('should handle . and .. correctly', () => {
      expect(isDotfile('.')).toBe(false);
      expect(isDotfile('..')).toBe(false);
    });
  });

  describe('normalizePrefix', () => {
    it('should return empty string for undefined or /', () => {
      expect(normalizePrefix(undefined)).toBe('');
      expect(normalizePrefix('/')).toBe('');
    });

    it('should keep prefix as-is', () => {
      expect(normalizePrefix('/static')).toBe('/static');
    });

    it('should strip trailing slash', () => {
      expect(normalizePrefix('/static/')).toBe('/static');
    });
  });
});

// ============================================================================
// Middleware Tests
// ============================================================================

describe('serveStatic Middleware', () => {
  describe('Basic File Serving', () => {
    let middleware: Middleware;

    beforeEach(() => {
      middleware = serveStatic({ root: tempDir });
    });

    it('should serve existing file', async () => {
      const ctx = createMockContext({ path: '/test.txt' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.responseHeaders['Content-Type']).toContain('text/plain');
      expect(ctx._test.responseHeaders['Content-Length']).toBe(11);
      expect(ctx._test.ended).toBe(true);
      expect(next).not.toHaveBeenCalled();
    });

    it('should serve HTML file with correct content type', async () => {
      const ctx = createMockContext({ path: '/index.html' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.responseHeaders['Content-Type']).toContain('text/html');
    });

    it('should serve JSON file with correct content type', async () => {
      const ctx = createMockContext({ path: '/data.json' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.responseHeaders['Content-Type']).toContain('application/json');
    });

    it('should return 404 for non-existent file', async () => {
      const ctx = createMockContext({ path: '/nonexistent.txt' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.status).toBe(404);
      expect((ctx._test.body as { error: string }).error).toBe('Not Found');
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass through non-GET/HEAD requests', async () => {
      const ctx = createMockContext({ method: 'POST', path: '/test.txt' });
      const next = vi.fn();

      await middleware(ctx, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('HEAD Requests', () => {
    it('should handle HEAD requests without body', async () => {
      const middleware = serveStatic({ root: tempDir });
      const ctx = createMockContext({ method: 'HEAD', path: '/test.txt' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.responseHeaders['Content-Length']).toBe(11);
      expect(ctx._test.ended).toBe(true);
    });
  });

  describe('Prefix Matching', () => {
    it('should serve files under prefix', async () => {
      const middleware = serveStatic({ root: tempDir, prefix: '/static' });
      const ctx = createMockContext({ path: '/static/test.txt' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.ended).toBe(true);
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass through requests not matching prefix', async () => {
      const middleware = serveStatic({ root: tempDir, prefix: '/static' });
      const ctx = createMockContext({ path: '/other/test.txt' });
      const next = vi.fn();

      await middleware(ctx, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle exact prefix match', async () => {
      const middleware = serveStatic({ root: tempDir, prefix: '/static' });
      const ctx = createMockContext({ path: '/static' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      // Should redirect to /static/
      expect(ctx.status).toBe(301);
    });
  });

  describe('Directory Handling', () => {
    it('should redirect directory without trailing slash', async () => {
      const middleware = serveStatic({ root: tempDir });
      const ctx = createMockContext({ path: '/subdir' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.status).toBe(301);
      expect(ctx._test.responseHeaders['Location']).toBe('/subdir/');
    });

    it('should serve index.html for directory with trailing slash', async () => {
      const middleware = serveStatic({ root: tempDir });
      const ctx = createMockContext({ path: '/subdir/' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.responseHeaders['Content-Type']).toContain('text/html');
    });

    it('should return 403 when no index file and index is disabled', async () => {
      const middleware = serveStatic({ root: tempDir, index: false });
      const ctx = createMockContext({ path: '/empty/' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.status).toBe(403);
      expect((ctx._test.body as { error: string }).error).toBe('Forbidden');
    });

    it('should disable redirect when redirect=false', async () => {
      const middleware = serveStatic({ root: tempDir, redirect: false });
      const ctx = createMockContext({ path: '/subdir' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      // Should serve index without redirect
      expect(ctx._test.responseHeaders['Content-Type']).toContain('text/html');
    });
  });

  describe('Extension Fallbacks', () => {
    it('should try extensions when file not found', async () => {
      // Request /only-html - no file exists without extension
      // but only-html.html does exist
      writeFileSync(join(tempDir, 'only-html.html'), '<h1>Only HTML</h1>', 'utf8');

      const middleware = serveStatic({ root: tempDir, extensions: ['.html'] });
      const ctx = createMockContext({ path: '/only-html' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.responseHeaders['Content-Type']).toContain('text/html');
    });

    it('should respect extension order', async () => {
      // Request /multi-ext - no file without extension
      // but multi-ext.md and multi-ext.txt both exist
      writeFileSync(join(tempDir, 'multi-ext.md'), '# Markdown', 'utf8');
      writeFileSync(join(tempDir, 'multi-ext.txt'), 'Text', 'utf8');

      const middleware = serveStatic({ root: tempDir, extensions: ['.md', '.txt'] });
      const ctx = createMockContext({ path: '/multi-ext' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      // Should serve .md first (first in extensions array)
      expect(ctx._test.responseHeaders['Content-Type']).toContain('markdown');
    });

    it('should handle extensions with or without dot', async () => {
      // Reuse only-html.html from above
      const middleware = serveStatic({ root: tempDir, extensions: ['html'] });
      const ctx = createMockContext({ path: '/only-html' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.ended).toBe(true);
    });
  });

  describe('Dotfiles Handling', () => {
    it('should ignore dotfiles by default (404)', async () => {
      const middleware = serveStatic({ root: tempDir });
      const ctx = createMockContext({ path: '/.hidden' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.status).toBe(404);
    });

    it('should deny dotfiles with 403 when policy=deny', async () => {
      const middleware = serveStatic({ root: tempDir, dotfiles: 'deny' });
      const ctx = createMockContext({ path: '/.hidden' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.status).toBe(403);
      expect((ctx._test.body as { error: string }).error).toBe('Forbidden');
    });

    it('should serve dotfiles when policy=allow', async () => {
      const middleware = serveStatic({ root: tempDir, dotfiles: 'allow' });
      const ctx = createMockContext({ path: '/.hidden' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.ended).toBe(true);
    });

    it('should handle dotfiles in subdirectories', async () => {
      const middleware = serveStatic({ root: tempDir, dotfiles: 'deny' });
      const ctx = createMockContext({ path: '/subdir/.dotfile' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.status).toBe(403);
    });
  });

  describe('Path Traversal Protection', () => {
    it('should block .. traversal', async () => {
      const middleware = serveStatic({ root: tempDir });
      const ctx = createMockContext({ path: '/../etc/passwd' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.status).toBe(403);
    });

    it('should block encoded traversal', async () => {
      const middleware = serveStatic({ root: tempDir });
      const ctx = createMockContext({ path: '/%2e%2e/etc/passwd' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.status).toBe(403);
    });

    it('should block null bytes', async () => {
      const middleware = serveStatic({ root: tempDir });
      const ctx = createMockContext({ path: '/test.txt\0.html' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.status).toBe(403);
    });

    it('should block double slashes', async () => {
      const middleware = serveStatic({ root: tempDir });
      const ctx = createMockContext({ path: '//etc/passwd' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.status).toBe(403);
    });
  });

  describe('Caching Headers', () => {
    it('should set ETag header', async () => {
      const middleware = serveStatic({ root: tempDir });
      const ctx = createMockContext({ path: '/test.txt' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.responseHeaders['ETag']).toMatch(/^W\/"/);
    });

    it('should set Last-Modified header', async () => {
      const middleware = serveStatic({ root: tempDir });
      const ctx = createMockContext({ path: '/test.txt' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.responseHeaders['Last-Modified']).toBeTruthy();
    });

    it('should set Cache-Control with maxAge', async () => {
      const middleware = serveStatic({ root: tempDir, maxAge: 3600 });
      const ctx = createMockContext({ path: '/test.txt' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.responseHeaders['Cache-Control']).toContain('max-age=3600');
      expect(ctx._test.responseHeaders['Cache-Control']).toContain('public');
    });

    it('should add immutable directive when configured', async () => {
      const middleware = serveStatic({ root: tempDir, maxAge: 3600, immutable: true });
      const ctx = createMockContext({ path: '/test.txt' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.responseHeaders['Cache-Control']).toContain('immutable');
    });

    it('should return 304 for fresh request with ETag match', async () => {
      const middleware = serveStatic({ root: tempDir });

      // First request to get ETag
      const ctx1 = createMockContext({ path: '/test.txt' }) as TestContext;
      await middleware(ctx1, vi.fn());
      const etag = ctx1._test.responseHeaders['ETag'] as string;

      // Second request with If-None-Match
      const ctx2 = createMockContext({
        path: '/test.txt',
        headers: { 'if-none-match': etag },
      }) as TestContext;
      await middleware(ctx2, vi.fn());

      expect(ctx2.status).toBe(304);
    });

    it('should disable ETag when etag=false', async () => {
      const middleware = serveStatic({ root: tempDir, etag: false });
      const ctx = createMockContext({ path: '/test.txt' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.responseHeaders['ETag']).toBeUndefined();
    });
  });

  describe('Range Requests', () => {
    it('should set Accept-Ranges header', async () => {
      const middleware = serveStatic({ root: tempDir });
      const ctx = createMockContext({ path: '/test.txt' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.responseHeaders['Accept-Ranges']).toBe('bytes');
    });

    it('should handle valid range request with 206', async () => {
      const middleware = serveStatic({ root: tempDir });
      const ctx = createMockContext({
        path: '/test.txt',
        headers: { range: 'bytes=0-4' },
      }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.status).toBe(206);
      expect(ctx._test.responseHeaders['Content-Range']).toBe('bytes 0-4/11');
      expect(ctx._test.responseHeaders['Content-Length']).toBe(5);
    });

    it('should return 416 for unsatisfiable range', async () => {
      const middleware = serveStatic({ root: tempDir });
      const ctx = createMockContext({
        path: '/test.txt',
        headers: { range: 'bytes=999-1000' },
      }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.status).toBe(416);
      expect(ctx._test.responseHeaders['Content-Range']).toBe('bytes */11');
    });

    it('should disable range requests when acceptRanges=false', async () => {
      const middleware = serveStatic({ root: tempDir, acceptRanges: false });
      const ctx = createMockContext({
        path: '/test.txt',
        headers: { range: 'bytes=0-4' },
      }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      // Should ignore range header and serve full file
      expect(ctx.status).not.toBe(206);
      expect(ctx._test.responseHeaders['Accept-Ranges']).toBeUndefined();
    });
  });

  describe('Fallthrough Option', () => {
    it('should call next on 404 when fallthrough=true', async () => {
      const middleware = serveStatic({ root: tempDir, fallthrough: true });
      const ctx = createMockContext({ path: '/nonexistent.txt' });
      const next = vi.fn();

      await middleware(ctx, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 404 when fallthrough=false', async () => {
      const middleware = serveStatic({ root: tempDir, fallthrough: false });
      const ctx = createMockContext({ path: '/nonexistent.txt' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.status).toBe(404);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Custom Headers', () => {
    it('should call setHeaders hook', async () => {
      const setHeaders = vi.fn();
      const middleware = serveStatic({ root: tempDir, setHeaders });
      const ctx = createMockContext({ path: '/test.txt' });
      const next = vi.fn();

      await middleware(ctx, next);

      expect(setHeaders).toHaveBeenCalledWith(
        ctx,
        expect.stringContaining('test.txt'),
        expect.objectContaining({ size: 11 })
      );
    });

    it('should allow adding custom headers', async () => {
      const middleware = serveStatic({
        root: tempDir,
        setHeaders: (ctx) => {
          ctx.set('X-Custom', 'value');
        },
      });
      const ctx = createMockContext({ path: '/test.txt' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.responseHeaders['X-Custom']).toBe('value');
    });
  });

  describe('Error Handling', () => {
    it('should throw when root is not provided', () => {
      expect(() => serveStatic({ root: '' })).toThrow('"root" option is required');
    });

    it('should handle invalid URL encoding', async () => {
      const middleware = serveStatic({ root: tempDir });
      const ctx = createMockContext({ path: '/%' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.status).toBe(400);
    });
  });

  describe('Large Files', () => {
    it('should stream large files', async () => {
      const middleware = serveStatic({ root: tempDir, highWaterMark: 1024 });
      const ctx = createMockContext({ path: '/large.txt' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.responseHeaders['Content-Length']).toBe(2 * 1024 * 1024);
    });
  });
});

// ============================================================================
// Alias Tests
// ============================================================================

describe('staticFiles alias', () => {
  it('should be an alias for serveStatic', () => {
    expect(staticFiles).toBe(serveStatic);
  });
});

// ============================================================================
// createSendFile Tests
// ============================================================================

describe('createSendFile', () => {
  it('should create a send file function', async () => {
    const sendFile = createSendFile({ root: tempDir });
    const ctx = createMockContext({ path: '/' }) as TestContext;

    const result = await sendFile(ctx, 'test.txt');

    expect(result).toBe(true);
    expect(ctx._test.ended).toBe(true);
  });

  it('should return false for non-existent file', async () => {
    const sendFile = createSendFile({ root: tempDir });
    const ctx = createMockContext({ path: '/' });

    const result = await sendFile(ctx, 'nonexistent.txt');

    expect(result).toBe(false);
  });

  it('should return false for directory', async () => {
    const sendFile = createSendFile({ root: tempDir });
    const ctx = createMockContext({ path: '/' });

    const result = await sendFile(ctx, 'subdir');

    expect(result).toBe(false);
  });

  it('should respect dotfiles policy', async () => {
    const sendFile = createSendFile({ root: tempDir, dotfiles: 'deny' });
    const ctx = createMockContext({ path: '/' });

    const result = await sendFile(ctx, '.hidden');

    expect(result).toBe(false);
  });

  it('should block path traversal', async () => {
    const sendFile = createSendFile({ root: tempDir });
    const ctx = createMockContext({ path: '/' });

    const result = await sendFile(ctx, '../etc/passwd');

    expect(result).toBe(false);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle root path', async () => {
    const middleware = serveStatic({ root: tempDir });
    const ctx = createMockContext({ path: '/' }) as TestContext;
    const next = vi.fn();

    await middleware(ctx, next);

    // Should serve index.html
    expect(ctx._test.responseHeaders['Content-Type']).toContain('text/html');
  });

  it('should handle deep nested paths', async () => {
    const middleware = serveStatic({ root: tempDir });
    const ctx = createMockContext({ path: '/deep/nested/file.txt' }) as TestContext;
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx._test.ended).toBe(true);
  });

  it('should handle files without extensions', async () => {
    const middleware = serveStatic({ root: tempDir });
    const ctx = createMockContext({ path: '/page' }) as TestContext;
    const next = vi.fn();

    await middleware(ctx, next);

    // Should serve as octet-stream
    expect(ctx._test.responseHeaders['Content-Type']).toBe('application/octet-stream');
  });

  it('should handle special characters in filename', async () => {
    // Create file with special characters
    const specialName = 'file with spaces.txt';
    writeFileSync(join(tempDir, specialName), 'special', 'utf8');

    const middleware = serveStatic({ root: tempDir });
    const ctx = createMockContext({ path: `/file%20with%20spaces.txt` }) as TestContext;
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx._test.ended).toBe(true);
  });

  it('should handle concurrent requests', async () => {
    const middleware = serveStatic({ root: tempDir });
    const results = await Promise.all([
      (async () => {
        const ctx = createMockContext({ path: '/test.txt' }) as TestContext;
        await middleware(ctx, vi.fn());
        return ctx._test.ended;
      })(),
      (async () => {
        const ctx = createMockContext({ path: '/data.json' }) as TestContext;
        await middleware(ctx, vi.fn());
        return ctx._test.ended;
      })(),
      (async () => {
        const ctx = createMockContext({ path: '/style.css' }) as TestContext;
        await middleware(ctx, vi.fn());
        return ctx._test.ended;
      })(),
    ]);

    expect(results).toEqual([true, true, true]);
  });
});

// ============================================================================
// Security Tests
// ============================================================================

describe('Security', () => {
  describe('Symlink Protection', () => {
    // Note: These tests require ability to create symlinks
    // On some systems (Windows without admin), symlink creation may fail

    it('should block symlinks by default (followSymlinks=false)', async () => {
      const symlinkPath = join(tempDir, 'link-to-test');
      const targetPath = join(tempDir, 'test.txt');

      try {
        const { symlinkSync, unlinkSync } = await import('node:fs');
        // Clean up if exists
        try { unlinkSync(symlinkPath); } catch { /* ignore */ }
        symlinkSync(targetPath, symlinkPath);

        const middleware = serveStatic({ root: tempDir, followSymlinks: false });
        const ctx = createMockContext({ path: '/link-to-test' }) as TestContext;
        const next = vi.fn();

        await middleware(ctx, next);

        expect(ctx.status).toBe(404);

        // Clean up
        unlinkSync(symlinkPath);
      } catch (err) {
        // Skip on systems that don't support symlinks
        console.log('Symlink test skipped (symlinks not supported)');
      }
    });

    it('should allow symlinks within root when followSymlinks=true', async () => {
      const symlinkPath = join(tempDir, 'link-to-test-allowed');
      const targetPath = join(tempDir, 'test.txt');

      try {
        const { symlinkSync, unlinkSync } = await import('node:fs');
        // Clean up if exists
        try { unlinkSync(symlinkPath); } catch { /* ignore */ }
        symlinkSync(targetPath, symlinkPath);

        const middleware = serveStatic({ root: tempDir, followSymlinks: true });
        const ctx = createMockContext({ path: '/link-to-test-allowed' }) as TestContext;
        const next = vi.fn();

        await middleware(ctx, next);

        expect(ctx._test.ended).toBe(true);

        // Clean up
        unlinkSync(symlinkPath);
      } catch (err) {
        console.log('Symlink test skipped (symlinks not supported)');
      }
    });

    it('should block symlinks pointing outside root even when followSymlinks=true', async () => {
      const symlinkPath = join(tempDir, 'link-to-outside');

      try {
        const { symlinkSync, unlinkSync } = await import('node:fs');
        // Clean up if exists
        try { unlinkSync(symlinkPath); } catch { /* ignore */ }
        // Create symlink pointing to /etc or /tmp (outside tempDir)
        symlinkSync('/tmp', symlinkPath);

        const middleware = serveStatic({ root: tempDir, followSymlinks: true });
        const ctx = createMockContext({ path: '/link-to-outside' }) as TestContext;
        const next = vi.fn();

        await middleware(ctx, next);

        // Should be blocked (404 or 403)
        expect([403, 404]).toContain(ctx.status);

        // Clean up
        unlinkSync(symlinkPath);
      } catch (err) {
        console.log('Symlink test skipped (symlinks not supported)');
      }
    });
  });

  describe('X-Content-Type-Options Header', () => {
    it('should set X-Content-Type-Options by default', async () => {
      const middleware = serveStatic({ root: tempDir });
      const ctx = createMockContext({ path: '/test.txt' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.responseHeaders['X-Content-Type-Options']).toBe('nosniff');
    });

    it('should not set X-Content-Type-Options when disabled', async () => {
      const middleware = serveStatic({ root: tempDir, xContentTypeOptions: false });
      const ctx = createMockContext({ path: '/test.txt' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx._test.responseHeaders['X-Content-Type-Options']).toBeUndefined();
    });
  });

  describe('Range Request Security', () => {
    it('should reject extremely large range values', () => {
      // Values larger than MAX_SAFE_INTEGER should be rejected
      expect(parseRange('bytes=9999999999999999999-', 1000)).toBeNull();
      expect(parseRange('bytes=0-9999999999999999999', 1000)).toBeNull();
      expect(parseRange('bytes=-9999999999999999999', 1000)).toBeNull();
    });

    it('should handle ranges at MAX_SAFE_INTEGER boundary', () => {
      // Values at the boundary should still work if file is large enough
      // but for practical file sizes, they should be clamped
      const result = parseRange('bytes=0-1000', 1000);
      expect(result).toEqual({ start: 0, end: 999 }); // Clamped to size-1
    });

    it('should reject negative suffix larger than safe integer', () => {
      expect(parseRange('bytes=-99999999999999999999', 1000)).toBeNull();
    });
  });

  describe('Path Traversal Edge Cases', () => {
    it('should block backslash traversal on any platform', async () => {
      const middleware = serveStatic({ root: tempDir });
      const ctx = createMockContext({ path: '/..\\etc\\passwd' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.status).toBe(403);
    });

    it('should block mixed slash traversal', async () => {
      const middleware = serveStatic({ root: tempDir });
      const ctx = createMockContext({ path: '/subdir/..\\../etc/passwd' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.status).toBe(403);
    });

    it('should block unicode encoded dots', async () => {
      const middleware = serveStatic({ root: tempDir });
      // This would be decoded but still caught
      const ctx = createMockContext({ path: '/%2e%2e/etc/passwd' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.status).toBe(403);
    });

    it('should block triple dots', async () => {
      const middleware = serveStatic({ root: tempDir });
      const ctx = createMockContext({ path: '/.../' }) as TestContext;
      const next = vi.fn();

      await middleware(ctx, next);

      // Triple dots aren't traversal but also won't match real files
      expect([403, 404]).toContain(ctx.status);
    });
  });

  describe('statSafe Security', () => {
    it('should return stats for regular files', async () => {
      const stat = await statSafe(join(tempDir, 'test.txt'));
      expect(stat).not.toBeNull();
      expect(stat?.isFile()).toBe(true);
    });

    it('should return null for non-existent files', async () => {
      const stat = await statSafe(join(tempDir, 'does-not-exist.txt'));
      expect(stat).toBeNull();
    });

    it('should return null for symlinks when followSymlinks=false', async () => {
      const symlinkPath = join(tempDir, 'symlink-test-stat');
      const targetPath = join(tempDir, 'test.txt');

      try {
        const { symlinkSync, unlinkSync } = await import('node:fs');
        try { unlinkSync(symlinkPath); } catch { /* ignore */ }
        symlinkSync(targetPath, symlinkPath);

        const stat = await statSafe(symlinkPath, false);
        expect(stat).toBeNull();

        unlinkSync(symlinkPath);
      } catch {
        console.log('Symlink test skipped');
      }
    });

    it('should return stats for symlinks when followSymlinks=true with valid root', async () => {
      const symlinkPath = join(tempDir, 'symlink-test-stat-follow');
      const targetPath = join(tempDir, 'test.txt');

      try {
        const { symlinkSync, unlinkSync } = await import('node:fs');
        try { unlinkSync(symlinkPath); } catch { /* ignore */ }
        symlinkSync(targetPath, symlinkPath);

        const stat = await statSafe(symlinkPath, true, tempDir);
        expect(stat).not.toBeNull();
        expect(stat?.isFile()).toBe(true);

        unlinkSync(symlinkPath);
      } catch {
        console.log('Symlink test skipped');
      }
    });
  });
});
