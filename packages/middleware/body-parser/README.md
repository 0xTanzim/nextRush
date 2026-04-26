# @nextrush/body-parser

> Secure, cross-runtime HTTP request body parsing for NextRush.

Parse JSON, URL-encoded, text, and raw request bodies with built-in protection against prototype pollution, DoS attacks, and memory leaks.

## The Problem

Parsing request bodies is deceptively dangerous. Without proper safeguards:

- **Prototype pollution** lets attackers hijack `Object.prototype` through `__proto__` keys
- **Large payloads** exhaust server memory and cause crashes
- **Deeply nested objects** trigger stack overflows
- **Aborted requests** leak event listeners and memory
- **Invalid charsets** crash your parser

Most body parsers either ignore these threats or handle them inconsistently. NextRush's body-parser treats security as a first-class concern.

## Installation

```bash
pnpm add @nextrush/body-parser
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';
import { json, urlencoded, bodyParser } from '@nextrush/body-parser';

const app = createApp();

// Parse JSON bodies
app.use(json());

// Parse URL-encoded form data
app.use(urlencoded());

// Or use the combined parser (JSON + URL-encoded by default)
app.use(bodyParser());

app.post('/api/users', async (ctx) => {
  const { name, email } = ctx.body as { name: string; email: string };
  ctx.json({ received: { name, email } });
});

await serve(app, { port: 3000 });
```

## Mental Model

Think of body-parser as a **security checkpoint** for incoming data:

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────────┐
│           Body Parser Middleware        │
├─────────────────────────────────────────┤
│  1. Check method (skip GET/HEAD/etc.)   │
│  2. Validate Content-Type header        │
│  3. Check Content-Length against limit  │
│  4. Read body with size enforcement     │
│  5. Parse content (JSON/URL-encoded)    │
│  6. Security validation (no __proto__)  │
│  7. Populate ctx.body                   │
└─────────────────────────────────────────┘
     │
     ▼
  ctx.body = { ... }  ← Safe, validated data
```

The parser **rejects** requests that:

- Exceed size limits (even during streaming)
- Contain prototype pollution attempts (`__proto__`, `constructor`, `prototype`)
- Have invalid JSON syntax
- Use unsupported character encodings

## API Reference

### `json(options?)`

Parse `application/json` request bodies.

```typescript
import { json } from '@nextrush/body-parser';

app.use(
  json({
    limit: '1mb',
    strict: true,
    type: ['application/json'],
    rawBody: false,
    reviver: (key, val) => val,
    maxDepth: 32,
  })
);
```

**Options:**

| Option     | Type                 | Default                   | Description                                                                      |
| ---------- | -------------------- | ------------------------- | -------------------------------------------------------------------------------- |
| `limit`    | `string \| number`   | `'1mb'` (1,048,576 bytes) | Maximum body size. Accepts bytes or human-readable (`'100kb'`, `'5mb'`, `'1gb'`) |
| `strict`   | `boolean`            | `true`                    | Reject primitives (`"string"`, `123`, `true`). Only accept `{}` and `[]`         |
| `type`     | `string \| string[]` | `['application/json']`    | Content-Types to parse                                                           |
| `rawBody`  | `boolean`            | `false`                   | Store raw Buffer in `ctx.rawBody` (for signature verification)                   |
| `reviver`  | `JsonReviver`        | `undefined`               | Transform values during parsing (passed to `JSON.parse`)                         |
| `maxDepth` | `number`             | `undefined`               | Maximum JSON nesting depth. Rejects deeper payloads after parsing                |
| `verify`   | `VerifyCallback`     | `undefined`               | Callback invoked with raw buffer before parsing — throw to reject                |

**Behavior:**

- Skips bodyless methods (GET, HEAD, DELETE, OPTIONS)
- Skips if `ctx.body` is already set by prior middleware
- Empty bodies leave `ctx.body` as `undefined` (no implicit `{}`)

**Example with reviver:**

```typescript
// Parse ISO date strings as Date objects
app.use(
  json({
    reviver: (key, value) => {
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return new Date(value);
      }
      return value;
    },
  })
);
```

---

### `urlencoded(options?)`

Parse `application/x-www-form-urlencoded` request bodies.

```typescript
import { urlencoded } from '@nextrush/body-parser';

