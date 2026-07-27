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
| SEC-02 case-fold path-prefix authorization bypass | P1 | `router` ADDED "A single canonicalization function…"; `router` MODIFIED "Case-normalization is fast-pathed…" | RFC-029 / ADR-0017 | §3 (WS-A), 3.1, 3.3, 3.8, 3.10 | WS-A / `wt-A-canonical-path` | 🔄 (3.1-3.12, 3.14-3.15 done; 3.13 performance-gate pending) |
| SEC-03 CSRF default `Max-Age=0` deletes token cookie | P2 | `security-boundaries` "CSRF token cookies persist as documented" | — (no RFC required; correctness fix) | §5 (WS-C), 5.1–5.3 | WS-C / `wt-C-csrf` | ⬜ |
| SEC-04 CSRF origin check off by default / trusts Host | P2 | `security-boundaries` "CSRF origin validation is on by default…" | — | §5 (WS-C), 5.4–5.5 | WS-C / `wt-C-csrf` | ⬜ |
| SEC-05 CSRF tokens not session-bound by default | P2 | `security-boundaries` "CSRF session binding is an explicit decision" | — | §5 (WS-C), 5.6 | WS-C / `wt-C-csrf` | ⬜ |
| SEC-06 hardcoded HMAC blinding key, no key cache | P2 | `security-boundaries` "Constant-time comparison uses an unpredictable per-process key…" | — | §5 (WS-C), 5.7–5.8 | WS-C / `wt-C-csrf` | ⬜ |
| SEC-07 signed cookies bind value, not name | P2 | `security-boundaries` "Signed artifacts bind their signature to their context" | RFC-031 / ADR-0019 | §6 (WS-D), 6.1–6.5 | WS-D / `wt-D-cookies` | ⬜ |
| SEC-08 cookie defaults omit `Secure` | P2 | `security-boundaries` "Cookies default to Secure outside plaintext loopback" | — | §6 (WS-D), 6.6–6.7 | WS-D / `wt-D-cookies` | ⬜ |
| SEC-09 no dot-segment normalization | P2 | `router` ADDED "Dot segments in a request path are rejected, not resolved" | RFC-029 / ADR-0017 | §3 (WS-A), 3.2, 3.5, 3.11 | WS-A / `wt-A-canonical-path` | 🔄 (3.1-3.12, 3.14-3.15 done; 3.13 performance-gate pending) |
| SEC-10 CORS echoes `Access-Control-Request-Headers` | P2 | `security-boundaries` "CORS intersects requested headers against an allowlist" | — | §7 (WS-E), 7.1–7.2 | WS-E / `wt-E-response` | ⬜ |
| SEC-11 static serves SVG/HTML inline (stored XSS) | P2 | `security-boundaries` "Static serving can neutralize untrusted content" | — | §7 (WS-E), 7.3–7.4 | WS-E / `wt-E-response` | ⬜ |
| SEC-12 `assertHeaderSafe()` validates only CR/LF | P3 | `runtime-adapter-contract` ADDED "Header writes are validated against the full HTTP field grammar" | — | §7 (WS-E), 7.5, 7.11 | WS-E / `wt-E-response` | ⬜ |
| SEC-13 static file TOCTOU (lstat → open race) | P3 | `security-boundaries` "Static file reads are not vulnerable to a symlink swap" | — | §7 (WS-E), 7.6–7.7 | WS-E / `wt-E-response` | ⬜ |
| SEC-14 `includeStack` has no production guard | P3 | `security-boundaries` "Stack traces are never emitted in production" | — | §7 (WS-E), 7.8 | WS-E / `wt-E-response` | ⬜ |
| SEC-15 CSRF `excludePaths` `/*` matches unlimited depth | P3 | `router` ADDED "…prefix and mount matching…"; `security-boundaries` "Path-based security exemptions match canonical paths with exact wildcard depth" | RFC-029 / ADR-0017 | §5 (WS-C), 5.9 | WS-C / `wt-C-csrf` (depends on WS-A §3.4) | ⬜ |
| SEC-16 no session/authentication/JWT primitive | P3 | Proposal position; not a spec requirement (documentation deliverable) | RFC-032 / ADR-0020 | §8 (WS-F), 8.6 | WS-F / `wt-F-enforcement` | N/A (docs) |
| SEC-17 compression BREACH-class surface, no guidance | P3 | `security-boundaries` (documented in the CORS/static/compression cross-cutting text; `no-transform` handling) | — | §7 (WS-E), 7.9 | WS-E / `wt-E-response` | ⬜ |
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

