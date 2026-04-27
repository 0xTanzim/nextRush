---
'create-nextrush': patch
---

Add the published CLI entry at `bin/create-nextrush.js` (it was missing from the npm tarball, which broke `npm create nextrush`, `npx`, and `pnpm dlx`), run `npx tsup` before publish, and document correct `create` / `npx` / `pnpm dlx` usage in the package README and docs site.
