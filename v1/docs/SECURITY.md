# Security Guide

## Input Validation

NextRush provides built-in validation for request data to prevent security vulnerabilities.

### Request Validation

```typescript
app.post('/api/users', (req, res) => {
  const validation = req.validate({
    // Required fields
    email: {
      required: true,
      type: 'email',
      message: 'Valid email address is required',
    },
    password: {
      required: true,
      minLength: 8,
      pattern:
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      message:
        'Password must contain uppercase, lowercase, number and special character',
    },

    // Optional fields with validation
    age: {
      type: 'number',
      min: 13,
      max: 120,
      message: 'Age must be between 13 and 120',
    },
    name: {
      required: true,
      minLength: 2,
      maxLength: 50,
      pattern: /^[a-zA-Z\s]+$/,
      message: 'Name can only contain letters and spaces',
    },

    // URL validation
    website: {
      type: 'url',
      message: 'Must be a valid URL',
    },
  });

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      errors: validation.errors,
    });
  }

  // Use sanitized data
  const userData = validation.sanitized;
  res.json({ success: true, user: userData });
});
```

### Validation Types

```typescript
// String validation
const stringValidation = {
  type: 'string',
  required: true,
  minLength: 3,
  maxLength: 100,
  pattern: /^[a-zA-Z0-9\s]+$/,
  trim: true,
  lowercase: true,
};

// Number validation
const numberValidation = {
  type: 'number',
  required: true,
  min: 0,
  max: 1000,
  integer: true,
};

// Email validation
const emailValidation = {
  type: 'email',
  required: true,
  message: 'Please provide a valid email address',
};

// URL validation
const urlValidation = {
  type: 'url',
  required: false,
  protocols: ['http', 'https'],
};

// Date validation
const dateValidation = {
  type: 'date',
  required: true,
  min: '2020-01-01',
  max: '2030-12-31',
};

// Array validation
const arrayValidation = {
  type: 'array',
  required: true,
  minLength: 1,
  maxLength: 10,
  items: {
    type: 'string',
    minLength: 3,
  },
};

// Object validation
const objectValidation = {
  type: 'object',
  required: true,
  properties: {
    name: { type: 'string', required: true },
    age: { type: 'number', min: 0 },
  },
};
```

## Input Sanitization

### Basic Sanitization

```typescript
app.post('/api/comments', (req, res) => {
  // Sanitize user input
  const cleanComment = req.sanitize(req.body.comment, {
    removeHtml: true, // Remove HTML tags
    trim: true, // Remove whitespace
    escape: true, // Escape special characters
    maxLength: 500, // Limit length
    removeUrls: false, // Keep URLs
    allowedTags: [], // No HTML tags allowed
    removeScripts: true, // Remove script tags
  });

  const cleanTitle = req.sanitize(req.body.title, {
    trim: true,
    maxLength: 100,
    removeHtml: true,
    escape: true,
  });

  res.json({
    comment: cleanComment,
    title: cleanTitle,
  });
});
```

### Advanced Sanitization

```typescript
app.post('/api/articles', (req, res) => {
  // Different sanitization for different fields
  const article = {
    title: req.sanitize(req.body.title, {
      trim: true,
      maxLength: 200,
      removeHtml: true,
      escape: true,
    }),

    content: req.sanitize(req.body.content, {
      trim: true,
      allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
      maxLength: 10000,
      removeScripts: true,
      removeEvents: true,
    }),

    author: req.sanitize(req.body.author, {
      trim: true,
      maxLength: 50,
      removeHtml: true,
      pattern: /^[a-zA-Z\s]+$/,
    }),
  };

  res.json({ article });
});
```

### Email and URL Validation

```typescript
app.post('/api/contact', (req, res) => {
  const { email, website, message } = req.body;

  // Validate email
  if (!req.isValidEmail(email)) {
    return res.status(400).json({
      error: 'Invalid email address',
    });
  }

  // Validate URL (optional)
  if (website && !req.isValidUrl(website)) {
    return res.status(400).json({
      error: 'Invalid website URL',
    });
  }

  // Sanitize message
  const cleanMessage = req.sanitize(message, {
    removeHtml: true,
    trim: true,
    maxLength: 1000,
  });

  res.json({
    success: true,
    data: {
      email,
      website,
      message: cleanMessage,
    },
  });
});
```

## Security Headers

### Automatic Security Headers

```typescript
// Security middleware (apply globally)
app.use((req, res, next) => {
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Content Type Options
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Frame Options
  res.setHeader('X-Frame-Options', 'DENY');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  );

  // HTTPS Strict Transport Security
  if (req.secure()) {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  next();
});
```

### CORS Configuration

```typescript
// CORS middleware
const corsOptions = {
  origin:
    process.env.NODE_ENV === 'production'
      ? ['https://yourdomain.com', 'https://www.yourdomain.com']
      : ['http://localhost:3000', 'http://localhost:8080'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (corsOptions.origin.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
  res.setHeader(
    'Access-Control-Allow-Headers',
    corsOptions.allowedHeaders.join(', ')
  );
  res.setHeader('Access-Control-Allow-Credentials', corsOptions.credentials);
  res.setHeader('Access-Control-Max-Age', corsOptions.maxAge);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});
```

