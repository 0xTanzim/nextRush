# @nextrush/cors

Cross-Origin Resource Sharing (CORS) middleware for NextRush. Secure your APIs with configurable origin validation, credentials support, and preflight handling.

## Installation

```bash
npm install @nextrush/cors
# or
pnpm add @nextrush/cors
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { cors } from '@nextrush/cors';

const app = createApp();

// Enable CORS with defaults
app.use(cors());

app.get('/api/data', (ctx) => {
  ctx.json({ message: 'Hello from API' });
});
```

## Features

- **Origin Validation**: String, array, regex, or function-based
- **Credentials Support**: Cookies and auth headers across origins
- **Preflight Caching**: Reduce OPTIONS requests with `maxAge`
- **Expose Headers**: Control which headers clients can read
- **Preset Helpers**: `simpleCors()` and `strictCors()` for common patterns

## Configuration

### Basic Options

```typescript
app.use(cors({
  // Allow specific origin(s)
  origin: 'https://example.com',
  // or multiple origins
  origin: ['https://app.example.com', 'https://admin.example.com'],
  // or regex pattern
  origin: /\.example\.com$/,
  // or dynamic validation
  origin: (origin, ctx) => origin.endsWith('.example.com'),

  // Allow credentials (cookies, auth headers)
  credentials: true,

  // Allowed methods
  methods: ['GET', 'POST', 'PUT', 'DELETE'],

  // Allowed request headers
  allowedHeaders: ['Content-Type', 'Authorization'],

  // Headers exposed to client
  exposedHeaders: ['X-Request-Id', 'X-Total-Count'],

  // Preflight cache duration (seconds)
  maxAge: 86400, // 24 hours

  // Handle OPTIONS automatically (default: true)
  preflightContinue: false,

  // Success status for OPTIONS (default: 204)
  optionsSuccessStatus: 204,
}));
```

### Allow All Origins

```typescript
// Allow any origin (use with caution)
app.use(cors({
  origin: '*',
}));

// Or use true for reflect mode (echoes request origin)
app.use(cors({
  origin: true,
  credentials: true, // Works with credentials
}));
```

## Presets

### Simple CORS

Permissive settings for development or public APIs:

```typescript
import { simpleCors } from '@nextrush/cors';

app.use(simpleCors());
// Equivalent to: origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE']
```

### Strict CORS

Locked-down settings for production:

```typescript
import { strictCors } from '@nextrush/cors';

app.use(strictCors({
  origin: ['https://app.example.com'],
  credentials: true,
}));
// Forces: credentials: true, strict origin validation
```

## Dynamic Origin Validation

Validate origins at runtime:

```typescript
app.use(cors({
  origin: async (origin, ctx) => {
    // Check against database/config
    const allowedOrigins = await getAllowedOrigins();
    return allowedOrigins.includes(origin);
  },
}));
```

## Credentials

When `credentials: true`:

```typescript
app.use(cors({
  origin: 'https://app.example.com', // Must be specific, not '*'
  credentials: true,
}));
```

Client-side:

```javascript
fetch('https://api.example.com/data', {
  credentials: 'include', // Send cookies
});
```

## Preflight Requests

OPTIONS requests are handled automatically:

```typescript
app.use(cors({
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Custom-Header'],
  maxAge: 86400, // Cache preflight for 24 hours
}));
```

Custom preflight handling:

```typescript
app.use(cors({
  preflightContinue: true, // Pass OPTIONS to next middleware
}));

app.options('/api/*', (ctx) => {
  // Custom OPTIONS handling
  ctx.status = 204;
});
```

## Headers Set

| Header | Description |
|--------|-------------|
| `Access-Control-Allow-Origin` | Allowed origin(s) |
| `Access-Control-Allow-Methods` | Allowed HTTP methods |
| `Access-Control-Allow-Headers` | Allowed request headers |
| `Access-Control-Allow-Credentials` | Credentials allowed |
| `Access-Control-Expose-Headers` | Headers client can read |
| `Access-Control-Max-Age` | Preflight cache time |
| `Vary` | `Origin` (for caching) |

## API Reference

### Exports

```typescript
import {
  cors,       // Main CORS middleware
  simpleCors, // Permissive preset
  strictCors, // Strict preset
} from '@nextrush/cors';
```

### Types

```typescript
type CorsOrigin =
  | string
  | string[]
  | RegExp
  | ((origin: string, ctx: Context) => boolean | Promise<boolean>);

interface CorsOptions {
  origin?: CorsOrigin | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}
```

## Common Patterns

### API with Frontend

```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  exposedHeaders: ['X-Request-Id'],
}));
```

### Public API

```typescript
app.use(cors({
  origin: '*',
  methods: ['GET'],
  maxAge: 86400,
}));
```

### Multi-Environment

```typescript
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://app.example.com']
    : true, // Allow all in dev
  credentials: true,
}));
```

## License

MIT
