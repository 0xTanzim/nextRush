# security-boundaries

## Purpose

Defines the framework's cross-package security contract: the security semantics every
security-relevant middleware (`@nextrush/cookies`, `csrf`, `cors`, `helmet`, `static`, `rate-limit`,
`compression`) must obey, the secure-default set each must ship, the boot-time production audit that
refuses insecure configuration, and the fail-closed rules that govern every security decision. It
exists because these guarantees were previously unspecified and unowned — no capability described
what a NextRush application is protected from by default, which is how eleven findings in
`report/security-review.md` became possible.

The governing rule: **a security decision MUST NOT be made from a value another consumer normalized
for a different purpose, nor from a value an attacker controls.**

## ADDED Requirements

### Requirement: Security decisions fail closed

Every security middleware SHALL reject on missing, malformed, or ambiguous input rather than
allowing the request. A validation layer whose check an attacker can satisfy by omitting or forging a
header MUST NOT treat that condition as a pass.

#### Scenario: A missing signal is not a pass

- **WHEN** a security check depends on a request header that is absent
- **THEN** the check fails and the request is rejected, unless the absence is itself cryptographically
  or structurally unforgeable for the threat model that check defends against

#### Scenario: An unparseable value is rejected, not coerced

- **WHEN** a security-relevant value (origin, token, IP, path) fails to parse
- **THEN** the middleware rejects the request rather than falling back to a permissive default or the
  raw unparsed value

#### Scenario: An internal error in a security middleware denies the request

- **WHEN** a security middleware throws unexpectedly (crypto unavailable, store unreachable)
- **THEN** the request is denied with a 5xx and no downstream handler runs — the failure never
  degrades into skipping the check

### Requirement: CSRF token cookies persist as documented

`@nextrush/csrf` SHALL emit a `Max-Age` attribute only when `cookie.maxAge` is explicitly configured.
An omitted `maxAge` SHALL produce a session cookie with no `Max-Age` attribute, matching the
documented contract. A negative `maxAge` SHALL be rejected at construction time.

#### Scenario: Default configuration issues a usable session cookie

- **WHEN** `csrf()` is constructed without `cookie.maxAge` and a token is generated
- **THEN** the `Set-Cookie` header contains no `Max-Age` attribute and no `Expires` attribute

#### Scenario: Round trip succeeds under default configuration

- **WHEN** a token is issued on a `GET` under default options and the returned cookie plus token are
  submitted on a subsequent `POST`
- **THEN** validation succeeds — the default configuration is provably usable end to end

#### Scenario: An explicit maxAge is emitted verbatim

- **WHEN** `cookie.maxAge` is `3600`
- **THEN** the `Set-Cookie` header contains `Max-Age=3600`

#### Scenario: A negative or non-integer maxAge is refused at construction

- **WHEN** `csrf()` is constructed with `cookie.maxAge` of `-1`, `NaN`, or `Infinity`
- **THEN** construction throws an actionable error naming the offending value

### Requirement: CSRF origin validation is on by default and never trusts the Host header

`@nextrush/csrf` SHALL default `originCheck` to `true`. Origin validation SHALL compare the `Origin`
header against a configured allowlist of the application's own origins and SHALL NOT compare it
against the `Host` header. `Sec-Fetch-Site` SHALL be honored only as a reject signal. A missing
`Origin` on an unsafe method SHALL fail validation.

#### Scenario: Origin is validated against configuration, not Host

- **WHEN** a `POST` arrives with `Host: evil.example` and `Origin: https://evil.example`
- **THEN** validation fails because `https://evil.example` is not in the configured allowlist

#### Scenario: A missing Origin on an unsafe method fails

- **WHEN** a `POST` arrives with no `Origin` header and `originCheck` enabled
- **THEN** validation fails

#### Scenario: Sec-Fetch-Site never grants access

- **WHEN** a `POST` arrives with `Sec-Fetch-Site: none` (or `same-origin`) and an `Origin` outside the
  allowlist
- **THEN** validation fails — `Sec-Fetch-Site` does not override the allowlist result

#### Scenario: Sec-Fetch-Site cross-site rejects early

- **WHEN** a `POST` arrives with `Sec-Fetch-Site: cross-site`
- **THEN** validation fails before any token comparison or cryptographic work

#### Scenario: Enabling originCheck without an allowlist is refused

- **WHEN** `csrf()` is constructed with `originCheck: true` and no `allowedOrigins`
- **THEN** construction throws, because the only remaining comparison basis would be the
  attacker-controlled `Host` header

### Requirement: CSRF session binding is an explicit decision

`csrf()` SHALL require either a `getSessionIdentifier` function or an explicit
`sessionBinding: 'none'` acknowledgement. Construction SHALL throw when neither is supplied, so the
weaker unbound double-submit mode is never reached by omission.

