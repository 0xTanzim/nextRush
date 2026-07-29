# Spec Delta — `core-middleware`

## ADDED Requirements

### Requirement: Composed middleware never drops a thenable return

`compose()` MAY return a shared already-resolved promise instead of a freshly-allocated one when a
middleware returns `undefined`, but it SHALL NOT substitute a resolved promise for any other return
value. A return value that is a promise, a non-Promise thenable, or any defined non-thenable value
SHALL be adopted such that the composed promise settles only after that value has settled.

Testing a middleware's return with `instanceof Promise` (or any check that classifies a non-Promise
thenable as "not a promise") is forbidden, because it would discard that thenable's pending work and
resolve the request early.

#### Scenario: A non-Promise thenable's work is awaited

- **WHEN** a middleware returns a non-Promise thenable that settles asynchronously
- **THEN** the composed middleware's promise does not settle until that thenable has settled, and
  any side effect the thenable performs before settling has already happened

#### Scenario: A falsy-but-defined return is preserved, not collapsed

- **WHEN** a middleware returns `null`, `false`, `0`, or `''`
- **THEN** the composed promise resolves with that exact value — it is not treated as `undefined`
  and not replaced with a shared resolved promise

#### Scenario: An undefined return still yields a resolved promise

- **WHEN** a synchronous middleware returns `undefined`
- **THEN** the composed middleware returns an already-resolved promise whose resolved value is
  `undefined`, and awaiting it completes without an extra observable delay beyond one microtask

#### Scenario: Reusing a resolved sentinel across concurrent requests is safe

- **WHEN** many concurrent composed invocations each return the same shared resolved promise
- **THEN** each caller's continuation runs exactly once, and no caller observes another caller's
  continuation or ordering
