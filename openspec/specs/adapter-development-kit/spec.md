# adapter-development-kit

## Purpose

The `nextrush generate adapter` scaffolder (in `@nextrush/dev`) that emits a contract-conformant
adapter wired to the shared conformance suite, plus the testing-tier conformance entrypoint that
lets external authors certify their own adapter.

## Requirements

### Requirement: Adapter scaffolder generates a contract-conformant adapter
The `@nextrush/dev` CLI SHALL provide `nextrush generate adapter <name>` that scaffolds a new adapter conforming to the two-tier contract. The scaffold MUST include: an `adapter.ts` with a compile-time `satisfies ServerAdapter | FetchAdapter` guard and a context-factory stub, a `conformance.test.ts` wired to run the shared conformance suite against the new adapter, a `fixtures/` directory (for fetch/event adapters), a `README.md`, and a CI job snippet.

#### Scenario: Scaffold compiles and declares a contract
- **WHEN** a developer runs `nextrush generate adapter my-runtime` and builds the result
- **THEN** the generated `adapter.ts` type-checks and satisfies one of the two adapter contracts via its guard

#### Scenario: Scaffold is certifiable from day one
- **WHEN** the developer runs the generated `conformance.test.ts` against a minimally-completed adapter
- **THEN** the shared conformance suite executes and reports pass/fail for the new adapter without the developer wiring the suite by hand

### Requirement: Conformance suite is consumable by external adapter authors
The cross-adapter conformance suite SHALL be consumable by out-of-repo adapter authors via a testing-tier entrypoint, so a third-party runtime can be certified against the same parity contract as the built-in adapters. This entrypoint is a testing/dev-tier surface, distinct from the frozen public runtime API.

#### Scenario: External adapter runs the shared suite
- **WHEN** an external author imports the conformance testing entrypoint and runs it against their adapter
- **THEN** the same suite that validates the built-in adapters runs against theirs and produces a comparable result

#### Scenario: Testing entrypoint is not part of the frozen runtime API
- **WHEN** the repo-wide public-surface snapshot is evaluated
- **THEN** the conformance testing entrypoint is classified in the testing/dev tier, not the frozen public runtime surface
