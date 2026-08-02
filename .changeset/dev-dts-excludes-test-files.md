---
"@nextrush/dev": patch
---

Fix `nextrush build` leaking test/spec files into `dist/` as empty `export {}`
modules (issue2). The declaration pass ran bare `tsc` with no file list, so
tsconfig `include` globs pulled `*.test.ts`/`*.spec.ts` into the declaration emit —
and a test file with any unused import failed the entire build with TS6133.

Both build paths (Node/SWC and Deno) now run `tsc` through a generated temp
tsconfig that extends the project config and pins `files` to the same
test-filtered, srcDir-scoped source set the SWC transform compiled, so the two
steps can never disagree on "what is project source". The Deno path no longer
depends on `npx tsc` finding TypeScript in the project's `node_modules`; it
resolves the bundled compiler deterministically and runs it via the Deno binary.
