# Security Remediation Index — `harden-security-boundaries`

Traceability from every finding in `report/security-review.md` to its OpenSpec requirement, its
governing RFC/ADR (where applicable), its task-list location, its workstream/worktree, and its
verification status. Updated by every workstream as it lands; task 9.7 asserts this table is
complete before the change closes — a finding with any column unresolved blocks closure.

Legend: **Task status** — ⬜ not started · 🔄 in progress · ✅ verified (test green, independently
checked) · N/A (documentation-only finding, no test applies).

| Finding | Severity | Spec requirement | RFC / ADR | Task group | Workstream / worktree | Task status |
| ------- | -------- | ----------------- | --------- | ----------- | ---------------------- | ------------ |
| SEC-01 client IP spoofing via leftmost XFF | P1 | `node-adapter` ADDED "Proxy trust is expressed as a hop count or a trusted-peer list"; `node-adapter` MODIFIED "`ctx.ip` resolution…"; `web-adapters` MODIFIED (both); `security-boundaries` "Rate limiting derives its key from the trusted client IP" | RFC-030 / ADR-0018 | §4 (WS-B), 4.1–4.14 | WS-B / `wt-B-proxy-trust` | ⬜ |
| SEC-02 case-fold path-prefix authorization bypass | P1 | `router` ADDED "A single canonicalization function…"; `router` MODIFIED "Case-normalization is fast-pathed…" | RFC-029 / ADR-0017 | §3 (WS-A), 3.1, 3.3, 3.8, 3.10 | WS-A / `wt-A-canonical-path` | ⬜ |
| SEC-03 CSRF default `Max-Age=0` deletes token cookie | P2 | `security-boundaries` "CSRF token cookies persist as documented" | — (no RFC required; correctness fix) | §5 (WS-C), 5.1–5.3 | WS-C / `wt-C-csrf` | ⬜ |
| SEC-04 CSRF origin check off by default / trusts Host | P2 | `security-boundaries` "CSRF origin validation is on by default…" | — | §5 (WS-C), 5.4–5.5 | WS-C / `wt-C-csrf` | ⬜ |
| SEC-05 CSRF tokens not session-bound by default | P2 | `security-boundaries` "CSRF session binding is an explicit decision" | — | §5 (WS-C), 5.6 | WS-C / `wt-C-csrf` | ⬜ |
| SEC-06 hardcoded HMAC blinding key, no key cache | P2 | `security-boundaries` "Constant-time comparison uses an unpredictable per-process key…" | — | §5 (WS-C), 5.7–5.8 | WS-C / `wt-C-csrf` | ⬜ |
| SEC-07 signed cookies bind value, not name | P2 | `security-boundaries` "Signed artifacts bind their signature to their context" | RFC-031 / ADR-0019 | §6 (WS-D), 6.1–6.5 | WS-D / `wt-D-cookies` | ⬜ |
| SEC-08 cookie defaults omit `Secure` | P2 | `security-boundaries` "Cookies default to Secure outside plaintext loopback" | — | §6 (WS-D), 6.6–6.7 | WS-D / `wt-D-cookies` | ⬜ |
| SEC-09 no dot-segment normalization | P2 | `router` ADDED "Dot segments in a request path are rejected, not resolved" | RFC-029 / ADR-0017 | §3 (WS-A), 3.2, 3.5, 3.11 | WS-A / `wt-A-canonical-path` | ⬜ |
| SEC-10 CORS echoes `Access-Control-Request-Headers` | P2 | `security-boundaries` "CORS intersects requested headers against an allowlist" | — | §7 (WS-E), 7.1–7.2 | WS-E / `wt-E-response` | ✅ |
| SEC-11 static serves SVG/HTML inline (stored XSS) | P2 | `security-boundaries` "Static serving can neutralize untrusted content" | — | §7 (WS-E), 7.3–7.4 | WS-E / `wt-E-response` | ✅ |
| SEC-12 `assertHeaderSafe()` validates only CR/LF | P3 | `runtime-adapter-contract` ADDED "Header writes are validated against the full HTTP field grammar" | — | §7 (WS-E), 7.5, 7.11 | WS-E / `wt-E-response` | 🔄 (7.5 ✅ verified; 7.11 cross-adapter parity deferred — see WS-E decisions log) |
| SEC-13 static file TOCTOU (lstat → open race) | P3 | `security-boundaries` "Static file reads are not vulnerable to a symlink swap" | — | §7 (WS-E), 7.6–7.7 | WS-E / `wt-E-response` | ✅ |
| SEC-14 `includeStack` has no production guard | P3 | `security-boundaries` "Stack traces are never emitted in production" | — | §7 (WS-E), 7.8 | WS-E / `wt-E-response` | ✅ |
| SEC-15 CSRF `excludePaths` `/*` matches unlimited depth | P3 | `router` ADDED "…prefix and mount matching…"; `security-boundaries` "Path-based security exemptions match canonical paths with exact wildcard depth" | RFC-029 / ADR-0017 | §5 (WS-C), 5.9 | WS-C / `wt-C-csrf` (depends on WS-A §3.4) | ⬜ |
| SEC-16 no session/authentication/JWT primitive | P3 | Proposal position; not a spec requirement (documentation deliverable) | RFC-032 / ADR-0020 | §8 (WS-F), 8.6 | WS-F / `wt-F-enforcement` | N/A (docs) |
| SEC-17 compression BREACH-class surface, no guidance | P3 | `security-boundaries` (documented in the CORS/static/compression cross-cutting text; `no-transform` handling) | — | §7 (WS-E), 7.9 | WS-E / `wt-E-response` | ✅ |
| SEC-18 partial public-suffix list for cookie `Domain` | P4 | `security-boundaries` cookies section (`publicSuffixList` injection point) | — | §6 (WS-D), 6.8 | WS-D / `wt-D-cookies` | ⬜ |
| SEC-19 CSRF token accepted from query string | P4 | `security-boundaries` "The CSRF token extractor does not read the query string" | — | §5 (WS-C), 5.10 | WS-C / `wt-C-csrf` | ⬜ |

