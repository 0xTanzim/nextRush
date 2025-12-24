# Validation Utilities

Comprehensive request validation and data sanitization utilities for NextRush v2 applications with type-safe validation schemas.

## What it is

Validation Utilities provide a flexible validation system for request data, including type checking, length validation, pattern matching, and data sanitization. The system supports custom validation rules and provides detailed error reporting.

## When to use

- Validating request body data in API endpoints
- Sanitizing user input to prevent XSS attacks
- Enforcing data integrity constraints
- Creating type-safe request handlers
- Building reusable validation schemas

## Core Components

### ValidationError Class

Specialized error class for validation failures with detailed field information.

```typescript
import { ValidationError } from 'nextrush/validation';

// Single field error
const error = ValidationError.forField(
  'email',
  'Invalid email format',
  'invalid@'
);

// Multiple field errors
const errors = ValidationError.forFields([
  { field: 'name', message: 'Name is required' },
  { field: 'age', message: 'Age must be a number', value: 'invalid' },
]);
```

**Static Methods:**

- `forField(field: string, message: string, value?: unknown): ValidationError` - Create single field error
- `forFields(errors: Array<{field: string; message: string; value?: unknown}>): ValidationError` - Create multi-field error

**Properties:**

- `field?: string` - Field name that failed validation
- `value?: unknown` - Invalid value that caused the error
- `errors?: Array<{field: string; message: string; value?: unknown}>` - Multiple validation errors

## Validation Functions

### validateRequest()

Validate request data against a validation schema.

```typescript
import { validateRequest } from 'nextrush/validation';
import type { Context } from 'nextrush/types';

const userSchema = {
  name: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 50,
  },
  email: {
    required: true,
    type: 'email',
  },
  age: {
    type: 'number',
    min: 18,
    max: 120,
  },
  role: {
    enum: ['user', 'admin', 'moderator'],
  },
};

app.post('/users', async (ctx: Context) => {
  try {
    const userData = validateRequest<UserData>(ctx, userSchema);
    const user = await createUser(userData);
    ctx.res.json(user);
  } catch (error) {
    if (error instanceof ValidationError) {
      ctx.res.status(400).json({
        error: 'Validation failed',
        details: error.errors || [
          { field: error.field, message: error.message },
        ],
      });
    }
  }
});
```

**Parameters:**

- `ctx: Context` - Request context containing body data
- `schema: Record<string, unknown>` - Validation schema definition

**Returns:** `T` - Validated data typed as T

**Throws:** `ValidationError` - When validation fails

### validateAndSanitize()

Validate and sanitize request data in a single operation.

```typescript
import { validateAndSanitize } from 'nextrush/validation';

const commentSchema = {
  content: {
    required: true,
    type: 'string',
    maxLength: 1000,
  },
  authorName: {
    required: true,
    type: 'string',
    minLength: 2,
  },
};

app.post('/comments', async ctx => {
  try {
    // Validates and sanitizes in one step
    const commentData = validateAndSanitize<CommentData>(ctx, commentSchema);

    const comment = await createComment(commentData);
    ctx.res.json(comment);
  } catch (error) {
    if (error instanceof ValidationError) {
      ctx.res.status(400).json({ error: error.message });
    }
  }
});
```

**Parameters:**

- `ctx: Context` - Request context containing body data
- `schema: Record<string, unknown>` - Validation schema definition

**Returns:** `T` - Validated and sanitized data

**Throws:** `ValidationError` - When validation fails

### sanitizeInput()

Sanitize input data to prevent XSS attacks and clean user input.

```typescript
import { sanitizeInput } from 'nextrush/validation';

// Sanitize different data types
const cleanString = sanitizeInput('<script>alert("xss")</script>Hello');
console.log(cleanString); // 'Hello'

const cleanObject = sanitizeInput({
  name: '  John Doe  ',
  bio: '<script>malicious</script>I am a developer',
  tags: ['<tag>', 'javascript:void(0)', 'clean-tag'],
});

console.log(cleanObject);
// {
//   name: 'John Doe',
//   bio: 'I am a developer',
//   tags: ['', '', 'clean-tag']
// }
```

**Parameters:**

- `data: unknown` - Data to sanitize (string, object, or array)

