# @nextrush/request-id

> Unique request identification with ID spoofing protection and distributed tracing support.

## The Problem

Debugging distributed systems without request IDs is like finding a needle in a haystack:

**Correlating logs across services is impossible.** When a request fails, you need to search through multiple service logs with no way to connect them.

**ID spoofing creates audit trail gaps.** If clients can inject arbitrary request IDs, attackers can pollute your logs or exploit ID-based systems.

**Log injection attacks via headers.** Malicious request IDs containing newlines or special characters can exploit logging systems.

## What NextRush Does Differently

- **Cryptographically secure ID generation** using `crypto.randomUUID()`
- **ID validation** to prevent spoofing and injection attacks
- **Configurable trust levels** for upstream proxy headers
- **Multiple header support** for compatibility (X-Request-ID, X-Correlation-ID, X-Trace-ID)
- **Log injection protection** through sanitization

## Installation

```bash
pnpm add @nextrush/request-id
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { requestId } from '@nextrush/request-id';

const app = createApp();

// Add request ID to all requests
app.use(requestId());

app.get('/api/data', (ctx) => {
  console.log('Request ID:', ctx.state.requestId);
  ctx.json({ data: 'Hello' });
});
```

**Response Header:**

```
X-Request-Id: 550e8400-e29b-41d4-a716-446655440000
```

## Middleware Functions

### requestId(options?)

Basic request identification with UUID generation:

```typescript
import { requestId } from '@nextrush/request-id';

// Basic usage - generates UUID v4
app.use(requestId());

// Trust incoming IDs (validated)
app.use(requestId({ trustIncoming: true }));

// Custom generator
app.use(requestId({
  generator: () => `req-${Date.now()}-${Math.random().toString(36).slice(2)}`
}));
```

### correlationId(options?)

For service-to-service request correlation:

```typescript
import { correlationId } from '@nextrush/request-id';

app.use(correlationId());
// Header: X-Correlation-Id
// State: ctx.state.correlationId
```

### traceId(options?)

For distributed tracing systems:

```typescript
import { traceId } from '@nextrush/request-id';

app.use(traceId());
// Header: X-Trace-Id
// State: ctx.state.traceId
```

## Options Reference

### RequestIdOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `header` | `string` | `'X-Request-Id'` | Header name for request ID |
| `generator` | `() => string` | `crypto.randomUUID` | Custom ID generator |
| `trustIncoming` | `boolean` | `true` | Trust valid incoming IDs |
| `validator` | `(id: string) => boolean` | `isValidUuid` | Custom ID validator |
| `maxLength` | `number` | `128` | Maximum ID length allowed |
| `stateKey` | `string` | `'requestId'` | Key in `ctx.state` |
| `exposeHeader` | `boolean` | `true` | Set response header |

## Security Features

### Incoming ID Validation

When `trustIncoming: true`, incoming IDs are validated before use:

```typescript
// Default: Only accept UUID v4 format
app.use(requestId());
// ✅ Accepts: 550e8400-e29b-41d4-a716-446655440000
// ❌ Rejects: arbitrary-string-123

// Permissive: Accept any safe alphanumeric ID
import { permissiveValidator } from '@nextrush/request-id';
app.use(requestId({ validator: permissiveValidator }));
// ✅ Accepts: my-custom-id-123
// ❌ Rejects: id-with:colons or id\r\ninjection
```

### Protection Against

- **CRLF Injection**: IDs with `\r\n` are rejected
- **Null Byte Injection**: IDs with `\x00` are rejected
- **Header Overflow**: IDs exceeding `maxLength` (default: 128) are rejected
- **Format Attacks**: Only alphanumeric, hyphen, underscore allowed

### Validation Functions

```typescript
import {
  isValidUuid,        // UUID v4 format check
  isSafeId,           // Safe characters only
  isValidLength,      // Length within bounds
  validateId,         // Combined validation
  createValidator,    // Create custom validator
  defaultValidator,   // UUID validator (default)
  permissiveValidator // Safe alphanumeric validator
} from '@nextrush/request-id';

// Custom validator example
const myValidator = (id: string) =>
  id.startsWith('myapp-') && isSafeId(id);

app.use(requestId({ validator: myValidator }));
```

