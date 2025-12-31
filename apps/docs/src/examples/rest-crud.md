---
title: REST CRUD API
description: Build a complete REST API with CRUD operations, validation, and error handling.
---

# REST CRUD API

> Build a production-ready REST API with create, read, update, and delete operations.

## What You'll Build

A complete Users API with:

- **GET /users** — List all users with pagination
- **GET /users/:id** — Get a single user
- **POST /users** — Create a new user
- **PUT /users/:id** — Replace a user
- **PATCH /users/:id** — Update a user
- **DELETE /users/:id** — Delete a user

## Quick Start

```bash
# Create project
mkdir rest-crud && cd rest-crud
pnpm init -y

# Install dependencies
pnpm add @nextrush/core @nextrush/router @nextrush/body-parser @nextrush/cors
pnpm add -D @nextrush/dev typescript
```

## The Complete API

```typescript
// src/index.ts
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { json } from '@nextrush/body-parser';
import { cors } from '@nextrush/cors';

// In-memory database
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

const users = new Map<string, User>();
let idCounter = 1;

// Create app and router
const app = createApp();
const router = createRouter();

// Middleware
app.use(cors());
app.use(json());

// Request logging
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  console.log(`${ctx.method} ${ctx.path} ${ctx.status} - ${Date.now() - start}ms`);
});

// List users with pagination
router.get('/users', (ctx) => {
  const page = Number(ctx.query.page) || 1;
  const limit = Math.min(Number(ctx.query.limit) || 10, 100);
  const skip = (page - 1) * limit;

  const allUsers = Array.from(users.values());
  const paginatedUsers = allUsers.slice(skip, skip + limit);

  ctx.json({
    data: paginatedUsers,
    pagination: {
      page,
      limit,
      total: allUsers.length,
      totalPages: Math.ceil(allUsers.length / limit),
    },
  });
});

// Get single user
router.get('/users/:id', (ctx) => {
  const user = users.get(ctx.params.id);

  if (!user) {
    ctx.status = 404;
    ctx.json({ error: 'User not found' });
    return;
  }

  ctx.json({ data: user });
});

// Create user
router.post('/users', (ctx) => {
  const body = ctx.body as { name?: string; email?: string };

  // Validation
  const errors: string[] = [];
  if (!body.name?.trim()) errors.push('Name is required');
  if (!body.email?.trim()) errors.push('Email is required');
  if (body.email && !isValidEmail(body.email)) errors.push('Invalid email format');

  if (errors.length > 0) {
    ctx.status = 400;
    ctx.json({ error: 'Validation failed', details: errors });
    return;
  }

  // Check for duplicate email
  const emailExists = Array.from(users.values()).some(
    (u) => u.email.toLowerCase() === body.email!.toLowerCase()
  );
  if (emailExists) {
    ctx.status = 409;
    ctx.json({ error: 'Email already exists' });
    return;
  }

  // Create user
  const now = new Date().toISOString();
  const user: User = {
    id: String(idCounter++),
    name: body.name!.trim(),
    email: body.email!.toLowerCase().trim(),
    createdAt: now,
    updatedAt: now,
  };

  users.set(user.id, user);

  ctx.status = 201;
  ctx.json({ data: user });
});

// Replace user (PUT)
router.put('/users/:id', (ctx) => {
  const existing = users.get(ctx.params.id);

  if (!existing) {
    ctx.status = 404;
    ctx.json({ error: 'User not found' });
    return;
  }

  const body = ctx.body as { name?: string; email?: string };

  // Validation
  const errors: string[] = [];
  if (!body.name?.trim()) errors.push('Name is required');
  if (!body.email?.trim()) errors.push('Email is required');
  if (body.email && !isValidEmail(body.email)) errors.push('Invalid email format');

  if (errors.length > 0) {
    ctx.status = 400;
    ctx.json({ error: 'Validation failed', details: errors });
    return;
  }

  // Check for duplicate email (excluding current user)
  const emailExists = Array.from(users.values()).some(
    (u) => u.id !== ctx.params.id && u.email.toLowerCase() === body.email!.toLowerCase()
  );
  if (emailExists) {
    ctx.status = 409;
    ctx.json({ error: 'Email already exists' });
    return;
  }

  // Replace user
  const user: User = {
    ...existing,
    name: body.name!.trim(),
    email: body.email!.toLowerCase().trim(),
    updatedAt: new Date().toISOString(),
  };

  users.set(user.id, user);
  ctx.json({ data: user });
});

// Partial update (PATCH)
router.patch('/users/:id', (ctx) => {
  const existing = users.get(ctx.params.id);

  if (!existing) {
    ctx.status = 404;
    ctx.json({ error: 'User not found' });
    return;
  }

  const body = ctx.body as { name?: string; email?: string };

  // Validation
  const errors: string[] = [];
  if (body.name !== undefined && !body.name.trim()) {
    errors.push('Name cannot be empty');
  }
  if (body.email !== undefined) {
    if (!body.email.trim()) errors.push('Email cannot be empty');
    else if (!isValidEmail(body.email)) errors.push('Invalid email format');
  }

  if (errors.length > 0) {
    ctx.status = 400;
    ctx.json({ error: 'Validation failed', details: errors });
    return;
  }

  // Check for duplicate email (if changing)
  if (body.email) {
    const emailExists = Array.from(users.values()).some(
      (u) => u.id !== ctx.params.id && u.email.toLowerCase() === body.email!.toLowerCase()
    );
    if (emailExists) {
      ctx.status = 409;
      ctx.json({ error: 'Email already exists' });
      return;
    }
  }

  // Update user
  const user: User = {
    ...existing,
    ...(body.name && { name: body.name.trim() }),
    ...(body.email && { email: body.email.toLowerCase().trim() }),
    updatedAt: new Date().toISOString(),
  };

  users.set(user.id, user);
  ctx.json({ data: user });
});

// Delete user
router.delete('/users/:id', (ctx) => {
  const existing = users.get(ctx.params.id);

  if (!existing) {
    ctx.status = 404;
    ctx.json({ error: 'User not found' });
    return;
  }

  users.delete(ctx.params.id);
  ctx.status = 204;
  ctx.send('');
});

// Helpers
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Mount router and start
app.use(router.routes());

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`REST API running on http://localhost:${port}`);
});
```

## Testing the API

### Create Users

```bash
# Create first user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'
# {"data":{"id":"1","name":"Alice","email":"alice@example.com",...}}

