# @nextrush/static

High-performance, security-first static file serving middleware for NextRush.

## Features

- 🔒 **Security-First** - Symlink protection, path traversal prevention, X-Content-Type-Options
- ⚡ **Smart Caching** - ETag, Last-Modified, Cache-Control with immutable support
- 📦 **Range Requests** - HTTP 206 Partial Content for seeking and resuming
- 🔧 **Flexible Dotfiles** - Ignore, deny, or allow hidden files
- 📄 **Extension Fallbacks** - Serve `page.html` for `/page`
- 📁 **Directory Index** - Auto-serve `index.html` with redirect
- 🌊 **Efficient Streaming** - Small files buffered, large files streamed with timeout
- 🎯 **TOCTOU Safe** - Verifies file integrity after read

## Installation

```bash
npm install @nextrush/static
# or
pnpm add @nextrush/static
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { serveStatic } from '@nextrush/static';

const app = createApp();

// Serve files from 'public' directory at root
app.use(serveStatic({ root: './public' }));

// Or mount at a prefix
app.use(serveStatic({
  root: './public',
  prefix: '/static',
}));
```

## Options

```typescript
interface StaticOptions {
  // Required: Root directory to serve files from
  root: string;

  // URL prefix to mount under (default: '')
  prefix?: `/${string}` | '';

  // Default index file (default: 'index.html', false to disable)
  index?: string | false;

  // Pass 404s to next middleware (default: false)
  fallthrough?: boolean;

  // Redirect directories without trailing slash (default: true)
  redirect?: boolean;

  // Cache-Control max-age in seconds (default: 0)
  maxAge?: number;

  // Add 'immutable' to Cache-Control (default: false)
  immutable?: boolean;

  // Dotfile handling: 'ignore' | 'deny' | 'allow' (default: 'ignore')
  dotfiles?: DotfilesPolicy;

  // Extensions to try when file not found (default: [])
  extensions?: string[];

  // Custom headers hook
  setHeaders?: (ctx: Context, path: string, stat: StatsLike) => void;

  // Enable ETag generation (default: true)
  etag?: boolean;

  // Enable Last-Modified header (default: true)
  lastModified?: boolean;

  // Enable Accept-Ranges for range requests (default: true)
  acceptRanges?: boolean;

  // Threshold for streaming vs single-read (default: 1MB)
  highWaterMark?: number;

  // Follow symbolic links (default: false)
  // When false, symlinks return 404
  // When true, symlinks are resolved but must stay within root
  followSymlinks?: boolean;

  // Set X-Content-Type-Options: nosniff (default: true)
  xContentTypeOptions?: boolean;

  // Timeout for streaming operations in ms (default: 30000)
  streamTimeout?: number;
}
```

## Examples

### Caching for Production

```typescript
// Fingerprinted assets (long cache)
app.use(serveStatic({
  root: './dist/assets',
  prefix: '/assets',
  maxAge: 31536000, // 1 year
  immutable: true,
}));

// Regular static files (short cache)
app.use(serveStatic({
  root: './public',
  maxAge: 3600, // 1 hour
}));
```

### SPA (Single Page Application)

```typescript
import { createSendFile } from '@nextrush/static';

const sendPublicFile = createSendFile({ root: './dist' });

// Let 404s fall through to the SPA handler
app.use(serveStatic({
  root: './dist',
  fallthrough: true,
}));

// SPA fallback for client-side routing
app.use(async (ctx) => {
  await sendPublicFile(ctx, 'index.html');
});
```

### Extension Fallbacks

```typescript
// Serve /about -> /about.html
app.use(serveStatic({
  root: './public',
  extensions: ['.html', '.htm'],
}));
```

### Custom Headers

```typescript
app.use(serveStatic({
  root: './public',
  setHeaders: (ctx, path, stat) => {
    if (path.endsWith('.pdf')) {
      ctx.set('Content-Disposition', 'attachment');
    }
  },
}));
```

### Dotfiles Policy

```typescript
// Allow dotfiles (like .well-known)
app.use(serveStatic({
  root: './public',
  dotfiles: 'allow',
}));

// Deny dotfiles with 403 Forbidden
app.use(serveStatic({
  root: './private',
  dotfiles: 'deny',
}));
```

