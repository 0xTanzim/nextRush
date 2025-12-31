# Validation Errors

> Structured input validation with rich error details.

## Overview

Validation errors differ from HTTP errors. When input fails validation, you need:

1. **Multiple errors at once** - Report all issues, not just the first
2. **Field-level details** - Which field failed, what rule, what was expected
3. **Machine-readable format** - Frontend can map errors to form fields
4. **Human-readable messages** - Users understand what went wrong

NextRush's `ValidationError` handles all of this.

## The Problem

Traditional approaches to validation errors are either too simple or too complex:

```typescript
// ❌ Too simple: Returns on first error, gives no details
throw new BadRequestError('Invalid email');

// ❌ Too complex: Manual structure for every endpoint
throw new BadRequestError('Validation failed', {
  details: {
    errors: [
      { field: 'email', message: '...', code: '...' },
      // ...repeat for every field
    ],
  },
});
```

NextRush provides a dedicated `ValidationError` class:

```typescript
// ✅ Structured, multi-field, machine-readable
throw new ValidationError([
  { path: 'email', message: 'Invalid email address', rule: 'email' },
  { path: 'password', message: 'Must be at least 8 characters', rule: 'length' },
]);
```

## ValidationError

The base class for all validation errors.

### Basic Usage

```typescript
import { ValidationError } from '@nextrush/errors';

// Multiple field errors
throw new ValidationError([
  { path: 'email', message: 'Invalid email address' },
  { path: 'password', message: 'Password is required' },
  { path: 'age', message: 'Must be at least 18' },
]);
```

**Response:**
```json
{
  "error": "ValidationError",
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "status": 400,
  "issues": [
    { "path": "email", "message": "Invalid email address" },
    { "path": "password", "message": "Password is required" },
    { "path": "age", "message": "Must be at least 18" }
  ]
}
```

### ValidationIssue Interface

Each issue in the array follows this structure:

```typescript
interface ValidationIssue {
  /** Field path (e.g., 'user.email' or 'items[0].name') */
  path: string;

  /** Error message for this field */
  message: string;

  /** Validation rule that failed (optional) */
  rule?: string;

  /** Expected value or constraint (optional) */
  expected?: unknown;

  /** Actual value received (optional) */
  received?: unknown;
}
```

### Rich Issue Details

Include all available information for better debugging:

```typescript
throw new ValidationError([
  {
    path: 'user.email',
    message: 'Invalid email format',
    rule: 'email',
    expected: 'valid email address',
    received: 'not-an-email',
  },
  {
    path: 'items[0].quantity',
    message: 'Must be at least 1',
    rule: 'min',
    expected: 1,
    received: 0,
  },
]);
```

### Factory Methods

Quick creation for common patterns:

```typescript
import { ValidationError } from '@nextrush/errors';

// From a single field
const error = ValidationError.fromField('email', 'Invalid email', 'email');

// From multiple fields (simple key-value)
const error = ValidationError.fromFields({
  email: 'Invalid email address',
  password: 'Password is required',
  name: 'Name must be at least 2 characters',
});
```

### Helper Methods

Query and manipulate validation errors:

```typescript
const error = new ValidationError([
  { path: 'email', message: 'Invalid email' },
  { path: 'password', message: 'Too short' },
  { path: 'password', message: 'Missing number' },
]);

// Check if field has errors
error.hasErrorFor('email'); // true
error.hasErrorFor('name'); // false

// Get all errors for a field
error.getErrorsFor('password');
// [{ path: 'password', message: 'Too short' }, { path: 'password', message: 'Missing number' }]

// Get first error message for a field
error.getFirstError('password'); // 'Too short'
error.getFirstError('name'); // undefined

// Convert to flat object (first error per field)
error.toFlatObject();
// { email: 'Invalid email', password: 'Too short' }
```

## Specialized Validation Errors

Pre-built classes for common validation scenarios.

### RequiredFieldError

Field is missing or empty.

```typescript
import { RequiredFieldError } from '@nextrush/errors';

if (!ctx.body.email) {
  throw new RequiredFieldError('email');
}
```

**Response:**
```json
{
  "error": "RequiredFieldError",
  "message": "email is required",
  "code": "VALIDATION_ERROR",
  "status": 400,
  "issues": [
    { "path": "email", "message": "email is required", "rule": "required" }
  ]
}
```

### TypeMismatchError

Field has wrong type.

```typescript
import { TypeMismatchError } from '@nextrush/errors';

if (typeof ctx.body.age !== 'number') {
  throw new TypeMismatchError('age', 'number', typeof ctx.body.age);
}
```

**Response:**
```json
{
  "error": "TypeMismatchError",
  "message": "age must be of type number",
  "code": "VALIDATION_ERROR",
  "status": 400,
  "issues": [
    {
      "path": "age",
      "message": "Expected number, received string",
      "rule": "type",
      "expected": "number",
      "received": "string"
    }
  ]
}
```

### RangeError

Numeric value out of range.

```typescript
import { RangeError } from '@nextrush/errors';

// Minimum only
if (age < 18) {
  throw new RangeError('age', 18); // "age must be at least 18"
}

// Maximum only
if (quantity > 100) {
  throw new RangeError('quantity', undefined, 100); // "quantity must be at most 100"
}

// Both min and max
if (score < 0 || score > 100) {
  throw new RangeError('score', 0, 100); // "score must be at least 0 and at most 100"
}
```

### LengthError

String length out of bounds.

