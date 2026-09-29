/**
 * Tests for `resolveInstallableRange`.
 *
 * The invariant under test protects a generated (standalone) project's installability:
 * a `catalog:` protocol specifier taken from the workspace root must never be emitted
 * verbatim into a scaffolded package.json, because pnpm catalogs resolve only inside
 * the workspace that declares them.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { resolveInstallableRange } from './catalog-range.mjs';

let root;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'catalog-range-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Writes a fake installed package manifest at `<root>/node_modules/<name>/package.json`. */
function installFakePackage(name, version) {
  const dir = join(root, 'node_modules', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version }));
}

test('a plain range passes through unchanged', () => {
  installFakePackage('oxlint', '9.9.9');
  assert.equal(resolveInstallableRange('^1.83.0', 'oxlint', root, '1.83.0'), '^1.83.0');
});

test('a named catalog spec resolves to the installed version', () => {
  installFakePackage('oxlint', '1.83.0');
  assert.equal(resolveInstallableRange('catalog:tooling', 'oxlint', root, '0.0.0'), '1.83.0');
});

test('the unnamed default catalog spec also resolves', () => {
  installFakePackage('oxlint', '1.83.0');
  assert.equal(resolveInstallableRange('catalog:', 'oxlint', root, '0.0.0'), '1.83.0');
});

test('a catalog spec with no installed resolution falls back (never re-emits the protocol)', () => {
  const result = resolveInstallableRange('catalog:tooling', 'oxlint', root, '1.83.0');
  assert.equal(result, '1.83.0');
  assert.doesNotMatch(result, /catalog:/);
});

test('an undefined or empty spec falls back', () => {
  assert.equal(resolveInstallableRange(undefined, 'oxlint', root, '1.83.0'), '1.83.0');
  assert.equal(resolveInstallableRange('', 'oxlint', root, '1.83.0'), '1.83.0');
});
