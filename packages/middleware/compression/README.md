# @nextrush/compression

> High-performance, multi-runtime response compression middleware with automatic content negotiation and BREACH attack mitigation.

## The Problem

Response compression is critical for web performance, but frameworks often make it either too magical or too complex:

**Magic without control.** Some frameworks compress everything without exposing what's happening. When compression causes issues (BREACH attacks, streaming problems), debugging becomes difficult.

**Node.js-only implementations.** Traditional libraries depend on Node.js `zlib`, breaking deployments to Deno, Cloudflare Workers, or other edge runtimes.

**Security is ignored.** BREACH attacks exploit compression ratios to leak secrets. Most compression middleware offers no protection against this well-known vulnerability.

## What NextRush Does Differently

- **Web Compression Streams API** — Uses standard browser APIs that work across all runtimes
- **RFC-compliant content negotiation** — Parses `Accept-Encoding` with quality values
- **Smart content detection** — Only compresses content types that benefit (text, JSON, SVG)
- **BREACH attack mitigation** — Optional random padding prevents compression ratio analysis attacks
- **Transparent behavior** — Compression stats available via `getCompressionInfo()` for debugging

## Installation

```bash
pnpm add @nextrush/compression
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { compression } from '@nextrush/compression';

const app = createApp();

// Enable compression with sensible defaults
app.use(compression());

app.get('/api/data', (ctx) => {
  // Large responses are automatically compressed
  ctx.json({ data: 'Large response...'.repeat(1000) });
});
```

## Configuration

```typescript
import { compression } from '@nextrush/compression';

app.use(
  compression({
    // Encoding toggles (all enabled by default)
    gzip: true,
    deflate: true,
    brotli: true, // Automatically disabled in runtimes without Brotli support

    // Compression level (0-9 for gzip/deflate, 0-11 for brotli)
    level: 6, // Default: balanced speed/ratio

    // Minimum bytes to compress (default: 1024)
    threshold: 1024,

    // Content types to compress (supports wildcards)
    contentTypes: [
      'text/*',
      'application/json',
      'application/javascript',
      'application/xml',
      'image/svg+xml',
    ],

    // Content types to exclude
    exclude: ['image/png', 'image/jpeg', 'video/*', 'audio/*', 'application/zip'],

    // Custom filter function
    filter: (ctx) => !ctx.path.startsWith('/stream'),

    // Enable BREACH attack mitigation (for responses with secrets)
    breachMitigation: false,
  })
);
```

## Options

| Option             | Type                        | Default                      | Description                                               |
| ------------------ | --------------------------- | ---------------------------- | --------------------------------------------------------- |
| `gzip`             | `boolean`                   | `true`                       | Enable Gzip compression                                   |
| `deflate`          | `boolean`                   | `true`                       | Enable Deflate compression                                |
| `brotli`           | `boolean`                   | `true`                       | Enable Brotli (auto-disabled in unsupported runtimes)     |
| `level`            | `number`                    | `6`                          | Compression level (0–9 for Gzip/Deflate, 0–11 for Brotli) |
| `threshold`        | `number`                    | `1024`                       | Minimum response size in bytes to compress                |
| `contentTypes`     | `readonly string[]`         | `DEFAULT_COMPRESSIBLE_TYPES` | Content types to compress                                 |
| `exclude`          | `readonly string[]`         | `DEFAULT_EXCLUDED_TYPES`     | Content types to exclude                                  |
| `filter`           | `(ctx: Context) => boolean` | —                            | Custom filter function                                    |
| `breachMitigation` | `boolean`                   | `false`                      | Add random padding against BREACH attacks                 |

## Algorithm-Specific Middleware

Use single-algorithm middleware when you need precise control:

```typescript
import { gzip, deflate, brotli } from '@nextrush/compression';

// Gzip only — universal support
app.use(gzip({ level: 6 }));

// Deflate only — fast compression
app.use(deflate({ level: 6 }));

// Brotli only — best compression ratio (Node.js/Bun only)
app.use(brotli({ level: 4 }));
```

## When to Use Each Algorithm

| Algorithm   | Best For                              | Browser Support | Runtime Support |
| ----------- | ------------------------------------- | --------------- | --------------- |
| **Gzip**    | Universal compatibility, CDN caching  | 99%+            | All             |
| **Deflate** | Low-latency, real-time, streaming     | 99%+            | All             |
| **Brotli**  | Static assets, bandwidth optimization | 95%+            | Node.js, Bun    |

### Recommended Configurations

```typescript
// General Purpose API — balanced speed and compression
app.use(compression({ gzip: true, brotli: true, level: 6 }));

// High-Traffic API — prioritize speed
app.use(compression({ gzip: true, brotli: false, level: 4, threshold: 2048 }));

// Bandwidth-Optimized — prioritize compression
app.use(compression({ gzip: true, brotli: true, level: 9, threshold: 512 }));

// Real-Time/Streaming — fastest possible
app.use(compression({ gzip: true, brotli: false, level: 1 }));
```

## Compression Levels

| Level | Speed    | Ratio  | Use Case                     |
| ----- | -------- | ------ | ---------------------------- |
| 0     | N/A      | None   | No compression               |
| 1–3   | Fast     | Low    | Real-time streaming          |
| 4–6   | Balanced | Medium | General purpose (default)    |
| 7–9   | Slow     | High   | Static assets, API responses |

**Brotli-specific:** Level 4 is optimal for dynamic content. Levels 10–11 are slow but excellent for pre-compressed static assets.

## Automatic Skip Conditions

Compression is automatically skipped when:

| Condition                       | Reason                   |
| ------------------------------- | ------------------------ |
| `Content-Encoding` already set  | Avoid double compression |
| Body size < `threshold`         | Overhead exceeds benefit |
| Non-compressible content type   | Images, video, archives  |
| `HEAD` request                  | No response body         |
| Status `204` or `304`           | No content responses     |
| Custom `filter` returns `false` | User-defined exclusion   |

