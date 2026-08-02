/// <reference types="node" />

/**
 * pre-push gate — the final checkpoint before anything reaches origin.
 *
 * Two layers:
 *
 * 1. Release-state guard (always): a bad release state reaching a shared
 *    branch is worse than a slightly slower push.
 * 2. Local verification (only when the push touches turbo-relevant files):
 *    `turbo run build test typecheck lint` — the same tasks CI's `verify`
 *    runs — capped to a low concurrency so the run never saturates the
 *    machine's CPUs and freezes other work. When a turbo remote cache is
 *    configured (`TURBO_TOKEN`), the resulting artifacts upload to the
 *    remote cache, so CI pulls them instead of re-running — cutting runner
 *    minutes and CI cost. Without a token the check still runs (local cache
 *    only) and CI runs cold, but broken code never reaches origin.
 *
 * Escapes:
 * - `SKIP_SIMPLE_GIT_HOOKS=1` bypasses this hook entirely (simple-git-hooks).
 * - `NEXTRUSH_PRE_PUSH_CONCURRENCY=N` overrides the turbo concurrency cap
 *   (default 2 — enough to keep pushes snappy without pegging all cores).
 *
 * Docs-only pushes (markdown, `.changeset/`, `.github/`, `.kiro/`) skip the
 * heavy check — turbo task inputs can't change, so there is nothing to
 * verify or cache.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Cap turbo's parallelism so a push doesn't starve the rest of the machine. */
const DEFAULT_CONCURRENCY = 2;

/** Files that can never change a turbo build/lint/typecheck/test task hash. */
const SKIP_HEAVY_CHECK = /\.(md|mdx)$|(^|\/)\.changeset\/|(^|\/)\.github\/|(^|\/)\.kiro\//;

const ZERO_OID = '0000000000000000000000000000000000000000';

interface PushedRef {
  readonly localRef: string;
  readonly localOid: string;
  readonly remoteRef: string;
  readonly remoteOid: string;
}

async function getPushedRefs(): Promise<PushedRef[]> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => {
      const lines = Buffer.concat(chunks).toString('utf8').trim().split('\n').filter(Boolean);
      resolve(
        lines.map((line) => {
          const [localRef, localOid, remoteRef, remoteOid] = line.split(/\s+/);
          return { localRef, localOid, remoteRef, remoteOid };
        })
      );
    });
    process.stdin.on('error', reject);
  });
}

async function getChangedFiles(push: PushedRef): Promise<string[]> {
  // All-zeros remote oid means the branch does not exist remotely yet (first
  // push) — no remote base to diff against; verification runs unconditionally
  // (see shouldVerify).
  if (push.remoteOid === ZERO_OID) return [];
  // All-zeros local oid means the ref was deleted — nothing to verify.
  if (push.localOid === ZERO_OID) return [];
  const { stdout } = await execFileAsync('git', [
    'diff',
    '--name-only',
    push.remoteOid,
    push.localOid,
  ]);
  return stdout.split('\n').filter(Boolean);
}

function shouldVerify(pushed: readonly PushedRef[], changed: readonly string[]): boolean {
  // A new branch has no remote base to diff against — verify the whole branch.
  if (pushed.some((p) => p.remoteOid === ZERO_OID)) return true;
  return changed.some((file) => !SKIP_HEAVY_CHECK.test(file));
}

function touchesTurboInputs(changed: readonly string[]): boolean {
  return changed.some((file) => !SKIP_HEAVY_CHECK.test(file));
}

async function runReleaseStateGuard(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('ℹ pre-push: running release-state guard...');
  await execFileAsync('pnpm', ['verify:release-state'], { stdio: 'inherit' } as never).catch(
    (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error(
        '❌ pre-push blocked: release-state guard failed. Fix the problem above before pushing.'
      );
      throw err;
    }
  );
}

async function runLocalVerification(): Promise<void> {
  const concurrency = Number(process.env.NEXTRUSH_PRE_PUSH_CONCURRENCY) || DEFAULT_CONCURRENCY;
  // eslint-disable-next-line no-console
  console.log(
    `ℹ pre-push: running local build/test/typecheck/lint (turbo-cached, concurrency=${concurrency})...`
  );
  await execFileAsync(
    'pnpm',
    [
      'exec',
      'turbo',
      'run',
      'build',
      'test',
      'typecheck',
      'lint',
      '--concurrency',
      String(concurrency),
    ],
    { stdio: 'inherit' } as never
  ).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error(
      '❌ pre-push blocked: local verification failed. Fix the problem above before pushing.'
    );
    throw err;
  });

  if (!process.env.TURBO_TOKEN) {
    // eslint-disable-next-line no-console
    console.log(
      'ℹ pre-push: TURBO_TOKEN not set — turbo remote-cache upload skipped. Set it locally ' +
        'so CI can pull these artifacts instead of re-running.'
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(
      'ℹ pre-push: turbo remote cache configured — artifacts uploaded; CI can pull them.'
    );
  }
}

async function main(): Promise<void> {
  await runReleaseStateGuard();

  const pushed = await getPushedRefs();
  if (pushed.length === 0) return;

  const changed = (await Promise.all(pushed.map(getChangedFiles))).flat();
  if (!shouldVerify(pushed, changed)) {
    // eslint-disable-next-line no-console
    console.log(
      'ℹ pre-push: push only touches docs/markdown — skipping local build/test/typecheck/lint.'
    );
    return;
  }

  await runLocalVerification();
}

main().catch(() => {
  process.exitCode = 1;
});
