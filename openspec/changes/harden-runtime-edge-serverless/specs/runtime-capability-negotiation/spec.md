## ADDED Requirements

### Requirement: Capability decisions use negotiated capabilities
Runtime-varying behavior SHALL be decided by querying `RuntimeCapabilities` (via `getRuntimeCapabilities()`), never by branching on runtime identity (`runtime === '<name>'`). Branching on runtime identity is permitted ONLY for genuine platform-specific optimizations, which MUST be explicitly annotated as capability-exempt.

#### Scenario: Capability-gated feature checks a capability
- **WHEN** code needs filesystem, Node streams, WebSocket, or `crypto.subtle`
- **THEN** it queries the corresponding `RuntimeCapabilities` flag and does not compare `runtime` to a name

#### Scenario: Lint rejects runtime-identity capability branching
- **WHEN** source contains `runtime === 'node'` (or any runtime name) used for a capability decision without a capability-exempt annotation
- **THEN** the lint rule reports an error and CI fails

#### Scenario: Annotated optimization is allowed
- **WHEN** a runtime-identity branch is annotated as a platform-specific optimization (capability-exempt with a reason)
- **THEN** the lint rule permits it

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
