/**
 * @nextrush/dev - Build-time decorator-metadata preflight tests
 *
 * `nextrush build` must fail fast when a project's tsconfig has a mismatched
 * decorator-metadata configuration (one of `experimentalDecorators` /
 * `emitDecoratorMetadata` set without the other), instead of silently
 * shipping a metadata-broken artifact. Decorator-free and correctly
 * configured projects must be unaffected (regression guards).
 *
 */

import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as runtime from '../runtime/index.js';
import * as buildSteps from '../commands/build/index.js';

describe('nextrush build — decorator-metadata preflight', () => {
  let fixtureDir: string;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorLines: string[];

  beforeEach(() => {
    fixtureDir = mkdtempSync(join(tmpdir(), 'nextrush-build-preflight-'));
    mkdirSync(join(fixtureDir, 'src'), { recursive: true });
    writeFileSync(join(fixtureDir, 'src', 'index.ts'), 'export const noop = () => {};\n');

    // `process.chdir` is unavailable under vitest's worker-thread pool, so the
    // fixture cwd is injected via `getCwd()` instead — same real-fs approach,
    // just without relying on process-global cwd mutation.
    vi.spyOn(runtime, 'getCwd').mockReturnValue(fixtureDir);

    exitSpy = vi.spyOn(runtime, 'exitProcess').mockImplementation(() => {
      throw new Error('exit');
    });
    errorLines = [];
    vi.spyOn(console, 'error').mockImplementation((message: unknown) => {
      errorLines.push(String(message));
    });

    // Stub the actual compilation step — this suite tests the preflight gate,
    // not the SWC pipeline itself.
    vi.spyOn(buildSteps, 'buildWithSwc').mockResolvedValue(undefined);
  });

  afterEach(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function writeTsconfig(compilerOptions: Record<string, unknown>): void {
    writeFileSync(
      join(fixtureDir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions }, null, 2)
    );
  }

  it('fails the build with remediation text when experimentalDecorators is true but emitDecoratorMetadata is missing', async () => {
    writeTsconfig({ experimentalDecorators: true });

    const { build } = await import('../commands/build.js');

    await expect(build()).rejects.toThrow('exit');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorLines.join('\n')).toContain('emitDecoratorMetadata');
  });

  it('completes successfully with no error for a decorator-free project (neither flag set)', async () => {
    writeTsconfig({ strict: true, target: 'ES2022' });

    const { build } = await import('../commands/build.js');

    await expect(build()).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('completes successfully with no error for a correctly configured decorator project (both flags true)', async () => {
    writeTsconfig({ experimentalDecorators: true, emitDecoratorMetadata: true });

    const { build } = await import('../commands/build.js');

    await expect(build()).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
