# Plugins

> Extend NextRush applications with powerful, production-ready features.

Plugins are self-contained packages that add functionality to your NextRush application. Unlike middleware (which processes requests), plugins extend the application and context with new capabilities.

## Available Plugins

| Plugin | Description | Status |
|--------|-------------|--------|
| [Template](/plugins/template) | Multi-engine template system with 70+ helpers | ✅ Stable |
| Controllers | Controller-based routing with decorators | ✅ Stable |
| Logger | Structured logging with log levels | 🚧 In Progress |
| Static | Static file serving | 🚧 In Progress |
| Events | Application-wide event system | 🚧 In Progress |
| WebSocket | Real-time WebSocket support | 🚧 In Progress |

## Using Plugins

Plugins are registered with `app.use()` or `app.plugin()`:

```typescript
import { createApp } from '@nextrush/core';
import { template } from '@nextrush/template';
import { controllersPlugin } from '@nextrush/controllers';

const app = createApp();

// Use as middleware (template)
app.use(template({ root: './views' }));

// Use as plugin (controllers)
app.plugin(controllersPlugin({
  controllers: [UserController, ProductController]
}));
```

## Plugin vs Middleware

| Aspect | Middleware | Plugin |
|--------|------------|--------|
| Purpose | Process requests | Extend application |
| Execution | Per-request | Once at startup |
| Access | Request/response context | Application instance |
| Examples | CORS, body parser, auth | Templates, controllers, logger |

## Creating Plugins

See the [Plugin Development Guide](/guides/plugin-development) for creating custom plugins.
