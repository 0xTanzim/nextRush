# 📁 NextRush Static Files Guide

## 🎯 Overview

NextRush provides **enterprise-grade static file serving** with advanced features that rival production-level solutions. The static files system offers intelligent caching, compression, range requests, and security features out of the box.

## ✨ Key Features

- **🗜️ Smart Compression**: Automatic gzip/brotli compression with threshold control
- **💾 Intelligent Memory Caching**: LRU-based caching with automatic eviction
- **📡 Range Requests**: Support for partial content delivery and video streaming
- **🏷️ ETag Support**: Conditional requests for optimal browser caching
- **🔒 Security Headers**: Built-in protection against common attacks
- **🚀 High Performance**: Optimized for high-traffic production environments
- **📱 SPA Support**: Single Page Application routing with fallback
- **🎨 Flexible Headers**: Custom header configuration per file type

---

## 🚀 Quick Start

### Basic Static File Serving

```typescript
import { NextRushApp } from 'nextrush';

const app = new NextRushApp();

// 📁 Basic static file serving
app.static('/assets', './public');

// 🌐 Serve from multiple directories
app.static('/images', './uploads/images');
app.static('/docs', './documentation');

app.listen(3000);
```

### Express.js Compatibility

```typescript
// 📦 Works exactly like Express.js
app.use(express.static('public'));
app.use('/static', express.static('assets'));

// 🔄 Direct migration from Express
app.static('/public', './static');
```

---

## ⚙️ Advanced Configuration

### Professional Static Options

```typescript
interface StaticOptions {
  // 💾 Caching
  maxAge?: string | number; // Cache-Control max-age
  etag?: boolean; // Generate ETag headers
  immutable?: boolean; // Mark assets as immutable
  lastModified?: boolean; // Send Last-Modified headers

  // 🗜️ Compression
  compress?: boolean | 'gzip' | 'brotli' | 'auto';
  precompress?: boolean; // Look for .gz/.br files
  compressionCache?: boolean; // Cache compressed responses

  // 💾 Memory Caching
  memoryCache?: boolean; // Enable in-memory caching
  maxCacheSize?: number; // Maximum cache size in bytes
  maxFileSize?: number; // Max file size to cache

  // 📡 Range Requests
  acceptRanges?: boolean; // Support partial content

  // 🔒 Security
  dotfiles?: 'allow' | 'deny' | 'ignore';
  serveHidden?: boolean; // Serve hidden files
  caseSensitive?: boolean; // Path case sensitivity

  // 📂 Directory Options
  index?: string[] | false; // Directory index files
  extensions?: string[] | false; // File extensions to try
  redirect?: boolean; // Redirect to trailing slash

  // 📱 SPA Support
  spa?: boolean | string; // SPA fallback file

  // 🎨 Custom Headers
  setHeaders?: (res: Response, path: string, stat: Stats) => void;
}
```

### Production Configuration

```typescript
// 🏭 Production-ready configuration
app.static('/assets', './public', {
  // 🚀 Performance
  compression: 'auto', // Smart compression
  memoryCache: true, // Enable memory caching
  maxAge: '1y', // Long-term caching
  immutable: true, // Mark as immutable
  etag: true, // ETag support

  // 📡 Streaming
  acceptRanges: true, // Range requests

  // 🔒 Security
  dotfiles: 'ignore', // Hide sensitive files
  serveHidden: false, // No hidden files

  // 📊 Custom headers
  setHeaders: (res, path, stat) => {
    // 🎯 File-type specific caching
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }

    // 🔒 Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
  },
});
```

---

## 🗜️ Compression Features

### Smart Compression

```typescript
// 🎯 Automatic compression based on content type
app.static('/assets', './public', {
  compress: 'auto', // Choose best compression
  compressionCache: true, // Cache compressed files

  // 🔧 Advanced compression settings
  compression: {
    enabled: true,
    threshold: 1024, // Only compress files > 1KB
    algorithms: ['gzip', 'br'], // Use both gzip and brotli
    level: 6, // Compression level (1-9)
    memLevel: 8, // Memory level for gzip
  },
});
```

### Pre-compressed Files

```typescript
// 📦 Serve pre-compressed files
app.static('/assets', './public', {
  precompress: true, // Look for .gz and .br files
  compress: true, // Fallback to on-the-fly compression
});

// 📁 File structure:
// public/
//   ├── style.css
//   ├── style.css.gz     ← Pre-compressed gzip
//   ├── style.css.br     ← Pre-compressed brotli
//   └── app.js
```

### Compression Performance

```typescript
// 📊 Monitor compression performance
app.static('/assets', './public', {
  compress: true,
  onCompress: (filePath, originalSize, compressedSize, algorithm) => {
    const ratio = (
      ((originalSize - compressedSize) / originalSize) *
      100
    ).toFixed(1);
    console.log(
      `🗜️ Compressed ${filePath}: ${ratio}% reduction (${algorithm})`
    );
  },
});
```

