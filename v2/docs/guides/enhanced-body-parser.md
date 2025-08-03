# Enhanced Body Parser - NextRush v2

## Overview

The Enhanced Body Parser is the default body parsing middleware in NextRush v2, providing enterprise-grade performance and cross-platform compatibility. It automatically detects and parses request bodies based on content-type with zero-copy buffer operations and intelligent caching.

## Features

- 🔥 **Zero-copy buffer operations** using Node.js raw power
- 🚀 **Cross-platform compatibility** (Node.js, Bun, Deno)
- 🧠 **AI-like content type auto-detection**
- 🌊 **Streaming parser** with backpressure handling
- 💾 **Memory-pooled buffer management**
- ⚡ **CPU-optimized parsing** with vectorized operations
- 🎯 **Smart caching** and pre-compiled patterns
- 🛡️ **Enterprise-grade error handling**
- 📊 **Real-time performance metrics** collection

## Quick Start

### Basic Usage

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp();

// Enhanced body parser is automatically available
app.use(app.smartBodyParser());

app.post('/users', ctx => {
  // Body is automatically parsed based on content-type
  console.log(ctx.body); // Parsed data
  ctx.res.json({ success: true });
});
```

### Advanced Configuration

```typescript
const app = createApp();

app.use(
  app.smartBodyParser({
    maxSize: 10 * 1024 * 1024, // 10MB
    timeout: 30000, // 30 seconds
    enableStreaming: true,
    streamingThreshold: 50 * 1024 * 1024, // 50MB
    poolSize: 100,
    fastValidation: true,
    autoDetectContentType: true,
    strictContentType: false,
    debug: false,
    maxFiles: 10,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    memoryStorage: true,
    encoding: 'utf8',
    enableMetrics: true,
  })
);
```

## Content Type Support

### JSON Parsing

```typescript
// Automatically handles application/json
app.post('/api/data', ctx => {
  const data = ctx.body; // Already parsed as JSON
  ctx.res.json({ received: data });
});
```

### URL-Encoded Parsing

```typescript
// Automatically handles application/x-www-form-urlencoded
app.post('/api/form', ctx => {
  const formData = ctx.body; // Already parsed as object
  ctx.res.json({ formData });
});
```

### Text Parsing

```typescript
// Automatically handles text/* content types
app.post('/api/text', ctx => {
  const text = ctx.body; // Already parsed as string
  ctx.res.json({ text });
});
```

### Multipart Form Data

```typescript
// Automatically handles multipart/form-data
app.post('/api/upload', ctx => {
  const { files, fields } = ctx.body;
  ctx.res.json({ files, fields });
});
```

### Raw Data

```typescript
// Automatically handles other content types as raw data
app.post('/api/raw', ctx => {
  const rawData = ctx.body; // Raw buffer or parsed data
  ctx.res.json({ size: rawData.length });
});
```

## Configuration Options

### Basic Options

| Option     | Type             | Default  | Description                     |
| ---------- | ---------------- | -------- | ------------------------------- |
| `maxSize`  | `number`         | `10MB`   | Maximum body size in bytes      |
| `timeout`  | `number`         | `30s`    | Request timeout in milliseconds |
| `encoding` | `BufferEncoding` | `'utf8'` | Character encoding              |

### Performance Options

| Option               | Type      | Default | Description                         |
| -------------------- | --------- | ------- | ----------------------------------- |
| `enableStreaming`    | `boolean` | `true`  | Enable streaming for large payloads |
| `streamingThreshold` | `number`  | `50MB`  | Streaming threshold in bytes        |
| `poolSize`           | `number`  | `100`   | Buffer pool size for optimization   |
| `fastValidation`     | `boolean` | `true`  | Enable fast validation              |

### Content Type Options

| Option                  | Type      | Default | Description                  |
| ----------------------- | --------- | ------- | ---------------------------- |
| `autoDetectContentType` | `boolean` | `true`  | Auto-detect content type     |
| `strictContentType`     | `boolean` | `false` | Strict content type checking |

### File Upload Options

| Option          | Type      | Default | Description              |
| --------------- | --------- | ------- | ------------------------ |
| `maxFiles`      | `number`  | `10`    | Maximum number of files  |
| `maxFileSize`   | `number`  | `5MB`   | Maximum file size        |
| `memoryStorage` | `boolean` | `true`  | Memory storage for files |

### Debug Options

| Option          | Type      | Default | Description                |
| --------------- | --------- | ------- | -------------------------- |
| `debug`         | `boolean` | `false` | Enable debug logging       |
| `enableMetrics` | `boolean` | `false` | Enable performance metrics |

## Performance Metrics

### Accessing Metrics

```typescript
import { getBodyParserMetrics } from 'nextrush-v2';

