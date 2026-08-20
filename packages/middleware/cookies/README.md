# @nextrush/cookies

> Cookie parsing, serialization, and HMAC-SHA256 signing for NextRush -- RFC 6265 compliant, with built-in header-injection and prefix-rule enforcement.

[![npm version](https://img.shields.io/npm/v/@nextrush/cookies.svg)](https://www.npmjs.com/package/@nextrush/cookies)
[![downloads](https://img.shields.io/npm/dm/@nextrush/cookies.svg)](https://www.npmjs.com/package/@nextrush/cookies)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/cookies.svg)](https://bundlephobia.com/package/@nextrush/cookies)
[![types](https://img.shields.io/npm/types/@nextrush/cookies.svg)](https://www.npmjs.com/package/@nextrush/cookies)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/cookies.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Parse, set, delete, and HMAC-sign cookies through the first-class `ctx.cookies` / `ctx.cookies.signed` API |
| **Package type** | Middleware |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install. Not re-exported from `nextrush` or `nextrush/class`. |
| **Support tier** | Public -- middleware/registrar (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal -- Node, Bun, Deno, Edge (Web Crypto API only, zero `node:` imports) |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x |
| **Introduced** | v1.0.0 |

## Highlights

- Zero third-party dependencies -- framework-internal only (`@nextrush/types`, `@nextrush/runtime` for the shared uninitialized stub, `@nextrush/errors` for the capability diagnostic)
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed, strict TypeScript, zero `any`
- RFC 6265 name/value validation plus `__Secure-`/`__Host-` prefix rule enforcement, CRLF header-injection stripping, and a curated public-suffix-domain guard -- hardened parsing, not bare string splitting

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Compatibility](#compatibility) . [Migrating signed cookies](#migrating-signed-cookies-to-the-name-bound-format) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

The `Cookie` request header and the `Set-Cookie` response header look trivial to handle by hand -- split on `;`, split on `=`, done. In practice, a hand-rolled version misses the rules that keep cookies from becoming a security liability: a value containing `\r\n` can inject an extra header into your response; a `__Host-` prefixed name has three attribute constraints (`Secure`, no `Domain`, `Path=/`) that must all hold together or the browser silently refuses the cookie; and a value the client tampered with looks exactly like a value the client didn't.

```ts
// TODAY, without this package -- looks fine, has real gaps:
function setCookie(res, name, value) {
  res.setHeader('Set-Cookie', `${name}=${value}`);
  // No CRLF check -- a value like "x\r\nSet-Cookie: evil=1" injects a header.
  // No prefix validation -- "__Host-session" silently fails in the browser
  // if Secure/Domain/Path aren't exactly right, and nothing here catches it.
  // No signature -- if this is session data, the client can edit it freely.
}
```

## When to use

**Use `@nextrush/cookies` if:**

- You need to read, set, or delete cookies through a safe API instead of hand-building `Set-Cookie` strings
- You want tamper-detection on cookie values (session flags, user preferences) without building a full session store
- You need `__Secure-`/`__Host-` prefixed cookies and want their attribute constraints enforced automatically rather than discovered in the browser

**Reach for something else if:**

- You need CSRF protection specifically -- the double-submit cookie pattern with token validation is [`@nextrush/csrf`](../csrf), which handles its own cookie internally
- You need encrypted (confidential) cookie contents -- signing proves a value was not tampered with, it does not hide the value from the client; see [FAQ](#faq)
- You need full session storage (server-side session data keyed by a session ID) -- this package only signs/verifies a value the client holds, it does not persist anything server-side. NextRush has no session package today; see the [session position](https://github.com/0xTanzim/nextRush/blob/main/docs/RFC/class-runtime/032-session-position.md) for what the framework commits to and when

---

## Installation

```bash
pnpm add @nextrush/cookies
# npm i @nextrush/cookies . yarn add @nextrush/cookies . bun add @nextrush/cookies
```

> [!NOTE]
> `@nextrush/cookies` is not re-exported by the `nextrush` meta package -- install and import it
> directly, as shown above.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { cookies } from '@nextrush/cookies';

const app = createApp();

app.use(cookies());

app.get('/login', (ctx) => {
  ctx.cookies.set('session', 'user-session-id', {
    httpOnly: true,
    secure: true,
    maxAge: 86400, // 1 day
  });
  ctx.json({ success: true });
});

app.get('/profile', (ctx) => {
  const session = ctx.cookies.get('session');
  ctx.json({ session });
});

listen(app, 8080);
```

`cookies()` parses the incoming `Cookie` header once per request and activates the first-class
`ctx.cookies` capability (`get`/`set`/`delete`/`all`/`has`). `set()`/`delete()` write the
`Set-Cookie` header immediately, in the same call -- there is nothing to flush later.

`ctx.cookies` is always present on the context: before the middleware runs, operations throw an
actionable `CapabilityNotInitializedError` (`COOKIES_NOT_INITIALIZED`) instead of an opaque
TypeError. `ctx.state.cookies` remains a deprecated alias for one release cycle.

## Capabilities

**Parsing**
- RFC 6265-shaped parsing of the `Cookie` header -- first occurrence of a duplicate name wins, matching the spec
- A repeated `Cookie` header (some proxies/HTTP-2 stacks surface it as an array) is joined with `; ` before parsing
- Caps parsing at 50 cookies per request (`maxCookies`) as a defense against an oversized header
- Values are URL-decoded and stripped of CRLF/control characters by default; a failed `decodeURIComponent` falls back to the raw value rather than throwing

**Serialization & validation**
- `serializeCookie()` builds the `Set-Cookie` string and enforces, at call time: valid RFC 6265 name characters, `__Secure-`/`__Host-` prefix attribute rules, non-public-suffix domains, `SameSite=None` paired with `Secure`, and a 4096-byte total size cap
- `createDeleteCookie()` expires a cookie by setting `Max-Age=0` and `Expires` to the epoch, while preserving the same prefix constraints the original cookie required
- `createSecurePrefixCookie()` / `createHostPrefixCookie()` add the `__Secure-`/`__Host-` prefix and force the attributes each prefix requires

**Signing (integrity, not encryption)**
- `signCookie()` / `unsignCookie()` sign and verify a value with HMAC-SHA256 via the Web Crypto API (`crypto.subtle`), binding the signature to the cookie *name* and an issue time -- a value signed for one cookie name cannot be replayed under a different name (see [Migrating signed cookies](#migrating-signed-cookies-from-10x-to-the-name-bound-format))
- `unsignCookieWithRotation()` tries the current secret first, then each `previousSecrets` entry in order, so an old signing key can still verify cookies issued before a rotation
- `acceptLegacySignatures` (off by default) accepts the pre-1.1 value-only format as a rotation fallback, logging a one-time deprecation warning per process
- Signing proves the value was not modified since it was signed and was issued for this exact cookie name; it does not hide the value -- a signed cookie's contents remain readable by anyone with cookie access

**Developer experience**
- Zero third-party dependencies beyond the framework-internal `@nextrush/types`/`@nextrush/runtime`/`@nextrush/errors`
- `secureOptions()` / `sessionOptions()` helper presets for common attribute combinations
- Fully typed, zero `any`; edge-safe (no `node:` imports anywhere in the package)

## Mental model

`cookies()` and `signedCookies()` are two separate middleware, not one with a flag -- `cookies()` gives you a plain read/write API, `signedCookies()` gives you the same shape but every `set()` signs and every `get()` verifies. Both write `Set-Cookie` the instant `set()`/`delete()` is called, because NextRush's response commits as soon as a handler sends a body -- there is no later "flush cookies" step to depend on.

```text
request --> cookies() --> parseCookies(header) --> ctx.cookies.{get,set,delete,all,has}
                                                          |
                                                          +-- set()/delete() --> ctx.set('Set-Cookie', ...) immediately

request --> signedCookies({ secret }) --> ctx.cookies.signed.{get,set,delete}
                                                |
                                                +-- get() --> unsignCookieWithRotation() --> value or undefined (tampered/missing)
```

**Rule:** a signed cookie's `get()` returns `undefined` for both "cookie not present" and "signature invalid" -- the same as `unsignCookie()`'s own contract -- so calling code cannot distinguish tampering from absence, by design.

> [!TIP]
> The full signing sequence and the middleware's parse/set/get lifecycle (with diagrams) are in
> [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Read, set, and delete a plain cookie

```ts
import { cookies } from '@nextrush/cookies';

app.use(cookies());

app.get('/theme', (ctx) => {
  ctx.cookies.set('theme', 'dark', { maxAge: 86400 });
  ctx.json({ ok: true });
});

app.get('/logout', (ctx) => {
  ctx.cookies.delete('session');
  ctx.json({ ok: true });
});
```

### Sign and verify a tamper-sensitive cookie

```ts
import { cookies, signedCookies } from '@nextrush/cookies';

app.use(cookies()); // signedCookies requires the parent capability
app.use(signedCookies({ secret: process.env.COOKIE_SECRET! }));

app.get('/set-role', async (ctx) => {
  await ctx.cookies.signed.set('role', 'admin', { httpOnly: true });
  ctx.json({ ok: true });
});

app.get('/check-role', async (ctx) => {
  const role = await ctx.cookies.signed.get('role');
  if (role === undefined) {
    // Missing, or the client edited the value -- both look identical here.
    ctx.status = 401;
    return ctx.json({ error: 'invalid or missing role cookie' });
  }
  ctx.json({ role });
});
```

### Rotate a signing secret without invalidating existing cookies

```ts
app.use(signedCookies({
  secret: process.env.COOKIE_SECRET_NEW!,
  previousSecrets: [process.env.COOKIE_SECRET_OLD!],
}));
```

Cookies signed under the old secret still verify (fallback order: current, then each `previousSecrets` entry) until they naturally expire; new cookies are always signed with the current secret only.

### Use a `__Host-` prefixed cookie for the strongest scoping

```ts
import { createHostPrefixCookie } from '@nextrush/cookies';

const header = createHostPrefixCookie('session', 'abc123', { httpOnly: true });
// '__Host-session=abc123; Secure; Path=/; HttpOnly'
```

### Apply secure defaults without repeating attributes

```ts
import { secureOptions } from '@nextrush/cookies';

ctx.cookies.set('session', value, secureOptions({ maxAge: 86400 }));
// httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 86400
```

## API overview

The sealed public surface (ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `cookies` | `(options?: CookieMiddlewareOptions) => Middleware` | 1.0.0 | Stable | The plain cookie middleware factory. Attaches `ctx.cookies`. |
| `signedCookies` | `(options: SignedCookieMiddlewareOptions) => Middleware` | 1.0.0 | Stable | The HMAC-signed cookie middleware factory. Attaches `ctx.cookies.signed`. Throws if `secret` is missing. |
| `secureOptions` / `sessionOptions` | `(options?: CookieOptions) => CookieOptions` | 1.0.0 | Stable | Attribute presets -- strict/secure and session-lifetime, respectively. |
| `serializeCookie` | `(name, value, options?) => string` | 1.0.0 | Stable | Builds a validated `Set-Cookie` string. Throws `SecurityError`/`RangeError` on invalid input. |
| `createDeleteCookie` | `(name, options?) => string` | 1.0.0 | Stable | Builds a `Set-Cookie` string that expires the named cookie. |
| `createSecurePrefixCookie` / `createHostPrefixCookie` | `(name, value, options?) => string` | 1.0.0 | Stable | Builds a `__Secure-`/`__Host-` prefixed `Set-Cookie` string with the prefix's required attributes forced. |
| `parseCookies` | `(header, options?: ParseOptions) => ParsedCookies` | 1.0.0 | Stable | Parses a raw `Cookie` header string into a plain object. |
| `getCookie` / `hasCookie` / `getCookieNames` | `(header, name?) => ...` | 1.0.0 | Stable | Convenience wrappers over `parseCookies`. |
| `signCookie` / `unsignCookie` | `(name, value, secret, options?) => Promise<string>` / `(name, signedValue, secret, options?) => Promise<string \| undefined>` | 1.0.0-beta.0 | Stable | Context-bound HMAC-SHA256 sign/verify -- `name` binds the signature to that exact cookie, for advanced use. |
| `unsignCookieWithRotation` | `(name, signedValue, keys: SigningKeys, options?) => Promise<string \| undefined>` | 1.0.0-beta.0 | Stable | Verifies against `keys.current`, then each `keys.previous` entry in order, always bound to `name`. |
| `resetLegacyAcceptanceWarning` | `() => void` | 1.0.0-beta.0 | Stable | Resets the once-per-process legacy-signature warning flag. Exposed for testing. |
| `clearKeyCache` | `() => void` | 1.0.0 | Stable | Clears the internal `CryptoKey` cache. Exposed for testing. |
| `timingSafeEqual` | `(a: string, b: string) => boolean` | 1.0.0 | Stable | Manual constant-time-shaped string comparison fallback -- the signing path itself uses `crypto.subtle.verify`, not this function. |
| `isValidCookieName` / `isValidCookieValue` / `isValidDomain` / `isValidPath` / `isPublicSuffix` | `(input: string) => boolean` | 1.0.0 | Stable | Boolean validators used internally and exposed for custom implementations. |
| `resetUnrecognizedSuffixWarning` | `() => void` | 1.0.0-beta.0 | Stable | Resets the once-per-process unrecognized-public-suffix warning flag. Exposed for testing. |
| `sanitizeCookieValue` | `(value: string) => string` | 1.0.0 | Stable | Strips CRLF, URL-encoded CRLF, and control characters from a value. |
| `validateCookieOptions` / `validateCookiePrefix` | `(options \| name, options) => void` | 1.0.0 | Stable | Throwing validators; `serializeCookie` calls both internally. |
| `SecurityError` | `class extends Error` | 1.0.0 | Stable | Thrown by validation failures; carries a `code` property. |
| `COOKIE_PREFIXES` / `COMMON_PUBLIC_SUFFIXES` / `DEFAULT_COOKIE_OPTIONS` / `MAX_COOKIE_SIZE` / `MAX_NAME_LENGTH` / `MAX_VALUE_LENGTH` | `const` | 1.0.0 | Stable | Constants for custom implementations. |
| `type CookieOptions` / `CookieContext` / `SignedCookieContext` / `CookieState` / `SignedCookieState` / `ParsedCookies` / `ParseOptions` / `SameSiteValue` / `CookiePriority` / `CookieMiddlewareOptions` / `SignedCookieMiddlewareOptions` / `SigningKeys` | -- | 1.0.0 | Stable | Public option and data contracts. |

## Options

Every default below is read directly from `src/constants.ts` and `src/types.ts`.

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `cookies()`: `decode` | `(value: string) => string` | No | `decodeURIComponent` (built into the parser) | No | A custom decode is re-sanitized for CRLF after running, so a decode function cannot reintroduce header-injection characters. |
| `cookies()` / `signedCookies()`: `trustProxy` | `boolean` | No | `false` | Yes | Trusts a `X-Forwarded-Proto: https` claim for `secure: 'auto'` resolution when the request itself is plaintext (TLS terminated upstream). An untrusted claim never suppresses `Secure` -- see [`secure: 'auto'`](#capabilities). |
| `cookies()`: `publicSuffixList` | `Iterable<string>` | No | `undefined` | Yes | Additional suffixes consulted alongside `COMMON_PUBLIC_SUFFIXES` for the `Domain` public-suffix guard; an unrecognized multi-label suffix warns once per process rather than throwing. |
| `signedCookies()`: `secret` | `string` | Yes | -- | Yes | Throws a `TypeError` at construction if missing or not a string. |
| `signedCookies()`: `previousSecrets` | `string[]` | No | `undefined` | Yes | Checked in array order after `secret` fails to verify. |
| `signedCookies()`: `maxAge` | `number` (seconds) | No | `undefined` | No | Enforced against the signed value's embedded issue time at verify time; a present issue time older than `maxAge` is rejected. Omit to skip expiry enforcement. |
| `signedCookies()`: `acceptLegacySignatures` | `boolean` | No | `false` | Yes | Accepts the pre-1.1 value-only signature format as a rotation fallback; see [Migrating signed cookies](#migrating-signed-cookies-from-10x-to-the-name-bound-format). Logs a deprecation warning once per process when exercised. |
| `CookieOptions.httpOnly` | `boolean` | No | `true` (via `DEFAULT_COOKIE_OPTIONS`, applied by `cookies()`'s `set()`/`serializeCookie`) | Yes | Prevents `document.cookie` access from JavaScript. |
| `CookieOptions.secure` | `boolean \| 'auto'` | No | `'auto'` (via `DEFAULT_COOKIE_OPTIONS`) | Yes | `'auto'` resolves per request: `Secure` on TLS or a trusted-forwarded-HTTPS request, omitted only on plaintext loopback, and emitted anyway (fail closed) if a plaintext non-loopback request carries an *untrusted* forwarded-HTTPS claim. An explicit `true`/`false` is always honored as given, and is required (not `'auto'`) to satisfy `__Secure-`/`__Host-` prefixes or `sameSite: 'none'`. |
| `CookieOptions.sameSite` | `'strict' \| 'lax' \| 'none' \| boolean` | No | `'lax'` | Yes | `'none'` (or `false`) requires `secure: true`, enforced by `validateCookieOptions`. |
| `CookieOptions.path` | `string` | No | `'/'` | No | `__Host-` prefix forces this to `'/'` regardless of what is passed. |
| `CookieOptions.domain` | `string` | No | `undefined` | Yes | Rejected if it resolves to a known public suffix (`isPublicSuffix`) or an invalid format; forbidden outright with `__Host-`. |
| `CookieOptions.maxAge` | `number` | No | `undefined` (session cookie) | No | Must be non-negative, or `serializeCookie` throws `RangeError`. |
| `CookieOptions.expires` | `Date \| number` | No | `undefined` | No | If both `maxAge` and `expires` are set, the serialized cookie includes both attributes as given -- `maxAge` is not deduplicated against `expires`. |
| `CookieOptions.priority` | `'low' \| 'medium' \| 'high'` | No | `undefined` | No | Chrome's `Priority` cookie extension. |
| `CookieOptions.partitioned` | `boolean` | No | `undefined` | No | CHIPS partitioned cookies. |
| `ParseOptions.maxCookies` | `number` | No | `50` (`MAX_COOKIES_PER_DOMAIN`) | Yes | Parsing stops once this many distinct names have been captured, bounding processing of an oversized `Cookie` header. |
| `ParseOptions.decode` / `ParseOptions.sanitize` | `boolean` | No | `true` / `true` | No | Disabling `sanitize` skips CRLF/control-character stripping on parsed values -- only intended for trusted, pre-validated input. |

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | 3.x |
| Node.js | >=22 |
| TypeScript | >=5.x |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js >=22 | Yes | ESM-only |
| Bun / Deno / Edge | Yes / Yes / Yes | Zero `node:` imports -- signing uses only `crypto.subtle`, `btoa`/`atob`, `TextEncoder` (Web Crypto API + standard globals) |

**Integration**
- **Peer dependencies:** none -- depends only on `@nextrush/types` (types, erased at build).
- **Works with:** [`@nextrush/csrf`](../csrf) for CSRF-specific token cookies (it manages its own cookie internally, independent of this package); a session middleware that stores a session ID in a cookie set through this package.
- **Incompatible with:** none directly, but `cookies()`'s `set()`/`delete()` write `Set-Cookie` immediately -- if another middleware also writes `Set-Cookie` after this one runs for the same name, both headers are sent (browsers apply the last one for a given name/domain/path).

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>"Cookie with __Host- prefix must not have Domain attribute" (or similar) thrown</strong></summary>

**Cause:** `validateCookiePrefix()` enforces all three `__Host-` constraints together (`secure: true`, no `domain`, `path: '/'`) whenever a cookie name starts with `__Host-`. **Fix:** either drop the `domain` option, or use `createSecurePrefixCookie()`/a non-prefixed name if you genuinely need a `domain` attribute.

</details>

<details>
<summary><strong>A signed cookie's `get()` always returns `undefined`, even right after `set()`</strong></summary>

**Cause:** `unsignCookie()`/`unsignCookieWithRotation()` return `undefined` for a missing cookie, a malformed signed value, *and* a signature that fails to verify -- these are indistinguishable by design (the same contract `unsignCookie`'s own doc comment states). A common cause of the last case is `secret` changing between the request that set the cookie and the request that reads it (e.g. different environments, or a rotation without `previousSecrets`). **Fix:** confirm the same `secret` (or the old one via `previousSecrets`) is configured on every process reading the cookie.

</details>

<details>
<summary><strong>"Cookie \"name\" exceeds maximum size of 4096 bytes" thrown</strong></summary>

**Cause:** `serializeCookie()` sums the fully-encoded name, value, and all attributes and rejects anything over `MAX_COOKIE_SIZE` (4096) -- this mirrors the practical per-cookie limit most browsers enforce. **Fix:** store a reference (e.g. a session ID) in the cookie and keep the actual data server-side, rather than growing the cookie value itself.

</details>

<details>
<summary><strong>`set('name', value)` stores an empty cookie (value is `''`) and throws no error</strong></summary>

**Cause:** a non-string value -- an object, a number, `undefined` -- is passed to `set()`. `sanitizeCookieValue()` returns `''` for anything that isn't a string, so the browser receives `name=; Path=/` and stores an empty cookie. No exception is thrown, which makes this look like "nothing happened." A classic case is passing a whole API response object instead of a single string field (e.g. `loginResult.token` instead of `loginResult.token.accessToken`). **Fix:** always pass a string -- `String(value)` if you must coerce -- and if a cookie still "doesn't appear" in the browser, inspect the response's `Set-Cookie` header (e.g. `curl -i`) to confirm the value is actually non-empty.

</details>

<details>
<summary><strong>Only some of the cookies sent by the client show up in `ctx.cookies.all()`</strong></summary>

**Cause:** `parseCookies()` stops once it has captured `maxCookies` (default 50) distinct names, and per RFC 6265 the *first* occurrence of a duplicate name wins -- later same-named pairs in the header are ignored, not merged. **Fix:** if you control the client, avoid sending more distinct cookie names than you need; if you need a specific override, pass `{ maxCookies: <n> }` to `parseCookies()` directly (the `cookies()`/`signedCookies()` middleware do not currently expose this as a top-level option).

</details>

## Migrating signed cookies to the name-bound format

> [!IMPORTANT]
> **The signed-cookie wire format changed pre-1.0.** If you deployed an
> earlier `@nextrush/cookies` beta build, cookies it signed
> (`value.signature`) are not verified by default going forward — set
> `acceptLegacySignatures: true` during the rotation window, and plan to
> remove it once every previously-issued cookie has expired or been
> re-signed.

**Why the format changed:** the earlier format signed only the value —
`HMAC(value)` — so a signature computed for one cookie name verified equally
well if an attacker presented the same value under a *different* cookie
name on the same domain (e.g. copying a `tier=premium` signature onto a
`role` cookie; SEC-07). The current format signs a length-prefixed tuple
that binds the cookie's own name and an issue time into the HMAC input:

```text
before:  HMAC(value)                                          -> "value.signature"
now:     HMAC(<len>!name!<len>!value!<len>!issuedAt)           -> "value.issuedAt.signature"
```

**Migration path — rotate, don't hard-cut:**

```ts
app.use(signedCookies({
  secret: process.env.COOKIE_SECRET!,
  acceptLegacySignatures: true, // accepts the earlier value-only format as a fallback; logs once per process
}));
```

With `acceptLegacySignatures: true`, `get()` still tries the name-bound
format first; only if that fails does it fall back to the legacy value-only
check. Every `set()` always writes the new format, regardless of this flag —
there is no way to opt back into writing the old format. Once you're
confident every client has picked up a re-signed (or newly issued) cookie —
typically one `maxAge` window after deploying this version — remove
`acceptLegacySignatures` entirely; leaving it on indefinitely keeps the
weaker format permanently accepted.

> [!CAUTION]
> `acceptLegacySignatures` is a rotation aid, not a permanent compatibility
> mode. It reintroduces the cross-cookie substitution risk the name-bound
> format exists to close, for exactly as long as it stays enabled.

## FAQ

**Does signing encrypt the cookie value?**
No. `signCookie()`/`unsignCookie()` provide integrity (tamper detection), not confidentiality -- the signed format is `value.signature`, and `value` itself is plainly readable by anyone with access to the cookie. Do not put secret data you need to hide from the client in a signed-only cookie.

**Why does a tampered cookie and a missing cookie both return `undefined`?**
`unsignCookie()`'s contract deliberately does not distinguish the two -- returning a different result for "signature invalid" versus "not present" would let an attacker use the distinction as an oracle to probe whether a given cookie name exists at all. This also covers a value signed for a *different* cookie name presented under this one, and an expired signed value when `maxAge` is enforced -- all resolve to the same `undefined`.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Yes. The package has zero `node:` imports -- signing uses `crypto.subtle`, and base64url encoding uses the standard `btoa`/`atob` globals, available identically on every supported runtime.

---

## Package relationships

```text
                   depends on           @nextrush/types  (Context / Middleware contracts, types only)
@nextrush/cookies ---------------->
                   often used with      @nextrush/csrf  (CSRF token cookie is managed separately, by that package)
                   usually used next    @nextrush/helmet  (general security headers alongside cookie handling)
```

- **Depends on:** [`@nextrush/types`](../../types) -- shared `Context`/`Middleware` contracts, types only, erased at build.
- **Often used with:** [`@nextrush/csrf`](../csrf) -- CSRF protection manages its own double-submit cookie internally; this package is for every other cookie in the app.
- **Usually used next:** [`@nextrush/helmet`](../helmet) -- general HTTP security headers alongside cookie handling.
- **Alternative:** none for cookie handling within NextRush -- a full session-store package would sit on top of this one, not replace it.

## Architecture

Maintaining or contributing to this package? The internal design -- the parse/set/get lifecycle,
the HMAC signing sequence, the security invariants that require an RFC to change, and the
decisions and trade-offs behind them (with diagrams) -- is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
