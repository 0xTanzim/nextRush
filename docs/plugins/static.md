# Static File Serving

> Serve files from disk with production-grade security, caching, and performance.

## The Problem

Serving static files seems simple—until it isn't.

```typescript
// This is dangerous. Don't do this.
app.get('/files/*', async (ctx) => {
  const filePath = ctx.path.replace('/files', './public');
  const content = await fs.readFile(filePath);
  ctx.send(content);
});
```

This naive approach opens your server to:

- **Path traversal attacks**: `../../../etc/passwd`
- **Symlink escapes**: Links pointing outside the served directory
- **MIME sniffing attacks**: Browsers executing uploaded files as scripts
- **Resource exhaustion**: No streaming for large files
- **Cache inefficiency**: Re-reading unchanged files

Production static file serving requires handling all of these, plus conditional requests (304), range requests (206), proper caching headers, and dotfile policies.

## Why NextRush Includes This

Static files are fundamental to web applications:

- Single-page applications need to serve their bundles
- APIs often serve documentation or uploads
- Webhooks need `.well-known` directories

Rather than requiring an external dependency or leaving developers to build their own (insecure) solutions, NextRush provides a security-first static middleware with sensible defaults.

## Mental Model

Think of `serveStatic` as a **secure file system gateway**:

```
Request: GET /images/logo.png
         │
         ▼
┌──────────────────────────────────────────┐
│ serveStatic({ root: './public' })        │
│                                          │
│  1. Validate path (no traversal)         │
│  2. Check symlinks (blocked by default)  │
│  3. Apply dotfile policy                 │
│  4. Stat file (or try extensions)        │
│  5. Check conditional headers (304?)     │
│  6. Check range headers (206?)           │
│  7. Stream file with proper headers      │
└──────────────────────────────────────────┘
         │
         ▼
Response: 200 OK
          Content-Type: image/png
          ETag: W/"1a2b3c..."
          Cache-Control: public, max-age=3600
          X-Content-Type-Options: nosniff
          [file bytes]
```

The middleware handles security, caching, and efficiency—you just specify which directory to serve.

## Basic Usage

```typescript
import { createApp } from '@nextrush/core';
import { serveStatic } from '@nextrush/static';

const app = createApp();

// Serve files from 'public' directory
app.use(serveStatic({ root: './public' }));

app.listen(3000);
```

**What this does:**

- `GET /style.css` → serves `./public/style.css`
- `GET /images/logo.png` → serves `./public/images/logo.png`
- `GET /` → serves `./public/index.html` (directory index)
- `GET /../../../etc/passwd` → returns 403 Forbidden

## What Happens Behind the Scenes

When a request arrives, `serveStatic` performs these steps:

### 1. Path Validation

```
Input: /images/../../../etc/passwd

Steps:
1. Decode URL: /images/../../../etc/passwd
2. Check for .. → BLOCKED (403 Forbidden)
```

### 2. Symlink Check (if followSymlinks=false)

```
File: ./public/link → /etc/passwd

Steps:
1. lstat('./public/link') → isSymbolicLink: true
2. followSymlinks=false → BLOCKED (404 Not Found)
```

### 3. File Stat

```
File: ./public/style.css

Steps:
1. stat('./public/style.css')
2. Returns: { size: 4096, mtime: Date, isFile: true }
```

### 4. Conditional Request Check

```
Headers: If-None-Match: W/"abc123"
Server ETag: W/"abc123"

Result: 304 Not Modified (no body sent)
```

### 5. Range Request Check

```
Headers: Range: bytes=0-1023
File size: 10000

Result: 206 Partial Content
        Content-Range: bytes 0-1023/10000
        [first 1024 bytes]
```

### 6. Response

```
Headers set:
- Content-Type: text/css; charset=utf-8
- Content-Length: 4096
- ETag: W/"abc123"
- Last-Modified: Thu, 01 Jan 2024 00:00:00 GMT
- Cache-Control: public, max-age=3600 (if configured)
- Accept-Ranges: bytes
- X-Content-Type-Options: nosniff

Body: [file bytes streamed or buffered]
```

## Configuration Options

### Required Options

```typescript
serveStatic({
  root: './public', // Directory to serve files from
});
```

### URL Mounting

```typescript
// Serve at /static prefix
serveStatic({
  root: './public',
  prefix: '/static', // GET /static/style.css → ./public/style.css
});
```

### Caching