---

## 💾 Caching Strategy

### Memory Caching

```typescript
// 🧠 Intelligent memory caching
app.static('/assets', './public', {
  memoryCache: true,
  maxCacheSize: 100 * 1024 * 1024, // 100MB cache
  maxFileSize: 2 * 1024 * 1024, // Cache files up to 2MB

  // 📊 Cache monitoring
  onCacheHit: (filePath) => {
    console.log(`⚡ Cache hit: ${filePath}`);
  },

  onCacheMiss: (filePath) => {
    console.log(`💾 Cache miss: ${filePath}`);
  },
});
```

### Conditional Requests

```typescript
// 🏷️ ETag and Last-Modified support
app.static('/files', './uploads', {
  etag: true, // Generate ETags
  lastModified: true, // Send Last-Modified headers

  // 🎯 Custom ETag generation
  setHeaders: (res, filePath, stat) => {
    const etag = `"${stat.mtime.getTime()}-${stat.size}"`;
    res.setHeader('ETag', etag);
  },
});
```

### Cache Control Headers

```typescript
// 🎯 Fine-grained cache control
app.static('/assets', './public', {
  setHeaders: (res, path, stat) => {
    if (path.endsWith('.html')) {
      // 📄 HTML files: no cache
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (path.match(/\.(css|js)$/)) {
      // 🎨 CSS/JS: medium-term cache
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    } else if (path.match(/\.(png|jpg|jpeg|gif|ico)$/)) {
      // 🖼️ Images: long-term cache
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
    }
  },
});
```

---

## 📡 Range Requests & Streaming

### Video Streaming Support

```typescript
// 🎬 Optimized for video streaming
app.static('/videos', './media', {
  acceptRanges: true, // Enable range requests
  maxFileSize: 0, // Don't cache large files

  setHeaders: (res, path, stat) => {
    if (isVideoFile(path)) {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', getVideoMimeType(path));
    }
  },
});

function isVideoFile(path: string): boolean {
  return /\.(mp4|webm|ogg|avi|mov)$/i.test(path);
}

function getVideoMimeType(path: string): string {
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

### Progressive Download

```typescript
// 📱 Progressive download for mobile
app.static('/downloads', './files', {
  acceptRanges: true,

  // 📊 Monitor download progress
  onRangeRequest: (req, res, filePath, range) => {
    console.log(`📡 Range request: ${filePath} [${range.start}-${range.end}]`);
  },
});
```

---

## 🔒 Security Features

### Path Security

```typescript
// 🛡️ Secure file serving
app.static('/files', './uploads', {
  dotfiles: 'deny', // Block .env, .git files
  serveHidden: false, // No hidden files
  caseSensitive: true, // Case-sensitive paths

  // 🔍 Custom path validation
  pathValidator: (path: string) => {
    // ❌ Block dangerous paths
    if (path.includes('..')) return false;
    if (path.includes('passwd')) return false;
    if (path.startsWith('/etc/')) return false;
    return true;
  },
});
```

### Security Headers

```typescript
// 🔒 Security-first configuration
app.static('/assets', './public', {
  setHeaders: (res, path, stat) => {
    // 🛡️ Content security
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // 📄 Force download for certain files
    if (path.endsWith('.pdf')) {
      res.setHeader('Content-Disposition', 'attachment');
    }

    // 🚫 Prevent caching of sensitive files
    if (path.includes('private')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  },
});
```

---

## 📱 Single Page Application (SPA) Support

### Basic SPA Routing

```typescript
// 🌐 SPA with fallback to index.html
app.static('/', './dist', {
  spa: true, // Enable SPA mode
  index: ['index.html'], // Fallback file
});

// 🎯 Custom SPA fallback
app.static('/', './build', {
  spa: 'app.html', // Custom fallback file
});
```

### Advanced SPA Configuration

```typescript
// 🚀 Production SPA setup
app.static('/', './dist', {
  spa: true,

  // 📄 Different caching for app shell vs assets
  setHeaders: (res, path, stat) => {
    if (path === '/index.html' || path.endsWith('/index.html')) {
      // 🔄 App shell: no cache
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      // 📦 Assets: long-term cache
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
});
```

### SPA with API Routes

```typescript
// 🌐 SPA with API protection
app.static('/', './dist', {
  spa: true,

  // 🛡️ Don't serve SPA for API routes
  spaFilter: (path: string) => {
    return !path.startsWith('/api/');
  },
});

// 🔗 API routes
app.get('/api/*', (req, res) => {
  res.json({ error: 'API endpoint not found' });
});
```

---

## 📊 Performance Monitoring

### Basic Performance Tracking

```typescript
// 📈 Monitor static file performance
app.static('/assets', './public', {
  compression: true,
  memoryCache: true,
  maxAge: '1y',

  // 📊 Performance monitoring
  onServe: (req, res, filePath, stat) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const size = stat.size;
      const compression = res.getHeader('Content-Encoding');

      console.log(`📁 Static file served: ${filePath}`, {
        duration: `${duration}ms`,
        size: `${(size / 1024).toFixed(2)}KB`,
        compression: compression || 'none',
        cached: res.getHeader('X-Cache') === 'HIT',
      });
    });
  },
});
```

### Advanced Metrics Collection

```typescript
// 📊 Comprehensive metrics
const staticMetrics = {
  requests: 0,
  cacheHits: 0,
  compressionRatio: 0,
  averageResponseTime: 0,
};

