# @nextrush/cookies

> Secure, RFC 6265-compliant cookie middleware with HMAC signing, CRLF injection protection, and key rotation support.

## The Problem

Cookies seem simple until they aren't. Session hijacking, CRLF injection, cross-site request forgery—these attacks exploit frameworks that treat cookies as plain strings. Most cookie libraries either:

1. **Provide no security** - leaving developers to manually handle encoding, validation, and signing
2. **Hide too much** - auto-signing everything with no way to understand or customize
3. **Lack key rotation** - forcing service downtime when you need to rotate secrets

You need cookies that are secure by default, transparent in behavior, and flexible when requirements change.

## What NextRush Does Differently

`@nextrush/cookies` provides production-grade cookie handling:

- **Security-first defaults** - HttpOnly, SameSite=Lax, Path=/ applied automatically
- **CRLF injection prevention** - Sanitizes values before serialization
- **Cookie prefix validation** - Enforces `__Secure-` and `__Host-` requirements per spec
- **HMAC-SHA256 signing** - Web Crypto API for runtime compatibility (Node.js, Bun, Edge)
- **Key rotation** - Verify with current key, fall back to previous keys during rotation
- **Explicit API** - No hidden magic, every behavior documented

## Installation

```bash
pnpm add @nextrush/cookies
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { cookies } from '@nextrush/cookies';

const app = createApp();

app.use(cookies());

app.get('/profile', async (ctx) => {
  const session = ctx.state.cookies.get('session');
  ctx.json({ session });
});

app.post('/login', async (ctx) => {
  ctx.state.cookies.set('session', 'user-123', {
    httpOnly: true,
    secure: true,
    maxAge: 86400, // 1 day in seconds
  });
  ctx.json({ success: true });
});

app.post('/logout', async (ctx) => {
  ctx.state.cookies.delete('session');
  ctx.json({ success: true });
});
```

## Mental Model

Think of this middleware as a **cookie vault**:

1. **Parsing**: When a request arrives, cookies are parsed from the `Cookie` header and sanitized
2. **Reading**: `ctx.state.cookies.get()` retrieves parsed values
3. **Writing**: `ctx.state.cookies.set()` queues cookies for the response
4. **Serialization**: After your handler runs, queued cookies are serialized to `Set-Cookie` headers

Signed cookies add a **tamper-detection layer**:

```
Original: session=abc123
Signed:   session=abc123.HmacSignature
```

If someone modifies `abc123`, the signature won't match, and `get()` returns `undefined`.

## Signed Cookies

For tamper-proof cookies, use the signed cookies middleware:

```typescript
import { signedCookies } from '@nextrush/cookies';

app.use(signedCookies({
  secret: process.env.COOKIE_SECRET!,
}));

app.post('/auth', async (ctx) => {
  await ctx.state.signedCookies.set('userId', 'user-456', {
    httpOnly: true,
    secure: true,
  });
  ctx.json({ success: true });
});

app.get('/profile', async (ctx) => {
  const userId = await ctx.state.signedCookies.get('userId');
  if (!userId) {
    ctx.status = 401;
    return ctx.json({ error: 'Invalid session' });
  }
  ctx.json({ userId });
});
```

### Key Rotation

When rotating secrets, provide previous keys to maintain session continuity:

```typescript
app.use(signedCookies({
  secret: process.env.COOKIE_SECRET_NEW!,
  previousSecrets: [
    process.env.COOKIE_SECRET_OLD!,
  ],
}));
```

During rotation:
1. New cookies are signed with `secret`
2. Verification tries `secret` first, then `previousSecrets` in order
3. Old sessions remain valid until they naturally expire

## Security Features

### CRLF Injection Prevention

Cookie values are automatically sanitized:

```typescript
// Attacker tries: "value\r\nSet-Cookie: evil=payload"
// Result: "valueSet-Cookie: evil=payload" (CRLF removed)
ctx.state.cookies.set('safe', 'value\r\nSet-Cookie: evil=payload');
```

### Cookie Prefix Enforcement

The `__Secure-` and `__Host-` prefixes have strict requirements:

```typescript
import { serializeCookie } from '@nextrush/cookies';

// ✅ Valid: __Secure- requires secure=true
serializeCookie('__Secure-token', 'value', { secure: true });

// ✅ Valid: __Host- requires secure=true, path='/', no domain
serializeCookie('__Host-session', 'value', { secure: true, path: '/' });

// ❌ Throws SecurityError: __Secure- without secure flag
serializeCookie('__Secure-token', 'value', { secure: false });

// ❌ Throws SecurityError: __Host- with domain
serializeCookie('__Host-session', 'value', { secure: true, domain: 'example.com' });
```

### Public Suffix Blocking

Prevents setting cookies on TLDs:

```typescript
// ❌ Throws SecurityError: Cannot set cookie on public suffix
serializeCookie('session', 'value', { domain: '.com' });
serializeCookie('session', 'value', { domain: '.co.uk' });
```

### Size Limits

Cookies exceeding 4KB are rejected:

```typescript
// ❌ Throws RangeError: Cookie exceeds maximum size
serializeCookie('huge', 'x'.repeat(5000));
```

## API Reference

### Middleware

#### `cookies(options?)`

Creates cookie middleware that adds `ctx.state.cookies`.

