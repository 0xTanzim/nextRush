# @nextrush/cookies — Architecture

> Internal design of RFC 6265-compliant parsing/serialization, HMAC-SHA256 signing over the Web Crypto API, and the eager-write model that keeps `Set-Cookie` correct under NextRush's request lifecycle.

## At a glance

|  |  |
| --- | --- |
| **Package** | `@nextrush/cookies` |
| **Layer** | `middleware` (above `types`; below nothing — a leaf middleware) |
| **Depends on** | `@nextrush/types` (types only, erased at build) — no third-party runtime deps |
| **Depended on by** | Application code that calls `app.use(cookies())` / `app.use(signedCookies(...))`; not depended on by any other `@nextrush/*` package |
| **Public entry** | `src/index.ts` (barrel — exports only) |
| **Internal modules** | 8 files (excl. tests) · 2,245 LOC · largest `validation.ts` 671 LOC (package cap 300 — see Contributor notes) |
| **On the request hot path?** | Yes — parses the `Cookie` header on every request once registered; signing/verification runs per `get()`/`set()` call on a signed cookie |
| **Runtime coupling** | None — zero `node:` imports; uses only `crypto.subtle`, `TextEncoder`, `btoa`/`atob` |
| **State model** | Per-request parsed-cookie object; a small app-scoped bounded `CryptoKey` cache shared across requests |

## Responsibilities

**This package owns:**

- **Cookie parsing** — turning a raw `Cookie` header into a name/value object, RFC 6265-shaped (first duplicate wins, bounded count)
- **Cookie serialization** — building a valid, security-hardened `Set-Cookie` string, including `__Secure-`/`__Host-` prefix rule enforcement
- **Cookie signing** — HMAC-SHA256 sign/verify for tamper detection, with key-rotation fallback
- **Validation** — RFC 6265 name/value rules, CRLF/control-character stripping, domain/path/public-suffix checks, size limits
- **The `ctx.state.cookies` / `ctx.state.signedCookies` request-scoped API**

**This package does NOT own:**

- CSRF token generation or the double-submit comparison → [`@nextrush/csrf`](../csrf), which manages its own cookie independently of this package
- Encrypting cookie contents → not implemented anywhere in this package; signing is integrity-only (see Non-goals)
- Server-side session storage → the application; this package only signs/verifies a value the client holds, never persists anything itself
- General HTTP security headers → [`@nextrush/helmet`](../helmet)
- The middleware execution engine (`compose`, `ctx.next()`) → `@nextrush/core`

## Non-goals

The package intentionally does not:

- Encrypt cookie values — `signCookie()`/`unsignCookie()` provide tamper-detection (HMAC) only; the signed value's plaintext remains readable by anyone with cookie access. A confidentiality layer (AES-GCM or similar) is a distinct, unimplemented concern
- Implement the full IANA Public Suffix List — `COMMON_PUBLIC_SUFFIXES` is a curated, hand-maintained set of common TLDs and shared-hosting suffixes (a footgun-prevention heuristic per its own source comment), not the exhaustive PSL
- Provide a session store — `signedCookies()` signs/verifies a client-held value; it has no concept of a server-side session record
- Rotate signing keys automatically — `previousSecrets` is consulted, in order, only during verification; the application decides when to add or drop an entry

## Constraints

Must remain:

- **Runtime-independent** — zero `node:*` imports; signing uses only the Web Crypto API (`crypto.subtle`) and standard globals (`TextEncoder`, `btoa`, `atob`), identical on Node, Bun, Deno, and Edge
- **Zero third-party dependency** — a types-only dependency on `@nextrush/types`
- **ESM-only** — no CommonJS build
- **Fail-secure on ambiguity** — a missing, malformed, or unverifiable signed value returns `undefined`, never a partially-trusted value
- **Public API sealed** — the exported surface is semver-guarded (ADR-0005), locked by `__tests__/public-surface.test.ts`

## Position in the package hierarchy

