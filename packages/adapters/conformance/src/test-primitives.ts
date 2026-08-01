/**
 * Test-primitives indirection (F-01, ADR-0010).
 *
 * @remarks
 * `suite.ts` imports `it`/`expect` from HERE, not directly from `vitest`, so
 * that a real-runtime runner (`bun-runner/`, `deno-runner/`) can resolve this
 * exact module specifier to its OWN test framework's `it`/`expect` (via a
 * per-runner import map / path alias) and run the identical shared suite
 * under `bun test` / `deno test` — instead of maintaining a divergent,
 * hand-written subset of assertions per real runtime (the F-01 problem).
 *
 * The in-process suite (this package's own `vitest run`) resolves this module
 * normally and gets real vitest primitives — nothing changes for it.
 *
 * Any test-framework module substituted here MUST export `it`/`describe.each`-
 * compatible `it` (a simple `(name, fn) => void` registrar) and a Jest-style
 * `expect` implementing at least: `toBe`, `toEqual`, `toContain`, `toBeNull`,
 * `toBeUndefined`, `toBeGreaterThan`/`toBeLessThan`(OrEqual), `not.*` negation,
 * and `.toBe(true)`/`.toBe(false)` boolean checks — the subset `suite.ts`
 * actually calls. `bun:test` and Deno's `@std/expect` both satisfy this.
 *
 * @packageDocumentation
 */

export { expect, it } from 'vitest';
