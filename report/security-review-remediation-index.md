# Security Remediation Index — `harden-security-boundaries`

Traceability from every finding in `report/security-review.md` to its OpenSpec requirement, its
governing RFC/ADR (where applicable), its task-list location, its workstream/worktree, and its
verification status. Updated by every workstream as it lands; task 9.7 asserts this table is
complete before the change closes — a finding with any column unresolved blocks closure.

Legend: **Task status** — ⬜ not started · 🔄 in progress · ✅ verified (test green, independently
checked) · N/A (documentation-only finding, no test applies).

| Finding | Severity | Spec requirement | RFC / ADR | Task group | Workstream / worktree | Task status |
| ------- | -------- | ----------------- | --------- | ----------- | ---------------------- | ------------ |
| SEC-01 client IP spoofing via leftmost XFF | P1 | `node-adapter` ADDED "Proxy trust is expressed as a hop count or a trusted-peer list"; `node-adapter` MODIFIED "`ctx.ip` resolution…"; `web-adapters` MODIFIED (both); `security-boundaries` "Rate limiting derives its key from the trusted client IP" | RFC-030 / ADR-0018 | §4 (WS-B), 4.1–4.14 | WS-B / `wt-B-proxy-trust` | 🔄 (4.1-4.14 done; 4.13's performance-gate CI run and 4.14's standalone docs page deferred to pre-major-release, same as WS-A's own open item) |
| SEC-02 case-fold path-prefix authorization bypass | P1 | `router` ADDED "A single canonicalization function…"; `router` MODIFIED "Case-normalization is fast-pathed…" | RFC-029 / ADR-0017 | §3 (WS-A), 3.1, 3.3, 3.8, 3.10 | WS-A / `wt-A-canonical-path` | 🔄 (3.1-3.12, 3.14-3.15 done; 3.13 performance-gate pending) |
| SEC-03 CSRF default `Max-Age=0` deletes token cookie | P2 | `security-boundaries` "CSRF token cookies persist as documented" | — (no RFC required; correctness fix) | §5 (WS-C), 5.1–5.3 | WS-C / `wt-C-csrf` | ✅ |
| SEC-04 CSRF origin check off by default / trusts Host | P2 | `security-boundaries` "CSRF origin validation is on by default…" | — | §5 (WS-C), 5.4–5.5 | WS-C / `wt-C-csrf` | ✅ |
| SEC-05 CSRF tokens not session-bound by default | P2 | `security-boundaries` "CSRF session binding is an explicit decision" | — | §5 (WS-C), 5.6 | WS-C / `wt-C-csrf` | ✅ |
| SEC-06 hardcoded HMAC blinding key, no key cache | P2 | `security-boundaries` "Constant-time comparison uses an unpredictable per-process key…" | — | §5 (WS-C), 5.7–5.8 | WS-C / `wt-C-csrf` | ✅ |
| SEC-07 signed cookies bind value, not name | P2 | `security-boundaries` "Signed artifacts bind their signature to their context" | RFC-031 / ADR-0019 | §6 (WS-D), 6.1–6.5 | WS-D / `wt-D-cookies` | ✅ |
| SEC-08 cookie defaults omit `Secure` | P2 | `security-boundaries` "Cookies default to Secure outside plaintext loopback" | — | §6 (WS-D), 6.6–6.7 | WS-D / `wt-D-cookies` | ✅ |
| SEC-09 no dot-segment normalization | P2 | `router` ADDED "Dot segments in a request path are rejected, not resolved" | RFC-029 / ADR-0017 | §3 (WS-A), 3.2, 3.5, 3.11 | WS-A / `wt-A-canonical-path` | 🔄 (3.1-3.12, 3.14-3.15 done; 3.13 performance-gate pending) |
| SEC-10 CORS echoes `Access-Control-Request-Headers` | P2 | `security-boundaries` "CORS intersects requested headers against an allowlist" | — | §7 (WS-E), 7.1–7.2 | WS-E / `wt-E-response` | ✅ |
| SEC-11 static serves SVG/HTML inline (stored XSS) | P2 | `security-boundaries` "Static serving can neutralize untrusted content" | — | §7 (WS-E), 7.3–7.4 | WS-E / `wt-E-response` | ✅ |
| SEC-12 `assertHeaderSafe()` validates only CR/LF | P3 | `runtime-adapter-contract` ADDED "Header writes are validated against the full HTTP field grammar" | — | §7 (WS-E), 7.5, 7.11 | WS-E / `wt-E-response` | 🔄 (7.5 ✅ verified; 7.11 cross-adapter parity deferred — see WS-E decisions log) |
| SEC-13 static file TOCTOU (lstat → open race) | P3 | `security-boundaries` "Static file reads are not vulnerable to a symlink swap" | — | §7 (WS-E), 7.6–7.7 | WS-E / `wt-E-response` | ✅ |
| SEC-14 `includeStack` has no production guard | P3 | `security-boundaries` "Stack traces are never emitted in production" | — | §7 (WS-E), 7.8 | WS-E / `wt-E-response` | ✅ |
| SEC-15 CSRF `excludePaths` `/*` matches unlimited depth | P3 | `router` ADDED "…prefix and mount matching…"; `security-boundaries` "Path-based security exemptions match canonical paths with exact wildcard depth" | RFC-029 / ADR-0017 | §5 (WS-C), 5.9 | WS-C / `wt-C-csrf` (depends on WS-A §3.4 — see WS-C decisions log) | 🔄 (wildcard depth logic ✅; canonicalization precondition ⬜, blocked on WS-A merge) |
| SEC-16 no session/authentication/JWT primitive | P3 | Proposal position; not a spec requirement (documentation deliverable) | RFC-032 / ADR-0020 | §8 (WS-F), 8.6 | WS-F / `wt-F-enforcement` | N/A (docs) |
| SEC-17 compression BREACH-class surface, no guidance | P3 | `security-boundaries` (documented in the CORS/static/compression cross-cutting text; `no-transform` handling) | — | §7 (WS-E), 7.9 | WS-E / `wt-E-response` | ✅ |
| SEC-18 partial public-suffix list for cookie `Domain` | P4 | `security-boundaries` cookies section (`publicSuffixList` injection point) | — | §6 (WS-D), 6.8 | WS-D / `wt-D-cookies` | ✅ |
| SEC-19 CSRF token accepted from query string | P4 | `security-boundaries` "The CSRF token extractor does not read the query string" | — | §5 (WS-C), 5.10 | WS-C / `wt-C-csrf` | ✅ |

## Cross-cutting deliverables (not tied to one finding)

| Deliverable | Spec requirement | Task | Workstream |
| ----------- | ----------------- | ---- | ----------- |
| Fail-closed as a stated rule (governs SEC-04's three branches as one violation, not three) | `security-boundaries` "Security decisions fail closed" | §5 (subsumed by 5.4–5.5) | WS-C |
| Boot-time production security audit | `security-boundaries` "Production configuration is audited at boot" | §8.1–8.2 | WS-F |
| `security()` composite preset | `security-boundaries` "A composite security preset exists" | §8.3 | WS-F |
| Fuzz-hardened parsers (`parseCookies`, `parseUrlEncoded`/`setNestedValue`, `parseRange`, `extractBoundary`) | `security-boundaries` "Security-relevant parsers are fuzz-hardened" | §8.4 | WS-F |
| Raw-socket malformed-request suite | `security-boundaries` "Malformed HTTP requests are covered by a raw-socket suite" | §8.5 | WS-F |
| Cross-adapter security-parity conformance tier | `runtime-adapter-contract` MODIFIED "Observable parity across adapters" | §8.8 | WS-F |

## WS-A decisions log (task 3.15, and open items)

- **`caseSensitive` default flip (task 3.15):** Deferred, not flipped, this cycle. `harden-security-boundaries` is not itself a major release lane change — RFC-029 §15 gates the flip specifically to shipping alongside a major bump, and forcing it here would make this security-hardening change also a breaking-default change for every existing route table, which is a separate, larger decision than the P0-P2 fix (canonical path ownership + dot-segment rejection) this workstream exists to land. `caseSensitive: false` remains the default; RFC-029 is already approved for when a future major-lane change wants to flip it (task 3.16 at that time).
- **Task 3.13 (performance-gate):** Not run in this session — the repo's `performance-gate` capability (`.github/workflows/performance-gate.yml`, `openspec/specs/performance-gate/spec.md`) requires the CPU-pinned `apps/benchmark` harness, disproportionate to invoke ad hoc for a single workstream's verification. Code-level review confirms `canonicalizePath()`'s dot-segment scan (`hasDotSegment`) is allocation-free and O(n), consistent with RFC-029 §6a's stated, accepted cost ("one additional linear scan on the routing hot path") — but this is a code-reading check, not a measured benchmark run. **Run the actual `performance-gate` CI workflow before merging WS-A**, per the task's own exit condition.
- **A found, adjacent bug (not part of any tracked SEC-NN finding):** `packages/core/src/route-mount.ts`'s `createPrefixMount` used a raw, case-sensitive `startsWith()` for the mount-prefix boundary — independent of the mounted router's own `caseSensitive` option — so `app.route('/admin', router)` silently 404'd a mixed-case request instead of dispatching through the router's own (permissive-by-default) matching. Fixed as part of task 3.8 by adding an optional `Routable.matchesMountPrefix()` contract (`@nextrush/core`) that `Router` (`@nextrush/router`) implements via its own `canonicalizePath`; a `Routable` with no such method still falls back to the old literal check (backward-compatible for minimal test doubles). Covered by `packages/adapters/conformance/src/security/__tests__/canonical-path-parity.test.ts`.
- **A confirmed real-world manifestation of RFC-029's stated proxy-desync motivation:** cross-adapter conformance testing (task 3.12) found that Bun/Deno/Edge (Fetch-API-based adapters) resolve literal dot segments (`/api/webhooks/../admin` → `/api/admin`) and even *single-encoded* percent-escaped ones (`/api/%2e%2e/admin` → `/admin`) during `new Request()`/`URL` construction — **before** the framework or `canonicalizePath()` ever see the raw target. Node's raw-socket adapter does not do this. This means the SAME raw request target is either rejected (Node, via `canonicalizePath`) or silently resolved to a **different, unintended route** (Bun/Deno/Edge, via the platform's own URL parser) depending on which layer parses it first — empirical confirmation of the exact proxy-desync class RFC-029 §3.2 describes, now observed at the platform layer rather than only the reverse-proxy layer the RFC's prose focuses on. This is a genuine cross-adapter divergence worth a documented, explicit note in RFC-029 (not a defect in this workstream's implementation, and not blocking — Node's real, literal-target behavior is the one `canonicalizePath` is designed to close, and the Fetch adapters' platform-level pre-resolution happens to be traversal-safe by construction, just not identical in status code).

## WS-B decisions log (task 4.2's hop-count formula, and open items)

- **Hop-count formula corrected against `tasks.md` 4.2, not RFC-030's own §8.6 illustrative table:** RFC-030 §8.6's worked example text ("`proxy: 1`, chain has 2 entries, forged leftmost → Second-from-right entry returned") is internally inconsistent with task 4.2's own explicit, executable spec ("`proxy: 1` with `XFF: '203.0.113.9, 10.0.0.5'` resolves `10.0.0.5`" — the rightmost entry, not second-from-right). Implemented against `tasks.md` (the authoritative task spec) rather than the RFC's prose table: `resolveByHopCount` selects index `chain.length - hopCount`, i.e. the `hopCount`-th entry counting from the right. This is also the semantically correct reading — hop count 1 means "the direct peer is the one trusted proxy," and the rightmost `X-Forwarded-For` entry is exactly what that trusted peer itself observed as its own connecting peer.
- **`ProxyTrust` lives in `@nextrush/types`, not `@nextrush/runtime`:** matches RFC-030 §8.1's own snippet placement and the package hierarchy (`core`'s `ApplicationOptions.proxy` field needs the type without `core` importing from `runtime`, which sits above it).
- **`@nextrush/rate-limit`'s own `trustProxy?: boolean` option removed outright, not deprecated:** `defaultKeyGenerator` no longer takes a trust parameter at all — it reads `ctx.ip` unconditionally, since the app-level `proxy` option (set once, centrally) already resolves the correct value before any middleware runs. A dead `trustProxy: true` config that silently did nothing would be a worse trap than a clean removal (RFC-030 §8.2's explicit design: "exactly one source of truth for client IP").
- **Task 4.13 (performance-gate):** Not run this session, same open item as WS-A — the CPU-pinned `apps/benchmark` harness is disproportionate for ad hoc in-session verification. Run the actual `performance-gate` CI workflow before merging WS-B.
- **Task 4.14 (migration guide):** RFC-030 §12 already documents the one-line migration in full; the standalone `apps/docs` page is deferred until this change ships in a major release lane (writing it now would document a version number not yet decided).

## Worktree registry (task 1.7)

Created 2026-07-27 off `security/audit-review` @ `b3b7805`. Local paths live under
`.worktrees/` (gitignored). No two workstreams share a working directory
(`.kiro/steering/loop-engineering.md` isolation rule).

| Workstream | Branch | Worktree path | Owns | Depends on | Status |
| ---------- | ------ | ------------- | ---- | ---------- | ------ |
| WS-A | `wt-A-canonical-path` | `.worktrees/wt-A-canonical-path` | `packages/router/src/{matching,state,match-route,find-node}.ts`, adapter `context.ts` path getters | RFC-029 approved | created |
| WS-B | `wt-B-proxy-trust` | `.worktrees/wt-B-proxy-trust` | `packages/runtime/src/headers.ts`, adapter `context.ts` IP getters, `packages/middleware/rate-limit/src/utils/key-generator.ts` | RFC-030 approved; **rebases on `wt-A-canonical-path`** (shared adapter `context.ts`) | created |
| WS-C | `wt-C-csrf` | `.worktrees/wt-C-csrf` | `packages/middleware/csrf/src/**` | `wt-A-canonical-path` merged (consumes `canonicalizePath` for §5.9) | created |
| WS-D | `wt-D-cookies` | `.worktrees/wt-D-cookies` | `packages/middleware/cookies/src/**` | RFC-031 approved | verified, committed |
| WS-E | `wt-E-response` | `.worktrees/wt-E-response` | `packages/middleware/{cors,static,compression}/src/**`, `packages/runtime/src/response-builder.ts`, `packages/errors/src/middleware.ts` | none — may start immediately | created |
| WS-F | `wt-F-enforcement` | `.worktrees/wt-F-enforcement` | `packages/core/src/application.ts`, `packages/adapters/conformance/src/**`, new preset/fuzz/raw-socket suites, docs | A–E merged; RFC-032 approved | created |

Re-list: `git worktree list`. Remove after merge: `git worktree remove .worktrees/<name>`.

## WS-C decisions log

Recorded during the finish/verify/commit pass on `wt-C-csrf`, scoped to
`packages/middleware/csrf` only (tasks.md §5, tasks 5.1–5.13).

### 1. Remediation index was missing from this worktree — reconstructed from the seed baseline

This file did not exist anywhere in `wt-C-csrf`'s working tree or git history prior to this
pass (`git show HEAD:report/security-review-remediation-index.md` fails on `wt-C-csrf`'s HEAD,
commit `b3b78053`, which predates the `harden-security-boundaries` change entirely — its own
`openspec/changes/harden-security-boundaries/` directory is untracked working-tree content, not
a commit on this branch's ancestry). The full 19-row table above was reconstructed verbatim from
the equivalent file already present in the main repository checkout (task 1.6's seed, per
`design.md` D9) before applying WS-C's own row updates, so this worktree's copy matches the
baseline every other workstream is working from rather than starting a divergent partial index.
Only the SEC-03, SEC-04, SEC-05, SEC-06, SEC-15, and SEC-19 rows were changed by this pass; every
other row is reproduced unchanged from the seed.

### 2. The reported `vitest run` discovery anomaly did not reproduce — documented as a false alarm, not fixed

The task brief described `vitest run` (no args) in this package reporting only 3 test files /
167 tests while silently omitting `csrf-hardening.test.ts` (34 tests) from the aggregate, despite
that file passing 34/34 when targeted directly. Direct verification found no such omission:

- `vitest run` with no arguments reports **3 test files, 167 tests** — and per-file isolation
  runs confirm the arithmetic is exact and inclusive: `csrf.test.ts` (131) + `csrf-hardening.test.ts`
  (34) + `public-surface.test.ts` (2) = **167**. `csrf-hardening.test.ts`'s 34 tests are already
  counted in the aggregate; they are not omitted.
- `vitest list` enumerates all 167 test names across all three files, including every
  `csrf-hardening.test.ts` describe block (5.1 through 5.11).
- The result was identical after clearing `node_modules/.vite`, running with `--pool=forks`, and
  running with `--no-file-parallelism` — ruling out a stale cache or a worker-thread scheduling
  race as the cause.
- `git check-ignore` confirms the file is not gitignored; a plain filesystem `find` and a
  hex dump of the filename found no hidden characters or encoding issue.
- No sibling middleware package in this monorepo has a package-level `vitest.config.ts` (csrf's
  absence of one is the norm, inherited from the root config's `include: ['**/*.test.ts',
  '**/*.spec.ts']`, not a csrf-specific gap) — so a missing local config is not the explanation
  either.

Conclusion: whatever caused the anomaly in the interrupted session (most plausibly a transient
state — e.g. the file was still being written, or a build/cache artifact from that session that
has since been superseded by later edits — since resolved) is not present in the codebase at the
commit this pass verified against. No code or config change was made to "fix" this, because
there was nothing reproducibly broken to fix; introducing a change against a non-reproducing
symptom would itself be an unverified, unjustified edit. This is recorded as a pre-existing
report inaccuracy, not a defect in `packages/middleware/csrf`.

### 3. "Already-completed WS-A and WS-B" premise did not hold — task 5.9 handled via the pre-existing tracked dependency instead

The task brief stated WS-A and WS-B were "already-completed" workstreams whose deferral-
documentation pattern in `tasks.md` should be mirrored. At the time of this pass, `tasks.md`
(the untracked working-tree copy in this worktree) showed every checkbox in §3 (WS-A) and §4
(WS-B) as `[ ]`, and the seed remediation index showed every SEC-01/02/09 row as `⬜` — there was
no completed-and-documented deferral pattern from either workstream to mirror in this file at
this time. `wt-A-canonical-path` and `wt-B-proxy-trust` are separate, unmerged worktrees; neither
has landed a `canonicalizePath()` export in `packages/router/src` as of this pass (confirmed by
graph search: no `canonicalizePath` symbol exists in the router package at this commit).

This is directly relevant to task 5.9, whose task text says `excludePaths` matching "consumes
§3.4" (WS-A's canonicalization work). The wildcard depth-matching logic itself (`/*` = exactly
one remaining segment, `/**` = any depth, non-boundary prefixes rejected) is implemented in
`middleware.ts`'s `isPathExcluded()` and fully covered by `csrf-hardening.test.ts` §5.9 — that
part of 5.9 is genuinely done. What is not yet true is the *precondition* the task assumes:
`ctx.path` is not yet canonicalized per WS-A's contract, because WS-A hasn't merged. This is not
a WS-C deferral (nothing in `packages/middleware/csrf` was left undone by choice) — it is a
pre-existing, already-tracked cross-workstream dependency, reflected in the seed index's own
"depends on WS-A §3.4" annotation on the SEC-15 row. The remediation index's SEC-15 row is marked
🔄 rather than ✅ to reflect this split honestly: the CSRF-side contract is verified; the
canonicalization precondition is WS-A's to close.

### 4. Test assumptions found and fixed instead of the implementation

None. Both pre-existing test files (`csrf.test.ts`, `public-surface.test.ts`) and the new
`csrf-hardening.test.ts` were reviewed against `tasks.md` §5 and found to assert genuine
observable behavior (HTTP-level accept/reject outcomes, `crypto.subtle` call counts via spies,
`Set-Cookie` header content) rather than implementation internals. No test was rewritten to make
a wrong implementation appear correct.

### 5. Pre-existing gaps found but not introduced by this workstream

- `index.ts` (the barrel re-export file) reports 0% statement/branch/function coverage in the
  v8 coverage report, though it does not cause the aggregate thresholds to fail. This is a
  pure re-export file with no branches to cover; it is consistent with how coverage is measured
  for barrel files across the repo and was not altered by this pass.
- The `lint` script (`eslint src/ --ignore-pattern 'src/__tests__/'`) excludes test files from
  linting. This matches the convention in every other middleware package checked
  (`cookies`, `cors`, `rate-limit`, `static`) and is not a csrf-specific gap.

### Final verification numbers (packages/middleware/csrf)

- **Tests:** 167/167 passing — 3 files (`csrf.test.ts` 131, `csrf-hardening.test.ts` 34,
  `public-surface.test.ts` 2)
- **Coverage:** 98.27% statements · 97.15% branches · 96.66% functions · 99.51% lines
  (gates: ≥90% lines/statements/functions, ≥85% branches — all cleared)
- **Lint:** `eslint src/ --ignore-pattern 'src/__tests__/'` — zero warnings, zero errors
- **Typecheck:** `tsc --noEmit` — zero errors

## WS-D decisions log (`packages/middleware/cookies`)

Picked up a prior interrupted session's substantial uncommitted work in `wt-D-cookies` — the
name-bound signing (SEC-07), `secure: 'auto'` resolution (SEC-08), and `publicSuffixList`
injection point (SEC-18) implementations already existed in `signing.ts` /
`signing-message.ts` / `signing-codec.ts` / `secure-resolution.ts` / `domain-validation.ts` and
were verified correct against tasks.md §6.1–6.9, not rewritten. This log covers what this
session found and fixed beyond that starting point.

**RFC-vs-tasks.md conflicts**: none found. RFC-031's length-prefixed context-bound message
construction (`<len>!name!<len>!value!<len>!issuedAt`) matches tasks.md 6.3 exactly and mirrors
`@nextrush/csrf/src/token.ts`'s `buildMessage()` construction as required, confirmed by reading
`token.ts` directly in this worktree. Note: RFC-031 and ADR-0019 themselves still show `Status:
Draft` and a 0%-complete phase tracker as of this session, even though the implementation they
govern is substantially complete — flagged below as a pre-existing gap, out of this
workstream's file scope to fix.

**Worktree isolation incident (self-caught and corrected)**: this worktree (`wt-D-cookies`) was
branched from commit `b3b78053`, one commit *behind* `security/audit-review`'s tip — it was
missing `f2b92e10` ("docs(security): RFC/ADR gates + test harness for harden-security-boundaries"),
the commit that added `openspec/changes/harden-security-boundaries/tasks.md`,
`report/security-review-remediation-index.md`, and the governing RFCs/ADRs. Neither file existed
in this worktree at all when first checked. A first attempt to update them accidentally edited
the copies at the main repo root (`/home/tanzim/project/framework/nextrush`, on branch
`security/audit-review`) instead — a real isolation violation. Caught before committing:
reverted both files in the main tree with `git restore` (clean revert, no commit had been made
there), confirmed `f2b92e10` is a single-commit, zero-conflict fast-forward ancestor of this
worktree's branch tip with no overlap against `packages/middleware/cookies`, and fast-forwarded
`wt-D-cookies` onto it (`git merge --ff-only f2b92e10`) before redoing this section's edits in
the correct location. No other worktree was touched; no commit was made on any branch other than
`wt-D-cookies` itself.

**Test assumptions found and fixed instead of the implementation** (my own additions, not the
prior session's):
- `sanitizeForLogging` — my first draft asserted a fully-CRLF-stripped result; the function's
  `CRLF_CHARS` regex is intentionally non-global (single-pass), so the assumption was wrong, not
  the implementation. Corrected the test to assert single-character-class stripping.
- `publicSuffixList` injection — my first draft asserted `validateDomain('example.internal-hosting', ...)`
  should be flagged, but only the suffix label itself (or a sub-domain of it) is subject to the
  public-suffix check; the assumption was wrong. Corrected to test the suffix label directly and
  a genuine sub-domain separately.
- The `MAX_COOKIE_SIZE`-exact-boundary edge-case test initially hardcoded an assumed fixed
  overhead (`'name='.length`) for the serialized cookie; the real overhead includes the merged
  `DEFAULT_COOKIE_OPTIONS` attributes (`Path`, `HttpOnly`, `SameSite`, `Secure`). Corrected to
  compute the overhead empirically (`serializeCookie('name', '').length`) rather than assume a
  fixed figure that would drift if the defaults changed.
- A small number of ad-hoc `pnpm exec vitest run ...` invocations (not the package's own `test`/
  `test:coverage` scripts) each reported exactly "1 failed" on a single run, with the package's
  own scripts and every immediately-following retry (3 consecutive clean runs confirmed) fully
  green — not reproducible, and never isolable to a specific test name in the failure output
  captured. Treated as a transient flake (most likely a vitest worker-pool warm-up race
  immediately after a dependency/`node_modules` change or a `git merge`), not a real regression;
  the actual verification gate for this workstream is the package's own `test` script, which was
  green on every run used for sign-off. Flagging here per the "watch for a test-discovery
  anomaly" instruction rather than silently discarding the observation — this is a flakiness
  anomaly, not the file-discovery-omission anomaly WS-C reportedly hit; no evidence of a
  vitest-omitting-a-real-file issue was found anywhere in this package (file count on disk
  matched the reporter's file count on every run, checked repeatedly across the session).

**Real implementation bugs found and fixed (pre-existing, not introduced by this session)**:
1. `DEFAULT_COOKIE_OPTIONS` had no `secure` key at all — task 6.7 requires `secure: 'auto'` to be
   *the default*, not only the middleware-layer fallback in `resolveSecureOption`. Added
   `secure: 'auto'` to `DEFAULT_COOKIE_OPTIONS` (`constants.ts`) so a bare `serializeCookie()`
   call also fails closed.
2. That fix exposed a second, sharper bug: `validateSecurePrefix`, `validateHostPrefix`,
   `validateCookiePrefix`, and `validateSameSiteSecure`/the throwing `SameSite=None` check in
   `options-validation.ts` all tested `options.secure` for *truthiness*, so an unresolved
   `secure: 'auto'` (a truthy string) satisfied a `__Host-`/`__Secure-`/`SameSite=None` cookie's
   hard Secure requirement even though `'auto'` had not actually been resolved to `true` for the
   request. Fixed all four sites to check `options.secure !== true` (`options.secure === true`
   where inverted), so only a genuinely-resolved `true` satisfies these requirements — closing a
   real fail-open gap this session's own `DEFAULT_COOKIE_OPTIONS` change would otherwise have
   introduced. Caught by two pre-existing `security.test.ts` assertions that turned from ✓ to ✗
   the moment `secure: 'auto'` became the default, then fixed by tightening the checks rather
   than reverting the default.
3. `serializeCookie`'s `SameSite` emission was gated on `if (opts.sameSite)` — a truthiness
   check — so `sameSite: false` (RFC 6265's documented alias for `SameSite=None`) was silently
   dropped instead of emitting `SameSite=None`. Fixed to check `opts.sameSite !== undefined`.
4. `validation.ts`'s barrel re-export omitted `resetUnrecognizedSuffixWarning` (defined in
   `domain-validation.ts`), but `index.ts` imported it from `./validation.js` — a real `tsc`
   error (`TS2305`) that only surfaced once `@nextrush/types` was built (see below) and lint's
   type-aware rules stopped falling back to `any`. Added the missing re-export.
5. Two `// eslint-disable-next-line no-console` comments (`domain-validation.ts`,
   `signing-message.ts`) were flagged as unused directives once the type-aware lint pass could
   actually run — `no-console` isn't enabled for this package's warn-level logging. Removed both.

**Pre-existing gaps found but not introduced by this session**:
- `@nextrush/types` had never been built in this worktree (no `dist/`), which was the root cause
  of 34 of the 36 lint errors and all 6 `tsc` errors seen on the first verification pass — not
  cookies-package bugs. Built `packages/types` (its own `pnpm build`, no source edits) to unblock
  verification, per the task's own dependency-order-build instruction; did not touch any other
  file in `packages/types`.
- `prefix-validation.ts` (`validateSecurePrefix`/`validateHostPrefix`/`validatePrefixes`),
  `path-validation.ts`'s `validatePath`, `domain-validation.ts`'s `validateDomain`, and
  `validation.ts`'s `validateSameSiteSecure`/`validateMaxAge`/`validateExpires`/`validateCookie`/
  `sanitizeForLogging` were exercised only indirectly (or not at all) by the prior session's test
  files, driving package coverage to 81.18%/75.93%/85.07%/81.69% (stmts/branches/funcs/lines) —
  below the 90/85/90/90 gate. None of these are exported from the package barrel (`index.ts`), so
  this was an internal-coverage gap, not a public-API gap. Added direct unit tests for each
  (`validation-result-api.test.ts`, `remaining-branches.test.ts`, `final-coverage-closure.test.ts`,
  `task-6.9-edge-cases.test.ts`) rather than deleting or restructuring the pre-existing
  implementation. Final package coverage: 98.3%/95.72%/98.5%/98.66%.
- `src/index.ts` reports 0% coverage in the text reporter on every run — confirmed via the
  `coverage-summary.json` machine output that this is `0 covered / 0 total` for every metric (a
  pure `export {...} from './x.js'` barrel generates no instrumentable statements), not a real
  gap; it contributes nothing to the package-wide denominator and the same pattern is present
  and unaddressed in the already-shipped `@nextrush/csrf` package. Not fixed — not a defect.
- `docs/RFC/request-data/031-context-bound-signatures.md` and `docs/adr/ADR-0019-context-bound-signatures.md`
  (both read and linked from `ARCHITECTURE.md` per this session's rewrite) still show `Status:
  Draft` and a 0%-complete phase tracker, even though the implementation they govern is
  substantially complete, verified, and committed by this session. Both files are outside this
  workstream's declared scope (`packages/middleware/cookies`, `openspec/changes/.../tasks.md`,
  `report/security-review-remediation-index.md` only) and were not modified — flagged here as a
  pre-existing gap for whichever task/reviewer owns RFC/ADR status updates (likely task 9.4,
  "Confirm every RFC from §1 is approved and its ADR recorded").
- The package is still at `1.0.0-beta.0` (unreleased) per `package.json`/`CHANGELOG.md` — no
  changeset exists yet for the SEC-07/SEC-08 breaking wire-format and default changes landed by
  this session. README's migration section was written accordingly (framed as a pre-stable-release
  format change with an `acceptLegacySignatures` rotation aid, not a "1.0.x → 1.1.0" migration,
  since nothing has shipped past beta yet). A changeset is a release-process concern outside this
  workstream's declared file scope and was not added.

**Verification (final, this session)**: `packages/middleware/cookies` — 15 test files / 400
tests passing (`pnpm test`), matching the 15 `*.test.ts` files present on disk in
`src/__tests__/` (sanity-checked directly against `ls`, not just the reporter's summary line, per
the task's anti-blind-trust instruction — no discrepancy found in this package across repeated
runs). Coverage 98.3% statements / 95.72% branches / 98.5% functions / 98.66% lines (gate:
90/85/90/90). `pnpm lint` — 0 errors, 0 warnings. `pnpm typecheck` (`tsc --noEmit`) — 0 errors.
`pnpm build` succeeds.
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