```mermaid
flowchart TB
    types["@nextrush/types"] --> errors["@nextrush/errors"] --> core["@nextrush/core"]
    core --> router["@nextrush/router"] --> runtime["@nextrush/runtime"] --> di["@nextrush/di"] --> class["@nextrush/class"]
    class --> adapters["adapter-node / bun / deno / edge"] --> middleware["middleware / extensions"]
    THIS["@nextrush/cookies — this package"]:::here
    middleware --> THIS
    classDef here fill:#2563eb,color:#fff,stroke:#1e40af;
```

> [!IMPORTANT]
> Imports flow **downward only**. `@nextrush/cookies` imports from `@nextrush/types` only, and
> MUST NOT be imported by `types`, `errors`, `core`, `router`, `class`, or any adapter
> (project-rules §1). It sits at the middleware layer as a leaf: nothing in the framework core
> depends on it — an application opts in by calling `app.use(cookies())` or
> `app.use(signedCookies(...))`.

**Dependency rules:**
- **Allowed:** `cookies → types`
- **Forbidden:** `cookies → core / router / class / adapters / any other middleware package`

---

## Overview

The package splits into four independent concerns that compose rather than couple: **parsing** (`parser.ts`) turns the raw `Cookie` header into a plain object; **validation** (`validation.ts`) is a set of pure predicate/throwing functions with no dependency on the other three modules; **serialization** (`serializer.ts`) builds a `Set-Cookie` string by calling into validation before emitting anything; and **signing** (`signing.ts`) is a self-contained HMAC layer that knows nothing about cookies, headers, or `Context` at all — it only signs and verifies strings.

`middleware.ts` is the only module that touches `Context`. It wires the other four together into two middleware factories — `cookies()` for plain read/write access, `signedCookies()` for the same shape with signing interposed on every `get()`/`set()`. The two are separate functions, not one function with a `signed: true` flag, because a signed cookie's `get()`/`set()` are necessarily `async` (they call into `crypto.subtle`), while a plain cookie's are not — merging them into one API would force every consumer to `await` even when no signing is happening.

The most consequential design decision in the package is *when* `Set-Cookie` gets written. NextRush's response commits as soon as a handler calls `ctx.json()`/`ctx.send()`/etc — there is no post-handler "flush headers" phase this middleware can hook into after the fact. So `set()` and `delete()` on both `ctx.state.cookies` and `ctx.state.signedCookies` call `ctx.set('Set-Cookie', ...)` immediately, inside the same synchronous (or awaited) call, rather than deferring to a buffered array written out after `next()`. The middleware's own `await next()` at the end exists to let downstream handlers run and call `set()`/`delete()` themselves — it does not defer or batch anything this middleware itself wrote.

### Design principles

1. **Signing has no HTTP or cookie knowledge.** `signCookie`/`unsignCookie`/`unsignCookieWithRotation` in `signing.ts` operate only on strings and a secret — enforced by the module never importing `Context`, `Middleware`, or anything from `types.ts` beyond its own `SigningKeys` type.
2. **Set-Cookie is written eagerly, at `set()`/`delete()` call time, never buffered.** Every mutation path in `middleware.ts` (`cookies()` and `signedCookies()` alike) calls `ctx.set('Set-Cookie', ...)` in the same statement that computes the serialized value — there is no intermediate array flushed later, because NextRush's response can commit before any "later" would run.
3. **Ambiguous verification failure resolves to `undefined`, never to a distinguishable error.** `unsignCookie()`'s `catch` block and its "missing separator"/"empty value or signature" branches all return the same `undefined` — a tampered signature, a malformed base64 payload, and a genuinely absent cookie are indistinguishable to the caller by construction.
4. **Validation is layered: predicate functions for checking, throwing functions for enforcing.** `validateCookieName`/`validateDomain`/etc. return a `ValidationResult` for callers that want to inspect all errors; `validateCookieOptions`/`validateCookiePrefix` wrap the same checks and throw a `SecurityError` on the first failure — `serializeCookie()` uses only the throwing versions, so a caller cannot accidentally construct an invalid cookie by ignoring a boolean return value.
5. **Read-after-write is consistent within a single request.** `cookies()`'s `set()`/`delete()` mutate the in-memory `parsed` object in addition to writing the header, so a handler that calls `set('x', 'y')` and then `get('x')` later in the same request sees `'y'`, not the pre-request value — even though the actual header the browser receives is unaffected by this in-memory update.

