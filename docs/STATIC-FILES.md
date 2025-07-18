# Static Files Serving

NextRush provides professional static file serving with advanced features like compression, caching, range requests, and SPA support.

## Basic Usage

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Basic static file serving
app.static('/assets', './public');

// Files will be served at:
// /assets/style.css -> ./public/style.css
// /assets/js/app.js -> ./public/js/app.js
// /assets/images/logo.png -> ./public/images/logo.png
```

## Advanced Configuration

```typescript
// Professional static file configuration
app.static('/assets', './public', {
  // Performance
  compression: true, // Auto gzip/brotli compression
  memoryCache: true, // Cache files in memory
  maxAge: '1y', // Browser cache (1 year)
  etag: true, // ETag headers for conditional requests
  immutable: true, // Mark assets as immutable

  // Range requests (for video streaming)
  acceptRanges: true, // Support partial content requests

  // Security
  dotfiles: 'ignore', // Hide .env, .git files
  index: ['index.html'], // Default files to serve

  // Custom headers
  setHeaders: (res, path, stat) => {
    // Set cache headers based on file type
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }

    // Force download for certain file types
    if (path.endsWith('.pdf')) {
      res.setHeader('Content-Disposition', 'attachment');
    }

    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
});
```

## SPA (Single Page Application) Support

```typescript
// Serve SPA with fallback to index.html
app.static('/', './dist', {
  spa: true, // Fallback to index.html for 404s
  spaFile: 'index.html', // Custom SPA file (default: index.html)
  maxAge: '1h', // Cache HTML for 1 hour
  compression: true,
});

// API routes (must come before SPA static serving)
app.get('/api/*', (req, res) => {
  res.json({ api: true });
});

// This will serve your SPA and handle client-side routing
// /about -> serves index.html (handled by client-side router)
// /users/123 -> serves index.html (handled by client-side router)
// /api/users -> handled by API route above
```

## Multiple Static Directories

```typescript
// Serve different directories for different purposes
app.static('/assets', './public', {
  maxAge: '1y',
  compression: true,
  immutable: true,
});

app.static('/uploads', './uploads', {
  maxAge: '1d',
  dotfiles: 'deny', // Don't serve hidden files
  acceptRanges: true, // Support video streaming
  setHeaders: (res, path) => {
    // Security: prevent execution of uploaded files
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
  },
});

app.static('/docs', './documentation', {
  maxAge: '1h',
  index: ['README.md', 'index.html'],
});
```

## Compression Configuration

```typescript
// Advanced compression settings
app.static('/assets', './public', {
  compression: {
    enabled: true,
    threshold: 1024, // Only compress files > 1KB
    algorithms: ['gzip', 'br'], // Use both gzip and brotli
    level: 6, // Compression level (1-9)
    memLevel: 8, // Memory level for gzip
  },

  // Precompressed files
  precompressed: true, // Look for .gz and .br files

  // Cache compressed responses
  compressionCache: true,
});

// This will:
// 1. Look for pre-compressed files (style.css.gz, style.css.br)
// 2. If not found, compress on-the-fly
// 3. Cache compressed responses for better performance
```

## Custom File Types and MIME

```typescript
app.static('/files', './files', {
  // Custom MIME types
  mimeTypes: {
    '.special': 'application/x-special-format',
    '.custom': 'text/x-custom-format',
  },

  // Default MIME type for unknown extensions
  defaultMimeType: 'application/octet-stream',

  setHeaders: (res, path, stat) => {
    // Custom handling based on file extension
    const ext = path.split('.').pop();

    switch (ext) {
      case 'json':
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        break;
      case 'xml':
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        break;
      case 'csv':
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment');
        break;
    }
  },
});
```

## Development vs Production

```typescript
// Environment-specific static file configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

