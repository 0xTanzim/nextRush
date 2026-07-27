> **Execution model.** Groups 2–7 are the six workstreams from `design.md` D8. Each owns a disjoint
> file set and runs in its own git worktree/branch — a subagent per workstream. Only one hard file
> collision exists: **WS-A (§3) and WS-B (§4) both touch adapter `context.ts`, so B rebases on A** —
> never run them in parallel against a shared tree. WS-C (§5), WS-D (§6), WS-E (§7) are fully parallel
> with each other and with A. WS-F (§8) merges last. Every group is TDD: the first task in each is the
> failing test that reproduces the finding at the observable-behavior level.

## 1. RFC gates and shared scaffolding

- [x] 1.1 Write `docs/RFC/` entry for the canonical request path: one normalization owner, dot-segment rejection over resolution, `ctx.path`/`ctx.originalPath` contract, and the `caseSensitive` default flip — from `docs/RFC/TEMPLATE.md`. Gates §3.
- [x] 1.2 Write `docs/RFC/` entry for the typed proxy trust boundary (`false | number | string[]`, right-to-left chain walk, peer-gated vendor headers, Edge peer-list refusal) — gates §4.
- [x] 1.3 Write `docs/RFC/` entry for context-bound signature construction (length-prefixed `name|value|issuedAt`) and the legacy-acceptance rotation window — gates §6.
- [x] 1.4 Write `docs/RFC/` entry recording the `@nextrush/session` position: what the framework will own, what applications own until then, and why the package is a separate change — gates §8.6.
- [x] 1.5 Write the terse ADR for each of 1.1–1.4 from `docs/adr/TEMPLATE.md`.
- [x] 1.6 Create `report/security-review-remediation-index.md` mapping each of SEC-01…SEC-19 to its requirement and its task number, seeded from `design.md` D9. Every later group updates it; §9.7 asserts it is complete.
- [ ] 1.7 Create one git worktree/branch per workstream (A–F) and record the branch names in the index, so no two subagents share a working directory.

## 2. Security test harness (shared prerequisite)

- [x] 2.1 Add a `securityScenario()` helper to `packages/adapters/conformance` that dispatches a raw request target and arbitrary headers to every registered adapter and returns each adapter's observable result, so security parity is asserted rather than assumed.
- [x] 2.2 Add a shared fixture set for the security suites: forged forwarded-header chains, dot-segment path variants (literal / single-encoded / double-encoded / dot-in-filename), mixed-case and repeated-slash targets, malformed header names and values.
- [x] 2.3 Verify 2.1–2.2 by asserting the helper currently reports the *broken* behavior for SEC-01 and SEC-02 across all four adapters — the harness must prove it can see the bugs before any fix lands.

## 3. WS-A — Canonical request path (SEC-02 P1, SEC-09 P2)

