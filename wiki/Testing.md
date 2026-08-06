# Testing

The framework is shaped so tests are boring: middleware and handlers are plain functions of a
`Context`, the app composes them into one callable pipeline, and nothing needs a live socket
until you decide it does. You can test four layers, each with less setup than the last.

Test with **Vitest** (the repo's own runner) or any runner that speaks ESM — the examples here
use Vitest.

## Why NextRush is easy to test

Two design decisions do the work:

- **Functional core, no singleton state.** `createApp()` returns a fresh object; there is no
  process-wide registry, so one test cannot contaminate the next. Your handlers read everything
  from `ctx`, which you construct yourself.
- **Dependency injection is on the opt-in class path, not woven into the core.** When you do use
  DI, a service dependency is declared in a constructor — so you hand it a mock instead of
  faking a module boundary. See [Dependency Injection](Dependency-Injection).

## Layer 1 — unit test handlers and middleware

A handler is just an `async (ctx) => void`. Call it with a mock context and assert on what it
did to `ctx`:

```ts
// src/test/helpers.ts
import type { Context } from 'nextrush';
import { vi } from 'vitest';

export function createMockContext(overrides: Partial<Context> = {}): Context {
  return {
    method: 'GET', url: '/test', path: '/test', query: {}, headers: {},
    params: {}, body: undefined, status: 200, state: {}, ip: '127.0.0.1',
    json: vi.fn(), send: vi.fn(), html: vi.fn(), redirect: vi.fn(),
    get: vi.fn(), set: vi.fn(), next: vi.fn().mockResolvedValue(undefined),
    raw: { req: {}, res: {} } as never,
    ...overrides,
  } as Context;
}
```

The `as Context` cast is intentional: mocks omit adapter-only properties (`runtime`,
`bodySource`) that only real adapters fill in — the same pattern the framework's own suite uses.

```ts
// src/handlers/__tests__/users.test.ts
import { describe, it, expect } from 'vitest';
import { createMockContext } from '../../test/helpers';
import { getUserHandler, createUserHandler } from '../users';

it('returns the user by id', async () => {
  const ctx = createMockContext({ params: { id: '123' } });
  await getUserHandler(ctx);
  expect(ctx.json).toHaveBeenCalledWith({ data: expect.objectContaining({ id: '123' }) });
});

it('404s on a missing user', async () => {
  const ctx = createMockContext({ params: { id: 'missing' } });
  await expect(getUserHandler(ctx)).rejects.toThrow('User not found');
});
```

Middleware tests assert three behaviors — calling `next()`, mutating `state`, and rejecting:

```ts
const middleware = authMiddleware({ exclude: ['/health'] });

it('skips excluded paths', async () => {
  const ctx = createMockContext({ path: '/health' });
  await middleware(ctx);
  expect(ctx.next).toHaveBeenCalled();
});

it('rejects requests without a token', async () => {
  const ctx = createMockContext({ path: '/users' });
  await expect(middleware(ctx)).rejects.toThrow('Authentication required');
});
```

## Layer 2 — integration test the whole app with `app.callback()`

`app.callback()` returns the composed handler — middleware + routing + error handling — without
starting a server. Drive it with a mock context to test the full flow in-process:

```ts
import { createApp, createRouter, errorHandler } from 'nextrush';

function createTestApp() {
  const app = createApp({ env: 'test' });
  const router = createRouter();
  app.use(errorHandler());
  router.get('/users', (ctx) => ctx.json({ data: [] }));
  router.post('/users', (ctx) => {
    ctx.status = 201;
    ctx.json({ data: { id: '1', ...(ctx.body as object) } });
  });
  app.route('/', router);
  return app;
}

const handler = createTestApp().callback();

it('GET /users runs the whole pipeline', async () => {
  const ctx = createMockContext({ method: 'GET', path: '/users' });
  await handler(ctx);
  expect(ctx.json).toHaveBeenCalledWith({ data: [] });
});
```

This is the fastest full-stack test: real middleware, real router, real error mapping, zero I/O.

## Layer 3 — E2E with real HTTP on an ephemeral port

When a test needs a real TCP connection, use `serve()` (not `listen()`): it takes an options
object, so `port: 0` makes the OS assign a free port — no CI port collisions.

```ts
import { createApp, serve, type ServerInstance } from 'nextrush';

describe('API E2E', () => {
  let server: ServerInstance;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    app.use(async (ctx) => ctx.json({ status: 'ok' }));
    server = await serve(app, { port: 0 });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(async () => await server.close()); // returns a Promise — always await

  it('answers over real HTTP', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
```

`listen(app, 8080)` is the production entry — it binds a fixed port and logs a startup banner.
`serve()` is the test-friendly twin.

## Layer 4 — class controllers with DI

The `@nextrush/di` container is global by default, so it must be reset between tests, and
dependencies are injected as mocks through the constructor:

```ts
import 'reflect-metadata'; // required in test files when not importing the meta package
import { container } from 'nextrush/class';
import { UsersController } from '../users.controller';
import { UserService } from '../../services/user.service';

beforeEach(() => {
  container.reset(); // never skip — the global container shares state across tests
  container.register(UserService, { useValue: mockUserService as UserService });
  controller = container.resolve(UsersController);
});
```

For a full test-module (override → compile), the framework ships `@nextrush/testing` with
`createTestModule().override().compile()` — see
https://0xtanzim.github.io/nextRush/docs/reference/dev-testing.

## Testing discipline

- **Assert behavior, not implementation.** `expect(service.findById('123').id).toBe('123')`
  beats `expect(service.findById).toHaveBeenCalledWith('123')`.
- **Reset state in `beforeEach`** — `vi.clearAllMocks()` and `container.reset()` when DI is in
  play.
- **`vi.mock()` is hoisted.** Define module mocks at file scope, never inside an `it()`.
- **Test error paths through the real classes.** Throw `NotFoundError` / `BadRequestError` from
  `nextrush` and assert `status` + `code` — see [Error Handling](Error-Handling).
- **Prefer real objects over mocks.** Mock the external boundary (a database, an HTTP client);
  drive your own handlers, middleware, and services with real instances and a fake `ctx`.

## Next steps

- [Request Lifecycle](Request-Lifecycle) — what `app.callback()` actually runs
- [Dependency Injection](Dependency-Injection) — overriding providers in tests
- [Controllers and Decorators](Controllers-and-Decorators) — testing class controllers
- [Error Handling](Error-Handling) — asserting error classes and codes
- [Performance](Performance) — how to measure, not guess, when tests get slow
- [Packages](Packages) — `@nextrush/testing` and friends
- Docs-site testing guide: https://0xtanzim.github.io/nextRush/docs/guides/testing