---

## Module structure

```text
src/
├── index.ts        # Public API barrel (exports only, no implementation)
├── types.ts        # CookieOptions, CookieContext, SignedCookieContext, middleware option types
├── constants.ts     # DEFAULT_COOKIE_OPTIONS, size/length limits, prefixes, HMAC config
├── parser.ts        # parseCookies, getCookie, hasCookie, getCookieNames
├── serializer.ts     # serializeCookie, createDeleteCookie, createSecurePrefixCookie, createHostPrefixCookie
├── signing.ts         # signCookie, unsignCookie, unsignCookieWithRotation, timingSafeEqual, clearKeyCache
├── validation.ts      # RFC 6265 + security validation — predicates and throwing enforcers
└── middleware.ts       # cookies(), signedCookies(), secureOptions(), sessionOptions()
```

### Module responsibilities

| Module | Responsibility (the one thing it owns) |
| ------ | -------------------------------------- |
| `types.ts` | The public option/data contracts — no logic. |
| `constants.ts` | Every literal default, size limit, and HMAC parameter, in one place. |
| `parser.ts` | Turning a `Cookie` header string into a plain object — no serialization, no signing. |
| `serializer.ts` | Turning a name/value/options triple into a valid `Set-Cookie` string — calls into `validation.ts`, never `signing.ts`. |
| `signing.ts` | HMAC-SHA256 sign/verify over strings — no dependency on `Context`, cookies, or HTTP. |
| `validation.ts` | RFC 6265 and security rule checking — pure predicates plus throwing enforcers, no dependency on `signing.ts` or `parser.ts`. |
| `middleware.ts` | The only module that touches `Context` — wires parsing/serialization/signing/validation into the `cookies()`/`signedCookies()` middleware and the two option-preset helpers. |

## Component relationships

```mermaid
graph TD
    Middleware[middleware.ts: cookies / signedCookies] --> Parser[parser.ts: parseCookies]
    Middleware --> Serializer[serializer.ts: serializeCookie / createDeleteCookie]
    Middleware --> Signing[signing.ts: signCookie / unsignCookieWithRotation]
    Middleware --> Validation[validation.ts: sanitizeCookieValue]
    Serializer --> Validation
    Parser --> Validation
    Signing --> KeyCache[signing.ts: importKey — bounded CryptoKey cache]
```

`signing.ts` never imports from `parser.ts`, `serializer.ts`, `validation.ts`, or `@nextrush/types` — it has no dependency on cookies or `Context` at all, so it can be reasoned about (and tested) purely as a string-signing primitive.

---

## Lifecycle

### Signed-cookie value lifecycle (state machine)

The states a single signed cookie value passes through, from a plain value being signed to a later request verifying it — including the fork where verification fails:

```mermaid
stateDiagram-v2
    [*] --> Plaintext: application calls set(name, value)

    Plaintext --> Signed: signCookie(value, secret)\nHMAC-SHA256 over value, base64url signature appended
    Signed --> CookieSet: Set-Cookie written immediately\n(value.signature)

    CookieSet --> Received: browser sends it back\non a later request

    Received --> VerifyingCurrent: unsignCookieWithRotation()\ntries keys.current first
    VerifyingCurrent --> Verified: signature matches current secret
    VerifyingCurrent --> VerifyingPrevious: signature does not match current\n(only if previousSecrets configured)

    VerifyingPrevious --> Verified: signature matches a previous secret\n(tried in array order)
    VerifyingPrevious --> Rejected: no configured secret verifies

    VerifyingCurrent --> Rejected: no previousSecrets configured\nand current secret does not match

    Verified --> [*]: get() resolves to the original value
    Rejected --> [*]: get() resolves to undefined\n(identical outcome to "cookie absent")
```

> [!NOTE]
> There is no distinct `Tampered` end state in this diagram, and that absence is deliberate:
> `Rejected` is reached by a tampered signature, a malformed base64 payload, a missing separator,
> or a genuinely absent cookie — `unsignCookie()`'s `catch` block and its early-return branches
> all converge on the same `undefined`. A contributor adding a new failure mode to `unsignCookie`
> must route it through this same `Rejected` state, not a newly distinguishable one, or callers
> gain an oracle for probing which failure occurred.

