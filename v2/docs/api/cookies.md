# Cookie API Documentation

## Overview

NextRush v2 provides a comprehensive, high-performance cookie system with enterprise-grade security features. The cookie utilities are designed for ultra-fast parsing, secure handling, and type safety.

## Core Features

- **Ultra-Fast Parsing**: Single-pass cookie parsing algorithm
- **HMAC Signing**: Built-in cookie signing with timing-safe verification
- **Security Defaults**: Production-ready security settings
- **Lazy Evaluation**: Memory-efficient property caching
- **Type Safety**: Full TypeScript support
- **CookieJar**: Advanced cookie management

## Installation

Cookie functionality is built into the core framework:

```typescript
import { NextRushApp } from '@nextrush/core';

const app = new NextRushApp();
```

## Quick Start

### Reading Cookies

```typescript
app.get('/profile', (ctx) => {
  // Access parsed cookies
  const sessionId = ctx.req.cookies.session_id;
  const preferences = ctx.req.cookies.user_preferences;
  
  ctx.res.json({ sessionId, preferences });
});
```

### Setting Cookies

```typescript
app.post('/login', (ctx) => {
  const { username } = ctx.body;
  
  // Simple cookie
  ctx.res.cookie('username', username);
  
  // Secure cookie with options
  ctx.res.cookie('session_id', generateSessionId(), {
    httpOnly: true,
    secure: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict'
  });
  
  ctx.res.json({ status: 'logged in' });
});
```

### Signed Cookies

```typescript
app.post('/secure-data', (ctx) => {
  const secret = process.env.COOKIE_SECRET || 'your-secret-key';
  
  // Set signed cookie
  ctx.res.cookie('secure_data', 'sensitive-value', {
    signed: true,
    secret: secret
  });
  
  ctx.res.json({ status: 'data secured' });
});

app.get('/secure-data', (ctx) => {
  const secret = process.env.COOKIE_SECRET || 'your-secret-key';
  
  // Read signed cookie
  const signedValue = ctx.req.cookies.secure_data;
  const unsignedValue = unsignCookie(signedValue, secret);
  
  if (unsignedValue === false) {
    ctx.res.status(400).json({ error: 'Invalid cookie signature' });
    return;
  }
  
  ctx.res.json({ data: unsignedValue });
});
```

## Cookie Utilities API

### parseCookies(cookieHeader: string): CookieMap

Ultra-fast single-pass cookie parsing.

```typescript
import { parseCookies } from '@/utils/cookies';

const cookieHeader = 'session=abc123; theme=dark; lang=en';
const cookies = parseCookies(cookieHeader);

console.log(cookies.session); // 'abc123'
console.log(cookies.theme);   // 'dark'
console.log(cookies.lang);    // 'en'
```

**Features:**
- Single-pass parsing for maximum performance
- Handles quoted values and special characters
- URL decoding with fallback
- Empty value handling

### serializeCookie(name: string, value: string, options?: CookieOptions): string

Serialize a cookie with security defaults.

```typescript
import { serializeCookie } from '@/utils/cookies';

// Basic cookie
const basic = serializeCookie('theme', 'dark');
// → 'theme=dark'

// Secure cookie
const secure = serializeCookie('session', 'abc123', {
  httpOnly: true,
  secure: true,
  maxAge: 3600000,
  sameSite: 'strict',
  path: '/api'
});
// → 'session=abc123; Max-Age=3600; Path=/api; HttpOnly; Secure; SameSite=Strict'
```

**Production Security Defaults:**
- `httpOnly: true` (prevents XSS)
- `secure: true` (HTTPS only)
- `sameSite: 'strict'` (CSRF protection)

### signCookie(value: string, secret: string): string

Sign a cookie value with HMAC-SHA256.

```typescript
import { signCookie } from '@/utils/cookies';

const secret = 'your-secret-key';
const signed = signCookie('user-data', secret);
// → 'user-data.signature-hash'
```

**Security Features:**
- HMAC-SHA256 signing
- Base64URL encoding
- Timing-safe comparison

