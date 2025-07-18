# 📁 NextRush Enhanced Static Files Guide

## 🎯 Overview

NextRush provides professional-grade static file serving with advanced features that rival enterprise-level solutions. The enhanced static files plugin offers intelligent caching, compression, range requests, and security features out of the box.

## ✨ Key Features

- **🗜️ Smart Compression**: Automatic gzip/brotli compression
- **💾 Intelligent Caching**: Memory caching with automatic eviction
- **📡 Range Requests**: Support for partial content delivery
- **🏷️ ETag Support**: Conditional requests for optimal caching
- **🔒 Security Headers**: Built-in security best practices
- **🚀 Performance**: Optimized for high-traffic applications
- **📱 SPA Support**: Single Page Application routing
- **🎯 Custom Headers**: Flexible header configuration

## 🚀 Quick Start

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Basic static file serving
app.static('/assets', './public');

// Enhanced static file serving
app.static('/assets', './public', {
  maxAge: '1y',
  compress: 'auto',
  etag: true,
  immutable: true,
});

app.listen(3000);
```

## 🔧 Configuration Options

### Basic Options

```typescript
app.static('/assets', './public', {
  // Cache control
  maxAge: '1y', // Cache duration (string or number in ms)
  immutable: true, // Mark assets as immutable
  etag: true, // Enable ETag headers
  lastModified: true, // Enable Last-Modified headers

  // File serving
  index: ['index.html'], // Index files to serve
  dotfiles: 'ignore', // How to handle dotfiles
  extensions: false, // Try file extensions
  redirect: true, // Redirect to add trailing slash

  // SPA support
  spa: false, // Single Page Application mode
});
```

### Advanced Options

```typescript
app.static('/assets', './public', {
  // Compression
  compress: 'auto', // 'gzip', 'brotli', 'auto', or false
  precompress: true, // Look for pre-compressed files

  // Performance
  memoryCache: true, // Enable memory caching
  maxCacheSize: 50 * 1024 * 1024, // 50MB cache limit
  maxFileSize: 1024 * 1024, // 1MB max file for memory cache
  acceptRanges: true, // Enable range requests

  // Security
  serveHidden: false, // Serve hidden files
  caseSensitive: true, // Case sensitive file matching

  // Custom headers
  setHeaders: (res, path, stat) => {
    if (path.endsWith('.pdf')) {
      res.setHeader('Content-Disposition', 'attachment');
    }
  },
});
```

## 🗜️ Compression Features

### Automatic Compression

```typescript
// Auto-detect best compression
app.static('/js', './dist/js', {
  compress: 'auto', // Chooses between gzip/brotli
  immutable: true,
  maxAge: '1y',
});

// Force specific compression
app.static('/css', './dist/css', {
  compress: 'brotli', // Force brotli compression
  immutable: true,
  maxAge: '1y',
});