### Symlink Handling

```typescript
// Enable symlink following (use with caution)
app.use(serveStatic({
  root: './public',
  followSymlinks: true, // Symlinks are resolved and validated
}));
```

## Security

This middleware includes comprehensive security measures:

### Path Traversal Prevention

- Blocks `..` and `../` sequences (including URL-encoded variants)
- Blocks null bytes (`%00`)
- Blocks double slashes (`//`)
- Validates resolved path is within root directory

### Symlink Protection

By default (`followSymlinks: false`), symbolic links return 404. When enabled:

- Symlinks are resolved using `realpath()`
- Destination path is verified to be within root
- Symlinks pointing outside root are blocked with 404

### MIME Sniffing Prevention

X-Content-Type-Options: nosniff is set by default, preventing browsers from MIME-type sniffing responses away from the declared Content-Type.

### Range Request Safety

- Large range values beyond `Number.MAX_SAFE_INTEGER` are rejected
- Only single ranges supported (multi-range attacks blocked)
- Invalid ranges return 416 Range Not Satisfiable

### Stream Timeout

Streaming operations timeout after 30 seconds by default (configurable), preventing slow-loris style attacks from keeping connections open indefinitely.

### TOCTOU Mitigation

For small files read into memory, the actual content size is verified against the original stat. If the file was modified between stat and read, headers are updated to reflect actual size.

## Runtime Compatibility

This package uses only Node.js built-in modules:

- `node:fs` - File system operations
- `node:path` - Path manipulation
- `node:http` - Type definitions only

**Supported Runtimes:**

| Runtime | Version | Status |
|---------|---------|--------|
| Node.js | 20+ | ✅ Full support |
| Bun | 1.0+ | ✅ Full support |
| Deno | 1.37+ | ✅ With Node compatibility |

## Utilities

The package also exports utility functions:

```typescript
import {
  // Path safety
  safeJoin,       // Safely join paths, returns null on traversal
  isDotfile,      // Check if path contains dotfile

  // File operations
  statSafe,       // Safe fs.stat wrapper with symlink protection

  // Caching
  generateETag,   // Generate weak ETag from file stats
  isFresh,        // Check if request is fresh (304 eligible)

  // Range requests
  parseRange,     // Parse Range header with safety checks

  // MIME types
  getMimeType,    // Get MIME type for file extension (50+ types)

  // File sending
  sendFile,       // Low-level file sending with streaming
  createSendFile, // Create a bound send file function
} from '@nextrush/static';
```

### Manual File Sending

```typescript
import { createSendFile } from '@nextrush/static';

const sendPublicFile = createSendFile({ root: './public' });

app.get('/download/:file', async (ctx) => {
  const sent = await sendPublicFile(ctx, ctx.params.file);
  if (!sent) {
    ctx.status = 404;
    ctx.json({ error: 'File not found' });
  }
});
```

## Performance

- **Small files** (< 1MB): Read into memory for single response
- **Large files** (≥ 1MB): Streamed efficiently with configurable highWaterMark
- **Conditional requests**: Returns 304 when appropriate
- **Range requests**: Supports partial content for seeking/resuming

## Aliases

The package exports `staticFiles` as an alias for `serveStatic` (Express-style naming):

```typescript
import { staticFiles } from '@nextrush/static';

// Equivalent to serveStatic
app.use(staticFiles({ root: './public' }));
```

## MIME Types

50+ MIME types are supported out of the box:

| Extension | Content-Type |
|-----------|--------------|
| `.html`, `.htm` | `text/html; charset=utf-8` |
| `.css` | `text/css; charset=utf-8` |
| `.js`, `.mjs`, `.cjs` | `application/javascript; charset=utf-8` |
| `.json` | `application/json; charset=utf-8` |
| `.png` | `image/png` |
| `.jpg`, `.jpeg` | `image/jpeg` |
| `.svg` | `image/svg+xml` |
| `.woff2` | `font/woff2` |
| `.mp4` | `video/mp4` |
| `.pdf` | `application/pdf` |
| `.wasm` | `application/wasm` |
| Unknown | `application/octet-stream` |

See source code for complete list.

## License

MIT