**Returns:** `unknown` - Sanitized data

**Sanitization Rules:**

- Trims whitespace from strings
- Removes HTML tags (`<>`)
- Removes `javascript:` protocol
- Removes event handlers (`onXxx=`)
- Recursively processes objects and arrays

## Validation Schema Rules

### Type Validation

```typescript
const schema = {
  name: { type: 'string' },
  age: { type: 'number' },
  active: { type: 'boolean' },
  tags: { type: 'array' },
  metadata: { type: 'object' },
  email: { type: 'email' }, // Special email validation
  website: { type: 'url' }, // Special URL validation
};
```

### Required Fields

```typescript
const schema = {
  username: { required: true, type: 'string' },
  password: { required: true, type: 'string' },
  confirmPassword: { required: true, type: 'string' },
};
```

### Length Validation

```typescript
const schema = {
  username: {
    type: 'string',
    minLength: 3,
    maxLength: 20,
  },
  bio: {
    type: 'string',
    maxLength: 500,
  },
};
```

### Numeric Range Validation

```typescript
const schema = {
  age: {
    type: 'number',
    min: 18,
    max: 100,
  },
  score: {
    type: 'number',
    min: 0,
    max: 100,
  },
};
```

### Pattern Validation

```typescript
const schema = {
  phoneNumber: {
    type: 'string',
    pattern: '^\\+?[1-9]\\d{1,14}$',
  },
  username: {
    type: 'string',
    pattern: '^[a-zA-Z0-9_]+$',
  },
};
```

### Enum Validation

```typescript
const schema = {
  role: {
    enum: ['user', 'admin', 'moderator'],
  },
  status: {
    enum: ['active', 'inactive', 'pending'],
  },
};
```

### Custom Validation

```typescript
const schema = {
  password: {
    type: 'string',
    validate: (value: string) => {
      // Custom password strength validation
      return (
        value.length >= 8 &&
        /[A-Z]/.test(value) &&
        /[a-z]/.test(value) &&
        /[0-9]/.test(value)
      );
    },
    message:
      'Password must be at least 8 characters with uppercase, lowercase, and number',
  },
};
```

## Complete Examples

### User Registration API

```typescript
// user-registration.ts
import { createApp } from 'nextrush';
import { validateAndSanitize, ValidationError } from 'nextrush/validation';

const app = createApp();

// User registration schema
const userRegistrationSchema = {
  username: {
    required: true,
    type: 'string',
    minLength: 3,
    maxLength: 20,
    pattern: '^[a-zA-Z0-9_]+$',
  },
  email: {
    required: true,
    type: 'email',
  },
  password: {
    required: true,
    type: 'string',
    minLength: 8,
    validate: (password: string) => {
      return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password);
    },
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  },
  confirmPassword: {
    required: true,
    type: 'string',
  },
  age: {
    required: true,
    type: 'number',
    min: 18,
    max: 120,
  },
  terms: {
    required: true,
    type: 'boolean',
    validate: (value: boolean) => value === true,
    message: 'You must accept the terms and conditions',
  },
};

app.post('/register', async ctx => {
  try {
    const userData = validateAndSanitize<UserRegistrationData>(
      ctx,
      userRegistrationSchema
    );

    // Additional custom validation
    if (userData.password !== userData.confirmPassword) {
      throw ValidationError.forField(
        'confirmPassword',
        'Passwords do not match'
      );
    }

    // Check if username already exists
    const existingUser = await findUserByUsername(userData.username);
    if (existingUser) {
      throw ValidationError.forField('username', 'Username already taken');
    }

    // Create user
    const user = await createUser({
      username: userData.username,
      email: userData.email,
      password: userData.password,
      age: userData.age,
    });

    ctx.res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      ctx.res.status(400).json({
        error: 'Validation failed',
        details: error.errors || [
          {
            field: error.field,
            message: error.message,
            value: error.value,
          },
        ],
      });
    } else {
      ctx.res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default app;
```

### Blog Post API with Rich Validation