## WS-A decisions log (task 3.15, and open items)

- **`caseSensitive` default flip (task 3.15):** Deferred, not flipped, this cycle. `harden-security-boundaries` is not itself a major release lane change — RFC-029 §15 gates the flip specifically to shipping alongside a major bump, and forcing it here would make this security-hardening change also a breaking-default change for every existing route table, which is a separate, larger decision than the P0-P2 fix (canonical path ownership + dot-segment rejection) this workstream exists to land. `caseSensitive: false` remains the default; RFC-029 is already approved for when a future major-lane change wants to flip it (task 3.16 at that time).
- **Task 3.13 (performance-gate):** Not run in this session — the repo's `performance-gate` capability (`.github/workflows/performance-gate.yml`, `openspec/specs/performance-gate/spec.md`) requires the CPU-pinned `apps/benchmark` harness, disproportionate to invoke ad hoc for a single workstream's verification. Code-level review confirms `canonicalizePath()`'s dot-segment scan (`hasDotSegment`) is allocation-free and O(n), consistent with RFC-029 §6a's stated, accepted cost ("one additional linear scan on the routing hot path") — but this is a code-reading check, not a measured benchmark run. **Run the actual `performance-gate` CI workflow before merging WS-A**, per the task's own exit condition.
- **A found, adjacent bug (not part of any tracked SEC-NN finding):** `packages/core/src/route-mount.ts`'s `createPrefixMount` used a raw, case-sensitive `startsWith()` for the mount-prefix boundary — independent of the mounted router's own `caseSensitive` option — so `app.route('/admin', router)` silently 404'd a mixed-case request instead of dispatching through the router's own (permissive-by-default) matching. Fixed as part of task 3.8 by adding an optional `Routable.matchesMountPrefix()` contract (`@nextrush/core`) that `Router` (`@nextrush/router`) implements via its own `canonicalizePath`; a `Routable` with no such method still falls back to the old literal check (backward-compatible for minimal test doubles). Covered by `packages/adapters/conformance/src/security/__tests__/canonical-path-parity.test.ts`.
- **A confirmed real-world manifestation of RFC-029's stated proxy-desync motivation:** cross-adapter conformance testing (task 3.12) found that Bun/Deno/Edge (Fetch-API-based adapters) resolve literal dot segments (`/api/webhooks/../admin` → `/api/admin`) and even *single-encoded* percent-escaped ones (`/api/%2e%2e/admin` → `/admin`) during `new Request()`/`URL` construction — **before** the framework or `canonicalizePath()` ever see the raw target. Node's raw-socket adapter does not do this. This means the SAME raw request target is either rejected (Node, via `canonicalizePath`) or silently resolved to a **different, unintended route** (Bun/Deno/Edge, via the platform's own URL parser) depending on which layer parses it first — empirical confirmation of the exact proxy-desync class RFC-029 §3.2 describes, now observed at the platform layer rather than only the reverse-proxy layer the RFC's prose focuses on. This is a genuine cross-adapter divergence worth a documented, explicit note in RFC-029 (not a defect in this workstream's implementation, and not blocking — Node's real, literal-target behavior is the one `canonicalizePath` is designed to close, and the Fetch adapters' platform-level pre-resolution happens to be traversal-safe by construction, just not identical in status code).

## Worktree registry (task 1.7)

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
