# @nextrush/helmet

HTTP security headers middleware for NextRush v3. Sets 13 headers with OWASP-recommended defaults in a single call.

## Installation

```bash
pnpm add @nextrush/helmet
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { helmet } from '@nextrush/helmet';

const app = createApp();
app.use(helmet());
```

## Headers Set by Default

| Header                              | Default Value                         | Protection                                    |
| ----------------------------------- | ------------------------------------- | --------------------------------------------- |
| `Content-Security-Policy`           | OWASP defaults                        | XSS, injection attacks                        |
| `Cross-Origin-Embedder-Policy`      | `require-corp`                        | Embedding control                             |
| `Cross-Origin-Opener-Policy`        | `same-origin`                         | Cross-origin isolation                        |
| `Cross-Origin-Resource-Policy`      | `same-origin`                         | Resource access control                       |
| `Strict-Transport-Security`         | `max-age=15552000; includeSubDomains` | Force HTTPS                                   |
| `X-Content-Type-Options`            | `nosniff`                             | MIME sniffing                                 |
| `X-Frame-Options`                   | `SAMEORIGIN`                          | Clickjacking                                  |
| `X-XSS-Protection`                  | `0`                                   | Disable legacy XSS filter (OWASP recommended) |
| `X-DNS-Prefetch-Control`            | `off`                                 | DNS prefetch control                          |
| `X-Download-Options`                | `noopen`                              | IE download execution                         |
| `X-Permitted-Cross-Domain-Policies` | `none`                                | Adobe cross-domain                            |
| `Referrer-Policy`                   | `no-referrer`                         | Information leakage                           |
| `Origin-Agent-Cluster`              | `?1`                                  | Process isolation                             |

Headers **not** set by default: `Permissions-Policy`, `Clear-Site-Data`, `Reporting-Endpoints`.

## Configuration

### Customize Headers

```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", 'https://cdn.example.com'],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: 'DENY',
    referrerPolicy: 'strict-origin-when-cross-origin',
    crossOriginEmbedderPolicy: 'credentialless',
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'same-origin',
  })
);
```

### Disable Specific Headers

```typescript
app.use(
  helmet({
    contentSecurityPolicy: false,
    hsts: false,
  })
);
```

## Presets

```typescript
import { strictHelmet, apiHelmet, devHelmet, staticHelmet, logoutHelmet } from '@nextrush/helmet';

// Maximum security for sensitive applications
app.use(strictHelmet());

// Optimized for REST/GraphQL APIs (no CSP, no COEP)
app.use(apiHelmet());

// Relaxed for local development (no HSTS, no CSP)
app.use(devHelmet());

// Static file serving
app.use(staticHelmet());

// Clear browser data on logout
app.post('/logout', logoutHelmet());
```

Presets accept an `overrides` parameter (except `devHelmet`):

```typescript
app.use(
  strictHelmet({
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  })
);
```

## Individual Header Middleware

Apply specific headers without the full Helmet stack:

```typescript
import { contentSecurityPolicy, hsts, frameguard, noSniff, referrerPolicy } from '@nextrush/helmet';

app.use(
  contentSecurityPolicy({
    directives: { 'default-src': ["'self'"] },
  })
);

app.use(hsts({ maxAge: 31536000, includeSubDomains: true, preload: true }));

app.use(frameguard('DENY'));

app.use(noSniff());

app.use(referrerPolicy('strict-origin-when-cross-origin'));
```

## Content Security Policy

CSP directives use **hyphenated keys** matching the HTTP specification.

### Basic CSP

```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'connect-src': ["'self'", 'https://api.example.com'],
        'object-src': ["'none'"],
        'upgrade-insecure-requests': true,
      },
    },
  })
);
```

### Report-Only Mode

Test CSP without blocking:

```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      reportOnly: true,
      directives: {
        'default-src': ["'self'"],
        'report-to': 'csp-endpoint',
      },
    },
  })
);
```

### CSP Builder

```typescript
import { createCspBuilder } from '@nextrush/helmet';

const builder = createCspBuilder()
  .defaultSrc("'self'")
  .scriptSrc("'self'", 'https://cdn.example.com')
  .styleSrc("'self'", "'unsafe-inline'")
  .imgSrc("'self'", 'data:', 'https:')
  .upgradeInsecureRequests();

app.use(
  helmet({
    contentSecurityPolicy: builder.toOptions(),
  })
);
```

### Nonce-Based CSP

For inline scripts without `'unsafe-inline'`:

```typescript
import { generateNonce, buildCspWithNonce, buildCspHeader } from '@nextrush/helmet';

app.use(async (ctx) => {
  const nonce = generateNonce();
  ctx.state.cspNonce = nonce;

  const { cspOptions } = buildCspWithNonce(
    {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
      },
      generateNonce: true,
    },
    nonce
  );

  const header = buildCspHeader(cspOptions.directives ?? {});
  ctx.set('Content-Security-Policy', header);
  await ctx.next();
});
```

## Permissions Policy

Control browser feature access. Use empty arrays to disable features, `['self']` for self-only.

```typescript
app.use(
  helmet({
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: ['self'],
      fullscreen: ['self'],
      payment: ['self', 'https://pay.example.com'],
    },
  })
);
```

