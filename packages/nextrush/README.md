# NextRush

> Minimal, Modular, Blazing Fast Node.js Framework

[![npm version](https://img.shields.io/npm/v/nextrush.svg)](https://www.npmjs.com/package/nextrush)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Philosophy

**This meta package provides essentials only:**
- `createApp` - Create application
- `createRouter` - Create router
- `listen` - Start server

**Middleware and plugins are installed separately.** This is intentional - you only pay for what you use.

## Installation

```bash
pnpm add nextrush
```

## Quick Start

```typescript
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();

router.get('/', (ctx) => {
  ctx.json({ message: 'Hello NextRush!' });
});

app.use(router.routes());

listen(app, 3000);
```

## Adding Middleware

Install what you need:

```bash
pnpm add @nextrush/cors @nextrush/body-parser
```

```typescript
import { createApp, listen } from 'nextrush';
import { cors } from '@nextrush/cors';
import { json } from '@nextrush/body-parser';

const app = createApp();

app.use(cors());
app.use(json());

app.use((ctx) => {
  ctx.json({ body: ctx.body });
});

listen(app, 3000);
```

## Available Packages

### Core (included in nextrush)
| Package | Description |
|---------|-------------|
| `@nextrush/core` | Application & middleware |
| `@nextrush/router` | Radix tree router |
| `@nextrush/adapter-node` | Node.js HTTP adapter |

### Middleware (install separately)
| Package | Description |
|---------|-------------|
| `@nextrush/cors` | CORS headers |
| `@nextrush/helmet` | Security headers |
| `@nextrush/body-parser` | JSON/form parsing |
| `@nextrush/cookies` | Cookie handling |
| `@nextrush/compression` | Response compression |
| `@nextrush/rate-limit` | Rate limiting |

### Plugins (install separately)
| Package | Description |
|---------|-------------|
| `@nextrush/logger` | Structured logging |
| `@nextrush/static` | Static file serving |
| `@nextrush/websocket` | WebSocket support |
| `@nextrush/template` | Template rendering |
| `@nextrush/events` | Event emitter |

### Dev Tools
| Package | Description |
|---------|-------------|
| `@nextrush/dev` | Hot reload dev server |

## Direct Package Usage

For maximum control, skip the meta package:

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { listen } from '@nextrush/adapter-node';
import { cors } from '@nextrush/cors';
```

## License

MIT © NextRush Team