- [ ] 3.1 RED: failing test — middleware mounted at `/admin` does not run for `GET /ADMIN/users` while the router still dispatches the handler (the SEC-02 authorization bypass, at the observable level).
- [ ] 3.2 RED: failing tests for dot-segment rejection — `/api/webhooks/../admin`, `/api/%2e%2e/admin`, `/api/%252e%252e/admin`, `/api/./users`, `/../..` each expect 400; `/files/archive.tar.gz` and `/files/..hidden.txt` expect acceptance.
- [ ] 3.3 RED: failing tests for the published-path contract — `ctx.path` equals the router-matched canonical value, `ctx.originalPath` equals the raw target, neither contains the query string, both populated on a 404.
- [ ] 3.4 GREEN: implement `canonicalizePath()` in `packages/router/src` as the single normalization owner (case handling, slash collapse, trailing-slash policy, dot-segment detection); export it from the router barrel.
- [ ] 3.5 GREEN: implement dot-segment detection as a single linear scan with no backtracking regex; reject with 400 before route matching and before any path-based middleware or body read.
- [ ] 3.6 GREEN: publish the canonical path as `ctx.path` and add `ctx.originalPath` in the Node adapter context.
- [ ] 3.7 GREEN: mirror 3.6 in the Bun, Deno, and Edge adapter contexts.
- [ ] 3.8 GREEN: route `app.use(prefix, mw)` and mounted-router prefix resolution through router canonicalization and segment-boundary matching; delete any hand-written `startsWith` prefix comparison.
- [ ] 3.9 REFACTOR: remove the now-duplicated normalization from `matchRoute`/`findAllowedMethods` so `collapseAndStrip` and the fold decision have exactly one caller path; keep files under the 300-line ceiling.
- [ ] 3.10 Regression: assert every preserved scenario in the MODIFIED router requirements still passes — `/`, `//a//b`, `///`, very deep paths, non-ASCII folding equals `toLowerCase()`, static-only routers still skip the walk.
- [ ] 3.11 Edge cases: pathological dot-adjacent path of maximum length completes in linear time; a path of only dot segments returns 400 and never resolves to `/`; a percent-encoded dot inside a legitimate param value (`/users/a%2Eb`) is accepted and decodes correctly.
- [ ] 3.12 Cross-adapter: add conformance scenarios pinning identical `ctx.path`, `ctx.originalPath`, and dot-segment 400 on all four adapters.
- [ ] 3.13 Gate: `performance-gate` smoke profile plus a CPU-pinned A/B on the router hot path — no allocation regression on the clean-path case; a regression blocks this workstream rather than being accepted.
- [ ] 3.14 Gate: per-package line coverage ≥ 90%, ESLint clean, `tsc` strict clean for `router` and every adapter touched.
- [ ] 3.15 **DECISION GATE** — flip `caseSensitive` default `false` → `true` only if this change ships in a major release lane; otherwise defer to the follow-up with RFC 1.1 already approved. Record the decision in the remediation index either way.
- [ ] 3.16 If 3.15 flips: add a boot diagnostic listing registered routes whose path is not all-lowercase, and add the migration-guide entry for `caseSensitive: false`.

## 4. WS-B — Typed proxy trust boundary (SEC-01 P1) — rebases on WS-A

- [ ] 4.1 RED: failing test — a rotating `X-Forwarded-For` mints a new rate-limit key per request (the SEC-01 bypass) with a rate limiter configured at `max: 5`.
- [ ] 4.2 RED: failing tests for chain selection — `proxy: 1` with `XFF: '203.0.113.9, 10.0.0.5'` resolves `10.0.0.5`; `proxy: ['10.0.0.0/8']` with a three-entry chain from a trusted peer stops at the first untrusted address; a forged header from an untrusted peer resolves to the direct peer.
- [ ] 4.3 RED: failing tests for configuration refusal — `proxy: true` throws at boot naming both replacements; `proxy: 0` throws directing to `proxy: false`; a peer-CIDR list on an adapter with no peer address throws at boot.
- [ ] 4.4 GREEN: change the `proxy` option type to `false | number | string[]` in `@nextrush/types` and thread it through `ApplicationOptions`.
- [ ] 4.5 GREEN: rewrite `resolveClientIp()` in `packages/runtime/src/headers.ts` to walk `X-Forwarded-For` right-to-left under the trust specification, gate vendor headers on peer trust, and return the direct peer when the chain is exhausted or untrusted.
- [ ] 4.6 GREEN: add IP/CIDR normalization shared by the trust comparison and the published value so an IPv4-mapped or bracketed-IPv6 peer is never judged untrusted for textual reasons.
- [ ] 4.7 GREEN: wire the new policy into the Node adapter, preserving the existing no-closure fast path when trust is `false`.
- [ ] 4.8 GREEN: wire the new policy into Bun, Deno, and Edge, preserving each platform's direct-address source and the no-closure fast path.
- [ ] 4.9 GREEN: rewrite `rate-limit/src/utils/key-generator.ts` to consume `ctx.ip` only — delete the eight-header `PROXY_HEADERS` scan and `parseProxyHeader`.
- [ ] 4.10 Edge cases: malformed entries in a trusted chain (`not-an-ip`, empty element, unbracketed IPv6 with port) never become the resolved value; a hop count larger than the chain falls back to the direct peer; `cf-connecting-ip` from an untrusted peer is ignored.
- [ ] 4.11 Regression: allow/deny lists reject a forged whitelisted IP; `trustProxy: false` behavior is byte-identical to today on every adapter.
- [ ] 4.12 Cross-adapter: conformance scenarios asserting no adapter returns a forged leftmost entry under any supported trust form, and that the policy has exactly one implementation (no adapter-local precedence logic).
- [ ] 4.13 Gate: coverage ≥ 90%, ESLint clean, `tsc` strict clean for `runtime`, `rate-limit`, and every adapter; `performance-gate` smoke unchanged.
- [ ] 4.14 Migration guide: `proxy: true` → `proxy: 1` / `proxy: ['<cidr>']`, with the Edge peer-list constraint called out.

