# 🛠️ Body Parser Implementation Guide

> **Step-by-Step Guide to Using NextRush Body Parser** 🎯

This guide shows you **exactly** how to use the Ultimate Body Parser in real-world applications! 🚀

## 🚀 Quick Start (30 seconds)

```typescript
// 1️⃣ Install NextRush
npm install nextrush

// 2️⃣ Create your app
import { createApp } from 'nextrush';
const app = createApp();

// 3️⃣ Create an endpoint - body parsing is AUTOMATIC! ✨
app.post('/api/data', (req, res) => {
    console.log('📦 Automatically parsed:', req.body);
    res.json({ received: req.body });
});

// 4️⃣ Start the server
app.listen(3000);

// 🎉 DONE! Send any request and it's automatically parsed!
```

## 🎯 Real-World Examples

### 📱 Mobile App API

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// 🎯 User registration endpoint
app.post('/api/users/register', (req, res) => {
  // ✨ JSON automatically parsed from mobile app
  const { email, password, profile } = req.body;

  console.log('📧 Email:', email);
  console.log('👤 Profile:', profile);

  // Your registration logic here...
  res.json({
    success: true,
    userId: 12345,
    message: 'User registered successfully!',
  });
});

// 📱 Test with curl:
// curl -X POST http://localhost:3000/api/users/register \
//   -H "Content-Type: application/json" \
//   -d '{"email":"user@example.com","password":"secret123","profile":{"name":"John","age":25}}'
```

### 🌐 Traditional Web Forms

```typescript
// 📋 Contact form submission
app.post('/contact', (req, res) => {
  // ✨ Form data automatically parsed
  const { name, email, message, newsletter } = req.body;

  console.log('📝 Contact form submission:');
  console.log('👤 Name:', name);
  console.log('📧 Email:', email);
  console.log('💬 Message:', message);
  console.log('📰 Newsletter:', newsletter);

  // Send email, save to database, etc.
  res.redirect('/thank-you');
});

// 🌐 Test with HTML form:
// <form method="POST" action="/contact">
//   <input name="name" value="John Doe">
//   <input name="email" value="john@example.com">
//   <textarea name="message">Hello NextRush!</textarea>
//   <input type="checkbox" name="newsletter" value="yes">
//   <button type="submit">Send</button>
// </form>
```

### 📦 File Upload System

```typescript
// 🖼️ Image upload endpoint
app.post('/api/upload/image', (req, res) => {
  // ✨ Multipart form data automatically parsed
  const { image, title, description } = req.body;

  if (image && image.filename) {
    console.log('📸 Uploaded file:', image.filename);
    console.log('📏 File size:', image.data.length);
    console.log('🎭 Content type:', image.contentType);
    console.log('📝 Title:', title);
    console.log('📄 Description:', description);

    // Save file to disk, cloud storage, etc.
    fs.writeFileSync(`./uploads/${image.filename}`, image.data);

    res.json({
      success: true,
      filename: image.filename,
      url: `/uploads/${image.filename}`,
    });
  } else {
    res.status(400).json({ error: 'No image uploaded' });
  }
});

// 📦 Test with curl:
// curl -X POST http://localhost:3000/api/upload/image \
//   -F "image=@photo.jpg" \
//   -F "title=My Photo" \
//   -F "description=A beautiful sunset"
```

### 🤖 Webhook Receiver

```typescript
// 🎣 GitHub webhook endpoint
app.post('/webhooks/github', (req, res) => {
  // ✨ JSON webhook data automatically parsed
  const { action, repository, sender } = req.body;

  console.log('🎣 GitHub webhook received:');
  console.log('⚡ Action:', action);
  console.log('📦 Repository:', repository.name);
  console.log('👤 Sender:', sender.login);

  // Process webhook (deploy, notify, etc.)
  if (action === 'push') {
    console.log('🚀 Starting deployment...');
    // Your deployment logic
  }

  res.json({ message: 'Webhook processed' });
});

// 🎣 GitHub will send JSON like:
// {
//   "action": "push",
//   "repository": { "name": "my-repo" },
//   "sender": { "login": "developer" }
// }
```

## 🎛️ Advanced Configuration

### 🔧 Custom Parser Settings

```typescript
import { createApp, UltimateBodyParser } from 'nextrush';

// 🎯 Create custom parser with specific settings
const customParser = new UltimateBodyParser({
  maxSize: 100 * 1024 * 1024, // 🔢 100MB limit
  encoding: 'utf8', // 📝 Text encoding
  strict: false, // 🛡️ Relaxed parsing
  preserveRaw: true, // 💾 Keep original buffer
  timeout: 30000, // ⏱️ 30 second timeout
});

const app = createApp({
  bodyParser: customParser,
});

