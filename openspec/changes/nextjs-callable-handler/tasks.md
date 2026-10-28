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

- [ ] 4.1 Switch `packages/adapters/conformance/deploy-verification/nextjs-app-16/app/api/[[...route]]/route.ts` to direct assignment (`export const GET = handle(app)` …); run the app's `build` script and verify `next build` succeeds.
- [ ] 4.2 Repeat the direct-assignment switch and `next build` for `nextjs-app-15`; verify success.
- [ ] 4.3 Repeat the direct-assignment switch and `next build` for `nextjs-app-14`; verify success.
- [ ] 4.4 Add a destructuring route fixture (e.g. a second route file in `nextjs-app-16`) and verify `next build` accepts it, guarding backward compatibility.

## 5. Documentation and release metadata

- [ ] 5.1 Update `packages/adapters/nextjs/README.md` and `ARCHITECTURE.md` to document both export styles, the shared-initialization guarantee, and the option-identity match; verify `pnpm docs:validate` passes.
- [ ] 5.2 Add a `.changeset/*.md` minor bump for `@nextrush/adapter-nextjs` and `nextrush` describing the callable set and shared init; verify `pnpm validate:changeset-baselines` passes.

## 6. Integration gates

- [ ] 6.1 Run the conformance `nextjs` driver under node, workerd, deno, and bun; verify status/headers/body/error parity is unchanged.
- [ ] 6.2 Run `pnpm lint` and `pnpm typecheck` for the touched packages; verify both are clean.
- [ ] 6.3 Verify the adapter still imports no runtime-specific API (`node:*`, `process`, `Buffer`, `Deno`/`Bun` globals) and package coverage stays at or above 90%.

## Workflow follow-up

- Sync the `web-adapters` delta into `openspec/specs/web-adapters/spec.md`.
- Archive the change after maintainer review and after RFC-049/ADR-0037 are merged.
