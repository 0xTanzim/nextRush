# @nextrush/helmet

Security headers middleware for NextRush. Protect your app from common web vulnerabilities with sensible defaults and fine-grained control.

## Installation

```bash
npm install @nextrush/helmet
# or
pnpm add @nextrush/helmet
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { helmet } from '@nextrush/helmet';

const app = createApp();

// Enable all security headers with defaults
app.use(helmet());

app.get('/', (ctx) => {
  ctx.html('<h1>Secure App</h1>');
});
```

## Features

- **15+ Security Headers**: Comprehensive protection out of the box
- **Sensible Defaults**: Secure by default, customize as needed
- **Modular**: Use individual middleware or the combined `helmet()`
- **CSP Builder**: Fluent API for Content Security Policy

## Headers Set by Default

| Header | Protection |
|--------|------------|
| `Content-Security-Policy` | XSS, injection attacks |
| `Strict-Transport-Security` | Force HTTPS |
| `X-Content-Type-Options` | MIME sniffing |
| `X-Frame-Options` | Clickjacking |
| `X-XSS-Protection` | Legacy XSS filter |
| `Referrer-Policy` | Information leakage |
| `X-DNS-Prefetch-Control` | DNS prefetch control |
| `X-Permitted-Cross-Domain-Policies` | Adobe cross-domain |
| `X-Download-Options` | IE download execution |
| `Cross-Origin-Opener-Policy` | Cross-origin isolation |
| `Cross-Origin-Resource-Policy` | Resource access control |
| `Cross-Origin-Embedder-Policy` | Embedding control |
| `Origin-Agent-Cluster` | Process isolation |
| `Permissions-Policy` | Browser feature control |

## Configuration

### Disable Specific Headers

```typescript
app.use(helmet({
  contentSecurityPolicy: false,  // Disable CSP
  hsts: false,                   // Disable HSTS
}));
```

### Customize Headers

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'cdn.example.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,        // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: 'deny',          // or 'sameorigin'
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
}));
```

## Individual Middleware

Use specific headers without the full helmet:

```typescript
import {
  contentSecurityPolicy,
  hsts,
  frameguard,
  noSniff,
  xssFilter,
  referrerPolicy,
  dnsPrefetchControl,
  permissionsPolicy,
} from '@nextrush/helmet';

// Only HSTS
app.use(hsts({ maxAge: 31536000 }));

// Only CSP
app.use(contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
  },
}));

// Only X-Frame-Options
app.use(frameguard({ action: 'deny' }));
```

## Content Security Policy

### Basic CSP

```typescript
app.use(contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    fontSrc: ["'self'", 'fonts.googleapis.com'],
    connectSrc: ["'self'", 'api.example.com'],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
  },
}));
```

### Report-Only Mode

Test CSP without blocking:

```typescript
app.use(contentSecurityPolicy({
  reportOnly: true,
  directives: {
    defaultSrc: ["'self'"],
    reportUri: '/csp-report',
  },
}));
```

### Nonce-Based CSP

For inline scripts:

```typescript
app.use(contentSecurityPolicy({
  directives: {
    scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
  },
}));

app.use((ctx, next) => {
  ctx.state.nonce = crypto.randomUUID();
  return next();
});
```

## HTTP Strict Transport Security

```typescript
app.use(hsts({
  maxAge: 31536000,        // 1 year in seconds
  includeSubDomains: true, // Apply to subdomains
  preload: true,           // Submit to preload list
}));
```

**Note**: Only enable `preload` if you've submitted to [hstspreload.org](https://hstspreload.org).

## Permissions Policy

Control browser features:

```typescript
app.use(permissionsPolicy({
  features: {
    geolocation: ["'self'"],
    camera: ["'none'"],
    microphone: ["'none'"],
    payment: ["'self'", 'https://pay.example.com'],
    fullscreen: ["'self'"],
    accelerometer: ["'none'"],
  },
}));
```

## Cross-Origin Policies

```typescript
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  crossOriginEmbedderPolicy: { policy: 'require-corp' },
}));
```

## API Reference

### Main Export

```typescript
import { helmet } from '@nextrush/helmet';

app.use(helmet(options?));
```

### Individual Exports

```typescript
import {
  // Main
  helmet,

  // Individual middleware
  contentSecurityPolicy,
  hsts,
  frameguard,
  noSniff,
  xssFilter,
  referrerPolicy,
  dnsPrefetchControl,
  permissionsPolicy,
  crossOriginOpenerPolicy,
  crossOriginResourcePolicy,
  crossOriginEmbedderPolicy,
  originAgentCluster,
  ieNoOpen,
  permittedCrossDomainPolicies,
} from '@nextrush/helmet';
```

### Types

```typescript
interface HelmetOptions {
  contentSecurityPolicy?: ContentSecurityPolicyOptions | false;
  hsts?: HstsOptions | false;
  frameguard?: FrameguardOptions | false;
  noSniff?: boolean;
  xssFilter?: boolean;
  referrerPolicy?: ReferrerPolicyOptions | false;
  dnsPrefetchControl?: DnsPrefetchControlOptions | false;
  permissionsPolicy?: PermissionsPolicyOptions | false;
  crossOriginOpenerPolicy?: CrossOriginOpenerPolicyOptions | false;
  crossOriginResourcePolicy?: CrossOriginResourcePolicyOptions | false;
  crossOriginEmbedderPolicy?: CrossOriginEmbedderPolicyOptions | false;
}

interface ContentSecurityPolicyOptions {
  directives: Record<string, string[] | boolean>;
  reportOnly?: boolean;
}

interface HstsOptions {
  maxAge?: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}
```

## Common Configurations

### API Server

```typescript
app.use(helmet({
  contentSecurityPolicy: false, // APIs don't serve HTML
  frameguard: false,
  hsts: { maxAge: 31536000 },
}));
```

### Single Page App

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'api.example.com'],
    },
  },
}));
```

### Embedding Allowed

```typescript
app.use(helmet({
  frameguard: false,
  crossOriginEmbedderPolicy: false,
}));
```

## License

MIT
