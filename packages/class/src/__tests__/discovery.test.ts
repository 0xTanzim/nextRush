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
} from '../discovery/discovery.js';
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

      // Files matching the default `*.controller.*` convention are scanned
      await writeFile(
        join(testDir, 'controllers', 'a.controller.ts'),
        'export const foo = 1;'
      );
      await writeFile(
        join(testDir, 'services', 'b.controller.ts'),
        'export const bar = 2;'
      );

      const results = await discoverControllers({ root: testDir });

      // Should find 2 files
      expect(results.length).toBe(2);
    });

    it('should only import files matching the *.controller.* convention by default', async () => {
      await writeFile(join(testDir, 'user.controller.ts'), 'export const x = 1;');
      await writeFile(join(testDir, 'user.service.ts'), 'export const y = 2;');
      await writeFile(join(testDir, 'helpers.ts'), 'export const z = 3;');

      const results = await discoverControllers({ root: testDir });

      // Non-controller files are not imported by default (their side-effects
      // still run transitively via the controllers that import them).
      expect(results.length).toBe(1);
      expect(results[0].filePath).toContain('user.controller.ts');
    });

    it('should scan all files when include is set to the scan-all escape hatch', async () => {
      await writeFile(join(testDir, 'user.ts'), 'export const x = 1;');
      await writeFile(join(testDir, 'helpers.ts'), 'export const y = 2;');

      const results = await discoverControllers({
        root: testDir,
        include: ['**/*.ts', '**/*.js'],
      });

      expect(results.length).toBe(2);
    });

    it('should discover every file when file count exceeds the concurrency cap', async () => {
      const fileCount = 40; // > IMPORT_CONCURRENCY (16)
      const expectedNames: string[] = [];
      for (let i = 0; i < fileCount; i++) {
        const name = `c${String(i).padStart(3, '0')}.controller.ts`;
        expectedNames.push(name);
        await writeFile(join(testDir, name), `export const v${i} = ${i};`);
      }

      const results = await discoverControllers({ root: testDir });

      expect(results.length).toBe(fileCount);
      // Deterministic aggregation: every scanned file has exactly one result.
      const seen = results.map((r) => r.filePath.split('/').pop()).sort();
      expect(seen).toEqual([...expectedNames].sort());
    });

    it('should skip node_modules directory', async () => {
      await mkdir(join(testDir, 'node_modules', 'package'), { recursive: true });
      await writeFile(
        join(testDir, 'node_modules', 'package', 'index.controller.ts'),
        'export const x = 1;'
      );

      const results = await discoverControllers({ root: testDir });

      expect(results).toEqual([]);
    });

    it('should skip dist directory', async () => {
      await mkdir(join(testDir, 'dist'), { recursive: true });
      await writeFile(join(testDir, 'dist', 'index.controller.js'), 'export const x = 1;');

      const results = await discoverControllers({ root: testDir });

      expect(results).toEqual([]);
    });

    it('should skip __tests__ directory', async () => {
      await mkdir(join(testDir, '__tests__'), { recursive: true });
      await writeFile(join(testDir, '__tests__', 'a.controller.ts'), 'export const x = 1;');

      const results = await discoverControllers({ root: testDir });

      expect(results).toEqual([]);
    });

    it('should exclude test files by default', async () => {
      await writeFile(join(testDir, 'controller.ts'), 'export const a = 1;');
      await writeFile(join(testDir, 'controller.test.ts'), 'export const b = 2;');
      await writeFile(join(testDir, 'controller.spec.ts'), 'export const c = 3;');

      // Scan-all escape hatch: the exclude patterns (not the include default)
      // are what filter out the test/spec files here.
      const results = await discoverControllers({
        root: testDir,
        include: ['**/*.ts', '**/*.js'],
      });

      // Should only find controller.ts
      expect(results.length).toBe(1);
      expect(results[0].filePath).toContain('controller.ts');
      expect(results[0].filePath).not.toContain('.test.');
      expect(results[0].filePath).not.toContain('.spec.');
    });

    it('should skip .d.ts files', async () => {
      await writeFile(join(testDir, 'types.d.ts'), 'export type X = string;');

      const results = await discoverControllers({
        root: testDir,
        include: ['**/*.ts', '**/*.js'],
      });

      expect(results).toEqual([]);
    });

    it('should skip hidden directories', async () => {
      await mkdir(join(testDir, '.hidden'), { recursive: true });
      await writeFile(join(testDir, '.hidden', 'file.ts'), 'export const x = 1;');

      const results = await discoverControllers({
        root: testDir,
        include: ['**/*.ts', '**/*.js'],
      });

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
