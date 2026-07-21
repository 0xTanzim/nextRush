# @nextrush/cors

> Security-hardened CORS middleware for NextRush -- validates origins, blocks null-origin and credential+wildcard attacks, and sets every `Access-Control-*` header your API needs.

[![npm version](https://img.shields.io/npm/v/@nextrush/cors.svg)](https://www.npmjs.com/package/@nextrush/cors)
[![downloads](https://img.shields.io/npm/dm/@nextrush/cors.svg)](https://www.npmjs.com/package/@nextrush/cors)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/cors.svg)](https://bundlephobia.com/package/@nextrush/cors)
[![types](https://img.shields.io/npm/types/@nextrush/cors.svg)](https://www.npmjs.com/package/@nextrush/cors)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/cors.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Validate cross-origin requests and set `Access-Control-*` response headers |
| **Package type** | Middleware |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install. It is only a devDependency of the `nextrush` meta package (used by its own tests), never a runtime dependency, and is not re-exported from `nextrush` or `nextrush/class`. |
| **Support tier** | Public -- middleware/registrar (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal -- Node, Bun, Deno, Edge (zero `node:` imports) |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x |
| **Introduced** | v3.0.0 |

## Highlights

- Zero runtime dependencies (a types-only dependency on `@nextrush/types`, erased at build)
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed, strict TypeScript, zero `any`
- Security-first defaults: `origin` defaults to `false` (CORS disabled), `credentials`+`origin: '*'` throws at configuration time, `null` origin is blocked by default

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Compatibility](#compatibility) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

Cross-Origin Resource Sharing is a browser security mechanism that is straightforward to misconfigure, because the failure mode looks like success. A response with `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Credentials: true` passes a quick manual test, until a security review points out that any website on the internet can now make credentialed requests against the API on a logged-in user's behalf.

```ts
// TODAY, without a security-aware CORS layer -- quick to write, dangerous to ship:
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true'); // silently ignored by
  // browsers when Origin is '*' -- but the combination still leaks intent and
  // some clients/proxies do not enforce the spec correctly.
}
```

The same by-hand approach also tends to miss the request patterns that don't look like normal cross-origin calls: `Origin: null` from a sandboxed iframe or a `file://` page, a hand-written regex for subdomain matching that has catastrophic backtracking on the wrong input, or a preflight `OPTIONS` request that never gets a `Vary` header, so a CDN caches one origin's response and serves it to every other origin.

## When to use

**Use `@nextrush/cors` if:**

- You serve a browser-based frontend from a different origin than your API (a separate domain, subdomain, or port)
- You need credentialed cross-origin requests (cookies, `Authorization` headers) with an explicit, validated origin allowlist
- You want origin validation, null-origin blocking, and ReDoS-pattern detection handled for you instead of hand-rolled header logic

**Reach for something else if:**

- Your frontend is served from the same origin as your API -- no CORS middleware is needed at all
- You need to restrict server-to-server calls by IP or network policy -- that's infrastructure/network layer, not this package
- You need general security headers (`Content-Security-Policy`, `X-Frame-Options`) -- see [`@nextrush/helmet`](../helmet)

---

## Installation

```bash
pnpm add @nextrush/cors
# npm i @nextrush/cors  .  yarn add @nextrush/cors  .  bun add @nextrush/cors
```

> [!NOTE]
> `@nextrush/cors` is not re-exported by the `nextrush` meta package -- install and import it
> directly, as shown above.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { cors } from '@nextrush/cors';

const app = createApp();

// CORS runs first so its headers are present on every response, including errors.
app.use(
  cors({
    origin: 'https://app.example.com',
    credentials: true,
  })
);

app.get('/api/data', (ctx) => {
  ctx.json({ message: 'Hello from API' });
});

listen(app, 8080);
```

`origin` defaults to `false` -- CORS is off unless you configure it. Passing one exact origin string with `credentials: true` is the smallest configuration that safely supports a session-authenticated frontend.

## Capabilities

**Origin validation**
- Exact string match, an array allowlist, a `RegExp`, or an async validator function
- Origin format is checked before any comparison -- `javascript:`, `data:`, and other non-`http(s)` schemes never match, regardless of your configuration (`isValidOriginFormat` in `security.ts`)
- `Origin: null` (from `file://` pages, sandboxed iframes, and some redirected requests) is blocked by default via `blockNullOrigin: true`

**Security enforcement**
- `credentials: true` combined with `origin: '*'` throws an `Error` at middleware construction time -- the app fails to start rather than serving an unsafe configuration
- `credentials: true` combined with `origin: true` (reflect-any-origin) does not throw, but logs a non-production `securityWarning()` -- review this combination before shipping it
- Regex origin patterns are checked against a fixed list of catastrophic-backtracking shapes (`isRegexSafe`); an unsafe-looking pattern still runs, but logs a warning
- A custom origin-validator function that throws is treated as a rejection (fail-secure), not a crash

**Request handling**
- Full preflight (`OPTIONS`) handling: `Access-Control-Allow-Methods`, `-Headers`, `-Max-Age`, and the terminal `204` (configurable) response
- `Vary: Origin` is set on every CORS-eligible response (plus `Access-Control-Request-Method` / `-Headers` on preflight) so origin-keyed responses are never cache-poisoned across origins
- Private Network Access (`Access-Control-Allow-Private-Network`) support, opt-in via `privateNetworkAccess`

**Developer experience**
- Five presets (`simpleCors`, `strictCors`, `devCors`, `internalCors`, `staticAssetsCors`) for the common configurations
- A fluent `CorsOptionsBuilder` (`createCorsOptions()`) for building options programmatically
- Fully typed, zero `any`; edge-safe (no `node:` imports anywhere in the package)

## Mental model

CORS middleware is a checkpoint that runs before your route handler: it looks at the `Origin` header, decides whether this cross-origin request is allowed, and either adds the headers that let the browser read the response or lets the request through with no CORS headers at all (which the browser then blocks client-side).

```text
request (Origin: X) --> cors() --> validate X against config --> set headers --> ctx.next()
                                          |
                                          +-- not allowed --> no headers set, request still
                                                                forwarded (browser blocks read)
```

**Rule:** this middleware never blocks the request server-side for a disallowed origin -- it withholds the `Access-Control-Allow-Origin` header, and the browser enforces the actual same-origin restriction on the client. A same-origin request (no `Origin` header) always passes through untouched.

> [!TIP]
> The full request-to-response sequence, the origin-decision state machine, and the security
> invariants (with diagrams) are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Allow one trusted frontend with credentials

```ts
import { cors } from '@nextrush/cors';

app.use(
  cors({
    origin: 'https://app.example.com',
    credentials: true,
  })
);
```

### Allow a list of known origins

```ts
app.use(
  cors({
    origin: ['https://app.example.com', 'https://admin.example.com'],
    credentials: true,
  })
);
```

### Match a subdomain pattern safely

```ts
// Anchored, non-nested-quantifier pattern -- passes the ReDoS heuristic check.
app.use(cors({ origin: /^https:\/\/[a-z0-9-]+\.example\.com$/ }));
```

### Validate origins dynamically (multi-tenant)

```ts
app.use(
  cors({
    origin: async (origin, ctx) => {
      const tenantId = ctx.get('X-Tenant-Id');
      const tenant = await db.getTenant(tenantId);
      return tenant?.allowedOrigins.includes(origin) ?? false;
    },
    credentials: true,
  })
);
```

A thrown error inside the validator is caught and treated as "not allowed" -- it never propagates and never grants access by accident.

### Use a preset instead of hand-configuring

```ts
import { strictCors, devCors } from '@nextrush/cors';

if (process.env.NODE_ENV === 'production') {
  app.use(strictCors('https://app.example.com')); // requires an explicit origin; throws without one
} else {
  app.use(devCors()); // allows localhost + 127.0.0.1 + ::1, credentials on, null origin allowed
}
```

## API overview

The sealed public surface (ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `cors` | `(options?: CorsOptions) => Middleware` | 3.0.0 | Stable | The core CORS middleware. |
| `CorsOptionsBuilder` | `class` | 3.0.0 | Stable | Fluent builder for `CorsOptions`. |
| `createCorsOptions` | `() => CorsOptionsBuilder` | 3.0.0 | Stable | Construct a new builder. |
| `simpleCors` | `() => Middleware` | 3.0.0 | Stable | `origin: '*'`, no credentials -- public/dev APIs. |
| `strictCors` | `(origin, options?) => Middleware` | 3.0.0 | Stable | Requires an explicit origin; credentials on by default. |
| `devCors` | `(additionalOrigins?: string[]) => Middleware` | 3.0.0 | Stable | Allows localhost/127.0.0.1/::1 plus extras; credentials on, null origin allowed. |
| `internalCors` | `(internalDomains: string[]) => Middleware` | 3.0.0 | Stable | Fixed internal-domain allowlist with a curated header set. |
| `staticAssetsCors` | `(origins?: string \| string[]) => Middleware` | 3.0.0 | Stable | GET/HEAD/OPTIONS only, 7-day preflight cache, no credentials. |
| `isOriginAllowed` | `(origin, allowed, ctx, blockNullOrigin) => Promise<string \| false>` | 3.0.0 | Stable | The core origin-decision function, exported for advanced use. |
| `isOriginInList` / `isOriginMatchingPattern` / `createOriginCache` | `functions` | 3.0.0 | Stable | Lower-level origin-matching helpers. |
| `normalizeHeaders` / `appendVary` / `setVaryHeaders` / `buildMethodList` / `parseHeaderList` / `headerContains` | `functions` | 3.0.0 | Stable | Header-manipulation utilities used internally and exposed for custom middleware. |
| `isOriginSecure` / `isRegexSafe` / `isValidOriginFormat` / `securityWarning` | `functions` | 3.0.0 | Stable | Security primitives (format/ReDoS checks, dev-only console warnings). |
| `CORS_HEADERS` / `DEFAULT_METHODS` / `DEFAULT_MAX_AGE` / `DEFAULT_OPTIONS_SUCCESS_STATUS` / `ORIGIN_HEADER` / `PREFLIGHT_INDICATORS` / `VARY_HEADER` | `const` | 3.0.0 | Stable | Constants for custom implementations. |
| `type CorsOptions` / `CorsContext` / `OriginOption` / `OriginValidator` / `SecuritySeverity` | -- | 3.0.0 | Stable | Public option and data contracts. |
| default export | `cors` | 3.0.0 | Stable | Same function as the named `cors` export. |

## Options

Every default below is read directly from `src/middleware.ts`'s destructuring defaults and `src/constants.ts`.

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `origin` | `boolean \| string \| string[] \| RegExp \| OriginValidator` | No | `false` | Yes | `false` disables CORS entirely (no headers set). `true` reflects the request origin. `'*'` allows any origin. See [Security](#security-enforcement-notes) below. |
| `methods` | `string \| string[]` | No | `'GET,HEAD,PUT,PATCH,POST,DELETE'` | No | Methods advertised in `Access-Control-Allow-Methods` on preflight. |
| `allowedHeaders` | `string \| string[]` | No | reflects `Access-Control-Request-Headers` from the preflight request | No | If unset, whatever the browser asked for is echoed back. |
| `exposedHeaders` | `string \| string[]` | No | `undefined` (no `Access-Control-Expose-Headers` header sent) | No | Response headers readable from client-side JavaScript. |
| `credentials` | `boolean` | No | `false` | Yes | Sets `Access-Control-Allow-Credentials: true`. Throws if `origin === '*'`; warns if `origin === true`. |
| `maxAge` | `number` | No | `undefined` (no `Access-Control-Max-Age` header sent) | No | Preflight cache duration in seconds. Must be a non-negative finite number or the middleware throws at construction. |
| `preflightContinue` | `boolean` | No | `false` | No | When `true`, a preflight request is passed to `next()` instead of being terminated with `optionsSuccessStatus`. |
| `optionsSuccessStatus` | `number` | No | `204` | No | Status code for a terminated (non-`preflightContinue`) preflight response. |
| `privateNetworkAccess` | `boolean` | No | `false` | Yes | Adds `Access-Control-Allow-Private-Network: true` on preflight when the client sent `Access-Control-Request-Private-Network`. |
| `blockNullOrigin` | `boolean` | No | `true` | Yes | Blocks requests whose `Origin` header is the literal string `"null"` (sandboxed iframes, `file://`, some redirects). |

### Security enforcement notes

Verified directly against `src/middleware.ts`:

- `credentials: true` with `origin: '*'` **throws a hard `Error`** when the middleware is constructed -- this is enforced code, not documentation-only advice. The app will not start with this combination.
- `credentials: true` with `origin: true` (reflect) does **not** throw -- it calls `securityWarning()`, which logs to `console.warn` (or `console.error`/`console.info` depending on severity) only when `process.env.NODE_ENV !== 'production'`. In production, this warning is silent. Avoid this combination in any environment that handles real user sessions.
- `maxAge` is validated at construction: a non-number, negative number, or non-finite value throws.

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
| Bun / Deno / Edge | Yes / Yes / Yes | Zero `node:` imports anywhere in the package -- origin/header logic uses only `URL`, `RegExp`, and standard JavaScript |

**Integration**
- **Peer dependencies:** none -- depends only on `@nextrush/types` (types, erased at build).
- **Works with:** any NextRush middleware chain; register `cors()` before route handlers so headers are present on every response, including error responses.
- **Incompatible with:** none directly, but a middleware registered *before* `cors()` runs before CORS headers are set for that response.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>Browser console shows "No 'Access-Control-Allow-Origin' header"</strong></summary>

**Cause:** either `cors()` was not registered, it ran after the route handler already sent a response, or the request's `Origin` did not pass validation (wrong scheme, not in your allowlist, or blocked as `null`). **Fix:** register `cors()` first in the middleware chain, and confirm the origin matches your configuration exactly (origin comparison is case-sensitive and exact).

```ts
app.use(cors({ origin: 'https://app.example.com' })); // register before routes
```

</details>

<details>
<summary><strong>"Cannot use credentials=true with origin='*'" thrown on startup</strong></summary>

**Cause:** this is the enforced security check in `middleware.ts` -- the combination is rejected before the app starts, because a wildcard origin with credentials would let any site make authenticated requests. **Fix:** use an explicit origin string, array, or validator function.

```ts
cors({ origin: 'https://app.example.com', credentials: true }); // explicit origin, works
```

</details>

<details>
<summary><strong>Preflight (OPTIONS) requests return the wrong status or hang</strong></summary>

**Cause:** `preflightContinue` defaults to `false`, so a valid preflight is terminated by the middleware itself with `optionsSuccessStatus` (default `204`) -- if a downstream handler also tries to respond to that `OPTIONS` request, the second response is a no-op or an error depending on your adapter. **Fix:** don't add your own `OPTIONS` handler for CORS-protected routes, or set `preflightContinue: true` if you need to.

</details>

<details>
<summary><strong>A static assets / CDN response is served to the wrong origin</strong></summary>

**Cause:** `cors()` always appends `Vary: Origin` (and the preflight-specific `Access-Control-Request-*` headers on `OPTIONS`), specifically to prevent this. If you see cross-origin cache poisoning, confirm your CDN/proxy respects the `Vary` header -- some default configurations strip it. **Fix:** configure your CDN to honor `Vary`, or use `staticAssetsCors()`'s long `maxAge` only behind a `Vary`-aware cache.

</details>

## FAQ

**Can I use `@nextrush/cors` without the rest of NextRush?**
Yes. It depends only on `@nextrush/types` for the `Context`/`Middleware`/`Next` type contracts (erased at build) -- there's no runtime dependency to install beyond the package itself.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Yes. The package has zero `node:` imports -- origin validation uses the standard `URL` constructor and `RegExp`, both Web-standard APIs available identically on every supported runtime.

**Why doesn't `origin: true` (reflect-any-origin) throw when combined with `credentials: true`, the way `'*'` does?**
By design, but deliberately less strict: reflecting the exact request origin (rather than a literal `*`) is a valid pattern for some legitimate multi-origin setups, so it only logs a `securityWarning()` in non-production environments rather than blocking startup. Treat any `origin: true` + `credentials: true` configuration as something to review before shipping -- prefer an explicit allowlist or validator function.

---

## Package relationships

```text
                depends on           @nextrush/types  (Context / Middleware / Next contracts, types only)
@nextrush/cors ---------------->
                often used with      @nextrush/helmet  (security headers alongside CORS)
                usually used next    @nextrush/rate-limit  (throttle the same public endpoints)
```

- **Depends on:** [`@nextrush/types`](../../types) -- shared `Context`/`Middleware`/`Next` contracts, used only by the middleware signature (types, erased at build).
- **Often used with:** [`@nextrush/helmet`](../helmet) -- security headers alongside CORS on the same routes.
- **Usually used next:** [`@nextrush/rate-limit`](../rate-limit) -- throttling the same public-facing endpoints CORS opens up.
- **Alternative:** none for browser CORS -- server-to-server access control is a network/infrastructure concern, not a middleware.

## Architecture

Maintaining or contributing to this package? The internal design -- the origin-decision pipeline,
the request/response sequence, the security invariants that require an RFC to change, and the
decisions and trade-offs behind them (with diagrams) -- is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