#### Scenario: Omitting both options throws

- **WHEN** `csrf({ secret })` is constructed with neither `getSessionIdentifier` nor `sessionBinding`
- **THEN** construction throws an error explaining both options and the security difference

#### Scenario: A bound token is rejected under a different session

- **WHEN** a token minted for session `A` is submitted on a request whose session identifier is `B`
- **THEN** validation fails

#### Scenario: An undefined session identifier at generation and validation is consistent

- **WHEN** `getSessionIdentifier` returns `undefined` for both the generating and validating request
- **THEN** validation succeeds, and the token is not accepted for any request where it returns a
  defined identifier

### Requirement: Constant-time comparison uses an unpredictable per-process key and no per-request key import

Any HMAC-blinded comparison SHALL derive its blinding key from a cryptographically secure random
source once per process and SHALL cache the imported key. A blinding key SHALL NOT be a compile-time
constant. Cheap structural rejection (length, character-set shape) SHALL run before any
cryptographic operation on an unauthenticated request path.

#### Scenario: The blinding key is not a literal

- **WHEN** the comparison helper's key material is inspected
- **THEN** it is generated from `crypto.getRandomValues()` at module initialization, not a hardcoded
  string

#### Scenario: A rejected request performs minimal cryptographic work

- **WHEN** a state-changing request carries a submitted token that fails the hex/length shape check
- **THEN** the request is rejected performing no `crypto.subtle` operations

#### Scenario: A valid comparison imports no new key

- **WHEN** many requests are validated in sequence
- **THEN** the blinding key is imported once, not once per request

### Requirement: The CSRF token extractor does not read the query string

The default token extractor SHALL read the CSRF token from request headers and the parsed body only.
It SHALL NOT read the query string, so tokens do not reach access logs, `Referer` headers, or browser
history. Applications needing that behavior SHALL supply an explicit `getTokenFromRequest`.

#### Scenario: A query-string token is not accepted by default

- **WHEN** a `POST` supplies the token only as `?_csrf=<token>`
- **THEN** validation fails with a missing-token reason

#### Scenario: A custom extractor may still opt in

- **WHEN** an application supplies `getTokenFromRequest` reading the query string
- **THEN** that extractor is used and the token is accepted

### Requirement: Signed artifacts bind their signature to their context

Any HMAC-signed artifact the framework issues SHALL sign a length-prefixed tuple that includes the
artifact's name and issue time, not the value alone. Verification SHALL reject a value presented under
a different name and SHALL reject an artifact past its embedded expiry when one is configured.

#### Scenario: A signed value is not portable between cookie names

- **WHEN** a value signed for cookie `tier` is presented as cookie `user`
- **THEN** verification returns undefined (rejected)

#### Scenario: An expired signed value is rejected

- **WHEN** a signed cookie carrying an embedded issue time older than the configured `maxAge` is
  presented
- **THEN** verification returns undefined

#### Scenario: A value containing the separator round-trips correctly

- **WHEN** a value containing the signature separator character is signed and verified
- **THEN** verification succeeds and returns the original value byte-for-byte

#### Scenario: Legacy value-only signatures are accepted only behind an explicit flag

- **WHEN** a cookie signed under the previous value-only format is presented and
  `acceptLegacySignatures` is enabled
- **THEN** verification succeeds; **AND WHEN** the flag is absent, verification fails

### Requirement: Cookies default to Secure outside plaintext loopback

`@nextrush/cookies` SHALL default `secure` to `'auto'`: the `Secure` attribute is emitted unless the
request is demonstrably plaintext loopback. An explicit `secure: false` SHALL remain honored.

#### Scenario: An HTTPS request receives a Secure cookie by default

- **WHEN** a cookie is set with default options on a TLS request
- **THEN** the `Set-Cookie` header includes `Secure`

#### Scenario: A proxied HTTPS request receives a Secure cookie

- **WHEN** a cookie is set on a request whose TLS termination is upstream and whose forwarded
  protocol is trusted per the proxy trust specification
- **THEN** the `Set-Cookie` header includes `Secure`

#### Scenario: Plaintext localhost development is unaffected

- **WHEN** a cookie is set on a plaintext request from a loopback address
- **THEN** the `Set-Cookie` header omits `Secure`

#### Scenario: An untrusted forwarded-protocol header does not decide the attribute

- **WHEN** a plaintext non-loopback request carries `X-Forwarded-Proto: https` and proxies are not
  trusted
- **THEN** the header is ignored and `Secure` is emitted anyway (fail closed), never omitted on the
  attacker's say-so

### Requirement: CORS intersects requested headers against an allowlist

`@nextrush/cors` SHALL ship a conservative default `allowedHeaders` set and SHALL respond to a
preflight with the intersection of the requested headers and the allowlist. It SHALL NOT echo
`Access-Control-Request-Headers` back unchanged.

