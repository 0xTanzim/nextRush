# Spec Delta

## ADDED Requirements

### Requirement: Conformance covers behaviour observable only over a real socket

The cross-adapter conformance suite SHALL include scenarios that drive a real listener rather than
constructing `Request` objects in-process, for behaviour whose outcome depends on what the platform
does before the application observes the request — request-target handling and dot-segment rejection
in particular. A scenario whose outcome cannot be observed in-process SHALL be marked as requiring a
real socket, and its result SHALL carry the proof level it was produced at.

#### Scenario: Dot-segment handling is asserted over a real listener

- **WHEN** the conformance suite runs its dot-segment scenarios
- **THEN** each adapter is exercised through a real listener, and the request is issued over that
  listener rather than constructed in-process

#### Scenario: In-process construction cannot satisfy the scenario

- **WHEN** a driver offers only in-process request construction for a socket-required scenario
- **THEN** the scenario is reported as not satisfied at real-runtime level rather than passing

#### Scenario: The expectation follows the negotiated capability

- **WHEN** a socket-required scenario asserts target handling for an adapter
- **THEN** the expected outcome is derived from that adapter's negotiated request-target capability and
  documented platform behaviour, not from a uniform promise

#### Scenario: A divergence fails the suite

- **WHEN** an adapter's observed target handling disagrees with its reported capability or its
  documented expectation
- **THEN** the conformance run fails and names the adapter and the scenario

#### Scenario: Socket-required scenarios are reported per adapter

- **WHEN** the conformance results are summarized
- **THEN** each adapter's socket-required scenarios are reported separately from in-process scenarios,
  so a green in-process result is never presented as proof of socket-observable behaviour
