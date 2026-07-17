## ADDED Requirements

### Requirement: Public API reference coverage

Every public export of every published package SHALL have an accurate reference documentation entry, at a depth appropriate to the package's `ADR-0005` tier. Reference completeness MUST be measured against the locked public surface (the `public-surface-lock` / T005 snapshots).

#### Scenario: Every locked public export is documented
- **WHEN** the set of public exports (per the public-surface snapshots) is cross-checked against the reference documentation
- **THEN** every exported symbol has a corresponding, accurate reference entry

#### Scenario: Depth follows the package tier
- **WHEN** a Tier 1 core package's docs are compared with a Tier 3 tooling package's docs
- **THEN** the Tier 1 package has full architectural treatment and the Tier 3 package has at least purpose + install + minimal usage + reference, per the tiering convention

### Requirement: Documentation accuracy

No documentation claim SHALL contradict current source behavior. Where documentation and source disagree, the documentation MUST be corrected to match source; a genuine source defect surfaced this way MUST be logged as a separate finding rather than worked around in documentation.

#### Scenario: No claim contradicts source
- **WHEN** any public API's documentation is spot-checked against its implementation
- **THEN** the documented signature, options, and behavior match the source

#### Scenario: Examples are runnable and current
- **WHEN** a documented code example is run against the current packages
- **THEN** it executes and produces the documented result, with no reference to a removed API (such as `app.plugin()`)

### Requirement: Production and operational guides for shipped capabilities

The documentation SHALL cover the operational topics that ship at v1.0 — graceful shutdown, health/readiness probes, deployment and hardening, and each network-exposed package's security posture. Enterprise capabilities that do not ship at v1.0 MUST be represented as roadmap, never as usable features.

#### Scenario: Shipped operational topics are documented
- **WHEN** an operator looks for graceful-shutdown, health/readiness, or deployment-hardening guidance
- **THEN** each shipped topic has a guide grounded in the actually-shipped API (T010 shutdown, T011 health, the deploy guides)

#### Scenario: Unbuilt features are not documented as usable
- **WHEN** the documentation refers to an unbuilt Phase 3 capability (OpenTelemetry, metrics, typed config, auth, session)
- **THEN** it is labeled as planned / not yet available, with no runnable example implying the feature exists

### Requirement: The strict documentation gate passes

`pnpm docs:validate:strict` SHALL pass and MUST be part of the verification for this capability.

#### Scenario: Strict docs validation is green
- **WHEN** `pnpm docs:validate:strict` runs in CI
- **THEN** it completes with no errors