### unsignCookie(signedValue: string, secret: string): string | false

Verify and extract original value from signed cookie.

```typescript
import { unsignCookie } from '@/utils/cookies';

const secret = 'your-secret-key';
const signedValue = 'user-data.signature-hash';

const originalValue = unsignCookie(signedValue, secret);
if (originalValue !== false) {
  console.log('Valid cookie:', originalValue); // 'user-data'
} else {
  console.log('Invalid signature');
}
```

**Security Features:**
- Timing-attack resistant verification
- Signature validation
- Returns `false` for invalid signatures

## CookieJar Class

Advanced cookie management with collection operations.

```typescript
import { CookieJar } from '@/utils/cookies';

const jar = new CookieJar();

// Add cookies
jar.set('session', 'abc123', { httpOnly: true });
jar.set('theme', 'dark');
jar.set('lang', 'en');

// Retrieve cookies
const session = jar.get('session');
console.log(session?.value); // 'abc123'
console.log(session?.options.httpOnly); // true

// Check existence
const hasTheme = jar.has('theme'); // true

// Remove cookies
jar.delete('lang');

// Get all cookies
const allCookies = jar.getAll();

// Serialize all cookies
const headers = jar.toHeaders();
// ['session=abc123; HttpOnly', 'theme=dark']

// Clear all cookies
jar.clear();
```

## Cookie Options

Complete list of supported cookie attributes:

```typescript
interface CookieOptions {
  domain?: string;        // Cookie domain
  path?: string;          // Cookie path (default: '/')
  expires?: Date;         // Expiration date
  maxAge?: number;        // Max age in milliseconds
  httpOnly?: boolean;     // HTTP-only flag
  secure?: boolean;       // Secure flag
  sameSite?: 'strict' | 'lax' | 'none'; // SameSite policy
  signed?: boolean;       // Enable signing
  secret?: string;        // Secret for signing
  encode?: (value: string) => string; // Custom encoder
}
```

### Security Options Explained

#### httpOnly
Prevents JavaScript access to the cookie, protecting against XSS attacks.

```typescript
ctx.res.cookie('session', sessionId, { httpOnly: true });
```

#### secure
Ensures cookie is only sent over HTTPS connections.

```typescript
ctx.res.cookie('token', token, { secure: true });
```

#### sameSite
Controls cross-site request behavior:
- `'strict'`: Never sent with cross-site requests
- `'lax'`: Sent with top-level navigation
- `'none'`: Always sent (requires `secure: true`)

```typescript
ctx.res.cookie('csrf', token, { sameSite: 'strict' });
```

#### signed
Enables HMAC signing for tamper detection.

```typescript
ctx.res.cookie('user_id', userId, { 
  signed: true, 
  secret: process.env.COOKIE_SECRET 
});
```

## Request Enhancement

Cookies are automatically parsed and available on the request object:

```typescript
app.get('/dashboard', (ctx) => {
  // Cookies are lazily parsed and cached
  const sessionId = ctx.req.cookies.session_id;
  const userId = ctx.req.cookies.user_id;
  const theme = ctx.req.cookies.theme || 'light';
  
  // Parsed cookies are cached using symbols for performance
  const sameSession = ctx.req.cookies.session_id; // Uses cached value
});
```

**Performance Features:**
- Lazy evaluation (parsed on first access)
- Symbol-based caching for security
- Memory-efficient property descriptors

## Response Enhancement

Cookie setting methods are available on the response object:

```typescript
app.post('/settings', (ctx) => {
  const { theme, language } = ctx.body;
  
  // Set multiple cookies
  ctx.res.cookie('theme', theme);
  ctx.res.cookie('language', language, { maxAge: 365 * 24 * 60 * 60 * 1000 });
  
  // Clear cookies
  ctx.res.clearCookie('old_session');
  
  ctx.res.json({ status: 'preferences saved' });
});
```

## Performance Benchmarks

The cookie system is optimized for high-performance applications:

- **Parsing Speed**: > 1M cookies/second
- **Memory Usage**: Minimal allocations with lazy evaluation
- **Serialization**: Optimized string building
- **Security**: Zero-overhead HMAC verification

