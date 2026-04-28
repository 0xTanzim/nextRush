# Testing

Writing tests for NextRush applications. Framework assumes Vitest; patterns apply to any test runner with minor adjustments.

---

## Test structure

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, createRouter } from 'nextrush';
import type { Context } from 'nextrush';

describe('User routes', () => {
  let app: ReturnType<typeof createApp>;
  let router: ReturnType<typeof createRouter>;

  beforeEach(() => {
    app = createApp();
    router = createRouter();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return users list', async () => {
    router.get('/users', (ctx) => {
      ctx.json([{ id: 1, name: 'Alice' }]);
    });

    app.route('/', router);
    const res = await testRequest(app, 'GET', '/users');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, name: 'Alice' }]);
  });
});
```

---

## Test request helper

```typescript
async function testRequest(
  app: Application,
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) {
  // Adapter-specific; here's a Node.js approach using node:http
  const req = http.request(
    { method, path, headers: { 'Content-Type': 'application/json', ...headers } },
    (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      return new Promise((resolve) => {
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
          });
        });
      });
    },
  );

  if (body) req.write(JSON.stringify(body));
  req.end();
}
```

Or use a supertest-like wrapper for your adapter.

---

## Testing middleware

```typescript
it('should add request ID', async () => {
  const requestIdMiddleware = async (ctx: Context, next) => {
    ctx.state.requestId = 'test-id-123';
    await next();
  };

  app.use(requestIdMiddleware);
  router.get('/', (ctx) => {
    ctx.json({ id: ctx.state.requestId });
  });

  app.route('/', router);
  const res = await testRequest(app, 'GET', '/');

  expect(res.body.id).toBe('test-id-123');
});
```

---

## Testing error handling

```typescript
it('should catch NotFoundError', async () => {
  import { NotFoundError } from 'nextrush';

  router.get('/users/:id', (ctx) => {
    throw new NotFoundError('User not found');
  });

  app.setErrorHandler((error, ctx) => {
    if (error instanceof NotFoundError) {
      ctx.status = 404;
      ctx.json({ error: error.message });
    }
  });

  app.route('/', router);
  const res = await testRequest(app, 'GET', '/users/999');

  expect(res.status).toBe(404);
  expect(res.body.error).toBe('User not found');
});
```

---

## Testing controllers with DI

```typescript
import 'reflect-metadata';
import { Service } from '@nextrush/di';
import { Controller, Get, controllersPlugin } from '@nextrush/controllers';

@Service()
class UserService {
  getAll() {
    return [{ id: 1, name: 'Alice' }];
  }
}

@Controller('/users')
class UserController {
  constructor(private users: UserService) {}

  @Get()
  findAll() {
    return this.users.getAll();
  }
}

it('should resolve controller and service from DI', async () => {
  const router = createRouter();
  app.plugin(
    controllersPlugin({
      router,
      controllers: [UserController],
    }),
  );

  app.route('/', router);
  const res = await testRequest(app, 'GET', '/users');

  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
});
```

---

## Mocking services

```typescript
import { vi } from 'vitest';

it('should use mocked repository', async () => {
  const mockUserRepo = {
    findAll: vi.fn().mockResolvedValue([{ id: 2, name: 'Bob' }]),
  };

  @Service()
  class UserService {
    constructor(private repo = mockUserRepo) {}
    getAll() {
      return this.repo.findAll();
    }
  }

  const svc = new UserService();
  const users = await svc.getAll();

  expect(users).toEqual([{ id: 2, name: 'Bob' }]);
  expect(mockUserRepo.findAll).toHaveBeenCalled();
});
```

---

## Coverage targets

Aim for 90%+ line coverage per package (enforced in CI). Test:

- Happy paths (return value matches input)
- Error paths (throw correct error)
- Middleware chains (order, state passing)
- Parameter extraction (body, query, params)
- Edge cases (empty arrays, null values, missing headers)

---

## Running tests

```bash
pnpm test
pnpm test -- --watch
pnpm test -- --coverage
```

For a single package:

```bash
pnpm --filter @nextrush/core test
pnpm --filter @nextrush/core test -- --coverage
```
