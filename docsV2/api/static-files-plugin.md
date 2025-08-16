# Static Files Plugin API Reference

The Static Files Plugin provides high-performance static asset serving for NextRush v2 applications with security, caching, and range request support.

## 📖 What it is

A production-ready static file server that handles:

- **Secure file serving** with path traversal protection
- **Virtual path mounting** with URL prefixes
- **HTTP caching** with ETags and Last-Modified headers
- **Range requests** for partial content (video streaming, resume downloads)
- **Directory serving** with configurable index files
- **Extension fallbacks** for SPA routing
- **Dotfile policies** for security

## ⚡ When to use

Use the Static Files Plugin when you need:

- 🌐 **Web assets** - CSS, JavaScript, images, fonts
- 📁 **File downloads** - PDFs, documents, archives
- 🎥 **Media streaming** - Videos, audio with range support
- 🏗️ **SPA hosting** - Single Page Applications with fallbacks
- 📊 **Performance** - Optimized caching and streaming
- 🛡️ **Security** - Path traversal protection

## 🚀 Quick start

```typescript
import { createApp, StaticFilesPlugin } from 'nextrush';

const app = createApp();

// Basic static files serving
const staticPlugin = new StaticFilesPlugin({
  root: './public',
});

staticPlugin.install(app);

app.listen(3000);
// Files in ./public/ now served at http://localhost:3000/
```

---

# 🏗️ StaticFilesPlugin Class

## Constructor

```typescript
constructor(options: StaticFilesOptions)
```

**Parameters:**

- `options` (StaticFilesOptions): Configuration for static file serving

**Example:**

```typescript
const staticPlugin = new StaticFilesPlugin({
  root: './public',
  prefix: '/assets',
  maxAge: 86400, // 1 day cache
  immutable: true, // Assets never change
  index: 'index.html',
  fallthrough: false,
});

staticPlugin.install(app);
```

---

## Configuration Options

```typescript
interface StaticFilesOptions {
  root: string; // Directory to serve files from
  prefix?: `/${string}` | ''; // URL prefix (default: '')
  index?: string | false; // Index file (default: 'index.html')
  fallthrough?: boolean; // Call next() on 404 (default: false)
  redirect?: boolean; // Directory redirects (default: true)
  maxAge?: number; // Cache duration seconds (default: 0)
  immutable?: boolean; // Immutable cache directive (default: false)
  dotfiles?: DotfilesPolicy; // Dotfile handling (default: 'ignore')
  extensions?: string[]; // Extension fallbacks (default: [])
  setHeaders?: HeadersFunction; // Custom headers function
}
```

### Options in Detail

#### `root` (required)

**What:** Absolute or relative path to directory containing static files
**Security:** Must be a safe directory - plugin prevents path traversal

```typescript
// Serve files from public directory
{
  root: './public';
}
{
  root: '/var/www/static';
}
{
  root: process.cwd() + '/assets';
}
```

#### `prefix` (optional)

**What:** Virtual URL path to mount static files under
**Default:** `''` (serve at root)

```typescript
// Serve files under /static prefix
{
  prefix: '/static';
}
// ./public/image.jpg available at /static/image.jpg

// Serve files under /assets prefix
{
  prefix: '/assets';
}
// ./public/style.css available at /assets/style.css

// No prefix (root serving)
{
  prefix: '';
}
// ./public/index.html available at /index.html
```

#### `index` (optional)

**What:** Default file to serve for directory requests
**Default:** `'index.html'`

```typescript
// Serve index.html for directory requests
{
  index: 'index.html';
}
// GET /about/ → serves ./public/about/index.html

// Serve custom index file
{
  index: 'default.htm';
}

// Disable directory serving
{
  index: false;
}
// GET /about/ → 404 (unless fallthrough: true)
```

#### `fallthrough` (optional)

**What:** Whether to call `next()` on 404 instead of sending 404 response
**Default:** `false`

```typescript
// Return 404 for missing files
{
  fallthrough: false;
}

// Let other middleware handle missing files
{
  fallthrough: true;
}
// Useful for SPA with API fallback
```

#### `redirect` (optional)

**What:** Redirect directory requests without trailing slash
**Default:** `true`

```typescript
// Redirect /about to /about/ for directories
{
  redirect: true;
}
// GET /about → 301 redirect to /about/

// No automatic redirects
{
  redirect: false;
}
```