Builder API:

```typescript
import { createPermissionsPolicyBuilder, restrictivePermissionsPolicy } from '@nextrush/helmet';

// Builder
const policy = createPermissionsPolicyBuilder()
  .disable('camera', 'microphone', 'geolocation')
  .allow('fullscreen', 'self')
  .getDirectives();

app.use(helmet({ permissionsPolicy: policy }));

// Or use the restrictive preset
app.use(helmet({ permissionsPolicy: restrictivePermissionsPolicy() }));
```

## API Reference

### `helmet(options?)`

Create security headers middleware.

```typescript
function helmet(options?: HelmetOptions): HelmetMiddleware;
```

### Exported Types

```typescript
interface HelmetOptions {
  contentSecurityPolicy?: ContentSecurityPolicyOptions | false;
  crossOriginEmbedderPolicy?: CrossOriginEmbedderPolicyValue | false;
  crossOriginOpenerPolicy?: CrossOriginOpenerPolicyValue | false;
  crossOriginResourcePolicy?: CrossOriginResourcePolicyValue | false;
  dnsPrefetchControl?: 'on' | 'off' | false;
  frameguard?: 'DENY' | 'SAMEORIGIN' | false;
  hsts?: StrictTransportSecurityOptions | false;
  noSniff?: boolean;
  originAgentCluster?: boolean;
  permissionsPolicy?: PermissionsPolicyDirectives | false;
  referrerPolicy?: ReferrerPolicyValue | ReferrerPolicyValue[] | false;
  xssFilter?: boolean;
  ieNoOpen?: boolean;
  permittedCrossDomainPolicies?: 'none' | 'master-only' | 'by-content-type' | 'all' | false;
  clearSiteData?: ClearSiteDataValue[] | false;
  reportingEndpoints?: Record<string, string> | false;
}

interface ContentSecurityPolicyOptions {
  directives?: ContentSecurityPolicyDirectives;
  reportOnly?: boolean;
  useDefaults?: boolean;
}

interface StrictTransportSecurityOptions {
  maxAge?: number; // Default: 15552000 (180 days)
  includeSubDomains?: boolean; // Default: true
  preload?: boolean; // Default: false
}
```

### Exported Functions

```typescript
// Main middleware
helmet(options?: HelmetOptions): HelmetMiddleware;

// Presets
strictHelmet(overrides?: Partial<HelmetOptions>): HelmetMiddleware;
apiHelmet(overrides?: Partial<HelmetOptions>): HelmetMiddleware;
devHelmet(): HelmetMiddleware;
staticHelmet(overrides?: Partial<HelmetOptions>): HelmetMiddleware;
logoutHelmet(clearData?: ClearSiteDataValue[]): HelmetMiddleware;

// Individual header middleware
contentSecurityPolicy(options?: ContentSecurityPolicyOptions): HelmetMiddleware;
hsts(options?: StrictTransportSecurityOptions): HelmetMiddleware;
frameguard(action?: 'DENY' | 'SAMEORIGIN'): HelmetMiddleware;
noSniff(): HelmetMiddleware;
referrerPolicy(policy?: ReferrerPolicyValue | ReferrerPolicyValue[]): HelmetMiddleware;

// CSP builders
buildCspHeader(directives: ContentSecurityPolicyDirectives): string;
buildCspWithNonce(options: CspWithNonceOptions, requestNonce?: string): { cspOptions: ContentSecurityPolicyOptions; nonce: string | null };
createCspBuilder(): CspBuilder;
analyzeCsp(directives: ContentSecurityPolicyDirectives): string[];

// Permissions-Policy builders
buildPermissionsPolicyHeader(directives: PermissionsPolicyDirectives): string;
createPermissionsPolicyBuilder(): PermissionsPolicyBuilder;
restrictivePermissionsPolicy(): PermissionsPolicyDirectives;

// Nonce utilities
generateNonce(length?: number): string;
generateCspNonce(length?: number): string;
extractNonce(cspNonce: string): string | null;
createNonceProvider(length?: number): () => string;
validateNonce(nonce: string): string | null;
createNoncedScript(nonce: string, content: string): string;
createNoncedStyle(nonce: string, content: string): string;

// Validation
sanitizeHeaderValue(value: string): string;
sanitizeCspValue(value: string): string;
isValidCspDirective(directive: string): boolean;
isBooleanCspDirective(directive: string): boolean;
isUnsafeCspValue(value: string): boolean;
isValidNonce(nonce: string): boolean;
isValidHash(hash: string): boolean;
validateHstsOptions(options: StrictTransportSecurityOptions): HstsValidationResult;
analyzeCspSecurity(directives: Record<string, unknown>): string[];
isCspValueSafe(value: string): boolean;
securityWarning(message: string, details?: Record<string, unknown>): void;
```

## Runtime Compatibility

| Runtime             | Supported |
| ------------------- | --------- |
| Node.js >=22        | ✅        |
| Bun                 | ✅        |
| Deno                | ✅        |
| Cloudflare Workers  | ✅        |
| Vercel Edge Runtime | ✅        |

## License

MIT