#### Scenario: An unlisted requested header is not allowed

- **WHEN** a preflight requests `X-Anything` under default options
- **THEN** `Access-Control-Allow-Headers` does not contain `X-Anything`

#### Scenario: Listed headers are returned

- **WHEN** a preflight requests `Content-Type` under default options
- **THEN** `Access-Control-Allow-Headers` contains `Content-Type`

#### Scenario: Authorization is allowed only with credentials enabled

- **WHEN** a preflight requests `Authorization` with `credentials: false`
- **THEN** `Authorization` is not in the response allowlist; **AND WHEN** `credentials: true`, it is

#### Scenario: An empty intersection omits the header rather than sending an empty value

- **WHEN** every requested header is outside the allowlist
- **THEN** `Access-Control-Allow-Headers` is omitted entirely

### Requirement: Static serving can neutralize untrusted content

`@nextrush/static` SHALL provide an `untrusted` mode that forces
`Content-Disposition: attachment`, a `Content-Security-Policy: sandbox; default-src 'none'` header,
and a neutral `application/octet-stream` content type for script-capable types including
`image/svg+xml` and `text/html`.

#### Scenario: An SVG under untrusted mode cannot execute

- **WHEN** an `.svg` file is served from a root configured with `untrusted: true`
- **THEN** the response carries `Content-Type: application/octet-stream`,
  `Content-Disposition: attachment`, and the sandbox CSP

#### Scenario: An HTML file under untrusted mode cannot execute

- **WHEN** an `.html` file is served from an `untrusted` root
- **THEN** the same neutralizing headers are applied

#### Scenario: Trusted roots are unchanged

- **WHEN** a root is configured without `untrusted`
- **THEN** content types and disposition are unchanged from today, with `nosniff` still applied

#### Scenario: Untrusted mode still applies to index and extension-fallback resolution

- **WHEN** an `untrusted` root resolves a directory index or an extension fallback to an `.html` file
- **THEN** the neutralizing headers are applied to that response too

### Requirement: Static file reads are not vulnerable to a symlink swap

`@nextrush/static` SHALL open a file handle and stat that handle, streaming from the same descriptor,
so the file inspected and the file sent are the same inode.

#### Scenario: A symlink swapped between stat and read is not followed

- **WHEN** a served path is replaced by a symlink pointing outside the root between the safety check
  and the read
- **THEN** the response is a 404 (or the configured miss behavior), never the linked file's content

#### Scenario: A file deleted mid-read terminates cleanly

- **WHEN** a file is unlinked while its response is streaming
- **THEN** the stream ends without an unhandled rejection and without leaking a descriptor

#### Scenario: Descriptors are released on client disconnect

- **WHEN** a client disconnects mid-stream
- **THEN** the open descriptor is closed

### Requirement: Stack traces are never emitted in production

Error serialization SHALL ignore a truthy `includeStack` configuration when the application is in
production, warning once that the setting was overridden.

#### Scenario: includeStack is overridden in production

- **WHEN** `errorHandler({ includeStack: true })` handles an error and the application is in
  production
- **THEN** the response body contains no `stack` key and a single warning is logged

#### Scenario: Development behavior is preserved

- **WHEN** the same handler runs outside production
- **THEN** the `stack` key is present as configured

#### Scenario: A non-HttpError still never exposes its message in production

- **WHEN** a plain `Error` with an internal message propagates in production
- **THEN** the response body carries a generic status message and no internal detail

### Requirement: Path-based security exemptions match canonical paths with exact wildcard depth

Any path-based exemption or allowlist in a security middleware SHALL match against the canonical
request path defined by the `router` capability. A `/*` suffix SHALL match exactly one remaining
segment; a `/**` suffix SHALL match any depth.

#### Scenario: Single-star matches one segment only

- **WHEN** an exemption pattern `/api/webhooks/*` is tested against `/api/webhooks/stripe`
- **THEN** it matches; **AND WHEN** tested against `/api/webhooks/stripe/deep`, it does not match

#### Scenario: Double-star matches any depth

- **WHEN** `/api/webhooks/**` is tested against `/api/webhooks/a/b/c`
- **THEN** it matches

#### Scenario: A non-canonical path cannot reach an exemption

- **WHEN** a request target that would canonicalize differently (dot segments, mixed case, repeated
  slashes) is tested against an exemption
- **THEN** matching uses the canonical path, so no encoded or cased variant widens the exemption

#### Scenario: A prefix that is not a segment boundary does not match

- **WHEN** `/api/web/*` is tested against `/api/webhooks/x`
- **THEN** it does not match

### Requirement: Rate limiting derives its key from the trusted client IP

`@nextrush/rate-limit` SHALL derive its default key from the framework-resolved client IP governed by
the proxy trust specification. It SHALL NOT read proxy headers directly and SHALL NOT accept a
client-supplied header in preference to the trusted resolution.