// Disable compression for media files
app.static('/images', './assets/images', {
  compress: false, // No compression for images
  maxAge: '30d',
});
```

### Pre-compressed Files

```typescript
// Look for .gz and .br files first
app.static('/assets', './public', {
  precompress: true, // Look for file.js.gz, file.js.br
  compress: 'auto', // Fallback to runtime compression
  maxAge: '1y',
});
```

## 💾 Caching Strategy

### Memory Caching

```typescript
// Intelligent memory caching
app.static('/assets', './public', {
  memoryCache: true,
  maxCacheSize: 100 * 1024 * 1024, // 100MB cache
  maxFileSize: 2 * 1024 * 1024, // Cache files up to 2MB

  // Cache control headers
  maxAge: '1y',
  immutable: true,
  etag: true,
});
```

### Conditional Requests

```typescript
// ETag and Last-Modified support
app.static('/api/files', './uploads', {
  etag: true, // Generate ETags
  lastModified: true, // Send Last-Modified headers

  // Custom ETag generation
  setHeaders: (res, filePath, stat) => {
    const etag = `"${stat.mtime.getTime()}-${stat.size}"`;
    res.setHeader('ETag', etag);
  },
});
```

## 📡 Range Requests

### Streaming Large Files

```typescript
// Enable range requests for video streaming
app.static('/videos', './media', {
  acceptRanges: true, // Enable range requests
  memoryCache: false, // Don't cache large files in memory
  maxFileSize: 0, // Stream all files

  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
    }
  },
});
```

### Download Support

```typescript
// Force downloads with proper headers
app.static('/downloads', './files', {
  setHeaders: (res, filePath, stat) => {
    const filename = path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stat.size.toString());
  },
});
```

## 🏗️ Production Configurations

### CDN-Ready Setup

```typescript
// Optimized for CDN distribution
app.static('/assets', './dist', {
  maxAge: '1y',
  immutable: true,
  compress: 'auto',
  etag: true,

  setHeaders: (res, filePath) => {
    // Set CORS for CDN
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Cache bust on file change
    if (filePath.includes('/js/') || filePath.includes('/css/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
});
```

### High-Traffic Configuration

```typescript
// Optimized for high traffic
app.static('/public', './public', {
  // Aggressive caching
  memoryCache: true,
  maxCacheSize: 200 * 1024 * 1024, // 200MB cache

  // Compression
  compress: 'auto',
  precompress: true,

  // Performance
  acceptRanges: true,
  etag: true,

  // Security
  dotfiles: 'deny',
  serveHidden: false,

  setHeaders: (res, filePath) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
  },
});
```

## 📱 SPA (Single Page Application) Support

```typescript
// SPA with client-side routing
app.static('/', './dist', {
  spa: true, // Enable SPA mode
  index: 'index.html', // Fallback file
  maxAge: '1h', // Short cache for HTML

  setHeaders: (res, filePath) => {
    // Don't cache HTML files
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  },
});

// API routes (served before static files)
app.get('/api/*', (req, res) => {
  res.json({ api: 'endpoint' });
});
```

## 🔒 Security Features

### Secure File Serving

```typescript
app.static('/secure', './private', {
  // Security options
  dotfiles: 'deny', // Block hidden files
  serveHidden: false, // Don't serve hidden files
  caseSensitive: true, // Case sensitive paths

  setHeaders: (res, filePath, stat) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Prevent caching of sensitive files
    if (filePath.includes('private')) {
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
    }
  },
});
```

### Content Type Security

```typescript
app.static('/uploads', './uploads', {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();

    // Force download for executable files
    if (['.exe', '.bat', '.cmd', '.sh'].includes(ext)) {
      res.setHeader('Content-Disposition', 'attachment');
      res.setHeader('Content-Type', 'application/octet-stream');
    }

    // Sandbox PDFs
    if (ext === '.pdf') {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'unsafe-inline'"
      );
    }
  },
});
```

## 🎯 Advanced Use Cases

### Multi-Environment Setup

```typescript
const isProduction = process.env.NODE_ENV === 'production';

app.static('/assets', './public', {
  maxAge: isProduction ? '1y' : '0',
  compress: isProduction ? 'auto' : false,
  memoryCache: isProduction,
  etag: isProduction,

  setHeaders: (res, filePath) => {
    if (isProduction) {
      res.setHeader('X-Served-By', 'NextRush-Static');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
});
```

### Version-Based Caching

```typescript
app.static('/v1/assets', './public/v1', {
  maxAge: '1y',
  immutable: true,
  compress: 'auto',

  setHeaders: (res, filePath) => {
    // Version-based cache busting
    const version = process.env.APP_VERSION || '1.0.0';
    res.setHeader('X-App-Version', version);
    res.setHeader('Cache-Control', `public, max-age=31536000, immutable`);
  },
});
```

### Conditional File Serving

```typescript
app.static('/premium', './premium-content', {
  setHeaders: (res, filePath, stat) => {
    // This would typically check authentication
    // For demo purposes, just add headers
    res.setHeader('X-Premium-Content', 'true');
    res.setHeader('Cache-Control', 'private, max-age=3600');
  },
});
```

## 📊 Performance Monitoring

### Built-in Metrics

```typescript
// Monitor static file performance
app.on('staticFile:served', (data) => {
  console.log(
    `Served: ${data.filePath} (${data.size} bytes, ${data.responseTime}ms)`
  );

  // Track slow file serving
  if (data.responseTime > 100) {
    console.warn(`Slow file serve: ${data.filePath}`);
  }
});

app.on('staticFile:cached', (data) => {
  console.log(`Cache hit: ${data.filePath}`);
});
```

### Custom Monitoring

```typescript
app.static('/monitored', './public', {
  setHeaders: (res, filePath, stat) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const responseTime = Date.now() - startTime;

      // Log performance data
      console.log({
        file: filePath,
        size: stat.size,
        responseTime,
        statusCode: res.statusCode,
      });
    });
  },
});
```

## 🎯 Best Practices

1. **Use appropriate cache headers** for different file types
2. **Enable compression** for text-based assets
3. **Use immutable cache** for versioned assets
4. **Implement proper security headers** for sensitive content
5. **Monitor file serving performance** in production
6. **Use range requests** for large media files
7. **Configure SPA routing** correctly for client-side apps

## ⚡ Performance Tips

- Enable memory caching for frequently accessed files
- Use appropriate compression for different content types
- Set long cache times for immutable assets
- Implement proper ETag headers for conditional requests
- Monitor cache hit rates and adjust cache sizes
- Use CDN for global content distribution

The enhanced static files plugin in NextRush provides enterprise-grade features while maintaining simplicity and ease of use for developers building modern web applications.
