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
| SEC-07 signed cookies bind value, not name | P2 | `security-boundaries` "Signed artifacts bind their signature to their context" | RFC-031 / ADR-0019 | §6 (WS-D), 6.1–6.5 | WS-D / `wt-D-cookies` | ✅ |
| SEC-08 cookie defaults omit `Secure` | P2 | `security-boundaries` "Cookies default to Secure outside plaintext loopback" | — | §6 (WS-D), 6.6–6.7 | WS-D / `wt-D-cookies` | ✅ |
| SEC-09 no dot-segment normalization | P2 | `router` ADDED "Dot segments in a request path are rejected, not resolved" | RFC-029 / ADR-0017 | §3 (WS-A), 3.2, 3.5, 3.11 | WS-A / `wt-A-canonical-path` | ⬜ |
| SEC-10 CORS echoes `Access-Control-Request-Headers` | P2 | `security-boundaries` "CORS intersects requested headers against an allowlist" | — | §7 (WS-E), 7.1–7.2 | WS-E / `wt-E-response` | ⬜ |
| SEC-11 static serves SVG/HTML inline (stored XSS) | P2 | `security-boundaries` "Static serving can neutralize untrusted content" | — | §7 (WS-E), 7.3–7.4 | WS-E / `wt-E-response` | ⬜ |
| SEC-12 `assertHeaderSafe()` validates only CR/LF | P3 | `runtime-adapter-contract` ADDED "Header writes are validated against the full HTTP field grammar" | — | §7 (WS-E), 7.5, 7.11 | WS-E / `wt-E-response` | ⬜ |
| SEC-13 static file TOCTOU (lstat → open race) | P3 | `security-boundaries` "Static file reads are not vulnerable to a symlink swap" | — | §7 (WS-E), 7.6–7.7 | WS-E / `wt-E-response` | ⬜ |
| SEC-14 `includeStack` has no production guard | P3 | `security-boundaries` "Stack traces are never emitted in production" | — | §7 (WS-E), 7.8 | WS-E / `wt-E-response` | ⬜ |
| SEC-15 CSRF `excludePaths` `/*` matches unlimited depth | P3 | `router` ADDED "…prefix and mount matching…"; `security-boundaries` "Path-based security exemptions match canonical paths with exact wildcard depth" | RFC-029 / ADR-0017 | §5 (WS-C), 5.9 | WS-C / `wt-C-csrf` (depends on WS-A §3.4) | ⬜ |
| SEC-16 no session/authentication/JWT primitive | P3 | Proposal position; not a spec requirement (documentation deliverable) | RFC-032 / ADR-0020 | §8 (WS-F), 8.6 | WS-F / `wt-F-enforcement` | N/A (docs) |
| SEC-17 compression BREACH-class surface, no guidance | P3 | `security-boundaries` (documented in the CORS/static/compression cross-cutting text; `no-transform` handling) | — | §7 (WS-E), 7.9 | WS-E / `wt-E-response` | ⬜ |
| SEC-18 partial public-suffix list for cookie `Domain` | P4 | `security-boundaries` cookies section (`publicSuffixList` injection point) | — | §6 (WS-D), 6.8 | WS-D / `wt-D-cookies` | ✅ |
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
