---
"@nextrush/dev": patch
---

Fix `nextrush dev` on Deno: generated projects import relative files with `.js` ESM
specifiers (e.g. `./routes/health.routes.js`), which Deno cannot resolve to `.ts` without
sloppy imports. The Deno dev-server spawn now passes `--unstable-sloppy-imports`, matching
the framework's own conformance runner, so `nextrush dev` boots scaffolded apps on Deno
instead of failing with "Module not found .../health.js".