```typescript
// Development: no caching
serveStatic({
  root: './public',
  maxAge: 0, // Default
});

// Production: aggressive caching for fingerprinted assets
serveStatic({
  root: './dist/assets',
  maxAge: 31536000, // 1 year
  immutable: true, // Browsers won't revalidate
});
```

### Directory Behavior

```typescript
serveStatic({
  root: './public',
  index: 'index.html', // Default: serve for directory requests
  redirect: true, // Default: /dir → 301 → /dir/
});

// Disable index serving
serveStatic({
  root: './public',
  index: false, // Directories return 403
});
```

### Dotfile Handling

```typescript
// Default: ignore (404)
serveStatic({ root: './public', dotfiles: 'ignore' });

// Explicit deny (403)
serveStatic({ root: './public', dotfiles: 'deny' });

// Allow (serve normally) - needed for .well-known
serveStatic({ root: './public', dotfiles: 'allow' });
```

### Extension Fallbacks

```typescript
// /about → /about.html
serveStatic({
  root: './public',
  extensions: ['.html', '.htm'],
});
```

### Security Options

```typescript
serveStatic({
  root: './public',

  // Symlink handling (default: false = blocked)
  followSymlinks: false,

  // X-Content-Type-Options header (default: true)
  xContentTypeOptions: true,

  // Stream timeout in ms (default: 30000)
  streamTimeout: 30000,
});
```

### Conditional & Range Requests

```typescript
serveStatic({
  root: './public',

  // ETag generation (default: true)
  etag: true,

  // Last-Modified header (default: true)
  lastModified: true,

  // Accept-Ranges header (default: true)
  acceptRanges: true,
});
```

### Error Behavior

```typescript
// Default: respond with 404
serveStatic({ root: './public', fallthrough: false });

// Pass to next middleware (for SPA routing)
serveStatic({ root: './public', fallthrough: true });
```

## Common Patterns

### Single Page Application (SPA)

```typescript
import { serveStatic, createSendFile } from '@nextrush/static';

const app = createApp();
const sendFile = createSendFile({ root: './dist' });

// Serve static assets
app.use(serveStatic({
  root: './dist',
  fallthrough: true, // Don't 404, pass to SPA handler
}));

// SPA fallback: serve index.html for all non-file routes
app.use(async (ctx) => {
  await sendFile(ctx, 'index.html');
});

app.listen(3000);
```

### Multiple Static Directories

```typescript
// Order matters: first match wins

// Fingerprinted assets (aggressive cache)
app.use(serveStatic({
  root: './dist/assets',
  prefix: '/assets',
  maxAge: 31536000,
  immutable: true,
}));

// User uploads (no cache)
app.use(serveStatic({
  root: './uploads',
  prefix: '/uploads',
  maxAge: 0,
}));

// General public files (short cache)
app.use(serveStatic({
  root: './public',
  maxAge: 3600,
}));
```

### File Downloads with Custom Headers

```typescript
app.use(serveStatic({
  root: './downloads',
  prefix: '/download',
  setHeaders: (ctx, filePath, stat) => {
    // Force download for all files
    const filename = filePath.split('/').pop();
    ctx.set('Content-Disposition', `attachment; filename="${filename}"`);

    // Add download size hint
    ctx.set('X-File-Size', String(stat.size));
  },
}));
```

### Let's Encrypt / ACME Challenge

```typescript
// .well-known must be accessible
app.use(serveStatic({
  root: './public',
  dotfiles: 'allow', // Required for .well-known
}));
```

### Development vs Production

```typescript
const isDev = process.env.NODE_ENV !== 'production';

app.use(serveStatic({
  root: './public',
  maxAge: isDev ? 0 : 3600,
  etag: !isDev, // Skip ETag overhead in dev
}));
```

## Security Deep Dive

### Path Traversal Protection

The middleware blocks multiple attack vectors:

```typescript
// All of these return 403 Forbidden
GET /../../../etc/passwd           // Double-dot traversal
GET /%2e%2e/%2e%2e/etc/passwd      // URL-encoded dots
GET /images/..%5c..%5cetc/passwd   // Mixed encoding
GET /file.txt%00.html              // Null byte injection
GET //etc/passwd                   // Double slash
```

**How it works:**

1. URL is decoded with `decodeURIComponent`
2. Path is normalized with `path.normalize()`
3. Result is verified to be within root directory
4. Explicit checks for `..`, null bytes, and double slashes

### Symlink Protection

By default, symlinks are blocked:

```bash
# Attacker creates:
ln -s /etc/passwd ./public/secret.txt
```

