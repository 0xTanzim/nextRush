# router-radix-rfc Specification

## Purpose
TBD - created by archiving change fix-router-issues-and-author-radix-rfc. Update Purpose after archive.
## Requirements
### Requirement: A published RFC specifies the future radix router package
A published RFC at `docs/RFC/RFC-NEXTRUSH-ROUTER-RADIX.md` SHALL specify the future
`@nextrush/router-radix` package before that package is implemented, following this repo's
RFC-before-implementation discipline for new packages.

#### Scenario: The RFC exists and follows the repo's RFC convention
- **WHEN** the RFC is authored
- **THEN** it exists at `docs/RFC/RFC-NEXTRUSH-ROUTER-RADIX.md`, matching the naming and
  structure of existing RFCs (e.g. `RFC-NEXTRUSH-ADAPTER-CONTRACT.md`)

#### Scenario: The RFC specifies the shared contract and conformance-parity model
- **WHEN** the RFC is reviewed for completeness
- **THEN** it defines the `Router` contract a conformant router must implement, and a
  router-conformance parity harness (modeled on `packages/adapters/conformance`) that runs
  against both the segment-trie and radix routers

#### Scenario: The RFC states honest costs and the default-router positioning
- **WHEN** the RFC's costs/risks section is read
- **THEN** it explicitly addresses the maintenance/bus-factor cost of a second router against a
  single-maintainer project, and states that the segment-trie router remains the default with
  radix opt-in for a stated reason — never a forced choice

#### Scenario: The RFC captures the deferred hot-path optimization as measurement-gated
- **WHEN** the RFC's design-considerations section is read
- **THEN** it records the `Reflect.deleteProperty`/param-materialization consideration as a
  measurement-gated item (settled by benchmark T017), not a committed change

