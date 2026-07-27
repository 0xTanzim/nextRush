## Why

A security engineering review (`report/security-review.md`, commit `5ed6cdc`) found 19 findings —
2 × P1, 9 × P2, 5 × P3, 2 × P4 — across the framework's security surface. Two are exploitable by an
unauthenticated remote attacker with a single header (`ctx.ip` derived from the attacker-controlled
leftmost `X-Forwarded-For`; a path-prefix authorization guard bypassed by uppercasing the path), and
one makes `@nextrush/csrf`'s documented default configuration reject every state-changing request —
which in practice drives developers to delete the middleware rather than debug it.

Eleven of the findings share one root cause: **a security decision is made from a value the framework
normalized for a different consumer, or from a value an attacker controls.** The router folds path
case for its own lookup and hands policy middleware the raw target. `proxy` is a boolean, so no safe
configuration is expressible behind a load balancer. Signed cookies bind an HMAC to a value but not
to the cookie it was issued for. Fixing these individually leaves the gap that produced them; this
change closes the gap and then the findings.

## What Changes

Grouped into six independently-deliverable workstreams (see `design.md` for the dependency graph and
which may run in parallel).

**A — Canonical request path (SEC-02 P1, SEC-09 P2, SEC-15 P3)**
- New `canonicalizePath()` in `@nextrush/router` as the single owner of request-path normalization:
  case folding, slash collapsing, trailing-slash policy, and RFC 3986 §5.2.4 dot-segment handling.
- Paths containing `.`/`..` segments (raw or percent-encoded) are **rejected with 400**, not resolved —
  consistent with the framework's stated preference for rejecting invalid input over recovering.
- The matched path becomes observable: `ctx.path` carries the canonical value the router matched,
  with the untouched target available as `ctx.originalPath`. **BREAKING** (`ctx.path` semantics).
- `app.use(prefix, mw)` and mounted-router prefix matching use router normalization, so developers
  never hand-roll `startsWith`.
- CSRF `excludePaths` matches canonical paths only; `/*` matches exactly one segment, `/**` any depth.
- **BREAKING**: `caseSensitive` default flips `false` → `true` (RFC 3986 §6.2.2.1; Fastify parity).

**B — Typed proxy trust boundary (SEC-01 P1)**
- **BREAKING**: `proxy: boolean` → `proxy: false | number | string[]` — hop count or trusted-peer
  CIDR list. `X-Forwarded-For` is walked right-to-left, stopping at the first address outside the
  trust set; `cf-connecting-ip` is honored only when the direct peer is a trusted Cloudflare range.
- `proxy: true` throws at boot with an actionable message naming both replacements.
- `@nextrush/rate-limit` stops accepting the first of eight spoofable headers and consumes the
  single shared policy via `ctx.ip`.

**C — CSRF correctness (SEC-03, SEC-04, SEC-05 P2, SEC-06 P2, SEC-19 P4)**
- An omitted `cookie.maxAge` emits **no** `Max-Age` attribute (session cookie, as documented today
  and not implemented) instead of `Max-Age=0`, which deletes the cookie on arrival.
- `originCheck` defaults `true`, validates `Origin` against a configured origin allowlist (never
  against the attacker-controlled `Host`), treats a missing `Origin` on an unsafe method as failure,
  and reads `Sec-Fetch-Site` only as a reject signal — never as an allow signal.
- Session binding becomes an explicit decision: `csrf()` throws unless given `getSessionIdentifier`
  or `sessionBinding: 'none'`.
- `constantTimeEqual()` stops blinding with the hardcoded key `'csrf-compare'` and stops re-importing
  a `CryptoKey` on every request; cheap shape checks run before any crypto.
- The default token extractor drops the `?_csrf=` query fallback (tokens in logs/`Referer`/history).

**D — Cookie integrity and transport (SEC-07, SEC-08 P2, SEC-18 P4)**
- **BREAKING**: signed cookies HMAC a length-prefixed `(name, value, issuedAt)` tuple — the same
  construction `@nextrush/csrf` already uses correctly — so a signed value is not portable between
  cookie names. Verification rejects on name mismatch and on an optional embedded expiry. Ships with
  a rotation window that accepts legacy value-only signatures behind an explicit opt-in flag.
- `secure` defaults to `'auto'`: emitted unless the request is demonstrably plaintext loopback.
- The curated public-suffix heuristic gains a `publicSuffixList` injection point and warns (not
  throws) on an unrecognized multi-label suffix.

**E — Response and content boundaries (SEC-10, SEC-11 P2, SEC-12, SEC-13, SEC-14, SEC-17 P3)**
- CORS ships a conservative default `allowedHeaders` set and **intersects** the preflight request
  against it instead of echoing `Access-Control-Request-Headers`.
