# 🛡️ NextRush Validation & Security Guide

## 🎯 Overview

NextRush provides comprehensive input validation and security features to protect your applications from common vulnerabilities and ensure data integrity. The validation system is flexible, performant, and easy to use.

## ✨ Key Features

- **🔍 Schema Validation**: Flexible rule-based validation
- **🧹 Data Sanitization**: XSS protection and input cleaning
- **🛡️ Security Headers**: Automatic security header management
- **🍪 Secure Cookies**: Enhanced cookie security options
- **⚡ Performance**: Optimized validation with minimal overhead
- **🎯 TypeScript Support**: Full type safety for validation rules

## 🚀 Quick Start

```typescript
import { createApp, ValidationPlugin } from 'nextrush';

const app = createApp();

// Basic validation middleware
app.use(
  '/api/users',
  app.validate({
    name: { required: true, type: 'string', minLength: 2 },
    email: { required: true, type: 'email' },
    age: { type: 'number', min: 18 },
  })
);

app.post('/api/users', (req, res) => {
  // req.body is now validated and sanitized
  res.json({ success: true, user: req.body });
});
```

## 🔍 Validation Rules

### Basic Type Validation

```typescript
const userSchema = {
  // String validation
  name: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 50,
  },

  // Email validation
  email: {
    required: true,
    type: 'email',
  },

  // Number validation
  age: {
    type: 'number',
    min: 18,
    max: 120,
  },

  // Boolean validation
  newsletter: {
    type: 'boolean',
  },

  // URL validation
  website: {
    type: 'url',
  },
};

app.use('/api/users', app.validate(userSchema));
```

### Advanced Validation Rules

```typescript
const productSchema = {
  // Required field
  name: {
    required: true,
    type: 'string',
    minLength: 3,
    maxLength: 100,
  },

  // Pattern matching
  sku: {
    required: true,
    type: 'string',
    pattern: /^[A-Z]{2}-\d{4}$/,
  },

  // Enum validation
  category: {
    required: true,
    type: 'string',
    in: ['electronics', 'clothing', 'books', 'home'],
  },

  // Array validation
  tags: {
    type: 'array',
    minLength: 1,
    maxLength: 5,
  },

  // Object validation
  dimensions: {
    type: 'object',
    required: true,
  },

  // Custom validation
  price: {
    required: true,
    type: 'number',
    min: 0,
    custom: (value) => {
      if (value > 10000) {
        return 'Price cannot exceed $10,000';
      }
      return true;
    },
  },
};

app.use('/api/products', app.validate(productSchema));
```

### Conditional Validation

```typescript
const orderSchema = {
  type: {
    required: true,
    type: 'string',
    in: ['standard', 'express', 'overnight'],
  },

  // Conditional field based on type
  expressCode: {
    type: 'string',
    custom: (value, data) => {
      if (data.type === 'express' && !value) {
        return 'Express code is required for express orders';
      }
      return true;
    },
  },

  // Dynamic validation
  shippingAddress: {
    required: true,
    type: 'object',
    custom: (value, data) => {
      if (data.type === 'overnight' && !value.zipCode) {
        return 'ZIP code is required for overnight delivery';
      }
      return true;
    },
  },
};
```

## 🧹 Data Sanitization

### Basic Sanitization

```typescript
// Global sanitization
app.use(
  app.sanitize({
    removeHtml: true, // Remove HTML tags
    escapeHtml: true, // Escape HTML entities
    trim: true, // Trim whitespace
    removeSpecialChars: false, // Keep special characters
  })
);

// Route-specific sanitization
app.use(
  '/api/comments',
  app.sanitize({
    removeHtml: true,
    escapeHtml: true,
    allowedTags: ['b', 'i', 'em', 'strong'],
  })
);
```

### Advanced Sanitization

```typescript
const sanitizeOptions = {
  // HTML sanitization
  removeHtml: true,
  escapeHtml: true,
  allowedTags: ['p', 'br', 'strong', 'em'],

  // String manipulation
  trim: true,
  lowercase: false,
  uppercase: false,

  // Security
  removeSpecialChars: false,

  // Custom sanitization
  custom: (value, key) => {
    if (key === 'phone') {
      // Remove non-digit characters from phone numbers
      return value.replace(/\D/g, '');
    }
    return value;
  },
};

app.use('/api/contact', app.sanitize(sanitizeOptions));
```

