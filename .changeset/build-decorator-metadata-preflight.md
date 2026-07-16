---
"@nextrush/dev": patch
---

`nextrush build` now validates decorator-metadata emission configuration
(`experimentalDecorators` / `emitDecoratorMetadata` in `tsconfig.json`) before completing, and
fails fast with remediation text when the two flags are mismatched — instead of silently shipping
a build that would only fail later, at DI-resolution time, with a `TypeInfo not known for X`
error.

A project with neither flag set (functional, decorator-free) is unaffected. A project with both
flags correctly set is unaffected. Only a project that already had a broken decorator-metadata
config — previously a silent, deferred failure — now fails at build time instead, with the same
remediation text `nextrush dev`'s existing warning already used. `nextrush dev` itself is
unchanged: it still warns and continues rather than exiting, since an active dev session
shouldn't hard-stop on a config warning.

See `packages/di/README.md`'s "TypeInfo not known for X" troubleshooting entry for the full
before/after behavior.
