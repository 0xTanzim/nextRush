/**
 * @nextrush/dev - `codemod.ts` in-process integration tests
 *
 * Calls `runConsolidateImports` / `parseCodemodArgs` directly (same vitest process) against
 * REAL temp files on disk — no fs mocking. The existing e2e/CLI tests prove the shipped
 * binary works but run in a separate child process, so v8 coverage never credits them for
 * this module (task 7.1 gap). These tests close that specific gap for `codemod.ts`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCodemodArgs, runConsolidateImports } from '../commands/codemod.js';

describe('parseCodemodArgs', () => {
  it('parses name and pattern', () => {
    expect(parseCodemodArgs(['consolidate-imports', 'src/**/*.ts'])).toEqual({
      name: 'consolidate-imports',
      pattern: 'src/**/*.ts',
      dryRun: false,
    });
  });

  it('parses --dry-run regardless of position', () => {
    expect(parseCodemodArgs(['consolidate-imports', '--dry-run', 'src/**/*.ts'])).toEqual({
      name: 'consolidate-imports',
      pattern: 'src/**/*.ts',
      dryRun: true,
    });
  });

  it('returns undefined name/pattern when args are empty', () => {
    expect(parseCodemodArgs([])).toEqual({ name: undefined, pattern: undefined, dryRun: false });
  });
});

describe('runConsolidateImports (real fs, real temp directory)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nextrush-codemod-'));
    mkdirSync(join(dir, 'src'), { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('rewrites a matching file on disk and reports it changed', async () => {
    const filePath = join(dir, 'src', 'controller.ts');
    writeFileSync(filePath, `import { Controller, Get } from '@nextrush/decorators';\n`);

    const result = await runConsolidateImports('src/**/*.ts', undefined, dir);

    expect(result.changed).toBe(1);
    expect(result.files).toEqual(['src/controller.ts']);
    const written = readFileSync(filePath, 'utf-8');
    expect(written).toContain(`from 'nextrush/class'`);
    expect(written).not.toContain('@nextrush/decorators');
  });

  it('does not write to disk in dry-run mode', async () => {
    const filePath = join(dir, 'src', 'controller.ts');
    const original = `import { Controller } from '@nextrush/decorators';\n`;
    writeFileSync(filePath, original);

    const result = await runConsolidateImports('src/**/*.ts', { dryRun: true }, dir);

    expect(result.changed).toBe(1);
    expect(readFileSync(filePath, 'utf-8')).toBe(original);
  });

  it('does not report unrelated files as changed', async () => {
    const filePath = join(dir, 'src', 'plain.ts');
    writeFileSync(filePath, `export const x = 1;\n`);

    const result = await runConsolidateImports('src/**/*.ts', undefined, dir);

    expect(result.changed).toBe(0);
    expect(result.files).toEqual([]);
  });

  it('throws an actionable error when no files match the pattern', async () => {
    await expect(runConsolidateImports('src/**/*.nomatch', undefined, dir)).rejects.toThrow(
      /No files matched pattern/
    );
  });
});