// 🎯 Or configure for specific routes
app.post(
  '/api/large-upload',
  customParser.middleware({
    maxSize: 500 * 1024 * 1024, // 500MB for this route only
  }),
  (req, res) => {
    console.log('📦 Large file processed');
    console.log('📏 Original size:', req.rawBody?.length);
    res.json({ success: true });
  }
);
```

### 🎯 Parser-Specific Routes

```typescript
// 📝 JSON-only endpoint
app.post(
  '/api/json-only',
  UltimateBodyParser.json({ strict: true }),
  (req, res) => {
    // This endpoint ONLY accepts JSON
    console.log('📝 JSON data:', req.body);
    res.json({ processed: true });
  }
);

// 📋 Form-only endpoint
app.post(
  '/forms/submit',
  UltimateBodyParser.urlencoded({ extended: true }),
  (req, res) => {
    // This endpoint ONLY accepts form data
    console.log('📋 Form data:', req.body);
    res.redirect('/success');
  }
);

// 📦 Upload-only endpoint
app.post(
  '/upload',
  UltimateBodyParser.multipart({
    maxFileSize: 50 * 1024 * 1024, // 50MB per file
    maxFiles: 5, // Max 5 files
  }),
  (req, res) => {
    // This endpoint ONLY accepts file uploads
    console.log('📦 Files uploaded:', Object.keys(req.body));
    res.json({ filesReceived: Object.keys(req.body).length });
  }
);
```

## 🛡️ Error Handling Strategies

### 🎭 Global Error Handler

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// 🛡️ Global body parser error handler
app.use((req, res, next) => {
  if (req.bodyParseError) {
    console.error('❌ Body parsing failed:', req.bodyParseError.message);

    // 🎯 Send user-friendly error based on error type
    if (req.bodyParseError.type === 'PAYLOAD_TOO_LARGE') {
      return res.status(413).json({
        error: 'File too large',
        message: 'Please upload a smaller file',
        maxSize: '50MB',
      });
    }

    if (req.bodyParseError.type === 'INVALID_JSON') {
      return res.status(400).json({
        error: 'Invalid JSON',
        message: 'Please check your JSON syntax',
        details: req.bodyParseError.details,
      });
    }

    // 🎭 Generic error response
    return res.status(400).json({
      error: 'Invalid request format',
      message: 'Please check your request content and try again',
    });
  }

  next();
});

// 🎯 Your routes here
app.post('/api/data', (req, res) => {
  // If we reach here, parsing was successful! ✨
  res.json({ received: req.body });
});
```

### 🔍 Route-Specific Error Handling

```typescript
// 🎯 Handle errors per route
app.post('/api/users', (req, res) => {
  try {
    // 🛡️ Validate required fields
    if (!req.body.email || !req.body.password) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['email', 'password'],
      });
    }

    // ✨ Process valid data
    const user = createUser(req.body);
    res.json({ success: true, user });
  } catch (error) {
    console.error('❌ User creation failed:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Please try again later',
    });
  }
});
```

## 🧪 Testing Your Parser Integration

### 🎯 Unit Tests

```typescript
import { UltimateBodyParser } from 'nextrush';
import { createMockRequest } from 'nextrush/testing';

describe('Body Parser Integration', () => {
  let parser: UltimateBodyParser;

  beforeEach(() => {
    parser = new UltimateBodyParser();
  });

  test('📝 should parse JSON data', async () => {
    const mockReq = createMockRequest({
      headers: { 'content-type': 'application/json' },
      body: '{"name": "NextRush", "version": "1.0.0"}',
    });

    const result = await parser.parse(mockReq);

    expect(result.parser).toBe('json');
    expect(result.data.name).toBe('NextRush');
    expect(result.data.version).toBe('1.0.0');
  });

  test('📋 should parse form data', async () => {
    const mockReq = createMockRequest({
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'name=NextRush&features[]=parsing&features[]=routing',
    });

    const result = await parser.parse(mockReq);

    expect(result.parser).toBe('urlencoded');
    expect(result.data.name).toBe('NextRush');
    expect(result.data['features[]']).toEqual(['parsing', 'routing']);
  });

  test('🛡️ should handle parsing errors', async () => {
    const mockReq = createMockRequest({
      headers: { 'content-type': 'application/json' },
      body: '{"invalid": json}', // Invalid JSON
    });

    await expect(parser.parse(mockReq)).rejects.toThrow('Invalid JSON');
  });
});
```

### 🌐 Integration Tests

```typescript
import request from 'supertest';
import { createApp } from 'nextrush';

describe('API Integration Tests', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    app.post('/api/test', (req, res) => {
      res.json({ received: req.body });
    });
  });

  test('🎯 should handle JSON requests', async () => {
    const response = await request(app)
      .post('/api/test')
      .send({ name: 'NextRush', awesome: true })
      .expect(200);

    expect(response.body.received.name).toBe('NextRush');
    expect(response.body.received.awesome).toBe(true);
  });

  test('📋 should handle form requests', async () => {
    const response = await request(app)
      .post('/api/test')
      .type('form')
      .send({ name: 'NextRush', features: ['parsing', 'routing'] })
      .expect(200);

    expect(response.body.received.name).toBe('NextRush');
  });

  test('📦 should handle file uploads', async () => {
    const response = await request(app)
      .post('/api/test')
      .attach('file', Buffer.from('test content'), 'test.txt')
      .field('title', 'Test Upload')
      .expect(200);

    expect(response.body.received.title).toBe('Test Upload');
    expect(response.body.received.file.filename).toBe('test.txt');
  });
});
```

