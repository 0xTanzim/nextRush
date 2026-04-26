# @nextrush/body-parser Architecture

> Comprehensive architecture documentation for the NextRush body-parser middleware.

## Overview

The `@nextrush/body-parser` package provides HTTP request body parsing middleware for NextRush applications. It supports JSON, URL-encoded, plain text, and raw binary content types with security-first design and high-performance optimizations.

### Design Philosophy

1. **Security First**: Protect against common vulnerabilities (prototype pollution, DoS, injection)
2. **Zero Dependencies**: All functionality implemented internally for security and performance
3. **Modular Architecture**: Single-responsibility modules enable tree-shaking and testability
4. **Performance Optimized**: StringDecoder for large buffers, single-chunk optimization, pre-compiled patterns
5. **Type Safety**: Full TypeScript with explicit types, no `any`

---

## Module Structure

```
src/
├── index.ts              # Public API exports
├── types.ts              # TypeScript type definitions
├── constants.ts          # Configuration defaults and limits
├── errors.ts             # Error classes and factory functions
├── utils/
│   ├── index.ts          # Utils re-exports
│   ├── buffer.ts         # Buffer manipulation utilities
│   ├── content-type.ts   # Content-Type header parsing
│   ├── limit.ts          # Size limit parsing
│   └── url-decode.ts     # URL decoding with security guards
└── parsers/
    ├── index.ts          # Parser re-exports
    ├── reader.ts         # Core body reading with cleanup
    ├── json.ts           # JSON parser middleware
    ├── urlencoded.ts     # URL-encoded parser middleware
    ├── text.ts           # Text parser middleware
    ├── raw.ts            # Raw binary parser middleware
    └── combined.ts       # Combined body parser
```

### Module Responsibilities

| Module | Responsibility | LOC Target |
|--------|----------------|------------|
| `types.ts` | All TypeScript interfaces and type aliases | ~150 |
| `constants.ts` | Default values, limits, patterns | ~80 |
| `errors.ts` | Error class and factory functions | ~100 |
| `utils/buffer.ts` | Buffer-to-string conversion with StringDecoder | ~50 |
| `utils/content-type.ts` | Content-Type header parsing and matching | ~80 |
| `utils/limit.ts` | Size limit string parsing (e.g., '1mb') | ~40 |
| `utils/url-decode.ts` | URL decoding with prototype pollution guards | ~120 |
| `parsers/reader.ts` | Core body reading with event cleanup | ~80 |
| `parsers/json.ts` | JSON parsing middleware | ~80 |
| `parsers/urlencoded.ts` | URL-encoded parsing middleware | ~80 |
| `parsers/text.ts` | Text parsing middleware | ~70 |
| `parsers/raw.ts` | Raw buffer middleware | ~60 |
| `parsers/combined.ts` | Combined parser orchestration | ~100 |

---

## Data Flow

### Request Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                        HTTP Request                              │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    1. Method Check                               │
│         Skip bodyless methods (GET, HEAD, OPTIONS, etc.)         │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  2. Content-Type Routing                         │
│    Match Content-Type header against configured types            │
│    Route to appropriate parser (json/urlencoded/text/raw)        │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   3. Content-Length Check                        │
│         Reject if Content-Length exceeds limit (fast path)       │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     4. Body Reading                              │
│    • Stream data events into buffer chunks                       │
│    • Validate size during streaming (streaming check)            │
│    • Clean up event listeners (close/aborted/error)              │
│    • Single-chunk optimization (avoid Buffer.concat)             │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      5. Parsing                                  │
│    • Buffer → String (StringDecoder for large buffers)           │
│    • Parse based on content type                                 │
│    • Apply security validations                                  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   6. Context Population                          │
│    • Set ctx.body with parsed data                               │
│    • Set ctx.rawBody if requested                                │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     7. Next Middleware                           │
└─────────────────────────────────────────────────────────────────┘
```

### Body Reading Detail (reader.ts)

```
┌──────────────────────────────────────────────────────────────────┐
│                     readBody(ctx, limit)                          │
└──────────────────────────────────────────────────────────────────┘
                               │
        ┌──────────────────────┴──────────────────────┐
        │                                              │
        ▼                                              ▼