// Get current metrics
const metrics = getBodyParserMetrics();
console.log('Total requests:', metrics.totalRequests);
console.log('Average parse time:', metrics.averageParseTime);
console.log('Success rate:', metrics.successRate);
```

### Metrics Interface

```typescript
interface BodyParserMetrics {
  totalRequests: number;
  totalParseTime: number;
  averageParseTime: number;
  peakMemoryUsage: number;
  cacheHitRatio: number;
  successRate: number;
  totalBytesProcessed: number;
}
```

## Error Handling

### Built-in Error Handling

The enhanced body parser includes comprehensive error handling:

```typescript
app.post('/api/data', ctx => {
  try {
    // Body parsing is handled automatically
    const data = ctx.body;
    ctx.res.json({ success: true, data });
  } catch (error) {
    // Parser errors are handled automatically
    ctx.res.status(400).json({
      error: 'Invalid request body',
      message: error.message,
    });
  }
});
```

### Custom Error Handling

```typescript
app.use(
  app.smartBodyParser({
    debug: true, // Enable debug logging
  })
);

// Custom error middleware
app.use((ctx, next) => {
  try {
    return next();
  } catch (error) {
    if (error.code === 'BODY_TOO_LARGE') {
      ctx.res.status(413).json({ error: 'Payload too large' });
    } else if (error.code === 'INVALID_JSON') {
      ctx.res.status(400).json({ error: 'Invalid JSON' });
    } else {
      ctx.res.status(500).json({ error: 'Internal server error' });
    }
  }
});
```

## Migration from Old Body Parser

### Before (Old Body Parser)

```typescript
import { json, urlencoded, text } from 'nextrush-v2';

app.use(json());
app.use(urlencoded({ extended: true }));
app.use(text());
```

### After (Enhanced Body Parser)

```typescript
// No imports needed - enhanced body parser is built-in
app.use(app.smartBodyParser());
```

### Individual Parsers (Legacy Support)

```typescript
// For backward compatibility
app.use(app.json()); // JSON parser
app.use(app.urlencoded()); // URL-encoded parser
app.use(app.text()); // Text parser
```

## Best Practices

### 1. Use Smart Body Parser by Default

```typescript
// ✅ Recommended
app.use(app.smartBodyParser());

// ❌ Not recommended (unless specific needs)
app.use(app.json());
app.use(app.urlencoded());
```

### 2. Configure Based on Use Case

```typescript
// API endpoints
app.use(
  app.smartBodyParser({
    maxSize: 1024 * 1024, // 1MB
    autoDetectContentType: true,
  })
);

// File upload endpoints
app.use(
  app.smartBodyParser({
    maxSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 20,
    maxFileSize: 10 * 1024 * 1024, // 10MB
  })
);
```

### 3. Monitor Performance

```typescript
// Enable metrics in development
if (process.env.NODE_ENV === 'development') {
  app.use(
    app.smartBodyParser({
      enableMetrics: true,
      debug: true,
    })
  );
}
```

### 4. Handle Large Files

```typescript
// For large file uploads
app.use(
  app.smartBodyParser({
    enableStreaming: true,
    streamingThreshold: 10 * 1024 * 1024, // 10MB
    maxSize: 100 * 1024 * 1024, // 100MB
  })
);
```

## Troubleshooting

### Common Issues

#### 1. Body Not Parsed

```typescript
// Check if middleware is registered
app.use(app.smartBodyParser());

