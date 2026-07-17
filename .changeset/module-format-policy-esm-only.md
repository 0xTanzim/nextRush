---
"nextrush": patch
---

Ratified and documented NextRush's module-format policy: **ESM-only, permanently.**

No `@nextrush/*` package's `exports` map will ever declare a `require` condition — this was
already the de facto state, and is now a stated, non-negotiable architectural decision, not a
default. Dual-publish (ESM + CommonJS) was formally evaluated and explicitly rejected (dual-
package hazard risk on the `@nextrush/di` `reflect-metadata`/`tsyringe` path; the Node ≥22
engine floor already covers the strongest historical case for dual-publishing via native
`require(esm)`; the doubled, permanent build/test/publish cost across ~35 packages).

No packaging change — this documents and enforces the existing state. CommonJS consumers use
dynamic `import()`, or native `require(esm)` on Node ≥22.12 for synchronous import graphs.

A new `pnpm validate:esm-only` check, wired into `pnpm verify`, fails CI if any package ever
gains a `require` condition or drops `"type": "module"`.