#### `maxAge` (optional)

**What:** Cache-Control max-age in seconds
**Default:** `0` (no explicit caching)

```typescript
// Cache for 1 hour
{
  maxAge: 3600;
}

// Cache for 1 day
{
  maxAge: 86400;
}

// Cache for 1 year (long-term assets)
{
  maxAge: 31536000;
}
```

#### `immutable` (optional)

**What:** Add `immutable` directive to Cache-Control header
**Default:** `false`

```typescript
// Mark assets as immutable (never change)
{ maxAge: 31536000, immutable: true }
// Cache-Control: public, max-age=31536000, immutable

// Regular caching
{ maxAge: 3600, immutable: false }
// Cache-Control: public, max-age=3600
```

#### `dotfiles` (optional)

**What:** How to handle files starting with dots (`.`)
**Default:** `'ignore'`

```typescript
type DotfilesPolicy = 'ignore' | 'deny' | 'allow';

// Return 404 for dotfiles (safer)
{
  dotfiles: 'ignore';
}

// Return 403 for dotfiles (explicit deny)
{
  dotfiles: 'deny';
}

// Allow serving dotfiles
{
  dotfiles: 'allow';
}
// Serves .htaccess, .env, etc. (usually not recommended)
```

#### `extensions` (optional)

**What:** File extensions to try when original request fails
**Default:** `[]`

```typescript
// Try .html extension for SPA routing
{
  extensions: ['.html'];
}
// GET /about → tries /about, then /about.html

// Try multiple extensions
{
  extensions: ['.html', '.htm', '.php'];
}

// No extension fallbacks
{
  extensions: [];
}
```

#### `setHeaders` (optional)

**What:** Custom function to set additional headers
**Default:** `undefined`

```typescript
// Add security headers
{
  setHeaders: (ctx, path, stat) => {
    ctx.res.setHeader('X-Custom-Header', 'value');

    // Set CORS for fonts
    if (path.endsWith('.woff2') || path.endsWith('.woff')) {
      ctx.res.setHeader('Access-Control-Allow-Origin', '*');
    }

    // No cache for HTML files
    if (path.endsWith('.html')) {
      ctx.res.setHeader('Cache-Control', 'no-cache');
    }
  };
}
```

---

# 🔧 Advanced Features

## Path traversal protection

The plugin automatically prevents path traversal attacks:

```typescript
// These requests are blocked (403 Forbidden):
// GET /../etc/passwd
// GET /static/../../../etc/passwd
// GET /static/..%2F..%2Fetc%2Fpasswd
// GET /static/%2e%2e%2f%2e%2e%2fpasswd

const staticPlugin = new StaticFilesPlugin({
  root: './public',
});
// Only files within ./public/ can be served
```

## HTTP caching with ETags

Automatic caching headers for optimal performance:

```typescript
const staticPlugin = new StaticFilesPlugin({
  root: './public',
  maxAge: 3600, // 1 hour cache
});

// Automatic headers for each file:
// ETag: "1a2b3c4d"
// Last-Modified: Wed, 21 Oct 2015 07:28:00 GMT
// Cache-Control: public, max-age=3600
// Content-Length: 12345

// Client sends: If-None-Match: "1a2b3c4d"
// Plugin responds: 304 Not Modified (no body)
```

## Range request support

Enable video streaming and resume downloads:

```typescript
// Automatic range request handling
const staticPlugin = new StaticFilesPlugin({
  root: './media',
});

// Client request:
// GET /video.mp4
// Range: bytes=1000-2000

// Plugin response:
// 206 Partial Content
// Content-Range: bytes 1000-2000/5000000
// Content-Length: 1001
// Accept-Ranges: bytes
// [video data from bytes 1000-2000]
```

## SPA (Single Page Application) support

Configure for client-side routing:

```typescript
const staticPlugin = new StaticFilesPlugin({
  root: './dist',
  index: 'index.html',
  extensions: ['.html'],
  fallthrough: true, // Let other routes handle API calls
  setHeaders: (ctx, path) => {
    // Don't cache the main HTML file
    if (path.endsWith('index.html')) {
      ctx.res.setHeader('Cache-Control', 'no-cache');
    }
  },
});

// GET /about → tries ./dist/about, then ./dist/about.html, then next()
// GET /users/123 → tries files, then next() (API route can handle)
```