### Benchmark Results

```
Cookie Parsing Benchmarks:
├── Simple cookies (name=value): ~2.1M ops/sec
├── Complex cookies (quoted/encoded): ~1.8M ops/sec
├── Large cookie headers (10+ cookies): ~1.5M ops/sec
└── Memory usage: < 1KB per 1000 cookies

Cookie Serialization Benchmarks:
├── Basic serialization: ~3.2M ops/sec
├── With all options: ~2.8M ops/sec
├── Signed cookies: ~1.2M ops/sec
└── Memory usage: < 512B per cookie
```

## Security Best Practices

### 1. Use Signed Cookies for Sensitive Data

```typescript
// ✅ Good - Signed cookie
ctx.res.cookie('user_role', 'admin', {
  signed: true,
  secret: process.env.COOKIE_SECRET,
  httpOnly: true
});

// ❌ Bad - Unsigned sensitive data
ctx.res.cookie('user_role', 'admin');
```

### 2. Apply Security Flags

```typescript
// ✅ Good - Security flags applied
ctx.res.cookie('session', sessionId, {
  httpOnly: true,    // Prevent XSS
  secure: true,      // HTTPS only
  sameSite: 'strict' // CSRF protection
});

// ❌ Bad - No security flags
ctx.res.cookie('session', sessionId);
```

### 3. Set Appropriate Expiration

```typescript
// ✅ Good - Explicit expiration
ctx.res.cookie('remember_me', token, {
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  httpOnly: true
});

// ✅ Good - Session cookie
ctx.res.cookie('temp_data', data); // Expires on browser close
```

### 4. Validate Cookie Values

```typescript
import { validateCookieValue } from '@/utils/cookies';

app.post('/api/data', (ctx) => {
  const userInput = ctx.body.value;
  
  // Validate before setting cookie
  if (!validateCookieValue(userInput)) {
    ctx.res.status(400).json({ error: 'Invalid cookie value' });
    return;
  }
  
  ctx.res.cookie('user_data', userInput);
});
```

### 5. Use Environment Secrets

```typescript
// ✅ Good - Environment secret
const secret = process.env.COOKIE_SECRET;
if (!secret) {
  throw new Error('COOKIE_SECRET environment variable is required');
}

ctx.res.cookie('secure_data', data, { signed: true, secret });

// ❌ Bad - Hard-coded secret
ctx.res.cookie('secure_data', data, { 
  signed: true, 
  secret: 'hardcoded-secret' 
});
```

## Error Handling

The cookie system provides robust error handling:

```typescript
import { CookieError } from '@/utils/cookies';

try {
  // Invalid cookie operations throw CookieError
  const result = unsignCookie(malformedCookie, secret);
} catch (error) {
  if (error instanceof CookieError) {
    console.error('Cookie error:', error.message);
    // Handle cookie-specific error
  }
}
```

## Integration Examples

### Session Management

```typescript
import { signCookie, unsignCookie } from '@/utils/cookies';

class SessionManager {
  private secret: string;
  
  constructor(secret: string) {
    this.secret = secret;
  }
  
  createSession(ctx: Context, userData: any): void {
    const sessionData = JSON.stringify(userData);
    const signedSession = signCookie(sessionData, this.secret);
    
    ctx.res.cookie('session', signedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict'
    });
  }
  
  getSession(ctx: Context): any | null {
    const signedSession = ctx.req.cookies.session;
    if (!signedSession) return null;
    
    const sessionData = unsignCookie(signedSession, this.secret);
    if (sessionData === false) return null;
    
    try {
      return JSON.parse(sessionData);
    } catch {
      return null;
    }
  }
  
  destroySession(ctx: Context): void {
    ctx.res.clearCookie('session');
  }
}
```

### Shopping Cart