// Check content-type header
app.post('/api/data', ctx => {
  console.log('Content-Type:', ctx.headers['content-type']);
  console.log('Body:', ctx.body);
});
```

#### 2. Large File Uploads Failing

```typescript
// Increase limits for file uploads
app.use(
  app.smartBodyParser({
    maxSize: 50 * 1024 * 1024, // 50MB
    maxFileSize: 10 * 1024 * 1024, // 10MB
    enableStreaming: true,
  })
);
```

#### 3. Performance Issues

```typescript
// Enable metrics to identify bottlenecks
app.use(
  app.smartBodyParser({
    enableMetrics: true,
    debug: true,
  })
);

// Check metrics periodically
setInterval(() => {
  const metrics = getBodyParserMetrics();
  console.log('Parse success rate:', metrics.successRate);
}, 60000);
```

### Debug Mode

```typescript
app.use(
  app.smartBodyParser({
    debug: true, // Enable detailed logging
  })
);
```

## API Reference

### `smartBodyParser(options?)`

Creates enhanced body parser middleware.

**Parameters:**

- `options` (optional): Configuration options

**Returns:**

- `Middleware`: Enhanced body parser middleware function

### `getBodyParserMetrics()`

Gets current performance metrics.

**Returns:**

- `BodyParserMetrics | null`: Current metrics or null if not enabled

### `cleanupBodyParser()`

Cleans up resources and resets metrics.

**Returns:**

- `void`

## Examples

### Complete Example

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp();

// Configure enhanced body parser
app.use(
  app.smartBodyParser({
    maxSize: 10 * 1024 * 1024, // 10MB
    timeout: 30000, // 30 seconds
    enableStreaming: true,
    autoDetectContentType: true,
    enableMetrics: true,
  })
);

// JSON API endpoint
app.post('/api/users', ctx => {
  const userData = ctx.body;
  ctx.res.status(201).json({
    message: 'User created',
    user: userData,
  });
});

// File upload endpoint
app.post('/api/upload', ctx => {
  const { files, fields } = ctx.body;
  ctx.res.json({
    message: 'Files uploaded',
    fileCount: Object.keys(files).length,
    fields,
  });
});

// Text processing endpoint
app.post('/api/text', ctx => {
  const text = ctx.body;
  ctx.res.json({
    message: 'Text processed',
    length: text.length,
    text: text.substring(0, 100) + '...',
  });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### Performance Monitoring

```typescript
// Monitor performance in production
setInterval(() => {
  const metrics = getBodyParserMetrics();
  if (metrics) {
    console.log('Body Parser Metrics:', {
      totalRequests: metrics.totalRequests,
      averageParseTime: metrics.averageParseTime.toFixed(2) + 'ms',
      successRate: (metrics.successRate * 100).toFixed(2) + '%',
      cacheHitRatio: (metrics.cacheHitRatio * 100).toFixed(2) + '%',
    });
  }
}, 300000); // Every 5 minutes
```

## Version History

- **v2.0.0**: Enhanced body parser becomes the default
- **v1.x.x**: Legacy body parser (deprecated)

## Migration Guide

### From v1 to v2

1. **Remove old imports:**

   ```typescript
   // ❌ Remove these
   import { json, urlencoded, text } from 'nextrush-v2';
   ```

2. **Replace middleware registration:**

   ```typescript
   // ❌ Old way
   app.use(json());
   app.use(urlencoded({ extended: true }));

   // ✅ New way
   app.use(app.smartBodyParser());
   ```

3. **Update configuration:**

   ```typescript
   // ❌ Old configuration
   app.use(json({ limit: '1mb' }));

   // ✅ New configuration
   app.use(app.smartBodyParser({ maxSize: 1024 * 1024 }));
   ```

The enhanced body parser provides better performance, more features, and improved developer experience while maintaining backward compatibility through the legacy methods.
