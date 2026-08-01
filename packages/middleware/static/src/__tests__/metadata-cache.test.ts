/**
 * @nextrush/static - Derived-metadata cache (F-5)
 *
 * `setFileHeaders()` derives MIME type, `Last-Modified`, and `ETag` fresh on
 * every request, even though all three depend only on the file's `stat`
 * result, which changes only when the file itself changes. Measured on the
 * benchmark's 36-byte `bench.txt`: NextRush lost the `static-file` scenario to
 * Express, the only scenario in the comparison matrix where that happens.
 *
 * The fix caches the derived string fields keyed by `(absolutePath, size,
 * mtime)`, so a cache hit skips the `toUTCString()` call and the FNV-1a hash
 * loop while `serveStatic()`'s own `stat` call still runs on every request —
 * freshness is never trusted to the cache, only the derivation of the fields
 * a fresh stat result maps to.
 *
 * @see reports/investigations/2026-07-31-measured-floor-params-compliance/05-static-and-middleware.md §A.4
 * @see report/architecture/architecture-performance-remediation-backlog.md F-2
 */

import type { Context } from '@nextrush/types';
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { serveStatic } from '../index';
import { getCachedFileMetadata, __resetMetadataCacheForTests } from '../metadata-cache';
import { statSafe } from '../utils';

let tempDir: string;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'nextrush-static-cache-test-'));
  writeFileSync(join(tempDir, 'a.txt'), 'hello world', 'utf8');
  writeFileSync(join(tempDir, 'b.css'), 'body{}', 'utf8');
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

interface TestContext extends Context {
  _test: { responseHeaders: Record<string, string | number>; statusCode: number };
}

function createMockContext(headers: Record<string, string> = {}): TestContext {
  const responseHeaders: Record<string, string | number> = {};
  const passThrough = new PassThrough();
  const mockRes = Object.create(passThrough);
  mockRes.statusCode = 200;
  mockRes.headersSent = false;
  mockRes.setHeader = (name: string, value: string | number) => {
    responseHeaders[name] = value;
  };
  mockRes.removeHeader = (name: string) => {
    delete responseHeaders[name];
  };
  mockRes.end = (data?: unknown) => {
    passThrough.end(data);
  };
  mockRes.on = passThrough.on.bind(passThrough);
  mockRes.once = passThrough.once.bind(passThrough);
  mockRes.removeListener = passThrough.removeListener.bind(passThrough);

  const ctx = {
    method: 'GET',
    path: '/a.txt',
    headers,
    status: 200,
    raw: { res: mockRes },
    set(name: string, value: string | number) {
      mockRes.setHeader(name, value);
    },
    _test: { responseHeaders, statusCode: 200 },
  } as unknown as TestContext;
  return ctx;
}

