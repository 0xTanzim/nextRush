## ADDED Requirements

### Requirement: Router source files stay within the 300-line ceiling
No shipping source file in `@nextrush/router` SHALL exceed 300 lines. This completes the
`router-module-size-compliance` requirement (introduced by the `improve-router-modularity`
change) that `router.ts` was left partially satisfying at 525 lines.

#### Scenario: No router source file exceeds the ceiling
- **WHEN** every `.ts` file under `packages/router/src` (excluding tests) is measured
- **THEN** none exceeds 300 lines

#### Scenario: The split preserves the public surface and behavior
- **WHEN** the router's public-surface snapshot test and full test suite run before and after
  the split
- **THEN** the exported symbol set is byte-identical and all behavioral tests pass unchanged

### Requirement: Audit-identified internal duplications are resolved or explicitly justified
The internal duplications the router audit identified SHALL be resolved to single sources where
safe, or their retention explicitly justified in a comment, with all observable behavior
preserved.

#### Scenario: EMPTY_PARAMS has a single definition
- **WHEN** `EMPTY_PARAMS` usage across the router package is examined
- **THEN** it is defined once in a shared internal module and imported by both former sites, OR
  its duplication carries an explicit, verified justification (a genuine import cycle)

#### Scenario: Path normalization has a single definition
- **WHEN** the path-normalization logic used by route matching and by allowed-methods lookup is
  examined
- **THEN** it is defined once in a shared helper both call, rather than encoded twice

#### Scenario: A behavior-sensitive dedup is gated on tests
- **WHEN** a duplication whose removal could change observable behavior (e.g. the `hasParams`
  post-match cleanup loop) is considered for removal
- **THEN** it is only removed if the existing test suite — including param-backtracking edge
  cases — proves the removal behavior-preserving; otherwise it is retained with a documented reason
