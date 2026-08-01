/**
 * Deno-runner override of `@nextrush/adapter-conformance`'s test-primitives
 * indirection (F-01, ADR-0010).
 *
 * @remarks
 * `deno-runner`'s `deno.json` import map redirects the conformance package's
 * internal `./test-primitives` specifier to THIS file when running under
 * `deno test`, so `defineConformanceSuite` registers its assertions via a
 * Deno-native `it` (a thin wrapper over `Deno.test`) and `@std/expect`
 * (Jest-compatible `expect`, covering the exact matcher subset the suite
 * uses: `toBe`, `toEqual`, `toContain`, `toBeNull`, `toBeUndefined`, `.not`).
 */
import { expect } from '@std/expect';

/** Minimal `it(name, fn)` registrar over `Deno.test`, matching vitest's bare signature. */
function it(name: string, fn: () => void | Promise<void>): void {
  Deno.test(name, fn);
}

export { expect, it };