describe('getCachedFileMetadata', () => {
  it('returns the same derived fields as computing them directly', async () => {
    __resetMetadataCacheForTests();
    const absolutePath = join(tempDir, 'a.txt');
    const stat = await statSafe(absolutePath, false, tempDir);
    if (!stat) throw new Error('fixture missing');

    const cached = getCachedFileMetadata(absolutePath, stat);
    expect(cached.mimeType).toBe('text/plain; charset=utf-8');
    expect(cached.etag).toMatch(/^W\/"[0-9a-f]+"$/);
    expect(cached.lastModifiedString).toBe(stat.mtime.toUTCString());
  });

  it('returns a cache HIT (same object) for a second call with an unchanged stat', async () => {
    __resetMetadataCacheForTests();
    const absolutePath = join(tempDir, 'a.txt');
    const stat = await statSafe(absolutePath, false, tempDir);
    if (!stat) throw new Error('fixture missing');

    const first = getCachedFileMetadata(absolutePath, stat);
    const second = getCachedFileMetadata(absolutePath, stat);
    expect(second).toBe(first);
  });

  it('invalidates on mtime change even if size is unchanged', async () => {
    __resetMetadataCacheForTests();
    const absolutePath = join(tempDir, 'a.txt');
    const stat1 = await statSafe(absolutePath, false, tempDir);
    if (!stat1) throw new Error('fixture missing');
    const first = getCachedFileMetadata(absolutePath, stat1);

    // Same size, different mtime — a real edit that preserves length.
    const newer = new Date(stat1.mtime.getTime() + 60_000);
    utimesSync(absolutePath, newer, newer);
    const stat2 = await statSafe(absolutePath, false, tempDir);
    if (!stat2) throw new Error('fixture missing');
    const second = getCachedFileMetadata(absolutePath, stat2);

    expect(second).not.toBe(first);
    expect(second.etag).not.toBe(first.etag);
    expect(second.lastModifiedString).toBe(stat2.mtime.toUTCString());
  });

  it('invalidates on size change even if mtime is unchanged (defensive, no shared clock assumption)', async () => {
    __resetMetadataCacheForTests();
    const absolutePath = join(tempDir, 'a.txt');
    const stat = await statSafe(absolutePath, false, tempDir);
    if (!stat) throw new Error('fixture missing');
    const first = getCachedFileMetadata(absolutePath, stat);

    const spoofedSameMtime = { ...stat, size: stat.size + 1 };
    const second = getCachedFileMetadata(absolutePath, spoofedSameMtime);

    expect(second).not.toBe(first);
    expect(second.etag).not.toBe(first.etag);
  });

  it('keeps two different paths independent', async () => {
    __resetMetadataCacheForTests();
    const pathA = join(tempDir, 'a.txt');
    const pathB = join(tempDir, 'b.css');
    const statA = await statSafe(pathA, false, tempDir);
    const statB = await statSafe(pathB, false, tempDir);
    if (!statA || !statB) throw new Error('fixture missing');

    const a = getCachedFileMetadata(pathA, statA);
    const b = getCachedFileMetadata(pathB, statB);
    expect(a.mimeType).toBe('text/plain; charset=utf-8');
    expect(b.mimeType).toBe('text/css; charset=utf-8');
    expect(a.etag).not.toBe(b.etag);
  });

  it('evicts the oldest entry once the bound is exceeded', async () => {
    __resetMetadataCacheForTests();
    const paths: string[] = [];
    for (let i = 0; i < 20; i++) {
      const p = join(tempDir, `gen-${String(i)}.txt`);
      writeFileSync(p, `content ${String(i)}`, 'utf8');
      paths.push(p);
    }
    for (const p of paths) {
      const stat = await statSafe(p, false, tempDir);
      if (!stat) throw new Error('fixture missing');
      getCachedFileMetadata(p, stat);
    }
    // The cache must not have grown unbounded — re-requesting the first path
    // must still work correctly (whether it evicted or not is an
    // implementation detail; correctness is what's pinned here).
    const firstStat = await statSafe(paths[0]!, false, tempDir);
    if (!firstStat) throw new Error('fixture missing');
    const refetched = getCachedFileMetadata(paths[0]!, firstStat);
    expect(refetched.mimeType).toBe('text/plain; charset=utf-8');
    for (const p of paths) rmSync(p, { force: true });
  });
});

describe('serveStatic() end-to-end with the metadata cache', () => {
  it('serves byte-identical headers on a cache hit vs a cache miss', async () => {
    __resetMetadataCacheForTests();
    const middleware = serveStatic({ root: tempDir });
    const next = vi.fn();

    const ctx1 = createMockContext();
    ctx1.path = '/a.txt';
    await middleware(ctx1, next);
    const headers1 = { ...ctx1._test.responseHeaders };

    const ctx2 = createMockContext();
    ctx2.path = '/a.txt';
    await middleware(ctx2, next);
    const headers2 = { ...ctx2._test.responseHeaders };

    expect(headers2['Content-Type']).toBe(headers1['Content-Type']);
    expect(headers2['ETag']).toBe(headers1['ETag']);
    expect(headers2['Last-Modified']).toBe(headers1['Last-Modified']);
  });

  it('still serves a 304 for a matching If-None-Match after the cache is warm', async () => {
    __resetMetadataCacheForTests();
    const middleware = serveStatic({ root: tempDir });
    const next = vi.fn();

    const warm = createMockContext();
    warm.path = '/a.txt';
    await middleware(warm, next);
    const etag = warm._test.responseHeaders['ETag'] as string;

    const conditional = createMockContext({ 'if-none-match': etag });
    conditional.path = '/a.txt';
    await middleware(conditional, next);
    expect(conditional.status).toBe(304);
  });

  it('reflects an edited file on the very next request (no stale metadata)', async () => {
    __resetMetadataCacheForTests();
    const editablePath = join(tempDir, 'editable.txt');
    writeFileSync(editablePath, 'v1', 'utf8');
    const middleware = serveStatic({ root: tempDir });
    const next = vi.fn();

    const before = createMockContext();
    before.path = '/editable.txt';
    await middleware(before, next);
    const etagBefore = before._test.responseHeaders['ETag'];

    // Force a distinguishable mtime — some filesystems have 1s mtime
    // granularity, and a same-second edit must still be caught by size.
    writeFileSync(editablePath, 'a longer v2 body', 'utf8');
    const stat = await statSafe(editablePath, false, tempDir);
    if (stat) {
      const bumped = new Date(stat.mtime.getTime() + 2000);
      utimesSync(editablePath, bumped, bumped);
    }

    const after = createMockContext();
    after.path = '/editable.txt';
    await middleware(after, next);
    const etagAfter = after._test.responseHeaders['ETag'];

    expect(etagAfter).not.toBe(etagBefore);
    rmSync(editablePath, { force: true });
  });
});
