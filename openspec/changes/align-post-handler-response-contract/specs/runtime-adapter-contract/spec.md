# Spec Delta — runtime-adapter-contract

## ADDED Requirements

### Requirement: Post-handler writes and timeout completion are parity-pinned across adapters

Observable parity across adapters SHALL extend to the middleware surface that runs after the
handler: a post-handler response-header write MUST produce the same observable outcome on every
adapter, and a handler that commits a response and then outlives the configured timeout MUST deliver
that committed response on every adapter. A divergence in either MUST fail the cross-adapter
conformance suite rather than being treated as an adapter-specific detail.

#### Scenario: A post-handler header write behaves identically everywhere

- **WHEN** the conformance suite runs a middleware that writes a response header after `await next()`
  against every shipped adapter
- **THEN** every adapter completes the full middleware chain and reports the same header outcome

#### Scenario: A committed response outlives the timeout on every adapter

- **WHEN** a handler commits a response and then continues working past the configured timeout on
  every shipped adapter
- **THEN** every adapter delivers the committed response and none substitutes a `504`

#### Scenario: A divergence fails the suite

- **WHEN** any adapter's post-handler write outcome or timeout-completion outcome differs from the
  others
- **THEN** the cross-adapter conformance suite fails and the adapter is not considered shipped