## 🎯 Performance Optimization

### ⚡ Memory Optimization

```typescript
import { createApp } from 'nextrush';

const app = createApp({
  bodyParser: {
    // 🎯 Optimize for your use case
    maxSize: 10 * 1024 * 1024, // 10MB instead of default 50MB
    preserveRaw: false, // Don't keep original buffer
    streaming: true, // Use streaming for large files
    bufferPool: true, // Reuse buffers
  },
});

// 🎯 Route-specific optimization
app.post(
  '/api/small-data',
  UltimateBodyParser.json({ maxSize: 1024 }), // 1KB limit
  (req, res) => {
    // Fast processing for small JSON
    res.json({ processed: true });
  }
);

app.post(
  '/api/large-upload',
  UltimateBodyParser.multipart({
    streaming: true, // Stream large files
    tempDir: '/tmp/uploads', // Use temp directory
  }),
  (req, res) => {
    // Handle large file uploads efficiently
    res.json({ uploaded: true });
  }
);
```

### 📊 Monitoring & Metrics

```typescript
import { createApp, UltimateBodyParser } from 'nextrush';

const app = createApp();

// 📊 Add parsing metrics
app.use((req, res, next) => {
  const startTime = Date.now();

  // 🎯 Track parsing performance
  const originalParse = req.parse;
  req.parse = async (...args) => {
    const result = await originalParse.apply(req, args);

    const parseTime = Date.now() - startTime;
    console.log(
      `⚡ Parsed ${result.parser} in ${parseTime}ms (${result.size} bytes)`
    );

    // 📊 Send metrics to monitoring service
    metrics.record('body_parse_duration', parseTime, {
      parser: result.parser,
      size: result.size,
    });

    return result;
  };

  next();
});
```

## 🎪 Common Patterns

### 🔄 Multi-Format API

```typescript
// 🎯 Accept multiple formats on the same endpoint
app.post('/api/flexible', (req, res) => {
  const { body } = req;

  // ✨ Works with JSON, form data, or text!
  console.log('📦 Received data:', body);
  console.log('🎯 Parser used:', req.bodyParser);

  // 🎭 Respond in the same format as received
  if (req.bodyParser === 'json') {
    res.json({ processed: body });
  } else if (req.bodyParser === 'urlencoded') {
    res.type('text/plain').send(`Processed: ${JSON.stringify(body)}`);
  } else {
    res.send(`Received: ${body}`);
  }
});
```

### 🔒 Secure File Uploads

```typescript
import path from 'path';

app.post('/api/secure-upload', (req, res) => {
  const { file } = req.body;

  if (!file || !file.filename) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // 🛡️ Security checks
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (!allowedTypes.includes(file.contentType)) {
    return res.status(400).json({
      error: 'Invalid file type',
      allowed: allowedTypes,
    });
  }

  // 🔍 Check file extension
  const ext = path.extname(file.filename).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
    return res.status(400).json({ error: 'Invalid file extension' });
  }

  // 📏 Check file size
  if (file.data.length > 5 * 1024 * 1024) {
    // 5MB
    return res.status(400).json({ error: 'File too large' });
  }

  // ✨ File is safe to process
  const safeFilename = `${Date.now()}-${file.filename}`;
  fs.writeFileSync(`./uploads/${safeFilename}`, file.data);

  res.json({
    success: true,
    filename: safeFilename,
    url: `/uploads/${safeFilename}`,
  });
});
```

## 🎉 Next Steps

Congratulations! 🎊 You now know how to use the Ultimate Body Parser like a pro!

### 🚀 What's Next?

1. **📚 Read More Docs:**

   - [API Reference](./API-REFERENCE.md)
   - [Middleware Guide](./MIDDLEWARE.md)
   - [WebSocket Guide](./WEBSOCKET.md)

2. **🧪 Try Advanced Features:**

   - Custom parser types
   - Streaming uploads
   - Performance monitoring

3. **🌟 Build Something Awesome:**
   - REST API with file uploads
   - Real-time chat app
   - Webhook receiver service

### 💡 Pro Tips

- ✨ **Trust the auto-detection** - it works 99.9% of the time
- 🎯 **Set appropriate size limits** for your use case
- 🛡️ **Always validate** parsed data before using it
- 📊 **Monitor performance** in production
- 🧪 **Test with real data** from your clients

---

**Happy parsing!** 🎯✨

_The NextRush Team_ 🚀