```typescript
// Default behavior
GET /secret.txt → 404 Not Found

// With followSymlinks: true
// Symlink is resolved, destination verified
GET /secret.txt → 404 if destination outside root
```

**When to enable symlinks:**

- Your deployment creates symlinks within the served directory
- You've verified no untrusted symlinks can exist
- You understand the security implications

### MIME Sniffing Prevention

The `X-Content-Type-Options: nosniff` header prevents browsers from:

- Executing uploaded text files as JavaScript
- Rendering uploaded HTML files
- MIME confusion attacks

```typescript
// Sent by default
X-Content-Type-Options: nosniff

// Disable if needed (not recommended)
serveStatic({ root: './public', xContentTypeOptions: false });
```

### Range Request Safety

Range requests are validated to prevent:

- Integer overflow with large values
- Multi-range DoS attacks (not supported)
- Invalid range calculation

```typescript
// These return null (invalid range)
parseRange('bytes=999999999999999999-', 1000);  // > MAX_SAFE_INTEGER
parseRange('bytes=0-100,200-300', 1000);        // Multi-range blocked
parseRange('bytes=500-400', 1000);              // start > end
```

## API Reference

### `serveStatic(options)`

Create static file serving middleware.

```typescript
function serveStatic(options: StaticOptions): Middleware
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `root` | `string` | (required) | Directory to serve files from |
| `prefix` | `string` | `''` | URL prefix to mount at |
| `index` | `string \| false` | `'index.html'` | Index file for directories |
| `fallthrough` | `boolean` | `false` | Pass 404s to next middleware |
| `redirect` | `boolean` | `true` | Redirect dirs without trailing slash |
| `maxAge` | `number` | `0` | Cache-Control max-age (seconds) |
| `immutable` | `boolean` | `false` | Add immutable to Cache-Control |
| `dotfiles` | `'ignore' \| 'deny' \| 'allow'` | `'ignore'` | Dotfile handling policy |
| `extensions` | `string[]` | `[]` | Extensions to try on 404 |
| `setHeaders` | `Function` | - | Custom headers callback |
| `etag` | `boolean` | `true` | Generate ETag headers |
| `lastModified` | `boolean` | `true` | Set Last-Modified header |
| `acceptRanges` | `boolean` | `true` | Enable range requests |
| `highWaterMark` | `number` | `1048576` | Stream threshold (bytes) |
| `followSymlinks` | `boolean` | `false` | Follow symbolic links |
| `xContentTypeOptions` | `boolean` | `true` | Set X-Content-Type-Options |
| `streamTimeout` | `number` | `30000` | Stream timeout (ms) |

### `createSendFile(options)`

Create a function to send specific files.

```typescript
function createSendFile(options: Omit<StaticOptions, 'prefix'>): SendFile

type SendFile = (ctx: Context, relativePath: string) => Promise<boolean>
```

**Returns:** `true` if file was sent, `false` if not found or blocked.

```typescript
const sendFile = createSendFile({ root: './public' });

app.get('/download/:file', async (ctx) => {
  const sent = await sendFile(ctx, ctx.params.file);
  if (!sent) {
    ctx.status = 404;
    ctx.json({ error: 'File not found' });
  }
});
```

### `staticFiles`

Alias for `serveStatic` (Express-style naming).

```typescript
import { staticFiles } from '@nextrush/static';

app.use(staticFiles({ root: './public' }));
```

## Utility Functions

### `safeJoin(root, urlPath)`

Safely join paths, preventing traversal.

```typescript
safeJoin('/var/www', 'images/logo.png');  // '/var/www/images/logo.png'
safeJoin('/var/www', '../etc/passwd');    // null
safeJoin('/var/www', '%2e%2e/etc');       // null
```

### `statSafe(path, followSymlinks?, root?)`

Safe file stat with symlink protection.

```typescript
const stat = await statSafe('./public/file.txt');
// Returns StatsLike or null

