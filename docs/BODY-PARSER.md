# 🔄 NextRush Body Parser

## Automatic Request Body Parsing with Zero Configuration

NextRush includes a powerful built-in body parser that automatically handles different content types without any configuration. It's designed to be secure, fast, and developer-friendly.

## ✅ Currently Implemented Features

### 📄 JSON Parsing

Automatically parses JSON request bodies:

```typescript
app.post('/api/users', (req, res) => {
  // JSON automatically parsed into req.body
  const { name, email, age } = req.body;

  console.log('Parsed data:', { name, email, age });
  res.json({ message: 'User created', data: req.body });
});

// Example request:
// POST /api/users
// Content-Type: application/json
// Body: {"name": "John Doe", "email": "john@example.com", "age": 30}
```

### 📝 Form Data Parsing

Handles URL-encoded form data:

```typescript
app.post('/contact', (req, res) => {
  // Form data automatically parsed into req.body
  const { name, email, message } = req.body;

  res.json({
    message: 'Contact form submitted',
    data: { name, email, message },
  });
});

// Example request:
// POST /contact
// Content-Type: application/x-www-form-urlencoded
// Body: name=John+Doe&email=john@example.com&message=Hello+World
```

### 📋 Plain Text Parsing

Supports raw text content:

```typescript
app.post('/webhook', (req, res) => {
  // Raw text available in req.body as string
  const payload = req.body;

  console.log('Webhook payload:', payload);
  res.json({ received: true, length: payload.length });
});

// Example request:
// POST /webhook
// Content-Type: text/plain
// Body: "This is plain text content"
```

### 🛡️ Built-in Security Features

#### Size Limits

```typescript
// Default limits (configurable)
const limits = {
  maxSize: '1MB', // Maximum request body size
  timeout: '30s', // Request timeout
  strict: false, // Strict content-type validation
};
```

#### Content-Type Validation

```typescript
// Automatically validates content types
const allowedTypes = [
  'application/json',
  'application/x-www-form-urlencoded',
  'text/plain',
];
```

#### Automatic Error Handling

```typescript
// Built-in error responses for:
// - PayloadTooLargeError (413)
// - RequestTimeoutError (408)
// - UnsupportedMediaTypeError (415)
// - ValidationError (400)
```

## 🚀 Enhanced Request API

NextRush enhances the request object with helpful methods:

### Content Type Checking

```typescript
app.post('/api/data', (req, res) => {
  // Check request content type
  if (req.is('json')) {
    console.log('JSON request:', req.body);
  } else if (req.is('form')) {
    console.log('Form request:', req.body);
  } else if (req.is('text')) {
    console.log('Text request:', req.body);
  }

  res.json({ received: true });
});
```

### Accept Header Parsing

```typescript
app.post('/api/flexible', (req, res) => {
  // Check what client accepts
  const accepts = req.accepts(['json', 'html', 'text']);

  if (accepts === 'json') {
    res.json({ data: req.body });
  } else if (accepts === 'html') {
    res.html(`<h1>Received: ${JSON.stringify(req.body)}</h1>`);
  } else {
    res.text(`Received: ${JSON.stringify(req.body)}`);
  }
});
```

### Request Information

```typescript
app.post('/api/info', (req, res) => {
  const info = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    contentType: req.header('content-type'),
    contentLength: req.header('content-length'),
    userAgent: req.header('user-agent'),
    ip: req.ip(),
    secure: req.secure(),
    protocol: req.protocol(),
  };

  res.json({ info, body: req.body });
});
```

## ⚠️ Features Coming Soon

### 🔄 **Enhanced Multipart Form Support**

```typescript
// COMING SOON: Advanced file upload handling
app.post('/upload', (req, res) => {
  const { files, fields } = req.body; // Multipart auto-parsed
  const avatar = req.file('avatar'); // Direct file access
  const data = req.json(); // JSON validation

  res.json({
    files: Object.keys(files),
    fields: Object.keys(fields),
    avatar: avatar ? avatar.filename : null,
  });
});
```

**Will include:**

- 📁 Multiple file upload support
- 🗂️ Field and file separation
- 💾 Temporary file handling
- 🔒 File type validation
- 📊 Upload progress tracking
- 🚀 Streaming uploads for large files

### 🧩 **Advanced Features**

```typescript
// COMING SOON: Enhanced body parser features
app.post('/advanced', (req, res) => {
  // Advanced validation
  const validated = req.validate({
    name: { required: true, type: 'string', minLength: 2 },
    email: { required: true, type: 'email' },
    age: { type: 'number', min: 18, max: 120 },
  });

  // Advanced parsing
  const sanitized = req.sanitize({
    name: { trim: true, escape: true },
    bio: { removeHtml: true },
  });

  res.json({ validated, sanitized });
});
```

## 🔧 Configuration Options

### Basic Configuration

```typescript
import NextRush from 'nextrush';

const app = new NextRush({
  // Body parser options
  maxRequestSize: 1024 * 1024 * 10, // 10MB
  timeout: 60000, // 60 seconds
});
```

