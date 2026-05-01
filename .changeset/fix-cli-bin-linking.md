---
'nextrush': patch
'@nextrush/dev': patch
'create-nextrush': patch
---

Fix CLI install reliability:

- Ensure the `nextrush` meta-package never declares a `bin` entry (prevents pnpm bin-link conflicts).
- Ensure `@nextrush/dev` always builds before publish so `nextrush`/`nextrush-dev` binaries work.
- Add a repo-wide bin validator to catch missing `bin` targets during verification.
- Scaffold projects with `nextrush dev` / `nextrush build` scripts (no `npx`).
- Include `@nextrush/dev` in scaffolded dev dependencies so fresh installs expose the local CLI.
