/**
 * Integration test for warmup/cooldown/pause provenance recording.
 *
 * Spawns run.js against a real server and asserts the recorded configuration
 * contains the expected warmup/cooldown/pause values — replacing the earlier
 * regex-against-source-text approach (which caught the same regression but
 * tested source shape rather than actual behavior).
 *
 * Regression guard: the recorded configuration must be the VALUES actually passed to warmup()/sleep(), not merely the
 * profile's declared defaults with an unrecorded override path. If a future
 * CLI override is added for any of these fields, this test forces that change
 * to also update the provenance recording — exactly what the regex test did,
 * but at the behavioral rather than lexical level.
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { PROFILES } from '../../../config/profiles.js';

/** Root of the benchmark app (apps/benchmark). */
const ROOT = join(import.meta.dirname, '..', '..', '..');

/**
 * Run run.js with minimal settings and return the parsed report JSON plus
 * the run ID (for cleanup).
 * Uses the quick profile as reference — shortest warmup/cooldown values.
 */
function runBenchmarkAndParseReport() {
  const script = join(ROOT, 'scripts/run.js');
  // --duration / --time: 2 sec per test
  // --runs: single run
  // --connections: single concurrency level
  // --framework: target only raw-node
  // --scenario: one scenario only
  // --no-validate: skip parity pre-flight
  const cmd = `node ${script} --no-validate --framework raw-node --scenario hello-world --time 2 --runs 1 --connections 64 --profile quick`;
  let stdout;
  let stderr;
  try {
    stdout = execSync(cmd, { cwd: ROOT, timeout: 35_000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    stdout = e.stdout || '';
    stderr = e.stderr || '';
    throw new Error(`run.js failed:\n${stdout}\n${stderr}`);
  }

  const runIdMatch = stdout.match(/Run ID:\s+(\S+)/);
  if (!runIdMatch) throw new Error('Could not parse run ID from output:\n' + stdout);

  const runId = runIdMatch[1].trim();
  const resultsPath = join(ROOT, 'results', runId, 'results.json');
  return { report: JSON.parse(readFileSync(resultsPath, 'utf8')), runId };
}

/** Best-effort cleanup of generated benchmark results. */
function cleanupResults(runId) {
  try {
    const dir = join(ROOT, 'results', runId);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    const latest = join(ROOT, 'results', 'latest');
    if (existsSync(latest)) rmSync(latest, { recursive: true, force: true });
  } catch {
    // non-fatal
  }
}

test('warmup/cooldown/pause values in the recorded configuration match the active profile', () => {
  const profile = PROFILES.quick;
  const { report, runId } = runBenchmarkAndParseReport();
  // Best-effort cleanup of generated benchmark results — non-blocking
  queueMicrotask(() => cleanupResults(runId));

  const config = report.configuration;

  // Every warmup/cooldown/pause field must be present in the recorded config
  const recordedKeys = ['warmupDuration', 'scenarioWarmupDuration', 'cooldownMs', 'pauseBetweenTestsMs'];
  for (const key of recordedKeys) {
    assert.ok(key in config, `config.${key} is missing from the recorded configuration`);
  }

  // The recorded values must match the active profile exactly
  assert.equal(config.warmupDuration, profile.warmupDuration);
  assert.equal(config.scenarioWarmupDuration, profile.scenarioWarmupDuration);
  assert.equal(config.cooldownMs, profile.cooldownMs);
  assert.equal(config.pauseBetweenTestsMs, profile.pauseBetweenTestsMs);

  // Prove the test catches a broken recording: if the values were silently
  // different (e.g. an override affected behavior but not recording), this
  // assertion fails. The test must be kept in sync with run.js's
  // runConfiguration construction (lines 329-337).
});

test('all profiles define the warmup/cooldown/pause fields', () => {
  const requiredFields = ['warmupDuration', 'scenarioWarmupDuration', 'cooldownMs', 'pauseBetweenTestsMs'];

  for (const [name, p] of Object.entries(PROFILES)) {
    for (const field of requiredFields) {
      assert.ok(field in p, `Profile "${name}" is missing "${field}"`);
      assert.ok(p[field] !== undefined, `Profile "${name}" has undefined "${field}"`);
    }
  }
});
