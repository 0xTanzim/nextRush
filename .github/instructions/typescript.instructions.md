---
description: 'TypeScript development standards for NextRush v3. Covers strict mode, type safety, code style, module organization, middleware/plugin patterns, and commenting conventions.'
applyTo: '**/*.ts'
---

# NextRush TypeScript Standards

TypeScript 5.x targeting ES2022. Pure ES modules only.

---

## Strict Mode Configuration

All packages enforce strict mode:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "verbatimModuleSyntax": true
}
```

---

## Type Safety

### Zero `any` Policy

```typescript
// ❌ NEVER
const fn = (ctx: any) => {}

// ✅ Use proper types or unknown for boundaries
const fn = (ctx: Context) => {}
const fn = (data: unknown) => {}
```

### Type System Rules

- Prefer `unknown` plus narrowing over `any`
- Use discriminated unions for state machines and events
- Centralize shared contracts in `@nextrush/types`
- Use TypeScript utility types (`Readonly`, `Partial`, `Record`) to express intent
- Generic types over type assertions
- Discriminated unions over type casting

### Export Types Explicitly

```typescript
// ✅ Separate type-only exports
export type { Context, Middleware, Plugin } from './types';
export { HttpStatus, ContentType } from './constants';
```

---

## Naming & Style

- PascalCase for classes, interfaces, enums, type aliases
- camelCase for variables, functions, parameters, properties
- kebab-case for filenames (`user-session.ts`, `body-parser.ts`)
- No `I` prefix on interfaces — use descriptive names
- Name by intent: `calculateInvoiceTotal` not `doCalc`

---

## Code Style

### Functions

- Keep functions focused and short (target ≤40 lines)
- Public APIs must have explicit parameter types and return types
- Guard edge cases early with early returns — avoid deep nesting
- Favor immutable data and pure functions for business logic
- Minimize parameter lists (use parameter objects for >3 params)

### Module Organization

```typescript
// ✅ index.ts contains only public exports
export { Application, createApp } from './application';
export { compose } from './middleware';
export type { ApplicationOptions } from './application';

// ❌ Do not put implementation in index.ts
```

### Package Structure

```
packages/package-name/
├── src/
│   ├── index.ts      # Public exports only
│   ├── main.ts       # Main implementation
│   ├── types.ts      # Package-specific types
│   └── __tests__/    # Co-located tests
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

---

## Import Rules

```typescript
// ✅ Workspace package imports
import type { Context, Middleware } from '@nextrush/types';
import { compose } from '@nextrush/core';

// ✅ Node.js built-ins with node: prefix
import { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

// ❌ No relative imports across package boundaries
import { Context } from '../../types/src/context';
```

- Pure ES modules only — no `require`, `module.exports`, or CommonJS
- Use `import type` for type-only imports at package boundaries
- Respect the package hierarchy: lower packages never import from higher ones

---

## Error Handling

```typescript
// ✅ Use typed error classes
throw new HttpError(404, 'Not found');
throw new BadRequestError('Invalid input');

// ✅ Type guards for error handling
if (error instanceof HttpError) {
  ctx.status = error.status;
}
```

- Use `async/await` with try/catch and structured errors
- Guard edge cases early to avoid deep nesting
- No silent catch blocks — log or re-throw
- Validate external input with schema validators or type guards

---

## NextRush Patterns

### Middleware

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

### Plugin

```typescript
export class LoggerPlugin implements Plugin {
  readonly name = 'logger';
  readonly version = '1.0.0';

  constructor(private options: LoggerOptions = {}) {}

  install(app: Application): void {
    app.use(this.createMiddleware());
  }

  private createMiddleware(): Middleware {
    return async (ctx) => {
      await ctx.next();
    };
  }
}
```

---

## Security

- Validate and sanitize all external input
- No dynamic code execution (`eval`, `Function()`)
- No unsanitized template interpolation
- No `JSON.parse` without try/catch at boundaries
- Validate regex patterns for ReDoS vulnerability
- Keep secrets in environment variables, never in code
- Use parameterized queries to block injection

---

## Performance

- No unnecessary allocations in hot paths (middleware chain, router lookup)
- Avoid closures in tight loops
- Prefer static dispatch over dynamic where possible
- No blocking I/O in core or middleware packages
- Lazy-load heavy dependencies and dispose when done
- Batch or debounce high-frequency events

---

## Commenting Conventions

### Core Rule

Write code that speaks for itself. Comment only when necessary to explain **why**, not **what**.

### When to Comment

- Complex business logic or non-obvious algorithms
- Regex patterns — always explain what the pattern matches
- API constraints, rate limits, or external gotchas
- Configuration constants — explain the source or reasoning

### When NOT to Comment

- Obvious statements (`// increment counter`)
- Redundant descriptions that repeat the code
- Changelog entries (use git history)
- Commented-out dead code (delete it)
- Decorative dividers

### Annotation Tags

Use standard tags for findable markers:

```typescript
// TODO: Replace with proper auth after security review
// FIXME: Memory leak in production — investigate pooling
// HACK: Workaround for library v2.1.0 bug — remove after upgrade
// PERF: Consider caching if called frequently in hot path
// SECURITY: Validate input to prevent injection
```

### JSDoc for Public APIs

```typescript
/**
 * Compose middleware functions into a single middleware.
 * @param middleware - Array of middleware to compose
 * @returns Composed middleware function
 */
export function compose(middleware: Middleware[]): ComposedMiddleware {
  // ...
}
```

Add JSDoc to public APIs. Include `@remarks` or `@example` when helpful.
Remove stale comments during refactors.

---

## Architecture Rules

- Follow the repository's DI and composition patterns
- Keep transport, domain, and presentation layers decoupled
- Keep modules single-purpose with clear interfaces
- Reuse or extend shared utilities before creating new ones
- Normalize external responses and map errors to domain shapes
- Instantiate clients outside hot paths and inject for testability
