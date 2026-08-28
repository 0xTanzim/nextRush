## 1. Failing regression tests (RED)

- [x] 1.1 Add a failing surface-lock test in `packages/middleware/logger/src/__tests__/public-surface.test.ts`: the barrel's re-exported symbols MUST all resolve against the installed `@nextrush/log` exports (live link check via `import * as logApi from '@nextrush/log'`) — verify with `pnpm vitest run public-surface logger` that the test fails on the current stale surface (removed symbols)
- [x] 1.2 Add failing runtime tests: `logger({ environment })` defaults `logRequestStart` from `environment` (`'development'` → on, `'production'` → off) and an explicit `logRequestStart` overrides it — verify the new tests fail against current behavior (which calls removed `isProductionBuild()`)
- [x] 1.3 Update the `logger.test.ts` surface-mirror describe block to assert the surviving v0.3 surface (`log`, `createLogger`, `configure`, transports, async-context helpers, middleware API) instead of removed symbols (`serializeError`, `shouldLog`, `compareLevels`, `isProductionBuild`) — verify the updated test fails until the barrel is pruned

## 2. Core implementation (GREEN)

- [x] 2.1 Prune the `export { … } from '@nextrush/log'` block in `packages/middleware/logger/src/index.ts` to the v0.3 survivors (D1: values `log`, `createLogger`, `configure`, `addGlobalTransport`, `disableLogging`, `createBatchTransport`, `createFilteredTransport`, `createRateLimitedTransport`, `createContextMiddleware`, `getAsyncContext`, `runWithContext`; types `ILogger`, `LoggerOptions`, `LogLevel`, `Logger`, `AsyncLogContext`, `GlobalLoggerConfig` and any other v0.3 type survivors) — verify tests 1.1–1.3 now pass and `tsc --noEmit` in the middleware package is clean
- [x] 2.2 Add `environment?: 'development' | 'production'` to `LoggerMiddlewareOptions` (default `'development'`), default `logRequestStart = environment !== 'production'`, and remove the `isProductionBuild()` call — verify test 1.2 passes and the portability guard shows no `process` usage in the request path
- [x] 2.3 Remove the now-unused `@nextrush/log` imports and confirm the runtime import line only pulls `createLogger` + surviving types — verify `tsc --noEmit` clean and `pnpm vitest run` in the middleware passes

## 3. Gates (verification)

- [x] 3.1 Run the full `packages/middleware/logger` test suite (`pnpm vitest run`) — all green including security-crlf-injection tests
- [x] 3.2 Run per-package gates: line coverage ≥ 90%, ESLint clean, `tsc` strict clean — all pass
- [ ] 3.3 Run the repo-wide `pnpm lint` and `pnpm build` — both complete green (this is the gate `preserve-route-metadata-on-mount` task 4.5 needs unblocked)
- [x] 3.4 Run `openspec validate "migrate-logger-to-log-v03" --strict` — valid

## 4. Docs & governance

- [x] 4.1 Write a short RFC/ADR in `docs/RFC/` recording the durable decision: middleware re-export surfaces are the intersection of the dependency's stable surface and the package's value-add; a middleware never mirrors a dependency's removed internals; production-mode detection in middleware is explicit and edge-portable — required before archive (breaking public-API change)
- [x] 4.2 Add a `@nextrush/logger` changeset with **BREAKING** notes and a migration path (removed helpers → surviving `@nextrush/log` API; `environment` option replaces the old production probe) — verify entry is accurate
- [x] 4.3 Update `packages/middleware/logger/README.md`: refresh the API table to the v0.3-aligned surface, document `environment`/`logRequestStart` semantics, and add a migration note — verify docs render and statements match tests
- [ ] 4.4 Commit the change as a conventional commit per AGENTS.md §20 (e.g. `fix(logger): migrate to @nextrush/log v0.3 API surface`) — verify working tree is clean after commit