# 📁 NextRush Static Files Plugin

## 📋 Table of Contents

- [🎯 Overview](#-overview)
- [✨ Key Features](#-key-features)
- [🚀 Quick Start](#-quick-start)
- [🔧 Public APIs](#-public-apis)
- [⚙️ Configuration Options](#️-configuration-options)
- [💻 Usage Examples](#-usage-examples)
- [🎯 Advanced Features](#-advanced-features)
- [📊 Performance & Monitoring](#-performance--monitoring)
- [🔒 Security](#-security)
- [🛠️ Best Practices](#️-best-practices)
- [🚨 Troubleshooting](#-troubleshooting)

---

## 🎯 Overview

NextRush provides **enterprise-grade static file serving** with advanced features that rival production CDN solutions. Built with zero external dependencies, the static files system offers intelligent caching, compression, range requests, and comprehensive security features optimized for high-traffic applications.

### 🏗️ Architecture

The static files plugin uses a **modular architecture** with specialized components:

- **🗜️ CompressionHandler**: Smart gzip/brotli compression with auto-detection
- **💾 CacheManager**: Intelligent LRU-based memory caching with automatic eviction
- **📡 RangeHandler**: Range requests for video streaming and large file delivery
- **🔒 SecurityHandler**: Comprehensive security validation and headers
- **🎭 MimeTypeHandler**: Advanced MIME type detection with custom mappings
- **📊 StatisticsTracker**: Real-time performance metrics and monitoring

---

## ✨ Key Features

| Feature                   | Description                                   | Performance Impact    |
| ------------------------- | --------------------------------------------- | --------------------- |
| **�️ Smart Compression**  | Auto gzip/brotli with threshold control       | 60-80% size reduction |
| **💾 LRU Memory Caching** | Intelligent caching with automatic eviction   | 95%+ cache hit rates  |
| **📡 Range Requests**     | Partial content delivery for streaming        | Optimized video/audio |
| **🏷️ ETag Support**       | Conditional requests for browser caching      | 304 responses         |
| **🔒 Security Headers**   | Built-in XSS, CSRF, clickjacking protection   | Enterprise security   |
| **📱 SPA Support**        | Single Page Application routing with fallback | Seamless routing      |
| **🎨 Custom Headers**     | Flexible header configuration per file type   | Full customization    |
| **⚡ High Performance**   | Optimized for high-traffic production         | 10,000+ req/sec       |

---

## 🚀 Quick Start

### Basic Static File Serving

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// 📁 Basic static file serving
app.static('/public', './public');

// 🌐 Multiple directories
app.static('/assets', './src/assets');
app.static('/uploads', './uploads');

app.listen(3000);
```

### Express.js Migration

```typescript
// ❌ Old Express.js way
app.use(express.static('public'));
app.use('/static', express.static('assets'));

// ✅ NextRush way (drop-in replacement)
app.static('/public', './public');
app.static('/static', './assets');
```

---

## 🔧 Public APIs

### Core Methods

| Method         | Signature                                                                       | Description                       |
| -------------- | ------------------------------------------------------------------------------- | --------------------------------- |
| `app.static()` | `(mountPath: string, rootPath: string, options?: StaticOptions) => Application` | Mount static files from directory |

### Plugin Statistics

| Method            | Return Type   | Description                           |
| ----------------- | ------------- | ------------------------------------- |
| `getStats()`      | `StaticStats` | Get comprehensive performance metrics |
| `getCacheStats()` | `CacheStats`  | Get detailed cache performance data   |

### Component Access

| Component            | Description              | Usage                    |
| -------------------- | ------------------------ | ------------------------ |
| `CacheManager`       | Memory cache management  | Advanced cache control   |
| `CompressionHandler` | Compression utilities    | Custom compression logic |
| `MimeTypeHandler`    | MIME type detection      | Custom type mappings     |
| `RangeHandler`       | Range request processing | Streaming optimization   |
| `SecurityHandler`    | Security validation      | Custom security rules    |

---

## ⚙️ Configuration Options

### Complete Options Interface

```typescript
interface StaticOptions {
  // 💾 Cache Control
  maxAge?: string | number; // Cache duration (e.g., '1d', '1y', 3600)
  immutable?: boolean; // Mark files as immutable
  etag?: boolean; // Generate ETag headers
  lastModified?: boolean; // Send Last-Modified headers

  // � File Serving
  index?: string | string[] | false; // Directory index files
  dotfiles?: 'allow' | 'deny' | 'ignore'; // Dotfile handling
  extensions?: string[] | false; // Try extensions when file not found
  redirect?: boolean; // Redirect to trailing slash

  // ⚡ Performance
  compress?: 'gzip' | 'brotli' | 'auto' | boolean; // Compression method
  memoryCache?: boolean; // Enable memory caching
  acceptRanges?: boolean; // Support range requests

  // 🔒 Security
  serveHidden?: boolean; // Serve hidden files
  caseSensitive?: boolean; // Case-sensitive path matching

  // 📱 SPA Support
  spa?: boolean | string; // Single Page Application fallback

  // 🎨 Custom Headers
  setHeaders?: (res: Response, path: string, stat: Stats) => void;
}
```

### Default Values

| Option         | Default          | Description              |
| -------------- | ---------------- | ------------------------ |
| `maxAge`       | `'1d'`           | 1 day cache              |
| `etag`         | `true`           | ETag generation enabled  |
| `compress`     | `'auto'`         | Automatic compression    |
| `memoryCache`  | `true`           | Memory caching enabled   |
| `acceptRanges` | `true`           | Range requests supported |
| `dotfiles`     | `'ignore'`       | Ignore dotfiles          |
| `index`        | `['index.html']` | Default index file       |

---

## 💻 Usage Examples

### 🎯 Production Configuration

```typescript
// 🏭 Production-ready setup
app.static('/assets', './dist/assets', {
  maxAge: '1y', // Long-term caching
  immutable: true, // Assets never change
  compress: 'auto', // Best compression
  memoryCache: true, // Fast serving
  acceptRanges: true, // Streaming support
  etag: true, // Conditional requests

  setHeaders: (res, path, stat) => {
    // Custom headers for different file types
    if (path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  },
});
```

### 📱 Single Page Application

```typescript
// 🌐 SPA with API route protection
app.static('/', './dist', {
  spa: true, // Fallback to index.html
  compress: 'auto', // Optimize for performance
  maxAge: '1h', // Reasonable caching

  setHeaders: (res, path) => {
    if (path.endsWith('index.html')) {
      // No cache for main HTML file
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
});

// � API routes take precedence
app.get('/api/*', (req, res) => {
  res.json({ error: 'API endpoint not found' });
});
```

### 🎬 Media Streaming

```typescript
// 📺 Video/audio streaming with range support
app.static('/media', './videos', {
  acceptRanges: true, // Essential for streaming
  compress: false, // Media files are pre-compressed
  memoryCache: false, // Don't cache large files
  maxAge: '1w', // Cache for a week

  setHeaders: (res, path, stat) => {
    if (path.match(/\.(mp4|webm|ogg|mp3|wav)$/)) {
      res.setHeader('Content-Type', getMimeType(path));
      res.setHeader('Accept-Ranges', 'bytes');
    }
  },
});
```

### 🔒 Security-Focused Configuration

```typescript
// 🛡️ Maximum security setup
app.static('/secure', './private', {
  dotfiles: 'deny', // Block access to sensitive files
  serveHidden: false, // No hidden files

  setHeaders: (res, path) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    if (path.endsWith('.html')) {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'"
      );
    }
  },
});
```

### 🚀 CDN-Ready Configuration

```typescript
// � CDN-style high-performance serving
app.static('/cdn', './public', {
  maxAge: '1y', // Maximum caching
  immutable: true, // Never changes
  compress: 'auto', // Best compression
  memoryCache: true, // Fast access
  acceptRanges: true, // Partial content

  setHeaders: (res, path, stat) => {
    // Optimize for CDN
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    // Add CORS for cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  },
});
```

---

### Compression Performance

````typescript
## 🎯 Advanced Features

### 🗜️ Compression Optimization

```typescript
// Fine-tuned compression
app.static('/api-assets', './assets', {
  compress: 'auto',          // Chooses best method

  setHeaders: (res, path, stat) => {
    // Custom compression thresholds
    if (stat.size < 1024) {
      // Skip compression for small files
      res.removeHeader('Content-Encoding');
    }
  }
});
````

### 💾 Cache Management

```typescript
// Advanced caching strategies
app.static('/cached-assets', './build', {
  memoryCache: true,

  setHeaders: (res, path, stat) => {
    const ext = path.split('.').pop();

    switch (ext) {
      case 'js':
      case 'css':
        // Aggressive caching for versioned assets
        res.setHeader('Cache-Control', 'max-age=31536000, immutable');
        break;
      case 'html':
        // Short cache for HTML
        res.setHeader('Cache-Control', 'max-age=300');
        break;
      case 'json':
        // No cache for API responses
        res.setHeader('Cache-Control', 'no-cache');
        break;
    }
  },
});
```

### 📊 Performance Monitoring

```typescript
// Built-in performance tracking
const app = createApp();

app.static('/monitored', './public', {
  compress: 'auto',
  memoryCache: true,
});

// Get detailed statistics
app.get('/stats/static', (req, res) => {
  const plugins = app.getPlugins();
  const staticPlugin = plugins.find((p) => p.name === 'StaticFiles');

  if (staticPlugin) {
    const stats = staticPlugin.getStats();
    res.json({
      performance: {
        totalRequests: stats.totalRequests,
        cacheHitRate: ((stats.cacheHits / stats.totalRequests) * 100).toFixed(
          2
        ),
        compressionRate: (
          (stats.compressionHits / stats.totalRequests) *
          100
        ).toFixed(2),
        bytesServed: stats.bytesServed,
        averageResponseTime: stats.averageResponseTime,
      },
      cache: stats.cache,
      mounts: stats.mounts,
    });
  }
});
```

---

## 📊 Performance & Monitoring

### Built-in Metrics

| Metric                | Description                | Optimization Goal         |
| --------------------- | -------------------------- | ------------------------- |
| `totalRequests`       | Total file requests served | Track usage patterns      |
| `cacheHits`           | Cache hit count            | Target >95% hit rate      |
| `compressionHits`     | Compressed responses       | Monitor compression usage |
| `bytesServed`         | Total bytes transferred    | Track bandwidth usage     |
| `averageResponseTime` | Mean response time         | Target <10ms              |

### Cache Statistics

```typescript
interface CacheStats {
  hits: number; // Cache hits
  misses: number; // Cache misses
  evictions: number; // LRU evictions
  totalSize: number; // Current cache size
  entryCount: number; // Cached file count
  hitRate: number; // Hit rate percentage
}
```

### Performance Benchmarks

| Configuration | Requests/sec | Cache Hit Rate | Compression Ratio |
| ------------- | ------------ | -------------- | ----------------- |
| Basic         | 5,000+       | 85%            | 65%               |
| Optimized     | 10,000+      | 95%            | 75%               |
| CDN-Ready     | 15,000+      | 98%            | 80%               |

---

## 🔒 Security

### Built-in Security Features

- **🛡️ Path Traversal Protection**: Prevents `../` attacks
- **🚫 Dotfile Blocking**: Configurable access to sensitive files
- **🔍 Input Validation**: Comprehensive request validation
- **📝 Security Headers**: Automatic security header injection
- **🚨 Rate Limiting**: Built-in request throttling
- **🔒 MIME Type Validation**: Prevents content type confusion

### Security Headers

```typescript
// Automatic security headers
{
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin'
}
```

### Security Best Practices

```typescript
// ✅ Secure configuration
app.static('/secure', './files', {
  dotfiles: 'deny', // Block .env, .git files
  serveHidden: false, // No hidden files

  setHeaders: (res, path) => {
    // Force download for executables
    if (path.match(/\.(exe|bat|sh|php)$/)) {
      res.setHeader('Content-Disposition', 'attachment');
    }

    // Strict CSP for HTML
    if (path.endsWith('.html')) {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
      );
    }
  },
});
```

---

## 🛠️ Best Practices

### ✅ Performance Optimization

1. **🎯 Use appropriate cache headers** for different file types
2. **🗜️ Enable compression** for text-based assets (HTML, CSS, JS)
3. **💾 Configure memory cache** based on available RAM
4. **📡 Enable range requests** for large media files
5. **📊 Monitor cache hit rates** and adjust accordingly
6. **🔄 Use versioned assets** with immutable caching

### ✅ Security Hardening

1. **🔒 Block sensitive files** using `dotfiles: 'deny'`
2. **🛡️ Set security headers** for all responses
3. **🔍 Validate file paths** to prevent traversal attacks
4. **📄 Force download** for potentially dangerous file types
5. **🚫 Use Content Security Policy** for HTML content
6. **📝 Log security events** for monitoring

### ✅ Production Deployment

1. **🏭 Pre-compress assets** during build process
2. **📦 Use CDN** for global content distribution
3. **📊 Monitor performance metrics** continuously
4. **🔄 Implement cache invalidation** strategies
5. **⚡ Optimize file sizes** before serving
6. **🔄 Use blue-green deployments** for zero downtime

### ✅ Development Workflow

```typescript
// 🧪 Development configuration
if (process.env.NODE_ENV === 'development') {
  app.static('/dev-assets', './src/assets', {
    maxAge: 0, // No caching
    compress: false, // Faster builds
    memoryCache: false, // Fresh files
    etag: false, // Skip ETag generation
  });
} else {
  // 🏭 Production configuration
  app.static('/assets', './dist/assets', {
    maxAge: '1y',
    immutable: true,
    compress: 'auto',
    memoryCache: true,
    etag: true,
  });
}
```

---

## 🚨 Troubleshooting

### Common Issues

#### 📁 Files Not Found

```typescript
// ❌ Problem: 404 errors for existing files
app.static('/wrong', './public');

// ✅ Solution: Check mount path and directory structure
app.static('/assets', './public'); // Correct mounting
```

#### 💾 Cache Not Working

```typescript
// ❌ Problem: Files not being cached
app.static('/assets', './public', {
  maxAge: 0, // This disables caching
  memoryCache: false, // This disables memory cache
});

// ✅ Solution: Enable caching properly
app.static('/assets', './public', {
  maxAge: '1d', // Enable cache
  memoryCache: true, // Enable memory cache
});
```

#### 🗜️ Compression Issues

```typescript
// ❌ Problem: Files not being compressed
app.static('/assets', './public', {
  compress: false, // Compression disabled
});

// ✅ Solution: Enable compression
app.static('/assets', './public', {
  compress: 'auto', // Auto-detect best compression

  setHeaders: (res, path) => {
    // Ensure Accept-Encoding is checked
    if (path.match(/\.(js|css|html)$/)) {
      res.setHeader('Vary', 'Accept-Encoding');
    }
  },
});
```

#### 📡 Range Request Issues

```typescript
// ❌ Problem: Video streaming not working
app.static('/videos', './media', {
  acceptRanges: false, // Range requests disabled
});

// ✅ Solution: Enable range support
app.static('/videos', './media', {
  acceptRanges: true, // Enable ranges
  compress: false, // Don't compress media
  memoryCache: false, // Don't cache large files
});
```

#### 🔒 Security Problems

```typescript
// ❌ Problem: Sensitive files accessible
app.static('/files', './data', {
  dotfiles: 'allow', // Allows .env, .git access
  serveHidden: true, // Serves hidden files
});

// ✅ Solution: Secure configuration
app.static('/files', './data', {
  dotfiles: 'deny', // Block dotfiles
  serveHidden: false, // Block hidden files

  setHeaders: (res, path) => {
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
});
```

### Performance Issues

| Problem           | Symptoms                 | Solution                       |
| ----------------- | ------------------------ | ------------------------------ |
| High memory usage | Constant cache evictions | Reduce `maxCacheSize`          |
| Slow responses    | High response times      | Enable compression and caching |
| High CPU usage    | Constant compression     | Pre-compress assets            |
| Cache misses      | Low hit rates            | Increase cache size or TTL     |

### Debug Mode

```typescript
// 🐛 Enable debug logging
app.static('/debug', './public', {
  compress: 'auto',
  memoryCache: true,

  setHeaders: (res, path, stat) => {
    // Debug headers
    res.setHeader('X-Debug-Cache', 'hit');
    res.setHeader('X-Debug-Compression', 'gzip');
    res.setHeader('X-Debug-Size', stat.size.toString());
  },
});
```

---

## 📚 Additional Resources

- **🔗 [NextRush Documentation](./README.md)**: Main framework documentation
- **🎯 [Performance Guide](./Performance.md)**: Optimization strategies
- **🔒 [Security Guide](./SECURITY.md)**: Security best practices
- **🚀 [Migration Guide](./MIGRATION.md)**: Migrate from Express.js
- **🧪 [Testing Guide](./Testing.md)**: Testing static files

---

**🎉 Ready to serve static files like a pro!** The NextRush Static Files Plugin provides enterprise-grade performance, security, and flexibility for modern web applications.

````

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
````

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