app.use(
  urlencoded({
    limit: '100kb',
    extended: true,
    parameterLimit: 1000,
    depth: 20,
    type: ['application/x-www-form-urlencoded'],
    rawBody: false,
  })
);
```

**Options:**

| Option           | Type                 | Default                                 | Description                                                       |
| ---------------- | -------------------- | --------------------------------------- | ----------------------------------------------------------------- |
| `limit`          | `string \| number`   | `'100kb'` (102,400 bytes)               | Maximum body size                                                 |
| `extended`       | `boolean`            | `true`                                  | Enable nested object parsing                                      |
| `parameterLimit` | `number`             | `1000`                                  | Maximum number of parameters (prevents DoS)                       |
| `depth`          | `number`             | `20`                                    | Maximum nesting depth (prevents stack overflow)                   |
| `type`           | `string \| string[]` | `['application/x-www-form-urlencoded']` | Content-Types to match                                            |
| `rawBody`        | `boolean`            | `false`                                 | Store raw Buffer in `ctx.rawBody`                                 |
| `verify`         | `VerifyCallback`     | `undefined`                             | Callback invoked with raw buffer before parsing — throw to reject |

**Extended parsing:**

When `extended: true`, nested objects and arrays are supported:

```typescript
// Form data: user[name]=Alice&user[email]=alice@example.com
// Result: { user: { name: 'Alice', email: 'alice@example.com' } }

// Form data: items[0]=apple&items[1]=banana&items[2]=cherry
// Result: { items: ['apple', 'banana', 'cherry'] }

// Form data: tags[]=js&tags[]=ts
// Result: { tags: ['js', 'ts'] }
```

**Security:**

The parser **blocks prototype pollution** attempts:

```typescript
// Malicious form data: __proto__[polluted]=true
// Result: BodyParserError with code 'INVALID_PARAMETER'

// Malicious form data: constructor[prototype][polluted]=true
// Result: BodyParserError with code 'INVALID_PARAMETER'
```

---

### `text(options?)`

Parse `text/plain` request bodies.

```typescript
import { text } from '@nextrush/body-parser';

app.use(
  text({
    limit: '100kb',
    defaultCharset: 'utf-8',
    type: ['text/plain'],
    rawBody: false,
  })
);
```

**Options:**

| Option           | Type                 | Default                   | Description                                                       |
| ---------------- | -------------------- | ------------------------- | ----------------------------------------------------------------- |
| `limit`          | `string \| number`   | `'100kb'` (102,400 bytes) | Maximum body size                                                 |
| `defaultCharset` | `SupportedCharset`   | `'utf-8'`                 | Charset when not in Content-Type                                  |
| `type`           | `string \| string[]` | `['text/plain']`          | Content-Types to match                                            |
| `rawBody`        | `boolean`            | `false`                   | Store raw Buffer in `ctx.rawBody`                                 |
| `verify`         | `VerifyCallback`     | `undefined`               | Callback invoked with raw buffer before parsing — throw to reject |

**Supported charsets:**

`utf-8`, `utf8`, `ascii`, `latin1`, `binary`, `base64`, `hex`, `utf16le`, `utf-16le`, `ucs2`, `ucs-2`

---

### `raw(options?)`

Parse request bodies as raw `Buffer`.

```typescript
import { raw } from '@nextrush/body-parser';

app.use(
  raw({
    limit: '100kb',
    type: ['application/octet-stream'],
  })
);
```

**Options:**

| Option   | Type                 | Default                        | Description                                                       |
| -------- | -------------------- | ------------------------------ | ----------------------------------------------------------------- |
| `limit`  | `string \| number`   | `'100kb'` (102,400 bytes)      | Maximum body size                                                 |
| `type`   | `string \| string[]` | `['application/octet-stream']` | Content-Types to match                                            |
| `verify` | `VerifyCallback`     | `undefined`                    | Callback invoked with raw buffer before parsing — throw to reject |

**Example:**

```typescript
app.use(raw({ type: ['image/*'], limit: '10mb' }));

app.post('/upload', async (ctx) => {
  const buffer = ctx.body as Buffer;
  console.log(`Received ${buffer.length} bytes`);
});
```

---

### `bodyParser(options?)`

Combined parser for multiple content types.

```typescript
import { bodyParser } from '@nextrush/body-parser';