---

# 🚀 Common Examples

## Basic web server

```typescript
import { createApp, StaticFilesPlugin } from 'nextrush';

const app = createApp();

// Serve public directory at root
const staticPlugin = new StaticFilesPlugin({
  root: './public',
});

staticPlugin.install(app);

app.listen(3000);

// File structure:
// public/
//   ├── index.html      → http://localhost:3000/
//   ├── about.html      → http://localhost:3000/about.html
//   ├── css/style.css   → http://localhost:3000/css/style.css
//   └── js/app.js       → http://localhost:3000/js/app.js
```

## API + static assets

```typescript
import { createApp, StaticFilesPlugin } from 'nextrush';

const app = createApp();

// API routes first
app.get('/api/users', async ctx => {
  ctx.json({ users: [] });
});

app.get('/api/health', async ctx => {
  ctx.json({ status: 'ok' });
});

// Static files with prefix
const staticPlugin = new StaticFilesPlugin({
  root: './public',
  prefix: '/static',
  maxAge: 86400, // Cache static assets for 1 day
  immutable: true,
});

staticPlugin.install(app);

// URLs:
// http://localhost:3000/api/users     → API endpoint
// http://localhost:3000/static/app.js → ./public/app.js
// http://localhost:3000/static/style.css → ./public/style.css
```

## High-performance asset server

```typescript
import { createApp, StaticFilesPlugin } from 'nextrush';

const app = createApp();

const staticPlugin = new StaticFilesPlugin({
  root: './assets',
  prefix: '/assets',
  maxAge: 31536000, // 1 year cache
  immutable: true, // Assets never change (versioned filenames)
  dotfiles: 'ignore',
  setHeaders: (ctx, path, stat) => {
    // CORS for fonts
    if (/\.(woff2?|eot|ttf|otf)$/.test(path)) {
      ctx.res.setHeader('Access-Control-Allow-Origin', '*');
    }

    // Gzip pre-compressed files
    if (path.endsWith('.gz')) {
      ctx.res.setHeader('Content-Encoding', 'gzip');
      // Remove .gz from content type detection
      const originalPath = path.slice(0, -3);
      if (originalPath.endsWith('.js')) {
        ctx.res.setHeader('Content-Type', 'application/javascript');
      } else if (originalPath.endsWith('.css')) {
        ctx.res.setHeader('Content-Type', 'text/css');
      }
    }
  },
});

staticPlugin.install(app);

// Optimized for:
// - Long-term caching with versioned assets
// - Font files with CORS headers
// - Pre-compressed gzip files
// - Security (no dotfiles)
```

## SPA with API fallback

```typescript
import { createApp, StaticFilesPlugin } from 'nextrush';

const app = createApp();

// API routes
app.get('/api/*', async ctx => {
  // Handle API endpoints
  ctx.json({ error: 'API endpoint not found' }, 404);
});

// Static files with SPA support
const staticPlugin = new StaticFilesPlugin({
  root: './dist',
  index: 'index.html',
  extensions: ['.html'],
  fallthrough: true, // Important: let other middleware handle misses
  setHeaders: (ctx, path) => {
    if (path.endsWith('index.html')) {
      // Don't cache the main SPA file
      ctx.res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      // Cache other assets
      ctx.res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  },
});

staticPlugin.install(app);

// SPA catch-all route (must be last)
app.get('*', async ctx => {
  // Serve index.html for all non-API, non-static routes
  const fs = await import('fs/promises');
  const html = await fs.readFile('./dist/index.html', 'utf-8');
  ctx.res.setHeader('Content-Type', 'text/html');
  ctx.res.send(html);
});

// Routing:
// /api/users      → API endpoint
// /assets/app.js  → static file
// /about          → index.html (SPA handles routing)
// /users/123      → index.html (SPA handles routing)
```

## Development server

```typescript
import { createApp, StaticFilesPlugin } from 'nextrush';

const app = createApp();

const isDev = process.env.NODE_ENV === 'development';

const staticPlugin = new StaticFilesPlugin({
  root: './public',
  index: 'index.html',
  maxAge: isDev ? 0 : 86400, // No cache in dev
  setHeaders: (ctx, path) => {
    if (isDev) {
      // Disable all caching in development
      ctx.res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      ctx.res.setHeader('Pragma', 'no-cache');
      ctx.res.setHeader('Expires', '0');
    }

    // CORS for development
    if (isDev) {
      ctx.res.setHeader('Access-Control-Allow-Origin', '*');
    }
  },
});

staticPlugin.install(app);
```