## 5. WS-C — CSRF correctness (SEC-03, SEC-04, SEC-05, SEC-06, SEC-15, SEC-19)

- [ ] 5.1 RED: failing integration test — issue a token on `GET` under **default** options, then validate cookie + token on a subsequent `POST`. This is the test whose absence let SEC-03 ship.
- [ ] 5.2 RED: failing test — the default `Set-Cookie` contains no `Max-Age` and no `Expires` attribute.
- [ ] 5.3 GREEN: stop coercing an omitted `cookie.maxAge` to `0`; emit `Max-Age` only when explicitly configured; reject negative / `NaN` / `Infinity` at construction.
- [ ] 5.4 RED: failing tests for origin validation — forged `Host` + `Origin` pair rejected; missing `Origin` on `POST` rejected; `Sec-Fetch-Site: none` does not override the allowlist; `Sec-Fetch-Site: cross-site` rejects before any crypto; `originCheck: true` without `allowedOrigins` throws at construction.
- [ ] 5.5 GREEN: rewrite `checkOrigin()` to validate against the configured allowlist only, never against `Host`; default `originCheck` to `true`; treat `Sec-Fetch-Site` as a reject-only signal.
- [ ] 5.6 RED + GREEN: `csrf()` throws unless given `getSessionIdentifier` or `sessionBinding: 'none'`; a token minted for session A fails under session B; an `undefined` identifier at both ends validates consistently.
- [ ] 5.7 RED + GREEN: replace the hardcoded `'csrf-compare'` blinding key with a per-process `crypto.getRandomValues()` key and cache the imported `CryptoKey`; assert the key is not a compile-time literal.
- [ ] 5.8 RED + GREEN: reorder `protect` so hex/length shape checks reject before any `crypto.subtle` call; assert a shape-rejected request performs zero crypto operations.
- [ ] 5.9 RED + GREEN: `excludePaths` matches canonical paths (consumes §3.4); `/*` matches exactly one remaining segment, `/**` any depth; `/api/web/*` does not match `/api/webhooks/x`.
- [ ] 5.10 RED + GREEN: remove the `?_csrf=` query fallback from the default extractor; a custom `getTokenFromRequest` may still opt in.
- [ ] 5.11 Edge cases: a cookie value containing the token separator; a token whose HMAC leg is valid hex but wrong length; concurrent `generateToken()` calls in one request emitting exactly one `Set-Cookie`; `__Host-` prefix constraints still enforced after every change above.
- [ ] 5.12 Gate: coverage ≥ 90%, ESLint clean, `tsc` strict clean; `public-surface-lock` updated for any new exported option type.
- [ ] 5.13 Rewrite `packages/middleware/csrf/README.md` and `ARCHITECTURE.md` from the current templates — the README's documented `maxAge` default is the contract this workstream just made true, and the origin/session-binding defaults changed.

## 6. WS-D — Cookie integrity and transport (SEC-07, SEC-08, SEC-18)