const stat = await statSafe('./public/link', true, './public');
// Follows symlink only if destination is within root
```

### `generateETag(stat)`

Generate weak ETag from file stats.

```typescript
const etag = generateETag({ size: 1024, mtime: new Date() });
// 'W/"abc123"'
```

### `isFresh(ctx, stat, etag)`

Check if request is fresh (304 eligible).

```typescript
if (isFresh(ctx, stat, etag)) {
  ctx.status = 304;
  return;
}
```

### `parseRange(header, fileSize)`

Parse Range header safely.

```typescript
parseRange('bytes=0-99', 1000);   // { start: 0, end: 99 }
parseRange('bytes=500-', 1000);   // { start: 500, end: 999 }
parseRange('bytes=-100', 1000);   // { start: 900, end: 999 }
parseRange('bytes=invalid', 1000); // null
```

### `getMimeType(filePath)`

Get MIME type for file extension.

```typescript
getMimeType('style.css');  // 'text/css; charset=utf-8'
getMimeType('image.png');  // 'image/png'
getMimeType('unknown.xyz'); // 'application/octet-stream'
```

### `isDotfile(path)`

Check if path contains a dotfile.

```typescript
isDotfile('.hidden');         // true
isDotfile('dir/.hidden');     // true
isDotfile('file.txt');        // false
isDotfile('.');               // false (current dir)
isDotfile('..');              // false (parent dir)
```

## Runtime Compatibility

This package uses only Node.js built-in modules:

| Module | Usage |
|--------|-------|
| `node:fs` | File operations (stat, read, stream) |
| `node:path` | Path manipulation |
| `node:http` | Type definitions only |

**Supported Runtimes:**

| Runtime | Version | Support |
|---------|---------|---------|
| Node.js | 20+ | ✅ Full |
| Bun | 1.0+ | ✅ Full |
| Deno | 1.37+ | ✅ With Node compat |

## MIME Types

50+ types supported out of the box:

| Category | Extensions |
|----------|------------|
| **Text** | `.html`, `.css`, `.txt`, `.csv`, `.xml`, `.md` |
| **JavaScript** | `.js`, `.mjs`, `.cjs`, `.json`, `.map` |
| **TypeScript** | `.ts`, `.tsx`, `.jsx` |
| **Images** | `.png`, `.jpg`, `.gif`, `.webp`, `.avif`, `.svg`, `.ico` |
| **Fonts** | `.woff`, `.woff2`, `.ttf`, `.otf`, `.eot` |
| **Audio** | `.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac` |
| **Video** | `.mp4`, `.webm`, `.ogv`, `.mov`, `.mkv` |
| **Documents** | `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx` |
| **Archives** | `.zip`, `.tar`, `.gz`, `.rar`, `.7z` |
| **Web** | `.wasm`, `.webmanifest` |

## Common Mistakes

### Mistake: Serving the Wrong Directory

```typescript
// ❌ Serves entire project
serveStatic({ root: './' });

// ✅ Serve only public directory
serveStatic({ root: './public' });
```

### Mistake: Forgetting fallthrough for SPAs

```typescript
// ❌ All routes return 404 for non-files
app.use(serveStatic({ root: './dist' }));
app.get('/api/*', apiHandler);

// ✅ Non-files fall through to routes
app.use(serveStatic({ root: './dist', fallthrough: true }));
app.get('/api/*', apiHandler);
```

### Mistake: Over-caching Dynamic Content

```typescript
// ❌ User uploads cached for a year
serveStatic({
  root: './uploads',
  maxAge: 31536000,
});

// ✅ No caching for user content
serveStatic({
  root: './uploads',
  maxAge: 0,
});
```

### Mistake: Enabling Symlinks Without Understanding

```typescript
// ❌ Dangerous if untrusted content exists
serveStatic({
  root: './user-content',
  followSymlinks: true,
});

// ✅ Only enable for trusted directories
serveStatic({
  root: './app-assets',
  followSymlinks: true, // OK if you control all content
});
```

## When NOT to Use This

### Use a CDN Instead

For production at scale, serve static files from a CDN:

- CloudFront, Cloudflare, Fastly
- Better global performance
- Reduced server load
- Built-in DDoS protection

### Use Nginx/Caddy for Simple Cases

If your server only serves static files:

- Nginx or Caddy are more efficient
- Built specifically for static serving
- Better connection handling

### Don't Serve User Uploads Directly

For user-uploaded content:

- Use object storage (S3, GCS, R2)
- Scan for malware first
- Implement access control separately

## Performance Notes

### Small Files (< 1MB)

Read entirely into memory, sent as single response:
- Fast for repeated requests (OS caches the file)
- No streaming overhead

### Large Files (≥ 1MB)

Streamed to response:
- Memory-efficient
- Supports range requests
- Configurable threshold via `highWaterMark`

### Conditional Requests

When client sends `If-None-Match` or `If-Modified-Since`:
- File is not read if unchanged
- Returns 304 with no body
- Significant bandwidth savings

## Next Steps

- Learn about [Middleware](/concepts/middleware) to understand how static fits in the pipeline
- See [Body Parser](/middleware/body-parser) for handling uploads
- Read [Security Best Practices](/guides/security) for production deployments
