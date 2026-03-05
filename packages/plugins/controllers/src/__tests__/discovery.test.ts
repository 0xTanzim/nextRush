/**
 * @nextrush/controllers - Discovery Tests
 *
 * Tests for automatic controller discovery functionality.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  discoverControllers,
  getControllersFromResults,
  getErrorsFromResults,
} from '../discovery.js';
import type { DiscoveryResult } from '../types.js';

describe('Discovery', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `nextrush-discovery-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('discoverControllers', () => {
    it('should return empty array for empty directory', async () => {
      const results = await discoverControllers({ root: testDir });

      expect(results).toEqual([]);
    });

    it('should scan nested directories', async () => {
      await mkdir(join(testDir, 'controllers'), { recursive: true });
      await mkdir(join(testDir, 'services'), { recursive: true });

      // Create a simple file (not a controller, but should be scanned)
      await writeFile(join(testDir, 'controllers', 'test.ts'), 'export const foo = 1;');
      await writeFile(join(testDir, 'services', 'test.ts'), 'export const bar = 2;');

      const results = await discoverControllers({ root: testDir });

      // Should find 2 files
      expect(results.length).toBe(2);
    });

    it('should skip node_modules directory', async () => {
      await mkdir(join(testDir, 'node_modules', 'package'), { recursive: true });
      await writeFile(join(testDir, 'node_modules', 'package', 'index.ts'), 'export const x = 1;');

      const results = await discoverControllers({ root: testDir });

      expect(results).toEqual([]);
    });

    it('should skip dist directory', async () => {
      await mkdir(join(testDir, 'dist'), { recursive: true });
      await writeFile(join(testDir, 'dist', 'index.js'), 'export const x = 1;');

      const results = await discoverControllers({ root: testDir });

      expect(results).toEqual([]);
    });

    it('should skip __tests__ directory', async () => {
      await mkdir(join(testDir, '__tests__'), { recursive: true });
      await writeFile(join(testDir, '__tests__', 'test.ts'), 'export const x = 1;');

      const results = await discoverControllers({ root: testDir });

      expect(results).toEqual([]);
    });

    it('should exclude test files by default', async () => {
      await writeFile(join(testDir, 'controller.ts'), 'export const a = 1;');
      await writeFile(join(testDir, 'controller.test.ts'), 'export const b = 2;');
      await writeFile(join(testDir, 'controller.spec.ts'), 'export const c = 3;');

      const results = await discoverControllers({ root: testDir });

      // Should only find controller.ts
      expect(results.length).toBe(1);
      expect(results[0].filePath).toContain('controller.ts');
      expect(results[0].filePath).not.toContain('.test.');
      expect(results[0].filePath).not.toContain('.spec.');
    });

    it('should skip .d.ts files', async () => {
      await writeFile(join(testDir, 'types.d.ts'), 'export type X = string;');

      const results = await discoverControllers({ root: testDir });

      expect(results).toEqual([]);
    });

    it('should skip hidden directories', async () => {
      await mkdir(join(testDir, '.hidden'), { recursive: true });
      await writeFile(join(testDir, '.hidden', 'file.ts'), 'export const x = 1;');

      const results = await discoverControllers({ root: testDir });

      expect(results).toEqual([]);
    });

    it('should handle non-existent directory gracefully', async () => {
      const results = await discoverControllers({
        root: join(testDir, 'does-not-exist'),
      });

      expect(results).toEqual([]);
    });

    it('should use custom include patterns', async () => {
      await mkdir(join(testDir, 'controllers'), { recursive: true });
      await mkdir(join(testDir, 'services'), { recursive: true });

      await writeFile(join(testDir, 'controllers', 'user.controller.ts'), 'export const x = 1;');
      await writeFile(join(testDir, 'services', 'user.service.ts'), 'export const y = 2;');

      // Only include .controller.ts files
      const results = await discoverControllers({
        root: testDir,
        include: ['**/*.controller.ts'],
      });

      expect(results.length).toBe(1);
      expect(results[0].filePath).toContain('user.controller.ts');
    });

    it('should use custom exclude patterns', async () => {
      await writeFile(join(testDir, 'user.controller.ts'), 'export const x = 1;');
      await writeFile(join(testDir, 'admin.controller.ts'), 'export const y = 2;');

      // Exclude admin controller
      const results = await discoverControllers({
        root: testDir,
        exclude: ['**/admin*.ts'],
      });

      expect(results.length).toBe(1);
      expect(results[0].filePath).toContain('user.controller.ts');
    });

    it('should log debug messages when debug is true', async () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

      await discoverControllers({
        root: testDir,
        debug: true,
      });

      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[Controllers] Scanning:'));

      stderrSpy.mockRestore();
    });
  });

  describe('getControllersFromResults', () => {
    it('should extract controllers from results', () => {
      class TestController {}
      class AnotherController {}

      const results: DiscoveryResult[] = [
        { filePath: '/a.ts', controllers: [TestController], errors: [] },
        { filePath: '/b.ts', controllers: [AnotherController], errors: [] },
      ];

      const controllers = getControllersFromResults(results);

      expect(controllers).toEqual([TestController, AnotherController]);
    });

    it('should return empty array for no results', () => {
      const controllers = getControllersFromResults([]);

      expect(controllers).toEqual([]);
    });

    it('should handle results with no controllers', () => {
      const results: DiscoveryResult[] = [
        { filePath: '/a.ts', controllers: [], errors: [] },
        { filePath: '/b.ts', controllers: [], errors: [] },
      ];

      const controllers = getControllersFromResults(results);

      expect(controllers).toEqual([]);
    });
  });

  describe('getErrorsFromResults', () => {
    it('should extract errors from results', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      const results: DiscoveryResult[] = [
        { filePath: '/a.ts', controllers: [], errors: [error1] },
        { filePath: '/b.ts', controllers: [], errors: [error2] },
      ];

      const errors = getErrorsFromResults(results);

      expect(errors).toEqual([error1, error2]);
    });

    it('should return empty array for no errors', () => {
      const results: DiscoveryResult[] = [{ filePath: '/a.ts', controllers: [], errors: [] }];

      const errors = getErrorsFromResults(results);

      expect(errors).toEqual([]);
    });
  });
});
