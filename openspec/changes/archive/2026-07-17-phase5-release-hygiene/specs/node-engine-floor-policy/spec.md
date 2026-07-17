## ADDED Requirements

### Requirement: The Node engine floor is documented with rationale

The `>=22` Node engine floor SHALL be documented with an explicit, justified rationale in the versioning/compatibility documentation. The declared floor MUST be consistent across every published package and MUST match the CI runtime matrix.

#### Scenario: Engine-floor rationale is published
- **WHEN** a reader consults the versioning/compatibility documentation
- **THEN** the `>=22` floor is stated with its rationale (why Node 20 LTS is dropped; noting that `AbortSignal.any` requires only Node ≥20.3, so `>=22` is a deliberate choice rather than a hard technical minimum) and a statement of the conditions under which the floor would be reconsidered

#### Scenario: The declared floor is consistent across packages
- **WHEN** every published package's `engines.node` field is inspected
- **THEN** each declares `>=22.0.0`, matching the documented policy

#### Scenario: The CI matrix matches the documented floor
- **WHEN** the CI runtime matrix (T003) is inspected
- **THEN** it exercises a Node range consistent with the documented `>=22` policy
