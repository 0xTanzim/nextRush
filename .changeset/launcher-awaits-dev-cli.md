---
"nextrush": patch
---

Fix the `nextrush` launcher exiting 0 before the delegated `@nextrush/dev` CLI has
finished its async work (issue #40). The launcher now awaits the delegated `cli()`
promise and only then applies its own exit handling, so `nextrush dev`/`nextrush
build` no longer get killed by a fire-and-forget `process.exit(0)` mid-flight; a
rejected `cli()` is also surfaced as an error exit instead of a silent 0.
