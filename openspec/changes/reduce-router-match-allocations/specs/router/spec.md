## ADDED Requirements

### Requirement: Reused internal walk state is never shared across concurrent in-flight matches

If `@nextrush/router`'s tree-walk match path reuses internal scratch state (a frame stack, binding
arrays) across calls to avoid per-call allocation, that reused state SHALL be scoped so that no two
concurrent in-flight `matchRoute()` calls on the same router instance can observe or corrupt each
other's walk progress. The walk SHALL remain fully synchronous end-to-end for this guarantee to
hold; introducing any `await` inside the walk without re-deriving this invariant is a breaking
change to this requirement, not a safe extension.

#### Scenario: Sequential matches reuse state safely

- **WHEN** the same router instance handles two requests one after another, and both use pooled
  internal walk state
- **THEN** the second match's result is unaffected by the first match's params, path, or outcome

#### Scenario: The walk never awaits mid-frame

- **WHEN** the tree-walk match path executes
- **THEN** no frame of the walk suspends on a promise before the match completes — the entire walk
  from entry to a matched or unmatched result runs in one synchronous pass

#### Scenario: A matched request's observable result is unchanged by internal reuse

- **WHEN** a request matches a parameterized route on a router using pooled internal walk state
- **THEN** the returned `RouteMatch`'s `params`, `handler`, `middleware`, and `executor` are
  identical to what an unpooled implementation would return for the same input
