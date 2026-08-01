/**
 * Bun-runner override of `@nextrush/adapter-conformance`'s test-primitives
 * indirection (F-01, ADR-0010).
 *
 * @remarks
 * `bun-runner`'s import map (`bunfig.toml` / `package.json` alias — see
 * `README` for the exact resolution wiring) maps the conformance package's
 * `./test-primitives` specifier to THIS file when running under `bun test`,
 * so `defineConformanceSuite` registers its cases via Bun's own `it`/`expect`
 * instead of vitest's — running the identical shared suite for real on Bun.
 */

export { expect, it } from 'bun:test';
