# Getting started

Path from empty directory to a responding server. For copy-paste examples with more commentary, use the docs site: [Installation](https://0xtanzim.github.io/nextRush/docs/getting-started/installation), [Quick start](https://0xtanzim.github.io/nextRush/docs/getting-started/quick-start).

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 22 |
| pnpm | current |
| TypeScript | 5.x |

---

## Scaffold (recommended)

```bash
pnpm create nextrush my-api
cd my-api
pnpm dev
```

The CLI asks for style (functional / class-based / full), middleware preset, and runtime target.

---

## Manual install

```bash
pnpm add nextrush
```

`nextrush` pulls in core, router, Node adapter, errors, and types.

### `tsconfig.json` baseline

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "./dist"
  }
}
```

For `@Controller` and DI:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

---

## Hello world (functional)

```typescript
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();

router.get('/', (ctx) => {
  ctx.json({ message: 'Hello NextRush!' });
});

app.route('/', router);
listen(app, 3000);
```

```bash
npx tsx src/index.ts
```

---

## Hello world (class controllers)

```bash
pnpm add @nextrush/di @nextrush/decorators @nextrush/controllers
```

```typescript
import 'reflect-metadata';
import { createApp, listen } from 'nextrush';
import { Controller, Get, Service, controllersPlugin } from '@nextrush/controllers';

@Service()
class GreetingService {
  greet() {
    return { message: 'Hello NextRush!' };
  }
}

@Controller('/')
class GreetingController {
  constructor(private greetingService: GreetingService) {}

  @Get()
  greet() {
    return this.greetingService.greet();
  }
}

const app = createApp();
app.plugin(controllersPlugin({ root: './src' }));
listen(app, 3000);
```

---

## Add common middleware

```bash
pnpm add @nextrush/cors @nextrush/body-parser @nextrush/helmet
```

```typescript
import { createApp, createRouter, listen } from 'nextrush';
import { cors } from '@nextrush/cors';
import { json } from '@nextrush/body-parser';
import { helmet } from '@nextrush/helmet';

const app = createApp();
app.use(helmet());
app.use(cors());
app.use(json());

const router = createRouter();
router.post('/users', (ctx) => {
  const { name } = ctx.body as { name: string };
  ctx.status = 201;
  ctx.json({ id: Date.now(), name });
});

app.route('/', router);
listen(app, 3000);
```

Order matters: security and CORS before body parsing before routes. See [Middleware](Middleware).

---

## Application options

```typescript
const app = createApp({
  env: 'production',
  proxy: true,
  logger: console,
});
```

`proxy: true` trusts `X-Forwarded-*` when behind a reverse proxy.

---

## Next pages

- [Core Concepts](Core-Concepts)
- [Routing](Routing)
- [Controllers and Decorators](Controllers-and-Decorators)
- [Error Handling](Error-Handling)
- [Middleware](Middleware)
