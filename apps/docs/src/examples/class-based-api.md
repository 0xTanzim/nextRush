---
title: Class-Based API
description: Build a structured REST API using controllers, dependency injection, and decorators.
---

# Class-Based API

> Build the same REST API using controllers, services, and dependency injection.

## What You'll Learn

- **Controllers** — Organize routes by resource
- **Dependency Injection** — Services with automatic wiring
- **Decorators** — `@Controller`, `@Get`, `@Post`, `@Body`, `@Param`
- **Guards** — Protect routes with authentication

## Prerequisites

This example assumes you've completed or understand:
- [Hello World Example](/examples/hello-world)
- [REST CRUD Example](/examples/rest-crud)

## Quick Start

```bash
# Create project
mkdir class-based && cd class-based
pnpm init -y

# Install dependencies
pnpm add @nextrush/core @nextrush/decorators @nextrush/di \
         @nextrush/controllers @nextrush/body-parser @nextrush/cors
pnpm add -D @nextrush/dev typescript
```

## The Complete API

### Project Structure

```
class-based/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts              # App entry point
    ├── users/
    │   ├── user.controller.ts
    │   ├── user.service.ts
    │   └── user.types.ts
    └── guards/
        └── auth.guard.ts
```

### Types

```typescript
// src/users/user.types.ts
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

export interface UpdateUserDto {
  name?: string;
  email?: string;
}
```

### Service (Business Logic)

```typescript
// src/users/user.service.ts
import { Service } from '@nextrush/di';
import type { User, CreateUserDto, UpdateUserDto } from './user.types';

@Service()
export class UserService {
  private users = new Map<string, User>();
  private idCounter = 1;

  findAll(): User[] {
    return Array.from(this.users.values());
  }

  findById(id: string): User | undefined {
    return this.users.get(id);
  }

  create(dto: CreateUserDto): User {
    const now = new Date().toISOString();
    const user: User = {
      id: String(this.idCounter++),
      name: dto.name.trim(),
      email: dto.email.toLowerCase().trim(),
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  update(id: string, dto: UpdateUserDto): User | undefined {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updated: User = {
      ...user,
      ...(dto.name && { name: dto.name.trim() }),
      ...(dto.email && { email: dto.email.toLowerCase().trim() }),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.users.delete(id);
  }

  emailExists(email: string, excludeId?: string): boolean {
    return Array.from(this.users.values()).some(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.id !== excludeId
    );
  }
}
```

### Controller (HTTP Layer)

