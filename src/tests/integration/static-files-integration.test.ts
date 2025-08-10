import { createApp } from '@/index';
import { StaticFilesPlugin } from '@/plugins/static-files/static-files.plugin';
import type { Application } from '@/types/context';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('StaticFilesPlugin (integration)', () => {
  let app: Application;
  let server: any;
  let rootDir: string;
  const PORT = 3011;

  beforeAll(async () => {
    // Create a temporary directory with some files
    rootDir = mkdtempSync(join(tmpdir(), 'nextrush-static-'));
    writeFileSync(join(rootDir, 'hello.txt'), 'hello world', 'utf8');
    writeFileSync(
      join(rootDir, 'data.json'),
      JSON.stringify({ ok: true }),
      'utf8'
    );
    writeFileSync(join(rootDir, 'script.js'), 'console.log("hi")', 'utf8');
    mkdirSync(join(rootDir, 'dir'));
    writeFileSync(join(rootDir, 'dir', 'index.html'), '<h1>Index</h1>', 'utf8');
    writeFileSync(join(rootDir, '.secret'), 'top', 'utf8');

    app = createApp({ port: PORT, host: 'localhost' });

    // install plugin at /static
    new StaticFilesPlugin({
      root: rootDir,
      prefix: '/static',
      maxAge: 60,
    }).install(app as any);

    server = app.listen(PORT, 'localhost');
  });

  afterAll(async () => {
    await app.shutdown();
    // cleanup temp dir
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('serves text file with correct content-type and caching headers', async () => {
    const res = await fetch(`http://localhost:${PORT}/static/hello.txt`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/plain/);
    expect(res.headers.get('cache-control')).toContain('max-age=60');
    const body = await res.text();
    expect(body).toBe('hello world');
  });

  it('supports HEAD requests without body', async () => {
    const res = await fetch(`http://localhost:${PORT}/static/hello.txt`, {
      method: 'HEAD',
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-length')).toBe('11');
    const text = await res.text();
    expect(text).toBe('');
  });

  it('handles conditional GET with 304', async () => {
    const first = await fetch(`http://localhost:${PORT}/static/data.json`);
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();

    const res = await fetch(`http://localhost:${PORT}/static/data.json`, {
      headers: { 'If-None-Match': etag ?? '' },
    });
    expect(res.status).toBe(304);
  });

  it('handles range requests', async () => {
    const res = await fetch(`http://localhost:${PORT}/static/hello.txt`, {
      headers: { Range: 'bytes=0-4' },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toMatch(/^bytes 0-4\//);
    const body = await res.text();
    expect(body).toBe('hello');
  });

  it('serves index.html for directories and supports redirect to trailing slash', async () => {
    // redirect (no trailing slash)
    const redirect = await fetch(`http://localhost:${PORT}/static/dir`, {
      redirect: 'manual' as any,
    });
    expect(redirect.status).toBe(301);
    expect(redirect.headers.get('location')).toBe('/static/dir/');

    const res = await fetch(`http://localhost:${PORT}/static/dir/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<h1>Index</h1>');
  });

  it('applies dotfiles policy (ignore by default)', async () => {
    const res = await fetch(`http://localhost:${PORT}/static/.secret`);
    expect([404, 403]).toContain(res.status); // default is ignore -> 404
  });

  it('prevents path traversal', async () => {
    const res = await fetch(`http://localhost:${PORT}/static/..%2Fhello.txt`);
    expect([403, 404]).toContain(res.status);
    const res2 = await fetch(
      `http://localhost:${PORT}/static/%2e%2e/hello.txt`
    );
    expect([403, 404]).toContain(res2.status);
  });

  it('falls through when enabled', async () => {
    // create a new server with fallthrough and prefix /pub2
    const app2 = createApp({ port: PORT + 1, host: 'localhost' });
    new StaticFilesPlugin({
      root: rootDir,
      prefix: '/pub2',
      fallthrough: true,
    }).install(app2 as any);
    // Fallback wildcard route to capture any unmatched static path
    app2.get('/pub2/*', ctx => {
      ctx.res.text('fallback');
    });
    const server2 = app2.listen(PORT + 1, 'localhost');

    const res = await fetch(
      `http://localhost:${PORT + 1}/pub2/does-not-exist.txt`
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('fallback');

    await app2.shutdown();
    void server2;
  });
});