- `serveStatic({ untrusted: true })` forces `Content-Disposition: attachment`, a
  `sandbox; default-src 'none'` CSP, and neutralizes `image/svg+xml` / `text/html` to
  `application/octet-stream` — the upload-then-serve stored-XSS path.
- `assertHeaderSafe()` validates the full RFC 9110 field-name token and field-value grammar, not
  only CR/LF, and throws a typed error.
- `sendFile()` opens by handle then `fstat`s the descriptor, closing the `lstat`→open symlink race.
- `includeStack` is ignored in production regardless of configuration, warning once.
- Compression documents the BREACH interaction, honors `Cache-Control: no-transform`, and exposes a
  `skip` predicate.

**F — Secure-by-default enforcement, fuzzing, and the session position (SEC-16 P3)**
- A boot-time production security audit throws or warns on: `proxy: true`, cookies without `Secure`,
  `cors({ origin: true, credentials: true })`, `includeStack: true`, `dotfiles: 'allow'`.
- A `security()` composite preset composing helmet + strict cookies + CSRF + rate limit.
- Property/fuzz suites for `parseCookies`, `parseUrlEncoded`/`setNestedValue`, `parseRange`,
  `extractBoundary`; a raw-socket malformed-request suite (duplicate `Content-Length`,
  `Content-Length` + `Transfer-Encoding`, oversized headers, Slowloris, absent/multiple `Host`).
- SEC-16 is resolved as a **documented position plus an approved RFC** for `@nextrush/session`; the
  package itself is a separate RFC-gated change, not scope here.

## Capabilities

### New Capabilities
- `security-boundaries`: The framework's cross-package security contract — the security semantics of
  `@nextrush/{cookies,csrf,cors,helmet,static,rate-limit,compression}`, the secure-default set each
  must ship, the boot-time production audit, and the fail-closed rules every security middleware
  obeys. **Justification for a new capability rather than added requirements:** no capability in the
  fixed list owns this. `portable-middleware` owns edge-portability (Web globals over `node:*`,
  runtime-support declarations) — not security behavior; `core-middleware` owns the `compose()`
  engine. These security guarantees are durable, cross-package, and named after a permanent thing,
  and today they are unspecified — which is why 11 findings were possible.

### Modified Capabilities
- `router`: ADDED — `canonicalizePath()` as the single normalization owner; dot-segment rejection
  (400); canonical path published for policy consumers; prefix/mount matching uses router
  normalization. MODIFIED — `caseSensitive` default `false` → `true` (**BREAKING**).
- `node-adapter`: MODIFIED — `ctx.ip` resolves through the typed proxy trust spec (right-to-left XFF
  walk, trusted-peer gate) instead of leftmost XFF; `ctx.path` exposes the canonical matched path
  with `ctx.originalPath` added (**BREAKING**).
- `web-adapters`: MODIFIED — identical client-IP trust policy and canonical-path semantics on
  Bun/Deno/Edge, including the `cf-connecting-ip` precedence now being peer-gated.
- `runtime-adapter-contract`: ADDED — header-write safety (full RFC 9110 field validation) and the
  client-IP trust policy become conformance-pinned parity requirements across all adapters.

## Impact

**Packages changed**: `router`, `runtime`, `adapters/{node,bun,deno,edge,serverless}`,
`middleware/{csrf,cookies,cors,static,rate-limit,compression,body-parser}`, `errors`, `core`,
`adapters/conformance`.

**Public API — breaking, all requiring a migration guide**: `proxy` option type; `ctx.path`
semantics + new `ctx.originalPath`; router `caseSensitive` default; signed-cookie signature format;
CSRF `csrf()` now throws without a session-binding decision; CORS default `allowedHeaders`.
Per-package `public-surface-lock` tests are updated for the new exports (`canonicalizePath`, proxy
trust types, `security()`), which adds locked symbols without changing that capability's
requirements.

**Non-breaking behavior changes** developers will notice: paths with dot segments now 400; CSRF
origin checking on by default; `Secure` on cookies by default outside loopback.

**Not in scope** (tracked as follow-ups, not silently dropped): the `@nextrush/session` package
implementation; the security review's un-reviewed surface — Node request parsing beyond the new
malformed-request suite, `multipart/parser.ts` + `scanner.ts` + `storage/`, `body-parser/json.ts`
charset handling, `@nextrush/template` auto-escaping (a first-order XSS surface), `class` guards and
interceptors, `websocket`/`stream`/`openapi`/`logger`. These need their own audit change; this one
resolves the findings that exist, and the suites it adds are where the next audit's evidence comes
from.

**Durable decisions that must land in `docs/RFC/` before this change is archived** (each RFC-gated,
approved before implementation): (1) the typed proxy trust boundary replacing the boolean;
(2) canonical request path ownership, including dot-segment rejection and the `caseSensitive` flip;
(3) context-bound signature construction for signed artifacts; (4) the `@nextrush/session` position
and design. Each also gets a terse ADR from `docs/adr/TEMPLATE.md`.
