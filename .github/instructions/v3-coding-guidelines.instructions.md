---
applyTo: '**/*.ts'
---

# NextRush v3 Coding Guidelines

## TypeScript Standards

### Strict Mode Required

All packages use TypeScript strict mode with these key settings:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "verbatimModuleSyntax": true
}
```

### Zero `any` Policy

```typescript
// ❌ NEVER
const fn = (ctx: any) => {}

// ✅ ALWAYS
const fn = (ctx: Context) => {}
const fn = (data: unknown) => {}  // For unknown input
```

### Export Types Explicitly

```typescript
// ✅ Use type-only exports
export type { Context, Middleware, Plugin } from './types';
export { HttpStatus, ContentType } from './constants';
```

## Code Style

### Function Signatures

```typescript
// ✅ Clear parameter types and return types for public APIs
export function createApp(options?: ApplicationOptions): Application {
  return new Application(options);
}

// ✅ Document with JSDoc
/**
 * Compose middleware functions into a single middleware.
 * @param middleware - Array of middleware to compose
 * @returns Composed middleware function
 */
export function compose(middleware: Middleware[]): ComposedMiddleware {
  // ...
}
```

### Error Handling

```typescript
// ✅ Use typed errors
throw new HttpError(404, 'Not found');
throw new BadRequestError('Invalid input');

// ✅ Type guard for error handling
if (error instanceof HttpError) {
  ctx.status = error.status;
}
```

### Module Organization

```typescript
// ✅ index.ts should only export
export { Application, createApp } from './application';
export { compose } from './middleware';
export type { ApplicationOptions } from './application';

// ❌ Don't put implementation in index.ts
```

## Package Structure

Each package follows this structure:

```
packages/package-name/
├── src/
│   ├── index.ts      # Public exports only
│   ├── main.ts       # Main implementation
│   └── types.ts      # Package-specific types
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

## Middleware Pattern

```typescript
// ✅ Modern syntax (preferred)
const logger: Middleware = async (ctx) => {
  const start = Date.now();
  await ctx.next();
  console.log(`${ctx.method} ${ctx.path} - ${Date.now() - start}ms`);
};

// ✅ Traditional syntax (also supported)
const logger: Middleware = async (ctx, next) => {
  const start = Date.now();
  await next();
  console.log(`${ctx.method} ${ctx.path} - ${Date.now() - start}ms`);
};
```

## Plugin Pattern

```typescript
// ✅ Clean plugin implementation
export class LoggerPlugin implements Plugin {
  readonly name = 'logger';
  readonly version = '1.0.0';

  constructor(private options: LoggerOptions = {}) {}

  install(app: Application): void {
    app.use(this.createMiddleware());
  }

  private createMiddleware(): Middleware {
    return async (ctx) => {
      // logging logic
      await ctx.next();
    };
  }
}
```

## Import Guidelines

```typescript
// ✅ Use workspace imports
import type { Context, Middleware } from '@nextrush/types';
import { compose } from '@nextrush/core';

// ✅ Use node: prefix for Node.js built-ins
import { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

// ❌ Don't use relative imports across packages
import { Context } from '../../types/src/context';
```
