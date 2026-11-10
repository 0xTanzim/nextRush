/**
 * Unit tests for packaging artifacts emitter in @nextrush/dev
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emitPackagingArtifacts } from '../commands/build/packaging-artifacts.js';

describe('emitPackagingArtifacts', () => {
  let testCwd: string;
  let testOutDir: string;

  beforeEach(() => {
    testCwd = join(tmpdir(), `nextrush-dev-pkg-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    testOutDir = join(testCwd, 'dist');
    mkdirSync(testOutDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testCwd)) {
      rmSync(testCwd, { recursive: true, force: true });
    }
  });

  it('emits package.json with {"type": "module"} in outDir on default build', async () => {
    const result = await emitPackagingArtifacts(testCwd, 'src/index.ts', 'dist', {});

    expect(existsSync(result.packageJsonPath)).toBe(true);
    const parsed = JSON.parse(readFileSync(result.packageJsonPath, 'utf8')) as { type?: string };
    expect(parsed.type).toBe('module');
  });

  it('preserves existing package.json attributes in outDir and sets type to module', async () => {
    const existingPkg = join(testOutDir, 'package.json');
    writeFileSync(existingPkg, JSON.stringify({ name: 'my-build', version: '2.0.0', type: 'commonjs' }), 'utf8');

    const result = await emitPackagingArtifacts(testCwd, 'src/index.ts', 'dist', {});

    expect(existsSync(result.packageJsonPath)).toBe(true);
    const parsed = JSON.parse(readFileSync(result.packageJsonPath, 'utf8')) as {
      name?: string;
      version?: string;
      type?: string;
    };
    expect(parsed.name).toBe('my-build');
    expect(parsed.version).toBe('2.0.0');
    expect(parsed.type).toBe('module');
  });

  it('emits dual-entry .mjs bridge when serverless is explicitly enabled', async () => {
    const result = await emitPackagingArtifacts(testCwd, 'src/index.ts', 'dist', { serverless: true });

    expect(result.bridgePath).toBeDefined();
    expect(existsSync(result.bridgePath!)).toBe(true);
    const bridgeContent = readFileSync(result.bridgePath!, 'utf8');
    expect(bridgeContent).toContain("export * from './index.js';");
    expect(bridgeContent).toContain("import * as _mod from './index.js';");
    expect(bridgeContent).toContain("export default _mod.default;");
  });

  it('auto-detects @nextrush/adapter-serverless in package.json and emits bridge', async () => {
    const projectPkg = join(testCwd, 'package.json');
    writeFileSync(
      projectPkg,
      JSON.stringify({
        name: 'test-app',
        dependencies: {
          '@nextrush/adapter-serverless': '^1.0.0',
        },
      }),
      'utf8'
    );

    // Call without explicit serverless flag
    const result = await emitPackagingArtifacts(testCwd, 'src/server.ts', 'dist', {});

    expect(result.bridgePath).toBeDefined();
    expect(existsSync(result.bridgePath!)).toBe(true);
    expect(result.bridgePath!.endsWith('server.mjs')).toBe(true);
    const bridgeContent = readFileSync(result.bridgePath!, 'utf8');
    expect(bridgeContent).toContain("export * from './server.js';");
  });

  it('does not emit .mjs bridge when serverless is false and no serverless dependency exists', async () => {
    const result = await emitPackagingArtifacts(testCwd, 'src/index.ts', 'dist', { serverless: false });

    expect(result.bridgePath).toBeUndefined();
    expect(existsSync(join(testOutDir, 'index.mjs'))).toBe(false);
  });
});
