# 🔄 Body Parser

## 📚 Table of Contents

- [📖 Introduction](#-introduction)
- [🔧 Public APIs](#-public-apis)
  - [📋 Configuration Interfaces](#-configuration-interfaces)
  - [🛠️ Middleware Methods](#️-middleware-methods)
- [💻 Usage Examples](#-usage-examples)
- [⚙️ Configuration Options](#️-configuration-options)
- [📝 Notes](#-notes)

## 📖 Introduction

The NextRush Body Parser plugin provides automatic request body parsing capabilities with zero configuration required. It supports JSON, URL-encoded, text, and raw data formats with intelligent content-type detection, comprehensive error handling, and flexible configuration options for different parsing strategies.

## 🔧 Public APIs

### 📋 Configuration Interfaces

| Interface           | Description                                  |
| ------------------- | -------------------------------------------- |
| `BodyParserOptions` | Main configuration options for body parsing. |

#### BodyParserOptions Properties

| Property              | Type                      | Default                                                                             | Description                               |
| --------------------- | ------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------- |
| `maxSize`             | `number`                  | `1048576`                                                                           | Maximum request body size in bytes (1MB). |
| `timeout`             | `number`                  | `30000`                                                                             | Request timeout in milliseconds.          |
| `allowedContentTypes` | `string[]`                | `['application/json', 'application/x-www-form-urlencoded', 'text/plain', 'text/*']` | Allowed content types for parsing.        |
| `strict`              | `boolean`                 | `false`                                                                             | Enable strict parsing mode.               |
| `json`                | `JsonParserOptions`       | `{}`                                                                                | JSON-specific parsing options.            |
| `urlencoded`          | `UrlencodedParserOptions` | `{}`                                                                                | URL-encoded specific parsing options.     |
| `text`                | `TextParserOptions`       | `{}`                                                                                | Text-specific parsing options.            |

#### JsonParserOptions Properties

| Property  | Type                               | Default     | Description                    |
| --------- | ---------------------------------- | ----------- | ------------------------------ |
| `limit`   | `string`                           | `'1mb'`     | Maximum JSON payload size.     |
| `strict`  | `boolean`                          | `false`     | Only parse objects and arrays. |
| `reviver` | `(key: string, value: any) => any` | `undefined` | JSON.parse reviver function.   |

#### UrlencodedParserOptions Properties

| Property         | Type      | Default | Description                            |
| ---------------- | --------- | ------- | -------------------------------------- |
| `limit`          | `string`  | `'1mb'` | Maximum URL-encoded payload size.      |
| `extended`       | `boolean` | `true`  | Parse extended syntax with qs library. |
| `parameterLimit` | `number`  | `1000`  | Maximum number of parameters.          |

#### TextParserOptions Properties

| Property | Type     | Default    | Description                 |
| -------- | -------- | ---------- | --------------------------- |
| `limit`  | `string` | `'1mb'`    | Maximum text payload size.  |
| `type`   | `string` | `'text/*'` | MIME type to parse as text. |

### 🛠️ Middleware Methods

| Method                 | Signature                                                          | Description                            |
| ---------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| `json(options?)`       | `(options?: JsonParserOptions) => ExpressMiddleware`               | Create JSON parsing middleware.        |
| `urlencoded(options?)` | `(options?: UrlencodedParserOptions) => ExpressMiddleware`         | Create URL-encoded parsing middleware. |
| `text(options?)`       | `(options?: TextParserOptions) => ExpressMiddleware`               | Create text parsing middleware.        |
| `raw(options?)`        | `(options?: {limit?: string, type?: string}) => ExpressMiddleware` | Create raw buffer parsing middleware.  |

## 💻 Usage Examples

### Basic Automatic Parsing

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Body parser is automatically enabled - no configuration needed!
// Supports JSON, URL-encoded, and text parsing out of the box

app.post('/api/users', (req, res) => {
  // req.body is automatically parsed based on Content-Type
  console.log('Parsed body:', req.body);

  if (req.is('application/json')) {
    // Handle JSON data
    const { name, email } = req.body;
    res.json({ message: 'JSON received', data: { name, email } });
  } else if (req.is('application/x-www-form-urlencoded')) {
    // Handle form data
    const formData = req.body;
    res.json({ message: 'Form data received', data: formData });
  } else {
    res.json({ message: 'Data received', body: req.body });
  }
});

app.listen(3000);
```

### Custom JSON Parsing

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Custom JSON middleware with specific options
app.use(
  '/api/strict',
  app.json({
    limit: '5mb',
    strict: true, // Only accept objects and arrays
    reviver: (key, value) => {
      // Custom JSON processing
      if (key === 'date') {
        return new Date(value);
      }
      return value;
    },
  })
);

app.post('/api/strict/data', (req, res) => {
  console.log('Strictly parsed JSON:', req.body);
  res.json({ received: req.body });
});

app.listen(3000);
```

### URL-Encoded Form Parsing

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Custom URL-encoded middleware
app.use(
  '/forms',
  app.urlencoded({
    limit: '10mb',
    extended: true, // Support nested objects
    parameterLimit: 2000, // Allow more parameters
  })
);

app.post('/forms/contact', (req, res) => {
  const { name, email, message, preferences } = req.body;

  // Handle nested form data
  console.log('Form submission:', {
    name,
    email,
    message,
    preferences, // Can be nested object if extended: true
  });

  res.json({
    message: 'Form submitted successfully',
    data: req.body,
  });
});

app.listen(3000);
```

### Text and Raw Data Parsing

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Text parsing for specific content types
app.use(
  '/webhook/text',
  app.text({
    limit: '1mb',
    type: 'text/plain',
  })
);

// Raw buffer parsing for binary data
app.use(
  '/webhook/binary',
  app.raw({
    limit: '50mb',
    type: 'application/octet-stream',
  })
);

app.post('/webhook/text', (req, res) => {
  console.log('Received text:', req.body); // String
  res.send('Text received');
});

app.post('/webhook/binary', (req, res) => {
  console.log('Received binary data:', req.body); // Buffer
  console.log('Size:', req.body.length, 'bytes');
  res.send('Binary data received');
});

app.listen(3000);
```

### Multiple Content Type Handling

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Handle multiple content types on the same route
app.post('/api/upload', (req, res) => {
  const contentType = req.headers['content-type'];

  if (req.is('application/json')) {
    // JSON data
    console.log('JSON payload:', req.body);
    res.json({ type: 'json', data: req.body });
  } else if (req.is('application/x-www-form-urlencoded')) {
    // Form data
    console.log('Form data:', req.body);
    res.json({ type: 'form', data: req.body });
  } else if (req.is('text/*')) {
    // Text data
    console.log('Text data:', req.body);
    res.json({ type: 'text', data: req.body });
  } else {
    // Raw buffer data
    console.log('Raw data size:', req.body?.length || 0);
    res.json({
      type: 'raw',
      size: req.body?.length || 0,
      contentType,
    });
  }
});

app.listen(3000);
```

### Error Handling

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Custom error handling for body parsing
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON format',
      message: err.message,
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload too large',
      message: 'Request body exceeds size limit',
    });
  }

  if (err.type === 'charset.unsupported') {
    return res.status(415).json({
      error: 'Unsupported charset',
      message: err.message,
    });
  }

  // Generic error
  res.status(500).json({
    error: 'Body parsing error',
    message: err.message,
  });
});

app.post('/api/data', (req, res) => {
  res.json({ body: req.body });
});

app.listen(3000);
```

### Conditional Body Parsing

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Conditional parsing based on route
app.use('/api/small', app.json({ limit: '100kb' }));
app.use('/api/large', app.json({ limit: '10mb' }));

// Skip parsing for certain routes
app.use('/api/raw', (req, res, next) => {
  // Skip automatic body parsing
  req.skipBodyParsing = true;
  next();
});

app.post('/api/small/data', (req, res) => {
  res.json({ message: 'Small data processed', data: req.body });
});

app.post('/api/large/upload', (req, res) => {
  res.json({
    message: 'Large data processed',
    size: JSON.stringify(req.body).length,
  });
});

app.post('/api/raw/stream', (req, res) => {
  // Handle raw stream without parsing
  let data = '';
  req.on('data', (chunk) => (data += chunk));
  req.on('end', () => {
    res.json({ message: 'Raw data received', length: data.length });
  });
});

app.listen(3000);
```

## ⚙️ Configuration Options

### Global Body Parser Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Configure global body parser settings
app.enableBodyParser({
  maxSize: 5 * 1024 * 1024, // 5MB
  timeout: 60000, // 60 seconds
  allowedContentTypes: [
    'application/json',
    'application/x-www-form-urlencoded',
    'text/plain',
    'text/csv',
    'application/xml',
  ],
  strict: true,
  json: {
    limit: '5mb',
    strict: true,
    reviver: (key, value) => {
      // Global JSON processing
      if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
        return new Date(value);
      }
      return value;
    },
  },
  urlencoded: {
    limit: '10mb',
    extended: true,
    parameterLimit: 5000,
  },
  text: {
    limit: '1mb',
    type: 'text/*',
  },
});

app.listen(3000);
```

### Environment-Based Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Different settings for different environments
const bodyParserConfig = {
  development: {
    maxSize: 10 * 1024 * 1024, // 10MB for development
    timeout: 120000, // 2 minutes
    strict: false,
  },
  production: {
    maxSize: 1 * 1024 * 1024, // 1MB for production
    timeout: 30000, // 30 seconds
    strict: true,
  },
  test: {
    maxSize: 100 * 1024, // 100KB for tests
    timeout: 5000, // 5 seconds
    strict: true,
  },
};

const env = process.env.NODE_ENV || 'development';
app.enableBodyParser(bodyParserConfig[env]);

app.listen(3000);
```

### Content-Type Specific Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// API routes with JSON only
app.use(
  '/api/v1',
  app.json({
    limit: '2mb',
    strict: true,
  })
);

// File upload routes with larger limits
app.use(
  '/upload',
  app.raw({
    limit: '100mb',
    type: 'application/octet-stream',
  })
);

// Form submission routes
app.use(
  '/forms',
  app.urlencoded({
    limit: '5mb',
    extended: true,
    parameterLimit: 10000,
  })
);

// Webhook routes with text parsing
app.use(
  '/webhooks',
  app.text({
    limit: '1mb',
    type: 'text/*',
  })
);

app.listen(3000);
```

## 📝 Notes

- **Automatic Parsing**: Body parsing is automatically enabled when the BodyParser plugin is installed, requiring zero configuration for basic use cases.

- **Content-Type Detection**: The parser automatically detects content types and applies appropriate parsing strategies based on the `Content-Type` header.

- **Memory Efficiency**: Large payloads are streamed and parsed efficiently to minimize memory usage and prevent blocking.

- **Error Handling**: Comprehensive error handling for malformed data, size limits, timeout errors, and unsupported content types.

- **Security**: Built-in protection against payload bombs, deeply nested objects, and excessive parameter counts.

- **Flexibility**: Supports both automatic parsing and manual middleware configuration for fine-grained control.

- **Performance**: Optimized parsing algorithms with caching and streaming support for high-throughput applications.

- **TypeScript Support**: Full TypeScript support with comprehensive type definitions for all parsing options and results.

- **Express Compatibility**: Drop-in replacement for Express.js body-parser middleware with enhanced features.

- **Middleware Chaining**: Can be combined with other middleware for validation, transformation, and processing workflows.

- **Custom Parsers**: Extensible architecture allows for custom parsing strategies and content-type handlers.

- **Size Limits**: Configurable size limits prevent memory exhaustion and denial-of-service attacks through large payloads.