# Create second user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Bob","email":"bob@example.com"}'
# {"data":{"id":"2","name":"Bob","email":"bob@example.com",...}}
```

### Read Users

```bash
# List all users
curl http://localhost:3000/users
# {"data":[...],"pagination":{"page":1,"limit":10,"total":2}}

# List with pagination
curl "http://localhost:3000/users?page=1&limit=1"

# Get single user
curl http://localhost:3000/users/1
# {"data":{"id":"1","name":"Alice",...}}

# Get non-existent user
curl http://localhost:3000/users/999
# {"error":"User not found"}
```

### Update Users

```bash
# Full update (PUT)
curl -X PUT http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Smith","email":"alice.smith@example.com"}'

# Partial update (PATCH)
curl -X PATCH http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Johnson"}'
```

### Delete Users

```bash
# Delete user
curl -X DELETE http://localhost:3000/users/1
# (204 No Content)

# Try to delete again
curl -X DELETE http://localhost:3000/users/1
# {"error":"User not found"}
```

### Validation Errors

```bash
# Missing fields
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{}'
# {"error":"Validation failed","details":["Name is required","Email is required"]}

# Invalid email
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"invalid"}'
# {"error":"Validation failed","details":["Invalid email format"]}

# Duplicate email
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Another","email":"alice@example.com"}'
# {"error":"Email already exists"}
```

## Code Walkthrough

### Project Structure

```
rest-crud/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

### Application Setup

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { json } from '@nextrush/body-parser';
import { cors } from '@nextrush/cors';

const app = createApp();
const router = createRouter();

// Global middleware
app.use(cors());           // Cross-origin requests
app.use(json());           // Parse JSON bodies
```

### The Data Model

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

// In-memory store (use a database in production)
const users = new Map<string, User>();
```

### Pagination Pattern