app.use(
  bodyParser({
    json: { limit: '1mb', strict: true },
    urlencoded: { extended: true, depth: 5 },
    text: { limit: '5mb' }, // Enable text parsing
    raw: { limit: '10mb' }, // Enable raw parsing
  })
);
```

**Options:**

| Option       | Type                         | Default     | Description                                                    |
| ------------ | ---------------------------- | ----------- | -------------------------------------------------------------- |
| `json`       | `JsonOptions \| false`       | `{}`        | JSON parser options, or `false` to disable                     |
| `urlencoded` | `UrlEncodedOptions \| false` | `{}`        | URL-encoded options, or `false` to disable                     |
| `text`       | `TextOptions \| false`       | `undefined` | Text parser options — disabled by default, pass `{}` to enable |
| `raw`        | `RawOptions \| false`        | `undefined` | Raw parser options — disabled by default, pass `{}` to enable  |

**Behavior:**

- Routes to the appropriate parser based on Content-Type
- JSON and URL-encoded are enabled by default
- Text and raw are **disabled** by default — pass an options object (even `{}`) to enable them
- Multipart requests (`multipart/form-data`) throw `UNSUPPORTED_CONTENT_TYPE` with a hint to use a dedicated multipart parser

---

## Size Limits

Size limits accept numbers (bytes) or human-readable strings:

```typescript
// These are equivalent
app.use(json({ limit: 1048576 }));
app.use(json({ limit: '1mb' }));
app.use(json({ limit: '1024kb' }));
app.use(json({ limit: '1048576b' }));

// Common limits
app.use(json({ limit: '100kb' })); // 100 KB
app.use(json({ limit: '5mb' })); // 5 MB
app.use(json({ limit: '1gb' })); // 1 GB
```

**What happens when limit is exceeded:**

```typescript
// Request with 5MB body when limit is 1MB
// → BodyParserError: 'Request body too large'
// → status: 413
// → code: 'ENTITY_TOO_LARGE'
```

---

## Error Handling

The parser throws `BodyParserError` with detailed information:

```typescript
import { BodyParserError } from '@nextrush/body-parser';

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof BodyParserError) {
      ctx.status = error.status;
      ctx.json({
        error: error.message,
        code: error.code,
      });
      return;
    }
    throw error;
  }
});
```

**Error codes:**

| Code                       | Status | Description                                                           |
| -------------------------- | ------ | --------------------------------------------------------------------- |
| `ENTITY_TOO_LARGE`         | 413    | Body exceeds configured size limit                                    |
| `INVALID_JSON`             | 400    | JSON syntax error                                                     |
| `STRICT_MODE_VIOLATION`    | 400    | JSON is primitive in strict mode                                      |
| `JSON_DEPTH_EXCEEDED`      | 400    | JSON nesting exceeds `maxDepth`                                       |
| `INVALID_URLENCODED`       | 400    | Malformed URL-encoded data                                            |
| `TOO_MANY_PARAMETERS`      | 413    | URL-encoded parameter count exceeded                                  |
| `DEPTH_EXCEEDED`           | 400    | URL-encoded nesting too deep                                          |
| `INVALID_PARAMETER`        | 400    | Prototype pollution attempt (`__proto__`, `constructor`, `prototype`) |
| `UNSUPPORTED_CHARSET`      | 415    | Unknown charset in Content-Type                                       |
| `UNSUPPORTED_CONTENT_TYPE` | 415    | Content type not handled (e.g. `multipart/form-data`)                 |
| `BODY_READ_ERROR`          | 400    | Error reading request stream                                          |
| `REQUEST_CLOSED`           | 400    | Connection closed before body was received                            |
| `REQUEST_ABORTED`          | 400    | Client aborted the request                                            |

---

## Security Features

### Prototype Pollution Prevention

All URL-encoded keys are validated against a blocklist:

```typescript
// These are automatically blocked:
// __proto__[polluted]=true        → INVALID_PARAMETER
// constructor[prototype][evil]=true → INVALID_PARAMETER
// prototype[hack]=true            → INVALID_PARAMETER

app.use(urlencoded());

app.post('/submit', async (ctx) => {
  // ctx.body is safe — no prototype pollution possible
  const data = ctx.body;
});
```

### DoS Protection

Multiple layers of protection against denial-of-service:

```typescript
app.use(
  urlencoded({
    limit: '100kb', // Limit total body size
    parameterLimit: 100, // Limit number of parameters
    depth: 3, // Limit nesting depth
  })
);
```

### Memory Leak Prevention

Event listeners are properly cleaned up on request abort:

```typescript
// When a client disconnects mid-request:
// - All 'data', 'end', 'error', 'close', 'aborted' listeners are removed
// - No memory leak occurs
// - BodyParserError with code 'REQUEST_ABORTED' is thrown
```

### Charset Validation

Only safe, supported charsets are accepted:

```typescript
// Content-Type: application/json; charset=utf-8       → ✓ OK
// Content-Type: application/json; charset=ascii        → ✓ OK
// Content-Type: application/json; charset=fake-charset → ✗ UNSUPPORTED_CHARSET
```

Supported: `utf-8`, `utf8`, `ascii`, `latin1`, `binary`, `base64`, `hex`, `utf16le`, `utf-16le`, `ucs2`, `ucs-2`

---

## Raw Body Access

For signature verification (webhooks, etc.), access the raw body:

```typescript
import { json } from '@nextrush/body-parser';
import { createHmac } from 'node:crypto';