#### Scenario: A rotating forwarded header does not mint new keys

- **WHEN** requests arrive with a varying `X-Forwarded-For` value from the same untrusted peer
- **THEN** every request maps to the same rate-limit key

#### Scenario: Alternative vendor headers are not consulted

- **WHEN** a request supplies `cf-connecting-ip`, `x-real-ip`, `true-client-ip`, or
  `x-cluster-client-ip` and the peer is not trusted for that header
- **THEN** none of them influences the rate-limit key

#### Scenario: Allow and deny lists use the trusted value

- **WHEN** a request forges a whitelisted IP in a proxy header from an untrusted peer
- **THEN** the whitelist does not match and the limiter applies normally

### Requirement: Production configuration is audited at boot

The framework SHALL run a security audit when the application boots in production and SHALL refuse or
loudly warn on configuration that is known-unsafe: legacy boolean proxy trust, `includeStack: true`,
`cors({ origin: true, credentials: true })`, static `dotfiles: 'allow'`, and cookies configured with
`secure: false`.

#### Scenario: Legacy boolean proxy trust refuses to boot

- **WHEN** an application boots in production with `proxy: true`
- **THEN** boot throws an actionable error naming the hop-count and trusted-peer replacements

#### Scenario: Reflected origin with credentials is refused

- **WHEN** an application boots in production with `cors({ origin: true, credentials: true })`
- **THEN** boot throws

#### Scenario: A warned-but-permitted setting boots with a single warning

- **WHEN** an application boots in production with static `dotfiles: 'allow'`
- **THEN** boot succeeds and logs exactly one warning naming the setting and its risk

#### Scenario: Development boot is unaffected

- **WHEN** the same configuration boots outside production
- **THEN** no error is thrown and warnings are advisory

### Requirement: A composite security preset exists

The framework SHALL expose a single `security()` composition applying helmet, strict cookie defaults,
CSRF, and rate limiting with production-safe defaults, so the secure configuration is the shortest
path.

#### Scenario: The preset applies every layer

- **WHEN** `app.use(security({ csrf: { secret, getSessionIdentifier } }))` is applied and a request
  is served
- **THEN** the response carries the helmet header set, and a state-changing request without a CSRF
  token is rejected

#### Scenario: The preset refuses incomplete required configuration

- **WHEN** `security()` is called without the configuration its CSRF layer requires
- **THEN** it throws at construction, not at first request

#### Scenario: Individual layers remain independently configurable

- **WHEN** the preset is given per-layer overrides
- **THEN** those overrides are applied and no layer is silently dropped

### Requirement: Security-relevant parsers are fuzz-hardened

`parseCookies`, `parseUrlEncoded` / `setNestedValue`, `parseRange`, and `extractBoundary` SHALL be
covered by property-based tests asserting that for any input they never throw an unhandled error,
never write to `Object.prototype`, never produce a path outside the configured root, and always
terminate within bounded time and allocation.

#### Scenario: No input escapes the prototype guard

- **WHEN** the property suite generates arbitrary parameter keys including prototype-related names in
  arbitrary bracket nestings
- **THEN** `Object.prototype` is unmodified after every run

#### Scenario: No input causes an unhandled throw

- **WHEN** the property suite feeds arbitrary byte strings to each parser
- **THEN** each returns a value or a typed framework error, never an unhandled exception

#### Scenario: No input causes unbounded work

- **WHEN** the property suite feeds pathological inputs (deep nesting, maximum repetition, very long
  single tokens)
- **THEN** each parser terminates within its documented limits

### Requirement: Malformed HTTP requests are covered by a raw-socket suite

The framework SHALL ship a raw-socket test suite exercising protocol-level malformed requests against
the Node adapter, establishing the baseline evidence for request-smuggling and desynchronization
review.

#### Scenario: Conflicting length framing is rejected

- **WHEN** a request carries both `Content-Length` and `Transfer-Encoding: chunked`
- **THEN** the connection is rejected or closed without dispatching a handler, and the observed
  behavior is asserted rather than assumed

#### Scenario: Duplicate Content-Length is rejected

- **WHEN** a request carries two differing `Content-Length` headers
- **THEN** the request is rejected

#### Scenario: Missing or duplicated Host is handled deterministically

- **WHEN** an HTTP/1.1 request arrives with no `Host` header, or with two `Host` headers
- **THEN** the response is a deterministic 400 and the behavior is pinned by assertion

#### Scenario: Slow header and body transmission times out

- **WHEN** a client sends headers or body one byte at a time beyond the configured timeout
- **THEN** the connection is closed by the server within a bounded time

#### Scenario: An oversized header block is rejected

- **WHEN** a request sends a header block exceeding the configured maximum
- **THEN** the server responds 431 or closes the connection without dispatching
