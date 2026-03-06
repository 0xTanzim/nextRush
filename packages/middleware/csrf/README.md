# @nextrush/csrf

CSRF protection middleware for NextRush using the **Signed Double-Submit Cookie** pattern with HMAC-SHA256 — the approach recommended by OWASP.

## Features

- **OWASP-compliant** — Signed Double-Submit Cookie pattern (not the naive/insecure variant)
- **HMAC-SHA256 signed tokens** — Prevents cookie injection and token forgery
- **Session binding** — Optionally binds tokens to user sessions for maximum security
- **Constant-time comparison** — Mitigates timing side-channel attacks
- **Zero dependencies** — Uses Web Crypto API exclusively
- **Cross-runtime** — Works on Node.js, Bun, Deno, and Edge runtimes
- **`__Host-` cookie prefix** — Origin-locked cookie by default (Secure, no Domain, path `/`)
- **Sec-Fetch-Site support** — Optional defense-in-depth via Fetch Metadata headers
- **Path exclusions** — Exempt webhook endpoints and other cross-origin paths
- **Dual extraction** — Reads tokens from headers, body fields, or query parameters
- **Token provider** — Separate middleware for issuing tokens without enforcing protection

## Installation

```bash
pnpm add @nextrush/csrf
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { csrf } from '@nextrush/csrf';

const app = createApp();

const { protect, tokenProvider } = csrf({
  secret: process.env.CSRF_SECRET!, // min 32 chars, keep in env vars
});

// Apply CSRF protection globally
app.use(protect);

app.listen(3000);
```

## How It Works

The Signed Double-Submit Cookie pattern works in three steps:

1. **Server generates a token** — An HMAC-SHA256 signed token is created and set as a cookie (NOT HttpOnly, so JavaScript can read it)
2. **Client submits the token** — The client reads the cookie value and sends it back via a custom header (`x-csrf-token`), form field (`_csrf`), or query parameter
3. **Server validates** — The middleware checks that:
   - The submitted token matches the cookie token (constant-time comparison)
   - The HMAC signature is valid (proves the server issued it)
   - The session binding matches (if configured)

### Why is this secure?

- An attacker **cannot read cross-origin cookies** (blocked by Same-Origin Policy)
- An attacker **cannot forge tokens** without the HMAC secret
- The `__Host-` cookie prefix + `SameSite=Strict` prevents cookie injection from subdomains
- Session binding prevents stolen cookies from being replayed in a different session

## API

### `csrf(options): CsrfMiddleware`

Creates the CSRF middleware pair.

#### Options

| Option                 | Type                           | Default                            | Description                                                         |
| ---------------------- | ------------------------------ | ---------------------------------- | ------------------------------------------------------------------- |
| `secret`               | `string \| () => string`       | **required**                       | HMAC secret key (min 32 chars). Use env vars.                       |
| `getSessionIdentifier` | `(ctx) => string \| undefined` | —                                  | Extract session ID from request for token binding.                  |
| `getTokenFromRequest`  | `(ctx) => string \| undefined` | header/body/query                  | Custom token extraction from request.                               |
| `ignoredMethods`       | `string[]`                     | `['GET','HEAD','OPTIONS','TRACE']` | HTTP methods exempt from CSRF validation.                           |
| `excludePaths`         | `string[]`                     | `[]`                               | Paths exempt from CSRF validation. Supports `*` and `**` wildcards. |
| `cookie`               | `CsrfCookieOptions`            | See below                          | Cookie configuration.                                               |
| `tokenSize`            | `number`                       | `32`                               | Random value size in bytes (256 bits default).                      |
| `onError`              | `(ctx, reason) => void`        | 403 JSON                           | Custom error handler for CSRF failures.                             |
| `originCheck`          | `boolean`                      | `false`                            | Also check Origin/Sec-Fetch-Site headers.                           |
| `allowedOrigins`       | `string[]`                     | `[]`                               | Allowed origins when `originCheck` is enabled.                      |

#### Cookie Options

| Option     | Type                          | Default         | Description                                       |
| ---------- | ----------------------------- | --------------- | ------------------------------------------------- |
| `name`     | `string`                      | `'__Host-csrf'` | Cookie name. `__Host-` prefix recommended.        |
| `path`     | `string`                      | `'/'`           | Cookie path.                                      |
| `sameSite` | `'strict' \| 'lax' \| 'none'` | `'strict'`      | SameSite attribute.                               |
| `secure`   | `boolean`                     | `true`          | Secure flag (HTTPS only).                         |
| `httpOnly` | `boolean`                     | `false`         | Must be `false` for double-submit pattern.        |
| `domain`   | `string`                      | —               | Cookie domain. Not allowed with `__Host-` prefix. |
| `maxAge`   | `number`                      | —               | Max-Age in seconds.                               |

