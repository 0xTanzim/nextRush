---
'@nextrush/controllers': patch
'@nextrush/di': patch
---

Class-based polish: single-resolve, preserved DI errors, idempotent bootstrap

- Controllers are resolved exactly once across boot-time validation and request
  handling via a shared instance cache (no behavior change; removes a redundant
  resolve).
- Boot-time validation now surfaces `@nextrush/di` error types
  (`CircularDependencyError`, `DependencyResolutionError`) directly instead of
  wrapping them in a generic `ControllerResolutionError`, so their guidance is
  visible at the top level.
- `container.bootstrap()` is now safely re-runnable: repeated calls (or multiple
  registration cycles on a shared container) no longer skip factory providers.
