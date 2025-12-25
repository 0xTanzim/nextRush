# @nextrush/cookies

Secure cookie parsing and serialization middleware for NextRush. Features HMAC signing, secure presets, and a clean API.

## Installation

```bash
npm install @nextrush/cookies
# or
pnpm add @nextrush/cookies
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';
import { cookies } from '@nextrush/cookies';

const app = createApp();

// Add cookie middleware
app.use(cookies());

// Read cookies
app.get('/profile', async (ctx) => {
  const session = ctx.state.cookies.get('session');
  ctx.json({ session });
});

// Set cookies
app.post('/login', async (ctx) => {
  ctx.state.cookies.set('session', 'user-session-id', {
    httpOnly: true,
    secure: true,
    maxAge: 86400, // 1 day
  });
  ctx.json({ success: true });
});

// Delete cookies
app.post('/logout', async (ctx) => {
  ctx.state.cookies.delete('session');
  ctx.json({ success: true });
});

serve(app, 3000);
```

## Features

- **Simple API**: Get, set, delete with clean interface
- **Signed Cookies**: HMAC-based tamper detection
- **Secure Presets**: One-liner for production-safe defaults
- **Zero Dependencies**: Pure TypeScript implementation

## Signed Cookies

For tamper-proof cookies, use signed cookies:

```typescript
import { signedCookies } from '@nextrush/cookies';

app.use(signedCookies('your-secret-key'));

app.post('/auth', async (ctx) => {
  // Set a signed cookie
  await ctx.state.signedCookies.set('user', 'john', {
    httpOnly: true,
    secure: true,
  });
  ctx.json({ success: true });
});

app.get('/profile', async (ctx) => {
  // Get and verify signed cookie
  const user = await ctx.state.signedCookies.get('user');
  if (!user) {
    ctx.throw(401, 'Invalid session');
  }
  ctx.json({ user });
});
```

### Cookie Options

```typescript
interface CookieOptions {
  domain?: string;          // Cookie domain
  expires?: Date;           // Expiration date
  httpOnly?: boolean;       // Prevent JS access (default: false)
  maxAge?: number;          // Max age in seconds
  path?: string;            // Cookie path (default: '/')
  sameSite?: 'strict' | 'lax' | 'none';  // CSRF protection
  secure?: boolean;         // HTTPS only
  priority?: 'low' | 'medium' | 'high';
  partitioned?: boolean;    // Third-party cookie partitioning
}
```

### Helper Functions

```typescript
import { secureOptions, sessionOptions } from '@nextrush/cookies';

// Secure cookie preset (httpOnly, secure, sameSite=strict)
ctx.state.cookies.set('session', value, secureOptions());
ctx.state.cookies.set('session', value, secureOptions(7 * 24 * 60 * 60)); // 7 days

// Session cookie preset (expires when browser closes)
ctx.state.cookies.set('temp', value, sessionOptions());
```

### Utility Functions

```typescript
import { parseCookies, serializeCookie, signCookie, unsignCookie } from '@nextrush/cookies';

// Parse cookie header
const cookies = parseCookies('name=value; session=abc123');
// { name: 'value', session: 'abc123' }

// Serialize cookie for Set-Cookie header
const header = serializeCookie('session', 'abc123', {
  httpOnly: true,
  secure: true,
});
// 'session=abc123; HttpOnly; Secure'

// Sign a cookie value
const signed = await signCookie('value', 'secret');
// 'value.signature'

// Verify and extract signed value
const original = await unsignCookie(signed, 'secret');
// 'value' or undefined if invalid
```

## API Reference

### `cookies(options?)`

Creates cookie middleware that adds `ctx.state.cookies` with:

- `get(name)` - Get cookie value
- `set(name, value, options?)` - Set cookie
- `delete(name, options?)` - Delete cookie
- `all()` - Get all cookies

### `signedCookies(secret, options?)`

Creates signed cookie middleware that adds `ctx.state.signedCookies` with:

- `get(name)` - Get and verify signed cookie (async)
- `set(name, value, options?)` - Set signed cookie (async)
- `delete(name, options?)` - Delete cookie
- `allRaw()` - Get all raw cookies (not verified)

### `secureOptions(maxAge?)`

Returns secure cookie options preset.

### `sessionOptions()`

Returns session cookie options preset.

## Security Best Practices

1. **Always use HTTPS** in production with `secure: true`
2. **Use `httpOnly: true`** to prevent XSS attacks
3. **Set `sameSite: 'strict'`** for CSRF protection
4. **Use signed cookies** for sensitive data
5. **Keep secrets secure** - use environment variables

## License

MIT
