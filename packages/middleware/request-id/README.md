# @nextrush/request-id

Request identification middleware for NextRush. Generate unique request IDs for tracing, logging, and debugging distributed systems.

## Installation

```bash
npm install @nextrush/request-id
# or
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

## Features

- **UUID Generation**: Unique IDs for every request
- **Correlation IDs**: Pass-through IDs from upstream services
- **Trace IDs**: Distributed tracing support
- **Header Customization**: Configure request/response headers
- **Zero Dependencies**: Uses Node.js crypto module

## Middleware Options

### requestId(options?)

Basic request identification:

```typescript
app.use(requestId({
  // Response header name (default: 'X-Request-Id')
  header: 'X-Request-Id',

  // Request header to trust (default: 'X-Request-Id')
  requestHeader: 'X-Request-Id',

  // Trust incoming header (default: true)
  trustHeader: true,

  // Custom ID generator
  generator: () => crypto.randomUUID(),

  // State key (default: 'requestId')
  stateKey: 'requestId',
}));
```

### correlationId(options?)

For service-to-service tracing:

```typescript
import { correlationId } from '@nextrush/request-id';

app.use(correlationId({
  // Header name (default: 'X-Correlation-Id')
  header: 'X-Correlation-Id',

  // Trust upstream header (default: true)
  trustHeader: true,

  // State key (default: 'correlationId')
  stateKey: 'correlationId',
}));
```

### traceId(options?)

For distributed tracing systems:

```typescript
import { traceId } from '@nextrush/request-id';

app.use(traceId({
  // Header name (default: 'X-Trace-Id')
  header: 'X-Trace-Id',

  // Trust upstream header (default: true)
  trustHeader: true,

  // State key (default: 'traceId')
  stateKey: 'traceId',
}));
```

## Context API

After applying middleware:

```typescript
// Access IDs
ctx.state.requestId      // Unique request ID
ctx.state.correlationId  // Correlation ID (if middleware added)
ctx.state.traceId        // Trace ID (if middleware added)
```

## Response Headers

By default, the request ID is sent in the response:

```
HTTP/1.1 200 OK
X-Request-Id: 550e8400-e29b-41d4-a716-446655440000
```

Disable response header:

```typescript
app.use(requestId({
  setResponseHeader: false,
}));
```

## Custom Generators

### Sequential IDs

```typescript
let counter = 0;
app.use(requestId({
  generator: () => `req-${++counter}`,
}));
```

### Prefixed IDs

```typescript
app.use(requestId({
  generator: () => `svc-api-${crypto.randomUUID()}`,
}));
```

### Short IDs

```typescript
import { randomBytes } from 'crypto';

app.use(requestId({
  generator: () => randomBytes(8).toString('hex'),
}));
```

## Integration with Logging

```typescript
import { requestId } from '@nextrush/request-id';
import { logger } from '@nextrush/logger';

app.use(requestId());
app.use(logger({
  // Include request ID in log output
  customProps: (ctx) => ({
    requestId: ctx.state.requestId,
  }),
}));
```

## Microservices Pattern

Pass IDs between services:

```typescript
// API Gateway
app.use(requestId());
app.use(correlationId());

app.get('/api/users/:id', async (ctx) => {
  // Forward IDs to downstream service
  const response = await fetch('http://user-service/users/' + ctx.params.id, {
    headers: {
      'X-Request-Id': ctx.state.requestId,
      'X-Correlation-Id': ctx.state.correlationId,
    },
  });
  ctx.json(await response.json());
});

// User Service
app.use(requestId({ trustHeader: true }));
app.use(correlationId({ trustHeader: true }));

app.get('/users/:id', (ctx) => {
  // Same IDs as gateway
  console.log(ctx.state.requestId, ctx.state.correlationId);
});
```

## OpenTelemetry Integration

```typescript
import { traceId } from '@nextrush/request-id';

app.use(traceId({
  header: 'traceparent',
  generator: () => {
    // OpenTelemetry trace ID format
    const traceId = crypto.randomBytes(16).toString('hex');
    const spanId = crypto.randomBytes(8).toString('hex');
    return `00-${traceId}-${spanId}-01`;
  },
}));
```

## API Reference

### Exports

```typescript
import {
  requestId,      // Request ID middleware
  correlationId,  // Correlation ID middleware
  traceId,        // Trace ID middleware
  generateId,     // Utility: generate UUID
} from '@nextrush/request-id';
```

### Types

```typescript
interface RequestIdOptions {
  header?: string;
  requestHeader?: string;
  trustHeader?: boolean;
  generator?: () => string;
  stateKey?: string;
  setResponseHeader?: boolean;
}

interface CorrelationIdOptions {
  header?: string;
  trustHeader?: boolean;
  stateKey?: string;
}

interface TraceIdOptions {
  header?: string;
  trustHeader?: boolean;
  stateKey?: string;
}
```

## Best Practices

1. **Always use request IDs** in production for debugging
2. **Trust headers** only from known upstream services
3. **Include IDs** in all log messages
4. **Forward IDs** to downstream services
5. **Use correlation IDs** for user-initiated request chains

## License

MIT