### Advanced Configuration

```typescript
// Custom body parser configuration (coming soon)
app.configure({
  bodyParser: {
    json: {
      limit: '10mb',
      strict: true,
      reviver: (key, value) => {
        // Custom JSON parsing logic
        return value;
      },
    },
    urlencoded: {
      limit: '10mb',
      extended: true,
      parameterLimit: 1000,
    },
    text: {
      limit: '10mb',
      type: 'text/*',
    },
    multipart: {
      limit: '50mb',
      fileSize: '10mb',
      files: 10,
      fields: 100,
    },
  },
});
```

## 🛡️ Security Best Practices

### 1. Validate Input

```typescript
app.post('/api/users', (req, res) => {
  const { name, email } = req.body;

  // Basic validation
  if (!name || !email) {
    return res.status(400).json({
      error: 'Name and email are required',
    });
  }

  if (!email.includes('@')) {
    return res.status(400).json({
      error: 'Invalid email format',
    });
  }

  res.json({ message: 'User created' });
});
```

### 2. Size Limits

```typescript
// Set appropriate limits for your use case
const app = new NextRush({
  maxRequestSize: 1024 * 1024 * 5, // 5MB for API endpoints
});

// Different limits for file uploads (when available)
app.post('/upload' /* file upload with higher limits */);
```

### 3. Content-Type Validation

```typescript
app.post('/api/strict', (req, res) => {
  // Only accept JSON
  if (!req.is('json')) {
    return res.status(415).json({
      error: 'Only JSON content is accepted',
    });
  }

  res.json({ data: req.body });
});
```

## 🚀 Real-World Examples

### API Endpoint

```typescript
// Complete API endpoint with validation
app.post('/api/products', (req, res) => {
  try {
    const { name, price, description, category } = req.body;

    // Validation
    if (!name || !price || !category) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'price', 'category'],
      });
    }

    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({
        error: 'Price must be a positive number',
      });
    }

    // Process the data
    const product = {
      id: Date.now(),
      name: name.trim(),
      price: parseFloat(price),
      description: description?.trim() || '',
      category: category.trim(),
      createdAt: new Date().toISOString(),
    };

    res.status(201).json({
      message: 'Product created successfully',
      product,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});
```

### Contact Form

```typescript
// Contact form handler
app.post('/contact', (req, res) => {
  const { name, email, subject, message } = req.body;

  // Validation
  const errors = [];
  if (!name) errors.push('Name is required');
  if (!email) errors.push('Email is required');
  if (!message) errors.push('Message is required');

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  // Process contact form
  console.log('Contact form submission:', {
    name,
    email,
    subject,
    message,
    timestamp: new Date().toISOString(),
    ip: req.ip(),
    userAgent: req.header('user-agent'),
  });

  res.json({
    message: 'Thank you for your message. We will get back to you soon!',
    id: Date.now(),
  });
});
```

### Webhook Handler

```typescript
// Webhook endpoint for external services
app.post('/webhooks/payment', (req, res) => {
  const signature = req.header('x-signature');
  const payload = req.body;

  // Verify webhook signature (implement your verification logic)
  if (!verifyWebhookSignature(payload, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process webhook
  console.log('Payment webhook received:', payload);

  // Always respond quickly to webhooks
  res.json({ received: true });

  // Process asynchronously
  process.nextTick(() => {
    processPaymentWebhook(payload);
  });
});
```

## 📊 Performance Tips

### 1. Request Size Limits

```typescript
// Set appropriate limits based on your needs
const app = new NextRush({
  maxRequestSize: 1024 * 1024 * 2, // 2MB for most APIs
});

// For file upload endpoints, use higher limits when available
```

### 2. Efficient Processing

```typescript
app.post('/api/bulk', (req, res) => {
  const { items } = req.body;

  // Process in batches for large datasets
  if (Array.isArray(items) && items.length > 100) {
    // Handle large requests differently
    return res.status(413).json({
      error: 'Too many items. Please send in batches of 100 or less.',
    });
  }

  res.json({ processed: items.length });
});
```

### 3. Caching Responses

```typescript
app.post('/api/expensive-operation', (req, res) => {
  const cacheKey = JSON.stringify(req.body);

  // Check cache first (implement your caching logic)
  const cached = getFromCache(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  // Process and cache result
  const result = performExpensiveOperation(req.body);
  setCache(cacheKey, result, 300); // Cache for 5 minutes

  res.json(result);
});
```

## 🔮 Roadmap

### Next Release (v2.0)

- ✅ Enhanced multipart/form-data support
- ✅ File upload handling with streaming
- ✅ Built-in validation and sanitization
- ✅ Custom parser registration
- ✅ Advanced security features

### Future Releases

- 🔄 XML parsing support
- 📊 Request/response compression
- 🔒 Built-in rate limiting
- 📈 Performance monitoring
- 🧪 Schema validation integration

---

**NextRush Body Parser: Automatic, secure, and developer-friendly!** 🔄