- [x] 6.1 RED: failing test — a value signed as cookie `tier` verifies when presented as cookie `user` (the SEC-07 substitution).
- [x] 6.2 RED: failing tests — an expired signed payload is rejected; a value containing the separator round-trips byte-for-byte; a legacy value-only signature is rejected unless `acceptLegacySignatures` is set.
- [x] 6.3 GREEN: sign a length-prefixed `<len>!<name>!<len>!<value>!<len>!<issuedAt>` tuple, reusing the construction from `csrf/token.ts`; verify name match and optional embedded expiry.
- [x] 6.4 GREEN: add `acceptLegacySignatures` (default off) that accepts the previous value-only format and logs once per process; document the removal target.
- [x] 6.5 GREEN: thread the cookie name through `signedCookies.get/set` so verification always has it; keep key-rotation support working across both formats.
- [x] 6.6 RED: failing tests for `secure: 'auto'` — `Secure` emitted on TLS; emitted on trusted-forwarded HTTPS; omitted on plaintext loopback; **emitted anyway** when a plaintext non-loopback request carries an untrusted `X-Forwarded-Proto: https` (fail closed).
- [x] 6.7 GREEN: implement `secure: 'auto'` as the default in `DEFAULT_COOKIE_OPTIONS`, resolved per request; keep explicit `secure: false` honored. (This session found `DEFAULT_COOKIE_OPTIONS` had no `secure` key at all — added `secure: 'auto'`, then tightened `validateSecurePrefix`/`validateHostPrefix`/`validateCookiePrefix`/`validateSameSiteSecure`/the `SameSite=None` throwing check to require `options.secure === true` rather than truthiness, since an unresolved `'auto'` must never satisfy a hard Secure requirement — see the WS-D decisions log in the remediation index.)
- [x] 6.8 GREEN: add a `publicSuffixList` injection point and warn (not throw) on an unrecognized multi-label suffix; keep the curated heuristic as the default.
- [x] 6.9 Edge cases: signed value at exactly `MAX_COOKIE_SIZE`; a name that is a valid token but collides with a `__Host-`/`__Secure-` prefix rule; parse-then-unsign round trip when `sanitizeCookieValue` would alter the value; repeated `Cookie` headers joined by the middleware.
- [x] 6.10 Gate: coverage ≥ 90%, ESLint clean, `tsc` strict clean; `public-surface-lock` updated. (No standalone `public-surface-lock` file exists in this package — `public-surface.test.ts` is the lock mechanism and required no change, since the barrel's export list was not altered, only a broken re-export path within it was fixed. Final: 400 tests / 15 files, coverage 98.3%/95.72%/98.5%/98.66% stmts/branches/funcs/lines, ESLint 0 errors/0 warnings, `tsc --noEmit` 0 errors.)
- [x] 6.11 Rewrite `packages/middleware/cookies/README.md` and `ARCHITECTURE.md` from the current templates; add the signed-cookie format migration section.

## 7. WS-E — Response and content boundaries (SEC-10, SEC-11, SEC-12, SEC-13, SEC-14, SEC-17)

- [ ] 7.1 RED: failing test — a default-options preflight requesting `X-Anything` receives it in `Access-Control-Allow-Headers` (the SEC-10 echo).
- [ ] 7.2 GREEN: ship a conservative default `allowedHeaders` set and intersect the requested headers against it; `Authorization` only when `credentials: true`; omit the header entirely on an empty intersection.
- [ ] 7.3 RED: failing test — an `.svg` served from a static root renders as `image/svg+xml` inline (the SEC-11 stored-XSS path).
- [ ] 7.4 GREEN: add `serveStatic({ untrusted: true })` forcing `Content-Disposition: attachment`, `Content-Security-Policy: sandbox; default-src 'none'`, and `application/octet-stream` for script-capable types; apply it to directory-index and extension-fallback resolutions too.
- [ ] 7.5 RED + GREEN: extend `assertHeaderSafe()` to validate the RFC 9110 field-name token and field-value grammar (control chars, NUL, leading/trailing whitespace, obs-fold), throwing a typed error; validate array values element-wise; keep numeric values accepted.
- [ ] 7.6 RED: failing test — a symlink swapped between the safety check and the read is followed (the SEC-13 TOCTOU race).
- [ ] 7.7 GREEN: open a file handle, `fstat` the descriptor, and stream from that same descriptor in `sendFile()`; close on client disconnect and on mid-read unlink without an unhandled rejection or descriptor leak.
- [ ] 7.8 RED + GREEN: `includeStack: true` is ignored in production with exactly one warning; development behavior preserved; a plain `Error` still never exposes its message in production.
- [ ] 7.9 RED + GREEN: compression honors `Cache-Control: no-transform` and exposes a `skip` predicate; document the BREACH interaction and the CSRF-token pairing hazard.
- [ ] 7.10 Edge cases: preflight with a duplicated `Access-Control-Request-Headers`; `untrusted` root serving a zero-byte file and a file with no extension; `Range` request against an `untrusted` file; header value at exactly the platform size limit; a 304 response path after the header-grammar change.
- [ ] 7.11 Cross-adapter: conformance scenarios asserting every rejected header write throws the same typed error on all four adapters.
- [ ] 7.12 Gate: coverage ≥ 90%, ESLint clean, `tsc` strict clean for `cors`, `static`, `compression`, `runtime`, `errors`; `public-surface-lock` updated.
- [ ] 7.13 Rewrite `README.md` + `ARCHITECTURE.md` from the current templates for `cors`, `static`, and `compression`.

## 8. WS-F — Enforcement, presets, and proof (SEC-16 + framework-wide validation)

- [ ] 8.1 RED + GREEN: boot-time production security audit at `app.ready()` — throws on `proxy: true` and `cors({ origin: true, credentials: true })`; warns exactly once on static `dotfiles: 'allow'`, `includeStack: true`, and cookies with `secure: false`; silent outside production.
- [ ] 8.2 GREEN: fold `cors`'s existing `securityWarning()` into the audit as one input rather than a second parallel mechanism.
- [ ] 8.3 RED + GREEN: `security()` composite preset applying helmet + strict cookies + CSRF + rate limit; throws at construction on incomplete required configuration; per-layer overrides honored with no layer silently dropped.
- [ ] 8.4 Property/fuzz suites for `parseCookies`, `parseUrlEncoded`/`setNestedValue`, `parseRange`, `extractBoundary` — invariants: never an unhandled throw, `Object.prototype` unmodified, no path outside root, bounded time and allocation.
- [ ] 8.5 Raw-socket malformed-request suite against the Node adapter: `Content-Length` + `Transfer-Encoding` together, duplicate differing `Content-Length`, missing and duplicated `Host`, byte-at-a-time header and body (Slowloris), oversized header block. Assert observed behavior rather than assuming Node's.
- [ ] 8.6 Write the `@nextrush/session` position into the docs site and package docs from RFC 1.4 — what applications own today, what the framework will own, and the pointer to the follow-up change. Closes SEC-16 as a documented position.
- [ ] 8.7 Write the consolidated migration guide covering all breaking changes: `ctx.path` semantics + `ctx.originalPath`, `proxy` type, signed-cookie format, CSRF construction requirements, CORS default `allowedHeaders`, and (if flipped) `caseSensitive`.
- [ ] 8.8 Add a `security-boundaries` conformance tier running the security-parity scenarios against every shipped adapter, and assert a newly registered adapter cannot pass the suite without them.
- [ ] 8.9 Gate: full-repo test suite green (not per-package only), all package coverage ≥ 90%, ESLint clean, `tsc` strict clean, `pnpm validate:esm-only` green.

## 9. Verification and closure

- [ ] 9.1 Re-run the §2.3 harness assertions inverted: every scenario that previously demonstrated a finding now demonstrates the fix, on every adapter.
- [ ] 9.2 Run `pnpm bench:validate` and the CPU-pinned A/B comparison; confirm no scenario regressed beyond the `performance-gate` threshold and record the numbers in the remediation index.
- [ ] 9.3 Independent validation pass: a reviewer who did not implement a workstream re-derives each finding's fix from raw test output, not from the implementer's report.
- [ ] 9.4 Confirm every RFC from §1 is approved and its ADR recorded — no archive without them.
- [ ] 9.5 Update `openspec/README.md`'s capability registry with the `security-boundaries` capability and its `## Purpose`.
- [ ] 9.6 Update `docs/audits/03-gap-checklist.md` statuses touched by this change, verified against source per the `gap-checklist-accuracy` capability.
- [ ] 9.7 Assert the remediation index is complete: every one of SEC-01…SEC-19 maps to a requirement, a task, and a passing test. A finding without all three blocks closure.
- [ ] 9.8 Open the follow-up audit change for the un-reviewed surface named in the proposal (Node request parsing, `multipart/parser.ts` + `scanner.ts` + `storage/`, `body-parser/json.ts` charset, `@nextrush/template` escaping, `class` guards/interceptors, `websocket`/`stream`/`openapi`/`logger`) so "security review complete" is never claimable from this change alone.