### Request parse / signed get-set sequence

How a request flows through `signedCookies()` — the more involved of the two middleware, since `cookies()`'s `get()`/`set()` are the same shape minus the `await crypto.subtle` calls:

```mermaid
sequenceDiagram
    participant Client
    participant MW as signedCookies() middleware
    participant Parse as parseCookies()
    participant Handler as downstream handler
    participant Sign as signCookie()
    participant Verify as unsignCookieWithRotation()
    participant Crypto as crypto.subtle (Web Crypto API)

    Client->>MW: GET /check-role\n(Cookie: role=<value>.<sig>)
    MW->>Parse: parseCookies(ctx.headers.cookie)
    Parse-->>MW: parsed { role: "<value>.<sig>" }
    MW->>MW: ctx.state.signedCookies = { get, set, delete }
    MW->>Handler: await next()

    Handler->>Verify: await ctx.state.signedCookies.get('role')
    Verify->>Verify: unsignCookie(parsed.role, keys.current)
    Verify->>Crypto: importKey(current secret) [cached after first use]
    Crypto-->>Verify: CryptoKey
    Verify->>Crypto: crypto.subtle.verify(signature, value)

    alt signature verifies against current secret
        Crypto-->>Verify: true
        Verify-->>Handler: value
    else signature fails, previousSecrets configured
        Crypto-->>Verify: false
        loop each previous secret, in order
            Verify->>Crypto: crypto.subtle.verify(signature, value)
            Crypto-->>Verify: true or false
        end
        alt a previous secret verified
            Verify-->>Handler: value
        else none verified
            Verify-->>Handler: undefined
        end
    end

    Handler->>Sign: await ctx.state.signedCookies.set('role', 'admin')
    Sign->>Crypto: importKey(current secret) [cache hit if already imported]
    Crypto-->>Sign: CryptoKey
    Sign->>Crypto: crypto.subtle.sign(HMAC, key, value)
    Crypto-->>Sign: signature bytes
    Sign->>Sign: toBase64Url(signature) -> "value.signature"
    Sign->>MW: ctx.set('Set-Cookie', serialized)
    Note over MW,Client: Set-Cookie written immediately here —\nnot deferred until the handler returns
    Handler-->>Client: response (already carries Set-Cookie)
```

The ordering a reader would otherwise get wrong: **`get()` tries `keys.current` before any `previousSecrets` entry, in that fixed order** — a rotation only ever adds fallback verification for old cookies, it never changes which secret a *new* `set()` signs with (always `keys.current`). And **`Set-Cookie` is written the instant `set()`/`delete()` is called**, inside the async function itself — a contributor tempted to batch multiple `Set-Cookie` writes and flush them at the end of the request would break real usage, because a handler can call `ctx.json()` (committing the response) at any point after `set()`.

## State ownership

| Owner | State it owns | Scope |
| ----- | ------------- | ----- |
| `parsed` (closure inside `cookiesMiddleware`/`signedCookiesMiddleware`) | The request's parsed `Cookie` header, mutated in place by `set()`/`delete()` for read-after-write consistency | per request |
| `KEY_CACHE` (module-level `Map` in `signing.ts`) | Up to 10 imported `CryptoKey` objects, keyed by secret string | app — shared across every `signedCookies()` instance and every request in the process |
| `Context` (owned by `core`) | Response headers (`Set-Cookie`, appended per call), `ctx.state.cookies` / `ctx.state.signedCookies` | per request |
| Client's cookie store | The (possibly signed) cookie value itself | per browser/client — outlives any single request |