## Authentication & Authorization

### JWT Authentication

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Login endpoint
app.post('/auth/login', async (req, res) => {
  const validation = req.validate({
    email: { required: true, type: 'email' },
    password: { required: true, minLength: 8 },
  });

  if (!validation.isValid) {
    return res.status(400).json({ errors: validation.errors });
  }

  const { email, password } = validation.sanitized;

  try {
    // Verify user credentials (implement your logic)
    const user = await verifyUserCredentials(email, password);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '24h',
    });

    // Set secure cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: req.secure(),
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.json({ success: true, user: { id: user.id, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Authentication middleware
const authenticate = (req, res, next) => {
  const token =
    req.headers.authorization?.replace('Bearer ', '') ||
    req.parseCookies().token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Protected route
app.get('/profile', authenticate, (req, res) => {
  res.json({ user: req.user });
});
```

### Role-Based Authorization

```typescript
// Authorization middleware
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Admin only route
app.get('/admin/users', authenticate, authorize(['admin']), (req, res) => {
  res.json({ users: getAllUsers() });
});

// Admin or moderator route
app.post(
  '/posts/:id/moderate',
  authenticate,
  authorize(['admin', 'moderator']),
  (req, res) => {
    res.json({ success: true });
  }
);
```

## Rate Limiting

### Basic Rate Limiting

```typescript
// Simple rate limiter
const createRateLimiter = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.ip();
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old requests
    const userRequests = requests.get(key) || [];
    const validRequests = userRequests.filter((time) => time > windowStart);

    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000),
      });
    }

    validRequests.push(now);
    requests.set(key, validRequests);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - validRequests.length);
    res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

    next();
  };
};

// Apply rate limiting
app.use('/api/', createRateLimiter(100, 15 * 60 * 1000)); // 100 requests per 15 minutes
app.use('/auth/', createRateLimiter(5, 15 * 60 * 1000)); // 5 requests per 15 minutes
```

### Advanced Rate Limiting

```typescript
// Different limits for different endpoints
const rateLimiters = {
  strict: createRateLimiter(5, 15 * 60 * 1000), // Login, register
  moderate: createRateLimiter(50, 15 * 60 * 1000), // API calls
  lenient: createRateLimiter(200, 15 * 60 * 1000), // Public endpoints
};

app.use('/auth/login', rateLimiters.strict);
app.use('/auth/register', rateLimiters.strict);
app.use('/api/', rateLimiters.moderate);
app.use('/public/', rateLimiters.lenient);
```

## File Upload Security

### Secure File Uploads

```typescript
app.post('/api/upload', (req, res) => {
  const file = req.file('document');

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Validate file type
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'text/plain',
  ];
  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({
      error: 'File type not allowed',
      allowed: allowedTypes,
    });
  }

  // Validate file size (5MB limit)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return res.status(400).json({
      error: 'File too large',
      maxSize: `${maxSize / 1024 / 1024}MB`,
    });
  }

  // Sanitize filename
  const cleanFilename = req
    .sanitize(file.filename, {
      removeHtml: true,
      trim: true,
      maxLength: 100,
    })
    .replace(/[^a-zA-Z0-9.-]/g, '_');

  // Generate unique filename
  const uniqueFilename = `${Date.now()}-${cleanFilename}`;

  res.json({
    success: true,
    file: {
      original: file.filename,
      saved: uniqueFilename,
      size: file.size,
      type: file.mimetype,
    },
  });
});
```

## Password Security

### Password Hashing

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

// Registration
app.post('/auth/register', async (req, res) => {
  const validation = req.validate({
    email: { required: true, type: 'email' },
    password: {
      required: true,
      minLength: 8,
      pattern:
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      message:
        'Password must contain uppercase, lowercase, number and special character',
    },
  });

  if (!validation.isValid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const { email, password } = validation.sanitized;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Save user (implement your logic)
    const user = await createUser({ email, password: hashedPassword });

    res.status(201).json({
      success: true,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token and set cookie (as shown above)
    // ...
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});
```

## Security Best Practices

### Environment Variables

```bash
# .env file
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
CORS_ORIGIN=https://yourdomain.com
SESSION_SECRET=your-session-secret-key
```

### Production Security Checklist

```typescript
// Production security setup
if (process.env.NODE_ENV === 'production') {
  // Trust proxy (for proper IP detection behind load balancers)
  app.set('trust proxy', 1);

  // Security headers
  app.use((req, res, next) => {
    // Remove X-Powered-By header
    res.removeHeader('X-Powered-By');

    // Security headers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // HTTPS only
    if (req.secure()) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    }

    next();
  });

  // Rate limiting
  app.use(createRateLimiter(1000, 60 * 60 * 1000)); // 1000 requests per hour
}
```

### Error Handling Security

```typescript
// Don't expose sensitive error information
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Generic error response in production
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal Server Error' });
  } else {
    res.status(500).json({
      error: err.message,
      stack: err.stack,
    });
  }
});
```