## 🛡️ XSS Protection

### Automatic XSS Protection

```typescript
// Enable XSS protection middleware
app.use(app.xssProtection());

// This automatically:
// 1. Sets X-XSS-Protection header
// 2. Sets X-Content-Type-Options header
// 3. Sets X-Frame-Options header
// 4. Sanitizes request body for XSS
```

### Custom XSS Protection

```typescript
app.use((req, res, next) => {
  // Custom XSS protection
  if (req.body) {
    req.body = sanitizeXSS(req.body, {
      whiteList: {
        a: ['href', 'title'],
        p: [],
        br: [],
      },
    });
  }

  // Set security headers
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  next();
});
```

## 🍪 Secure Cookie Management

### Enhanced Cookie Security

```typescript
app.post('/login', (req, res) => {
  const sessionId = generateSessionId();

  // Secure cookie with all options
  res.cookie('session', sessionId, {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true, // Prevent XSS access
    secure: req.secure(), // HTTPS only
    sameSite: 'strict', // CSRF protection
    path: '/', // Cookie path
    domain: '.example.com', // Cookie domain
  });

  // Additional security cookie
  res.cookie('csrf-token', generateCSRFToken(), {
    httpOnly: false, // Accessible to JS for CSRF
    secure: req.secure(),
    sameSite: 'strict',
  });

  res.json({ success: true });
});

// Secure cookie clearing
app.post('/logout', (req, res) => {
  res.clearCookie('session', {
    path: '/',
    domain: '.example.com',
  });
  res.clearCookie('csrf-token');
  res.json({ success: true });
});
```

### Cookie Parsing and Validation

```typescript
app.use((req, res, next) => {
  // Parse cookies
  const cookies = req.parseCookies();

  // Validate session cookie
  if (cookies.session) {
    const isValid = validateSession(cookies.session);
    if (!isValid) {
      res.clearCookie('session');
      return res.status(401).json({ error: 'Invalid session' });
    }
  }

  next();
});
```

## 🔒 Security Headers

### Comprehensive Security Headers

```typescript
// Security middleware
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
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' https:; " +
      "connect-src 'self';"
  );

  // HTTPS Strict Transport Security
  if (req.secure()) {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  next();
});
```

### Environment-Specific Security

```typescript
const isProduction = process.env.NODE_ENV === 'production';

app.use((req, res, next) => {
  if (isProduction) {
    // Production security headers
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  } else {
    // Development headers
    res.setHeader('X-Development-Mode', 'true');
  }

  next();
});
```

## 🔍 Advanced Validation Patterns

### Multi-Step Validation

```typescript
// Step 1: Basic validation
app.use(
  '/api/users',
  app.validate({
    email: { required: true, type: 'email' },
    password: { required: true, type: 'string', minLength: 8 },
  })
);

// Step 2: Business logic validation
app.use('/api/users', async (req, res, next) => {
  const { email } = req.body;

  // Check if email already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    return res.status(409).json({
      error: 'Email already registered',
      field: 'email',
    });
  }

  next();
});

// Step 3: Password strength validation
app.use('/api/users', (req, res, next) => {
  const { password } = req.body;

  const strength = checkPasswordStrength(password);
  if (strength.score < 3) {
    return res.status(400).json({
      error: 'Password too weak',
      suggestions: strength.suggestions,
    });
  }

  next();
});
```

### File Upload Validation

```typescript
const fileUploadSchema = {
  file: {
    required: true,
    custom: (file) => {
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.mimetype)) {
        return 'Invalid file type. Only JPEG, PNG, and GIF allowed.';
      }

      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        return 'File too large. Maximum size is 5MB.';
      }

      // Check filename
      if (!/^[a-zA-Z0-9._-]+$/.test(file.originalname)) {
        return 'Invalid filename. Only alphanumeric characters, dots, underscores, and hyphens allowed.';
      }

      return true;
    },
  },
};

app.post('/upload', app.validate(fileUploadSchema), (req, res) => {
  // File is validated
  const file = req.file;
  res.json({ success: true, filename: file.filename });
});
```

## 🎯 Real-World Examples

### E-commerce Product Validation