## Cross-cutting deliverables (not tied to one finding)

| Deliverable | Spec requirement | Task | Workstream |
| ----------- | ----------------- | ---- | ----------- |
| Fail-closed as a stated rule (governs SEC-04's three branches as one violation, not three) | `security-boundaries` "Security decisions fail closed" | §5 (subsumed by 5.4–5.5) | WS-C |
| Boot-time production security audit | `security-boundaries` "Production configuration is audited at boot" | §8.1–8.2 | WS-F |
| `security()` composite preset | `security-boundaries` "A composite security preset exists" | §8.3 | WS-F |
| Fuzz-hardened parsers (`parseCookies`, `parseUrlEncoded`/`setNestedValue`, `parseRange`, `extractBoundary`) | `security-boundaries` "Security-relevant parsers are fuzz-hardened" | §8.4 | WS-F |
| Raw-socket malformed-request suite | `security-boundaries` "Malformed HTTP requests are covered by a raw-socket suite" | §8.5 | WS-F |
| Cross-adapter security-parity conformance tier | `runtime-adapter-contract` MODIFIED "Observable parity across adapters" | §8.8 | WS-F |

## WS-E decisions log

Recorded 2026-07-27, worktree `wt-E-response` (branch `wt-E-response`). This workstream resumed
substantial, real, uncommitted progress left by a prior interrupted session — the notes below cover
both what was found already-correct and what was completed/fixed in this pass.

### RFC-vs-tasks.md conflicts resolved

None found. `docs/RFC/` has no RFC gating §7's scope (SEC-10/11/12/13/14/17 are all documented in
the remediation index as "—" for RFC/ADR, i.e. correctness fixes, not architectural changes
requiring a design doc) — tasks.md §7 was followed as the sole source of truth with no conflicting
prose to reconcile.

### Test assumptions found and fixed instead of the implementation

- **7.10 extensionless-file edge case**: the first draft of this test asserted that an
  `untrusted: true` extensionless file would *not* be downgraded to
  `application/octet-stream` for `Content-Type`. This was a wrong assumption about the test, not a
  bug in the implementation — `getMimeType()` already falls back to `application/octet-stream` for
  any unrecognized/absent extension **independent of `untrusted`**, so the type coincidentally
  matches either way. The test was rewritten to assert the two facts that are actually
  distinguishing: `Content-Disposition`/CSP apply unconditionally under `untrusted`, and
  `isScriptCapable()` — the extension-gated part of the neutralization — never matches an
  extensionless path. No implementation change was needed once the assumption was corrected.
