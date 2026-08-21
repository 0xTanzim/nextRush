## 1. Workspace & Governance Setup

- [x] 1.1 Add `packages/interop/*` to `pnpm-workspace.yaml` and verify `pnpm --filter @nextrush/express-bridge` resolves the package workspace path
- [x] 1.2 Create `packages/interop/express-bridge/package.json` with `@nextrush/types`, `@nextrush/errors`, `@nextrush/runtime` as deps (no `express`, no `@nextrush/core` runtime import) and verify `pnpm install` completes
- [x] 1.3 Create the interop package scaffold (`src/`, `src/__tests__/`, tsconfig) and verify `pnpm --filter @nextrush/express-bridge typecheck` passes on an empty barrel
- [x] 1.4 Add `Public — interop` tier ADR (ADR-002x) referencing ADR-0005 by amendment and verify the ADR file is present and dated with RFC-035

## 2. P0 — Compatibility Surface Report

- [x] 2.1 Produce `docs/RFC/ecosystem-interop/035-compatibility-surface-report.md` covering ~20 packages (required req/res APIs, lifecycle, stream/abort/body, native-overlap, proposed level) and verify every package in the RFC §8.8 research set has a row
- [x] 2.2 Label native-overlap rows (`cors`/`helmet`/`cookie-parser`/`compression`/`body-parser`/`multer`/`rate-limit`/`csurf`/`serve-static`) as native-preferred and verify none is listed `Full`
- [x] 2.3 Record `on-headers` as a surface fixture (not a `Full` middleware cell) and verify the report does not claim `compat(onHeaders)` as a package-level capability
- [x] 2.4 Reduce or confirm the §8.4 candidate overlay based on the report and verify any overlay change is reflected in `surface.ts` decisions (no production `compat()` implementation yet)

## 3. P1 — Continuation State Machine (RED → GREEN)

- [x] 3.1 Write failing tests for every §8.6 continuation-table row (next(), next(err), terminal, thenable hang, callback-style, double-next, response-then-next) and verify they fail for the right reason (missing `continuation.ts`)
- [x] 3.2 Implement `src/continuation.ts` state machine (`idle`/`continued`/`terminated`/`error`/`protocolError`, `expressNext` order) and verify the continuation unit tests pass
- [x] 3.3 Add a `setImmediate`-next fixture and a resolved-then-I/O fixture and verify neither is classified as a thenable hang
- [x] 3.4 Add `next(); next('route')` and `next(); next(err)` cases and verify they warn+no-op without double-settling the outer promise

## 4. P1 — Gate & Four-Bucket Proxy (RED → GREEN)

- [x] 4.1 Write failing tests for the `ctx.raw` duck-type gate (Node-shaped pass, Web-shaped throw) and verify they fail before `gate.ts` exists
- [x] 4.2 Implement `src/gate.ts` (`assertNodeShapedRaw`; no `ctx.runtime` read) and verify gate tests pass
- [x] 4.3 Write failing tests for the four-bucket get/set/`has`/`ownKeys`/`defineProperty`/`getPrototypeOf` algorithm and verify they fail before the Proxy exists
- [x] 4.4 Implement `src/request-proxy.ts` + `src/response-proxy.ts` + `src/surface.ts` (overlay / known-unsupported / Node pass-through / ad-hoc state) and verify proxy tests pass
- [x] 4.5 Add pass-through assertions for `req.socket`, `req.pipe`, `res.on`, `res.write` (not trapped as unsupported) and verify they pass
- [x] 4.6 Add chainable-overlay assertion `res.status(201).json({ ok: true })` sets `ctx.status === 201` and `ctx.responded` and verify it passes

## 5. P1 — Security: State, Proto, Header, Cookie (RED → GREEN)

- [x] 5.1 Write failing state tests for `req.user ↔ ctx.state.user`, last-write-wins collision, and `res.locals` null-prototype and verify they fail before state projection exists
- [x] 5.2 Implement ad-hoc state projection with the frozen denylist (`__proto__`/`prototype`/`constructor`) via `Object.defineProperty` and verify `req['__proto__'] = { polluted: true }` leaves `({}).polluted === undefined`
- [x] 5.3 Add `Object.setPrototypeOf`/`Object.defineProperty` prototype-mutation tests on both req and res and verify the real Node objects are never re-prototyped
- [x] 5.4 Write failing header-safety tests for `res.setHeader` CRLF and the captured-`origWriteHead` assert-wrap and verify they fail before implementation
- [x] 5.5 Implement the `writeHead` captured-`origWriteHead` algorithm and the `onHeaders(res, …); res.end()` fixture and verify the listener fires once, no stack overflow, CRLF still throws
- [x] 5.6 Write failing cookie tests (`maxAge: 1000` → `Max-Age=1`, Express defaults, `signed: true` trap, always string-form `Set-Cookie`) and verify they fail before the serializer exists
- [x] 5.7 Implement `src/cookie-serialize.ts` (no `cookie` npm dep) and verify cookie tests pass

