---
"@nextrush/dev": minor
---

Two additive `@nextrush/dev` CLI improvements (gap-checklist T043/T044):

**Configurable Deno permissions.** `nextrush dev` under Deno previously spawned with a
hardcoded, fixed permission set (`--allow-net --allow-read --allow-env`) — a Deno app
needing anything more (`--allow-write`, `--allow-ffi`, `--allow-run`, scoped forms like
`--allow-read=./data`) simply could not run under the CLI. `nextrush.config.ts` now
accepts `dev.deno.permissions: string[]`, which is **merged into** the default set,
deduplicated — it never replaces it, so the defaults are byte-identical when nothing is
configured. Each configured value must begin with `--allow-` or `--deny-`; an invalid
value fails the command before Deno is ever spawned, naming the offending value.

**Workspace-aware build scoping.** `nextrush build`'s recursive TypeScript file scan now
resolves its scan root to the nearest enclosing `package.json` directory (walking upward
from the entry file's own directory) and excludes any subdirectory inside that tree that
carries its own `package.json` — a nested or vendored package is never pulled into the
current package's build output, and a sibling package in a pnpm/npm/Turborepo workspace
is excluded because the scan never ascends above the resolved boundary. Single-package
projects, and projects with no `package.json` anywhere above the entry, are unaffected
(falls back to the entry-directory-rooted scan used before this feature).

Both changes are additive and non-breaking: no new runtime dependency, no change to
existing defaults, no change to the SWC transpile path.
