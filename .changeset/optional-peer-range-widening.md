---
'@nextrush/router': patch
'nextrush': patch
---

Widen the optional peer ranges to match the rest of the workspace: `@nextrush/router` now accepts
`@nextrush/core` at `^` rather than an exact version, and `nextrush` accepts
`@nextrush/adapter-nextjs`, `@nextrush/class`, and `@nextrush/di` the same way. The published
ranges now admit compatible minors instead of pinning the version they were developed against, so
a dependency's minor release no longer forces a major release of the dependent package. No runtime
behavior changes.
