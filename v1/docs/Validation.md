# 🛡️ Validation & Security

## 📚 Table of Contents

- [📖 Introduction](#-introduction)
- [🔧 Public APIs](#-public-apis)
  - [📋 Configuration Interfaces](#-configuration-interfaces)
  - [🛠️ Validation Methods](#️-validation-methods)
  - [🔒 Security Features](#-security-features)
- [💻 Usage Examples](#-usage-examples)
- [⚙️ Configuration Options](#️-configuration-options)
- [📝 Notes](#-notes)

## 📖 Introduction

The NextRush Validation & Security plugin provides comprehensive input validation, sanitization, and security features to protect your application from malicious input, XSS attacks, and data integrity issues. It offers flexible validation rules, automatic sanitization, and built-in security headers.

## 🔧 Public APIs

### 📋 Configuration Interfaces

| Interface             | Description                                          |
| --------------------- | ---------------------------------------------------- |
| `ValidationRule`      | Individual field validation rule definition.         |
| `ValidationSchema`    | Complete validation schema for request data.         |
| `SanitizationOptions` | Configuration for data sanitization.                 |
| `ValidationResult`    | Result of validation with errors and sanitized data. |

#### ValidationRule Properties

| Property    | Type                                                                           | Description                          |
| ----------- | ------------------------------------------------------------------------------ | ------------------------------------ |
| `required`  | `boolean`                                                                      | Whether the field is required.       |
| `type`      | `'string' \| 'number' \| 'email' \| 'url' \| 'boolean' \| 'array' \| 'object'` | Expected data type.                  |
| `minLength` | `number`                                                                       | Minimum string length.               |
| `maxLength` | `number`                                                                       | Maximum string length.               |
| `min`       | `number`                                                                       | Minimum numeric value.               |
| `max`       | `number`                                                                       | Maximum numeric value.               |
| `pattern`   | `RegExp`                                                                       | Regular expression pattern to match. |
| `in`        | `any[]`                                                                        | Array of allowed values.             |
| `custom`    | `(value: any) => boolean \| string`                                            | Custom validation function.          |

#### SanitizationOptions Properties

| Property             | Type       | Default | Description                           |
| -------------------- | ---------- | ------- | ------------------------------------- |
| `removeHtml`         | `boolean`  | `false` | Remove HTML tags from strings.        |
| `escapeHtml`         | `boolean`  | `false` | Escape HTML entities in strings.      |
| `trim`               | `boolean`  | `false` | Trim whitespace from strings.         |
| `lowercase`          | `boolean`  | `false` | Convert strings to lowercase.         |
| `uppercase`          | `boolean`  | `false` | Convert strings to uppercase.         |
| `removeSpecialChars` | `boolean`  | `false` | Remove special characters.            |
| `allowedTags`        | `string[]` | `[]`    | HTML tags to keep when removing HTML. |

#### ValidationResult Properties

| Property    | Type                       | Description                      |
| ----------- | -------------------------- | -------------------------------- |
| `isValid`   | `boolean`                  | Whether validation passed.       |
| `errors`    | `Record<string, string[]>` | Validation errors by field.      |
| `sanitized` | `Record<string, any>`      | Sanitized data after processing. |

### 🛠️ Validation Methods

| Method               | Signature                                               | Description                                     |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| `validate(schema)`   | `(schema: ValidationSchema) => MiddlewareFunction`      | Create validation middleware for request data.  |
| `sanitize(options?)` | `(options?: SanitizationOptions) => MiddlewareFunction` | Create sanitization middleware.                 |
| `xssProtection()`    | `() => MiddlewareFunction`                              | Enable XSS protection headers and sanitization. |

### 🔒 Security Features

The plugin provides built-in security features including:

- **XSS Protection**: Automatic HTML escaping and removal
- **Security Headers**: X-XSS-Protection, X-Content-Type-Options, X-Frame-Options
- **Input Sanitization**: Configurable data cleaning
- **Type Safety**: Strong typing and validation
- **Custom Rules**: Extensible validation logic

## 💻 Usage Examples

### Basic Validation

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Simple user registration validation
const userSchema = {
  username: {
    required: true,
    type: 'string',
    minLength: 3,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9_]+$/,
  },
  email: {
    required: true,
    type: 'email',
  },
  password: {
    required: true,
    type: 'string',
    minLength: 8,
    maxLength: 128,
  },
  age: {
    type: 'number',
    min: 13,
    max: 120,
  },
};

app.post('/api/users/register', app.validate(userSchema), (req, res) => {
  // req.body is now validated and sanitized
  const { username, email, password, age } = req.body;

  // Registration logic
  res.status(201).json({
    message: 'User registered successfully',
    user: { username, email, age },
  });
});

app.listen(3000);
```

### Advanced Validation Rules

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Product validation with custom rules
const productSchema = {
  name: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 200,
    custom: (value) => {
      // Custom validation: no profanity
      const profanityWords = ['spam', 'fake', 'scam'];
      const containsProfanity = profanityWords.some((word) =>
        value.toLowerCase().includes(word)
      );
      return containsProfanity
        ? 'Product name contains inappropriate content'
        : true;
    },
  },

  price: {
    required: true,
    type: 'number',
    min: 0.01,
    max: 999999.99,
    custom: (value) => {
      // Must have at most 2 decimal places
      return (
        Number.isInteger(value * 100) ||
        'Price must have at most 2 decimal places'
      );
    },
  },

  category: {
    required: true,
    type: 'string',
    in: ['electronics', 'clothing', 'books', 'home', 'sports'],
  },

  tags: {
    type: 'array',
    custom: (value) => {
      if (!Array.isArray(value)) return 'Tags must be an array';
      if (value.length > 10) return 'Maximum 10 tags allowed';
      return (
        value.every((tag) => typeof tag === 'string' && tag.length <= 50) ||
        'Each tag must be a string with max 50 characters'
      );
    },
  },

  specifications: {
    type: 'object',
    custom: (value) => {
      if (typeof value !== 'object' || value === null)
        return 'Specifications must be an object';
      const keys = Object.keys(value);
      if (keys.length > 20) return 'Maximum 20 specifications allowed';
      return (
        keys.every((key) => typeof value[key] === 'string') ||
        'All specification values must be strings'
      );
    },
  },

  website: {
    type: 'url',
    custom: (value) => {
      // Only allow HTTPS URLs
      return value.startsWith('https://') || 'Only HTTPS URLs are allowed';
    },
  },
};

app.post('/api/products', app.validate(productSchema), (req, res) => {
  // All validation passed
  const product = createProduct(req.body);
  res.status(201).json({ product });
});

app.listen(3000);
```

### Data Sanitization

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Basic sanitization middleware
app.use(
  '/api/comments',
  app.sanitize({
    removeHtml: true,
    escapeHtml: true,
    trim: true,
  })
);

// Comment creation with validation and sanitization
const commentSchema = {
  content: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 1000,
  },
  author: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 100,
  },
};

app.post('/api/comments', app.validate(commentSchema), (req, res) => {
  // Content is already sanitized by the sanitize middleware
  const comment = createComment(req.body);
  res.status(201).json({ comment });
});

// Advanced sanitization for different content types
app.post(
  '/api/articles',
  app.sanitize({
    removeHtml: false, // Keep HTML for rich content
    escapeHtml: false,
    trim: true,
    allowedTags: ['p', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h2', 'h3'],
  }),
  app.validate({
    title: {
      required: true,
      type: 'string',
      minLength: 5,
      maxLength: 200,
    },
    content: {
      required: true,
      type: 'string',
      minLength: 100,
      maxLength: 50000,
    },
    tags: {
      type: 'array',
      custom: (value) => Array.isArray(value) && value.length <= 10,
    },
  }),
  (req, res) => {
    const article = createArticle(req.body);
    res.status(201).json({ article });
  }
);

app.listen(3000);
```

### XSS Protection

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Enable XSS protection globally
app.use(app.xssProtection());

// Additional protection for user-generated content
app.use(
  '/api/user-content',
  app.sanitize({
    removeHtml: true,
    escapeHtml: true,
    removeSpecialChars: true,
  })
);

// User profile update with XSS protection
const profileSchema = {
  bio: {
    type: 'string',
    maxLength: 500,
    custom: (value) => {
      // Additional XSS check
      const xssPatterns = [/<script/i, /javascript:/i, /on\w+=/i];
      const hasXSS = xssPatterns.some((pattern) => pattern.test(value));
      return !hasXSS || 'Bio contains potentially malicious content';
    },
  },
  website: {
    type: 'url',
    custom: (value) => {
      // Only allow safe protocols
      const safeProtocols = ['http:', 'https:'];
      try {
        const url = new URL(value);
        return (
          safeProtocols.includes(url.protocol) || 'Only HTTP/HTTPS URLs allowed'
        );
      } catch {
        return 'Invalid URL format';
      }
    },
  },
};

app.put('/api/users/profile', app.validate(profileSchema), (req, res) => {
  const profile = updateUserProfile(req.user.id, req.body);
  res.json({ profile });
});

app.listen(3000);
```

### File Upload Validation

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// File upload validation
const fileUploadSchema = {
  file: {
    required: true,
    custom: (file) => {
      if (!file || typeof file !== 'object') return 'File is required';

      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) return 'File size must be less than 5MB';

      // Check file type
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
      ];
      if (!allowedTypes.includes(file.type)) {
        return 'Only JPEG, PNG, GIF, and WebP images are allowed';
      }

      // Check filename
      if (!/^[a-zA-Z0-9._-]+$/.test(file.name)) {
        return 'Filename contains invalid characters';
      }

      return true;
    },
  },

  description: {
    type: 'string',
    maxLength: 200,
    custom: (value) => {
      // No HTML in description
      return (
        !/<[^>]*>/.test(value) || 'HTML tags are not allowed in description'
      );
    },
  },
};

app.post('/api/upload', app.validate(fileUploadSchema), (req, res) => {
  const uploadResult = processFileUpload(req.body.file);
  res.json({ upload: uploadResult });
});

app.listen(3000);
```

### Complex Nested Validation

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Complex order validation with nested objects
const orderSchema = {
  customer: {
    required: true,
    type: 'object',
    custom: (customer) => {
      if (!customer.name || typeof customer.name !== 'string') {
        return 'Customer name is required';
      }
      if (!customer.email || !/\S+@\S+\.\S+/.test(customer.email)) {
        return 'Valid customer email is required';
      }
      return true;
    },
  },

  items: {
    required: true,
    type: 'array',
    custom: (items) => {
      if (!Array.isArray(items) || items.length === 0) {
        return 'At least one item is required';
      }

      if (items.length > 50) {
        return 'Maximum 50 items per order';
      }

      // Validate each item
      for (const item of items) {
        if (!item.productId || typeof item.productId !== 'string') {
          return 'Each item must have a valid productId';
        }
        if (
          !item.quantity ||
          typeof item.quantity !== 'number' ||
          item.quantity < 1
        ) {
          return 'Each item must have a valid quantity (minimum 1)';
        }
        if (item.quantity > 999) {
          return 'Maximum quantity per item is 999';
        }
      }

      return true;
    },
  },

  shipping: {
    required: true,
    type: 'object',
    custom: (shipping) => {
      const requiredFields = ['address', 'city', 'country', 'postalCode'];

      for (const field of requiredFields) {
        if (!shipping[field] || typeof shipping[field] !== 'string') {
          return `Shipping ${field} is required`;
        }
      }

      // Validate postal code format
      if (!/^[A-Z0-9\s-]{3,12}$/i.test(shipping.postalCode)) {
        return 'Invalid postal code format';
      }

      return true;
    },
  },

  paymentMethod: {
    required: true,
    type: 'string',
    in: ['credit_card', 'debit_card', 'paypal', 'bank_transfer'],
  },
};

app.post(
  '/api/orders',
  app.sanitize({ trim: true, escapeHtml: true }),
  app.validate(orderSchema),
  (req, res) => {
    const order = processOrder(req.body);
    res.status(201).json({ order });
  }
);

app.listen(3000);
```

## ⚙️ Configuration Options

### Global Validation Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Apply validation globally with custom error handling
app.use((req, res, next) => {
  // Custom validation error handler
  const originalSend = res.json;
  res.json = function (data) {
    if (res.statusCode === 400 && data.error === 'Validation failed') {
      // Transform validation errors for client
      const transformedErrors = {};
      for (const [field, errors] of Object.entries(data.details)) {
        transformedErrors[field] = errors[0]; // Take first error
      }

      return originalSend.call(this, {
        success: false,
        message: 'Please check your input and try again',
        errors: transformedErrors,
        timestamp: new Date().toISOString(),
      });
    }

    return originalSend.call(this, data);
  };

  next();
});

// Global sanitization for all routes
app.use(
  app.sanitize({
    trim: true,
    escapeHtml: true,
  })
);

// Global XSS protection
app.use(app.xssProtection());

app.listen(3000);
```

### Environment-Based Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Different validation strictness by environment
const isProduction = process.env.NODE_ENV === 'production';

const sanitizationOptions = {
  removeHtml: isProduction,
  escapeHtml: true,
  trim: true,
  removeSpecialChars: isProduction,
};

// Stricter validation in production
const createValidationSchema = (baseSchema, isProduction) => {
  if (!isProduction) return baseSchema;

  // Add stricter rules in production
  const productionSchema = { ...baseSchema };

  for (const [field, rule] of Object.entries(productionSchema)) {
    if (rule.type === 'string') {
      rule.maxLength = Math.min(rule.maxLength || 1000, 500); // Stricter limits
    }
  }

  return productionSchema;
};

app.use('/api', app.sanitize(sanitizationOptions));

app.post(
  '/api/feedback',
  app.validate(
    createValidationSchema(
      {
        message: {
          required: true,
          type: 'string',
          minLength: 10,
          maxLength: 2000,
        },
        rating: {
          required: true,
          type: 'number',
          min: 1,
          max: 5,
        },
      },
      isProduction
    )
  ),
  (req, res) => {
    const feedback = createFeedback(req.body);
    res.json({ feedback });
  }
);

app.listen(3000);
```

## 📝 Notes

- **Performance**: Validation adds minimal overhead but can accumulate with complex schemas. Design efficient validation rules.

- **Error Messages**: Provide clear, actionable error messages to help users understand what needs to be corrected.

- **Security First**: Always sanitize user input, especially when displaying it back to users or storing in databases.

- **Type Safety**: Use TypeScript interfaces to ensure validation schemas match your data models.

- **Custom Validation**: Leverage custom validation functions for business-specific rules that can't be expressed with built-in validators.

- **Sanitization Strategy**: Choose appropriate sanitization based on data usage - more aggressive for public display, less for internal processing.

- **XSS Prevention**: Always enable XSS protection for applications handling user-generated content.

- **Nested Validation**: For complex nested objects, consider breaking validation into smaller, reusable schemas.

- **Testing**: Thoroughly test validation logic with edge cases, malicious input, and boundary conditions.

- **Documentation**: Document validation rules clearly for API consumers and team members.

- **Internationalization**: Consider validation message localization for multi-language applications.

- **Rate Limiting**: Combine validation with rate limiting to prevent abuse through invalid requests.