if (isDevelopment) {
  // Development: no caching, no compression for faster rebuilds
  app.static('/assets', './public', {
    maxAge: 0,
    compression: false,
    etag: false,
    memoryCache: false,
  });
} else if (isProduction) {
  // Production: aggressive caching and compression
  app.static('/assets', './dist', {
    maxAge: '1y',
    compression: true,
    memoryCache: true,
    etag: true,
    immutable: true,
    precompressed: true,

    setHeaders: (res, path) => {
      // Set far-future expiry for hashed assets
      if (
        path.match(/\.[a-f0-9]{8,}\.(css|js|png|jpg|jpeg|gif|ico|svg|woff2?)$/)
      ) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  });
}
```

## File Upload Serving

```typescript
// Serve user uploaded files with security considerations
app.static('/uploads', './uploads', {
  maxAge: '1d',

  // Security: prevent execution of uploaded files
  setHeaders: (res, path, stat) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");

    // Force download for potentially dangerous files
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.scr'];
    const ext = path.toLowerCase().split('.').pop();

    if (dangerousExtensions.includes(`.${ext}`)) {
      res.setHeader('Content-Disposition', 'attachment');
      res.setHeader('Content-Type', 'application/octet-stream');
    }
  },

  // Filter files
  filter: (path, stat) => {
    // Don't serve hidden files or executables
    const filename = path.split('/').pop();
    if (filename.startsWith('.')) return false;

    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.scr'];
    const ext = filename.toLowerCase().split('.').pop();
    return !dangerousExtensions.includes(`.${ext}`);
  },
});
```

## Video and Media Streaming

```typescript
// Optimized for video streaming
app.static('/videos', './media', {
  acceptRanges: true, // Enable range requests for streaming
  maxAge: '1d',
  compression: false, // Don't compress videos (already compressed)

  setHeaders: (res, path, stat) => {
    // Optimize for streaming
    if (path.match(/\.(mp4|webm|ogg|avi|mov)$/i)) {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', getVideoMimeType(path));

      // Allow cross-origin for video elements
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }

    // Audio files
    if (path.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  },
});

function getVideoMimeType(path) {
  const ext = path.toLowerCase().split('.').pop();
  const mimeTypes = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg',
    avi: 'video/x-msvideo',
    mov: 'video/quicktime',
  };
  return mimeTypes[ext] || 'video/mp4';
}
```

## Error Handling

```typescript
// Custom error handling for static files
app.static('/assets', './public', {
  // Custom 404 handler
  onNotFound: (req, res) => {
    res.status(404).json({
      error: 'File not found',
      path: req.url,
      message: 'The requested file does not exist',
    });
  },

  // Custom error handler
  onError: (err, req, res) => {
    console.error('Static file error:', err);
    res.status(500).json({
      error: 'File serving error',
      message:
        process.env.NODE_ENV === 'development'
          ? err.message
          : 'Internal server error',
    });
  },
});
```

## Performance Monitoring

```typescript
// Monitor static file performance
app.static('/assets', './public', {
  compression: true,
  memoryCache: true,
  maxAge: '1y',

  // Performance monitoring
  onServe: (req, res, filePath, stat) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const size = stat.size;
      const compression = res.getHeader('Content-Encoding');

      console.log(`Static file served: ${filePath}`, {
        duration: `${duration}ms`,
        size: `${(size / 1024).toFixed(2)}KB`,
        compression: compression || 'none',
        cached: res.getHeader('X-Cache') === 'HIT',
      });
    });
  },
});
```

## CDN Integration

```typescript
// Integrate with CDN
const CDN_URL = process.env.CDN_URL;

if (CDN_URL) {
  // Redirect static assets to CDN
  app.use('/assets/*', (req, res) => {
    const cdnUrl = `${CDN_URL}${req.url}`;
    res.redirect(301, cdnUrl);
  });
} else {
  // Serve locally if no CDN
  app.static('/assets', './public', {
    maxAge: '1y',
    compression: true,
    memoryCache: true,
  });
}
```

## Testing Static Files

```typescript
// Test static file serving
import { createApp } from 'nextrush';
import request from 'supertest';
import fs from 'fs';
import path from 'path';

describe('Static Files', () => {
  let app;

  beforeEach(() => {
    app = createApp();

    // Create test file
    const testDir = './test-public';
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'test.txt'), 'Hello World');

    app.static('/assets', testDir);
  });

  afterEach(() => {
    // Clean up test files
    fs.rmSync('./test-public', { recursive: true, force: true });
  });

  test('serves static files', async () => {
    const response = await request(app).get('/assets/test.txt').expect(200);

    expect(response.text).toBe('Hello World');
    expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
  });

  test('returns 404 for non-existent files', async () => {
    await request(app).get('/assets/nonexistent.txt').expect(404);
  });

  test('sets cache headers', async () => {
    app = createApp();
    app.static('/assets', './test-public', { maxAge: '1h' });

    const response = await request(app).get('/assets/test.txt').expect(200);

    expect(response.headers['cache-control']).toContain('max-age=3600');
  });
});
```

## Configuration Reference

### Complete Options

```typescript
interface StaticOptions {
  // Caching
  maxAge?: string | number; // Cache-Control max-age
  etag?: boolean; // Generate ETag headers
  immutable?: boolean; // Mark as immutable

  // Compression
  compression?:
    | boolean
    | {
        enabled: boolean;
        threshold: number;
        algorithms: string[];
        level: number;
        memLevel: number;
      };
  precompressed?: boolean; // Look for .gz/.br files
  compressionCache?: boolean; // Cache compressed responses

  // Memory caching
  memoryCache?: boolean; // Cache files in memory
  memoryCacheSize?: number; // Max memory cache size

  // Range requests
  acceptRanges?: boolean; // Support partial content

  // Security
  dotfiles?: 'allow' | 'deny' | 'ignore'; // Hidden files handling
  index?: string[] | false; // Directory index files

  // SPA support
  spa?: boolean; // SPA fallback
  spaFile?: string; // SPA fallback file

  // Custom handlers
  setHeaders?: (res, path, stat) => void;
  onNotFound?: (req, res) => void;
  onError?: (err, req, res) => void;
  onServe?: (req, res, path, stat) => void;
  filter?: (path, stat) => boolean;

  // MIME types
  mimeTypes?: Record<string, string>;
  defaultMimeType?: string;
}
```
