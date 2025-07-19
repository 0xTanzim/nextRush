# Static Files

## Introduction

The NextRush framework provides enterprise-grade static file serving capabilities that combine high performance, advanced compression, intelligent caching, and comprehensive security features. The static files system is designed to handle everything from simple file serving to complex CDN-like functionality with zero external dependencies.

## Public APIs

### Static File Methods

| Method                                  | Signature                                                                       | Description                        |
| --------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------- |
| `static(mountPath, rootPath, options?)` | `(mountPath: string, rootPath: string, options?: StaticOptions) => Application` | Serve static files from directory. |

### Configuration Interface

| Interface       | Description                                    |
| --------------- | ---------------------------------------------- |
| `StaticOptions` | Configuration options for static file serving. |

#### StaticOptions Properties

| Property        | Type                                      | Default          | Description                                     |
| --------------- | ----------------------------------------- | ---------------- | ----------------------------------------------- |
| `maxAge`        | `string \| number`                        | `0`              | Cache max age (e.g., '1d', '1y', 3600).         |
| `immutable`     | `boolean`                                 | `false`          | Mark files as immutable for caching.            |
| `etag`          | `boolean`                                 | `true`           | Generate ETag headers for conditional requests. |
| `lastModified`  | `boolean`                                 | `true`           | Send Last-Modified headers.                     |
| `index`         | `string \| string[] \| false`             | `['index.html']` | Directory index files.                          |
| `dotfiles`      | `'allow' \| 'deny' \| 'ignore'`           | `'ignore'`       | How to handle dotfiles.                         |
| `extensions`    | `string[] \| false`                       | `false`          | File extensions to try when file not found.     |
| `redirect`      | `boolean`                                 | `true`           | Redirect to trailing slash for directories.     |
| `compress`      | `'gzip' \| 'brotli' \| 'auto' \| boolean` | `false`          | Compression method.                             |
| `precompress`   | `boolean`                                 | `false`          | Use pre-compressed files (.gz, .br).            |
| `memoryCache`   | `boolean`                                 | `false`          | Enable in-memory file caching.                  |
| `maxCacheSize`  | `number`                                  | `52428800`       | Maximum cache size in bytes (50MB).             |
| `maxFileSize`   | `number`                                  | `1048576`        | Maximum individual file size for caching (1MB). |
| `acceptRanges`  | `boolean`                                 | `true`           | Support range requests for streaming.           |
| `serveHidden`   | `boolean`                                 | `false`          | Serve hidden files.                             |
| `caseSensitive` | `boolean`                                 | `true`           | Case-sensitive path matching.                   |
| `spa`           | `boolean \| string`                       | `false`          | Single Page Application fallback.               |
| `setHeaders`    | `(res, path, stat) => void`               | `undefined`      | Custom header function.                         |

### Built-in MIME Types

| Extension | MIME Type                | Description        |
| --------- | ------------------------ | ------------------ |
| `.html`   | `text/html`              | HTML documents.    |
| `.css`    | `text/css`               | Stylesheets.       |
| `.js`     | `application/javascript` | JavaScript files.  |
| `.json`   | `application/json`       | JSON data files.   |
| `.png`    | `image/png`              | PNG images.        |
| `.jpg`    | `image/jpeg`             | JPEG images.       |
| `.gif`    | `image/gif`              | GIF images.        |
| `.svg`    | `image/svg+xml`          | SVG vector images. |
| `.ico`    | `image/x-icon`           | Icon files.        |
| `.woff`   | `font/woff`              | WOFF fonts.        |
| `.woff2`  | `font/woff2`             | WOFF2 fonts.       |
| `.ttf`    | `font/ttf`               | TrueType fonts.    |
| `.pdf`    | `application/pdf`        | PDF documents.     |
| `.zip`    | `application/zip`        | ZIP archives.      |

## Usage Examples

### Basic Static File Serving

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Basic static file serving
app.static('/public', './public');

// Files accessible at:
// /public/style.css -> ./public/style.css
// /public/js/app.js -> ./public/js/app.js
// /public/images/logo.png -> ./public/images/logo.png

app.listen(3000);
```

### Advanced Static File Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Production-ready static file serving
app.static('/assets', './public', {
  // Caching
  maxAge: '1y',
  immutable: true,
  etag: true,
  lastModified: true,

  // Compression
  compress: 'auto', // Auto-detect best compression
  precompress: true, // Use .gz and .br files if available

  // Performance
  memoryCache: true,
  maxCacheSize: 100 * 1024 * 1024, // 100MB cache
  acceptRanges: true, // Support range requests

  // Security
  dotfiles: 'deny',
  serveHidden: false,

  // Custom headers
  setHeaders: (res, path, stat) => {
    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    // File-specific caching
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (path.match(/\\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
});

app.listen(3000);
```

### Single Page Application (SPA) Support

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// SPA with fallback to index.html
app.static('/', './dist', {
  spa: true, // Fallback to index.html for unmatched routes
  index: ['index.html'],
  maxAge: '1d',
  compress: true,
});

// SPA with custom fallback file
app.static('/', './build', {
  spa: 'app.html', // Custom fallback file
  maxAge: '1h',
});

// SPA with API route protection
app.static('/', './dist', {
  spa: true,
  setHeaders: (res, path) => {
    // Don't serve SPA for API routes
    if (path.startsWith('/api/')) {
      res.status(404).end();
      return;
    }
  },
});

