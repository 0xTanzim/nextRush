# Adapters — Next.js 16 Real-Server Integration

| Field | Value |
| --- | --- |
| **Report type** | Feature / integration proof |
| **Scope** | `packages/adapters/conformance/deploy-verification/nextjs-app-16`, `@nextrush/router` (`allowedMethods`) |
| **Date** | 2026-10-29 |
| **Change** | `openspec/changes/nextjs-16-real-server-integration` |
| **Branch** | `feat/nextjs-16-real-server-integration` (base `3ea38fc5`) |
| **Status** | Final |

## 1. Summary

The Next.js 16 fixture now proves the App Router adapter over a real production server:
`next build` → `next start` → HTTP requests. A conference-room CRUD API exercises routing,
dynamic params, JSON body parsing, 404/405, OPTIONS, HEAD, and sequential state. The suite
found one real framework defect — `allowedMethods()` rewrote a handler's own 404 into 405 —
which was fixed in `@nextrush/router` with package-level regression tests. Everything else
was correct as designed.

Final state: 15/15 real-server assertions pass from a clean build; router 462/462,
adapter-nextjs 44/44 (97.18% line coverage), conformance 984/984, Bun/Deno/workerd runners
all green; typecheck, lint, and `openspec validate --strict` clean.

No public API, dependency contract, or unrelated adapter changed.

## 2. Planning inspection and pre-change baseline

Planning searched `/tmp` first (only prior-session drafts: `draft-proposal.md`,
`onerror-probe.ts`, archive notes) and `/playground` second (empty). No existing Next.js 16
reproduction was found, and nothing in either path was modified or deleted. Recorded in
`design.md` §Context.

With the fixture unchanged, the pre-change surface was captured over a real server:

| Request | Status | Body / headers |
| --- | --- | --- |
| `GET /api/hello` | 200 | JSON hello payload |
| `GET /destructured/hello` | 200 | same payload via destructured exports |
| `HEAD /api/hello` | 200 | `content-length: 28`, empty body |
| `OPTIONS /api/hello` | 404 | `{"error":"Not Found"}` |
| `POST /api/hello` | 404 | `{"error":"Not Found"}` |

A dev-only `[nextrush/edge] A different Application booted…` warning appears in the log;
production logging stays silent. That baseline is unchanged by this work.

## 3. What was added

- `nextjs-app-16/lib/rooms.ts` — seeded Atlas/Orion records, CRUD helpers keyed by
  `crypto.randomUUID()`. Header comment states the array is process-local test storage.
- `nextjs-app-16/lib/validate.ts` — dependency-free `validateRoomInput` /
  `validateRoomPatch`, discriminated result, never throws.
- `nextjs-app-16/app/api/rooms/[[...route]]/route.ts` — one `createApp()` with
  `bodyParser({ onUnsupportedContentType: 'reject' })`, a rooms router mounted at `/api`, all
  seven methods exported from one `handle(app)`. One catch-all module on purpose: Next compiles
  each route file as its own bundle, so splitting would create separate stores per route.
- `nextjs-app-16/test/integration.test.mjs` — `node:test` harness: free loopback port,
  `next start`, readiness poll, captured stderr, SIGTERM teardown, readable diagnostics for a
  missing build or a port that never answers.
