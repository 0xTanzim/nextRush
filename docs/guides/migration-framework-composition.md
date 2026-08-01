# Migration Guide — Framework Composition Integrity

This release closes the gap between what `nextrush` claims ("install only what you need") and
what it shipped. Two breaking changes, both packaging/naming — no runtime behavior changed. See
`docs/RFC/framework-composition/020-framework-composition-integrity.md` for the rationale and
`report/framework/framework-composition-review.md` for the review that surfaced these issues.

**The one-line summary:** *class users add one explicit install; anyone importing
`RouteMetadata` from `nextrush/class` renames it to `ControllerRouteMetadata`.*

---

## 1. `@nextrush/class` is now an explicit install, not a free ride

`nextrush`'s `dependencies` no longer include `@nextrush/class`, `@nextrush/di`, or
`reflect-metadata` — they moved to **optional peer dependencies**. Every install of `nextrush`
previously downloaded the entire class/DI stack regardless of whether you used it; a
functional-only project now gets none of it.

```bash
# Before: nextrush alone was sufficient for the class-based API
pnpm add nextrush

# After: class-based/DI usage needs one explicit peer install
pnpm add nextrush @nextrush/class reflect-metadata
```

**If you only use the functional API** (`createApp`, `createRouter`, `listen`) — no action
needed. Nothing in your import graph changes.

**If you use `nextrush/class`** (decorators, DI, controllers, modules) — add the peer once:

```bash
pnpm add @nextrush/class reflect-metadata
```

**If you scaffolded with `create-nextrush`'s class-based or full template** — no action
needed; the scaffolder already adds `@nextrush/class` to your `package.json` as of this
release.

**If you forget the install**, `nextrush/class` fails at import time with a message naming the
exact command, rather than a generic module-not-found error:

```text
nextrush/class requires @nextrush/class and reflect-metadata as optional peer
dependencies, which are not installed in this project. Install them:
  pnpm add @nextrush/class reflect-metadata
```

## 2. `RouteMetadata` → `ControllerRouteMetadata` (in `nextrush/class` only)

`nextrush`'s `.` entry and `nextrush/class` entry used to each export a *different,
structurally unrelated* type under the identical name `RouteMetadata` — a renderer/OpenAPI
contract on one side, a decorator-storage record on the other. This release renames the
`nextrush/class` one.

```ts
// Before
import type { RouteMetadata } from 'nextrush/class';

function readRoutes(target: Function): RouteMetadata[] {
  /* ... */
}

// After
import type { ControllerRouteMetadata } from 'nextrush/class';

function readRoutes(target: Function): ControllerRouteMetadata[] {
  /* ... */
}
```

**No action needed immediately** — a `@deprecated` `RouteMetadata` alias for
`ControllerRouteMetadata` ships in this release, so existing imports keep compiling. The alias
is removed in the next major; migrate at your convenience before then.

If you import `RouteMetadata` from `nextrush` (the `.` entry, not `/class`), nothing changes —
that is the unrelated, renderer-facing contract from `@nextrush/types` and it keeps its name.

## 3. Nothing else changed

No router, adapter, middleware, or Context behavior changed. `createApp`, `listen`,
`registerControllers`, decorators, guards, and every other runtime API are unaffected.