app.listen(3000);
```

### Range Requests and Streaming

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Video/audio streaming with range requests
app.static('/media', './videos', {
  acceptRanges: true,
  maxAge: '7d',

  setHeaders: (res, path, stat) => {
    if (path.match(/\\.(mp4|mp3|avi|mov)$/)) {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'video/mp4');
    }
  },
});

// Large file downloads with resume support
app.static('/downloads', './files', {
  acceptRanges: true,
  maxFileSize: 500 * 1024 * 1024, // 500MB max for caching

  setHeaders: (res, path) => {
    if (path.endsWith('.zip') || path.endsWith('.tar.gz')) {
      res.setHeader('Content-Disposition', 'attachment');
    }
  },
});

app.listen(3000);
```

### Development vs Production Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

if (process.env.NODE_ENV === 'development') {
  // Development configuration
  app.static('/assets', './src/assets', {
    maxAge: 0, // No caching
    etag: false,
    compress: false,
    memoryCache: false,

    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store');
    },
  });
} else {
  // Production configuration
  app.static('/assets', './dist/assets', {
    maxAge: '1y',
    immutable: true,
    compress: 'brotli',
    precompress: true,
    memoryCache: true,

    setHeaders: (res, path) => {
      // Long-term caching for assets
      if (path.match(/\\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  });
}

app.listen(3000);
```

### Multiple Static Directories

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Multiple static directories with different configurations
app.static('/assets', './public/assets', {
  maxAge: '1y',
  compress: true,
  immutable: true,
});

app.static('/uploads', './uploads', {
  maxAge: '1d',
  compress: false, // Don't compress user uploads
  acceptRanges: true,

  setHeaders: (res, path) => {
    // Force download for certain file types
    if (path.match(/\\.(pdf|doc|docx|zip)$/)) {
      res.setHeader('Content-Disposition', 'attachment');
    }
  },
});

app.static('/docs', './documentation', {
  spa: true,
  index: ['index.html', 'README.html'],
  extensions: ['html'],
  maxAge: '1h',
});

app.listen(3000);
```

### Security-Focused Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Security-focused static file serving
app.static('/secure', './private', {
  dotfiles: 'deny', // Block access to .env, .git, etc.
  serveHidden: false,

  setHeaders: (res, path, stat) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Content Security Policy
    if (path.endsWith('.html')) {
      res.setHeader('Content-Security-Policy', "default-src 'self'");
    }

    // Block sensitive files
    if (path.includes('private') || path.includes('secret')) {
      res.status(403).end();
      return;
    }
  },
});

app.listen(3000);
```

## Configuration Options

### Basic Configuration

```typescript
// Simple static file serving
app.static('/public', './public', {
  maxAge: '1d',
  etag: true,
});
```

### Performance Configuration

```typescript
// High-performance configuration
app.static('/assets', './public', {
  // Caching
  maxAge: '1y',
  immutable: true,
  etag: true,
  lastModified: true,

  // Compression
  compress: 'brotli',
  precompress: true,

  // Memory caching
  memoryCache: true,
  maxCacheSize: 200 * 1024 * 1024, // 200MB
  maxFileSize: 5 * 1024 * 1024, // 5MB per file

  // Streaming
  acceptRanges: true,
});
```

### Security Configuration

```typescript
// Security-focused configuration
app.static('/files', './uploads', {
  dotfiles: 'deny',
  serveHidden: false,
  caseSensitive: true,

  setHeaders: (res, path, stat) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    // File size limits
    if (stat.size > 100 * 1024 * 1024) {
      // 100MB
      res.status(413).end('File too large');
      return;
    }
  },
});
```

### SPA Configuration

```typescript
// Single Page Application configuration
app.static('/', './dist', {
  spa: true,
  index: ['index.html'],
  maxAge: '1h',
  compress: true,

  setHeaders: (res, path) => {
    // Don't serve SPA for API routes
    if (path.startsWith('/api/') || path.startsWith('/admin/')) {
      res.status(404).end();
      return;
    }

    // Different caching for HTML vs assets
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  },
});
```

## Notes

- **Performance**: The static file system is optimized for high performance with intelligent caching, compression, and streaming support.

- **Compression**: Supports both gzip and brotli compression with automatic selection based on client capabilities. Pre-compressed files (.gz, .br) are served when available.

- **Caching**: Three levels of caching - HTTP caching with ETags and Last-Modified headers, in-memory caching for frequently accessed files, and pre-compression caching.

- **Range Requests**: Full support for HTTP range requests, enabling efficient streaming of large files and resume capabilities for downloads.

- **Security**: Built-in security features including dotfile protection, hidden file blocking, and customizable security headers.

- **SPA Support**: Native Single Page Application support with intelligent fallback handling and API route protection.

- **MIME Types**: Comprehensive MIME type detection with support for modern web formats including fonts, images, and multimedia files.

- **Memory Management**: Intelligent memory management with configurable cache sizes and automatic cleanup to prevent memory leaks.

- **Development Mode**: Special development mode features including hot reloading detection and no-cache headers for easier development.

- **Custom Headers**: Flexible header customization through the `setHeaders` callback for fine-grained control over response headers.

- **Path Security**: Built-in path traversal protection and case-sensitive/insensitive path matching options.

- **File Extensions**: Automatic file extension resolution for cleaner URLs (e.g., `/about` serves `/about.html`).