- `package.json` — `test:integration` script and a `@nextrush/body-parser` `workspace:*`
  dependency (the fixture's isolated `node_modules` did not hoist it). This is the only
  dependency/lockfile change; `pnpm-lock.yaml` follows.
- Deploy-verification README and the certification matrix notes now report in-process,
  build-only, and real-server results separately.

## 4. Observed vs expected — RED evidence

First run of `pnpm --filter nextjs-app-16 test:integration`: 12 pass, 3 fail.

| Case | Observed | Expected |
| --- | --- | --- |
| `GET /api/rooms/<unknown>` | **405** `{"error":"Method Not Allowed"}`, `allow: GET, HEAD, PUT, PATCH, DELETE` | 404 |
| `GET /api/rooms/<deleted>` (sequential test) | **405** | 404 |
| `HEAD /api/rooms` content-length | `null` via `fetch` | GET's content-length |

The HEAD case was a test-expectation error: GET streams chunked (no `Content-Length`), while
HEAD advertises the body length. A curl probe confirmed `content-length: 88` on the HEAD wire
response; the test now compares HEAD's length to the byte length of the GET body it just read.
The 405 cases were reproduced identically on unknown-id PUT/PATCH/DELETE and POST to
`/api/rooms/:id`.

## 5. Finding F-01 — `allowedMethods()` rewrites a handler's 404 into 405 · P1

- **Current situation:** `createAllowedMethodsMiddleware` ran after the router and treated
  every `ctx.status === 404` as a method miss. A matched handler that answered 404 without a
  body (unknown resource id) was rewritten to 405, even though `Allow` contained the request
  method — a self-contradictory response. Evidence: `packages/router/src/dispatch.ts:140`
  (the 404 check) and the unconditional rewrite that followed.
- **Impact:** RFC 9110 §15.5.6 violation on real servers. Any handler using the common
  "set 404 and return" idiom is reported as 405 whenever `allowedMethods()` is installed.
- **Benefits of the old code:** a single status check kept the middleware simple and made the
  "miss → 405" path cheap (one tree walk, no match metadata retained).
- **Drawbacks:** it cannot distinguish "no route matched" from "route matched, resource
  missing", so it overrides a correct answer.
- **Long-term risk:** every framework-level consumer of `allowedMethods()` (Node, Bun, Deno,
  Edge, serverless) inherits the wrong status; application code would have to work around it
  by always writing a body.
- **Recommendation:** only rewrite when the request method is absent from the path's `Allow`
  set; otherwise leave the handler's 404 untouched.
- **Trade-offs:** a handler that intentionally wants 405 with an `Allow` header for an
  allowed method must now send it explicitly. That is the correct semantics; no public API
  changes.
- **Priority:** P1 — wire-visible contract bug with a one-line fix.
- **Migration difficulty:** Trivial. Behavior only changes for handler-produced 404s on
  paths that register the request method.

The documented contract already said "known path hit with an **unregistered** method"
(`packages/router/src/router.ts:346`; `openspec/specs/router/spec.md:428`), so the code was
brought in line with the spec rather than the spec being changed.

## 6. Fix and regression proof

- **Layer:** `@nextrush/router` (dispatch), not the fixture.
- **Fix:** `packages/router/src/dispatch.ts:150` — `if (allowed.includes(ctx.method)) return;`
  before the OPTIONS/405 rewriting, with the doc comment updated to state that a matched
  handler's 404 stands.
- **RED:** two new package-level tests in `allowed-methods.test.ts` failed first — a matched
  GET handler's 404 came back 405, and a registered OPTIONS handler's 404 came back 200.
- **GREEN:** same file 10/10; full router suite 462/462.
- **Fixture:** after rebuilding the router `dist` (the fixture resolves workspace packages
  through their built `dist`), the real-server matrix went 15/15.
- **Cross-runtime:** Bun 74/74, Deno 74/74, workerd 16/16, conformance 984/984.

No defect belonged to Next.js itself. The remaining `deploy-verification` fixtures
(`nextjs-app-14`, `nextjs-app-15`) are build-only and are now described as such.

## 7. Verification commands and results

| Command | Result |
| --- | --- |
| `pnpm --filter "nextjs-app-16^..." build` | dependencies build |
| `pnpm --filter nextjs-app-16 test:integration` (clean `.next`) | build OK, **15/15 pass** |
| `pnpm --filter @nextrush/router test` | 462/462 |
| `pnpm --filter @nextrush/adapter-nextjs exec vitest run --coverage` | 44/44; lines 97.18%, statements 96.51%, branches 91.42%, functions 96% |
| `pnpm --filter @nextrush/adapter-conformance cert:matrix` | 984/984, matrix snapshot regenerated |
| `bun test` (bun-runner) | 74 pass, 70/70 recorded scenarios satisfied |
| `deno task conformance` (deno-runner) | 74 pass |
| `node --test conformance.workerd.test.mjs` | 16 pass |
| `pnpm --filter @nextrush/router typecheck` / `lint` | clean, 0 warnings |
| `pnpm --filter @nextrush/adapter-conformance typecheck` / `lint` | clean, 0 warnings |
| `openspec validate nextjs-16-real-server-integration --strict` | valid |

## 8. Remaining issues and limitations

- The harness exists for Next.js 16 only; 14/15 are build-only and are labeled that way.
  Extending the harness is a separate follow-up change.
- `test:integration` is a script, not yet a per-PR CI gate (deliberately out of scope).
- The room store is per-process and not durable; the sequential test depends on a single
  route module serving every request.
- The fixture consumes built workspace `dist`, so `test:integration` alone cannot detect
  stale dependency builds. The README now documents building `nextjs-app-16^...` first.
- Dependency addition disclosed in §3 (`@nextrush/body-parser` workspace link + lockfile).

## 9. Git status at hand-off

Modified: `docs/runtime-certification-matrix.md`, `packages/router/src/dispatch.ts`,
`packages/router/src/__tests__/allowed-methods.test.ts`,
`packages/adapters/conformance/src/certification.ts`,
`packages/adapters/conformance/deploy-verification/README.md`,
`packages/adapters/conformance/deploy-verification/nextjs-app-16/package.json`,
`pnpm-lock.yaml`.
Added: `openspec/changes/nextjs-16-real-server-integration/`,
`nextjs-app-16/app/api/rooms/`, `nextjs-app-16/lib/`, `nextjs-app-16/test/`.
Pre-existing and untouched: `.gitignore`, `skills-lock.json`. No commit was made.

## 10. Conclusion

The App Router bridge is proven over a real Next.js 16 production server, and the proof
produced one genuine framework fix at the correct layer. The router now honors a handler's
decisions while still converting true method misses into 405/OPTIONS with `Allow`.
