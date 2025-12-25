# @nextrush/compression

High-performance response compression middleware for NextRush. Supports Gzip, Brotli, and Deflate with automatic content negotiation.

## Installation

```bash
npm install @nextrush/compression
# or
pnpm add @nextrush/compression
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { compression } from '@nextrush/compression';

const app = createApp();

// Enable compression with defaults
app.use(compression());

app.get('/api/data', (ctx) => {
  ctx.json({ data: 'Large response...' });
});
```

## Features

- **Automatic Negotiation**: Selects best encoding from `Accept-Encoding` header
- **Multiple Algorithms**: Gzip, Brotli, and Deflate support
- **Smart Filtering**: Only compresses compressible content types
- **Threshold Control**: Skip small responses to avoid overhead
- **Zero Dependencies**: Uses Node.js built-in `zlib` module

## Options

```typescript
app.use(compression({
  // Algorithms (all enabled by default)
  gzip: true,
  deflate: true,
  brotli: true,

  // Compression level (0-9, default: 6)
  level: 6,

  // Min bytes to compress (default: 1024)
  threshold: 1024,

  // Memory level for zlib (default: 8)
  memLevel: 8,

  // Content types to compress
  contentTypes: [
    'text/*',
    'application/json',
    'application/javascript',
    'application/xml',
    // ... more defaults
  ],

  // Content types to exclude
  exclude: [
    'image/*',
    'video/*',
    'audio/*',
  ],

  // Custom filter function
  filter: (ctx) => !ctx.path.startsWith('/stream'),
}));
```

## Algorithm-Specific Middleware

Use single-algorithm middleware when needed:

```typescript
import { gzip, deflate, brotli } from '@nextrush/compression';

// Gzip only
app.use(gzip({ level: 9 }));

// Deflate only
app.use(deflate({ level: 6 }));

// Brotli only (best compression ratio)
app.use(brotli({ level: 4 }));
```

## Compression Levels

| Level | Speed | Ratio | Use Case |
|-------|-------|-------|----------|
| 1-3 | Fast | Low | Real-time streaming |
| 4-6 | Balanced | Medium | General purpose (default) |
| 7-9 | Slow | High | Static assets, API responses |

**Brotli-specific:** Level 4 is recommended for dynamic content; levels 10-11 are very slow but excellent for static assets.

## When Compression is Skipped

Compression is automatically skipped when:

- Response is already compressed (`Content-Encoding` set)
- Response body is smaller than `threshold`
- Content type is not compressible (images, video, etc.)
- `HEAD` request
- Status is `204` or `304`
- Custom `filter` function returns `false`

## Headers

The middleware automatically sets:

- `Content-Encoding`: Selected algorithm
- `Vary: Accept-Encoding`: For proper caching

## Performance Tips

1. **Use Brotli for static assets**: Pre-compress with level 11
2. **Lower levels for APIs**: Use level 4-6 for dynamic responses
3. **Increase threshold**: Set higher for high-traffic endpoints
4. **Filter streaming**: Disable for SSE/WebSocket upgrades

```typescript
app.use(compression({
  level: 4,
  threshold: 2048,
  filter: (ctx) => {
    // Skip streaming endpoints
    if (ctx.path.startsWith('/events')) return false;
    // Skip already-compressed responses
    if (ctx.path.match(/\.(gz|br|zip)$/)) return false;
    return true;
  },
}));
```

## API Reference

### Types

```typescript
interface CompressionOptions {
  gzip?: boolean;
  deflate?: boolean;
  brotli?: boolean;
  level?: number;
  threshold?: number;
  memLevel?: number;
  contentTypes?: string[];
  exclude?: string[];
  filter?: (ctx: Context) => boolean;
}
```

### Exports

```typescript
import {
  compression,      // Main middleware
  gzip,            // Gzip-only middleware
  deflate,         // Deflate-only middleware
  brotli,          // Brotli-only middleware
  compressData,    // Utility: compress buffer
  shouldCompress,  // Utility: check content type
  negotiateEncoding, // Utility: select encoding
} from '@nextrush/compression';
```

## License

MIT
