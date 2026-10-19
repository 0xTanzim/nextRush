/**
 * Guards the profiling entry set.
 *
 * A profile is only as trustworthy as the app it profiles: an entry that does not
 * bundle, does not answer, or measures a different shape than its README row claims
 * produces a confident wrong answer. These checks are deliberately cheap — they run
 * the entry with a small iteration count, not a profiler.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const DEVCHECK = resolve(import.meta.dirname, '..', '..');
const ENTRIES = join(DEVCHECK, 'entries');
const BUNDLER = join(DEVCHECK, 'lib', 'build.ts');
const README = join(DEVCHECK, 'README.md');

/** Entries the profile stage is expected to offer, with the runtime each must run on. */
const PROFILE_ENTRIES = [
  'inproc-nextrush',
  'inproc-nextrush-post',
  'inproc-nextrush-post-unparsed',
  'inproc-nextrush-mw',
];
const RUNTIMES = ['bun', 'node'];

const bunAvailable = spawnSync('bun', ['--version'], { encoding: 'utf8' }).status === 0;
const skipBun = bunAvailable ? false : 'bun is required by the dev-check toolkit';

const workdir = mkdtempSync(join(tmpdir(), 'nextrush-profile-entries-'));
process.on('exit', () => rmSync(workdir, { recursive: true, force: true }));

function bundle(entry, runtime) {
  const out = join(workdir, `${entry}.${runtime}.mjs`);
  const result = spawnSync('bun', [BUNDLER, join(ENTRIES, `${entry}.ts`), out, runtime, '--no-minify'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `bundle failed for ${entry} (${runtime}):\n${result.stderr}`);
  return out;
}

function runEntry(entry, runtime) {
  const file = bundle(entry, runtime);
  const result = spawnSync(runtime === 'bun' ? 'bun' : 'node', [file], {
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, N: '2000', HEADERS: '4' },
  });
  assert.equal(result.status, 0, `${entry} (${runtime}) exited ${result.status}:\n${result.stderr}`);
  return result.stdout;
}

test('the README lists every profiling entry', () => {
  const readme = readFileSync(README, 'utf8');
  for (const entry of PROFILE_ENTRIES) {
    assert.ok(readme.includes(entry), `README does not mention the ${entry} profiling entry`);
  }
});

for (const entry of PROFILE_ENTRIES) {
  test(`${entry} bundles and runs on every runtime`, { skip: skipBun }, () => {
    for (const runtime of RUNTIMES) {
      const stdout = runEntry(entry, runtime);
      assert.match(stdout, /US=\d+\.\d+/, `${entry} (${runtime}) printed no per-request cost:\n${stdout}`);
    }
  });
}

test('the parsed and unparsed POST entries answer identically', { skip: skipBun }, () => {
  const seen = new Set();
  for (const entry of ['inproc-nextrush-post', 'inproc-nextrush-post-unparsed']) {
    for (const runtime of RUNTIMES) {
      const match = runEntry(entry, runtime).match(/OK=(.*)/);
      assert.ok(match, `${entry} (${runtime}) reported no response fingerprint`);
      seen.add(`${entry}@${runtime}: ${match[1].trim()}`);
    }
  }
  const fingerprints = new Set([...seen].map((line) => line.split(': ')[1]));
  assert.equal(fingerprints.size, 1, `POST entries answer differently:\n${[...seen].join('\n')}`);
});
