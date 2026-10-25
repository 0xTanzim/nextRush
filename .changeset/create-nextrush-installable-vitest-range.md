---
'create-nextrush': patch
---

**Generated projects now receive a concrete `vitest` range instead of the workspace-only
`catalog:testing` protocol.**

The scaffolder single-sources the generated project's toolchain versions from its own
`devDependencies` at build time. `vitest` is declared as `catalog:testing` (a pnpm workspace
protocol), and the build injected that string verbatim, so every generated `package.json`
asked for `"vitest": "catalog:testing"` — a specifier no standalone project can resolve. The
build now resolves the catalog entry to the installed version, the same way the `oxlint`
range is already resolved, and a fallback of `^5.0.5` covers an offline build with no
installed resolution.

The existing `create-nextrush` bin-entry guard catches this class of leak; it was failing
before this change and passes now. No generated file layout, script, or dependency set
otherwise changes.
