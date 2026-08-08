# Testing (`@nextrush/testing`)

Isolated DI + router for class-based modules. Uses the same `registerControllers` path as production.

## Install

```bash
pnpm add -D @nextrush/testing
```

## Quick start

```typescript
import { createTestModule } from '@nextrush/testing';
import { Controller, Get, Service } from 'nextrush/class';

@Service()
class UserService {
  getUser(id: string) {
    return { id, name: 'Alice' };
  }
}

@Controller('/users')
class UserController {
  constructor(private users: UserService) {}

  @Get('/:id')
  getUser(@Param('id') id: string) {
    return this.users.getUser(id);
  }
}

const ref = await createTestModule({
  controllers: [UserController],
  providers: [UserService],
}).compile();

const response = await ref.request('GET', '/users/123');
// response.status === 200
// response.body === { id: '123', name: 'Alice' }

await ref.close();
```

## Overrides

```typescript
const ref = await createTestModule({
  controllers: [UserController],
  providers: [UserService, MailService],
})
  .override(UserService)
  .useValue(fakeUsers)
  .override(MailService)
  .useClass(NoopMail)
  .override(Config)
  .useFactory(() => ({ debug: true }))
  .compile();

const svc = ref.get(UserService); // resolve without HTTP
const res = await ref.request('POST', '/users', {
  body: { name: 'Bob' },
  headers: { authorization: 'Bearer x' },
});
await ref.close();
```

## Mental model

```
createTestModule(config)
  → .override(token).useValue|useClass|useFactory(...)  // optional, chainable
  → .compile()  // builds container + router NOW
  → TestModuleRef { get, request, close }
```

Nothing touches a real container until `.compile()`.

## Functional apps (no class)

There is **no `app.handle()`**. Integration-test the whole pipeline in-process with
`app.callback()` — the composed handler adapters run — driven by a mock `Context` (the same
`createMockContext` helper shape the Wiki Testing page builds):

```typescript
import { createApp } from 'nextrush';

const app = createApp();
app.get('/ping', (ctx) => ctx.json({ pong: true }));

const handler = app.callback();   // middleware + routing + error boundary, no socket
const ctx = createMockContext({ method: 'GET', path: '/ping' });
await handler(ctx);
expect(ctx.json).toHaveBeenCalledWith({ pong: true });
```

For real HTTP, use `serve(app, { port: 0 })` (ephemeral port) and `fetch`.

## Rules

- Always `await ref.close()` (lifecycle hooks / resources)
- Prefer real in-memory fakes over mocking pure domain functions
- One module graph per test when testing isolation of singletons
