---
"nextrush": major
"@nextrush/class": major
"create-nextrush": minor
---

**BREAKING**: `nextrush`'s functional install no longer carries the class/DI stack, and
`@nextrush/class`'s `RouteMetadata` type is renamed to `ControllerRouteMetadata`.

**`nextrush`** (meta package): `@nextrush/class`, `@nextrush/di`, and `reflect-metadata` moved
from `dependencies` to **optional `peerDependencies`**. A functional-only `pnpm add nextrush`
no longer resolves the class runtime, the DI container, `tsyringe`, or `reflect-metadata` —
closing the gap between the framework's "install only what you need" promise and what it
actually shipped (see `report/framework/framework-composition-review.md`, F-01).

**Migration:** if your project uses `nextrush/class` (decorators, DI, controllers), add the
peer explicitly:

```bash
pnpm add @nextrush/class reflect-metadata
```

If you never install it, importing `nextrush/class` now fails with an actionable message
naming the exact install command rather than an opaque module-resolution error. Projects
scaffolded by `create-nextrush`'s **class-based** or **full** templates already add
`@nextrush/class` for you — no action needed there.

**`@nextrush/class`**: the decorator-storage interface `RouteMetadata` is renamed to
`ControllerRouteMetadata`, reserving the name `RouteMetadata` for the single, unrelated,
renderer-facing contract in `@nextrush/types` (re-exported via `nextrush`'s `.` entry). The two
types had collided under one name with structurally incompatible shapes (F-02).

**Migration:**

```ts
// Before
import type { RouteMetadata } from 'nextrush/class';

// After
import type { ControllerRouteMetadata } from 'nextrush/class';
```

A `@deprecated` `RouteMetadata` alias for `ControllerRouteMetadata` ships in `nextrush/class`
for this release only — it will be removed in the next major.

**`create-nextrush`** (minor): the class-based and full templates now add `@nextrush/class`
explicitly to the generated `package.json` (previously relied on it being a free transitive
dependency of `nextrush`, which is no longer true after the change above).

See `docs/guides/migration-framework-composition.md` for the full before/after guide and
`docs/RFC/framework-composition/020-framework-composition-integrity.md` for the rationale.
