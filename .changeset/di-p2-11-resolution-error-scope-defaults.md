---
'@nextrush/di': patch
---

DI: accurate missing-dependency errors, unified scope defaults

Three user-observable corrections to `@nextrush/di`:

- **Missing dependency now throws `DependencyResolutionError` (was
  `CircularDependencyError`).** `container.resolve()` checks for a missing /
  unregistered token *before* the circular-dependency heuristic. tsyringe wraps a
  missing *constructor* dependency in a message containing both "Cannot inject the
  dependency" and "unregistered dependency token"; the old ordering matched the
  "Cannot inject" heuristic first and misreported a genuine missing dependency as a
  cycle. A true `A ↔ B` cycle still throws `CircularDependencyError`.
- **`Container.register()` scope now defaults to the class's declared scope
  (singleton), not transient.** An explicit `options.scope` still wins; otherwise the
  class's `di:scope` metadata (via `getServiceScope`, which defaults undecorated
  classes to `'singleton'`) is the single source of truth. Callers relying on the
  previous implicit transient default for a class provider registered without a scope
  now get a singleton — pass `{ scope: 'transient' }` to keep the old behavior.
- **`getServiceScope()` return type narrowed from `Scope | undefined` to `Scope`.**
  It always resolves a concrete scope (`'singleton'` for undecorated classes), so the
  optional was never observable. Backward-compatible for consumers — a stronger
  guarantee, no runtime change.

`@Service` global registration behavior is unchanged.