## Response Headers

The middleware automatically manages these headers:

```http
Content-Encoding: gzip | deflate | br
Content-Length: <compressed-size>
Vary: Accept-Encoding
```

## Security: BREACH Mitigation

For responses containing both secrets and user-controlled input, enable BREACH mitigation:

```typescript
import { compression, secureCompressionOptions } from '@nextrush/compression';

// Default secure options (breachMitigation: true, level: 4)
app.use(compression(secureCompressionOptions()));

// With additional overrides
app.use(compression(secureCompressionOptions({ threshold: 512 })));
```

`secureCompressionOptions()` returns a `CompressionOptions` object with `breachMitigation: true` and a default level of `4`. Pass additional options to override other defaults.

## Checking Compression Status

```typescript
import { getCompressionInfo, wasCompressed } from '@nextrush/compression';

app.use(async (ctx) => {
  await ctx.next();

  if (wasCompressed(ctx)) {
    const info = getCompressionInfo(ctx);
    console.log(`Compressed with ${info?.encoding}: ${(info?.ratio ?? 0) * 100}%`);
  }
});
```

## Low-Level API

For advanced use cases, access the compression utilities directly:

```typescript
import {
  // Compression functions
  compress, // Full result with stats
  compressData, // Returns Uint8Array
  compressToBuffer, // Returns Node.js Buffer

  // Content negotiation
  parseAcceptEncoding, // Parse Accept-Encoding header
  negotiateEncoding, // Select best encoding (returns NegotiationResult)
  selectEncoding, // Returns encoding name or null
  isEncodingAccepted, // Check if encoding is accepted
  acceptsCompression, // Check if any compression accepted

  // Content type detection
  isCompressible, // Check if type should be compressed
  isAlreadyCompressed, // Check if type is already compressed
  isTextContent, // Check if type is text-based
  isBinaryContent, // Check if type is binary
  getCompressionRecommendation, // Get recommendation with reason

  // Runtime detection
  detectCapabilities, // Detect runtime compression support
  isEncodingSupported, // Check if encoding is supported
  getBestAvailableEncoding, // Get best encoding for runtime

  // Utilities
  estimateCompressedSize, // Estimate without compressing
  isCompressionBeneficial, // Check if compression helps
} from '@nextrush/compression';
```

### Direct Compression Example

```typescript
import { compress, isCompressible } from '@nextrush/compression';

const data = JSON.stringify({ large: 'data'.repeat(1000) });

if (isCompressible('application/json')) {
  const result = await compress(data, 'gzip', { level: 6 });
  console.log(`Original: ${result.info.originalSize} bytes`);
  console.log(`Compressed: ${result.info.compressedSize} bytes`);
  console.log(`Ratio: ${(result.info.ratio * 100).toFixed(1)}%`);
  console.log(`Duration: ${result.info.duration?.toFixed(2)}ms`);
}
```

## Runtime Compatibility

| Runtime            | Gzip | Deflate | Brotli |
| ------------------ | ---- | ------- | ------ |
| Node.js 22+        | ✅   | ✅      | ✅     |
| Bun                | ✅   | ✅      | ✅     |
| Deno               | ✅   | ✅      | ❌     |
| Cloudflare Workers | ✅   | ✅      | ❌     |
| Vercel Edge        | ✅   | ✅      | ❌     |

Brotli requires Node.js zlib or Bun's built-in support and is automatically disabled in unsupported runtimes.

## Performance Tips

1. **Use appropriate levels**: Level 4–6 for dynamic content, 7–9 for static assets
2. **Increase threshold**: Higher values reduce CPU usage on small responses
3. **Filter streaming**: Disable for SSE, WebSocket upgrades, or large file downloads
4. **Pre-compress static assets**: Use Brotli level 11 offline for maximum compression

```typescript
app.use(
  compression({
    level: 4,
    threshold: 2048,
    filter: (ctx) => {
      // Skip streaming endpoints
      if (ctx.path.startsWith('/events')) return false;
      // Skip large file downloads
      if (ctx.path.startsWith('/downloads')) return false;
      return true;
    },
  })
);
```

## Error Handling

The middleware falls back to uncompressed responses on errors. For direct API usage, catch `CompressionError`:

```typescript
import { compress, CompressionError, CompressionErrorCode } from '@nextrush/compression';

try {
  await compress(data, 'br');
} catch (error) {
  if (error instanceof CompressionError) {
    if (error.code === CompressionErrorCode.ENCODING_NOT_SUPPORTED) {
      // Fall back to gzip
      await compress(data, 'gzip');
    }
  }
}
```

## Types

```typescript
import type {
  CompressionEncoding, // 'gzip' | 'deflate' | 'br'
  CompressionOptions, // Middleware options
  CompressionInfo, // Compression result stats
  CompressionResult, // { data, info }
  AcceptEncodingEntry, // Parsed Accept-Encoding entry
  NegotiationResult, // { encoding, accepted }
  RuntimeCapabilities, // Runtime detection result
  CompressionMiddleware, // Middleware type
} from '@nextrush/compression';
```

## Constants

```typescript
import {
  DEFAULT_THRESHOLD, // 1024 bytes
  DEFAULT_COMPRESSION_LEVEL, // 6
  DEFAULT_COMPRESSIBLE_TYPES, // Text, JSON, etc.
  DEFAULT_EXCLUDED_TYPES, // Images, video, archives
  ENCODING_PRIORITY, // ['deflate', 'gzip', 'br']
  MAX_COMPRESSION_RATIO, // 1000 (decompression bomb protection)
} from '@nextrush/compression';
```

## License

MIT
