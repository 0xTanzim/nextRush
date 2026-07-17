## ADDED Requirements

### Requirement: NextRush is ESM-only, permanently

NextRush SHALL publish ESM only, as a permanent, ratified architectural decision — not a default, not a "current" state, and not open for reconsideration absent a new maintainer decision and a hard external forcing function. No published package's `exports` map SHALL ever declare a `require` condition. This decision, its rationale, and the documented interop path for CommonJS consumers MUST be published in the versioning/compatibility documentation.

#### Scenario: Policy is documented as final, with rationale
- **WHEN** a consumer consults the versioning/compatibility documentation
- **THEN** the ESM-only policy is stated as a permanent decision (no hedging language such as "currently" or "at this time"), with its rationale (dual-package hazard avoidance, Node ≥22 baseline, single publishing pipeline) and the supported ways to consume the packages

#### Scenario: Packaging conforms to the ESM-only policy
- **WHEN** any published package's `package.json` is inspected
- **THEN** `type` is `module`, the `exports` map declares no `require` condition, and this holds for every package, with no exceptions

#### Scenario: CommonJS `require()` is not a supported consumption path
- **WHEN** a CommonJS project runs `require('nextrush')` (or any `@nextrush/*` package) without using Node's native `require(esm)` support
- **THEN** the documented ESM-only boundary applies — this is expected, intentional behavior, not a bug — and the documentation provides the supported interop path

#### Scenario: Interop guidance for CommonJS consumers is documented
- **WHEN** a CommonJS consumer needs to use a NextRush package
- **THEN** the documentation provides the supported interop path — dynamic `import()`, and the Node ≥22.12 native `require(esm)` note for synchronous graphs (applicable here: the core entry graph has no top-level `await`)

#### Scenario: The policy cannot silently regress
- **WHEN** any pull request or release adds a `require` condition to any published package's `exports` map
- **THEN** an automated packaging-conformance check fails the change before it merges or ships