## File download server

```typescript
import { createApp, StaticFilesPlugin } from 'nextrush';

const app = createApp();

const downloadPlugin = new StaticFilesPlugin({
  root: './downloads',
  prefix: '/files',
  index: false, // No directory listing
  dotfiles: 'deny',
  setHeaders: (ctx, path, stat) => {
    // Force download for certain file types
    if (/\.(pdf|doc|docx|zip|tar\.gz)$/.test(path)) {
      const filename = path.split('/').pop();
      ctx.res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );
    }

    // Add download metadata
    ctx.res.setHeader('X-File-Size', stat.size.toString());
    ctx.res.setHeader('X-File-Modified', stat.mtime.toISOString());
  },
});

downloadPlugin.install(app);

// Features:
// - Range request support for resume downloads
// - Forced download for document types
// - File metadata in headers
// - Security (no dotfiles, no directory listing)
```

---

# 🔍 TypeScript Support

Full TypeScript support with proper type definitions:

```typescript
import type {
  StaticFilesPlugin,
  StaticFilesOptions,
  DotfilesPolicy,
  StatsLike,
} from 'nextrush';

// Type-safe configuration
const options: StaticFilesOptions = {
  root: './public',
  prefix: '/static',
  maxAge: 3600,
  dotfiles: 'ignore',
  setHeaders: (ctx, path, stat) => {
    // TypeScript knows the types of all parameters
    ctx.res.setHeader('X-File-Size', stat.size.toString());
  },
};

// Type-safe dotfiles policy
const policy: DotfilesPolicy = 'ignore'; // 'ignore' | 'deny' | 'allow'

// Custom headers function with types
const customHeaders = (ctx: Context, absolutePath: string, stat: StatsLike) => {
  if (stat.isFile() && stat.size > 1000000) {
    ctx.res.setHeader('X-Large-File', 'true');
  }
};
```

---

# ⚡ Performance Features

## Automatic optimizations

- **ETag generation** - Fast FNV-1a hash algorithm
- **Stream-based serving** - Memory-efficient for large files
- **304 Not Modified** - Reduces bandwidth usage
- **Range request support** - Enables streaming and resume
- **Path caching** - Fast file system lookups

## Performance tips

```typescript
// ✅ Good: Long cache for versioned assets
{
  maxAge: 31536000,  // 1 year
  immutable: true,   // Never changes
  // Files like: app-v1.2.3.js, style-abc123.css
}

// ✅ Good: Separate cache policies by file type
{
  setHeaders: (ctx, path) => {
    if (path.endsWith('.html')) {
      ctx.res.setHeader('Cache-Control', 'no-cache');
    } else if (/\.(js|css|png|jpg)$/.test(path)) {
      ctx.res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}

// ❌ Avoid: No caching for static assets
{ maxAge: 0 }

// ❌ Avoid: Very short cache for assets that don't change
{ maxAge: 60 }  // 1 minute is too short for CSS/JS
```

---

# 🔒 Security Features

## Built-in protections

- **Path traversal prevention** - Cannot access files outside root
- **Dotfile policies** - Control access to hidden files
- **Safe path resolution** - Multiple layers of protection
- **URL decoding safety** - Handles encoded traversal attempts

## Security best practices

```typescript
// ✅ Secure configuration
const staticPlugin = new StaticFilesPlugin({
  root: './public', // Dedicated public directory
  dotfiles: 'ignore', // Hide dotfiles (.env, .htaccess)
  fallthrough: false, // Don't expose file system structure
  index: 'index.html', // Don't allow directory listing
});

// ❌ Insecure configuration
const badPlugin = new StaticFilesPlugin({
  root: '/', // Serves entire file system!
  dotfiles: 'allow', // Exposes .env, .htaccess, etc.
  index: false, // May show directory contents
  fallthrough: true, // May leak file system info
});
```

---

# 📚 See also

- [Middleware API](./middleware.md) - Using static files with other middleware
- [Context API](./context.md) - Request/response handling
- [Application API](./application.md) - App-level configuration
- [Plugin Architecture](../architecture/plugin-system.md) - How plugins work

---

_Added in v2.0.0-alpha.1_
