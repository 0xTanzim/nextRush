---
"@nextrush/dev": patch
"create-nextrush": minor
---

Fix `nextrush dev` on Deno: generated projects import relative files with `.js` ESM
specifiers (e.g. `./routes/health.routes.js`), which Deno cannot resolve to `.ts` without
sloppy imports. The Deno dev-server spawn now passes `--unstable-sloppy-imports`, matching
the framework's own conformance runner, so `nextrush dev` boots scaffolded apps on Deno
instead of failing with "Module not found .../health.js".

Deno-first scaffold hardening (`--runtime deno`):

- Generated `deno.json` now carries `"unstable": ["sloppy-imports"]` and
  `nodeModulesDir: "auto"`, so native Deno tooling (`deno check`, `deno test`, the Deno
  LSP) resolves the `.js`-specifier relative imports and bare `@nextrush/*` specifiers —
  previously only the hand-written npm scripts passed the flag, so any Deno-native
  workflow failed to resolve imports.
- `src/env.d.ts` is no longer emitted for Deno projects: its `/// <reference
  types="@nextrush/types" />` is an unresolvable specifier under `deno check` (Deno
  resolves ambient types from node_modules itself).
- `package.json` for Deno projects no longer declares `engines.node` — a Deno app is not
  Node-dependent; the `>=22` floor only describes the Node toolchain (`@nextrush/dev`,
  vitest, typescript) and misrepresented the project.
- The `@nextrush/dev` Deno build fallback's run hint now carries
  `--unstable-sloppy-imports` (the copied `.ts` sources keep `.js` specifiers) and scoped
  permissions instead of blanket `-A`; the internal declaration tsc spawn uses
  `--allow-read --allow-write` instead of `-A`.

Tests: a new real-Deno suite (`deno-check-real.test.ts`) generates functional /
class-based / full Deno projects and runs `deno check` against them under the installed
Deno binary (hermetic import-map stubs for `nextrush`/`@nextrush/*`), plus a boot test
that runs the generated app and hits `/health`. The conformance deno-runner import map
also gained the missing `@nextrush/adapter-nextjs` entry so the full shared suite runs
under Deno (31/31 green).
