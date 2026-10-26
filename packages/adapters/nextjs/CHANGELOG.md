# @nextrush/adapter-nextjs

## 1.1.0

### Minor Changes

- [#63](https://github.com/0xTanzim/nextRush/pull/63) [`6004c48`](https://github.com/0xTanzim/nextRush/commit/6004c482727f50cd760d4ab55d3c6b7f033e018b) Thanks [@0xTanzim](https://github.com/0xTanzim)! - A JSON response's `Content-Type` is now `application/json`, with no `charset` parameter.

  **What changes.** Every framework-generated JSON response — a handler's `ctx.json()`, an object
  passed to `ctx.send()`, and the framework's own `404`/`500`/`504` envelope — carries
  `content-type: application/json` on every adapter. It previously carried
  `application/json; charset=utf-8`.

  ```ts
  // Before
  expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
  // After
  expect(res.headers.get('content-type')).toBe('application/json');
  ```

  **Why.** RFC 8259 §8.1 registers `application/json` with no parameters — JSON is UTF-8 by
  definition, so a `charset` parameter is one the specification does not define. Hono 4.13.0 and
  Express 5.2.1 already send the bare value; only Fastify sends the parameterised form. The earlier
  conformance rule that pinned the parameterised value existed to stop adapters drifting apart — Edge
  and Bun's server-level error path emitted a bare `application/json` while the shared helper emitted
  the parameterised form. Every adapter now goes through the one shared helper that emits the bare
  value, so the uniformity is preserved and the drift is gone.

  **Migration.** Applications that only _parse_ the media type are unaffected: JSON parsing keys off
  the `application/json` type, and the `charset` parameter was never required for it. Only an
  exact-string comparison needs updating. The value is now identical on every adapter, so one
  assertion update covers all of them.

  **What does not change.** The status, the body bytes, `Content-Length`, the header set, the
  multi-value `Set-Cookie` behaviour, `text/plain` and `text/html`, and every other response
  behaviour. Request parsing, routing, middleware ordering, `ctx.next()`, body limits, raw-body bytes,
  UTF-8 correctness, caching, streaming, and error status mapping are all untouched.

  **Why this is a minor release.** No exported API, status, body, or request behavior changes, and
  JSON parsing keys off the media type rather than the exact header string. The one observable
  difference is the `Content-Type` value: an application that compares it to the old parameterised
  string exactly must update that assertion as shown above. The maintainer classified that
  wire-visible difference as a minor change for this release line; it is documented here rather
  than left implicit.

  **Performance.** The change removes a per-request `Headers` allocation from every Web response,
  and the bare media type lets Deno's `Response` constructor take its static fast path — together
  **−16.6 % server CPU per request on Deno GET** and −8.1 % on Deno POST, measured against the
  previous release, with no regression on Bun or Node.

  **The request deadline no longer costs a timer per request.** A request that waits on I/O — a body
  read, a database call — is still pending when the timeout window opens, so the framework armed a
  `setTimeout` for it and cleared it when the request settled. That pair costs 2.15 µs on Deno
  against 0.16 µs on Bun, and it measured **8.28 µs of server CPU per request on Deno POST (+29.8 %)**.
  The deadline is now served by one shared timer per runner: the deadline value, the `504`, the
  `ctx.signal` cancellation, and the late-rejection guard are unchanged, and the measured effect is
  **−13.8 % on Deno POST and −10.4 % on Bun POST**, with no change on the GET fast path.

- [#63](https://github.com/0xTanzim/nextRush/pull/63) [`81211bc`](https://github.com/0xTanzim/nextRush/commit/81211bc61e68fe437cbcd57e313c4e22a0f9d780) Thanks [@0xTanzim](https://github.com/0xTanzim)! - **The framework's default text media type is now written `text/plain;charset=UTF-8`** — no space
  after the separator, upper-case charset value — instead of `text/plain; charset=utf-8`.

  **What changes.** Exactly one header value, on the responses the framework types for you: `ctx.send()`
  with a string or primitive, and the `text/plain` body `ctx.redirect()` sends by default. It is the
  same value on every adapter, including Node's native response path, so cross-adapter output stays
  byte-identical to itself.

  **Why.** Deno's `Response` constructor has a static fast path for a small set of exact literals.
  `text/plain;charset=UTF-8` is one of them; the conventional `text/plain; charset=utf-8` spelling is
  not, and pays for header-list validation plus a native re-map on every response. Priced in isolation
  on Deno 2.9.7, constructing the response costs **612 ns with the old spelling and 197 ns with this
  one**. `application/json` is corrected in the pending JSON media-type changeset for the same reason;
  `text/plain` was the remaining common media type outside the fast path.

  **Migration.** Applications that _parse_ the media type are unaffected. RFC 9110 §5.6.1 makes the
  whitespace around `;` insignificant, and the charset value was already case-insensitive, so this is
  the same media type — not a new one. Only an **exact-string** comparison needs updating:

  ```diff
  - expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
  + expect(res.headers.get('content-type')).toBe('text/plain;charset=UTF-8');
  ```

  One assertion update covers every adapter, because they all emit the same value.

  **What does not change.** The status, the body bytes, `Content-Length`, the header set and ordering,
  multi-value `Set-Cookie`, `application/json`, `text/html`, the redirect status and `Location`, and
  `ctx.stream()`/SSE/NDJSON defaults (the stream package sets its own media types and is untouched).
  Request parsing, routing, middleware ordering, `ctx.next()`, body limits, raw-body bytes, UTF-8
  handling, response commitment, caching, streaming, timeouts, and error mapping are all untouched.
  `text/html` keeps the conventional spelling deliberately: it has no fast path to enter (measured 622
  vs 602 ns on Deno — noise), so changing it would be wire churn with nothing behind it.

  **Why the bump is minor, not major.** Semantically the two spellings are the same media type, so no
  client that parses `Content-Type` can observe a difference. The bump signals a wire-visible byte
  change in case a consumer asserts the exact string — the same class of change as the pending
  `application/json` one, which is also classified as a minor: it removes a parameter, but no client
  that parses the media type can observe that, and only an exact-string assertion needs updating.

  **Measured.** Deno text workload, paired A/B on server CPU per request: median **−2.3 %** over 7
  pairs (mean −4.3 %, 5/7 pairs faster), consistent with the −415 ns at the `Response` boundary.
  Bun neutral (median +0.1 %, 2/4) and Node neutral (+0.8 %, 1/2) — neither has a matching fast path,
  and neither is expected to move. Full numbers, harness, and the rejected alternatives are in
  `report/performance/campaign-scoreboard.md` §9.

### Patch Changes

- Updated dependencies [[`23e927a`](https://github.com/0xTanzim/nextRush/commit/23e927ae3d41b655da6e6862272356df7a2d481f), [`57d4713`](https://github.com/0xTanzim/nextRush/commit/57d4713e607d071112db9250c9e6e7984214fc15), [`9e6de5f`](https://github.com/0xTanzim/nextRush/commit/9e6de5f81b93401198138d11f6c2eaf5948502ad), [`6004c48`](https://github.com/0xTanzim/nextRush/commit/6004c482727f50cd760d4ab55d3c6b7f033e018b), [`fbb8b93`](https://github.com/0xTanzim/nextRush/commit/fbb8b93fed819bea9ae6bcb3907b54f7b84fa8ee), [`2d0f0c1`](https://github.com/0xTanzim/nextRush/commit/2d0f0c185165d50960e2c66b4a9c714d1463381b), [`4bdf830`](https://github.com/0xTanzim/nextRush/commit/4bdf8303cbeed3bf4351d035935c44d5110f8738), [`d21a453`](https://github.com/0xTanzim/nextRush/commit/d21a4534d4e352617ad2e9e3ff06907926342c9e), [`836dd6a`](https://github.com/0xTanzim/nextRush/commit/836dd6a55312f20f2a9dbaef480f4e962e37b941), [`a701579`](https://github.com/0xTanzim/nextRush/commit/a701579e7ac52bfeab8a5d8c539e07b40661e885), [`81211bc`](https://github.com/0xTanzim/nextRush/commit/81211bc61e68fe437cbcd57e313c4e22a0f9d780)]:
  - @nextrush/core@4.1.0
  - @nextrush/adapter-edge@1.1.0
  - @nextrush/types@4.1.0

## 1.0.1

### Patch Changes

- [`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Prepare the NextRush v4 ecosystem patch release with updates across core, routing, adapters, middleware, utilities, OpenAPI, testing, development tooling, and the create-nextrush scaffolder.

- Updated dependencies [[`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8)]:
  - @nextrush/adapter-edge@1.0.1
  - @nextrush/types@4.0.2
  - @nextrush/core@4.0.2

## 1.0.0

### Patch Changes

- [`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Consolidated patch release across all NextRush public packages.

- Updated dependencies [[`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9)]:
  - @nextrush/adapter-edge@1.0.0
  - @nextrush/core@4.0.0
  - @nextrush/types@4.0.0

## 1.0.0-beta.1

### Patch Changes

- Consolidated patch release across all NextRush public packages.

- Updated dependencies []:
  - @nextrush/adapter-edge@1.0.0-beta.2
  - @nextrush/core@4.0.0-beta.2
  - @nextrush/types@4.0.0-beta.2
