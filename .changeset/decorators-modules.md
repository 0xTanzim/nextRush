---
'@nextrush/decorators': minor
---

Decorators: `@Module` class decorator for feature composition

Adds `@Module({ imports, controllers, providers, exports })` plus the readers
`isModule` and `getModuleMetadata`, and the `ModuleProvider` / `ModuleOptions` /
`ModuleProviderConfig` / `ModuleMetadata` types. A module records a feature's
composition as metadata: the modules it imports, the controllers it owns, the
providers it registers, and the providers it exports.

`exports` is captured in metadata now for future per-module encapsulation but is
not enforced yet — this wave ships modules as composition/grouping units. See
`docs/RFC/RFC-NEXTRUSH-MODULES.md`.