```typescript
// src/users/user.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Ctx,
} from '@nextrush/decorators';
import type { Context } from '@nextrush/types';
import { UserService } from './user.service';
import type { CreateUserDto, UpdateUserDto } from './user.types';

@Controller('/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  findAll(@Query() query: { page?: string; limit?: string }) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    const allUsers = this.userService.findAll();
    const paginatedUsers = allUsers.slice(skip, skip + limit);

    return {
      data: paginatedUsers,
      pagination: {
        page,
        limit,
        total: allUsers.length,
        totalPages: Math.ceil(allUsers.length / limit),
      },
    };
  }

  @Get('/:id')
  findOne(@Param('id') id: string, @Ctx() ctx: Context) {
    const user = this.userService.findById(id);
    if (!user) {
      ctx.status = 404;
      return { error: 'User not found' };
    }
    return { data: user };
  }

  @Post()
  create(@Body() dto: CreateUserDto, @Ctx() ctx: Context) {
    // Validation
    const errors = this.validateCreateDto(dto);
    if (errors.length > 0) {
      ctx.status = 400;
      return { error: 'Validation failed', details: errors };
    }

    // Check duplicate email
    if (this.userService.emailExists(dto.email)) {
      ctx.status = 409;
      return { error: 'Email already exists' };
    }

    const user = this.userService.create(dto);
    ctx.status = 201;
    return { data: user };
  }

  @Put('/:id')
  replace(
    @Param('id') id: string,
    @Body() dto: CreateUserDto,
    @Ctx() ctx: Context
  ) {
    // Check exists
    if (!this.userService.findById(id)) {
      ctx.status = 404;
      return { error: 'User not found' };
    }

    // Validation
    const errors = this.validateCreateDto(dto);
    if (errors.length > 0) {
      ctx.status = 400;
      return { error: 'Validation failed', details: errors };
    }

    // Check duplicate email
    if (this.userService.emailExists(dto.email, id)) {
      ctx.status = 409;
      return { error: 'Email already exists' };
    }

    const user = this.userService.update(id, dto);
    return { data: user };
  }

  @Patch('/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Ctx() ctx: Context
  ) {
    // Check exists
    if (!this.userService.findById(id)) {
      ctx.status = 404;
      return { error: 'User not found' };
    }

    // Validation
    const errors = this.validateUpdateDto(dto);
    if (errors.length > 0) {
      ctx.status = 400;
      return { error: 'Validation failed', details: errors };
    }

    // Check duplicate email
    if (dto.email && this.userService.emailExists(dto.email, id)) {
      ctx.status = 409;
      return { error: 'Email already exists' };
    }

    const user = this.userService.update(id, dto);
    return { data: user };
  }

  @Delete('/:id')
  delete(@Param('id') id: string, @Ctx() ctx: Context) {
    const deleted = this.userService.delete(id);
    if (!deleted) {
      ctx.status = 404;
      return { error: 'User not found' };
    }
    ctx.status = 204;
    return null;
  }

  // Private validation methods
  private validateCreateDto(dto: CreateUserDto): string[] {
    const errors: string[] = [];
    if (!dto.name?.trim()) errors.push('Name is required');
    if (!dto.email?.trim()) errors.push('Email is required');
    if (dto.email && !this.isValidEmail(dto.email)) {
      errors.push('Invalid email format');
    }
    return errors;
  }

  private validateUpdateDto(dto: UpdateUserDto): string[] {
    const errors: string[] = [];
    if (dto.name !== undefined && !dto.name.trim()) {
      errors.push('Name cannot be empty');
    }
    if (dto.email !== undefined) {
      if (!dto.email.trim()) errors.push('Email cannot be empty');
      else if (!this.isValidEmail(dto.email)) errors.push('Invalid email format');
    }
    return errors;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
```

### App Entry Point

```typescript
// src/index.ts
import 'reflect-metadata'; // Required for decorators
import { createApp } from '@nextrush/core';
import { controllersPlugin } from '@nextrush/controllers';
import { json } from '@nextrush/body-parser';
import { cors } from '@nextrush/cors';

import { UserController } from './users/user.controller';

const app = createApp();

// Global middleware
app.use(cors());
app.use(json());

// Request logging
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  console.log(`${ctx.method} ${ctx.path} ${ctx.status} - ${Date.now() - start}ms`);
});

// Register controllers with DI
app.plugin(controllersPlugin({
  controllers: [UserController],
}));

// Start server
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Class-based API running on http://localhost:${port}`);
});
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*"]
}
```

::: warning Required TypeScript Settings
Class-based features require these compiler options:
- `experimentalDecorators: true`
- `emitDecoratorMetadata: true`
:::

## Adding Guards (Authentication)

### Create an Auth Guard

```typescript
// src/guards/auth.guard.ts
import type { GuardFn, GuardContext } from '@nextrush/decorators';

// Simple token-based auth guard
export const AuthGuard: GuardFn = async (ctx: GuardContext) => {
  const token = ctx.get('authorization');

  if (!token) {
    return false;
  }

  // In production, verify JWT token here
  if (token === 'Bearer valid-token') {
    // Add user to state for controllers to access
    ctx.state.user = { id: '1', role: 'admin' };
    return true;
  }

  return false;
};

// Role-based guard factory
export const RoleGuard = (roles: string[]): GuardFn => {
  return async (ctx: GuardContext) => {
    const user = ctx.state.user as { role: string } | undefined;
    if (!user) return false;
    return roles.includes(user.role);
  };
};
```

### Apply Guards to Controller

```typescript
// src/users/user.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuard,
  Body,
  Param,
  Ctx,
} from '@nextrush/decorators';
import type { Context } from '@nextrush/types';
import { AuthGuard, RoleGuard } from '../guards/auth.guard';
import { UserService } from './user.service';

