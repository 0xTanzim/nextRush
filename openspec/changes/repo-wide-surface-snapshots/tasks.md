## 1. Foundation layer (types, errors already/next)

- [x] 1.1 `@nextrush/errors` — read `src/index.ts`, write `public-surface.test.ts` locking its runtime export list  <!-- 68 runtime exports locked via Object.keys() + 5 type-only exports (HttpErrorOptions/ValidationIssue/ErrorContext/ErrorHandlerOptions/ErrorMiddleware) via compile-time tuple. Tests 7/7 files, 195 passed. Typecheck clean. Lint: zero new violations (pre-existing errors in index.ts/validation.ts unrelated to this test file). -->

## 2. Core / router / runtime / di

- [x] 2.1 `@nextrush/core` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 14 runtime exports (Application/createApp/compose/flattenMiddleware/isMiddleware/7 re-exported error classes/ContentType/HttpStatus) + 21-type compile-time tuple. Tests 7/7 files, 111 passed. Typecheck clean, lint clean. -->
- [x] 2.2 `@nextrush/router` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 6 runtime exports (createRouter/endpoint/Router/createNode/NodeType/parseSegments - the createNode/NodeType/parseSegments trio retains the historical "radix" naming per gap-checklist T002, locked as-is) + 11-type compile-time tuple. Tests 8/8 files, 202 passed. Typecheck clean, lint clean. -->
- [x] 2.3 `@nextrush/runtime` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 41 runtime exports (detection fns, 8 named CapabilityProfiles, query/constants/headers/request-signal/server-error/response-builder/body-source) + 11-type compile-time tuple. Caught + fixed a real bug in my own first draft (METHODS_WITHOUT_BODY is a ReadonlySet, not an array - fixed the assertion, not the source). Tests 9/9 files, 107 passed. Typecheck clean, lint clean. -->
- [x] 2.4 `@nextrush/di` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 19 runtime exports (container/decorators/METADATA_KEYS/4 error classes) + 11-type compile-time tuple. public-surface.test.ts itself: 2/2 passed. NOTE: 2 pre-existing, unrelated test timeouts in container.errors.test.ts (circular-dependency detection tests, 5000ms timeout) - confirmed pre-existing by re-running after a no-op git stash (no local tracked changes to stash, same failure reproduced identically), not caused by this task; logged as a Finding, not fixed here (out of this task's scope). Typecheck clean, lint clean on the new file. -->


## 3. Adapters

- [x] 3.1 `@nextrush/adapter-node` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 14 runtime exports (adapter fns, HttpError, NodeContext, body-source classes re-exported from runtime, utilities) + 9-type compile-time tuple. Tests 5/5 files, 83 passed. Typecheck clean, lint clean (source scope). -->
- [x] 3.2 `@nextrush/adapter-bun` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 14 runtime exports incl. the deprecated BunBodySource/createBunBodySource back-compat aliases (locked as-is, not renamed here) + 8-type compile-time tuple. Tests 5/5 files, 116 passed. Typecheck clean, lint clean. -->
- [x] 3.3 `@nextrush/adapter-deno` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 14 runtime exports incl. the deprecated DenoBodySource/createDenoBodySource back-compat aliases + 8-type compile-time tuple. Tests 5/5 files, 114 passed. Typecheck clean, lint clean. -->
- [x] 3.4 `@nextrush/adapter-edge` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 19 runtime exports incl. createCloudflareHandler/createVercelHandler/createNetlifyHandler and the deprecated EdgeBodySource/createEdgeBodySource aliases + 11-type compile-time tuple. Tests 5/5 files, 121 passed. Typecheck clean, lint clean. -->
- [x] 3.5 `@nextrush/adapter-serverless` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 10 runtime exports (Tier-1 handlers: createLambdaHandler/createGoogleHandler/createAzureHandler/createLambdaStreamingHandler; Tier-3 createServerlessAdapter; 5 built-in mappers) + 20-type compile-time tuple covering all event/result/streaming types. Tests 6/6 files, 30 passed. Typecheck clean, lint clean. -->

## 4. Middleware

- [x] 4.1 `@nextrush/cors` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 29 runtime + default export + 9-type tuple. Fixed 2 wrong assertions during authoring: DEFAULT_METHODS is a comma-joined string not array; PREFLIGHT_INDICATORS is an object not array. Tests 2/2 files, 72 total pass. -->
- [x] 4.2 `@nextrush/helmet` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 45 runtime + default export + 21-type tuple. Tests 2/2 files, 151 pass. -->
- [x] 4.3 `@nextrush/csrf` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 11 runtime + 6-type tuple. Tests 2/2 files, 134 pass. -->
- [x] 4.4 `@nextrush/body-parser` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 26 runtime + default export + 9-type tuple. Fixed 1 wrong assertion: BODYLESS_METHODS is a Set not array. Tests 5/5 files pass. -->
- [x] 4.5 `@nextrush/multipart` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 6 runtime + 10-type tuple. Tests 2/2 files pass. -->
- [x] 4.6 `@nextrush/rate-limit` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 39 runtime + default export + 14-type tuple. Fixed 1 wrong assertion: fixedWindow/slidingWindow/tokenBucket are algorithm objects not functions. Tests 2/2 files pass. -->
- [x] 4.7 `@nextrush/compression` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 41 runtime + default export + 12-type tuple. Tests 2/2 files pass. -->
- [x] 4.8 `@nextrush/cookies` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 30 runtime + 12-type tuple. Tests 8/8 files pass. -->
- [x] 4.9 `@nextrush/validation` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 2 runtime + 1-type tuple. Tests 5/5 files pass. -->
- [x] 4.10 `@nextrush/request-id` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 18 runtime + 7-type tuple. Tests 2/2 files pass. -->
- [x] 4.11 `@nextrush/timer` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 12 runtime + 7-type tuple. Tests 2/2 files pass. -->
- [x] 4.12 `@nextrush/static` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 13 runtime + 8-type tuple. Tests 2/2 files pass. -->
- [x] 4.13 `@nextrush/template` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 89 runtime (incl. VERSION const and the full helpers surface) + 29-type tuple. Tests 3/3 files pass. -->
- [x] 4.14 `@nextrush/logger` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 60 runtime (re-exports everything from @nextrush/log plus 4 NextRush-specific symbols) + 19-type tuple. Tests 2/2 files pass. -->
- [x] 4.15 `@nextrush/openapi` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 4 runtime + 4-type tuple. Tests 4/4 files pass. -->

## 5. Extensions / streaming

- [x] 5.1 `@nextrush/events` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 7 runtime + 8-type tuple. Tests 2/2 files pass. -->
- [x] 5.2 `@nextrush/websocket` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 9 runtime + 5-type tuple. Tests 2/2 files pass. -->
- [x] 5.3 `@nextrush/stream` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 9 runtime + 8-type tuple. Tests 2/2 files pass. -->

## 6. Deprecated shims (still published — surface must be locked before T053 can remove them safely)

- [x] 6.1 `@nextrush/controllers` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 41 runtime (re-exports from @nextrush/class + @nextrush/di) + 17-type tuple. FINDING: this package's own package.json "test" script is a no-op ("Tests moved to @nextrush/class") - my new test file passes 2/2 when run directly via `vitest run`, but `pnpm test` for this package will NOT execute it. Flagging for T053's own scope (or a follow-up) to wire this test into an actual test run before shim removal, rather than silently overriding the package's existing test-script convention here. -->
- [x] 6.2 `@nextrush/decorators` — read `src/index.ts`, write `public-surface.test.ts`  <!-- 51 runtime (re-exports from @nextrush/class) + 34-type tuple. Same FINDING as 6.1: package.json "test" script is the same no-op placeholder; new test passes 2/2 when run directly, not wired into `pnpm test`. -->


## 7. Tooling / meta

- [ ] 7.1 `@nextrush/dev` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 7.2 `@nextrush/testing` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 7.3 `create-nextrush` — read `src/index.ts` (or its actual entry point — this package may not follow the barrel convention; confirm), write `public-surface.test.ts`
- [ ] 7.4 `nextrush` (meta package) — read `src/index.ts`, write `public-surface.test.ts`

## 8. Verify and close out

- [ ] 8.1 VERIFY: `pnpm test` green across all 33 newly-tested packages
- [ ] 8.2 VERIFY: for a sample of 3 packages spanning different export shapes (runtime-heavy, type-heavy, hybrid), confirm the test actually fails when a throwaway export is added, then remove the throwaway — proving the lock is real, not a vacuous pass
- [ ] 8.3 VERIFY: `pnpm typecheck` and `pnpm lint` clean on every new test file
- [ ] 8.4 Log any discovered "surface smell" (an export that looks like a leaked internal) as a Finding in this section — package name + export name — without modifying the export itself
- [ ] 8.5 Update `docs/audits/03-gap-checklist.md`'s T005 entry: ◐ → ☑, with a "Verified:" note citing all 35 packages now covered (2 pre-existing + 33 from this change), and update the Progress Dashboard/Dependency Graph accordingly (T005 → T053 leg now clear)
- [ ] 8.6 Add a changeset if any package's `package.json`/build config needed a `vitest`/`expectTypeOf` devDependency addition (expected to be none, per the design's assumption that vitest is already present everywhere `pnpm test` runs — confirm, don't assume)