There is no per-request mutable state shared *across* requests — `parsed` is recreated fresh on every request via a new call to `parseCookies()`. `KEY_CACHE` is the one piece of app-scoped state, bounded (`MAX_CACHED_KEYS = 10`) with FIFO eviction (the same shape as `@nextrush/csrf`'s equivalent cache).

## Data structures

```ts
// The signed value format itself (signing.ts) — not a typed structure, but a fixed
// string shape produced by signCookie() and consumed by unsignCookie():
//   `${value}.${base64UrlSignature}`     e.g. "admin.k3F9x...Q1z_"
// The separator is SIGNATURE_SEPARATOR ('.'); splitting uses lastIndexOf, so a
// value containing '.' itself does not break parsing — only the final '.' is
// treated as the separator.

// The two request-scoped context shapes this package attaches (types.ts):
interface CookieContext {
  get(name: string): string | undefined;
  set(name: string, value: string, options?: CookieOptions): void;
  delete(name: string, options?: Pick<CookieOptions, 'domain' | 'path'>): void;
  all(): ParsedCookies;
  has(name: string): boolean;
}

interface SignedCookieContext {
  get(name: string): Promise<string | undefined>;      // async: verifies via crypto.subtle
  set(name: string, value: string, options?: CookieOptions): Promise<void>; // async: signs via crypto.subtle
  delete(name: string, options?: Pick<CookieOptions, 'domain' | 'path'>): void; // sync: no crypto involved
}
```

`SignedCookieContext.delete` is deliberately synchronous while `get`/`set` are not — deleting never touches `crypto.subtle` (there is nothing to sign or verify when expiring a cookie), so making it `async` would only add an unnecessary microtask with no work behind it. This asymmetry inside one interface is intentional, not an oversight: it mirrors exactly which operations the implementation actually needs to await.

## Concurrency & edge behaviour

- **Shared, mutable, bounded:** `KEY_CACHE` in `signing.ts` — a `CryptoKey` is imported once per distinct secret string and reused; eviction is FIFO once the cache reaches 10 entries. Concurrent requests using the same secret share the cached key with no explicit lock (JS's single-threaded event loop makes the read-check-insert sequence safe without synchronization, the same reasoning `@nextrush/csrf`'s equivalent cache relies on).
- **Per-request, never shared:** the `parsed` object built fresh by `parseCookies()` on every request, and the `CookieContext`/`SignedCookieContext` closures created for that request.
- **Idempotency:** parsing and verification are pure functions of their input (header string, secret) — replaying an identical request against unchanged cookie state and secrets produces an identical result. `set()`/`delete()` are not idempotent in the sense that matters here: each call unconditionally appends another `Set-Cookie` header via `ctx.set`, so calling `set()` twice for the same name in one request sends two `Set-Cookie` headers (the browser applies the last one for a given name/domain/path).
- **Malformed input:** a `decodeURIComponent` failure during parsing falls back to the raw value rather than throwing; a `crypto.subtle.verify` failure (malformed base64, corrupted bytes) is caught inside `unsignCookie()` and treated identically to a bad signature — both resolve to `undefined`, never to a thrown error escaping the middleware.

> [!WARNING]
> `previousSecrets` is checked in array order on every single `get()` call for a signed cookie
> whose current-secret verification failed — there is no per-request caching of "which previous
> secret this specific cookie verified against." A contributor adding a large `previousSecrets`
> list should be aware that a signed-cookie read during a rotation window costs one
> `crypto.subtle.verify` call per configured secret, in the worst case, not one.

## Trust boundaries

```text
Client-supplied Cookie header — fully attacker-controlled
   │
   ▼
parseCookies()  -- RFC 6265 split + CRLF/control-char sanitization         <- this package's entry point
   │
   ▼
unsignCookie() / unsignCookieWithRotation()  -- HMAC signature check       <- only for cookies read via signedCookies()
   │                                              (plain cookies() never verifies anything)
   ▼
application code reading ctx.state.cookies / ctx.state.signedCookies       <- trust boundary this package enforces ends here
```

For plain `cookies()`, every value returned by `get()`/`all()` is attacker-controlled input that has only been *sanitized* (CRLF/control characters stripped), never *verified* — the application is responsible for treating it accordingly (e.g. not trusting a plain cookie for authorization decisions). For `signedCookies()`, a value that survives `get()` is additionally *proven* to have been produced by a holder of `secret` (or a `previousSecrets` entry) — but it is still not confidential; the boundary this package enforces is integrity, not disclosure control.

## Extension points

**Supported extension points:**

- **`decode`** (on `cookies()`) — the sanctioned way to customize value decoding beyond `decodeURIComponent`; the result is always re-sanitized for CRLF regardless of what the custom function returns.
- **`previousSecrets`** (on `signedCookies()`) — the sanctioned way to support key rotation without this package taking a dependency on any specific secret-management system.
- **The exported low-level primitives** (`signCookie`, `unsignCookie`, `parseCookies`, `serializeCookie`, the validators) — exposed specifically so advanced integrations can build a custom middleware shape without re-implementing RFC 6265 handling or the crypto.

**Forbidden (sealed):**

- **The signed-value format (`value.signature`, `SIGNATURE_SEPARATOR`)** — changing the separator or the base64 encoding breaks verification of every cookie signed before the change; RFC-gated.
- **Collapsing "tampered" and "absent" into distinguishable outcomes** — `unsignCookie()`'s single `undefined` return for every failure mode is a deliberate anti-oracle property, not an implementation gap to "improve."
- **Deferring `Set-Cookie` writes past the `set()`/`delete()` call** — see Design principle 2; NextRush's response-commit timing makes any buffered/deferred write model incorrect for handlers that respond before a would-be flush point.

---

## Architectural invariants

These are part of the package's architecture. They do not change without an RFC:

- **Signing provides integrity, never confidentiality** — a signed cookie's value remains plaintext-readable; there is no encryption path anywhere in this package.
- **`Set-Cookie` is written synchronously (or immediately upon promise resolution) inside `set()`/`delete()`, never buffered for a later flush.**
- **Verification failure of every kind — missing cookie, malformed value, bad signature — resolves to `undefined`, with no distinguishable error surfaced to the caller.**
- **`previousSecrets` are only ever consulted for verification, in array order, after `current` fails — they are never used for signing new values.**
- **`__Secure-`/`__Host-` prefix constraints are validated together, synchronously, inside `serializeCookie()` before any header is built.**
- **The package imports no runtime API** — zero `node:*` imports; the same code path runs identically on Node, Bun, Deno, and Edge runtimes.

## Engineering decisions

| Decision | Chosen | Trade-off accepted | Reference |
| -------- | ------ | ------------------ | --------- |
| Signing scope | Integrity only (HMAC-SHA256), no encryption | Simpler package, single well-understood primitive — at the cost of not solving confidentiality; callers needing that must add their own encryption layer | `signing.ts` |
| Plain vs. signed cookie API | Two separate middleware/context shapes, not one flag | Avoids forcing every plain-cookie caller to `await`, at the cost of two similar-looking APIs to choose between | `middleware.ts` |
| `Set-Cookie` write timing | Eager, at `set()`/`delete()` call time | Correct under NextRush's commit-on-first-write response model, at the cost of no single place to see "all cookies set this request" without re-reading response headers | `middleware.ts` |
| Verification failure surface | One undistinguishable `undefined` outcome | Removes an oracle for probing cookie presence vs. tampering, at the cost of harder debugging when a secret mismatch is the real cause (see Troubleshooting) | `signing.ts` |
| Public suffix list | Curated common-suffix set, not the full PSL | Zero dependency, small bundle, catches the common footguns (`.com`, `github.io`, etc.) — at the cost of not catching every real-world public suffix | `constants.ts`, `validation.ts` |
| `CryptoKey` caching | Bounded `Map`, FIFO eviction at 10 entries | Avoids re-importing a key on every sign/verify call for the common single/rotating-secret case, mirroring `@nextrush/csrf`'s identical strategy | `signing.ts` (`importKey`) |

## Rejected alternatives

### Encrypting cookie values by default
Rejected: encryption adds key-management complexity (an encryption key distinct from a signing key, IV handling, and a decision on cipher/mode) that most cookie use cases — session IDs, preference flags — do not need, since the actual secret data those reference typically lives server-side already. Signing-only was chosen to keep the package's scope and dependency footprint minimal; an application that genuinely needs confidential cookie contents can layer its own encryption before calling `set()`.

### One unified `cookies({ signed: true })` API
Rejected: a single factory branching on a `signed` option would still need `get`/`set` to be `async` whenever signing is enabled, forcing every plain-cookie call site to either always `await` (even when unsigned) or deal with a conditionally-async return type — neither is clean in TypeScript. Two distinct factories with two distinct context shapes were chosen instead, at the cost of the application picking the right one.

### Distinguishable error codes for verification failure
Rejected: returning something like `{ ok: false, reason: 'tampered' }` versus `{ ok: false, reason: 'missing' }` would improve debuggability but hands an attacker a way to probe whether a specific signed cookie name is currently set on a victim's browser, purely from the response's error shape. A single `undefined` outcome was chosen to close that oracle, accepting the debugging cost documented in Troubleshooting.

---

## Testing strategy

- **Unit:** parsing edge cases (duplicate names, malformed pairs, quoted values, `maxCookies` cutoff), serialization for every attribute combination and both prefixes, sign/verify round-trips with and without rotation, and every validator (`validateCookieName`, `validateDomain`, `isPublicSuffix`, etc.) individually.
- **Integration:** the full `cookies()` and `signedCookies()` middleware against simulated `Context` objects, covering read-after-write consistency within a request, repeated-header joining, and the `secureOptions()`/`sessionOptions()` presets.
- **Security-focused suite:** a dedicated `security.test.ts` and `edge-cases.test.ts` exercise CRLF/header-injection attempts, prototype-pollution-shaped names, and public-suffix domain rejection specifically.
- **Public-surface test:** `__tests__/public-surface.test.ts` asserts the exported runtime and type-only API shape stays in sync with the sealed surface (ADR-0005).
- **Conformance / cross-adapter parity:** N/A directly — the package uses no runtime API; identical behavior across adapters follows from having zero `node:` imports, verified indirectly by `packages/adapters/conformance`.
- **Coverage:** >=90% lines/functions (CI-enforced).

## Evolution strategy

- **Stable (semver-guarded):** the sealed public surface — `cookies()`, `signedCookies()`, every serialization/parsing/signing/validation export, and every type in `types.ts` (ADR-0005).
- **May change without notice:** `KEY_CACHE`'s exact eviction bookkeeping, the internal structure of `COMMON_PUBLIC_SUFFIXES`.
- **Changes only via RFC:** the signed-value format (`value.signature`), the "verification failure is always `undefined`" contract, and the `__Secure-`/`__Host-` prefix enforcement rules.

**Timeline:** 1.0 — initial release with RFC 6265 parsing/serialization, prefix validation, HMAC-SHA256 signing with rotation support, and the `cookies()`/`signedCookies()` middleware pair.

## Contributor notes

Before changing this package, read: `signing.ts`'s doc comment on `unsignCookie()`'s undistinguishable-`undefined` contract before adding any new failure path, and the `CK-*` inline comments in `middleware.ts` (each marks a specific hardening fix — eager `Set-Cookie` writes, read-after-write consistency, repeated-header joining, prefix-preserving deletion). Note also that `validation.ts` currently sits above the package's usual 300-line-per-file target (671 LOC) by consolidating name/value/prefix/domain/path validation into one file — a future split (e.g. extracting domain/path checks into their own module) is a reasonable non-breaking refactor, not an architectural change.

## Architecture checklist

Before changing this package, confirm:

- [ ] Does this preserve the architectural invariants above (especially the undistinguishable-verification-failure contract)?
- [ ] Does this increase coupling or cross a dependency rule (`cookies → types` only)?
- [ ] Does this affect the request hot path (allocations/crypto calls in `cookies()`/`signedCookies()`)?
- [ ] Does this change the sealed public API (semver / ADR-0005)? Does it need an RFC?
- [ ] If this touches signing/verification, does it remain fail-secure (deny/undefined on ambiguity) and avoid introducing a distinguishable oracle?

---

## References & see also

- **README (how to use it):** [`./README.md`](./README.md)
- **ADR:** [`ADR-0005 — package tiers & sealed surface`](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md)
- **Security boundary reference:** `.kiro/steering/project-rules.instructions.md` §4
- **Documentation site:** [nextRush docs](https://0xtanzim.github.io/nextRush/docs)
- **Repository:** [`packages/middleware/cookies`](https://github.com/0xTanzim/nextRush/tree/main/packages/middleware/cookies)