```typescript
const productValidation = {
  name: {
    required: true,
    type: 'string',
    minLength: 3,
    maxLength: 100,
    custom: (value) => {
      // Prevent inappropriate content
      const bannedWords = ['spam', 'fake', 'scam'];
      if (bannedWords.some((word) => value.toLowerCase().includes(word))) {
        return 'Product name contains inappropriate content';
      }
      return true;
    },
  },

  price: {
    required: true,
    type: 'number',
    min: 0.01,
    max: 10000,
    custom: (value) => {
      // Ensure price has max 2 decimal places
      if (!/^\d+(\.\d{1,2})?$/.test(value.toString())) {
        return 'Price must have at most 2 decimal places';
      }
      return true;
    },
  },

  category: {
    required: true,
    type: 'string',
    in: ['electronics', 'clothing', 'books', 'home', 'sports'],
  },

  inventory: {
    required: true,
    type: 'number',
    min: 0,
    custom: (value) => {
      // Ensure integer
      if (!Number.isInteger(value)) {
        return 'Inventory must be a whole number';
      }
      return true;
    },
  },
};

app.use('/api/products', app.validate(productValidation));
```

### User Registration with Complex Rules

```typescript
const registrationValidation = {
  username: {
    required: true,
    type: 'string',
    minLength: 3,
    maxLength: 20,
    pattern: /^[a-zA-Z0-9_]+$/,
    custom: async (value) => {
      // Check username availability
      const exists = await User.findByUsername(value);
      if (exists) {
        return 'Username already taken';
      }
      return true;
    },
  },

  email: {
    required: true,
    type: 'email',
    custom: async (value) => {
      // Check email domain
      const domain = value.split('@')[1];
      const blockedDomains = ['tempmail.com', '10minutemail.com'];
      if (blockedDomains.includes(domain)) {
        return 'Temporary email addresses not allowed';
      }

      // Check email availability
      const exists = await User.findByEmail(value);
      if (exists) {
        return 'Email already registered';
      }

      return true;
    },
  },

  password: {
    required: true,
    type: 'string',
    minLength: 8,
    custom: (value) => {
      // Password complexity requirements
      const hasUpper = /[A-Z]/.test(value);
      const hasLower = /[a-z]/.test(value);
      const hasNumber = /\d/.test(value);
      const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value);

      if (!hasUpper) return 'Password must contain uppercase letter';
      if (!hasLower) return 'Password must contain lowercase letter';
      if (!hasNumber) return 'Password must contain number';
      if (!hasSpecial) return 'Password must contain special character';

      return true;
    },
  },

  age: {
    required: true,
    type: 'number',
    min: 13,
    max: 120,
    custom: (value, data) => {
      // Special validation for minors
      if (value < 18 && !data.parentalConsent) {
        return 'Parental consent required for users under 18';
      }
      return true;
    },
  },
};
```

## 📊 Validation Performance

### Optimized Validation

```typescript
// Cache validation schemas for better performance
const schemaCache = new Map();

function getCachedValidator(schemaKey, schema) {
  if (!schemaCache.has(schemaKey)) {
    schemaCache.set(schemaKey, compileSchema(schema));
  }
  return schemaCache.get(schemaKey);
}

// Use cached validators
app.use('/api/users', (req, res, next) => {
  const validator = getCachedValidator('user', userSchema);
  const result = validator(req.body);

  if (!result.isValid) {
    return res.status(400).json({ errors: result.errors });
  }

  req.body = result.sanitized;
  next();
});
```

## 🎯 Best Practices

1. **Validate early and often** - Validate at API boundaries
2. **Sanitize all input** - Never trust user input
3. **Use strong typing** - Leverage TypeScript for additional safety
4. **Implement rate limiting** - Prevent abuse and brute force attacks
5. **Log security events** - Monitor for suspicious activity
6. **Keep dependencies updated** - Regular security updates
7. **Use HTTPS everywhere** - Encrypt data in transit
8. **Implement proper error handling** - Don't leak sensitive information

## ⚡ Performance Tips

- Cache compiled validation schemas
- Use efficient regex patterns
- Implement async validation carefully
- Sanitize only when necessary
- Use middleware ordering strategically
- Monitor validation performance

The validation and security features in NextRush provide comprehensive protection while maintaining excellent performance and developer experience.
