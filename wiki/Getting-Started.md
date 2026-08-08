# Getting Started

Start a NextRush server in under a minute. NextRush v4 is ESM-only and requires **Node.js ≥ 22** (TypeScript 5.x, or a Bun/Deno runtime via [adapters](Adapters)).

## 1. Create a project

The fastest path is the scaffolder — one command produces a runnable project:

```bash
pnpm create nextrush my-api
# or
npm create nextrush my-api
# or
bun create nextrush my-api
```

The scaffolder (`create-nextrush`) asks a few questions — style (functional vs class-based), runtime (node / bun / deno), and middleware defaults — then writes a complete project with `src/`, `tsconfig.json`, and scripts. You can also pre-answer everything:

```bash
pnpm create nextrush@latest my-api --style functional --runtime node --yes
```

Want to add NextRush to an existing project instead? Install the meta-package and its optional peers for the runtime you target:

```bash
pnpm add nextrush @nextrush/adapter-node
```

The `nextrush` meta-package re-exports the core surface (`createApp`, `listen`, router, context helpers, errors). For a plain functional install with no class/DI layer, only the meta-package and your runtime adapter are needed.

## 2. First server

```ts
import { createApp, listen } from 'nextrush';

const app = createApp();

app.get('/hello/:name', (ctx) => {
  ctx.body = { message: `Hello, ${ctx.params.name}!` };
});

await listen(app, 8080);
```

Run it (the scaffold's dev script, or directly):

```bash
pnpm dev
# or
tsx src/index.ts
```

```bash
curl http://localhost:8080/hello/world
# → {"message":"Hello, world!"}
```

Notes on what just happened:

- **`createApp()`** builds the application: router, middleware pipeline, and a fresh [`Context`](Core-Concepts) per request.
- **Handlers write through `ctx`** (`ctx.body`), they do not return a `Response`. Serialization, headers, and status are controlled on the context.
- **Port 8080** is the framework default; pass any port (or an existing server) to `listen`.

## 3. Middleware and errors

Add middleware with `app.use(...)` and let errors flow to the default handler:

```ts
import { createApp, listen } from 'nextrush';
import { json } from 'nextrush/middleware';
import { NotFoundError } from 'nextrush';

const app = createApp();

app.use(json()); // parse JSON bodies

app.post('/tasks', (ctx) => {
  const task = ctx.body; // parsed request body
  ctx.status = 201;
  ctx.body = { id: 1, ...task };
});

app.get('/tasks/:id', (ctx) => {
  throw new NotFoundError(`No task ${ctx.params.id}`);
});

await listen(app, 8080);
```

See [Middleware](Middleware) and [Error Handling](Error-Handling) for the details.

## 4. Class-based apps (optional)

Prefer controllers and dependency injection? The class runtime is a registrar on top of the same functional core:

```ts
import { createApp, listen } from 'nextrush';
import { Controller, Get, Module, registerModule } from 'nextrush/class';

@Controller('/users')
class UserController {
  @Get()
  list() {
    return [{ id: 1, name: 'Ada' }];
  }
}

// Module-first: the feature lives in a module, the app composes modules.
@Module({ controllers: [UserController] })
class UsersModule {}

@Module({ imports: [UsersModule] })
class AppModule {}

const app = createApp();
await registerModule(app, AppModule);
await listen(app, 8080);
```

Jump to [Controllers & Decorators](Controllers-and-Decorators) and [Dependency Injection](Dependency-Injection) when you're ready.

## Next steps

- [Core Concepts](Core-Concepts) — application, context, handlers, middleware
- [Routing](Routing) — paths, params, mounting, conflict rules
- [Request Lifecycle](Request-Lifecycle) — what runs between socket and response
- [Adapters](Adapters) — running the same app on Bun, Deno, or edge runtimes
- Full tutorial on the docs site: https://0xtanzim.github.io/nextRush/docs/getting-started/quick-start
