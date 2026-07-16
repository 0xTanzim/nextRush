## ADDED Requirements

### Requirement: Dependency claims accurately reflect every supported usage path
Documentation stating NextRush's dependency posture (root `README.md`, `@nextrush/di`'s
`README.md`) SHALL NOT assert a single blanket dependency claim (e.g. "zero dependencies") that
is false for any supported usage path. Where usage paths differ in their dependency footprint
(functional vs. class/DI), the documentation SHALL state the footprint per path.

#### Scenario: Functional-only claim is corrected to be path-specific
- **WHEN** a reader consults the root `README.md` for NextRush's dependency footprint
- **THEN** the README states that the functional core is zero-dependency and that the class/DI
  path (`nextrush/class`) depends on `tsyringe` and `reflect-metadata`, rather than an
  unqualified "zero dependencies" claim

#### Scenario: Dependency footprint table is present and verifiable
- **WHEN** a reader wants to confirm the stated dependency footprint against reality
- **THEN** the README includes a table listing each usage path and its actual runtime
  dependencies, and running `pnpm why reflect-metadata tsyringe` against the repo confirms the
  table's claims

## MODIFIED Requirements

None — this capability is new; no existing spec governs dependency-claim accuracy.