┌─────────────────┐                          ┌─────────────────┐
│ Content-Length  │                          │   No Content    │
│    Present      │                          │     Length      │
└─────────────────┘                          └─────────────────┘
        │                                              │
        ▼                                              │
┌─────────────────┐                                    │
│ Pre-validate    │                                    │
│ against limit   │                                    │
│ (sync reject)   │                                    │
└─────────────────┘                                    │
        │                                              │
        └────────────────────┬─────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Register Event Handlers                        │
│  • 'data'    → accumulate chunks, check running size             │
│  • 'end'     → resolve with buffer                               │
│  • 'error'   → reject with error                                 │
│  • 'close'   → cleanup on premature close                        │
│  • 'aborted' → cleanup on client abort                           │
└──────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                   cleanup() on completion                         │
│  Remove ALL event listeners to prevent memory leaks              │
└──────────────────────────────────────────────────────────────────┘
```

---

## Security Model

### Threat Matrix

| Threat | Mitigation | Implementation |
|--------|------------|----------------|
| **Prototype Pollution** | Block `__proto__`, `constructor`, `prototype` keys | `url-decode.ts` → `FORBIDDEN_KEYS` |
| **DoS via Large Body** | Size limits with streaming validation | `reader.ts` → limit check |
| **DoS via Deep Nesting** | Depth limit for nested objects | `url-decode.ts` → `depth` param |
| **DoS via Many Parameters** | Parameter count limit | `urlencoded.ts` → `parameterLimit` |
| **Memory Exhaustion** | Event listener cleanup on abort | `reader.ts` → `cleanup()` |
| **Injection via Charset** | Whitelist supported charsets | `content-type.ts` → `normalizeCharset()` |
| **ReDoS** | Pre-compiled regex patterns | `constants.ts` → `PATTERNS` |

### Security Implementation Details

#### Prototype Pollution Prevention

```typescript
// url-decode.ts
const FORBIDDEN_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

function setNestedValue(obj, key, value, depth, maxDepth) {
  // Check each path segment
  for (const part of parts) {
    if (FORBIDDEN_KEYS.has(part)) {
      throw Errors.prototypePollution(part);
    }
  }
  // ...
}
```

#### Memory Leak Prevention

```typescript
// reader.ts
function readBody(ctx, limit) {
  return new Promise((resolve, reject) => {
    // Track all listeners for cleanup
    const cleanup = () => {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      req.removeListener('close', onClose);
      req.removeListener('aborted', onAborted);
    };

    const onClose = () => {
      if (!finished) {
        cleanup();
        reject(Errors.connectionClosed());
      }
    };

    const onAborted = () => {
      if (!finished) {
        cleanup();
        reject(Errors.requestAborted());
      }
    };

    // ... register handlers
    // cleanup() called on resolve/reject
  });
}
```

#### Charset Validation

```typescript
// content-type.ts
const SUPPORTED_CHARSETS = new Set([
  'utf-8', 'utf8',
  'ascii',
  'latin1', 'iso-8859-1',
  'utf16le', 'ucs2',
  'base64', 'base64url',
  'hex',
]);

