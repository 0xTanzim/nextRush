# Getting Started

This page walks you from zero to a running NextRush application.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 22.0.0 |
| pnpm | latest |
| TypeScript | 5.x |

---

## Scaffold a Project (Recommended)

The fastest path is the interactive scaffolder:

```bash
pnpm create nextrush my-api
cd my-api
pnpm dev
```

The scaffolder lets you choose:
- **Style**: functional, class-based, or full
- **Middleware preset**: minimal, web, or API
- **Runtime target**: Node.js, Bun, Deno, or Edge

---

## Manual Setup

### 1. Install the meta package

```bash
pnpm add nextrush
```

The `nextrush` package includes `@nextrush/core`, `@nextrush/router`, `@nextrush/adapter-node`, `@nextrush/errors`, and `@nextrush/types`.

### 2. Configure TypeScript

```json
// tsconfig.json
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

For class-based controllers, also add:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

---

## Hello World — Functional Style

```typescript
// src/index.ts
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();

router.get('/', (ctx) => {
  ctx.json({ message: 'Hello NextRush!' });
});

app.route('/', router);
listen(app, 3000);
```

Run it:

```bash
npx tsx src/index.ts
# Listening on http://localhost:3000
```

---

## Hello World — Class-Based Style

Install the additional packages:

```bash
pnpm add @nextrush/di @nextrush/decorators @nextrush/controllers
```

```typescript
// src/index.ts
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

## Adding Middleware

Install middleware packages separately:

```bash
pnpm add @nextrush/cors @nextrush/body-parser @nextrush/helmet
```

```typescript
import { createApp, createRouter, listen } from 'nextrush';
import { cors } from '@nextrush/cors';
import { json } from '@nextrush/body-parser';
import { helmet } from '@nextrush/helmet';

const app = createApp();

// Middleware runs in registration order
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

---

## Application Options

```typescript
const app = createApp({
  env: 'production',     // 'development' | 'production' | 'test' (default: 'development')
  proxy: true,           // Trust X-Forwarded-* headers (default: false)
  logger: console,       // Logger implementing { error, warn, info, debug }
});
```

---

## Next Steps

- [Core Concepts](Core-Concepts) — Context API, middleware composition, plugin system
- [Routing](Routing) — Route parameters, nested routers, HTTP methods
- [Controllers and Decorators](Controllers-and-Decorators) — Class-based controllers
- [Error Handling](Error-Handling) — HTTP errors and global error handling
- [Middleware](Middleware) — All available middleware packages