```typescript
// blog-post-api.ts
import { createApp } from 'nextrush';
import {
  validateRequest,
  sanitizeInput,
  ValidationError,
} from 'nextrush/validation';

const app = createApp();

// Blog post schema
const blogPostSchema = {
  title: {
    required: true,
    type: 'string',
    minLength: 5,
    maxLength: 100,
  },
  content: {
    required: true,
    type: 'string',
    minLength: 50,
    maxLength: 10000,
  },
  excerpt: {
    type: 'string',
    maxLength: 300,
  },
  tags: {
    type: 'array',
    validate: (tags: string[]) => {
      return (
        Array.isArray(tags) &&
        tags.length <= 10 &&
        tags.every(tag => typeof tag === 'string' && tag.length <= 30)
      );
    },
    message: 'Tags must be an array of strings (max 10 tags, 30 chars each)',
  },
  category: {
    required: true,
    enum: ['technology', 'lifestyle', 'business', 'education', 'entertainment'],
  },
  published: {
    type: 'boolean',
  },
  publishDate: {
    type: 'string',
    pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}',
    validate: (dateStr: string) => {
      const date = new Date(dateStr);
      return !isNaN(date.getTime()) && date > new Date();
    },
    message: 'Publish date must be a valid future date in ISO format',
  },
};

app.post('/posts', async ctx => {
  try {
    // Validate request data
    const postData = validateRequest<BlogPostData>(ctx, blogPostSchema);

    // Additional sanitization for content
    const sanitizedPost = {
      ...postData,
      content: sanitizeInput(postData.content),
      title: sanitizeInput(postData.title),
      excerpt: postData.excerpt ? sanitizeInput(postData.excerpt) : undefined,
    };

    // Create blog post
    const post = await createBlogPost(sanitizedPost);

    ctx.res.status(201).json({
      message: 'Blog post created successfully',
      post: {
        id: post.id,
        title: post.title,
        excerpt: post.excerpt,
        category: post.category,
        tags: post.tags,
        published: post.published,
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      ctx.res.status(400).json({
        error: 'Validation failed',
        details: error.errors || [
          {
            field: error.field,
            message: error.message,
          },
        ],
      });
    } else {
      ctx.res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Update blog post with partial validation
const updateBlogPostSchema = {
  title: {
    type: 'string',
    minLength: 5,
    maxLength: 100,
  },
  content: {
    type: 'string',
    minLength: 50,
    maxLength: 10000,
  },
  tags: {
    type: 'array',
    validate: (tags: string[]) => {
      return Array.isArray(tags) && tags.length <= 10;
    },
    message: 'Tags must be an array with maximum 10 items',
  },
  category: {
    enum: ['technology', 'lifestyle', 'business', 'education', 'entertainment'],
  },
  published: {
    type: 'boolean',
  },
};

app.put('/posts/:id', async ctx => {
  try {
    const postId = ctx.params.id;

    // Validate partial update data
    const updateData = validateRequest<Partial<BlogPostData>>(
      ctx,
      updateBlogPostSchema
    );

    // Sanitize content if provided
    if (updateData.content) {
      updateData.content = sanitizeInput(updateData.content) as string;
    }
    if (updateData.title) {
      updateData.title = sanitizeInput(updateData.title) as string;
    }

    const updatedPost = await updateBlogPost(postId, updateData);

    ctx.res.json({
      message: 'Blog post updated successfully',
      post: updatedPost,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      ctx.res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    } else {
      ctx.res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default app;
```

### Advanced Custom Validation