## Microservices Pattern

Pass IDs between services with validation:

```typescript
// API Gateway
app.use(requestId());
app.use(correlationId());

app.get('/api/users/:id', async (ctx) => {
  const response = await fetch('http://user-service/users/' + ctx.params.id, {
    headers: {
      'X-Request-Id': ctx.state.requestId as string,
      'X-Correlation-Id': ctx.state.correlationId as string,
    },
  });
  ctx.json(await response.json());
});

// User Service - trusts gateway IDs
app.use(requestId({ trustIncoming: true }));
app.use(correlationId({ trustIncoming: true }));

app.get('/users/:id', (ctx) => {
  // Same IDs as gateway (if valid)
  console.log('Request:', ctx.state.requestId);
  console.log('Correlation:', ctx.state.correlationId);
});
```

## Integration with Logging

```typescript
import { requestId } from '@nextrush/request-id';
import { logger } from '@nextrush/logger';

app.use(requestId());
app.use(logger({
  customProps: (ctx) => ({
    requestId: ctx.state.requestId,
  }),
}));
```

## Custom Generators

### Prefixed IDs

```typescript
app.use(requestId({
  generator: () => `api-${crypto.randomUUID()}`,
}));
// api-550e8400-e29b-41d4-a716-446655440000
```

### Short IDs

```typescript
app.use(requestId({
  generator: () => crypto.randomUUID().split('-')[0],
}));
// 550e8400
```

### Timestamped IDs

```typescript
app.use(requestId({
  generator: () => `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
}));
// 1699999999999-550e8400
```

## Constants & Utilities

```typescript
import {
  // Constants
  DEFAULT_HEADER,         // 'X-Request-Id'
  CORRELATION_HEADER,     // 'X-Correlation-Id'
  TRACE_HEADER,           // 'X-Trace-Id'
  DEFAULT_STATE_KEY,      // 'requestId'
  CORRELATION_STATE_KEY,  // 'correlationId'
  TRACE_STATE_KEY,        // 'traceId'
  DEFAULT_MAX_LENGTH,     // 128

  // Generator
  defaultGenerator,       // crypto.randomUUID()
} from '@nextrush/request-id';
```

## TypeScript Types

```typescript
import type {
  RequestIdOptions,
  CorrelationIdOptions,
  TraceIdOptions,
  IdGenerator,
  IdValidator,
  RequestIdContext,
  Middleware,
} from '@nextrush/request-id';
```

## Multi-Runtime Support

Uses only universal APIs compatible with all JavaScript runtimes:

- **Node.js** ≥20
- **Bun** ≥1.0
- **Deno** ≥1.0
- **Cloudflare Workers**
- **Vercel Edge**

## Performance

- Overhead: < 0.01ms per request
- Memory: Minimal allocations
- Build size: ~2.49 KB ESM, ~8.27 KB types

## API Reference

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `requestId` | Function | Request ID middleware |
| `correlationId` | Function | Correlation ID middleware |
| `traceId` | Function | Trace ID middleware |
| `isValidUuid` | Function | UUID v4 validator |
| `isSafeId` | Function | Safe character validator |
| `isValidLength` | Function | Length validator |
| `validateId` | Function | Combined validator |
| `createValidator` | Function | Create custom validator |
| `defaultValidator` | Constant | UUID validator |
| `permissiveValidator` | Constant | Alphanumeric validator |
| `defaultGenerator` | Function | UUID generator |
| `DEFAULT_HEADER` | Constant | `'X-Request-Id'` |
| `CORRELATION_HEADER` | Constant | `'X-Correlation-Id'` |
| `TRACE_HEADER` | Constant | `'X-Trace-Id'` |
| `DEFAULT_MAX_LENGTH` | Constant | `128` |

## Best Practices

1. **Always use request IDs** in production for debugging
2. **Use UUID format** by default for maximum uniqueness
3. **Validate incoming IDs** to prevent injection attacks
4. **Include IDs** in all log messages
5. **Forward IDs** to downstream services
6. **Use correlation IDs** for user-initiated request chains

## License

MIT
