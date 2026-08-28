## ADDED Requirements

### Requirement: Environment and production detection in middleware is explicit and edge-portable
Middleware SHALL NOT depend on a dependency's private or removed helpers for
environment/production detection, and SHALL NOT read `process.env` (or reference
a Node-only global) in the request path. Production-mode behavior MUST be
deterministic across Node, Bun, Deno, and edge runtimes, either from an explicit
option configured by the application or from a Web-standard capability probe —
never from a silently-removed internal helper.

#### Scenario: Logger middleware production mode is driven by an explicit option
- **WHEN** an application configures the logger middleware with production-mode behavior
- **THEN** that behavior is determined by an explicit, documented middleware option (e.g. an `environment` value), not by a removed `@nextrush/log` internal helper

#### Scenario: Edge runtimes load the logger middleware without process
- **WHEN** the logger middleware is loaded on an edge runtime that has no `process`
- **THEN** it loads and constructs without touching `process` — production-mode defaults are derived from the explicit option, never from `process.env`

#### Scenario: A reintroduced private-helper dependency fails the portability guard
- **WHEN** the logger middleware's source re-introduces a call to a removed `@nextrush/log` internal (`isProductionBuild`, `shouldLog`, `detectRuntime`, …)
- **THEN** the middleware's portability guard / surface-link test fails, naming the missing dependency export