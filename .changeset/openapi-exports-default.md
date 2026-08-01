---
"@nextrush/openapi": patch
---

Add a `default` condition to the package's `exports` map so CJS-resolving tools
(e.g. `tsx` running the docs site's `generate-openapi.ts`) can import the package.
The docs website now declares `@nextrush/openapi` (and `@nextrush/types`, type-only
imports) as workspace devDependencies and imports by package specifier instead of a
relative `dist/` path — this also gives turbo the dependency edge it needs to build
them before the website build.
