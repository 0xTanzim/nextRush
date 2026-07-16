---
"nextrush": major
"@nextrush/class": major
---

**BREAKING**: Removed `@nextrush/controllers` and `@nextrush/decorators`.

Both packages were pure compatibility shims — every export was a straight re-export from
`@nextrush/class` (six DI symbols in `@nextrush/controllers` re-exported from `@nextrush/di`
instead, with an identical end result). Neither package contained any logic of its own. A
repo-wide sweep found zero internal consumers, and the migration tooling this removal depends on
already existed and was already tested from the earlier class-consolidation effort.

**Migration:**

```bash
nextrush codemod consolidate-imports "src/**/*.ts"
```

This automated codemod rewrites imports from either removed package into a single merged
`nextrush/class` import, preserving `import type` and aliases, and is idempotent. Or migrate
manually:

```diff
- import { Controller, Get, UseGuard } from '@nextrush/decorators';
- import { registerControllers } from '@nextrush/controllers';
+ import { Controller, Get, UseGuard, registerControllers } from 'nextrush/class';
```

Every symbol either package re-exported remains available at its current location in
`nextrush/class` (or `@nextrush/di` directly) — only the two old import paths are gone. See
[Deprecations](https://github.com/0xTanzim/nextRush/blob/main/apps/docs/content/docs/migrate/deprecations.mdx)
for the complete symbol-by-symbol map.

`nextrush` (the meta package) had `@nextrush/controllers` and `@nextrush/decorators` listed as
direct dependencies with no code actually importing from either — both were removed from its
`package.json`. `@nextrush/class`'s own version bumps because it is now the sole owner of the
decorator/controller surface these two packages used to share responsibility for documenting and
distributing, with no functional change to `@nextrush/class` itself.
