/**
 * Standalone serverless packaging helper tests
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prepareServerlessPackage } from '../packaging';

const execFileAsync = promisify(execFile);

describe('prepareServerlessPackage', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `nextrush-packaging-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('creates package.json with {"type": "module"} in output directory', async () => {
    const result = await prepareServerlessPackage({ outDir: testDir });

    expect(existsSync(result.packageJsonPath)).toBe(true);
    const parsed = JSON.parse(readFileSync(result.packageJsonPath, 'utf8')) as { type?: string };
    expect(parsed.type).toBe('module');
  });

  it('preserves existing properties in package.json and ensures type is module', async () => {
    const pkgPath = join(testDir, 'package.json');
    writeFileSync(pkgPath, JSON.stringify({ name: 'custom-package', version: '1.0.0', type: 'commonjs' }), 'utf8');

    const result = await prepareServerlessPackage({ outDir: testDir });

    expect(existsSync(result.packageJsonPath)).toBe(true);
    const parsed = JSON.parse(readFileSync(result.packageJsonPath, 'utf8')) as {
      name?: string;
      version?: string;
      type?: string;
    };
    expect(parsed.name).toBe('custom-package');
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.type).toBe('module');
  });

  it('creates dual-entry .mjs bridge pointing to index.js by default', async () => {
    const result = await prepareServerlessPackage({ outDir: testDir });

    expect(existsSync(result.bridgePath)).toBe(true);
    expect(result.bridgePath.endsWith('index.mjs')).toBe(true);
    const content = readFileSync(result.bridgePath, 'utf8');
    expect(content).toContain("export * from './index.js';");
    expect(content).toContain("import * as _mod from './index.js';");
    expect(content).toContain("export default _mod.default;");
  });

  it('customizes entryName and normalizes extensions', async () => {
    const result = await prepareServerlessPackage({ outDir: testDir, entryName: 'handler.ts' });

    expect(result.bridgePath.endsWith('handler.mjs')).toBe(true);
    const content = readFileSync(result.bridgePath, 'utf8');
    expect(content).toContain("export * from './handler.js';");
    expect(content).toContain("import * as _mod from './handler.js';");
    expect(content).toContain("export default _mod.default;");
  });

  it('allows Node.js to execute the emitted .mjs bridge as native ESM in an isolated directory', async () => {
    // Write an actual JS entrypoint that uses native ES import/export
    const jsEntry = join(testDir, 'index.js');
    writeFileSync(
      jsEntry,
      `export const status = "ok";
export default { message: "ready" };
`,
      'utf8'
    );

    const result = await prepareServerlessPackage({ outDir: testDir });

    // Execute via node in a child process
    const script = `
import def, { status } from './${result.bridgePath.split('/').pop()}';
if (status !== 'ok' || def.message !== 'ready') {
  process.exit(1);
}
console.log('ESM_LOADED_OK');
`;
    const runnerScript = join(testDir, 'runner.mjs');
    writeFileSync(runnerScript, script, 'utf8');

    const { stdout } = await execFileAsync(process.execPath, [runnerScript], { cwd: testDir });
    expect(stdout.trim()).toBe('ESM_LOADED_OK');
  });

  it('allows Node.js to execute the emitted .mjs bridge with named-only exports without SyntaxError', async () => {
    const namedDir = join(tmpdir(), `nextrush-named-${Date.now()}`);
    mkdirSync(namedDir, { recursive: true });
    try {
      const jsEntry = join(namedDir, 'index.js');
      writeFileSync(
        jsEntry,
        `export const handler = (event) => ({ statusCode: 200, body: "ok" });\n`,
        'utf8'
      );

      await prepareServerlessPackage({ outDir: namedDir });

      const script = `
import { handler } from './index.mjs';
const res = handler({});
if (res.statusCode !== 200) process.exit(1);
console.log('NAMED_ONLY_OK');
`;
      const runnerScript = join(namedDir, 'runner.mjs');
      writeFileSync(runnerScript, script, 'utf8');

      const { stdout } = await execFileAsync(process.execPath, [runnerScript], { cwd: namedDir });
      expect(stdout.trim()).toBe('NAMED_ONLY_OK');
    } finally {
      rmSync(namedDir, { recursive: true, force: true });
    }
  });
});
