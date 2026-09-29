/**
 * Tests for the `keep-class-names` rolldown plugin.
 *
 * The invariant under test is a PUBLIC-API property: after our bundle has been through a
 * downstream transform that renames class bindings (esbuild with `keepNames: false` —
 * Vitest's transform and Vite's dependency optimizer both do this), an error class must
 * still report its real `name`, because `@nextrush/errors` exposes it via
 * `err.name` / `err.toJSON().error`.
 *
 * The first cases model the rename deterministically, so the contract stays pinned even
 * if esbuild is unavailable. The last one runs the real esbuild transform, proving the
 * model matches the tool that actually caused the regression.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keepClassNames } from './keep-class-names.mjs';

/** rolldown's output shape for a class whose body references itself. */
const SELF_NAMED =
  'var ValidationError = class ValidationError extends Error {}\nexport { ValidationError };';

/** What esbuild does to that shape (`keepNames: false`): it renames the INNER binding. */
const renameLikeEsbuild = (code) =>
  code.replace('class ValidationError extends', 'class ValidationError2 extends');

/** Evaluate an ESM snippet and return its module namespace. */
async function evaluate(code) {
  return import(`data:text/javascript,${encodeURIComponent(code)}`);
}

test('leaves chunks without a self-named class untouched', () => {
  assert.equal(keepClassNames().renderChunk('var x = 1;\n'), null);
});

test('baseline: without the plugin a renaming transform corrupts the public name', async () => {
  const { ValidationError } = await evaluate(renameLikeEsbuild(SELF_NAMED));
  assert.equal(ValidationError.name, 'ValidationError2');
});

test('the emitted class keeps its real name after a renaming transform', async () => {
  const patched = keepClassNames().renderChunk(SELF_NAMED).code;
  const afterConsumer = renameLikeEsbuild(patched);

  // Guard: the transform really did rename the binding, so the assertion below is meaningful.
  assert.match(afterConsumer, /class ValidationError2 extends/);

  const { ValidationError } = await evaluate(afterConsumer);
  assert.equal(ValidationError.name, 'ValidationError');
});

test('real esbuild round-trip with keepNames disabled (as Vite and Vitest run it)', async (t) => {
  let esbuild;
  try {
    esbuild = await import('esbuild');
  } catch {
    t.skip('esbuild is not resolvable in this environment');
    return;
  }

  const transformed = await esbuild.transform(keepClassNames().renderChunk(SELF_NAMED).code, {
    loader: 'js',
    target: 'esnext',
    format: 'esm',
  });

  assert.match(transformed.code, /class ValidationError2 extends/);

  const { ValidationError } = await evaluate(transformed.code);
  assert.equal(ValidationError.name, 'ValidationError');
});
