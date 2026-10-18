# Design

## Context

See `proposal.md` — Why. What shapes the approach:

- **Two response models behind one `Context`.** The Node adapter commits inside `ctx.json()`
  (`res.writeHead` + `res.end`), while the Web adapters record `_status/_headers/_body` on a
  `WebResponseBuilder` and materialise a `Response` after the whole middleware chain. Post-handler
  middleware therefore works on one family and not the other, and there is no supported way for a
  post-handler middleware to read the outgoing response at all — `ctx.body` is the parsed *request*
  body.
- **One canonical path is used for two jobs.** `canonicalizePath()` folds case for matching, and the
  dispatch path hands that same folded string to the matcher, so value extraction also sees folded
  text. The router's own unit tests exercise the public `match()` (which normalizes independently) and
  never the dispatch path, which is why the regression is invisible to them.
- **The conformance suite cannot see platform behaviour.** It builds `Request` objects in-process, so a
  platform that normalizes the request target before the application observes it is invisible to it —
  which is exactly the dot-segment gap.
- **Four copies of the Web request path.** Bun, Deno and Edge each carry their own boot/timeout/
  finalization logic (Edge's is the only one that boots lazily). A fix landed once is missed three
  times; the Node-only timeout fast path already demonstrates this.
- **No committed request-cost gate.** A `dev-check` toolkit with deterministic bundle/cold/in-process/
  probe/profile stages and committed budgets exists but is not yet wired into CI, so nothing turns red
  when the Web request path costs roughly twice the baseline framework's overhead.
- Constraints: zero-dependency core, Web-standard request path, no `new Function`/`eval`, package
  hierarchy (lower never imports from higher), 300-line source ceiling, per-package line coverage ≥ 90%.
- **Governance constraint.** These contract changes fall under the project's RFC gating.
  `docs/RFC/request-data/029-canonical-request-path.md` (Approved) already governs the canonical path
  and the dot-segment rules, and `docs/RFC/runtime-adapters/030-typed-proxy-trust.md` (Approved)
  governs the client-IP trust chain — so the correctness groups restore already-approved behaviour
  rather than proposing new architecture. The Web request-path footprint group is covered by
  `docs/RFC/runtime-adapters/039-precompile-per-request-tax.md` and
  `docs/RFC/runtime-adapters/040-resource-budgets-and-request-path-footprint.md`, both currently
  `Draft`: that group's durable decision must be recorded as approved in `docs/RFC/` before its
  implementation starts. The deferred recorded-response model has no RFC; one must be written before
  that work is picked up.

## Goals / Non-Goals

**Goals:**

- Every defect in `proposal.md` is fixed **and** gains the verification that would have caught it:
  a dispatch-level test, a real-adapter or real-socket scenario, or a committed budget.
- Adapter behaviour stays identical where it is already identical, and where it is not (the response
  commit model, platform target normalisation) the divergence is explicit, capability-reported and
  documented rather than implicit.
- The Web request path gets cheaper without changing observable behaviour, proven by allocation
  evidence and a noise-cancelling ratio measured in a single run.

**Non-Goals:**

- **The recorded-response model** (unify Node and the Web adapters on one response record, make
  `compression`/ETag/response-validation/`defer` work everywhere). It is a core contract change with
  its own measured basis and its own durable decision to record in `docs/RFC/`. This change fixes the
  *honesty* of the current model and pins the missing parity scenario; it does not adopt the record.
- **Registration-time / build-time work.** Compilation, AOT route manifests and the like stay deferred;
  the committed budgets exist to decide that later on evidence.
- **Changing the defaults that would break users**: route case-sensitivity stays `false`, the
  unknown-content-type policy stays permissive, the handler timeout interval and 504 body are
  untouched.
- **Decoding `%2f`/`%5c`**, and resolving dot segments instead of rejecting them.

## Decisions

**D1 — Match on the folded path; extract values from a case-preserved sibling string.**
`canonicalizePath()` returns both `path` (folded, used for matching and for `ctx.path`) and `valuePath`
(same structure, original case) and dispatch forwards both to the matcher, so no caller re-derives
either. Rejected: (a) making routing case-sensitive by default — that is a deliberate major-release
flip deferred by `docs/RFC/request-data/029-canonical-request-path.md` §15, and it would break every
existing route table; (b) re-folding inside the matcher — re-runs normalization per request and breaks
the "canonical path produced once" guarantee; (c) publishing the case-preserved string as `ctx.path` —
a path-prefix guard would then compare against a string the matcher never matched. When no fold
happened the two are the same string, so the all-lowercase hot path allocates nothing extra.

**D2 — Serialize before committing, via one shared helper in `@nextrush/runtime`.**
`JSON.stringify` runs first; the `responded` flag is set only once a serialized string exists, and a
non-serializable value throws a `TypeError` that reaches the application error handler. The helper
lives in `@nextrush/runtime` (below the adapters) so Node and the Web builder cannot drift. Rejected:
(a) swallowing the throw inside `ctx.json()` — hides an application bug and removes the chance to
answer; (b) catching and writing a 500 inline in each adapter — bypasses the application's error
handler and repeats per adapter; (c) making `ctx.json()` async or returning a promise — public API
churn for no benefit.

**D3 — A never-unanswered safety net at three layers, deliberately redundant.**
`Application.handleError` forces a minimal 500 when the error path left `ctx.responded` false;
adapter finalizers do the same; the Web builder does the same. Redundant on purpose: the Node
`finalizeError` 500 path is currently unreachable because `app.callback()` resolves after swallowing
handler errors, so the finalizer alone would not have caught this class. Each layer is a single cheap
branch and logs when it fires.

**D4 — One boot gate in `@nextrush/runtime`; `serve()` stays eager; `callback()` gains a guard.**
The gate memoizes `bootPromise ??= app.ready().then(…)`, returns the handler, and the per-request path
keeps a local `let ready` so steady-state requests add no promise hop. Edge's existing inline logic is
replaced by the shared helper so Bun and Deno inherit it instead of copying it. `serve()` keeps its
eager `await app.ready()` so boot failures surface at startup. `callback()` throws an actionable error
when invoked before boot while the application owns an unmounted router — silence is what made this a
trap. Rejected: mounting the router in the `Application` constructor (violates "router runs last, after
all middleware"), and documenting `ready()` instead of fixing the entry point (leaves the documented
happy path broken).

**D5 — Reject dot segments where they are observable; report and document where they are not.**
A raw-target path helper derives the path by scanning the target string (no `URL`), the dot-segment
check treats every `%2e`/`%2E` spelling as a dot, and a negotiated `rawRequestTarget` capability states
whether the runtime preserves the target. Conformance asserts a capability-derived expectation instead
of promising uniform rejection, and the security guide states that a proxy ACL must normalise
identically or the app must enforce after normalisation. Rejected: resolving locally "to be helpful"
(recreates the proxy/application path desync `docs/RFC/request-data/029-canonical-request-path.md`
exists to prevent); claiming uniform parity (false, and it is what made the promise untestable);
extending to `%2f`/`%5c` (a separate decision, tracked but not taken here).

**D6 — One error-code contract, shared with the existing error middleware.**
The default handler takes a string `code` from the error when the status is below 500, otherwise
derives the status's code; 5xx keeps the framework's internal code and a masked message, byte-identical
to today, so no internal failure's code reaches a client. Rejected: a new standalone mapping table
(creates a second contract), and changing 5xx bodies (an unnecessary break).

**D7 — Engine parse text becomes a non-enumerable `cause`.**
The response-visible message is a framework constant, so responses are byte-identical across JS
engines; the engine's text stays available for server-side logging. Rejected: keeping the engine text
(an internals leak plus a parity break), and discarding it entirely (loses diagnosis).

**D8 — The unknown-content-type policy defaults to today's behaviour.**
`onUnsupportedContentType: 'ignore' | 'reject'`, default `'ignore'`, with `'reject'` documented and
recommended for JSON APIs; flipping the default is listed as a next-major change. Rejected: flipping
the default now — it would reject requests that currently succeed inside a bug-fix change.

**D9 — Define the outgoing-response view requirement now; do not adopt the record model.**
The deferred model is the only thing that makes `compression`, ETag, response validation and
`defer` work on both families, but it is a core `Context` contract change. Rather than half-ship it,
this change requires the honest interim behaviour: `ctx.body` is never read as the outgoing response,
response middleware never transforms the request body, and an unavailable outgoing body is warned
about once and documented. Rejected: (a) monkey-patching `res.write`/`res.end` (Express-style) — breaks
the lazy/streaming guarantees and the Web parity this change is trying to protect; (b) the sync
`onSend` hook — cannot support asynchronous compression, so it cannot be the end state;
(c) adopting "the handler returns a `Response`" — a larger public API change that belongs to the
deferred model's own decision.

**D10 — Laziness with declared slots, and hot single lookups bypass the record.**
Incoming headers and the client IP each get a declared field plus a memoized getter; `ctx.get(name)`
reads the platform headers directly and never materialises the record; the IP thunk is resolved inside
the getter. Declared slots keep the context's hidden class stable, which is the whole point of
the context's fixed property layout. Rejected: getter-backed closure state
(hidden-class churn per request), and a `Proxy`-backed header view (allocation and deopt for no gain).

**D11 — One shared Web runner replaces three copies.**
Boot, timeout arming, context construction and finalization move behind one runner in
`@nextrush/runtime`, with each adapter supplying only its platform bindings. The timeout is armed only
when the handler has not already settled, matching Node's existing fast path, and the observable
timeout contract is unchanged. Rejected: patching each adapter in place — the drift this change exists
to remove.

**D12 — Lazy query parsing is measurement-gated, not assumed.**
Query parsing is the least-attributed remaining cost and it sits on a documented read-only contract, so
its requirement is conditional: it is adopted only if the committed gate shows no regression.

**D13 — The cost gate is a same-run ratio with expiring exemptions.**
Ratios (framework / baseline measured in the same process and machine conditions) are committed with a
hard maximum and a tighter target; absolute microsecond budgets are rejected because they do not
survive a machine change. Every known-failure id must cover a real probe, and the pull request that
fixes a probe deletes its id in the same change, so a fix becomes a permanent guard instead of a
permanent exemption.

**D14 — Target-dependent behaviour is proven over a real socket.**
A scenario whose outcome depends on what the platform does before the application observes the request
cannot be satisfied in-process. Such scenarios drive a real listener on the adapters whose runtimes are
available locally, and the reported proof level distinguishes real-runtime from simulated so a green
in-process result is never presented as proof of platform behaviour.

**D15 — The proof level is a declared property with a refusal path, not a convention.**
Every driver declares how it reaches the adapter (`transport`) and which runtime it executes on
(`runtimeFidelity`); every scenario goes through a ledger and declares what it needs. A scenario whose
requirement the driver cannot meet is recorded as *not satisfied at real-runtime level* and is **not
registered as a test**, because a scenario that silently weakens itself is worse than one that is
absent: it reports a pass for something that was never observed. The ledger also renders a
proof-level report, so a run states which assertions were proven over a socket, which on the real
runtime in-process, and which were refused.
Rejected: marking scenarios with a comment, or a `skip` — neither can be asserted on, so neither stops
the weakest driver's result from being read as the strongest.

**D16 — Real-runtime parity is a CI gate, and the per-runner primitives swap is a declared export
condition.**
Both real-runtime runners had been unloadable since they were written — one required a build-time
substitution through a wiring file that does not exist, the other resolved a workspace package through
a bare specifier no import map declared — so "the same suite runs on real Bun and real Deno" was an
assumption, not a fact. The swap is now declared where the runtime can see it (a `bun` export
condition on the package's `test-primitives` subpath, alongside Deno's existing import map), and a
`runtime-parity` CI job runs the Bun, Deno and workerd runners after the build. Parity that is only
runnable by hand is parity that is not checked; a runner that cannot load is indistinguishable from a
runner that passes.

**D17 — The client-visible code has exactly one derivation, and both error surfaces call it.**
`@nextrush/core`'s default error response and `@nextrush/errors`' `errorHandler()` each built a code
their own way, so the same error could be described differently depending on which surface answered
it, and neither reflected a client error's own code. The derivation is extracted
(`resolveErrorCode(error, status)`): a non-empty string `code` wins below 500, otherwise the status's
canonical code from the frozen registry. Above 500 the code is `'INTERNAL_ERROR'` **whatever the
error carries**, which is what makes "no 5xx body changes" a property of the implementation rather
than a promise. Rejected: duplicating the rule in both places with a test asserting they agree — a
test can only pin the cases someone thought to write, and the drift this change removes was exactly
one surface being updated and the other not.
The middleware also adopts `getErrorStatus()` for a plain error, so the two surfaces agree on the
*status* as well as on the code; without that, a plain 400 was reported as a 500 by the middleware
and as a 400 by core — two answers to one error.

**D18 — A failure message is a framework constant; the engine's own text is a non-enumerable cause.**
The parser messages embedded the JS engine's parse text, a decoder's error, or a socket's read error.
Those strings are runtime-specific: the same bytes produce a different body on Node, Bun and Deno, so
the response was a function of the runtime rather than of the request — and the text was a channel for
internals. The message becomes a constant and the raw text moves to `Error`'s own `cause` slot, which
is non-enumerable by specification, so it cannot reach `JSON.stringify(error)`, `toJSON()`, or any
response built from either, while remaining available to server-side logging. Rejected: deleting the
detail entirely (it is the only thing that makes a parse failure diagnosable), and keeping it in the
message behind a "development" flag (that makes the response depend on configuration as well as on
the runtime, and error bodies are not the place for environment-conditional shapes).

**D19 — The unparsed-content-type policy is explicit, and its default is the old behaviour.**
`multipart/*` has always rejected with `415` while every other unmatched `Content-Type` continued with
`ctx.body === undefined` — an inconsistency that reads as an accident and hides a real client bug
behind whatever validation says next. Rather than picking one behaviour for every caller, the choice
becomes an option: `'ignore'` (the default, byte-identical to today) or `'reject'` (`415` before any
handler runs, naming the content type). The default is deliberately the value we would not choose for
a new API, because changing it would silently convert accepted requests into errors with no version
to carry it — so the safe value is documented, recommended, and scheduled for the next major, and
the request entry our own measurement uses opts in immediately. Rejected: defaulting to `'reject'` in
a minor.

**D20 — A dot segment is rejected by structure, in any spelling, inside the scan that already runs.**
`canonicalizePath()` already walked the path, so the encoded spellings were a gap in that walk rather
than a missing feature. The same single pass now treats a segment as a dot segment when its first
character is `.` or `%` and its decoded form is `.` or `..`, decoding only `%2e`/`%2E` — so
`/files/%2e%2e/admin` is rejected while `..hidden`, `archive.tar.gz` and `%252e%252e` still route. A
segment longer than a fixed short bound cannot be a dot segment in any spelling, which is what keeps
the scan linear and stops a decoy of repeated `%2e` encodings from turning a rejection into work.
Rejected: decoding the segment generally and comparing it against `..` (that is the general-purpose
parser this project has decided not to write, and it would have to decode `%2f`/`%5c` into separators,
which no parser in the chain does); rejecting any path that contains a dot (breaks filenames); and a
regex over the whole path (a second pass whose failure mode is exactly this class of gap).

**D21 — The published path is the platform's bytes; whatever the platform reshaped is a reported
capability, not an assumption.** Deriving `path`/`search` with two `indexOf` scans replaces `new URL()`
on the hot path — and `new URL()` was not merely slow, it was *wrong* here: it resolves dot segments
and percent-encodes bytes, so a target was published in a form the client never sent and then matched
against. Measured on a raw socket before the fix: on Deno, `/files/../admin` was published as
`/admin` and dispatched to a route the client never named, while Node rejected the same target with
`400` — one request, two answers. Two consequences are deliberate. A target whose bytes `URL.pathname`
would percent-encode (non-ASCII, space, `"`, `<`, `` ` ``, `{`, `}`) is published **as delivered**;
re-encoding was rejected after the conformance oracle caught the divergence, because it is the same
reshaping that made resolution wrong, and hand-rolling the WHATWG encode sets (surrogates included)
would add a second encoder to get it wrong. And whether the segment survives to the application at all
is owned by the platform: `rawRequestTarget` reports whether the runtime hands the target over
un-reshaped — `true` on Node and Deno, `false` on `Bun.serve`, the edge isolates and the serverless
event mapping (each measured over a raw socket, the workerd arm from the workerd runner's own
listener), and `false` wherever it cannot be proven, `deno-deploy` and an unrecognised runtime
included. The flag is informational: nothing in the request path branches on it, which is what keeps
the runtime-identity lint green, and it is read by the conformance suite to derive its expectation and
by the security guide to state the limit. The scenario that exercises it is socket-required, so a
driver that cannot write a raw request line is refused with a reason instead of asserting the weak
branch — the guarantee is claimed only where the real runtime proves it.

## Risks / Trade-offs

- **[Case-correct parameters change observable output for anyone who relied on folded values]** →
  Treated as a behavioural fix: one CHANGELOG line plus a migration note stating that a consumer
  needing folded values must fold them itself. `ctx.path` semantics are unchanged.
- **[Rejecting encoded dot segments changes requests that used to match]** → Documented as a security
  fix with the proxy-normalisation guidance; the capability makes the remaining platform limit explicit
  instead of silently absent.
- **[`ctx.json()` can now throw where it previously hung or returned empty]** → The throw is the
  intended contract; the never-unanswered net guarantees the client is still answered, and the log
  line makes the cause visible.
- **[Laziness can move cost rather than remove it, and can deopt if implemented carelessly]** →
  Declared slots with `??=` memoization; every step is accepted only on an allocation reduction plus a
  non-regressing same-run ratio, measured in isolation.
- **[The shared runner adds an `await` on the hot path]** → A local handler snapshot keeps steady-state
  requests free of an extra hop; the cost gate fails the change if the hop is measurable.
- **[The boot gate changes when an application boots]** → Only for entry points that previously
  dispatched against an incomplete stack; `serve()` semantics are unchanged and the first request
  absorbs a microtask-level boot.
- **[Three redundant never-unanswered layers could mask a genuine missing-response bug]** → Each layer
  logs when it fires, and each is reachable by its own test, so the last resort is observable rather
  than silent.
- **[A same-run ratio can still be noisy on a shared machine]** → Ratios, not absolute times; two runs
  before a conclusion; a load-generating baseline is measured in the same conditions, so machine speed
  cancels.
- **[Compression remains a no-op for handler-written responses in this change]** → Explicitly interim:
  one warning, a README statement of the limitation, and the structural fix left to the deferred model.
  The alternative — shipping half the model — was rejected.
- **[A 4xx body can now carry a code the frozen registry does not contain]** → That is the point: the
  error's own code is what a client branches on (`INVALID_JSON` versus `UNSUPPORTED_CONTENT_TYPE`),
  and the registry is the *fallback*, not a whitelist. A 5xx is still frozen to `'INTERNAL_ERROR'`, so
  nothing internal becomes describable; the cost is that the client-visible code set is no longer
  closed, which is documented in the package README and the errors reference.
- **[A message constant removes text a caller may have matched on]** → `error.code` and `error.cause`
  carry the same information with a stable contract; the change is called out in the body-parser
  compatibility table and the changeset rather than left for a silent failure.
- **[Nine capabilities change at once]** → The work is split into independently revertible groups
  ordered by dependency, each landing its own tests, docs and CHANGELOG entry, so a rollback is a
  group revert and not a whole-change revert.
- **[The footprint group's governing RFC is still `Draft`, so the group cannot start]** → It is
  sequenced last and gated by an explicit task that records the durable decision in `docs/RFC/` first;
  the correctness and response-honesty groups are independently shippable if that promotion is
  deferred.
- **[A refused scenario registers no test, so a driver that should be able to satisfy it would go
  quiet rather than red]** → The ledger report is printed by every real-runtime runner, a test asserts
  that exactly the socket driver satisfies the socket-required scenario, and the parity job runs the
  socket suites in CI, so a lost socket driver fails a check instead of quietly dropping coverage.

## Migration Plan

Groups are ordered so each one's verification exists before the fixes it guards: the gate and the
conformance additions land first, then the correctness fixes, then the response-read honesty, then the
footprint work. Each group is independently revertible; there is no data migration and no persisted
state. User-visible behaviour changes are listed in the project CHANGELOG with a one-line migration
note each, and the adapter/security docs are updated in the group that changes them.

## Open Questions

- **Is the committed ratio's goal the agreed target or parity with the baseline framework?** The
  footprint group ratchets the committed target to whatever the measurement supports; whether parity
  itself is required is a decision for the maintainer and does not change this design's approach or
  task breakdown.

## Findings recorded during implementation (not fixed by this change)

Each of these was found while implementing a group and is out of that group's scope. They are
recorded so they are not lost, and a group that already extracts code where they live (group 5 for
the Web adapters) should close them in passing.

| Where | Finding | Suggested action |
| --- | --- | --- |
| `packages/core/src/application.ts` (874 lines) | Over the 300-line source ceiling: lifecycle, routing, middleware composition, extensions, and teardown in one module | Split by concern (lifecycle / routing / extensions) in its own change; the file's sections are already separable |
| `packages/adapters/node/src/{context,adapter}.ts` (746 / 677 lines) | Over the ceiling: context members plus handler finalization and server bootstrap in one module each | Extract response methods and finalization from the handler/bootstrap code |
| `packages/adapters/{bun,deno,edge}/src/adapter.ts` (~558 and below) | Over the ceiling, and their request runners are near-duplicates of each other | Group 5's shared Web runner removes the duplication; the size follows from it |
| `packages/adapters/node/src/__tests__/*.test.ts` | Six independent copies of `createMockRes` / `createMockRequest` | A new test file uses `_shared/mock-response.ts`; migrate the six existing copies to it |
| `packages/adapters/{bun,deno,edge}/src/adapter.ts` | A duplicate `!ctx.responded && ctx.status === 404` finalize branch each; the Web builder's last-resort answer now produces the same body | Delete the three branches when group 5 unifies the runners |
| `packages/stream/src/run.ts` | A `sendStream()` refusal or throw leaves the detached `run(writer)` started inside `new ReadableStream({ start })` writing into a stream nobody consumes | Cancel the writer/controller when the stream is not adopted |
| `docs/**` (5 files) | Dangling `reports/investigations/...` references to a path deleted by the pre-existing report restructure | Repoint at the new report location or the relevant RFC |
| `packages/adapters/serverless/src/mappers/_v2.ts` | `v2ToRequest` builds `new Request('http://localhost' + rawPath + qs)`, so the event's target is reshaped by the URL parser before the context sees it — the adapter cannot observe a raw target even where API Gateway preserved one, which is why its reported capability is the conservative `false` | Carry the event's target to the context unparsed and verify it against a live API Gateway; the capability value can then be measured instead of assumed |
