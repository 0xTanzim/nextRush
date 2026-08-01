# @nextrush/helmet

> HTTP security headers middleware for NextRush -- sets 13 response headers with OWASP-recommended defaults in a single call, from Content-Security-Policy to Referrer-Policy.

[![npm version](https://img.shields.io/npm/v/@nextrush/helmet.svg)](https://www.npmjs.com/package/@nextrush/helmet)
[![downloads](https://img.shields.io/npm/dm/@nextrush/helmet.svg)](https://www.npmjs.com/package/@nextrush/helmet)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/helmet.svg)](https://bundlephobia.com/package/@nextrush/helmet)
[![types](https://img.shields.io/npm/types/@nextrush/helmet.svg)](https://www.npmjs.com/package/@nextrush/helmet)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/helmet.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Set HTTP security response headers (CSP, HSTS, cross-origin isolation, and more) with one middleware call |
| **Package type** | Middleware |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install. Not re-exported from `nextrush` or `nextrush/class`. |
| **Support tier** | Public -- middleware/registrar (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal -- Node, Bun, Deno, Edge (zero `node:` imports) |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x |
| **Introduced** | v3.0.0 |

## Highlights

- Zero runtime dependencies (a types-only dependency on `@nextrush/types`, erased at build)
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed, strict TypeScript, zero `any`
- 13 headers set from a single `helmet()` call, each independently disable-able with `false`

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Compatibility](#compatibility) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

Browsers use permissive defaults unless a server tells them otherwise. Without security headers, a page can be embedded in someone else's iframe (clickjacking), a browser can guess a file's content type and execute a disguised script (MIME sniffing), and a `Referer` header can leak an internal URL to a third-party site. None of these require a bug in your application code -- they are the browser behaving exactly as specified, absent an explicit opt-out.

```ts
// TODAY, without a security-headers layer -- one header slips your mind, and
// each remaining header still has its own syntax and edge cases to get right by hand:
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // legacy header, superseded by CSP frame-ancestors
  // ...and ten more headers, each with its own default value, browser support
  // caveats, and interaction with the others (e.g. HSTS preload has a minimum
  // max-age; CSP has 25+ possible directives).
}
```

`@nextrush/helmet` sets all of them from one call, with OWASP-recommended defaults, and lets you override or disable any single header without touching the rest.

## When to use

**Use `@nextrush/helmet` if:**

- You serve a browser-facing application or API and want production-grade default security headers without hand-tuning each one
- You need Content-Security-Policy with nonce support for inline scripts, or a Permissions-Policy that disables specific browser features
- You want a preset tuned for your deployment shape (strict, API-only, static assets, development, logout)

**Reach for something else if:**

- You need request body validation -- use Zod, ArkType, or a similar schema library
- You need CORS (`Access-Control-*` headers) -- see [`@nextrush/cors`](../cors)
- You need CSRF token issuance/validation for cookie-based sessions -- see `@nextrush/csrf`
- You need rate limiting -- see `@nextrush/rate-limit`

---

## Installation

```bash
pnpm add @nextrush/helmet
# npm i @nextrush/helmet . yarn add @nextrush/helmet . bun add @nextrush/helmet
```

> [!NOTE]
> `@nextrush/helmet` is not re-exported by the `nextrush` meta package -- install and import it
> directly, as shown above.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { helmet } from '@nextrush/helmet';

const app = createApp();

app.use(helmet());

app.get('/api/data', (ctx) => {
  ctx.json({ message: 'Hello from API' });
});

listen(app, 8080);
```

That single `helmet()` call sets 13 response headers with OWASP-recommended defaults -- no configuration required to get production-reasonable security.

## Capabilities

**Header coverage**
- Content-Security-Policy with a directive builder, nonce generation, and report-only mode
- Permissions-Policy with a type-safe feature list and a fluent builder
- Strict-Transport-Security with preload eligibility validation
- Cross-Origin-Embedder-Policy / -Opener-Policy / -Resource-Policy for cross-origin isolation
- Clear-Site-Data and Reporting-Endpoints for logout flows and CSP reporting

**Security enforcement**
- Header values are sanitized against control characters (`\x00`-`\x1f`, `\x7f`) before being written, preventing HTTP response-splitting attacks
- CSP directive names and values are rejected if they contain `;` or a newline
- HSTS options are validated at construction: an invalid `maxAge` throws; a `preload: true` below the 1-year minimum, or without `includeSubDomains`, logs a non-production warning

**Developer experience**
- Six presets (`strictHelmet`, `apiHelmet`, `devHelmet`, `staticHelmet`, `logoutHelmet`, `hidePoweredBy`) for common deployment shapes
- Individual per-header middleware (`contentSecurityPolicy`, `hsts`, `noSniff`, `referrerPolicy`) when you only need one header
- Fluent builders for CSP (`createCspBuilder()`) and Permissions-Policy (`createPermissionsPolicyBuilder()`)
- Fully typed, zero `any`; edge-safe (no `node:` imports anywhere in the package)

## Mental model

Helmet is a response-header writer that runs before your route handler produces a body: it reads its configuration once (at `helmet(options)` call time) and, on every request, writes each enabled header to the response before calling `next()`.

```text
request --> helmet() --> write 13 headers to response --> ctx.next() --> route handler
                              |
                              +-- any header set to `false` is skipped entirely
```

**Rule:** every header defaults to *on* with an OWASP-recommended value; set that option to `false` to omit the header entirely rather than sending an empty or permissive value.

> [!TIP]
> The full request lifecycle and the header-injection defenses (with diagrams) are in
> [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Use the defaults

```ts
import { helmet } from '@nextrush/helmet';

app.use(helmet());
```

### Customize the Content-Security-Policy

```ts
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", 'https://cdn.example.com'],
        'style-src': ["'self'", "'unsafe-inline'"],
      },
    },
  })
);
```

### Disable a header entirely

```ts
app.use(
  helmet({
    contentSecurityPolicy: false,
    hsts: false,
  })
);
```

### Use a preset for your deployment shape

```ts
import { strictHelmet, apiHelmet, devHelmet } from '@nextrush/helmet';

if (process.env.NODE_ENV === 'production') {
  app.use(apiHelmet()); // no CSP, no COEP -- tuned for JSON APIs
} else {
  app.use(devHelmet()); // no HSTS, no CSP -- relaxed for local development
}
```

### Generate a CSP nonce for inline scripts

```ts
import { generateNonce, buildCspWithNonce, buildCspHeader } from '@nextrush/helmet';

app.use(async (ctx) => {
  const nonce = generateNonce();
  const { cspOptions } = buildCspWithNonce(
    { directives: { 'default-src': ["'self'"] }, generateNonce: true },
    nonce
  );
  ctx.set('Content-Security-Policy', buildCspHeader(cspOptions.directives ?? {}));
  await ctx.next();
});
```

### Clear browser data on logout

```ts
import { logoutHelmet } from '@nextrush/helmet';

app.post('/logout', logoutHelmet(), async (ctx) => {
  ctx.json({ success: true });
});
```

## API overview

The sealed public surface (ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `helmet` | `(options?: HelmetOptions) => Middleware` | 3.0.0 | Stable | The core security-headers middleware; also the default export. |
| `strictHelmet` | `(overrides?: Partial<HelmetOptions>) => Middleware` | 3.0.0 | Stable | Maximum security -- strict CSP, restrictive Permissions-Policy, 1-year preloaded HSTS. |
| `apiHelmet` | `(overrides?: Partial<HelmetOptions>) => Middleware` | 3.0.0 | Stable | No CSP, no COEP -- tuned for JSON/GraphQL APIs. |
| `devHelmet` | `() => Middleware` | 3.0.0 | Stable | No CSP, no HSTS -- relaxed for local development. Logs a warning if run with `NODE_ENV=production`. |
| `staticHelmet` | `(overrides?: Partial<HelmetOptions>) => Middleware` | 3.0.0 | Stable | Locked-down CSP (`default-src 'none'`), cross-origin resource loading allowed. |
| `logoutHelmet` | `(clearData?: ClearSiteDataValue[]) => Middleware` | 3.0.0 | Stable | Sets `Clear-Site-Data`; disables most other headers for that response. |
| `hidePoweredBy` | `() => Middleware` | 3.0.0 | Stable | Removes `X-Powered-By` only, all other headers disabled. |
| `contentSecurityPolicy` | `(options?: ContentSecurityPolicyOptions) => Middleware` | 3.0.0 | Stable | CSP only, all other headers disabled. |
| `hsts` | `(options?: StrictTransportSecurityOptions) => Middleware` | 3.0.0 | Stable | HSTS only, all other headers disabled. |
| `noSniff` | `() => Middleware` | 3.0.0 | Stable | `X-Content-Type-Options: nosniff` only. |
| `referrerPolicy` | `(policy?: ReferrerPolicyValue \| ReferrerPolicyValue[]) => Middleware` | 3.0.0 | Stable | `Referrer-Policy` only, default `'no-referrer'`. |
| `buildCspHeader` | `(directives: ContentSecurityPolicyDirectives) => string` | 3.0.0 | Stable | Serialize a directives object into a CSP header string. |
| `createCspBuilder` | `() => CspBuilder` | 3.0.0 | Stable | Fluent CSP builder (`.defaultSrc()`, `.scriptSrc()`, `.build()`, `.toOptions()`, ...). |
| `buildCspWithNonce` | `(options: CspWithNonceOptions, requestNonce?: string) => { cspOptions, nonce }` | 3.0.0 | Stable | Injects a `'nonce-...'` value into `script-src`/`style-src`. |
| `analyzeCsp` | `(directives: ContentSecurityPolicyDirectives) => string[]` | 3.0.0 | Stable | Returns warnings for unsafe values, missing `default-src`/`object-src`/`base-uri`, and wildcard sources. |
| `buildPermissionsPolicyHeader` | `(directives: PermissionsPolicyDirectives) => string` | 3.0.0 | Stable | Serialize a Permissions-Policy directives object. |
| `createPermissionsPolicyBuilder` | `() => PermissionsPolicyBuilder` | 3.0.0 | Stable | Fluent builder (`.disable()`, `.allow()`, `.camera()`, ...). |
| `restrictivePermissionsPolicy` | `() => PermissionsPolicyDirectives` | 3.0.0 | Stable | Disables most sensor/media features; `fullscreen` and `picture-in-picture` limited to `self`. |
| `generateNonce` | `(length?: number) => string` | 3.0.0 | Stable | Base64-encoded, `crypto.getRandomValues()`-backed nonce (default 16 bytes). |
| `generateCspNonce` | `(length?: number) => string` | 3.0.0 | Stable | Same as `generateNonce`, wrapped as `"'nonce-...'"`. |
| `extractNonce` / `validateNonce` / `createNonceProvider` | `functions` | 3.0.0 | Stable | Nonce extraction, format validation, and a reusable provider factory. |
| `createNoncedScript` / `createNoncedStyle` | `(nonce: string, content: string) => string` | 3.0.0 | Stable | Build a `<script>`/`<style>` tag with the nonce attribute and escaped content. |
| `sanitizeHeaderValue` / `sanitizeCspValue` | `(value: string) => string` | 3.0.0 | Stable | Header-injection-safe sanitizers; throw on control characters or forbidden CSP characters. |
| `isValidCspDirective` / `isBooleanCspDirective` / `isUnsafeCspValue` / `isValidNonce` / `isValidHash` / `isCspValueSafe` | `functions` | 3.0.0 | Stable | Validation predicates used internally and exposed for custom tooling. |
| `validateHstsOptions` | `(options: StrictTransportSecurityOptions) => HstsValidationResult` | 3.0.0 | Stable | Returns `{ valid, warnings, errors }` for a given HSTS configuration. |
| `analyzeCspSecurity` | `(directives: Record<string, unknown>) => string[]` | 3.0.0 | Stable | The warning-generation logic behind `analyzeCsp`. |
| `securityWarning` | `(message: string, details?: Record<string, unknown>) => void` | 3.0.0 | Stable | Dev-only (`NODE_ENV !== 'production'`) `console.warn` sink used by the validators above. |
| `HEADERS` / `DEFAULT_CSP_DIRECTIVES` / `STRICT_CSP_DIRECTIVES` / `DEFAULT_HSTS_MAX_AGE` / `RECOMMENDED_HSTS_MAX_AGE` / `MIN_HSTS_PRELOAD_MAX_AGE` / `VALID_CSP_DIRECTIVES` / `BOOLEAN_CSP_DIRECTIVES` / `UNSAFE_CSP_VALUES` | `const` | 3.0.0 | Stable | Header names and default values for custom implementations. |
| `type HelmetOptions` / `ContentSecurityPolicyOptions` / `StrictTransportSecurityOptions` / `PermissionsPolicyDirectives` / and related types | -- | 3.0.0 | Stable | Public option and data contracts. |
| default export | `helmet` | 3.0.0 | Stable | Same function as the named `helmet` export. |

## Options

Every default below is read directly from `src/middleware.ts`'s destructuring defaults.

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `contentSecurityPolicy` | `ContentSecurityPolicyOptions \| false` | No | `{ useDefaults: true }` | Yes | Sets `Content-Security-Policy` from `DEFAULT_CSP_DIRECTIVES` merged with any provided `directives`. |
| `crossOriginEmbedderPolicy` | `'require-corp' \| 'credentialless' \| 'unsafe-none' \| false` | No | `'require-corp'` | Yes | Controls whether the document can load cross-origin resources without CORP/CORS. |
| `crossOriginOpenerPolicy` | `CrossOriginOpenerPolicyValue \| false` | No | `'same-origin'` | Yes | Isolates the browsing context from cross-origin windows. |
| `crossOriginResourcePolicy` | `CrossOriginResourcePolicyValue \| false` | No | `'same-origin'` | Yes | Restricts which origins can load this resource. |
| `dnsPrefetchControl` | `'on' \| 'off' \| false` | No | `'off'` | No | Disables browser DNS prefetching by default. |
| `hsts` | `StrictTransportSecurityOptions \| false` | No | `{ maxAge: 15552000, includeSubDomains: true }` | Yes | `maxAge` is validated at construction; invalid values throw. |
| `noSniff` | `boolean` | No | `true` | No | Sets `X-Content-Type-Options: nosniff`. |
| `originAgentCluster` | `boolean` | No | `true` | No | Sets `Origin-Agent-Cluster: ?1` for process isolation. |
| `permissionsPolicy` | `PermissionsPolicyDirectives \| false` | No | `undefined` (header not sent) | Yes | Only sent when explicitly provided -- there is no default feature list. |
| `referrerPolicy` | `ReferrerPolicyValue \| ReferrerPolicyValue[] \| false` | No | `'no-referrer'` | Yes | Controls how much referrer information is sent on navigation. |
| `xssFilter` | `boolean` | No | `false` | No | `false` (default) sends `X-XSS-Protection: 0` -- the OWASP-recommended value, since the legacy filter itself is a known XSS vector in old browsers. `true` sends `1; mode=block`. |
| `ieNoOpen` | `boolean` | No | `true` | No | Sets `X-Download-Options: noopen` (Internet Explorer only). |
| `permittedCrossDomainPolicies` | `'none' \| 'master-only' \| 'by-content-type' \| 'all' \| false` | No | `'none'` | No | Controls Adobe Flash/PDF cross-domain policy file loading. |
| `clearSiteData` | `ClearSiteDataValue[] \| false` | No | `undefined` (header not sent) | Yes | Instructs the browser to clear cache/cookies/storage -- typically used only on a logout route. |
| `reportingEndpoints` | `Record<string, string> \| false` | No | `undefined` (header not sent) | No | Names Reporting API endpoints for CSP/other report-to targets. Throws if a URL contains a `"` character. |
| `hidePoweredBy` | `boolean` | No | `true` | Yes | Removes `X-Powered-By` via `ctx.remove()` when the context supports it, preventing framework fingerprinting. |

### Header defaults set by `helmet()`

| Header | Default value | Source |
| ------ | -------------- | ------ |
| `Content-Security-Policy` | `DEFAULT_CSP_DIRECTIVES` (`default-src 'self'`, `object-src 'none'`, `upgrade-insecure-requests`, and 8 more) | `constants.ts` |
| `Cross-Origin-Embedder-Policy` | `require-corp` | `middleware.ts` |
| `Cross-Origin-Opener-Policy` | `same-origin` | `middleware.ts` |
| `Cross-Origin-Resource-Policy` | `same-origin` | `middleware.ts` |
| `X-DNS-Prefetch-Control` | `off` | `middleware.ts` |
| `Strict-Transport-Security` | `max-age=15552000; includeSubDomains` | `middleware.ts` + `constants.ts` |
| `X-Content-Type-Options` | `nosniff` | `middleware.ts` |
| `Origin-Agent-Cluster` | `?1` | `middleware.ts` |
| `Referrer-Policy` | `no-referrer` | `middleware.ts` |
| `X-XSS-Protection` | `0` | `middleware.ts` |
| `X-Download-Options` | `noopen` | `middleware.ts` |
| `X-Permitted-Cross-Domain-Policies` | `none` | `middleware.ts` |
| `X-Powered-By` | removed (not set to a value -- the header is deleted) | `middleware.ts` |

`Permissions-Policy`, `Clear-Site-Data`, and `Reporting-Endpoints` are **not** set unless you provide `permissionsPolicy`, `clearSiteData`, or `reportingEndpoints` explicitly -- there is no default value for any of the three.

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
| Bun / Deno / Edge | Yes / Yes / Yes | Zero `node:` imports -- sets response headers only; nonce generation uses the Web Crypto API (`crypto.getRandomValues`) |

**Integration**
- **Peer dependencies:** none -- depends only on `@nextrush/types` (types, erased at build).
- **Works with:** any NextRush middleware chain; register `helmet()` early so headers are present on every response, including error responses.
- **Incompatible with:** none directly -- a middleware that also writes one of these 13 headers after `helmet()` runs will overwrite Helmet's value for that response.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>Inline `<script>` tags are blocked after adding `helmet()`</strong></summary>

**Cause:** the default CSP's `script-src 'self'` (from `DEFAULT_CSP_DIRECTIVES`) does not include `'unsafe-inline'`, so inline scripts are blocked by design -- this is the header working as intended. **Fix:** use a nonce (`generateNonce()` + `buildCspWithNonce()`) for inline scripts you control, rather than relaxing `script-src` to `'unsafe-inline'`.

```ts
app.use(async (ctx) => {
  const nonce = generateNonce();
  const { cspOptions } = buildCspWithNonce(
    { directives: { 'script-src': ["'self'"] }, generateNonce: true },
    nonce
  );
  ctx.set('Content-Security-Policy', buildCspHeader(cspOptions.directives ?? {}));
  await ctx.next();
});
```

</details>

<details>
<summary><strong>An HSTS `preload: true` configuration logs a warning</strong></summary>

**Cause:** `validateHstsOptions()` in `validation.ts` checks that `preload: true` is paired with `maxAge >= 31536000` (1 year, `MIN_HSTS_PRELOAD_MAX_AGE`) and `includeSubDomains: true` -- both are required by the browser preload list submission process, not by this package. **Fix:** set both explicitly.

```ts
app.use(helmet({ hsts: { maxAge: 31536000, includeSubDomains: true, preload: true } }));
```

</details>

<details>
<summary><strong>`Error: [@nextrush/helmet] HSTS Error: ...` thrown on startup</strong></summary>

**Cause:** `helmet()` validates `hsts` at construction time; a non-finite or negative `maxAge` is a hard error, not a warning -- unlike the preload check above. **Fix:** pass a finite, non-negative `maxAge` in seconds.

</details>

<details>
<summary><strong>An API response still has `X-Powered-By` set</strong></summary>

**Cause:** `hidePoweredBy` calls `ctx.remove(HEADERS.X_POWERED_BY)`, which requires the `Context` implementation to support a `remove()` method (`HelmetContext.remove` is optional in `types.ts`). **Fix:** confirm your adapter's `Context` implements `remove()`; if it doesn't, the header is only ever removed by not being set in the first place upstream.

</details>

## FAQ

**Can I use `@nextrush/helmet` without `nextrush`?**
Yes. It depends only on `@nextrush/types` for the middleware signature (types, erased at build) -- there's no runtime dependency to install beyond the package itself.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Yes. The package has zero `node:` imports -- header construction uses only string building, and nonce generation uses `crypto.getRandomValues()`, a Web-standard API available identically on every supported runtime.

**Why does the default `xssFilter` send `X-XSS-Protection: 0` instead of leaving the header unset?**
`X-XSS-Protection: 0` explicitly disables the legacy browser XSS auditor, which OWASP recommends because the auditor itself has been used as an XSS vector in older browsers (via information leaks from its heuristic matching). Leaving the header unset would let some older browsers apply their own default heuristic filter instead.

---

## Package relationships

```text
                   depends on            @nextrush/types  (Context / Middleware contracts, types only)
@nextrush/helmet ---------------->
                   often used with       @nextrush/cors  (security headers alongside CORS)
                   usually used next     @nextrush/csrf  (cookie-based session protection)
```

- **Depends on:** [`@nextrush/types`](../../types) -- shared `Context`/`Middleware` contracts, used only by the middleware signature (types, erased at build).
- **Often used with:** [`@nextrush/cors`](../cors) -- browser-facing security headers alongside cross-origin access control.
- **Usually used next:** `@nextrush/csrf` -- CSRF protection for cookie-based sessions, a concern Helmet deliberately does not cover.
- **Alternative:** none for browser response-header security -- reverse-proxy/CDN-level header injection is an infrastructure concern, not a middleware.

## Architecture

Maintaining or contributing to this package? The internal design -- module layout, the
header-injection sequence, the security invariants that require an RFC to change, and the
decisions and trade-offs behind them (with diagrams) -- is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
