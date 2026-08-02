/**
 * @nextrush/dev - resolveDeclarationTypePackage tests (issue #40)
 *
 * TypeScript >= 6 no longer auto-includes `@types/*` packages when the project
 * tsconfig omits `compilerOptions.types`, so a scaffolded NextRush project's
 * `.d.ts` generation fails with TS2591 ("Cannot find name 'process'"). The helper
 * must inject the runtime's type package on the tsc command line — but only when
 * the project does NOT pin its own types list, and only when the package is
 * actually installed.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initFsSync } from '../runtime/index.js';
import { resolveDeclarationTypePackage } from '../commands/build/tsc-type-args.js';

const createdDirs: string[] = [];

async function makeFixture(setup: (dir: string) => Promise<void>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'nextrush-tsc-types-'));
  createdDirs.push(dir);
  await setup(dir);
  return dir;
}

async function writeJson(dir: string, name: string, value: unknown): Promise<void> {
  await writeFile(join(dir, name), JSON.stringify(value), 'utf8');
}

describe('resolveDeclarationTypePackage (issue #40 — TS>=6 no longer auto-includes @types/*)', () => {
  beforeAll(async () => {
    await initFsSync();
  });

  afterAll(async () => {
    await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('returns the runtime type package when tsconfig has no "types" field and the package is installed', async () => {
    const dir = await makeFixture(async (d) => {
      await mkdir(join(d, 'node_modules', '@types', 'node'), { recursive: true });
      await writeJson(d, 'tsconfig.json', { compilerOptions: { target: 'ES2022' } });
    });

    await expect(resolveDeclarationTypePackage(dir)).resolves.toBe('node');
  });

  it('respects an explicit "types" list and returns undefined', async () => {
    const dir = await makeFixture(async (d) => {
      await mkdir(join(d, 'node_modules', '@types', 'node'), { recursive: true });
      await writeJson(d, 'tsconfig.json', { compilerOptions: { types: ['node'] } });
    });

    await expect(resolveDeclarationTypePackage(dir)).resolves.toBeUndefined();
  });

  it('respects an explicit EMPTY types list (the user opted out of all ambient types)', async () => {
    const dir = await makeFixture(async (d) => {
      await mkdir(join(d, 'node_modules', '@types', 'node'), { recursive: true });
      await writeJson(d, 'tsconfig.json', { compilerOptions: { types: [] } });
    });

    await expect(resolveDeclarationTypePackage(dir)).resolves.toBeUndefined();
  });

  it('returns undefined when the runtime type package is not installed', async () => {
    const dir = await makeFixture(async (d) => {
      await writeJson(d, 'tsconfig.json', { compilerOptions: { strict: true } });
    });

    await expect(resolveDeclarationTypePackage(dir)).resolves.toBeUndefined();
  });

  it('injects the runtime type package even when no tsconfig.json exists', async () => {
    const dir = await makeFixture(async (d) => {
      await mkdir(join(d, 'node_modules', '@types', 'node'), { recursive: true });
    });

    await expect(resolveDeclarationTypePackage(dir)).resolves.toBe('node');
  });

  it('returns bun-types for a Bun-targeted project without an explicit types list', async () => {
    const dir = await makeFixture(async (d) => {
      await writeJson(d, 'package.json', { dependencies: { '@nextrush/adapter-bun': '1.0.0' } });
      await mkdir(join(d, 'node_modules', 'bun-types'), { recursive: true });
      await writeJson(d, 'tsconfig.json', { compilerOptions: { module: 'ESNext' } });
    });

    await expect(resolveDeclarationTypePackage(dir)).resolves.toBe('bun-types');
  });

  it('returns undefined for a Deno-targeted project (Deno provides ambient types itself)', async () => {
    const dir = await makeFixture(async (d) => {
      await writeJson(d, 'package.json', { dependencies: { '@nextrush/adapter-deno': '1.0.0' } });
      await mkdir(join(d, 'node_modules', '@types', 'node'), { recursive: true });
      await writeJson(d, 'tsconfig.json', { compilerOptions: {} });
    });

    await expect(resolveDeclarationTypePackage(dir)).resolves.toBeUndefined();
  });

  it('falls back to the running runtime when package.json is absent', async () => {
    const dir = await makeFixture(async (d) => {
      await mkdir(join(d, 'node_modules', '@types', 'node'), { recursive: true });
      await writeJson(d, 'tsconfig.json', { compilerOptions: {} });
    });

    await expect(resolveDeclarationTypePackage(dir)).resolves.toBe('node');
  });
});