```typescript
import { LengthError } from '@nextrush/errors';

// Minimum length
if (password.length < 8) {
  throw new LengthError('password', 8); // "password must be at least 8 characters"
}

// Maximum length
if (bio.length > 500) {
  throw new LengthError('bio', undefined, 500); // "bio must be at most 500 characters"
}

// Range
if (username.length < 3 || username.length > 20) {
  throw new LengthError('username', 3, 20); // "username must be at least 3 characters and at most 20 characters"
}
```

### PatternError

Value doesn't match expected pattern.

```typescript
import { PatternError } from '@nextrush/errors';

const slugPattern = /^[a-z0-9-]+$/;

if (!slugPattern.test(ctx.body.slug)) {
  throw new PatternError('slug', slugPattern.source, 'Slug must contain only lowercase letters, numbers, and hyphens');
}
```

### InvalidEmailError

Invalid email format.

```typescript
import { InvalidEmailError } from '@nextrush/errors';

// Default field name is 'email'
throw new InvalidEmailError();

// Custom field name
throw new InvalidEmailError('contactEmail');
```

### InvalidUrlError

Invalid URL format.

```typescript
import { InvalidUrlError } from '@nextrush/errors';

// Default field name is 'url'
throw new InvalidUrlError();

// Custom field name
throw new InvalidUrlError('website');
```

## Building a Validation Helper

Combine validation errors for full request validation:

```typescript
import {
  ValidationError,
  RequiredFieldError,
  TypeMismatchError,
  LengthError,
  InvalidEmailError,
  type ValidationIssue,
} from '@nextrush/errors';

function validateUser(data: unknown): asserts data is User {
  const issues: ValidationIssue[] = [];

  if (typeof data !== 'object' || data === null) {
    throw new ValidationError([{ path: '', message: 'Request body must be an object' }]);
  }

  const body = data as Record<string, unknown>;

  // Required fields
  if (!body.email) {
    issues.push({ path: 'email', message: 'Email is required', rule: 'required' });
  } else if (!isValidEmail(body.email)) {
    issues.push({ path: 'email', message: 'Invalid email address', rule: 'email' });
  }

  if (!body.password) {
    issues.push({ path: 'password', message: 'Password is required', rule: 'required' });
  } else if (typeof body.password !== 'string') {
    issues.push({ path: 'password', message: 'Password must be a string', rule: 'type' });
  } else if (body.password.length < 8) {
    issues.push({ path: 'password', message: 'Password must be at least 8 characters', rule: 'length', expected: { min: 8 } });
  }

  if (!body.name) {
    issues.push({ path: 'name', message: 'Name is required', rule: 'required' });
  }

  // Throw all errors at once
  if (issues.length > 0) {
    throw new ValidationError(issues);
  }
}

// Usage
app.post('/users', async (ctx) => {
  validateUser(ctx.body);
  // ctx.body is now typed as User
  const user = await createUser(ctx.body);
  ctx.json(user);
});
```

## Integration with Validation Libraries

### With Zod

```typescript
import { z } from 'zod';
import { ValidationError, type ValidationIssue } from '@nextrush/errors';

const UserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
});

function parseWithValidation<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const issues: ValidationIssue[] = result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      rule: issue.code,
    }));
    throw new ValidationError(issues);
  }

  return result.data;
}

// Usage
app.post('/users', async (ctx) => {
  const user = parseWithValidation(UserSchema, ctx.body);
  // ...
});
```

### With Yup

```typescript
import * as yup from 'yup';
import { ValidationError, type ValidationIssue } from '@nextrush/errors';

const UserSchema = yup.object({
  email: yup.string().email().required(),
  password: yup.string().min(8).required(),
  name: yup.string().min(2).required(),
});

async function parseWithValidation<T>(schema: yup.Schema<T>, data: unknown): Promise<T> {
  try {
    return await schema.validate(data, { abortEarly: false });
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      const issues: ValidationIssue[] = error.inner.map(err => ({
        path: err.path ?? '',
        message: err.message,
        rule: err.type,
      }));
      throw new ValidationError(issues);
    }
    throw error;
  }
}
```

## TypeScript Types

```typescript
import type { ValidationIssue } from '@nextrush/errors';

// Build issues programmatically
const issues: ValidationIssue[] = [];

issues.push({
  path: 'field.name',
  message: 'Error message',
  rule: 'rule-name',
  expected: 'expected value',
  received: 'actual value',
});
```

## Best Practices

### 1. Collect All Errors First

```typescript
// ✅ Good: Report all errors at once
const issues: ValidationIssue[] = [];
if (!email) issues.push({ path: 'email', message: 'Required' });
if (!password) issues.push({ path: 'password', message: 'Required' });
if (issues.length) throw new ValidationError(issues);

// ❌ Bad: Throw on first error
if (!email) throw new RequiredFieldError('email');
if (!password) throw new RequiredFieldError('password');
```

### 2. Use Nested Paths for Complex Objects

```typescript
// ✅ Good: Clear path to the error
throw new ValidationError([
  { path: 'user.address.zipCode', message: 'Invalid zip code' },
  { path: 'items[0].quantity', message: 'Must be positive' },
]);

// ❌ Bad: Ambiguous path
throw new ValidationError([
  { path: 'zipCode', message: 'Invalid' },
]);
```

### 3. Include Rule Names for Frontend Mapping

```typescript
// ✅ Good: Frontend can customize messages per rule
{ path: 'email', message: 'Invalid email', rule: 'email' }

// ❌ Bad: No rule info
{ path: 'email', message: 'Invalid email' }
```

## See Also

- [Error Handling Overview](/packages/errors/) - Mental model and quick start
- [HTTP Errors](/packages/errors/http-errors) - Status code errors
- [Error Middleware](/packages/errors/middleware) - Automatic error handling
