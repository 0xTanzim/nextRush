/**
 * Focused Static Files Plugin Tests
 *
 * Testing the previously failing scenarios
 */

import { createApp } from '@/core/app/application';
import { StaticFilesPlugin } from '@/plugins/static-files/static-files.plugin';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Static Files Plugin - Focused Tests', () => {
  let tempDir: string;

  beforeAll(async () => {
    // Create temporary directory using the same approach as integration tests
    tempDir = mkdtempSync(join(tmpdir(), 'nextrush-static-focused-'));

    // Create test files
    writeFileSync(join(tempDir, 'index.html'), '<h1>Welcome</h1>', 'utf8');
    writeFileSync(join(tempDir, '.hidden'), 'This is a hidden file', 'utf8');
    writeFileSync(join(tempDir, 'app.html'), '<h1>App fallback</h1>', 'utf8');
    writeFileSync(join(tempDir, 'test.html'), '<h1>Test page</h1>', 'utf8');
    writeFileSync(join(tempDir, 'order.one'), 'ONE', 'utf8');
    writeFileSync(join(tempDir, 'order.two'), 'TWO', 'utf8');
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Cache-Control Headers', () => {
    it('should set Cache-Control with maxAge', async () => {
      const app = createApp({ port: 3022, host: 'localhost' });
      const plugin = new StaticFilesPlugin({
        root: tempDir,
        maxAge: 3600, // 1 hour
      });
      plugin.install(app as any);

      app.listen(3022, 'localhost');

      const response = await fetch(`http://localhost:3022/index.html`);
      expect(response.status).toBe(200);

      const cacheControl = response.headers.get('cache-control');
      expect(cacheControl).toBeTruthy();
      expect(cacheControl).toContain('max-age=3600');

      await app.shutdown();
    });
  });

  describe('Dotfiles Policy', () => {
    it('should deny dotfiles with 403 when policy is deny', async () => {
      const app = createApp({ port: 3023, host: 'localhost' });
      const plugin = new StaticFilesPlugin({
        root: tempDir,
        dotfiles: 'deny',
      });
      plugin.install(app as any);

      app.listen(3023, 'localhost');

      const response = await fetch(`http://localhost:3023/.hidden`);
      expect(response.status).toBe(403);

      await app.shutdown();
    });

    it('should allow dotfiles when policy is allow', async () => {
      const app = createApp({ port: 3024, host: 'localhost' });
      const plugin = new StaticFilesPlugin({
        root: tempDir,
        dotfiles: 'allow',
      });
      plugin.install(app as any);

      app.listen(3024, 'localhost');

      const response = await fetch(`http://localhost:3024/.hidden`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('This is a hidden file');

      await app.shutdown();
    });
  });

  describe('Extension Fallbacks', () => {
    it('should try extension fallbacks for files without extension', async () => {
      const app = createApp({ port: 3025, host: 'localhost' });
      const plugin = new StaticFilesPlugin({
        root: tempDir,
        extensions: ['.html', '.txt'],
      });
      plugin.install(app as any);

      app.listen(3025, 'localhost');

      const response = await fetch(`http://localhost:3025/test`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('<h1>Test page</h1>');

      await app.shutdown();
    });

    it('should honor extension ordering (first match wins)', async () => {
      const app = createApp({ port: 3026, host: 'localhost' });
      const plugin = new StaticFilesPlugin({
        root: tempDir,
        extensions: ['.one', '.two'],
      });
      plugin.install(app as any);

      app.listen(3026, 'localhost');

      const response = await fetch(`http://localhost:3026/order`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('ONE'); // should NOT serve .two

      await app.shutdown();
    });
  });

  describe('Range Requests', () => {
    it('should return 416 for unsatisfiable range', async () => {
      const app = createApp({ port: 3027, host: 'localhost' });
      new StaticFilesPlugin({ root: tempDir }).install(app as any);
      app.listen(3027, 'localhost');

      const res = await fetch(`http://localhost:3027/test.html`, {
        headers: { Range: 'bytes=999999-1000000' },
      });
      expect(res.status).toBe(416);
      expect(res.headers.get('content-range')).toMatch(/^bytes \*\//);

      await app.shutdown();
    });
  });

  describe('Index Disabled', () => {
    it('should return 403 when index disabled for directory', async () => {
      const app = createApp({ port: 3028, host: 'localhost' });
      new StaticFilesPlugin({ root: tempDir, index: false }).install(
        app as any
      );
      app.listen(3028, 'localhost');

      const res = await fetch(`http://localhost:3028/`); // root directory
      expect(res.status).toBe(403);

      await app.shutdown();
    });
  });

  describe('Immutable Caching', () => {
    it('should include immutable in Cache-Control when configured', async () => {
      const app = createApp({ port: 3029, host: 'localhost' });
      new StaticFilesPlugin({
        root: tempDir,
        maxAge: 60,
        immutable: true,
      }).install(app as any);
      app.listen(3029, 'localhost');

      const res = await fetch(`http://localhost:3029/index.html`);
      expect(res.status).toBe(200);
      const cc = res.headers.get('cache-control');
      expect(cc).toContain('immutable');

      await app.shutdown();
    });
  });

  describe('Custom Headers Hook', () => {
    it('should set custom header via setHeaders option', async () => {
      const app = createApp({ port: 3030, host: 'localhost' });
      new StaticFilesPlugin({
        root: tempDir,
        setHeaders: (ctx, _abs) => {
          ctx.res.setHeader('X-From-SetHeaders', 'yes');
        },
      }).install(app as any);
      app.listen(3030, 'localhost');

      const res = await fetch(`http://localhost:3030/index.html`);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-from-setheaders')).toBe('yes');

      await app.shutdown();
    });
  });
});