```typescript
function cookies(options?: CookieMiddlewareOptions): Middleware
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `decode` | `boolean` | `true` | URL-decode cookie values |
| `sanitize` | `boolean` | `true` | Remove CRLF from values |

**Context API (`ctx.state.cookies`):**

| Method | Signature | Description |
|--------|-----------|-------------|
| `get` | `(name: string) => string \| undefined` | Get cookie value |
| `set` | `(name: string, value: string, options?: CookieOptions) => void` | Set cookie |
| `delete` | `(name: string, options?: CookieOptions) => void` | Delete cookie |
| `all` | `() => Record<string, string>` | Get all cookies |
| `has` | `(name: string) => boolean` | Check if cookie exists |

#### `signedCookies(options)`

Creates signed cookie middleware that adds `ctx.state.signedCookies`.

```typescript
function signedCookies(options: SignedCookieMiddlewareOptions): Middleware
```

**Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `secret` | `string` | Yes | Current signing secret |
| `previousSecrets` | `string[]` | No | Previous secrets for key rotation |

**Context API (`ctx.state.signedCookies`):**

| Method | Signature | Description |
|--------|-----------|-------------|
| `get` | `(name: string) => Promise<string \| undefined>` | Get and verify signed cookie |
| `set` | `(name: string, value: string, options?: CookieOptions) => Promise<void>` | Set signed cookie |
| `delete` | `(name: string, options?: CookieOptions) => void` | Delete cookie |
| `allRaw` | `() => Record<string, string>` | Get all raw (unverified) cookies |

### Utility Functions

#### `parseCookies(header, options?)`

Parse a Cookie header string.

```typescript
function parseCookies(
  header: string | null | undefined,
  options?: ParseOptions
): Record<string, string>
```

```typescript
parseCookies('name=value; session=abc123');
// { name: 'value', session: 'abc123' }
```

#### `serializeCookie(name, value, options?)`

Serialize a cookie for Set-Cookie header.

```typescript
function serializeCookie(
  name: string,
  value: string,
  options?: CookieOptions
): string
```

```typescript
serializeCookie('session', 'abc123', { httpOnly: true, secure: true });
// 'session=abc123; Path=/; HttpOnly; Secure; SameSite=Lax'
```

#### `signCookie(value, secret)`

Sign a cookie value with HMAC-SHA256.

```typescript
function signCookie(value: string, secret: string): Promise<string>
```

```typescript
await signCookie('user-123', 'secret');
// 'user-123.BASE64_SIGNATURE'
```

#### `unsignCookie(signedValue, secret)`

Verify and extract a signed cookie value.

```typescript
function unsignCookie(
  signedValue: string,
  secret: string
): Promise<string | undefined>
```

```typescript
await unsignCookie('user-123.BASE64_SIGNATURE', 'secret');
// 'user-123' or undefined if invalid
```

#### `unsignCookieWithRotation(signedValue, keys)`

Verify with key rotation support.

```typescript
function unsignCookieWithRotation(
  signedValue: string,
  keys: { current: string; previous?: string[] }
): Promise<string | undefined>
```

### Helper Functions

#### `secureOptions(options?)`

Returns secure cookie preset.

```typescript
function secureOptions(options?: CookieOptions): CookieOptions
```

```typescript
ctx.state.cookies.set('session', value, secureOptions({ maxAge: 86400 }));
// httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 86400
```

#### `sessionOptions(options?)`

Returns session cookie preset (expires when browser closes).

```typescript
function sessionOptions(options?: CookieOptions): CookieOptions
```

```typescript
ctx.state.cookies.set('temp', value, sessionOptions());
// httpOnly: true, secure: true, sameSite: 'strict', path: '/', no maxAge/expires
```

#### `createSecurePrefixCookie(name, value, options?)`

Create a `__Secure-` prefixed cookie.

```typescript
createSecurePrefixCookie('token', 'value', { maxAge: 3600 });
// Validates prefix requirements, returns serialized cookie
```

#### `createHostPrefixCookie(name, value, options?)`

Create a `__Host-` prefixed cookie.

```typescript
createHostPrefixCookie('session', 'value');
// Validates prefix requirements (secure=true, path='/', no domain)
```

### Types

```typescript
import type {
  CookieOptions,
  CookieContext,
  SignedCookieContext,
  ParseOptions,
  SameSiteValue,
  CookiePriority,
} from '@nextrush/cookies';
```

#### `CookieOptions`

```typescript
interface CookieOptions {
  domain?: string;
  expires?: Date | number;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: SameSiteValue;
  secure?: boolean;
  priority?: CookiePriority;
  partitioned?: boolean;
}
```

## Common Mistakes

### Setting secure cookies without HTTPS

```typescript
// ❌ Won't work: secure cookies require HTTPS
ctx.state.cookies.set('session', 'value', { secure: true });
// Browser ignores cookie on HTTP
```

### Forgetting to await signed cookie operations

```typescript
// ❌ Returns Promise, not value
const userId = ctx.state.signedCookies.get('userId');

// ✅ Correct
const userId = await ctx.state.signedCookies.get('userId');
```

### Using SameSite=None without Secure

```typescript
// ❌ Browsers reject this combination
ctx.state.cookies.set('cross', 'value', { sameSite: 'none' });

// ✅ Correct
ctx.state.cookies.set('cross', 'value', { sameSite: 'none', secure: true });
```

## When NOT to Use

- **Large data storage** - Cookies have a 4KB limit; use sessions with server-side storage
- **Sensitive data without signing** - Never store passwords or tokens in unsigned cookies
- **Cross-domain state** - Consider tokens or other mechanisms for cross-origin authentication

## Runtime Compatibility

This package uses the Web Crypto API and works in:

- Node.js 20+
- Bun
- Cloudflare Workers
- Deno
- Vercel Edge Runtime

## License

MIT
