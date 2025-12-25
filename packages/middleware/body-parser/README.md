# @nextrush/body-parser

Request body parsing middleware for NextRush. Parse JSON, URL-encoded, text, and raw request bodies with built-in security limits.

## Installation

```bash
npm install @nextrush/body-parser
# or
pnpm add @nextrush/body-parser
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { json, urlencoded, bodyParser } from '@nextrush/body-parser';

const app = createApp();

// Parse JSON bodies
app.use(json());

// Parse URL-encoded bodies
app.use(urlencoded());

// Or use combined parser
app.use(bodyParser());

app.post('/api/users', async (ctx) => {
  console.log(ctx.body); // Parsed body
  ctx.json({ received: ctx.body });
});
```

## Parsers

### `json(options?)`

Parse `application/json` request bodies.

```typescript
app.use(json({
  limit: '1mb',           // Max body size (default: '1mb')
  strict: true,           // Only parse objects/arrays (default: true)
  type: ['application/json'], // Content types to parse
  rawBody: false,         // Store raw buffer in ctx.rawBody
  reviver: (key, val) => val, // JSON.parse reviver
}));
```

### `urlencoded(options?)`

Parse `application/x-www-form-urlencoded` request bodies.

```typescript
app.use(urlencoded({
  limit: '100kb',         // Max body size (default: '100kb')
  extended: true,         // Support nested objects (default: true)
  parameterLimit: 1000,   // Max number of params (default: 1000)
  type: ['application/x-www-form-urlencoded'],
  rawBody: false,
}));
```

### `text(options?)`

Parse `text/plain` request bodies.

```typescript
app.use(text({
  limit: '100kb',         // Max body size
  defaultCharset: 'utf-8', // Default charset
  type: ['text/plain'],
  rawBody: false,
}));
```

### `raw(options?)`

Parse bodies as raw `Buffer`.

```typescript
app.use(raw({
  limit: '100kb',
  type: ['application/octet-stream'],
}));
```

### `bodyParser(options?)`

Combined parser for JSON and URL-encoded bodies.

```typescript
app.use(bodyParser({
  json: { limit: '1mb' },       // JSON options or false to disable
  urlencoded: { extended: true }, // URL-encoded options or false
}));
```

## Size Limits

Size limits can be specified as:

- **Number**: Bytes (e.g., `1048576`)
- **String**: Human-readable (e.g., `'1mb'`, `'100kb'`, `'1gb'`)

```typescript
app.use(json({ limit: '5mb' }));
app.use(json({ limit: 5 * 1024 * 1024 })); // Same as above
```

## Error Handling

The parser throws `BodyParserError` with helpful properties:

```typescript
import { BodyParserError } from '@nextrush/body-parser';

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    if (err instanceof BodyParserError) {
      ctx.status = err.status; // 400 or 413
      ctx.json({
        error: err.message,
        code: err.code, // 'INVALID_JSON', 'ENTITY_TOO_LARGE', etc.
      });
    }
  }
});
```

**Error Codes:**

| Code | Status | Description |
|------|--------|-------------|
| `ENTITY_TOO_LARGE` | 413 | Body exceeds size limit |
| `INVALID_JSON` | 400 | Malformed JSON |
| `STRICT_MODE_VIOLATION` | 400 | Non-object/array in strict mode |
| `TOO_MANY_PARAMETERS` | 413 | URL-encoded param limit exceeded |
| `BODY_READ_ERROR` | 400 | Stream read error |

## Extended URL-Encoded Parsing

When `extended: true`, nested objects are supported:

```typescript
// Request: user[name]=John&user[email]=john@example.com
// Result: { user: { name: 'John', email: 'john@example.com' } }

// Arrays: items[0]=a&items[1]=b
// Result: { items: ['a', 'b'] }
```

## API Reference

### Types

```typescript
interface JsonOptions {
  limit?: number | string;
  reviver?: (key: string, value: unknown) => unknown;
  type?: string | string[];
  rawBody?: boolean;
  strict?: boolean;
}

interface UrlEncodedOptions {
  limit?: number | string;
  type?: string | string[];
  rawBody?: boolean;
  extended?: boolean;
  parameterLimit?: number;
}

interface TextOptions {
  limit?: number | string;
  type?: string | string[];
  rawBody?: boolean;
  defaultCharset?: string;
}

interface RawOptions {
  limit?: number | string;
  type?: string | string[];
}
```

## License

MIT