```typescript
router.get('/users', (ctx) => {
  // Parse query params with defaults and limits
  const page = Number(ctx.query.page) || 1;
  const limit = Math.min(Number(ctx.query.limit) || 10, 100); // Max 100
  const skip = (page - 1) * limit;

  const allUsers = Array.from(users.values());
  const paginatedUsers = allUsers.slice(skip, skip + limit);

  ctx.json({
    data: paginatedUsers,
    pagination: {
      page,
      limit,
      total: allUsers.length,
      totalPages: Math.ceil(allUsers.length / limit),
    },
  });
});
```

### Validation Pattern

```typescript
router.post('/users', (ctx) => {
  const body = ctx.body as { name?: string; email?: string };

  // Collect all validation errors
  const errors: string[] = [];
  if (!body.name?.trim()) errors.push('Name is required');
  if (!body.email?.trim()) errors.push('Email is required');
  if (body.email && !isValidEmail(body.email)) errors.push('Invalid email format');

  // Return all errors at once (better DX than one-at-a-time)
  if (errors.length > 0) {
    ctx.status = 400;
    ctx.json({ error: 'Validation failed', details: errors });
    return;
  }

  // Continue with creation...
});
```

### HTTP Status Codes

| Code | Meaning | When to Use |
|------|---------|-------------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation failed |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource |

## Adding Error Handling

For production, add global error handling:

```typescript
import { HttpError, NotFoundError, BadRequestError } from '@nextrush/errors';

// Global error handler (add BEFORE routes)
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof HttpError) {
      ctx.status = error.statusCode;
      ctx.json({
        error: error.message,
        code: error.code,
        ...(error.details && { details: error.details }),
      });
    } else {
      console.error('Unhandled error:', error);
      ctx.status = 500;
      ctx.json({ error: 'Internal server error' });
    }
  }
});

// Now routes can throw errors
router.get('/users/:id', (ctx) => {
  const user = users.get(ctx.params.id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  ctx.json({ data: user });
});
```

## Modular Structure

For larger APIs, organize by feature:

```
src/
├── index.ts          # App entry point
├── middleware/
│   └── logging.ts    # Request logging
├── users/
│   ├── routes.ts     # User routes
│   ├── service.ts    # Business logic
│   └── types.ts      # User types
└── shared/
    ├── validation.ts # Validation helpers
    └── database.ts   # Database connection
```

### Users Module Example

```typescript
// src/users/types.ts
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  name: string;
  email: string;
}
```

```typescript
// src/users/service.ts
import type { User, CreateUserDto } from './types';

const users = new Map<string, User>();
let idCounter = 1;

export const userService = {
  findAll(): User[] {
    return Array.from(users.values());
  },

  findById(id: string): User | undefined {
    return users.get(id);
  },

  create(dto: CreateUserDto): User {
    const now = new Date().toISOString();
    const user: User = {
      id: String(idCounter++),
      name: dto.name.trim(),
      email: dto.email.toLowerCase().trim(),
      createdAt: now,
      updatedAt: now,
    };
    users.set(user.id, user);
    return user;
  },

  // ... update, delete methods
};
```

```typescript
// src/users/routes.ts
import { createRouter } from '@nextrush/router';
import { userService } from './service';

export const userRouter = createRouter();

userRouter.get('/users', (ctx) => {
  ctx.json({ data: userService.findAll() });
});

userRouter.get('/users/:id', (ctx) => {
  const user = userService.findById(ctx.params.id);
  if (!user) {
    ctx.status = 404;
    ctx.json({ error: 'User not found' });
    return;
  }
  ctx.json({ data: user });
});

// ... more routes
```

```typescript
// src/index.ts
import { createApp } from '@nextrush/core';
import { json } from '@nextrush/body-parser';
import { cors } from '@nextrush/cors';
import { userRouter } from './users/routes';

const app = createApp();

app.use(cors());
app.use(json());
app.use(userRouter.routes());

app.listen(3000);
```

## Next Steps

- **[Class-Based Example](/examples/class-based-api)** — Same API with controllers and DI
- **[Error Handling Guide](/guides/error-handling)** — Production error patterns
- **[Testing Guide](/guides/testing)** — Test your API
- **[Authentication Guide](/guides/authentication)** — Add auth to your API
