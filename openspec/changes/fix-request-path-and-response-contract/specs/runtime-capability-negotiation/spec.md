# Spec Delta

## ADDED Requirements

### Requirement: Request-target preservation is a negotiated capability

`RuntimeCapabilities` SHALL include a `rawRequestTarget: boolean` flag produced by
`capabilitiesFor()`/`probeCapabilities()` like every other capability flag, reporting whether the
runtime is verified to hand the application the request target unnormalized. The flag SHALL be `true`
only where that is empirically confirmed. It informs documentation and the conformance expectation
for target-dependent guarantees such as dot-segment rejection; it MUST NOT be used to branch on
runtime identity.

#### Scenario: Runtimes that preserve the target report true

- **WHEN** `capabilitiesFor('node')` is queried
- **THEN** it reports `rawRequestTarget: true`, matching the raw request target the Node adapter
  receives

#### Scenario: A normalizing runtime reports false rather than assuming parity

- **WHEN** a runtime normalizes the request target before the application observes it
- **THEN** `capabilitiesFor()` reports `rawRequestTarget: false` for it, rather than inheriting the
  answer of another runtime

#### Scenario: The producing mapping is exempt, decisions are not

- **WHEN** the lint rule scans for runtime-identity capability branching
- **THEN** the `capabilitiesFor()` mapping that produces this flag is not flagged, while any
  behaviour that branches on a runtime name to decide target handling fails the rule

#### Scenario: Conformance derives its expectation from the capability

- **WHEN** the conformance suite asserts dot-segment handling for an adapter
- **THEN** it reads `rawRequestTarget` and asserts the documented outcome for that value, and a
  divergence between the reported capability and the observed behaviour fails the suite

#### Scenario: Named capability profiles expose the flag

- **WHEN** a `CapabilityProfile` is read for documentation or defaults
- **THEN** it includes `rawRequestTarget`, derived from `capabilitiesFor()` and not hand-maintained
  separately
