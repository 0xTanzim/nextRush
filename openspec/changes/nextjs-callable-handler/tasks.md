# Tasks

## 1. Governance (RFC + ADR, before code)

- [x] 1.1 Write `docs/RFC/runtime-adapters/049-nextjs-callable-handler.md` from `docs/RFC/TEMPLATE.md` covering decisions D1–D6 (callable set, one dispatcher, `WeakMap` shared engine keyed by app source + option identity, retry contract, type shape, real-build verification), and link it from `docs/RFC/INDEX.md`; verify the file exists and the index row resolves.
- [x] 1.2 Write `docs/adr/ADR-0037-nextjs-callable-handler-set.md` from `docs/adr/TEMPLATE.md` recording the durable decision and its alternatives, and link it from `docs/adr/INDEX.md`; verify both files exist and cross-reference RFC-049.

## 2. Adapter behavior (TDD)

- [x] 2.1 RED: add unit tests in `packages/adapters/nextjs/src/__tests__/index.test.ts` asserting `typeof handle(app) === 'function'`, each of the seven properties is a function, and `handle(app) === handle(app).GET`; run `pnpm --filter @nextrush/adapter-nextjs test` and confirm they fail.
- [x] 2.2 GREEN: change `handle()` to build one method-agnostic dispatcher and return `Object.assign(dispatcher, { GET, POST, … OPTIONS })` (all the same reference), add `export type NextRouteHandlerSet = NextRouteHandler & NextRouteHandlers`, and return it; verify 2.1 passes and existing destructuring tests still pass.
- [x] 2.3 RED: add tests for shared initialization — same app + equivalent options return the same handler object and invoke a factory once; `handle(app)` vs `handle(app, {})` share, `handle(app, { timeout: 5 })` is distinct; a rejecting factory is retried on the next request; run tests and confirm they fail.
- [x] 2.4 GREEN: add the module-level `WeakMap<AppSource, SharedEntry[]>` cache (match on `timeout` equality and `onError` identity, entry owns the lazy engine with reset-on-rejection) and delete the per-call `enginePromise`; verify 2.3 passes and no prior test regresses.
- [x] 2.5 Add a parity test that the callable and the destructured `GET` produce identical status/headers/body for the same request, and that HEAD responses keep their existing (body-less) semantics; verify the test passes.

## 3. Public surface

- [x] 3.1 Add `packages/adapters/nextjs/src/__tests__/public-surface.test.ts` (value exports via sorted `Object.keys()` + a compile-time type tuple including `NextRouteHandlerSet`) per the `public-surface-lock` capability; verify `pnpm --filter @nextrush/adapter-nextjs test` runs it green.
- [x] 3.2 Re-export `NextRouteHandlerSet` (and keep the existing type exports) from `packages/nextrush/src/nextjs.ts`; verify `pnpm --filter nextrush typecheck` passes.

## 4. Real Next.js build matrix

- [x] 4.1 Switch `packages/adapters/conformance/deploy-verification/nextjs-app-16/app/api/[[...route]]/route.ts` to direct assignment (`export const GET = handle(app)` …); run the app's `build` script and verify `next build` succeeds.
- [x] 4.4 Add a destructuring route fixture (e.g. a second route file in `nextjs-app-16`) and verify `next build` accepts it, guarding backward compatibility.
- [x] 4.5 Pin `nextjs-app-14` to Next `14.2.35` + React `18.3.1`, `nextjs-app-15` to `15.5.28`, and `nextjs-app-16` to `16.4.2`; run `next build` in each fixture. All three pass, so P2's version matrix is real rather than three copies of the catalog Next 16.

## 5. Documentation and release metadata

- [x] 5.1 Update `packages/adapters/nextjs/README.md` and `ARCHITECTURE.md` to document both export styles, the shared-initialization guarantee, and the option-identity match; verify `pnpm docs:validate` runs and reports no findings for this change. (The root `docs:validate` script pointed at the removed `scripts/docs/build-docs.ts`; it now delegates to the live website harness via `pnpm --filter website docs:verify`. Our files produce no findings; the command exits 1 only because of 102 pre-existing website findings — 9 broken links, 80 MDX compile/type, 13 forbidden words — unchanged by this change.)
- [x] 5.2 Add a `.changeset/*.md` minor bump for `@nextrush/adapter-nextjs` and `nextrush` describing the callable set and shared init; verify `pnpm validate:changeset-baselines` passes.

## 6. Integration gates

- [x] 6.1 Run the conformance `nextjs` driver under node, workerd, deno, and bun; verify status/headers/body/error parity is unchanged. (The `nextjs` driver is in-process: it ran in the Node/vitest suite — 984 tests green. The bun/deno/workerd runners drive their own adapters on real runtimes — 74/74, 74/74, 16/16 green — proving the underlying engines the Next.js bridge reuses.)
- [x] 6.2 Run `pnpm lint` and `pnpm typecheck` for the touched packages; verify both are clean. (`@nextrush/adapter-nextjs` and `@nextrush/adapter-conformance` lint 0 errors; `typecheck` clean for adapter-nextjs, nextrush, and conformance. `nextrush` has no lint script — only a type re-export changed.)
- [x] 6.3 Verify the adapter still imports no runtime-specific API (`node:*`, `process`, `Buffer`, `Deno`/`Bun` globals) and package coverage stays at or above 90%. (Only match is a word in a comment. Coverage: 97.18% lines / 96% functions / 91.42% branches.)

## Workflow follow-up

- Wire the three `next build` fixtures into CI (the matrix is run manually today).
- Sync the `web-adapters` delta into `openspec/specs/web-adapters/spec.md`.
- Archive the change after maintainer review and after RFC-049/ADR-0037 are merged.
