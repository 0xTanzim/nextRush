/**
 * @nextrush/dev - Type-level regression test (task 2.6, F-06)
 *
 * F-06: before the typed `node:*` accessors (RFC-019 D3), `node:path`/`node:fs` helpers
 * were reached via an untyped variable-specifier `import(NODE_PATH)`, which TypeScript
 * infers as `any` — so passing a non-string (e.g. the `TypeScriptFile` object that caused
 * F-01) to a path helper produced NO compile error, only a runtime failure.
 *
 * This file is not run by vitest — it is a COMPILE-TIME assertion, checked by
 * `pnpm typecheck` (`tsc --noEmit`). `@ts-expect-error` requires an actual type error on
 * the next line; if `resolvePath`'s parameter type is ever widened back to `any`/`unknown`
 * (silently accepting a non-string again), the error stops occurring and
 * `@ts-expect-error` itself fails to compile — this file becomes the assertion that a
 * non-string argument is a caught type error, not a caught-at-runtime crash.
 *
 * @packageDocumentation
 */

import { resolvePath } from '../../runtime/index.js';
import type { TypeScriptFile } from '../../commands/build/file-scanner.js';

declare const fakeTypeScriptFile: TypeScriptFile;

// @ts-expect-error — resolvePath requires string arguments; an object (the exact shape
// that caused F-01's object-as-path bug in deno-builder.ts) must be a compile error.
resolvePath(fakeTypeScriptFile, 'entry.ts');

// @ts-expect-error — same regression guard for a bare number argument.
resolvePath(42, 'entry.ts');

// Sanity check the positive case still compiles cleanly (proves the two errors above are
// real type errors on the object/number arguments, not incidental unrelated failures).
resolvePath('/some/dir', 'entry.ts');
