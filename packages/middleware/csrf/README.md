# @nextrush/csrf

> CSRF protection for NextRush -- the Signed Double-Submit Cookie pattern with HMAC-SHA256, so a malicious site can never forge a state-changing request on your users' behalf.

[![npm version](https://img.shields.io/npm/v/@nextrush/csrf.svg)](https://www.npmjs.com/package/@nextrush/csrf)
[![downloads](https://img.shields.io/npm/dm/@nextrush/csrf.svg)](https://www.npmjs.com/package/@nextrush/csrf)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/csrf.svg)](https://bundlephobia.com/package/@nextrush/csrf)
[![types](https://img.shields.io/npm/types/@nextrush/csrf.svg)](https://www.npmjs.com/package/@nextrush/csrf)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/csrf.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Protect state-changing routes from Cross-Site Request Forgery |
| **Package type** | Middleware |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install. Not re-exported from `nextrush` or `nextrush/class`. |
| **Support tier** | Public -- middleware/registrar (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal -- Node, Bun, Deno, Edge (Web Crypto API only, zero `node:` imports) |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x |
| **Introduced** | v1.0.0 |

## Highlights

- Zero runtime dependencies (a types-only dependency on `@nextrush/types`, erased at build)
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed, strict TypeScript, zero `any`
- Signed Double-Submit Cookie pattern (OWASP-recommended) -- HMAC-SHA256 via the Web Crypto API, not a plain random-value comparison

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Compatibility](#compatibility) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

A browser automatically attaches a user's session cookie to every request it sends to a site that cookie belongs to -- including a `POST` triggered by a hidden form on a completely different, attacker-controlled page the victim happens to have open. If your server only checks "is there a valid session cookie," it cannot tell the difference between a request the user actually intended and one a malicious page silently submitted on their behalf.

```ts
// TODAY, without CSRF protection -- authenticated, but not intentional:
app.post('/api/transfer', (ctx) => {
  // ctx has a valid session cookie -- the browser sent it automatically.
  // But did the USER click "transfer", or did evil.example.com's
  // auto-submitting <form> do it while they were reading an article?
  transferFunds(ctx.state.userId, ctx.body.amount, ctx.body.to);
});
```

A same-site cookie policy alone helps, but it is a browser-support gradient, not a guarantee -- older browsers, misconfigured `SameSite` attributes, and some legitimate cross-site navigation flows all leave a gap. The standard defense is a second, unguessable value the attacker's page cannot read or forge: a CSRF token.

## When to use

**Use `@nextrush/csrf` if:**

- You serve a traditional form-based app or an SPA that relies on cookies for session state
- State-changing requests (`POST`/`PUT`/`PATCH`/`DELETE`) must originate from your own frontend, not from an arbitrary third-party page
- You want the double-submit token generated, signed, and verified for you instead of hand-rolling HMAC comparisons

**Reach for something else if:**

- Your API is authenticated entirely with a bearer token sent in an `Authorization` header (never a cookie) -- CSRF specifically exploits automatic cookie attachment, so a header-only auth scheme that a cross-site page cannot set is not vulnerable to it
- You need general security response headers (`Content-Security-Policy`, `X-Frame-Options`) -- see [`@nextrush/helmet`](../helmet)
- You need cookie parsing/signing for reasons unrelated to CSRF -- see [`@nextrush/cookies`](../cookies)

---

## Installation

```bash
pnpm add @nextrush/csrf
# npm i @nextrush/csrf . yarn add @nextrush/csrf . bun add @nextrush/csrf
```

> [!NOTE]
> `@nextrush/csrf` is not re-exported by the `nextrush` meta package -- install and import it
> directly, as shown above.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { csrf } from '@nextrush/csrf';

const app = createApp();

const { protect, tokenProvider } = csrf({
  secret: process.env.CSRF_SECRET!, // >= 32 characters, cryptographically random
});

// Protect every state-changing route.
app.use(protect);

// Issue a token to the client (e.g. for an SPA to read before its first POST).
app.get('/csrf-token', tokenProvider, (ctx) => {
  ctx.json({ token: ctx.state.csrf.cookieToken });
});

app.post('/api/transfer', (ctx) => {
  // Only reached if the submitted token matched the cookie and its HMAC verified.
  ctx.json({ ok: true });
});

listen(app, 8080);
```

`protect` attaches `ctx.state.csrf` on every request and enforces validation on every method not in the safe-method allowlist (`GET`, `HEAD`, `OPTIONS`, `TRACE`). `secret` is the only required option -- it must be at least 32 characters, or the middleware throws when constructed.

## Capabilities

**Token lifecycle**
- **Generation** -- `ctx.state.csrf.generateToken()` produces a fresh random value on every call, HMAC-SHA256-signed with your secret, and sets it as a cookie in the same call
- **Storage** -- the signed token lives in a non-`httpOnly` cookie (`__Host-csrf` by default) so client-side JavaScript can read it and echo it back
- **Validation** -- on a protected request, the submitted token must match the cookie value (constant-time comparison) *and* its HMAC signature must verify against the current secret
- **No automatic rotation** -- a valid token is reusable for every subsequent request until the cookie expires or a new one is explicitly generated; this package does not rotate tokens per-request

**Security enforcement**
- HMAC-SHA256 signing via the Web Crypto API (`crypto.subtle`) -- a forged token without the secret fails signature verification, even if it happens to match the cookie
- Constant-time token comparison (`constantTimeEqual`) to resist timing attacks
- Optional session binding: pass `getSessionIdentifier` to fold a session ID into the HMAC message, so a token stolen via cookie injection on one session cannot be replayed against another
- Optional `originCheck` -- validates `Sec-Fetch-Site` / `Origin` against `Host` (or an explicit allowlist) as defense-in-depth alongside the token check
- `__Host-` cookie name prefix by default -- locks the cookie to the exact origin, requires `Secure`, forbids a `Domain` attribute, and forces `Path=/`

**Developer experience**
- Zero runtime dependencies beyond `@nextrush/types`
- Token extraction checks `x-csrf-token` header, then `x-xsrf-token` (Angular convention), then `_csrf` body field, then `_csrf` query param -- override with `getTokenFromRequest`
- `excludePaths` with simple glob support (`/api/webhooks/*`) for endpoints authenticated another way
- Fully typed, zero `any`; edge-safe (no `node:` imports anywhere in the package)

## Mental model

The middleware never trusts the cookie alone. A cookie is proof the *browser* sent this request to the right origin, but an attacker can still set arbitrary cookies on a victim's browser in some conditions (subdomain takeover, misconfigured proxies). The submitted token has to (a) match the cookie -- proving the request came from a page that could read it -- and (b) carry a valid HMAC signature -- proving the token was actually issued by this server and not fabricated.

```text
GET  /csrf-token  --> tokenProvider --> generateToken() --> Set-Cookie: __Host-csrf=<hmac>.<random>
                                              |
                                              +-- returned to the client to echo back later

POST /api/transfer --> protect --> cookie present? --> submitted token present? --> tokens match?
                                                                                          |
                                                                                          +-- HMAC valid? --> ctx.next()
```

**Rule:** a request is only accepted if the cookie token, the submitted token, and the HMAC signature all agree -- any single mismatch is rejected with the same 403 response shape, so an attacker cannot distinguish which check failed.

> [!TIP]
> The full token lifecycle (state diagram) and the request-validation sequence (with diagrams)
> are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Protect all routes, issue a token for an SPA

```ts
import { csrf } from '@nextrush/csrf';

const { protect, tokenProvider } = csrf({
  secret: process.env.CSRF_SECRET!,
});

app.use(protect);
app.get('/csrf-token', tokenProvider, (ctx) => {
  ctx.json({ token: ctx.state.csrf.cookieToken });
});
```

### Bind tokens to a session (recommended when sessions exist)

```ts
const { protect } = csrf({
  secret: process.env.CSRF_SECRET!,
  getSessionIdentifier: (ctx) => ctx.state.sessionId,
});
```

A token generated for one session's identifier fails HMAC verification if replayed under a different session's identifier.

### Exclude webhook endpoints that have their own auth

```ts
const { protect } = csrf({
  secret: process.env.CSRF_SECRET!,
  excludePaths: ['/api/webhooks/*'],
});
```

### Add origin checking as defense-in-depth

```ts
const { protect } = csrf({
  secret: process.env.CSRF_SECRET!,
  originCheck: true,
  allowedOrigins: ['https://app.example.com'],
});
```

### Custom error response

```ts
const { protect } = csrf({
  secret: process.env.CSRF_SECRET!,
  onError: (ctx, reason) => {
    ctx.status = 403;
    ctx.json({ error: 'forbidden', reason });
  },
});
```

## API overview

The sealed public surface (ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `csrf` | `(options: CsrfOptions) => CsrfMiddleware` | 1.0.0 | Stable | The core factory. Returns `{ protect, tokenProvider }`. |
| `generateToken` | `(secret, sessionId?, tokenSize?) => Promise<string>` | 1.0.0 | Stable | Low-level token generation, for advanced use. |
| `validateToken` | `(token, secret, sessionId?) => Promise<boolean>` | 1.0.0 | Stable | Low-level HMAC verification, for advanced use. |
| `constantTimeEqual` | `(a: string, b: string) => Promise<boolean>` | 1.0.0 | Stable | Constant-time string comparison used for the double-submit check. |
| `CSRF_HEADER` / `XSRF_HEADER` / `CSRF_FIELD` / `DEFAULT_COOKIE_NAME` / `DEFAULT_IGNORED_METHODS` / `DEFAULT_TOKEN_SIZE` / `ERRORS` | `const` | 1.0.0 | Stable | Constants for custom implementations. |
| `type CsrfOptions` / `CsrfContext` / `CsrfMiddleware` / `CsrfCookieOptions` / `TokenExtractor` / `SessionIdentifierExtractor` | -- | 1.0.0 | Stable | Public option and data contracts. |

## Options

Every default below is read directly from `src/middleware.ts`'s `resolveOptions()` and `src/constants.ts`.

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `secret` | `string \| (() => string)` | Yes | -- | Yes | HMAC signing key. Must be >= 32 characters or the middleware throws at construction. A function supports rotation -- the current value is read on every generate/validate call. |
| `getSessionIdentifier` | `(ctx: Context) => string \| undefined` | No | `undefined` | Yes | Folds a session-bound value into the HMAC message. Without it, tokens are not bound to any session. |
| `getTokenFromRequest` | `(ctx: Context) => string \| undefined \| null` | No | checks `x-csrf-token` header, then `x-xsrf-token`, then `_csrf` body field, then `_csrf` query | No | Never reads from the cookie -- that would defeat the double-submit pattern. |
| `ignoredMethods` | `string[]` | No | `['GET', 'HEAD', 'OPTIONS', 'TRACE']` | Yes | Methods exempt from validation (still get `ctx.state.csrf` attached). |
| `excludePaths` | `string[]` | No | `[]` | Yes | Exact paths or `/*` / `/**` glob patterns exempt from validation. |
| `cookie.name` | `string` | No | `'__Host-csrf'` | Yes | The `__Host-` prefix enforces `secure: true`, no `domain`, and `path: '/'` -- validated at construction. |
| `cookie.path` | `string` | No | `'/'` | No | Cookie `Path` attribute. |
| `cookie.sameSite` | `'strict' \| 'lax' \| 'none'` | No | `'strict'` | Yes | `'none'` requires `secure: true`. |
| `cookie.secure` | `boolean` | No | `true` | Yes | Cookie only sent over HTTPS. |
| `cookie.httpOnly` | `boolean` | No | `false` | Yes | Must stay `false` for the double-submit pattern -- client-side code needs to read the token. |
| `cookie.domain` | `string` | No | `undefined` | Yes | Not allowed with the `__Host-` prefix. |
| `cookie.maxAge` | `number` | No | `undefined` (session cookie) | No | Cookie `Max-Age` in seconds. |
| `tokenSize` | `number` | No | `32` | No | Bytes of random entropy per token (before HMAC signing). |
| `onError` | `(ctx, reason: string) => void \| Promise<void>` | No | sends `403` with `{ error: 'CSRF validation failed', message: reason }` | No | Called for every validation failure path. |
| `originCheck` | `boolean` | No | `false` | Yes | Adds a `Sec-Fetch-Site` / `Origin`-vs-`Host` check as defense-in-depth alongside the token check. |
| `allowedOrigins` | `string[]` | No | `[]` (same-origin only) | Yes | Only consulted when `originCheck: true`. |

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
| Bun / Deno / Edge | Yes / Yes / Yes | Zero `node:` imports -- token generation/validation uses only `crypto.subtle` (Web Crypto API) |

**Integration**
- **Peer dependencies:** none -- depends only on `@nextrush/types` (types, erased at build).
- **Works with:** `@nextrush/cookies` for general cookie handling elsewhere in the app; a session middleware that populates `ctx.state.sessionId` for use with `getSessionIdentifier`.
- **Incompatible with:** none directly, but register `protect` before any middleware that consumes the request body if `getTokenFromRequest`'s default form-field check needs `ctx.body` already parsed.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>"CSRF secret must be at least 32 characters" thrown on startup</strong></summary>

**Cause:** `resolveOptions()` validates `secret.length >= 32` at construction time -- a short or placeholder secret fails immediately instead of accepting a weak key. **Fix:** generate a real random secret, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, and load it from an environment variable.

</details>

<details>
<summary><strong>"CSRF cookie not found" on every request, even right after loading the page</strong></summary>

**Cause:** no route has called `tokenProvider` (or `generateToken()`) yet, so the browser never received the `Set-Cookie`. **Fix:** add a `GET` route that runs `tokenProvider` and calls `ctx.state.csrf.generateToken()` (or reads `ctx.state.csrf.cookieToken` if a token already exists) before the client attempts its first protected request.

```ts
app.get('/csrf-token', tokenProvider, async (ctx) => {
  ctx.json({ token: await ctx.state.csrf.generateToken() });
});
```

</details>

<details>
<summary><strong>"Cookies with __Host- prefix require secure: true" (or similar) thrown on startup</strong></summary>

**Cause:** the default cookie name `__Host-csrf` enforces `secure: true`, no `domain`, and `path: '/'` -- these are validated together at construction. **Fix:** either satisfy all three constraints, or use a cookie name without the `__Host-` prefix if you genuinely need a `domain` attribute (e.g. for a shared subdomain setup).

</details>

<details>
<summary><strong>Requests fail validation in local development over plain HTTP</strong></summary>

**Cause:** `cookie.secure` defaults to `true`, and `__Host-` additionally requires it -- browsers will not set a `Secure` cookie over an insecure `http://` origin, so the cookie never round-trips. **Fix:** run local development over HTTPS (recommended), or explicitly set `cookie: { secure: false }` and a non-`__Host-` cookie name for local-only configuration -- never in a deployed environment.

</details>

## FAQ

**Does this rotate the token on every request?**
No. A generated token stays valid until the cookie expires (or `generateToken()` is called again). This package implements the double-submit-plus-HMAC pattern, not per-request token rotation -- see the token lifecycle diagram in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Yes. The package has zero `node:` imports -- token signing and verification use `crypto.subtle` (Web Crypto API), available identically on every supported runtime.

**Do I still need this if my API only accepts a bearer token in `Authorization`?**
No -- CSRF exploits the browser's automatic cookie attachment. An API that never reads auth from a cookie is not vulnerable to it, because a cross-site page cannot set an `Authorization` header on a request it triggers.

---

## Package relationships

```text
                depends on           @nextrush/types  (Context / Middleware contracts, types only)
@nextrush/csrf ---------------->
                often used with      @nextrush/cookies  (general cookie parsing/signing elsewhere in the app)
                usually used next    @nextrush/helmet  (general security headers alongside CSRF)
```

- **Depends on:** [`@nextrush/types`](../../types) -- shared `Context`/`Middleware` contracts, types only, erased at build.
- **Often used with:** [`@nextrush/cookies`](../cookies) -- for cookie handling outside the CSRF cookie itself.
- **Usually used next:** [`@nextrush/helmet`](../helmet) -- general HTTP security headers alongside CSRF protection.
- **Alternative:** none for cookie-authenticated apps -- a purely header/bearer-token-authenticated API does not need CSRF protection at all (see FAQ).

## Architecture

Maintaining or contributing to this package? The internal design -- the token lifecycle, the
request-validation sequence, the security invariants that require an RFC to change, and the
decisions and trade-offs behind them (with diagrams) -- is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