app.use(json({ rawBody: true }));

app.post('/webhook', async (ctx) => {
  const signature = ctx.headers['x-signature'] as string;
  const rawBody = ctx.rawBody as Buffer;

  const expected = createHmac('sha256', process.env.WEBHOOK_SECRET!).update(rawBody).digest('hex');

  if (signature !== expected) {
    ctx.status = 401;
    ctx.json({ error: 'Invalid signature' });
    return;
  }

  const payload = ctx.body;
  ctx.json({ ok: true });
});
```

---

## Custom Content Types

Parse custom JSON-like content types:

```typescript
app.use(
  json({
    type: [
      'application/json',
      'application/vnd.api+json', // JSON:API
      'application/ld+json', // JSON-LD
      'application/hal+json', // HAL
    ],
  })
);
```

---

## Common Patterns

### API Server

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';
import { json, BodyParserError } from '@nextrush/body-parser';

const app = createApp();

// Global error handler
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof BodyParserError) {
      ctx.status = error.status;
      ctx.json({ error: error.message, code: error.code });
      return;
    }
    throw error;
  }
});

// Parse JSON bodies
app.use(json({ limit: '1mb' }));

// Routes
app.post('/api/users', async (ctx) => {
  const { name, email } = ctx.body as { name: string; email: string };

  if (!name || !email) {
    ctx.status = 400;
    ctx.json({ error: 'name and email are required' });
    return;
  }

  ctx.status = 201;
  ctx.json({ id: Date.now(), name, email });
});

await serve(app, { port: 3000 });
```

### Form Handler

```typescript
import { urlencoded } from '@nextrush/body-parser';

app.use(urlencoded({ extended: true }));

app.post('/contact', async (ctx) => {
  const { name, email, message } = ctx.body as {
    name: string;
    email: string;
    message: string;
  };

  ctx.redirect('/thank-you');
});
```

### Multiple Parsers

```typescript
import { json, urlencoded, text, raw } from '@nextrush/body-parser';

// JSON for API routes
app.use(
  json({
    type: ['application/json'],
    limit: '10mb',
  })
);

// URL-encoded for forms
app.use(
  urlencoded({
    type: ['application/x-www-form-urlencoded'],
    extended: true,
  })
);

// Text for plain text uploads
app.use(
  text({
    type: ['text/plain', 'text/csv'],
    limit: '5mb',
  })
);

// Raw for binary uploads
app.use(
  raw({
    type: ['application/octet-stream', 'image/*'],
    limit: '50mb',
  })
);
```

---

## Performance

The body-parser is optimized for high-throughput scenarios:

- **StringDecoder optimization**: Large buffers (>1KB) use `StringDecoder` for faster UTF-8 handling
- **Single-chunk optimization**: Most requests arrive in one chunk, avoiding `Buffer.concat`
- **Pre-compiled patterns**: All regex patterns are compiled once at startup
- **Content-Length pre-check**: Oversized requests are rejected before reading any body data
- **Event cleanup**: No memory leaks from aborted requests

---

## TypeScript Types

All types are exported for full type safety:

```typescript
import type {
  // Parser options
  JsonOptions,
  UrlEncodedOptions,
  TextOptions,
  RawOptions,
  BodyParserOptions,

  // Error handling
  BodyParserErrorCode,

  // Context interface (for custom middleware)
  BodyParserContext,
  BodyParserMiddleware,

  // Callbacks
  VerifyCallback,
} from '@nextrush/body-parser';

import { BodyParserError } from '@nextrush/body-parser';
```

---

## When NOT to Use

This body-parser is **not designed for**:

- **Multipart/form-data**: For file uploads, use a dedicated multipart parser
- **Streaming large files**: For streaming, process the body stream directly
- **GraphQL**: Use a GraphQL-specific body parser
- **Protocol Buffers**: Write a custom parser or use a dedicated package

---

## Runtime Compatibility

This package works across all JavaScript runtimes via the `BodySource` abstraction:

| Runtime             | Supported |
| ------------------- | --------- |
| Node.js 22+         | ✅        |
| Bun                 | ✅        |
| Deno                | ✅        |
| Cloudflare Workers  | ✅        |
| Vercel Edge Runtime | ✅        |

---

## See Also

- [@nextrush/core](../core) - Core application framework
- [@nextrush/router](../router) - URL routing
- [@nextrush/adapter-node](../../adapters/node) - Node.js HTTP adapter

---

## License

MIT
