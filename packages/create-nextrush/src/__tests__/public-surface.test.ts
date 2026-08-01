/**
 * create-nextrush - Public API surface test
 *
 * Unlike every other package in this repo, `create-nextrush`'s `src/index.ts`
 * is NOT a barrel of named exports — it's a CLI entry point: a `main()`
 * function invoked as a side effect when the module loads, with no `export`
 * statements at all. The package's `exports` field in `package.json` still
 * points here (so `import 'create-nextrush'` resolves), but there is no
 * library surface to consume.
 *
 * This test locks that fact: the module has ZERO named exports. If a future
 * change accidentally adds a named export (e.g. someone refactors `main()`
 * into an exported function for testability), this test fails — forcing an
 * intentional decision about whether that export should be public API,
 * rather than a library surface leaking in silently.
 */
import { describe, expect, it } from 'vitest';

describe('Public API surface (CLI entry point — no library exports)', () => {
  it('exports nothing — this package is consumed only as a binary', async () => {
    // Importing src/index.ts runs its module-level `main().catch(...)` side
    // effect, which calls `process.exit()` on error paths and isn't designed
    // to run under a test harness. Instead of importing it directly, this
    // assertion is a structural check: read the compiled/declared exports
    // via the package's own type declarations would require a build step,
    // which is out of scope for a source-level surface-lock test. The
    // meaningful lock here is documented and enforced by convention (no
    // `export` keyword in src/index.ts) plus this test's existence as a
    // marker — a reviewer adding an `export` must also update this file's
    // assertion below, which is the actual gate.
    const indexSource = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../index.ts', import.meta.url), 'utf-8')
    );

    // SEALED: no `export` statement should appear in this file. If this
    // fails, src/index.ts gained a named export — decide intentionally
    // whether it belongs in the public API before updating this assertion.
    expect(indexSource).not.toMatch(/^export\s/m);
  });
});
