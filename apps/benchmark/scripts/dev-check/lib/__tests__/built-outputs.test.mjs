import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertBuiltOutputs, findStaleOutputs } from '../built-outputs.mjs';

function makeTree(packages) {
  const root = mkdtempSync(join(tmpdir(), 'nr-built-'));
  for (const [name, pkg] of Object.entries(packages)) {
    const dir = join(root, 'packages', name);
    mkdirSync(join(dir, 'src'), { recursive: true });
    mkdirSync(join(dir, 'dist'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: pkg.name, main: './dist/index.js' }));
    writeFileSync(join(dir, 'src', 'index.ts'), 'export const x = 1;\n');
    if (pkg.output !== false) writeFileSync(join(dir, 'dist', 'index.js'), 'export const x = 1;\n');
  }
  return root;
}

test('returns every built package when the outputs are present', (t) => {
  const root = makeTree({ core: { name: '@nextrush/core' }, router: { name: '@nextrush/router' } });
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const result = assertBuiltOutputs(root);
  assert.deepEqual(
    result.packages.map((pkg) => pkg.name),
    ['@nextrush/core', '@nextrush/router']
  );
  assert.deepEqual(result.stale, []);
});

test('throws with the missing path and the build command', (t) => {
  const root = makeTree({ core: { name: '@nextrush/core', output: false } });
  t.after(() => rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () => assertBuiltOutputs(root),
    (error) => /packages\/core\/dist\/index\.js/.test(error.message) && /pnpm build/.test(error.message)
  );
});

test('reports a source file newer than the built output as stale', (t) => {
  const root = makeTree({ core: { name: '@nextrush/core' } });
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const output = join(root, 'packages', 'core', 'dist', 'index.js');
  const source = join(root, 'packages', 'core', 'src', 'index.ts');
  const future = new Date(Date.now() + 60_000);
  utimesSync(source, future, future);

  const { packages } = assertBuiltOutputs(root);
  const stale = findStaleOutputs(packages);
  assert.equal(stale.length, 1);
  assert.equal(stale[0].name, '@nextrush/core');
  assert.equal(stale[0].output, output);
});

test('skips a package whose main entry is not a dist build', (t) => {
  const root = makeTree({ core: { name: '@nextrush/core' } });
  const dir = join(root, 'packages', 'conformance');
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: '@nextrush/adapter-conformance', private: true, main: './src/index.ts' })
  );
  writeFileSync(join(dir, 'src', 'index.ts'), 'export const x = 1;\n');
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const result = assertBuiltOutputs(root);
  assert.deepEqual(result.packages.map((pkg) => pkg.name), ['@nextrush/core']);
});
