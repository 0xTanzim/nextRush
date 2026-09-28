/**
 * Integration fixtures proving the repo rule is *reachable* by the lint engine
 * that now guards this repo (RFC-037, tasks 1.7 and 1.9).
 *
 * `no-runtime-identity-capability.test.mjs` proves the rule's *logic* with ESLint's
 * RuleTester. Logic that no engine loads enforces nothing, so that suite cannot show
 * the rule still protects the codebase after the engine swap. Oxlint loads it through
 * `jsPlugins`; these fixtures run the real `oxlint` binary against real files and
 * assert the diagnostic actually appears (and that the `capability-exempt` annotation
 * still silences it).
 *
 * WHY THE PROBE LIVES INSIDE `packages/runtime/src/`: Oxlint evaluates JS-plugin rules
 * only for files that belong to the resolved TypeScript project. A probe in a scratch
 * directory outside every tsconfig `include` is silently linted as "0 findings" — the
 * rule is never consulted, which is exactly the silent-non-enforcement failure this
 * fixture exists to catch. Writing the probe where real source lives reproduces the
 * real enforcement path. The file is removed in a `finally`, and its exact path is
 * gitignored.
 *
 * Run: node --test tools/eslint-rules/
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { noRuntimeIdentityCapability as rule } from './no-runtime-identity-capability.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RULE_ID = 'no-runtime-identity-capability';
const QUALIFIED_RULE_ID = `nextrush/${RULE_ID}`;
const PROBE_FILE = join(REPO_ROOT, 'packages', 'runtime', 'src', '__lint-rule-probe__.ts');
const OXLINT_BIN = join(REPO_ROOT, 'node_modules', '.bin', 'oxlint');

const ANNOTATED_COMPARISON = [
  'export function annotated(runtime: string): string {',
  '  // capability-exempt: fixture — proves the annotation silences the rule',
  "  if (runtime === 'node') return 'node-path';",
  "  return 'generic';",
  '}',
].join('\n');

const UNANNOTATED_COMPARISON = [
  'export function unannotated(runtime: string): string {',
  "  if (runtime === 'bun') return 'bun-path';",
  "  return 'generic';",
  '}',
].join('\n');

/** Lint the probe file with the repo's real config; never throws on a non-zero exit. */
function lintProbe() {
  try {
    const stdout = execFileSync(OXLINT_BIN, [PROBE_FILE], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, output: stdout };
  } catch (error) {
    return {
      status: typeof error.status === 'number' ? error.status : 1,
      output: `${error.stdout ?? ''}${error.stderr ?? ''}`,
    };
  }
}

function withProbe(source, run) {
  writeFileSync(PROBE_FILE, `${source}\n`);
  try {
    return run();
  } finally {
    rmSync(PROBE_FILE, { force: true });
  }
}

test('oxlint enforces the repo rule through its JS-plugin host', () => {
  const result = withProbe(UNANNOTATED_COMPARISON, lintProbe);

  assert.notEqual(
    result.status,
    0,
    `expected a non-zero exit for a runtime-identity comparison, got 0:\n${result.output}`
  );
  // Qualified ID (not the bare rule name) — proves it came from the repo plugin's
  // namespace in `oxlint.config.ts`, not from an Oxc built-in of the same name.
  assert.match(
    result.output,
    new RegExp(`nextrush\\(${RULE_ID}\\)`),
    `expected the repo rule to be reported as ${QUALIFIED_RULE_ID}:\n${result.output}`
  );
});

test('the capability-exempt annotation still silences the repo rule under oxlint', () => {
  const result = withProbe(ANNOTATED_COMPARISON, lintProbe);

  assert.equal(result.status, 0, `expected a clean exit, got ${result.status}:\n${result.output}`);
  assert.doesNotMatch(
    result.output,
    new RegExp(RULE_ID),
    `the annotation must suppress the rule:\n${result.output}`
  );
});

test('the root config keeps both halves of the wiring the rule depends on', () => {
  const config = readFileSync(join(REPO_ROOT, 'oxlint.config.ts'), 'utf8');

  // The plugin declaration — without it Oxlint fails with "Plugin 'nextrush' not found".
  assert.match(
    config,
    /jsPlugins:\s*\[[\s\S]*no-runtime-identity-capability\.mjs/,
    'oxlint.config.ts must declare the repo rule through jsPlugins'
  );
  // The rule reference — without it the rule is loaded but never applied.
  assert.match(
    config,
    new RegExp(`['"]${QUALIFIED_RULE_ID}['"]\\s*:`),
    `oxlint.config.ts must enable ${QUALIFIED_RULE_ID}`
  );
});

test("the rule's exported shape is the ESLint-plugin shape Oxlint consumes", () => {
  // Oxlint's JS-plugin host (like ESLint) expects `{ rules: { <name>: <rule> } }`.
  // Asserting the shape here means a future refactor of the named export cannot
  // silently break the plugin host — this test fails first, with a clear reason.
  assert.equal(typeof rule.create, 'function', 'the rule must expose a create() function');
  assert.equal(
    typeof rule.meta?.messages?.runtimeIdentity,
    'string',
    'the rule must declare the runtimeIdentity message'
  );
});
