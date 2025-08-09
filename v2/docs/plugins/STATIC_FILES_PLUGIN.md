# Static Files Plugin

Serve static assets with an Express/Koa/Fastify-like DX, optimized for NextRush v2.

## Quick Start

```ts
import { createApp } from 'nextrush';
import { StaticFilesPlugin } from '@/plugins/static-files/static-files.plugin';

const app = createApp();

// Serve files from ./public at /static
new StaticFilesPlugin({
  root: __dirname + '/public',
  prefix: '/static',
}).install(app);

app.listen(3000, () => console.log('http://localhost:3000'));
```

Access: `/static/images/logo.png`, `/static/app.js`, etc.

## Features

- Prefix mounting (virtual path) similar to Express and Fastify
- Safe path resolution to prevent traversal
- ETag/Last-Modified + 304 handling
- Range requests (single range)
- Cache-Control with `maxAge` and optional `immutable`
- HEAD support
- Optional `index.html` for directories and redirect to trailing slash
- Dotfiles policy: `ignore` (404), `deny` (403), or `allow`
- Hook for custom headers via `setHeaders`
- Extension fallback (e.g. request `/about` resolves `/about.html` when `extensions: ['.html']`)

## API

```ts
class StaticFilesPlugin {
  constructor(options: StaticFilesOptions);
  install(app: Application): void;
}

interface StaticFilesOptions {
  root: string; // Absolute directory path
  prefix?: `/${string}` | ''; // URL mount point, default ''
  index?: string | false; // Default 'index.html', set false to disable
  fallthrough?: boolean; // On 404, call next() instead of sending 404
  redirect?: boolean; // Redirect /dir -> /dir/
  maxAge?: number; // Cache-Control max-age in seconds
  immutable?: boolean; // Add immutable when maxAge > 0
  dotfiles?: 'ignore' | 'deny' | 'allow'; // Default 'ignore'
  extensions?: string[]; // Try additional extensions on not found
  setHeaders?: (ctx, abs, stat) => void; // Customize headers
}
```

## Examples

### Root mount with index and caching

```ts
new StaticFilesPlugin({
  root: path.join(__dirname, 'public'),
  prefix: '',
  index: 'index.html',
  maxAge: 3600,
  immutable: true,
}).install(app);
```

### Strict dotfiles

```ts
new StaticFilesPlugin({
  root: path.join(__dirname, 'assets'),
  prefix: '/assets',
  dotfiles: 'deny',
}).install(app);
```

### Fallthrough + custom headers

```ts
new StaticFilesPlugin({
  root: path.join(__dirname, 'public'),
  prefix: '/static',
  fallthrough: true,
  setHeaders: (ctx, abs, stat) => {
    ctx.res.setHeader('X-Static-Served', '1');
    // Example: set immutable only for hashed assets
    if (/\.[a-f0-9]{8,}\./.test(abs)) {
      ctx.res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}).install(app);
```

## Security Notes

- Keep `root` to a dedicated public directory
- Use `dotfiles: 'deny'` if your deployment includes sensitive dotfiles
- Set caching carefully for frequently updated files

## Behavior and Edge Cases

- GET and HEAD only; others pass through
- Directory requests redirect to trailing slash (configurable)
- If `index: false` and directory requested, returns 403 or falls through
- `fallthrough: true` defers to later middleware on 404
- Range requests respond with 206 or 416
- Unsatisfiable Range (e.g. `Range: bytes=999999-`) yields 416 with `Content-Range: bytes */<size>`
- Extension resolution stops at first match in order of `extensions`
- Dotfiles processed after resolution; `deny` => 403, `ignore` => 404

### Extension Fallback Details

When `extensions` is provided, and the exact path is not found, the plugin
appends each extension in order and serves the first existing file.

```ts
new StaticFilesPlugin({
  root: rootDir,
  extensions: ['.html', '.htm', '.txt'],
});
// Request /about -> tries /about.html, /about.htm, /about.txt
```

### Disabling Directory Index

Set `index: false` to prevent serving `index.html`. A directory request will:

1. Redirect to trailing slash if `redirect: true` and missing `/`
2. Return 403 (or call `next()` if `fallthrough: true`)

### Immutable Caching

If `immutable: true` and `maxAge > 0`, the header will include `immutable`.
Use this only for revisioned assets (e.g. `/app.8f3c1a2b.js`).

### Unsatisfiable Ranges

Client requesting a range entirely outside file size receives `416` with
`Content-Range: bytes */<size>` per RFC 7233.

### Internals Overview

Core logic split for maintainability:

- `static-files.plugin.ts`: Option normalization & middleware wiring
- `static-utils.ts`: Pure helpers (path safety, ETag, freshness, range parsing, streaming)

This separation enables focused unit tests and future reuse without coupling.

## Testing

Integration tests cover:

- Content types, caching headers, HEAD requests
- 304 conditional GET, Range requests
- Directory index + redirects, dotfiles policy
- Path traversal prevention, fallthrough behavior
- Extension fallback ordering
- 416 unsatisfiable range handling
- Immutable caching header presence
