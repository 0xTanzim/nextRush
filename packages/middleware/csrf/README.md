# @nextrush/csrf

> CSRF protection for NextRush apps using the signed double-submit cookie pattern — origin-checked, session-bound by explicit decision, and safe by default.

[![npm version](https://img.shields.io/npm/v/@nextrush/csrf.svg)](https://www.npmjs.com/package/@nextrush/csrf)
[![downloads](https://img.shields.io/npm/dm/@nextrush/csrf.svg)](https://www.npmjs.com/package/@nextrush/csrf)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/csrf.svg)](https://bundlephobia.com/package/@nextrush/csrf)
[![types](https://img.shields.io/npm/types/@nextrush/csrf.svg)](https://www.npmjs.com/package/@nextrush/csrf)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/csrf.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Cross-site request forgery protection for state-changing routes |
| **Package type** | Middleware |
| **Status** | Beta 🚧 |
| **Included in `nextrush`?** | ❌ No — standalone install |
| **Support tier** | Public — stable (sealed public API) — see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal — Node · Bun · Deno · Edge |
| **Requires** | Node `>=22` · ESM-only · TypeScript `>=5.x` |
| **Introduced** | `v1.0.0-beta.0` |

## Highlights

- ✅ **Zero runtime dependencies** — only a type-only dependency on `@nextrush/types`
- ✅ **ESM-only**, tree-shakable, side-effect-free
- ✅ **Fully typed** — strict TypeScript, zero `any`
- 🔒 **Secure by construction** — origin checking on by default, session binding is an explicit decision, no query-string token fallback

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) · [When to use](#when-to-use) · [Installation](#installation) · [Quick start](#quick-start) · [Capabilities](#capabilities) · [Mental model](#mental-model) · [Common tasks](#common-tasks) · [API overview](#api-overview) · [Options](#options) · [Compatibility](#compatibility) · [Troubleshooting](#troubleshooting) · [FAQ](#faq) · [Package relationships](#package-relationships) · [Architecture](#architecture) · [Resources](#resources)

</details>

---

## The problem

A browser sends cookies on cross-site requests automatically. If a state-changing route trusts a session cookie alone, any page on the web can trigger that route on a logged-in user's behalf — a form or `fetch` on an attacker's site rides the victim's authenticated session. The fix — a token the attacker's origin cannot read or forge — is easy to get wrong in exactly the ways that quietly disable it:

```ts
// TODAY, without this package — the thing that's easy to get wrong:
// a cookie with no Max-Age looks intentional but silently becomes a
// session cookie; an origin check that falls back to comparing
// against Host trusts a header the client fully controls; a token
// accepted from ?_csrf= leaks into logs, Referer headers, and history.
```

## When to use

**Use `@nextrush/csrf` if:**

- ✓ Your app serves HTML forms, or a SPA that talks to the same origin's API with cookie-based auth
- ✓ You need origin validation and session-bound tokens without hand-rolling the double-submit pattern
- ✓ You want the safe defaults (origin checking on, no query-string fallback) rather than opt-in hardening

**Reach for something else if:**

- ✗ Every request already carries a bearer token in an `Authorization` header with no cookie involved → CSRF does not apply; skip this package
- ✗ You need to sign a generic value (not a CSRF token) → use [`@nextrush/cookies`](../cookies)' `signedCookies()`, which this package's token construction is modeled on

---

## Installation

```bash
pnpm add @nextrush/csrf
# npm i @nextrush/csrf · yarn add @nextrush/csrf · bun add @nextrush/csrf
```

> [!NOTE]
> Not included in the `nextrush` meta package — install separately.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { csrf } from '@nextrush/csrf';

const app = createApp();

const { protect, tokenProvider } = csrf({
  secret: process.env.CSRF_SECRET!,
  getSessionIdentifier: (ctx) => ctx.state.sessionId,
  allowedOrigins: ['https://example.com'],
});

app.use(protect);

app.get('/csrf-token', tokenProvider, async (ctx) => {
  ctx.json({ token: await ctx.state.csrf.generateToken() });
});

app.post('/api/transfer', (ctx) => {
  // reached only if the token, origin, and session all check out
  ctx.json({ ok: true });
});

listen(app, 8080);
```

`protect` runs on every request: it lets `GET`/`HEAD`/`OPTIONS`/`TRACE` through unconditionally, and validates the token, origin, and session binding on everything else. `tokenProvider` attaches the same `ctx.state.csrf.generateToken()` helper without enforcing protection, for the route that hands a fresh token to the client.

## Capabilities

**Capabilities**
- **Signed double-submit cookie** — an HMAC-SHA256 token in a non-`httpOnly` cookie, echoed back via header or body field
- **Origin validation** — the `Origin` header checked against an explicit allowlist, never against `Host`; `Sec-Fetch-Site: cross-site` rejects before any cryptographic work
- **Session binding** — tokens bound to a session identifier by default; the weaker unbound mode requires an explicit `sessionBinding: 'none'`
- **Path exclusion** — `excludePaths` with `/*` (one segment) and `/**` (any depth) wildcard semantics, for endpoints authenticated another way (e.g. signed webhooks)

**Developer experience**
- **Fully typed**, zero `any`
- **Fails at construction**, not at request time, for missing secrets, missing session decisions, and missing origin allowlists
- **Tree-shakable** — `constantTimeEqual`/`generateToken`/`validateToken` are also exported for advanced, direct use

## Mental model

A token issued on a safe method's response cookie must come back, unmodified, on the next unsafe request — via a header or body field the attacker's origin cannot set on the victim's browser.

```text
GET  ──▶ protect/tokenProvider ──▶ Set-Cookie: __Host-csrf=<hmac>.<random>
                                          │
POST ──▶ protect ──▶ origin check ──▶ shape check ──▶ constant-time compare ──▶ HMAC verify ──▶ next()
                          │                │
                    reject: 403      reject: 403 (zero crypto cost)
```

**Rule:** the cookie proves the browser saw the token; the header/body echo proves the caller could read it — an attacker's cross-origin page can trigger the cookie but never read its value to echo it back.

> [!TIP]
> The full validation pipeline and token construction (Mermaid) are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Issue a token to a server-rendered form

```ts
app.get('/checkout', tokenProvider, async (ctx) => {
  const token = await ctx.state.csrf.generateToken();
  ctx.html(`<form method="POST" action="/checkout">
    <input type="hidden" name="_csrf" value="${token}">
    ...
  </form>`);
});
```

### Issue a token to a SPA and send it back via header

```ts
// server
app.get('/api/csrf-token', tokenProvider, async (ctx) => {
  ctx.json({ token: await ctx.state.csrf.generateToken() });
});

// client
const { token } = await fetch('/api/csrf-token').then((r) => r.json());
await fetch('/api/transfer', {
  method: 'POST',
  headers: { 'x-csrf-token': token },
  body: JSON.stringify({ amount: 100 }),
});
```

### Exclude a webhook endpoint authenticated another way

```ts
csrf({
  secret: process.env.CSRF_SECRET!,
  sessionBinding: 'none',
  allowedOrigins: ['https://example.com'],
  excludePaths: ['/api/webhooks/*'], // exactly one segment past the prefix
});
```

### Opt out of session binding intentionally

```ts
csrf({
  secret: process.env.CSRF_SECRET!,
  sessionBinding: 'none', // explicit acknowledgement — never the silent default
  allowedOrigins: ['https://example.com'],
});
```

## API overview

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `csrf` | `(options: CsrfOptions) => CsrfMiddleware` | `1.0.0-beta.0` | Stable ✅ | Creates the `protect` and `tokenProvider` middleware pair |
| `generateToken` | `(secret, sessionId?, tokenSize?) => Promise<string>` | `1.0.0-beta.0` | Stable ✅ | Mints an HMAC-signed token directly, bypassing the middleware |
| `validateToken` | `(token, secret, sessionId?) => Promise<boolean>` | `1.0.0-beta.0` | Stable ✅ | Verifies a token's HMAC signature directly |
| `constantTimeEqual` | `(a: string, b: string) => Promise<boolean>` | `1.0.0-beta.0` | Stable ✅ | Timing-safe string comparison, blinded with a per-process random key |
| `type CsrfOptions` | — | `1.0.0-beta.0` | Stable ✅ | The `csrf()` configuration surface |
| `type CsrfMiddleware` | — | `1.0.0-beta.0` | Stable ✅ | The `{ protect, tokenProvider }` return shape |
| `type CsrfContext` | — | `1.0.0-beta.0` | Stable ✅ | The `ctx.state.csrf` shape (`generateToken`, `cookieToken`) |

## Options

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `secret` | `string \| (() => string)` | Yes | — | ⚠️ | HMAC key, ≥32 characters; a function enables key rotation |
| `getSessionIdentifier` | `(ctx) => string \| undefined` | One of this or `sessionBinding` | — | ⚠️ | Binds tokens to a session; omission without `sessionBinding: 'none'` throws at construction |
| `sessionBinding` | `'none'` | One of this or `getSessionIdentifier` | — | ⚠️ | Explicit opt-out of session binding |
| `originCheck` | `boolean` | No | `true` | ⚠️ | Validates `Origin` against `allowedOrigins`; never falls back to `Host` |
| `allowedOrigins` | `string[]` | Required whenever `originCheck` is active | `[]` | ⚠️ | The only basis for origin validation |
| `cookie.maxAge` | `number` | No | *(omitted — session cookie)* | — | Emitted verbatim only when set; negative/`NaN`/`Infinity` throw at construction |
| `cookie.name` | `string` | No | `'__Host-csrf'` | ⚠️ | `__Host-` prefix enforces `secure: true`, no `Domain`, `path: '/'` |
| `cookie.sameSite` | `'strict' \| 'lax' \| 'none'` | No | `'strict'` | ⚠️ | `'none'` requires `secure: true` |
| `excludePaths` | `string[]` | No | `[]` | ⚠️ | `/*` matches one remaining segment, `/**` any depth |
| `getTokenFromRequest` | `TokenExtractor` | No | header/body extractor, no query string | ⚠️ | Custom extractors may opt back into query-string reads |
| `ignoredMethods` | `string[]` | No | `['GET','HEAD','OPTIONS','TRACE']` | — | Methods exempt from validation |
| `tokenSize` | `number` | No | `32` | — | Random-value size in bytes |
| `onError` | `(ctx, reason) => void \| Promise<void>` | No | 403 JSON response | — | Custom validation-failure handler |

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | `3.x` |
| Node.js | `>=22` |
| TypeScript | `>=5.x` |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js `>=22` | ✅ | ESM-only |
| Bun / Deno / Edge | ✅ / ✅ / ✅ | Web Crypto API only — no `node:*` imports |

**Integration**
- **Peer dependencies:** none — a type-only dependency on `@nextrush/types`
- **Works with:** [`@nextrush/cookies`](../cookies) (independent cookie; no shared state), any session middleware supplying `getSessionIdentifier`
- **Incompatible with:** none

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** — no CommonJS build. On Node `>=22`, CJS consumers can
> `require()` this ESM package natively. See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>"csrf() has origin checking active... but no allowedOrigins were configured"</strong></summary>

**Cause:** `originCheck` defaults to `true`, and origin validation never falls back to `Host` — there is no other basis for the check. **Fix:** supply `allowedOrigins`, or set `originCheck: false` if the route is protected another way.

```ts
csrf({ secret, sessionBinding: 'none', allowedOrigins: ['https://example.com'] });
```

</details>

<details>
<summary><strong>"csrf() requires either a getSessionIdentifier function or an explicit sessionBinding: 'none'"</strong></summary>

**Cause:** session binding is an intentional decision, never a silent default. **Fix:** supply `getSessionIdentifier`, or acknowledge the weaker mode explicitly.

```ts
csrf({ secret, sessionBinding: 'none', allowedOrigins: [...] });
```

</details>

<details>
<summary><strong>A valid-looking token is rejected with "CSRF token does not match cookie"</strong></summary>

**Cause:** the submitted token and the cookie token differ, or one was minted under a different `sessionId`. **Fix:** confirm the client echoes the exact cookie value via header/body, and that `getSessionIdentifier` returns the same value at issue and validation time.

</details>

## FAQ

**Why is the cookie not `httpOnly`?**
The double-submit pattern requires the client to read the cookie value and echo it back via header or body — an `httpOnly` cookie the client cannot read defeats the pattern.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Yes — token generation and verification use only the Web Crypto API (`crypto.subtle`, `crypto.getRandomValues`), with no Node-specific imports.

**Why is the query string never read by default?**
A token in a URL leaks into access logs, `Referer` headers, and browser history. Pass a custom `getTokenFromRequest` to opt back in if a specific route requires it.

---

## Package relationships

```text
                 depends on            @nextrush/types
@nextrush/csrf ──────────────▶
                 often used with       @nextrush/cookies
                 usually used next     an application session middleware
```

- **Depends on:** [`@nextrush/types`](../../types) — `Context`/`Middleware` types only
- **Often used with:** [`@nextrush/cookies`](../cookies) — for the application's own session cookie; this package manages its CSRF cookie independently
- **Usually used next:** an application-supplied `getSessionIdentifier`, once a session/auth layer exists
- **Alternative:** none — CSRF protection has no in-repo substitute; skip this package entirely for bearer-token-only APIs with no cookie-based auth

## Architecture

Maintaining or contributing to this package? The internal design — token construction, the
validation pipeline, invariants, decisions and trade-offs (with diagrams) — is in
**[`ARCHITECTURE.md`](./ARCHITECTURE.md)**.

## Resources

- 📖 **Learn** — [Documentation](https://0xtanzim.github.io/nextRush/docs) · [Architecture](./ARCHITECTURE.md) · [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- 📝 **Changelog** — [CHANGELOG.md](./CHANGELOG.md)
- 🐛 **Report an issue** — [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- 🤝 **Contribute** — [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT © [Tanzim Hossain](https://github.com/0xTanzim)
