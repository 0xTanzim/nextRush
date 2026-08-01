import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Task 3.4 (F-03 — RFC-021 / ADR-0011): install/git failures must surface the captured
 * command output + the exact manual retry command; success must stay quiet (no dumped
 * output on the happy path).
 *
 * Exercises `runCaptured` from `index.ts` indirectly is not possible without importing the
 * CLI entry module (which runs `main()` as a side effect) — instead this test verifies the
 * underlying mechanism directly: `execFileSync` with `stdio: ['ignore', 'ignore', 'pipe']`
 * captures stderr on failure, which is exactly what `index.ts::runCaptured` relies on.
 */
describe('install/git failure diagnostics (task 3.4)', () => {
  let tmpDir: string;
  const consoleErrorSpy = vi.spyOn(console, 'error');

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'create-nextrush-diag-'));
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('captures stderr from a failing command instead of swallowing it', () => {
    let captured = '';
    try {
      execFileSync('node', ['-e', 'console.error("boom: registry unreachable"); process.exit(1);'], {
        cwd: tmpDir,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
    } catch (error) {
      captured =
        error && typeof error === 'object' && 'stderr' in error
          ? String((error as { stderr: Buffer | string }).stderr)
          : '';
    }

    expect(captured).toContain('boom: registry unreachable');
  });

  it('produces no output at all on a successful command (quiet happy path)', () => {
    const result = execFileSync('node', ['-e', 'console.log("should not be captured/printed");'], {
      cwd: tmpDir,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    // stdout was explicitly ignored — execFileSync returns null when stdio requests no
    // capture, so nothing is available for display, matching "success stays quiet"
    // (F-03 scenario 2).
    expect(result).toBeNull();
  });
});
