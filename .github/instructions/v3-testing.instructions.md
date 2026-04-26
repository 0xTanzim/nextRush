---
applyTo: '**/*.test.ts'
---

# NextRush v3 Testing Strategy

## Testing Framework

- **Vitest** for unit and integration tests
- **Coverage target**: 90%+ for all packages

## Test Structure

```typescript
// packages/core/src/__tests__/application.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, Application } from '../application';

describe('Application', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
  });

  describe('createApp', () => {
    it('should create an application instance', () => {
      expect(app).toBeInstanceOf(Application);
    });

    it('should accept options', () => {
      const app = createApp({ env: 'production' });
      expect(app.isProduction).toBe(true);
    });
  });

  describe('use()', () => {
    it('should register middleware', () => {
      const middleware = vi.fn();
      app.use(middleware);
      expect(app.middlewareCount).toBe(1);
    });

    it('should throw if middleware is not a function', () => {
      expect(() => app.use('string' as unknown as Middleware)).toThrow(TypeError);
    });

    it('should allow chaining', () => {
      const result = app.use(vi.fn()).use(vi.fn());
      expect(result).toBe(app);
    });
  });
});
```

## Testing Middleware

```typescript
import { describe, it, expect, vi } from 'vitest';
import { compose } from '../middleware';
import type { Context, Middleware } from '@nextrush/types';

describe('compose', () => {
  const createMockContext = (): Context => ({
    method: 'GET',
    path: '/test',
    // ... minimal mock
  }) as Context;

  it('should execute middleware in order', async () => {
    const order: number[] = [];

    const middleware: Middleware[] = [
      async (ctx, next) => { order.push(1); await next(); order.push(4); },
      async (ctx, next) => { order.push(2); await next(); order.push(3); },
    ];

    const composed = compose(middleware);
    await composed(createMockContext());

    expect(order).toEqual([1, 2, 3, 4]);
  });

  it('should throw if next() called multiple times', async () => {
    const middleware: Middleware[] = [
      async (ctx, next) => {
        await next();
        await next(); // Error!
      },
    ];

    const composed = compose(middleware);
    await expect(composed(createMockContext())).rejects.toThrow('next() called multiple times');
  });
});
```

## Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @nextrush/core test

# Watch mode
pnpm --filter @nextrush/core test:watch

# Coverage
pnpm test:coverage
```

## Coverage Requirements

| Metric | Target |
|--------|--------|
| Lines | 90% |
| Branches | 85% |
| Functions | 90% |
| Statements | 90% |

## Test File Naming

```
src/
├── application.ts
├── middleware.ts
└── __tests__/
    ├── application.test.ts
    └── middleware.test.ts
```

## Mocking Guidelines

```typescript
// ✅ Use vi.fn() for function mocks
const handler = vi.fn();

// ✅ Use vi.spyOn for method mocks
vi.spyOn(console, 'error').mockImplementation(() => {});

// ✅ Reset mocks in beforeEach
beforeEach(() => {
  vi.clearAllMocks();
});
```
