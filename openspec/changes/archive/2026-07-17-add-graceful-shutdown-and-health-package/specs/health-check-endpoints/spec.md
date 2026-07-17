## ADDED Requirements

### Requirement: A registered readiness check may reflect an in-progress graceful shutdown
When both `serve()`'s `gracefulShutdown` option and `@nextrush/health` are used together, it
SHALL be possible for a user to register a readiness check that reflects whether the server is
currently draining, so `/readyz` can flip to `503` the moment shutdown begins rather than only
once fully drained. This SHALL be an optional integration a user wires themselves, not a hard
code dependency between the two packages.

#### Scenario: A registered draining-aware check flips readiness promptly
- **WHEN** a user registers a check that reads a shared "is draining" flag, and a graceful
  shutdown begins
- **THEN** `/readyz` responds with `503` from the moment draining starts, not only after the
  drain completes

#### Scenario: `@nextrush/health` works without `gracefulShutdown` at all
- **WHEN** `@nextrush/health` is installed and used without `serve()`'s `gracefulShutdown` option
- **THEN** `/livez` and `/readyz` function correctly using only whatever checks the user
  registered, with no error or missing dependency related to the shutdown feature
