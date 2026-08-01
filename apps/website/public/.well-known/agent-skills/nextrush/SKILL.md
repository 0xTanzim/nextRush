---
name: nextrush
description: Build backend applications with NextRush framework. Use when developing routes, middleware, server actions, or working with NextRush APIs.
---

# NextRush Framework

NextRush eliminates accidental complexity from backend development. Build type-safe, runtime-independent applications with minimal boilerplate.

## Quick Start

Create a route handler:

```typescript
import { defineHandler } from 'nextrush/router'

export const GET = defineHandler({
  async handler({ request, params }) {
    return new Response('Hello, world!', { status: 200 })
  }
})
```

## Core Concepts

### Route Handlers

Use `defineHandler` for typed request/response handling. Supports GET, POST, PUT, PATCH, DELETE, and HEAD methods.

```typescript
import { defineHandler } from 'nextrush/router'
import { z } from 'nextrush/validation'

export const POST = defineHandler({
  input: z.object({ name: z.string() }),
  async handler({ request, params, body }) {
    return Response.json({ message: `Hello, ${body.name}!` })
  }
})
```

### Middleware

Middleware are functions that run before or after route handlers. They receive the same context as handlers plus a `next` function.

```typescript
import { defineMiddleware } from 'nextrush/middleware'

export const logger = defineMiddleware({
  async handler({ request, next }) {
    const start = Date.now()
    const response = await next()
    console.log(`${request.method} ${request.url} ${response.status} ${Date.now() - start}ms`)
    return response
  }
})
```

### Dependency Injection

NextRush uses a scoped dependency injection system. Register dependencies and inject them into handlers.

```typescript
import { createContainer, injectable } from 'nextrush/di'

@injectable()
class UserService {
  async findById(id: string) { /* ... */ }
}

const container = createContainer()
container.register(UserService)
```

### Server Actions

Server Actions are RPC-style functions that run on the server and can be called from client components.

```typescript
import { defineAction } from 'nextrush/actions'

export const createUser = defineAction({
  input: z.object({ name: z.string(), email: z.string().email() }),
  async handler({ body }) {
    const user = await db.user.create({ data: body })
    return { success: true, user }
  }
})
```

### Adapters

NextRush is runtime-independent. Use adapters to deploy anywhere.

```typescript
import { createNodeAdapter } from 'nextrush/adapter-node'
import { createCloudflareAdapter } from 'nextrush/adapter-cloudflare'

// Node.js
const app = createNodeAdapter(handler)
app.listen(3000)

// Cloudflare Workers
const app = createCloudflareAdapter(handler)
export default app
```

## Best Practices

1. **Thin handlers**: Keep route handlers focused on HTTP concerns. Delegate business logic to services or domain modules.
2. **Schema validation**: Always validate input at the boundary using `zod` schemas. Never trust raw request data.
3. **Error handling**: Use NextRush's error utilities for consistent error responses.
4. **Type safety**: Leverage TypeScript generics for fully typed request/response chains.

## Common Patterns

### Request Lifecycle

```
Request → Middleware Chain → Auth Guard → Route Handler → Response
                                     ↓
                              Business Logic
                                     ↓
                              Data Access
```

### Error Handling

```typescript
import { defineHandler, HttpError } from 'nextrush/router'

export const GET = defineHandler({
  async handler({ params }) {
    const user = await findUser(params.id)
    if (!user) {
      throw new HttpError(404, 'User not found')
    }
    return Response.json(user)
  }
})
```

## References

- [NextRush Documentation](https://nextrush.dev/docs)
- [API Reference](https://nextrush.dev/docs/api)
- [Examples Repository](https://github.com/nextrush/nextrush/tree/main/examples)