app.static('/assets', './public', {
  compress: true,
  memoryCache: true,

  onServe: (req, res, filePath, stat) => {
    staticMetrics.requests++;

    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to ms

      // 📈 Update metrics
      staticMetrics.averageResponseTime =
        (staticMetrics.averageResponseTime + duration) / 2;

      if (res.getHeader('X-Cache') === 'HIT') {
        staticMetrics.cacheHits++;
      }
    });
  },
});

// 📊 Metrics endpoint
app.get('/metrics/static', (req, res) => {
  res.json({
    ...staticMetrics,
    cacheHitRate:
      ((staticMetrics.cacheHits / staticMetrics.requests) * 100).toFixed(2) +
      '%',
  });
});
```

---

## 🛠️ Development vs Production

### Development Configuration

```typescript
// 🧪 Development-friendly settings
if (process.env.NODE_ENV === 'development') {
  app.static('/assets', './src/assets', {
    maxAge: 0, // No caching
    etag: false, // Disable ETags
    compress: false, // No compression
    hotReload: true, // Watch for changes

    setHeaders: (res, path) => {
      res.setHeader('Cache-Control', 'no-cache, no-store');
    },
  });
}
```

### Production Optimization

```typescript
// 🏭 Production optimization
if (process.env.NODE_ENV === 'production') {
  app.static('/assets', './dist/assets', {
    maxAge: '1y', // Long-term caching
    immutable: true, // Mark as immutable
    compress: 'auto', // Smart compression
    memoryCache: true, // Enable caching
    precompress: true, // Use pre-compressed files

    setHeaders: (res, path) => {
      if (path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  });
}
```

---

## 🎯 Common Use Cases

### 📸 Image Gallery

```typescript
// 🖼️ Optimized image serving
app.static('/gallery', './images', {
  compress: false, // Images are already compressed
  acceptRanges: true, // Progressive loading
  maxAge: '30d', // Medium-term cache

  setHeaders: (res, path, stat) => {
    // 🎯 Image-specific headers
    if (path.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      res.setHeader('Content-Type', getImageMimeType(path));

      // 📱 Responsive images
      if (path.includes('@2x')) {
        res.setHeader('X-Image-Density', '2');
      }
    }
  },
});
```

### 📚 Documentation Site

```typescript
// 📖 Documentation with search-friendly URLs
app.static('/docs', './documentation', {
  spa: true, // SPA routing
  index: ['index.html'],
  extensions: ['html'], // Try .html extension

  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      // 🔍 SEO-friendly caching
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
    }
  },
});
```

### 🎬 Video Streaming

```typescript
// 🎥 Professional video streaming
app.static('/stream', './videos', {
  acceptRanges: true, // Essential for video
  maxFileSize: 0, // Never cache large files
  compress: false, // Videos are pre-compressed

  setHeaders: (res, path, stat) => {
    if (isVideoFile(path)) {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', getVideoMimeType(path));

      // 🎬 Video-specific headers
      res.setHeader('X-Content-Duration', getVideoDuration(path));
    }
  },
});
```

---

## 🔧 Configuration Reference

### Complete Options Interface

```typescript
interface EnhancedStaticOptions {
  // 💾 Basic Caching
  maxAge?: string | number; // Cache-Control max-age (default: '1d')
  etag?: boolean; // Generate ETag headers (default: true)
  immutable?: boolean; // Mark as immutable (default: false)
  lastModified?: boolean; // Send Last-Modified (default: true)

  // 🗜️ Compression
  compress?: boolean | 'gzip' | 'brotli' | 'auto'; // Compression type
  precompress?: boolean; // Look for pre-compressed files
  compressionCache?: boolean; // Cache compressed responses

  // 💾 Memory Caching
  memoryCache?: boolean; // Enable memory cache (default: true)
  maxCacheSize?: number; // Max cache size (default: 50MB)
  maxFileSize?: number; // Max file size to cache (default: 1MB)

