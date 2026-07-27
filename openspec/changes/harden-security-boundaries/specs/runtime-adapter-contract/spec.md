## ADDED Requirements

### Requirement: Header writes are validated against the full HTTP field grammar

The shared response-header write path SHALL validate that a field name is a valid RFC 9110 token and
that a field value contains no control characters and no leading or trailing whitespace — not only
carriage return and line feed. A rejection SHALL throw a typed framework error, not a bare `Error`,
and SHALL be identical on every adapter rather than relying on the underlying platform's own
validation as the only line of defense.

#### Scenario: A non-token field name is rejected

- **WHEN** `ctx.set('X Foo', 'bar')` or `ctx.set('X:Foo', 'bar')` is called
- **THEN** a typed header-validation error is thrown before the platform is touched

#### Scenario: A control character in a value is rejected

- **WHEN** a header value containing a NUL, `\x1F`, or `\x7F` byte is set
- **THEN** a typed header-validation error is thrown

#### Scenario: Obs-fold and surrounding whitespace are rejected

- **WHEN** a header value with a leading space, a trailing space, or an embedded `\r\n\t` sequence is
  set
- **THEN** a typed header-validation error is thrown

#### Scenario: CR and LF remain rejected in both name and value

- **WHEN** either the field name or the field value contains `\r` or `\n`
- **THEN** a typed header-validation error is thrown

#### Scenario: Array values are validated element-wise

- **WHEN** a header is set with an array value where one element is invalid
- **THEN** the write is rejected and no element is applied

#### Scenario: Numeric values are accepted

- **WHEN** a header is set with a numeric value such as a content length
- **THEN** the write succeeds

#### Scenario: Validation is identical across adapters

- **WHEN** the conformance suite performs each rejected write above on every adapter
- **THEN** every adapter throws the same typed error for the same input

### Requirement: The client-IP trust policy is a conformance-pinned parity requirement

The proxy trust specification and its chain-walk semantics SHALL be defined once in the shared runtime
and consumed unchanged by every adapter. The conformance suite SHALL assert that no adapter can be
made to return a client-authored forwarded entry, and that an adapter which cannot supply a direct
peer address refuses a trusted-peer-list configuration at boot.

#### Scenario: One policy implementation serves every adapter

- **WHEN** the adapters' client-IP resolution is inspected
- **THEN** each delegates to the shared policy with no adapter-local precedence or validation logic

#### Scenario: No adapter returns an untrusted forwarded entry

- **WHEN** the conformance suite sends a forged leftmost forwarded entry with each supported trust
  specification to every adapter
- **THEN** no adapter returns the forged value

#### Scenario: An adapter without a peer address refuses a peer list

- **WHEN** an adapter that cannot supply a direct peer address is configured with a trusted-peer CIDR
  list
- **THEN** boot throws with an error directing the developer to a hop count

## MODIFIED Requirements

### Requirement: Observable parity across adapters

For the shared `Context` contract, all adapters SHALL be observationally identical. The cross-adapter conformance suite MUST pass for every shipped adapter. Where an adapter reports the `http2` capability, observable parity MUST additionally hold across HTTP/1.1, HTTPS/1.1, and negotiated HTTP/2 for that adapter — routing, middleware execution, streaming, request-body handling, and error handling MUST produce byte-identical responses regardless of which transport a given request negotiated.

Parity MUST additionally hold for the security-relevant contract surface: client-IP resolution under
every supported proxy trust specification, header-write validation outcomes, the canonical `ctx.path`
and `ctx.originalPath` values, and dot-segment rejection. A security behavior that holds on one
adapter and not another MUST be treated as a conformance failure, not an adapter-specific detail.

#### Scenario: Retrofit preserves behavior

- **WHEN** an existing adapter is retrofitted to the typed contract
- **THEN** the conformance suite produces byte-identical responses (status, headers, body) before and after the retrofit

#### Scenario: HTTP/2 parity holds where the capability is reported

- **WHEN** an adapter reports `RuntimeCapabilities.http2: true` and the conformance suite runs the same request over HTTP/1.1 and negotiated HTTP/2
- **THEN** status, headers, and body are byte-identical between the two transports

#### Scenario: An adapter without http2 is not required to prove HTTP/2 parity

- **WHEN** an adapter reports `RuntimeCapabilities.http2: false`
- **THEN** the conformance suite does not require HTTP/2 scenarios for that adapter, consistent with `runtime-capability-negotiation`'s graceful-degradation requirement

#### Scenario: Security parity is asserted, not assumed

- **WHEN** the conformance suite runs its security-parity scenarios (client IP under each trust form,
  rejected header writes, canonical path, dot-segment rejection) against every shipped adapter
- **THEN** all adapters produce identical outcomes, and a divergence fails the suite

#### Scenario: A new adapter cannot ship without the security-parity scenarios

- **WHEN** a new adapter is added to the conformance driver
- **THEN** the security-parity scenarios run against it and must pass before it is considered shipped
