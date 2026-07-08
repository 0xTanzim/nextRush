---
'@nextrush/class': patch
'@nextrush/dev': patch
---

Stabilization for 1.0-rc:

- **@nextrush/class:** sealed the public API surface — implementation internals
  (deepFreeze, bootstrapPipeline, BootstrapContext, ResolvedBootstrapOptions, ClassRef) are no
  longer exported from the package root, and a public-surface snapshot test locks the export
  set against accidental widening. No change to the intended public contract.
- **@nextrush/dev:** split the build command into cohesive sub-300-line modules, removed the
  `glob` runtime dependency in favour of the Node built-in, and trimmed the dev command under
  the file-size cap. Behavior-preserving.
