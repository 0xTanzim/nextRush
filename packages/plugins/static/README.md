# @nextrush/static

High-performance static file serving middleware for NextRush.

## Features

- 🔒 **Path traversal protection** - Secure by default
- ⚡ **Smart caching** - ETag, Last-Modified, Cache-Control
- 📦 **Range requests** - Support for partial content (HTTP 206)
- 🔧 **Configurable dotfiles** - ignore, deny, or allow
- 📄 **Extension fallbacks** - Serve `page.html` for `/page`
- 📁 **Directory index** - Auto-serve `index.html`
- 🌊 **Streaming** - Efficient handling of large files

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
// Let 404s fall through to the SPA handler
app.use(serveStatic({
  root: './dist',
  fallthrough: true,
}));

// SPA fallback
app.use(async (ctx) => {
  // Serve index.html for all routes
  await sendFile(ctx, 'index.html');
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

## Utilities

The package also exports utility functions:

```typescript
import {
  // Path safety
  safeJoin,       // Safely join paths, returns null on traversal
  isDotfile,      // Check if path contains dotfile

  // File operations
  statSafe,       // Safe fs.stat wrapper

  // Caching
  generateETag,   // Generate weak ETag from file stats
  isFresh,        // Check if request is fresh (304 eligible)

  // Range requests
  parseRange,     // Parse Range header

  // MIME types
  getMimeType,    // Get MIME type for file extension

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

## Security

This middleware includes several security measures:

1. **Path traversal prevention** - Blocks `..`, encoded variants, and null bytes
2. **Dotfile protection** - Hides dotfiles by default
3. **Directory listing disabled** - Only serves specific files or index
4. **Safe symlink handling** - Resolves to canonical paths

## Performance

- **Small files**: Read into memory for single response
- **Large files**: Streamed efficiently
- **Conditional requests**: Returns 304 when appropriate
- **Range requests**: Supports partial content for seeking/resuming

## License

MIT
