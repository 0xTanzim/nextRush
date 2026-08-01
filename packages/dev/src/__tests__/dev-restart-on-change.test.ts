/**
 * @nextrush/dev - `nextrush dev` restart-on-change integration test (task 2.2)
 *
 * Spawns the REAL built CLI's `dev` command against a disposable COPY of
 * `examples/dev-cli-fixture` (never mutates the checked-in fixture — it may be running
 * concurrently under other tests/CI), modifies the watched source file's response body,
 * and asserts a subsequent request reflects the change — proving `--watch` actually
 * restarts the server, not just that it starts once.
 *
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const DEV_BIN = resolve(REPO_ROOT, 'packages/dev/bin/nextrush.js');
const FIXTURE_SRC = resolve(REPO_ROOT, 'examples/dev-cli-fixture');
const PORT = '58092';
const STARTUP_TIMEOUT_MS = 15_000;

let child: ChildProcess | undefined;
let workDir: string;

/** Poll a URL until its JSON body's `ok` field matches `expected`, or time out. */
async function waitForBodyOk(url: string, expected: boolean, deadlineMs: number): Promise<void> {
  const deadline = Date.now() + deadlineMs;
  let lastBody = '';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      const body = (await res.json()) as { ok: boolean };
      lastBody = JSON.stringify(body);
      if (body.ok === expected) return;
    } catch {
      // Server may be mid-restart — retry.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for body.ok === ${expected}; last seen: ${lastBody}`);
}

describe('nextrush dev — restart on file change (task 2.2)', () => {
  beforeEach(() => {
    // Must live INSIDE the monorepo (not os.tmpdir()) — the fixture's `nextrush` dep is a
    // `workspace:*` link, and @swc-node/register's tsconfig-extends resolution walks up
    // from the entry file looking for `tsconfig.base.json`, which only exists at the repo
    // root. A copy outside the repo breaks that chain with an unrelated-looking error.
    workDir = mkdtempSync(join(REPO_ROOT, 'examples', '.tmp-dev-restart-'));
    cpSync(FIXTURE_SRC, workDir, {
      recursive: true,
      filter: (src) => !src.includes('node_modules') && !src.includes('/dist'),
    });
  });

  afterEach(() => {
    if (child && !child.killed) {
      child.kill('SIGKILL');
    }
    child = undefined;
    // Windows holds file handles briefly after the child dies — retry the delete.
    rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  it(
    'reflects a source-file edit after --watch restarts the server',
    async () => {
      child = spawn(process.execPath, [DEV_BIN, 'dev', '--port', PORT], {
        cwd: workDir,
        env: { ...process.env, PORT, NODE_ENV: 'development' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Confirm the original response first.
      await waitForBodyOk(`http://127.0.0.1:${PORT}/`, true, STARTUP_TIMEOUT_MS);

      // Edit the watched source: flip describeHealth()'s `ok` field.
      const entryPath = join(workDir, 'src', 'index.ts');
      const original = readFileSync(entryPath, 'utf-8');
      const modified = original.replace('{ ok: true }', '{ ok: false }');
      expect(modified).not.toBe(original); // Sanity: the replace actually matched.
      writeFileSync(entryPath, modified);

      // The restarted server must now report ok: false.
      await waitForBodyOk(`http://127.0.0.1:${PORT}/`, false, STARTUP_TIMEOUT_MS);
    },
    (STARTUP_TIMEOUT_MS + STARTUP_TIMEOUT_MS) + 5_000
  );
});
