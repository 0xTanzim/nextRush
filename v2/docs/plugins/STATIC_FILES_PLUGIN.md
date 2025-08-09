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

## Testing

Integration tests cover:

- Content types, caching headers, HEAD requests
- 304 conditional GET, Range requests
- Directory index + redirects, dotfiles policy
- Path traversal prevention, fallthrough behavior
