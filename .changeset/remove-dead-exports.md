---
'@nextrush/decorators': major
'@nextrush/controllers': major
'@nextrush/di': major
'nextrush': major
---

Remove dead, phantom, and deprecated public exports

Several exported symbols were never wired into any live code path (only tests
or docs referenced them) or were deprecated aliases scheduled for removal.
They are now deleted from source and from every barrel/`index.ts`. This is a
breaking change for anyone importing them directly.

Removed exports:

- **`@nextrush/decorators`** — `buildFullPath`, `getMethodParameterTypes`,
  `getMethodReturnType` (dead metadata readers with no callers). The live path
  builder `buildFullRoutePath` in `@nextrush/controllers` is unaffected. The
  unused `INTERCEPTORS` key was also removed from `DECORATOR_METADATA_KEYS`
  (no interceptor implementation exists).
- **`@nextrush/di`** — `AutoInjectable` (deprecated alias for `Injectable`,
  previously flagged "removed in v4"), `TypeInferenceError` and
  `ContainerDisposedError` (never thrown by the container), and
  `MissingDependencyError` (deprecated in favor of `DependencyResolutionError`,
  no live throw site).
- **`@nextrush/controllers`** — `registerController` (singular, lower-level
  helper with no live callers). Use `registerControllers(app, { controllers: [...] })`
  for manual registration instead.
- **`nextrush`** — the `nextrush/class` entry no longer re-exports
  `AutoInjectable`.

Migration:

- Replace `@AutoInjectable()` with `@Injectable()`.
- Replace `MissingDependencyError` catches with `DependencyResolutionError`.
- Replace `registerController(router, C, container)` with
  `registerControllers(app, { controllers: [C], container })`.