function normalizeCharset(charset) {
  const normalized = charset.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!SUPPORTED_CHARSETS.has(normalized)) {
    throw Errors.unsupportedCharset(charset);
  }
  return mapToBufferEncoding(normalized);
}
```

---

## Performance Optimizations

### 1. StringDecoder for Large Buffers

```typescript
// buffer.ts
function bufferToString(buffer, encoding = 'utf8') {
  // Fast path for small buffers (< 1KB)
  if (buffer.length < SMALL_BUFFER_THRESHOLD) {
    return buffer.toString(encoding);
  }

  // StringDecoder handles multi-byte chars at chunk boundaries
  const decoder = new StringDecoder(encoding);
  return decoder.write(buffer) + decoder.end();
}
```

**Why**: `StringDecoder` properly handles multi-byte UTF-8 characters that may span chunk boundaries, and for large buffers (>1KB), it provides measurably better performance.

### 2. Single-Chunk Optimization

```typescript
// reader.ts
const onEnd = () => {
  if (chunks.length === 0) {
    resolve(Buffer.alloc(0));
  } else if (chunks.length === 1) {
    // Most requests fit in single chunk - avoid concat overhead
    resolve(chunks[0]);
  } else {
    resolve(Buffer.concat(chunks, received));
  }
};
```

**Why**: Most HTTP request bodies are small enough to arrive in a single TCP packet. Avoiding `Buffer.concat` saves allocation and copy operations.

### 3. Pre-Compiled Regex Patterns

```typescript
// constants.ts
const PATTERNS = {
  JSON_CONTENT_TYPE: /^application\/(?:json|[^;]*\+json)(?:;|$)/i,
  LIMIT_STRING: /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i,
  CHARSET_EXTRACT: /charset=["']?([^"';\s]+)/i,
} as const;
```

**Why**: Regex compilation is expensive. Pre-compiled patterns avoid repeated compilation in hot paths.

### 4. Content-Length Pre-Validation

```typescript
// reader.ts
function readBody(ctx, limit) {
  const contentLength = getContentLength(ctx.headers);

  // Synchronous rejection before starting stream read
  if (contentLength !== undefined && contentLength > limit) {
    return Promise.reject(Errors.entityTooLarge(contentLength, limit));
  }

  // ... continue with streaming
}
```

**Why**: Reject oversized requests immediately without consuming any body data, saving CPU and memory.

---

## Extension Points

### Custom Content Types

```typescript
// Register custom JSON-like content types
app.use(json({
  type: [
    'application/json',
    'application/vnd.api+json',
    'application/ld+json',
  ],
}));
```

### Custom Reviver

```typescript
// Transform dates during JSON parsing
app.use(json({
  reviver: (key, value) => {
    if (typeof value === 'string' && ISO_DATE_REGEX.test(value)) {
      return new Date(value);
    }
    return value;
  },
}));
```

### Raw Body Access

```typescript
// Capture raw body for signature verification
app.use(json({
  rawBody: true,
}));

app.post('/webhook', async (ctx) => {
  const signature = ctx.headers['x-signature'];
  const isValid = verifySignature(ctx.rawBody, signature);
});
```

### Per-Parser Configuration

```typescript
// Configure each parser independently
app.use(bodyParser({
  json: { limit: '10mb', strict: true },
  urlencoded: { extended: true, depth: 5 },
  text: { limit: '5mb', type: ['text/plain', 'text/html'] },
  raw: false, // Disable raw parsing
}));
```

---

## Error Handling

### Error Hierarchy

```typescript
class BodyParserError extends Error {
  readonly status: number;   // HTTP status code
  readonly code: string;     // Machine-readable error code
  readonly expose: boolean;  // Safe to expose to client
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `ENTITY_TOO_LARGE` | 413 | Body exceeds size limit |
| `INVALID_JSON` | 400 | Malformed JSON syntax |
| `STRICT_MODE_VIOLATION` | 400 | JSON is not object/array in strict mode |
| `INVALID_URLENCODED` | 400 | Malformed URL-encoded data |
| `TOO_MANY_PARAMETERS` | 413 | Parameter count exceeds limit |
| `DEPTH_EXCEEDED` | 400 | Nested object depth exceeds limit |
| `PROTOTYPE_POLLUTION` | 400 | Forbidden key detected |
| `UNSUPPORTED_CHARSET` | 415 | Unknown charset in Content-Type |
| `BODY_READ_ERROR` | 400 | Error reading request stream |
| `REQUEST_ABORTED` | 400 | Client aborted request |
| `CONNECTION_CLOSED` | 400 | Connection closed prematurely |

### Error Factory Functions

```typescript
// errors.ts
const Errors = {
  entityTooLarge: (received, limit) => new BodyParserError(
    `Request body too large (${received} bytes exceeds ${limit} byte limit)`,
    413,
    'ENTITY_TOO_LARGE'
  ),

  invalidJson: (reason) => new BodyParserError(
    `Invalid JSON: ${reason}`,
    400,
    'INVALID_JSON'
  ),

  // ... other factory functions
};
```

---

## Testing Strategy

### Unit Tests

Each module has isolated unit tests:

```
src/__tests__/
├── types.test.ts           # Type guards
├── constants.test.ts       # Constant values
├── errors.test.ts          # Error class behavior
├── utils/
│   ├── buffer.test.ts      # Buffer utilities
│   ├── content-type.test.ts
│   ├── limit.test.ts
│   └── url-decode.test.ts  # Security tests
└── parsers/
    ├── reader.test.ts      # Stream reading
    ├── json.test.ts        # JSON parsing
    ├── urlencoded.test.ts  # URL-encoded parsing
    ├── text.test.ts        # Text parsing
    ├── raw.test.ts         # Raw parsing
    └── combined.test.ts    # Combined parser
```

### Security Test Cases

```typescript
describe('Prototype Pollution Prevention', () => {
  it('rejects __proto__ key', async () => {
    const ctx = createMockContext('__proto__[polluted]=true');
    await expect(urlencoded()(ctx)).rejects.toThrow('PROTOTYPE_POLLUTION');
  });

  it('rejects constructor key', async () => {
    const ctx = createMockContext('constructor[prototype][polluted]=true');
    await expect(urlencoded()(ctx)).rejects.toThrow('PROTOTYPE_POLLUTION');
  });

  it('rejects deeply nested pollution attempts', async () => {
    const ctx = createMockContext('a[b][__proto__][c]=true');
    await expect(urlencoded()(ctx)).rejects.toThrow('PROTOTYPE_POLLUTION');
  });
});
```

### Performance Benchmarks

```typescript
describe('Performance', () => {
  it('handles 10MB JSON in < 100ms', async () => {
    const largeJson = JSON.stringify({ data: 'x'.repeat(10 * 1024 * 1024) });
    const start = performance.now();
    await json({ limit: '20mb' })(createMockContext(largeJson));
    expect(performance.now() - start).toBeLessThan(100);
  });

  it('single-chunk optimization active for small bodies', async () => {
    // Verify no Buffer.concat for bodies < 64KB
  });
});
```

---

## Integration with NextRush

### Context Interface

The body parser expects a minimal context interface:

```typescript
interface BodyParserContext {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  raw: {
    req: NodeJS.ReadableStream & {
      on(event: 'data' | 'end' | 'error' | 'close' | 'aborted', listener: Function): void;
      removeListener(event: string, listener: Function): void;
    };
  };
  body?: unknown;
  rawBody?: Buffer;
}
```

### Adapter Compatibility

Works with all NextRush adapters:

- **@nextrush/adapter-node**: Native Node.js HTTP
- **@nextrush/adapter-bun**: Bun HTTP server
- **@nextrush/adapter-deno**: Deno HTTP server (planned)

---

## Version History

| Version | Changes |
|---------|---------|
| 3.0.0 | Modular architecture, security hardening, performance optimizations |
| 2.x | Monolithic implementation (legacy) |

---

## References

- [OWASP Prototype Pollution](https://cheatsheetseries.owasp.org/cheatsheets/Prototype_Pollution_Prevention_Cheat_Sheet.html)
- [Node.js StringDecoder](https://nodejs.org/api/string_decoder.html)
- [HTTP 413 Payload Too Large](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/413)
- [Content-Type Header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type)
