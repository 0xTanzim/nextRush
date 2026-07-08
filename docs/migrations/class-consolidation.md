# Migrating to `@nextrush/class`

The class-based runtime — decorators, DI wiring, controllers, guards, filters,
interceptors, lifecycle hooks, request scope, and modules — now lives in one
package: **`@nextrush/class`**. Application code should import it through the
single entry point **`nextrush/class`**.

`@nextrush/decorators` and `@nextrush/controllers` still exist as `@deprecated`
compatibility shims that re-export from `@nextrush/class`, so **existing code keeps
working**. They will be removed in a future major — migrate at your convenience.

`@nextrush/di` is unchanged and independent (you can use `@Service`/`inject` in a
functional app without the class runtime).

## Automated migration (recommended)

```bash
nextrush codemod consolidate-imports "src/**/*.ts"
```

The codemod rewrites `@nextrush/decorators` and `@nextrush/controllers` imports to
a single merged `nextrush/class` import, preserving `import type` and aliases,
leaving `@nextrush/di` untouched. It is idempotent — safe to run more than once.

## Before / after

```ts
// Before
import { Controller, Get, Body, UseGuard } from '@nextrush/decorators';
import { registerControllers } from '@nextrush/controllers';
import { Service, inject } from '@nextrush/di';

// After — one class import (di stays separate, or also via nextrush/class)
import {
  Controller, Get, Body, UseGuard, registerControllers, Service, inject,
} from 'nextrush/class';
```

No behavior changes: routes, DI resolution, guards/filters/interceptors,
lifecycle hooks, and request scope all behave exactly as before.

## New capabilities in this release

- **Testing** — `@nextrush/testing`:

  ```ts
  import { createTestModule } from '@nextrush/testing';

  const mod = await createTestModule({ controllers: [UserController], providers: [UserService] })
    .override(UserService).useValue(fakeUserService)
    .compile();

  const res = await mod.request('GET', '/users');
  await mod.close();
  ```

- **Diagnostics** — opt in per registration and read the report:

  ```ts
  await registerControllers(app, { root: './src', diagnostics: true });
  const report = getClassDiagnostics(app); // routes, providers, duplicates, cycles, timings
  ```

- **Programmatic discovery** — pass controllers directly (no filesystem scan):

  ```ts
  await registerControllers(app, { controllers: [UserController] });
  ```

## What did not change

- `nextrush/class` import surface — identical.
- `@nextrush/di` — unchanged and still independent.
- All runtime behavior — verified by the full class-tier test suite.
