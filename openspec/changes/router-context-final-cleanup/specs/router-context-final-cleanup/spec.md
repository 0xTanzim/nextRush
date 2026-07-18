## ADDED Requirements

### Requirement: `ctx.raw` is built lazily and identically

`NodeContext` SHALL allocate the `{ req, res }` wrapper only when `ctx.raw` is read, exposing it via
a memoized getter, and every internal response method MUST use the private `req`/`res` fields rather
than `ctx.raw`. `ctx.raw` SHALL return the same `{ req, res }` shape and identity as today.

#### Scenario: A request that never reads ctx.raw allocates no wrapper
- **WHEN** a request is handled by a handler that uses `ctx.json`/`ctx.send`/`ctx.body` but never reads `ctx.raw`
- **THEN** no `{ req, res }` wrapper object is allocated for that request

#### Scenario: ctx.raw returns the identical shape and is memoized
- **WHEN** `ctx.raw` is read (once or repeatedly)
- **THEN** it returns `{ req, res }` with the same `req`/`res` as the underlying request/response, and repeated reads return the same object (`ctx.raw === ctx.raw`)

#### Scenario: Response methods still behave identically
- **WHEN** `ctx.json` / `ctx.send` / `ctx.html` / `ctx.redirect` / streaming / `ctx.signal` / client-IP resolution run after the refactor
- **THEN** their observable behavior (status, headers, body, signal, `ctx.ip`) is byte-identical to today, using the private `req`/`res` fields

### Requirement: The `findNode` walk used by `findAllowedMethods` is iterative

`findNode` SHALL walk the trie with an explicit stack rather than recursion, so a pathological
segment count on the 405/OPTIONS path cannot overflow the call stack, while producing byte-identical
results (same static > param > wildcard precedence, same first-matching node).

#### Scenario: findAllowedMethods results are unchanged
- **WHEN** `findAllowedMethods` is exercised across a corpus (static, param, wildcard, nested, trailing-slash, method-miss)
- **THEN** the returned method sets are identical to the recursive implementation for every input

#### Scenario: A deep path on the 405/OPTIONS path does not overflow the stack
- **WHEN** a request with a very large number of segments hits the allowed-methods walk (e.g. an OPTIONS or unregistered-method request to a deep path)
- **THEN** `findNode` resolves or returns null without a stack overflow (iterative walk), matching the DoS-safety the match path already has

#### Scenario: Precedence is preserved
- **WHEN** static, param, and wildcard branches could match at a node
- **THEN** the iterative `findNode` selects the same branch order (static > param > wildcard) as the recursive form

### Requirement: The router hot path stays free of the removed deopt patterns (HP-18 guard)

The router match path SHALL remain free of the backtrack `Reflect.deleteProperty` and the
`Object.keys` post-match loop that the P2 rewrite removed; a regression guard MUST fail if either is
reintroduced into the router match source.

#### Scenario: No Reflect.deleteProperty or Object.keys post-loop in the router match path
- **WHEN** the router match sources (`matching.ts` / `match-route.ts`) are checked by the guard
- **THEN** they contain no backtrack `Reflect.deleteProperty` and no `Object.keys`-based post-match param loop

### Requirement: The cleanup is validated by allocation, parity, and coverage gates

Because both trims are cleanup (HP-5 <1%, HP-17 off the throughput path), the change SHALL be
accepted on deterministic allocation evidence, differential parity, and the deep-path safety test
rather than an RPS A/B, and coverage MUST NOT decrease.

#### Scenario: An allocation micro-benchmark confirms the lazy raw saving
- **WHEN** the allocation micro-bench runs on a raw-unread request
- **THEN** it shows the `{ req, res }` wrapper is no longer allocated

#### Scenario: Response parity is unaffected
- **WHEN** `pnpm bench:validate` runs across all benchmark servers
- **THEN** response bodies and Content-Type remain byte-identical

#### Scenario: Coverage is maintained and refactored branches are covered
- **WHEN** the adapter-node and router test suites run with coverage
- **THEN** per-package line coverage stays at or above 90% and the refactored `ctx.raw` and iterative `findNode` branches are covered