```typescript
// custom-validation.ts
import { validateRequest, ValidationError } from 'nextrush/validation';

// Custom validation functions
const validators = {
  strongPassword: (password: string): boolean => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= 8;

    return (
      hasUpperCase &&
      hasLowerCase &&
      hasNumbers &&
      hasSpecialChar &&
      isLongEnough
    );
  },

  uniqueEmail: async (email: string): Promise<boolean> => {
    // This would need to be async in real implementation
    const existingUser = await findUserByEmail(email);
    return !existingUser;
  },

  validCreditCard: (cardNumber: string): boolean => {
    // Luhn algorithm implementation
    const digits = cardNumber.replace(/\D/g, '');
    let sum = 0;
    let alternate = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i]);

      if (alternate) {
        digit *= 2;
        if (digit > 9) {
          digit = (digit % 10) + 1;
        }
      }

      sum += digit;
      alternate = !alternate;
    }

    return sum % 10 === 0;
  },
};

// Advanced user schema with custom validations
const advancedUserSchema = {
  email: {
    required: true,
    type: 'email',
    validate: validators.uniqueEmail,
    message: 'Email address is already registered',
  },
  password: {
    required: true,
    type: 'string',
    validate: validators.strongPassword,
    message:
      'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
  },
  creditCard: {
    type: 'string',
    pattern: '^[0-9]{13,19}$',
    validate: validators.validCreditCard,
    message: 'Invalid credit card number',
  },
  birthDate: {
    required: true,
    type: 'string',
    validate: (dateStr: string) => {
      const birthDate = new Date(dateStr);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      return age >= 18 && age <= 120;
    },
    message: 'You must be between 18 and 120 years old',
  },
};

app.post('/advanced-user', async ctx => {
  try {
    const userData = validateRequest<AdvancedUserData>(ctx, advancedUserSchema);

    // Create user with validated data
    const user = await createAdvancedUser(userData);

    ctx.res.status(201).json({
      message: 'User created successfully',
      userId: user.id,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      ctx.res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
  }
});
```

## Validation Schema Reference

### Complete Rule Options

```typescript
interface ValidationRule {
  required?: boolean; // Field is required
  type?: string; // Data type validation
  minLength?: number; // Minimum string length
  maxLength?: number; // Maximum string length
  min?: number; // Minimum numeric value
  max?: number; // Maximum numeric value
  pattern?: string; // Regex pattern
  enum?: unknown[]; // Allowed values
  validate?: (value: unknown) => boolean; // Custom validation function
  message?: string; // Custom error message
}
```

### Built-in Types

| Type      | Description   | Validation                                           |
| --------- | ------------- | ---------------------------------------------------- |
| `string`  | String value  | `typeof value === 'string'`                          |
| `number`  | Numeric value | `typeof value === 'number'`                          |
| `boolean` | Boolean value | `typeof value === 'boolean'`                         |
| `array`   | Array value   | `Array.isArray(value)`                               |
| `object`  | Object value  | `typeof value === 'object' && !Array.isArray(value)` |
| `email`   | Email address | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`                       |
| `url`     | Valid URL     | `new URL(value)` validation                          |

## Error Handling Patterns

### Single Error Response

```typescript
try {
  const data = validateRequest(ctx, schema);
} catch (error) {
  if (error instanceof ValidationError) {
    ctx.res.status(400).json({
      error: error.message,
      field: error.field,
      value: error.value,
    });
  }
}
```

### Multiple Errors Response

```typescript
try {
  const data = validateRequest(ctx, schema);
} catch (error) {
  if (error instanceof ValidationError && error.errors) {
    ctx.res.status(400).json({
      error: 'Validation failed',
      details: error.errors.map(err => ({
        field: err.field,
        message: err.message,
        value: err.value,
      })),
    });
  }
}
```

### Detailed Error Response

```typescript
try {
  const data = validateRequest(ctx, schema);
} catch (error) {
  if (error instanceof ValidationError) {
    ctx.res.status(400).json({
      success: false,
      error: {
        type: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.errors || [
          {
            field: error.field,
            message: error.message,
            value: error.value,
            code: 'INVALID_VALUE',
          },
        ],
      },
    });
  }
}
```

## Security Notes

- Input sanitization prevents XSS attacks by removing script tags and event handlers
- Pattern validation should be used for sensitive data like phone numbers and IDs
- Custom validation functions should not leak sensitive information in error messages
- Always sanitize data that will be displayed or stored

## Performance Notes

- Validation is performed synchronously for optimal performance
- Schema compilation happens once per schema definition
- Custom validation functions should be optimized for frequently validated fields
- Consider caching validation results for expensive custom validations

## See Also

- [Configuration & Validation](./configuration.md) - Application configuration validation
- [Enhanced Request & Response](./Enhanced-Request-Response.md) - Request body parsing
- [Developer Experience](./developer-experience.md) - Error handling utilities
- [Middleware](./middleware.md) - Built-in validation middleware

## Version

- **Added in:** v2.0.0-alpha.1
- **Status:** Stable