```typescript
class ShoppingCart {
  private secret: string;
  
  constructor(secret: string) {
    this.secret = secret;
  }
  
  getCart(ctx: Context): CartItem[] {
    const cartCookie = ctx.req.cookies.shopping_cart;
    if (!cartCookie) return [];
    
    const cartData = unsignCookie(cartCookie, this.secret);
    if (cartData === false) return [];
    
    try {
      return JSON.parse(cartData);
    } catch {
      return [];
    }
  }
  
  saveCart(ctx: Context, items: CartItem[]): void {
    const cartData = JSON.stringify(items);
    const signedCart = signCookie(cartData, this.secret);
    
    ctx.res.cookie('shopping_cart', signedCart, {
      signed: true,
      secret: this.secret,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true
    });
  }
}
```

### User Preferences

```typescript
class UserPreferences {
  static save(ctx: Context, preferences: UserPrefs): void {
    // Non-sensitive data can use regular cookies
    ctx.res.cookie('theme', preferences.theme, {
      maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
    });
    
    ctx.res.cookie('language', preferences.language, {
      maxAge: 365 * 24 * 60 * 60 * 1000
    });
    
    ctx.res.cookie('timezone', preferences.timezone, {
      maxAge: 365 * 24 * 60 * 60 * 1000
    });
  }
  
  static load(ctx: Context): UserPrefs {
    return {
      theme: ctx.req.cookies.theme || 'light',
      language: ctx.req.cookies.language || 'en',
      timezone: ctx.req.cookies.timezone || 'UTC'
    };
  }
}
```

## Migration from Express

### Express vs NextRush Cookie Handling

```typescript
// Express
app.use(cookieParser('secret'));

app.get('/data', (req, res) => {
  const value = req.cookies.data;
  const signedValue = req.signedCookies.secure;
  res.cookie('new', 'value', { httpOnly: true });
});

// NextRush v2
app.get('/data', (ctx) => {
  const value = ctx.req.cookies.data;
  const signedValue = unsignCookie(ctx.req.cookies.secure, secret);
  ctx.res.cookie('new', 'value', { httpOnly: true });
});
```

## Troubleshooting

### Common Issues

#### 1. Cookies Not Being Set

```typescript
// Check cookie size (4KB limit)
if (cookieValue.length > 4096) {
  console.warn('Cookie too large, may be rejected by browser');
}

// Verify HTTPS for secure cookies
if (options.secure && !ctx.req.secure) {
  console.warn('Secure cookie requires HTTPS');
}
```

#### 2. Signed Cookie Verification Fails

```typescript
// Ensure consistent secret
const secret = process.env.COOKIE_SECRET;
if (!secret || secret.length < 32) {
  throw new Error('Cookie secret must be at least 32 characters');
}

// Check for whitespace/encoding issues
const cleanSecret = secret.trim();
```

#### 3. SameSite Issues

```typescript
// For cross-origin requests
ctx.res.cookie('cross_site', value, {
  sameSite: 'none',
  secure: true // Required with sameSite: 'none'
});
```

## API Reference Summary

### Utility Functions

| Function | Description | Performance |
|----------|-------------|------------|
| `parseCookies()` | Parse cookie header | ~2M ops/sec |
| `serializeCookie()` | Serialize cookie with options | ~3M ops/sec |
| `signCookie()` | HMAC sign cookie value | ~1.2M ops/sec |
| `unsignCookie()` | Verify signed cookie | ~1.2M ops/sec |
| `validateCookieValue()` | Validate cookie value format | ~5M ops/sec |

### Classes

| Class | Description | Use Case |
|-------|-------------|----------|
| `CookieJar` | Cookie collection manager | Advanced cookie operations |
| `CookieError` | Cookie-specific errors | Error handling |

### Request Properties

| Property | Type | Description |
|----------|------|-------------|
| `ctx.req.cookies` | `CookieMap` | Parsed cookies (lazy) |

### Response Methods

| Method | Description | Example |
|--------|-------------|---------|
| `ctx.res.cookie()` | Set cookie | `ctx.res.cookie('name', 'value')` |
| `ctx.res.clearCookie()` | Clear cookie | `ctx.res.clearCookie('name')` |

This comprehensive cookie system provides enterprise-grade security, performance, and flexibility while maintaining a clean, intuitive API.
