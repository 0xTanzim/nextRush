# runtime-capability-negotiation

## Purpose

The requirement that runtime-varying behavior is decided by negotiated `RuntimeCapabilities`
(never by runtime identity), including graceful degradation, explicit refusal, unknown-runtime
probing, and named `CapabilityProfile`s per runtime.
## Requirements
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

### Requirement: Graceful degradation or explicit refusal
When a required capability is absent, capability code SHALL either degrade gracefully or refuse with a clear, typed error. It MUST NOT crash the process or fail silently.

#### Scenario: Missing capability degrades
- **WHEN** cancellation-signal support is unavailable on a runtime
- **THEN** the feature degrades (logs and continues) rather than throwing an unhandled error

#### Scenario: Missing capability refuses clearly
- **WHEN** a filesystem-dependent middleware runs on an edge runtime without a filesystem
- **THEN** it refuses with an explicit, typed error naming the missing capability

### Requirement: Unknown runtimes work via probing
An unknown runtime that supports the WinterCG Minimum Common Web Platform API SHALL be supported with no code change, via feature-detected `probeCapabilities()`.

#### Scenario: Unknown Web-standard runtime is served
- **WHEN** the runtime is unrecognized by `detectRuntime()` but exposes `Request`/`Response`/`ReadableStream`/`AbortSignal`/`crypto.subtle`
- **THEN** `probeCapabilities()` returns the correct capability set and the request pipeline runs unchanged

### Requirement: Named capability profiles
The runtime SHALL expose a named `CapabilityProfile` per known runtime (at minimum Node, Bun, Deno, Cloudflare, Lambda), each a documented view derived from `capabilitiesFor()` — not hand-maintained duplicate constants. Profiles are capability *data* for defaults, documentation, and debugging; they MUST NOT be used to branch capability *decisions* (which remain governed by `getRuntimeCapabilities()`).

#### Scenario: Profile reflects the capability matrix
- **WHEN** `capabilitiesFor('cloudflare')` reports no filesystem and web-streams support
- **THEN** the exported `CloudflareProfile` shows `filesystem: false` and `webStreams: true`, matching the source of truth

#### Scenario: Unknown runtime gets a probed profile
- **WHEN** a profile is requested for an unrecognized runtime
- **THEN** it is built from `probeCapabilities()` rather than a hardcoded table

#### Scenario: Profiles do not become a runtime-identity branch
- **WHEN** the lint rule scans capability decisions
- **THEN** reading a `CapabilityProfile` for display/defaults is permitted, but branching logic on runtime identity still fails the rule

### Requirement: Transport capability flags are negotiated, not asserted
`RuntimeCapabilities` SHALL include `secureServing: boolean` and `http2: boolean` flags, produced by `capabilitiesFor()`/`probeCapabilities()` per runtime — the same negotiation mechanism as every existing capability flag. Neither flag MAY be hardcoded `true` for a runtime without empirical verification that the runtime's native serving primitive actually negotiates the corresponding transport.

#### Scenario: Node reports secureServing and http2 once implemented
- **WHEN** `capabilitiesFor('node')` is queried after Node's TLS/ALPN path ships
- **THEN** it reports `secureServing: true` and `http2: true`, matching `node:http2`'s actual ALPN negotiation behavior

#### Scenario: A runtime without verified HTTP/2 support reports false, not true
- **WHEN** a runtime's native serving primitive has not been empirically confirmed to negotiate HTTP/2 (e.g., `Bun.serve()`'s TLS path pending verification)
- **THEN** `capabilitiesFor()` reports `http2: false` for that runtime rather than assuming parity with another runtime

#### Scenario: Named capability profiles expose the new flags
- **WHEN** a `CapabilityProfile` (e.g. `NodeProfile`, `DenoProfile`) is read for documentation or defaults
- **THEN** it includes `secureServing` and `http2`, derived from `capabilitiesFor()` and not hand-maintained separately

#### Scenario: Application code queries the capability, never runtime identity
- **WHEN** code needs to decide whether to offer a TLS-only feature
- **THEN** it queries `getRuntimeCapabilities().secureServing`, and the existing lint rule (`no-runtime-identity-capability`) rejects any `runtime === 'node'`-style substitute for this decision