- **7.10 stream-timeout edge case**: a first draft of this test expected `sendFile()` to swallow the
  `streamToResponse()` timeout rejection and let the middleware resolve normally after setting a
  504 status. Running it RED-first showed the rejection actually propagates out of
  `sendFile()`/the middleware `await` chain uncaught (a genuine, if narrow, pre-existing behavior:
  `sendFile()` never wraps `streamToResponse()`'s promise in a try/catch). The test was corrected to
  assert the real behavior (`await expect(middleware(...)).rejects.toThrow('Stream timeout')`, then
  check the status was still set to 504 before the throw) rather than changing the implementation to
  match a wrong assumption — this narrow behavior (an uncaught rejection on stream timeout) is noted
  as a pre-existing gap below, not fixed, since silently swallowing a timeout rejection is itself a
  design decision (should the caller see it or not?) outside this task's SEC-10–17 scope to decide
  unilaterally.

### Pre-existing gaps found, not introduced by this workstream

- **`packages/adapters/conformance` has no `securityScenario()` helper.** Task 2.1 (a shared
  prerequisite meant to land before any workstream starts) does not exist in this worktree. 7.11
  ("cross-adapter conformance scenarios asserting every rejected header write throws the same typed
  error on all four adapters") cannot be built without either constructing that harness from scratch
  (task 2.1's scope, not WS-E's — and a "worktree per workstream, no shared working directory" setup
  gives no path to pull in another workstream's landed 2.1 commit mid-task) or writing a
  parallel, throwaway harness that would conflict with 2.1 once it lands. Deferred; logged in
  tasks.md 7.11 and left for WS-F (§8.8 builds the `security-boundaries` conformance tier) to
  reconcile once 2.1 exists on the integration branch.
- **`assertHeaderSafe()`'s RFC 9110 grammar enforcement is wired into exactly one of four adapters'
  header-setting paths.** It is called from `@nextrush/runtime`'s `WebResponseBuilder.set()` (the
  Web-standard-response path used by non-Node adapters — Bun/Deno/Edge). The Node adapter's own
  `ctx.set()` implementation lives in `packages/adapters/node` (outside this workstream's declared
  package list: `packages/errors`, `packages/middleware/{cors,static,compression}`,
  `packages/runtime` scoped to `response-builder.ts`, `packages/adapters/conformance`) and was not
  independently verified in this pass to route header writes through the same guard. This means the
  claim "every rejected header write throws the same typed error on all four adapters" (7.11's exact
  wording) cannot be asserted true today even once a `securityScenario()` harness exists — it needs
  a check (and likely a fix) in `packages/adapters/node`, which is genuinely outside WS-E's scope.
  Flagging for whichever workstream (WS-F, or a dedicated follow-up) owns `adapters/node`.
- **`packages/middleware/cors`'s `presets.ts` (29% line coverage), `security.ts` (73%), and
  `validation.ts` (84%) are substantially under the 90%/85% coverage gate**, and `presets.ts`/
  `security.ts` each carry one pre-existing ESLint error (`no-unnecessary-condition` on an optional
  chain against a non-nullish value). Confirmed via `git diff --stat` that all three files have
  **zero diff** from this workstream — this predates `harden-security-boundaries` entirely. The five
  exported preset functions (`simpleCors`, `strictCors`, `devCors`, `internalCors`,
  `staticAssetsCors`) and most of `security.ts`'s origin/ReDoS logic have no direct unit tests, only
  incidental exercise through `cors()` integration tests. This is out of SEC-10–17's declared scope
  to backfill wholesale; the small, directly-adjacent gap in `headers.ts` (the file this workstream
  did touch) was closed instead (`__tests__/headers.test.ts`, new).
- **`packages/middleware/compression`'s `compressor.ts` (71%), `content-type.ts` (82%),
  `negotiation.ts` (87%), and most of `middleware.ts` (67–87%, outside the new SEC-17 code) are
  substantially under the 90%/85% coverage gate**, with 24 pre-existing ESLint errors across
  `compressor.ts`/`content-type.ts`/`middleware.ts`/`negotiation.ts`. Confirmed via `git diff --stat`
  that `compressor.ts`, `content-type.ts`, and `negotiation.ts` have **zero diff** from this
  workstream, and the specific lines flagged in `middleware.ts` fall outside this workstream's
  hunks (verified against `git diff -U0` hunk ranges). The new `shouldCompressResponse()`/
  `hasNoTransformDirective()` code added for SEC-17 is itself 100% covered and lint-clean. Same
  disposition as the `cors` gap above: pre-existing, out of this task's scope, logged rather than
  silently expanded into.
- **`packages/middleware/static`'s `send-file.ts`'s `sendFile()` never catches
  `streamToResponse()`'s rejection** (see the timeout test-assumption note above) — an uncaught
  rejection on a stream error/timeout propagates out of the middleware call rather than being
  reported through `ctx`. This is pre-existing (the `try/finally` this workstream added around the
  file-descriptor lifecycle wraps the *handle*, not a `.catch()` around `streamToResponse()`'s own
  promise) and orthogonal to SEC-13's TOCTOU fix; noted here rather than changed, since altering
  error-propagation semantics on this path is a behavior decision beyond "close the TOCTOU window."
- **Two pre-existing lint findings became newly in-scope because this workstream restructured the
  surrounding code**, and were fixed as part of this pass rather than left: `send-file.ts`'s
  `ctx.headers['range']` (→ `ctx.headers.range`) and three `${numberValue}` template-literal
  interpolations in the rewritten `Content-Range` header construction (→ wrapped in `String(...)`),
  plus one `?:` → `??` simplification in `cors/src/middleware.ts`'s new `headersToAllow` line. All
  other pre-existing lint findings in files this workstream touched but did not restructure (e.g.
  `send-file.ts`'s pre-existing `max-age=${options.maxAge}`, `utils.ts`'s `generateETag()`) were
  left as-is — confirmed via `git diff -U0` hunk boundaries that they fall outside this workstream's
  edits.
- **This worktree's `tasks.md` and `security-review-remediation-index.md` show WS-A/WS-B/WS-C/WS-D's
  sections as entirely unstarted** (`[ ]`, `⬜`), even though the task brief describing this session
  states those workstreams already completed and documented their own deferrals "in this same
  tasks.md file." Each workstream operates in an isolated git worktree with its own working-tree
  copy of these files (per `loop-engineering.md`'s isolation rule, cross-referenced in the
  remediation index's own Worktree registry section) — this worktree was never synced with any other
  workstream's landed commits, so their sections are exactly as they were when all six worktrees were
  created off the same base commit (`b3b7805`). This is not a WS-E defect; it means the "mirror
  WS-A/WS-B's deferral pattern" instruction could not be followed literally (no example was visible
  to mirror), so this log's own structure and tasks.md's own inline deferral notes were authored
  fresh, following the general documentation conventions already present elsewhere in these two
  files. Whoever performs the eventual multi-branch merge/integration (§9's verification and closure
  group) will need to reconcile six independently-edited copies of both files.



Created 2026-07-27 off `security/audit-review` @ `b3b7805`. Local paths live under
`.worktrees/` (gitignored). No two workstreams share a working directory
(`.kiro/steering/loop-engineering.md` isolation rule).

| Workstream | Branch | Worktree path | Owns | Depends on | Status |
| ---------- | ------ | ------------- | ---- | ---------- | ------ |
| WS-A | `wt-A-canonical-path` | `.worktrees/wt-A-canonical-path` | `packages/router/src/{matching,state,match-route,find-node}.ts`, adapter `context.ts` path getters | RFC-029 approved | created |
| WS-B | `wt-B-proxy-trust` | `.worktrees/wt-B-proxy-trust` | `packages/runtime/src/headers.ts`, adapter `context.ts` IP getters, `packages/middleware/rate-limit/src/utils/key-generator.ts` | RFC-030 approved; **rebases on `wt-A-canonical-path`** (shared adapter `context.ts`) | created |
| WS-C | `wt-C-csrf` | `.worktrees/wt-C-csrf` | `packages/middleware/csrf/src/**` | `wt-A-canonical-path` merged (consumes `canonicalizePath` for §5.9) | created |
| WS-D | `wt-D-cookies` | `.worktrees/wt-D-cookies` | `packages/middleware/cookies/src/**` | RFC-031 approved | created |
| WS-E | `wt-E-response` | `.worktrees/wt-E-response` | `packages/middleware/{cors,static,compression}/src/**`, `packages/runtime/src/response-builder.ts`, `packages/errors/src/middleware.ts` | none — may start immediately | created |
| WS-F | `wt-F-enforcement` | `.worktrees/wt-F-enforcement` | `packages/core/src/application.ts`, `packages/adapters/conformance/src/**`, new preset/fuzz/raw-socket suites, docs | A–E merged; RFC-032 approved | created |

Re-list: `git worktree list`. Remove after merge: `git worktree remove .worktrees/<name>`.
