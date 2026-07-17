## MODIFIED Requirements

### Requirement: Capability decisions use negotiated capabilities
Runtime-varying behavior SHALL be decided by querying `RuntimeCapabilities` (via `getRuntimeCapabilities()`), never by branching on runtime identity. Runtime-identity branching for a capability decision is forbidden in every syntactic form — equality (`runtime === '<name>'` / `!==`), a `switch` on the runtime name, and prefix/membership tests (`runtime.startsWith('<name>')`, `[...].includes(runtime)`) against runtime-name literals. Branching on runtime identity is permitted ONLY for genuine platform-specific optimizations, which MUST be explicitly annotated as capability-exempt. The capability-*producing* mapping in `capabilitiesFor()` (which maps runtime names to capability data, not a runtime decision) is exempt by design.

#### Scenario: Capability-gated feature checks a capability
- **WHEN** code needs filesystem, Node streams, WebSocket, or `crypto.subtle`
- **THEN** it queries the corresponding `RuntimeCapabilities` flag and does not compare `runtime` to a name

#### Scenario: Lint rejects runtime-identity capability branching
- **WHEN** source contains `runtime === 'node'` (or any runtime name) used for a capability decision without a capability-exempt annotation
- **THEN** the lint rule reports an error and CI fails

#### Scenario: Lint rejects a switch on runtime identity
- **WHEN** source uses `switch (runtime)` with `case '<name>'` arms to make a capability decision without a capability-exempt annotation
- **THEN** the lint rule reports an error and CI fails

#### Scenario: Lint rejects prefix/membership runtime-identity tests
- **WHEN** source uses `runtime.startsWith('<name>')` or `[...].includes(runtime)` against runtime-name literals for a capability decision without a capability-exempt annotation
- **THEN** the lint rule reports an error and CI fails

#### Scenario: Annotated optimization is allowed
- **WHEN** a runtime-identity branch is annotated as a platform-specific optimization (capability-exempt with a reason)
- **THEN** the lint rule permits it

#### Scenario: Capability-producing switch is not flagged
- **WHEN** the lint rule scans the `capabilitiesFor()` switch that maps runtime names to capability data
- **THEN** it does not flag it, because it produces capability data rather than making a capability decision