## 6. P2 — Seal `compat()` Public Surface (RED → GREEN)

- [x] 6.1 Write failing arity/array/non-function tests for `compat()` (3-arity accepted, ≥4 throws, array throws, non-function throws) and verify they fail before `compat.ts` exists
- [x] 6.2 Implement `src/compat.ts` and `src/index.ts` (public barrel: `compat` + four error classes + type-only exports) and verify arity tests pass
- [x] 6.3 Implement the four `NextRushError` subclasses in `src/errors.ts` (`expose: false`, stable codes, WHAT/WHY/HOW) and verify an unsupported-API read throws with actionable text, not a raw `TypeError`
- [x] 6.4 Add `src/__tests__/public-surface.test.ts` locking runtime keys (`compat` + four errors) and type-only exports and verify the surface matches §8.1

## 7. P2 — Real-Package & Integration Tests (RED → GREEN)

- [x] 7.1 Add pinned devDeps (`morgan`, `passport`, `passport-jwt` or a session-less strategy, `on-headers` as fixture) and verify they install
- [x] 7.2 Write a real-package `morgan` test (`app.use(compat(morgan('tiny')))` on adapter-node) and verify the request log path works end-to-end
- [x] 7.3 Write a real-package `passport.initialize()` + session-less strategy test and verify `req.user` is visible as `ctx.state.user` downstream
- [x] 7.4 Write an Edge-shaped `ctx.raw` refusal integration test and verify `compat(morgan())` throws `ExpressBridgeCapabilityError`
- [x] 7.5 Add a registry-lock test asserting no `Full` middleware cell lacks a corresponding integration test file and `on-headers` is not `Full`

## 8. P2 — Unused-Path & Workspace Edge Gate (RED → GREEN)

- [x] 8.1 Write a failing `src/__tests__/import-graph.test.ts` that reads workspace `package.json` dependency edges (core/router/types/runtime/adapters/`nextrush` must not list `@nextrush/express-bridge`) and verify it fails if an edge exists
- [x] 8.2 Verify `@nextrush/express-bridge` is absent from the `nextrush` meta-package dependencies and the import-graph test is green

## 9. P3 — Benchmarks & Allocation Verification

- [x] 9.1 Add `apps/benchmark/scripts/alloc/native-hello-alloc.js` (same method as existing alloc harnesses) measuring native hello-world without importing the bridge and verify it runs
- [x] 9.2 Add A/B/C benchmark servers (native / bridged `morgan` / native Express + `morgan`) and verify they build and start
- [x] 9.3 Run `check-alloc-regression.js --harness native-hello-alloc --tolerance 0` and verify delta `=== 0`; capture the measured bridged-path p50/p99 delta vs native and vs Express in the report
- [x] 9.4 Confirm `REGRESSION_TOLERANCE` 0.1 RPS remains green as a sanity signal (not the unused-path oracle) and record the result

## 10. P3 — Docs, OpenSpec Spec & Final Gates

- [x] 10.1 Write `packages/interop/express-bridge/README.md` from `docs/templates/package-readme.template.md` (native-first examples; limitations including callback-style hang and Node-only) and verify the template done-checklist passes
- [x] 10.2 Write `packages/interop/express-bridge/ARCHITECTURE.md` from `docs/templates/package-architecture.template.md` (sequence + state diagrams from RFC-035) and verify the template done-checklist passes
- [x] 10.3 Add docs-site reference page `apps/website/content/docs/reference/(interop)/express-bridge.mdx`, guide `guides/api-development/express-middleware.mdx`, and cross-link `migrate/from-express.mdx` and verify they render
- [x] 10.4 Write `openspec/specs/ecosystem-interop/spec.md` from this change's delta (Purpose + ADDED requirements) and verify it matches the delta after archive
- [x] 10.5 Verify per-package coverage ≥90% lines/functions, ESLint clean, and `tsc` strict clean for `@nextrush/express-bridge` and fix any gaps
- [x] 10.6 Update RFC-035 status to `Shipped` in `docs/RFC/ecosystem-interop/035-express-bridge.md` and `docs/RFC/INDEX.md` and verify the two agree
