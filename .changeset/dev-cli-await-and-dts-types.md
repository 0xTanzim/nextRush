---
"@nextrush/dev": patch
---

Make the `dev` and `build` CLI commands completion-aware (issue #40): `cli()` now
resolves only after the routed command's work has finished, the dev server child is
awaited before the process exits, and the bin entry points surface an unexpected
rejection as a non-zero exit instead of exiting 0 silently.

Fix `.d.ts` declaration generation for projects whose tsconfig omits
`compilerOptions.types` (issue #40). TypeScript >= 6 no longer auto-includes
`@types/*` when `types` is absent, so the local declaration pass now injects
`--types node` (or `bun-types`) for the detected runtime when the project does not
pin its own `types` list — resolving TS2591 ("Cannot find name 'process'") on
scaffolded projects.
