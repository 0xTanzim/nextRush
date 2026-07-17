## ADDED Requirements

### Requirement: Every published package declares its support tier

Each published package SHALL visibly state its `ADR-0005` support tier in its README so adopters can distinguish supported public surface from internal plumbing. Internal-only symbols surfaced by a package MUST be labeled as internal, and `ADR-0005` MUST remain the current single source of truth for the tier assignments.

#### Scenario: A package README states its tier
- **WHEN** a reader opens any published package's README
- **THEN** it states that package's `ADR-0005` tier (Public–core, Public–middleware/registrar, Public–extensions, Public–tooling, or Internal)

#### Scenario: A newcomer can identify the supported surface from docs alone
- **WHEN** a newcomer surveys the package set without reading source
- **THEN** each package's supported-vs-internal status is derivable from its README

#### Scenario: ADR-0005 is current
- **WHEN** `ADR-0005`'s tier table is consulted
- **THEN** it reflects the current package set — the removed `@nextrush/decorators` and `@nextrush/controllers` shims appear only as a historical note, not as live "Deprecated" packages