// All routes require authentication
@UseGuard(AuthGuard)
@Controller('/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Public route (no guard)
  @Get()
  findAll() {
    return { data: this.userService.findAll() };
  }

  // Protected route (uses class-level guard)
  @Get('/:id')
  findOne(@Param('id') id: string, @Ctx() ctx: Context) {
    const user = this.userService.findById(id);
    if (!user) {
      ctx.status = 404;
      return { error: 'User not found' };
    }
    return { data: user };
  }

  // Admin-only route (additional guard)
  @UseGuard(RoleGuard(['admin']))
  @Delete('/:id')
  delete(@Param('id') id: string, @Ctx() ctx: Context) {
    const deleted = this.userService.delete(id);
    if (!deleted) {
      ctx.status = 404;
      return { error: 'User not found' };
    }
    ctx.status = 204;
    return null;
  }
}
```

### Test with Guards

```bash
# Without token (401)
curl http://localhost:3000/users
# {"error":"Unauthorized"}

# With valid token
curl http://localhost:3000/users \
  -H "Authorization: Bearer valid-token"
# {"data":[...]}

# Admin-only route without admin role
curl -X DELETE http://localhost:3000/users/1 \
  -H "Authorization: Bearer user-token"
# {"error":"Forbidden"}

# Admin-only route with admin role
curl -X DELETE http://localhost:3000/users/1 \
  -H "Authorization: Bearer valid-token"
# (204 No Content)
```

## Class-Based Guards with DI

For guards that need services:

```typescript
// src/guards/auth.guard.ts
import { Service } from '@nextrush/di';
import type { CanActivate, GuardContext } from '@nextrush/decorators';

// Auth service (could verify JWT, check database, etc.)
@Service()
export class AuthService {
  async verify(token: string): Promise<{ id: string; role: string } | null> {
    // In production: verify JWT, check database, etc.
    if (token === 'Bearer valid-token') {
      return { id: '1', role: 'admin' };
    }
    return null;
  }
}

// Guard class with DI
@Service()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(ctx: GuardContext): Promise<boolean> {
    const token = ctx.get('authorization');
    if (!token) return false;

    const user = await this.authService.verify(token);
    if (!user) return false;

    ctx.state.user = user;
    return true;
  }
}
```

```typescript
// Usage in controller
import { AuthGuard } from '../guards/auth.guard';

@UseGuard(AuthGuard) // Class guard resolved from DI
@Controller('/users')
export class UserController {
  // ...
}
```

## Comparison: Functional vs Class-Based

### Functional Style

```typescript
// Simpler, less boilerplate
router.get('/users/:id', (ctx) => {
  const user = findUser(ctx.params.id);
  if (!user) {
    ctx.status = 404;
    ctx.json({ error: 'Not found' });
    return;
  }
  ctx.json({ data: user });
});
```

**Best for:**
- Small APIs (< 10 routes)
- Microservices
- Quick prototypes
- Simple CRUD without complex business logic

### Class-Based Style

```typescript
// More structure, better for large apps
@Controller('/users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('/:id')
  findOne(@Param('id') id: string, @Ctx() ctx: Context) {
    const user = this.userService.findById(id);
    if (!user) {
      ctx.status = 404;
      return { error: 'Not found' };
    }
    return { data: user };
  }
}
```

**Best for:**
- Large APIs (50+ routes)
- Complex business logic
- Team collaboration
- Testing with mock services
- Domain-driven design

### When to Use Each

| Factor | Functional | Class-Based |
|--------|------------|-------------|
| Team size | 1-2 devs | 3+ devs |
| Routes count | < 20 | > 20 |
| Business logic | Simple | Complex |
| Testing needs | Basic | Extensive |
| Onboarding | Faster | Slower (but scales) |

## Full Example Repository

<details>
<summary>Complete project files</summary>

**package.json**
```json
{
  "name": "class-based-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "nextrush dev",
    "build": "nextrush build",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@nextrush/core": "^3.0.0",
    "@nextrush/decorators": "^3.0.0",
    "@nextrush/di": "^3.0.0",
    "@nextrush/controllers": "^3.0.0",
    "@nextrush/body-parser": "^3.0.0",
    "@nextrush/cors": "^3.0.0",
    "reflect-metadata": "^0.2.0"
  },
  "devDependencies": {
    "@nextrush/dev": "^3.0.0",
    "typescript": "^5.0.0"
  }
}
```

**tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*"]
}
```

</details>

## Next Steps

- **[DI Concepts](/concepts/di)** — Deep dive into dependency injection
- **[Controller Decorators](/packages/decorators)** — All available decorators
- **[Testing Guide](/guides/testing)** — Test controllers with mock services
- **[Authentication Guide](/guides/authentication)** — Production auth patterns
