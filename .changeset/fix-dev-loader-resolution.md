---
"@nextrush/dev": patch
---

`nextrush dev` no longer fails immediately with `ERR_MODULE_NOT_FOUND` when invoked through the
package's real CLI entry point (`bin/nextrush.js` → `dist/cli.js`).

The SWC-loader path resolution used by `nextrush dev` assumed a fixed directory depth relative to
its own module's `import.meta.url` (one directory under `dist/`), which was only ever correct for
the pre-bundle source layout. Because `tsup.config.ts` builds each CLI entry point as a separate,
non-split bundle, the resolution code ends up inlined directly into `dist/cli.js` — zero
directories under `dist/` — and the old hardcoded relative climb landed at a directory that
doesn't exist. `nextrush dev` now resolves the loader relative to the package root instead of
assuming a specific bundle depth, so it works correctly regardless of which entry point's bundle
the resolution code is inlined into.

The existing dev-mode (non-`dist`) source fallback path is unchanged.