  // 📡 Range Requests
  acceptRanges?: boolean; // Support range requests (default: true)

  // 🔒 Security
  dotfiles?: 'allow' | 'deny' | 'ignore'; // Hidden files (default: 'ignore')
  serveHidden?: boolean; // Serve hidden files (default: false)
  caseSensitive?: boolean; // Case sensitivity (default: true)

  // 📂 Directory
  index?: string[] | false; // Index files (default: ['index.html'])
  extensions?: string[] | false; // Extensions to try (default: false)
  redirect?: boolean; // Redirect trailing slash (default: true)

  // 📱 SPA
  spa?: boolean | string; // SPA fallback (default: false)

  // 🎨 Headers
  setHeaders?: (res: Response, path: string, stat: Stats) => void;
  cacheControl?: string; // Custom Cache-Control header
}
```

### MIME Type Support

```typescript
// 📋 Built-in MIME types
const supportedTypes = {
  // 📄 Text
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.md': 'text/markdown',

  // 🖼️ Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',

  // 🎬 Media
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',

  // 🔤 Fonts
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',

  // 📦 Archives
  '.zip': 'application/zip',
  '.pdf': 'application/pdf',
};
```

---

## 🎯 Best Practices

### ✅ Performance Best Practices

1. **🎯 Use appropriate cache headers** for different file types
2. **🗜️ Enable compression** for text-based assets (HTML, CSS, JS)
3. **💾 Use immutable cache** for versioned assets with hashes
4. **📡 Enable range requests** for large media files
5. **🧠 Configure memory cache** based on available RAM
6. **📊 Monitor cache hit rates** and adjust cache sizes accordingly

### ✅ Security Best Practices

1. **🔒 Hide sensitive files** using `dotfiles: 'deny'`
2. **🛡️ Set security headers** for all responses
3. **🔍 Validate file paths** to prevent directory traversal
4. **📄 Force download** for potentially dangerous file types
5. **🚫 Use appropriate CSP headers** for content protection

### ✅ Production Optimization

1. **🏭 Pre-compress** static assets during build
2. **📦 Use a CDN** for global content distribution
3. **📊 Monitor performance metrics** in production
4. **🔄 Implement proper cache invalidation** strategies
5. **⚡ Optimize file sizes** before serving

---

## 🚨 Troubleshooting

### Common Issues

#### Cache Not Working

````typescript
### Common Issues

#### Cache Not Working

```typescript
// ❌ Problem: Files not being cached
app.static('/assets', './public', {
  maxAge: 0,                        // 👈 This disables caching
});

// ✅ Solution: Set appropriate maxAge
app.static('/assets', './public', {
  maxAge: '1d',                     // 👈 Enable 1-day cache
});
````

#### Compression Not Applied

```typescript
// ❌ Problem: Large files not compressed
app.static('/assets', './public', {
  compress: true,
  compressionThreshold: 100, // 👈 Too low threshold
});

// ✅ Solution: Adjust threshold
app.static('/assets', './public', {
  compress: true,
  compressionThreshold: 1024, // 👈 Compress files > 1KB
});
```

#### Range Requests Failing

```typescript
// ❌ Problem: Video streaming not working
app.static('/videos', './media', {
  acceptRanges: false, // 👈 Range requests disabled
});

// ✅ Solution: Enable range requests
app.static('/videos', './media', {
  acceptRanges: true, // 👈 Enable for streaming
  maxFileSize: 0, // 👈 Don't cache large files
});
```

````

#### Compression Not Applied
```typescript
// ❌ Problem: Large files not compressed
app.static('/assets', './public', {
  compress: true,
  compressionThreshold: 100,        // 👈 Too low threshold
});

// ✅ Solution: Adjust threshold
app.static('/assets', './public', {
  compress: true,
  compressionThreshold: 1024,       // 👈 Compress files > 1KB
});
````

#### Range Requests Failing

```typescript
// ❌ Problem: Video streaming not working
app.static('/videos', './media', {
  acceptRanges: false, // 👈 Range requests disabled
});

// ✅ Solution: Enable range requests
app.static('/videos', './media', {
  acceptRanges: true, // 👈 Enable for streaming
  maxFileSize: 0, // 👈 Don't cache large files
});
```

---

## 🔮 What's Next?

Explore these related NextRush features:

- **[🛡️ Security Guide](./SECURITY.md)** - Advanced security features
- **[📊 Metrics & Monitoring](./METRICS-MONITORING.md)** - Performance tracking
- **[🔌 Plugin Development](./Plugins.md)** - Creating custom plugins
- **[⚡ Performance Optimization](./PERFORMANCE-ANALYSIS.md)** - Speed optimization

---

> **NextRush Static Files - Enterprise-grade static file serving with modern features! 📁✨**
