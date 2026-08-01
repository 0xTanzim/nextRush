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

Drive the app with Web Request directly:

```typescript
import { createApp } from 'nextrush';

const app = createApp();
app.get('/ping', (ctx) => ctx.json({ pong: true }));
await app.ready?.();

const res = await app.handle(new Request('http://localhost/ping'));
expect(res.status).toBe(200);
expect(await res.json()).toEqual({ pong: true });
```

## Rules

- Always `await ref.close()` (lifecycle hooks / resources)
- Prefer real in-memory fakes over mocking pure domain functions
- One module graph per test when testing isolation of singletons