#### Returns

```typescript
interface CsrfMiddleware {
  protect: Middleware; // Validates CSRF tokens on unsafe methods
  tokenProvider: Middleware; // Attaches ctx.state.csrf without enforcing
}
```

### `ctx.state.csrf`

After middleware runs, `ctx.state.csrf` provides:

```typescript
interface CsrfContext {
  generateToken(): Promise<string>; // Generate token + set cookie
  readonly cookieToken: string | undefined; // Current cookie value
}
```

## Usage Examples

### SPA (Single Page Application)

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { csrf } from '@nextrush/csrf';

const app = createApp();
const router = createRouter();

const { protect, tokenProvider } = csrf({
  secret: process.env.CSRF_SECRET!,
});

// Endpoint to get a CSRF token
router.get('/csrf-token', tokenProvider, async (ctx) => {
  const token = await ctx.state.csrf.generateToken();
  ctx.json({ token });
});

// Protected API routes
app.use(protect);
app.route('/api', router);
app.listen(3000);
```

Client-side:

```javascript
// Fetch CSRF token
const { token } = await fetch('/api/csrf-token').then((r) => r.json());

// Include in subsequent requests
await fetch('/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': token,
  },
  body: JSON.stringify({ name: 'Alice' }),
  credentials: 'same-origin',
});
```

### Server-Rendered Forms

```typescript
const { protect } = csrf({
  secret: process.env.CSRF_SECRET!,
});

app.use(protect);

router.get('/form', async (ctx) => {
  const token = await ctx.state.csrf.generateToken();
  ctx.html(`
    <form method="POST" action="/submit">
      <input type="hidden" name="_csrf" value="${token}">
      <input type="text" name="name">
      <button type="submit">Submit</button>
    </form>
  `);
});
```

### With Session Binding

```typescript
const { protect } = csrf({
  secret: process.env.CSRF_SECRET!,
  getSessionIdentifier: (ctx) => ctx.state.sessionId,
});
```

### Excluding Webhook Paths

```typescript
const { protect } = csrf({
  secret: process.env.CSRF_SECRET!,
  excludePaths: [
    '/api/webhooks/stripe',
    '/api/webhooks/*', // single-level wildcard
    '/api/public/**', // multi-level wildcard
  ],
});
```

### With Origin Checking (Defense-in-Depth)

```typescript
const { protect } = csrf({
  secret: process.env.CSRF_SECRET!,
  originCheck: true,
  allowedOrigins: ['https://app.example.com', 'https://admin.example.com'],
});
```

### Custom Error Handling

```typescript
const { protect } = csrf({
  secret: process.env.CSRF_SECRET!,
  onError: (ctx, reason) => {
    ctx.status = 403;
    ctx.json({
      error: 'CSRF_FAILED',
      reason,
      docs: 'https://nextrush.dev/docs/csrf',
    });
  },
});
```

### Development Mode (No HTTPS)

```typescript
const { protect } = csrf({
  secret: process.env.CSRF_SECRET!,
  cookie: {
    name: 'csrf-token', // No __Host- prefix (doesn't require Secure)
    secure: false,
    sameSite: 'lax',
  },
});
```

## Token Format

Tokens follow the format: `<hmac-hex>.<random-hex>`

- **HMAC**: SHA-256 signature of the message payload
- **Random**: Cryptographically secure random bytes (default 32 bytes / 256 bits)

The HMAC message payload (OWASP format):

- With session: `<sessionId.length>!<sessionId>!<randomHex.length>!<randomHex>`
- Without session: `<randomHex.length>!<randomHex>`

## Security Considerations

### Do

- Store the secret in environment variables
- Use `__Host-` cookie prefix in production
- Enable `originCheck` for additional defense
- Bind tokens to sessions with `getSessionIdentifier`
- Use HTTPS in production (`secure: true` is the default)

### Don't

- Hardcode the CSRF secret in source code
- Set `httpOnly: true` on the cookie (breaks the double-submit pattern)
- Use short secrets (minimum 32 characters enforced)
- Trust the cookie value alone for validation (that's the naive pattern)
- Use `SameSite=None` without a strong reason

### OWASP References

- [CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Signed Double-Submit Cookie](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#signed-double-submit-cookie-recommended)

## Runtime Compatibility

| Runtime            | Status          |
| ------------------ | --------------- |
| Node.js 22+        | ✅ Full support |
| Bun                | ✅ Full support |
| Deno               | ✅ Full support |
| Cloudflare Workers | ✅ Full support |
| Vercel Edge        | ✅ Full support |

All cryptographic operations use the Web Crypto API (`crypto.subtle`), which is available across all modern JavaScript runtimes.

## License

MIT
