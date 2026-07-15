# NextRush Runtime & Serverless — How It Actually Works Now

This explains the current state of NextRush's runtime/edge/serverless story after
`openspec/changes/harden-runtime-edge-serverless` (78/78 tasks complete, specs synced to
`openspec/specs/`). It answers three things: what was broken and got fixed, how edge and
serverless deployments actually behave in production, and what "conformance" means every time
that word shows up in this codebase.

## 1. What was broken, and what changed

Before this change, three claims NextRush made about itself were true in spirit but not
provable or enforced:

**"The adapter model is consistent."** It was — by convention. Nothing in the type system
stopped someone from writing a new adapter that silently skipped a required method or widened
the shared `Context` type. It would compile, ship, and only reveal itself as a bug report.

*Fix:* `ServerAdapter`, `FetchAdapter`, and `AdapterContextFactory` are now real, exported types
in `@nextrush/types`. Every adapter (`node`, `bun`, `deno`, `edge`, and the new `serverless`)
carries a compile-time `satisfies` guard against one of these two shapes. If an adapter's method
signature drifts, `tsc` fails the build — the mistake never reaches a test run, let alone
production.

**"Edge-ready" was asserted, not measured.** The whole cross-adapter conformance suite ran under
Node via `vitest`, including the tests that were supposed to prove the Deno and Cloudflare
adapters worked. A Node-simulated Deno test can pass while the real Deno runtime disagrees with
it on some Web API edge case — this happened to other frameworks before, which is exactly why it
was a real gap.

*Fix:* the same conformance suite now also runs on the real Deno binary (pinned `v2.6.3`) and
inside a real `workerd`/miniflare isolate — the actual engine Cloudflare Workers runs on, not a
Node process pretending to be one. Both run in CI and are reproducible locally with `act`.

**"NextRush is serverless-native."** It wasn't, really — Lambda/GCF/Azure only worked if you
hand-wrote the glue between the platform's event object and a Web `Request`. There was no
package for it.

*Fix:* `@nextrush/adapter-serverless` now exists and ships built-in support for AWS Lambda
(Function URL + API Gateway v1/v2), Google Cloud Functions, and Azure Functions.

## 2. How serverless actually works in production

### The one-liner you actually write

```ts
import { createApp } from '@nextrush/core';
import { createLambdaHandler } from '@nextrush/adapter-serverless';

const app = createApp();
app.use((ctx) => ctx.json({ hello: 'lambda' }));

export const handler = createLambdaHandler(app);
```

That's the entire integration. No event-format code, no provider selection, no configuration
object. The equivalent one-liners exist for Google (`createGoogleHandler`) and Azure
(`createAzureHandler`); Cloudflare's equivalent (`createCloudflareHandler`) ships in
`@nextrush/adapter-edge` because Cloudflare is a `fetch`-native runtime, not classic serverless.

### What happens under that one line, invocation by invocation

1. **Module load (cold start only).** `createApp()` and `createLambdaHandler(app)` run once, at
   module scope, when AWS spins up a fresh execution environment. This is the expensive part —
   see the numbers below.
2. **First invocation.** The handler calls `app.ready()` internally. This boots middleware,
   resolves DI (if you're using the class runtime), and is memoized with an `app ??= build()`
   pattern — even if two invocations race in on the same cold instance, `ready()` runs exactly
   once. This was specifically tested (task 7.1/7.2): no cross-invocation state leak, no double
   boot.
3. **The event gets mapped to a Web `Request`.** Internally, an `EventMapper` (a small,
   pure `toRequest`/`fromResponse` pair) turns the Lambda event JSON into the same `Request`
   object your app would see running on plain Node or on Cloudflare. Your route handlers never
   know or care that they're running inside Lambda.
4. **Your app runs unchanged.** `app.callback()` — the exact same request pipeline used by every
   other adapter — processes the request. This is *why* the adapter is trustworthy: it doesn't
   reimplement routing or middleware composition, it just builds the standard `Context` and
   hands it to the same core everything else uses.
5. **The `Response` gets mapped back** into whatever shape the platform expects (Lambda wants
   `{ statusCode, headers, body, isBase64Encoded }`; API Gateway v1 and v2 want slightly
   different shapes; GCF and Azure want different shapes again). Binary bodies get base64-encoded
   on the way out, multi-value headers are preserved, and none of this is your code's concern.
6. **Warm invocations skip step 1 and re-run step 3 (`ready()` guard makes step 2 a no-op).**
   This is the container-reuse pattern AWS documents — build once, reuse the built app across
   however many requests hit that warm container before it's eventually recycled.

### The cold-start number, honestly

Measured locally (Node v26.4.0, 20 fresh processes per path — hardware-dependent, reproduce on
your own target before trusting it for capacity planning):

| Path | Median cold start |
|---|---|
| Functional (`createApp()` + plain handlers) | ~65.6ms |
| + class/DI runtime (`@nextrush/class`, decorators, DI) | ~79.5ms |

The ~14ms delta is `reflect-metadata` and the decorator/DI machinery loading. If cold start
matters for your use case (high fan-out, low-traffic functions, cost-sensitive), the functional
style is the cheaper path — this isn't a recommendation to avoid the class runtime everywhere,
it's a real, measured tradeoff you can decide on.

### Response streaming (Lambda Function URL only, not classic API Gateway)

If your handler writes with `ctx.sendStream(...)` and you deploy with
`createLambdaStreamingHandler(app)` instead of `createLambdaHandler`, the response streams to the
client as it's produced instead of being buffered in memory first — wrapped internally with AWS's
`awslambda.streamifyResponse`. This only works with Function URLs configured for
`RESPONSE_STREAM` invoke mode; classic API Gateway has no equivalent, so if you're behind API
Gateway your response is always buffered regardless of which handler you use.

### The advanced tier — if your platform isn't one of the four built-ins

If you need to run on a platform NextRush doesn't ship a mapper for (Oracle Functions, Fly.io,
an internal PaaS), you don't fork the adapter — you write an `EventMapper` and hand it to
`createServerlessAdapter` directly:

```ts
const oracle: EventMapper<OracleEvent, OracleResult> = {
  name: 'oracle',
  toRequest: (event) => new Request(/* ... */),
  fromResponse: async (response) => ({ /* ... */ }),
};
export const handler = createServerlessAdapter({ mappers: [oracle] }).createHandler(app);
```

This is deliberately marked `@advanced` / "runtime authors only" in the docs — 95%+ of users
never see this surface, they just call `createLambdaHandler(app)`. That tiering (simple default,
escape hatch available, escape hatch not in your face) is a direct decision recorded in
ADR-0007: *internal complexity must never become user complexity.*

## 3. How edge (Cloudflare Workers, etc.) actually works in production

Edge is architecturally simpler than serverless because the runtime itself already speaks
`fetch`, so there's no event-format translation step at all:

```ts
import { createApp } from '@nextrush/core';
import { createCloudflareHandler } from '@nextrush/adapter-edge';

const app = createApp();
app.use((ctx) => ctx.json({ hello: 'workers' }));

export default createCloudflareHandler(app);
```

`createCloudflareHandler` returns an object with a `fetch` method — exactly the shape
`workerd` expects. There's no `EventMapper` layer here because there's no event to map: a
Cloudflare Worker receives a real `Request` object directly from the platform. The handler just
wraps that `Request` in the same `Context` and runs `app.callback()`, identically to every other
adapter.

**The constraint that actually matters on edge:** no filesystem, no Node-specific streams. If
your middleware needs `fs` (e.g. `@nextrush/static` serving files off disk), it will not work on
edge, and it shouldn't silently pretend to — this is why capability negotiation exists (below).
Prefer Web-standard middleware (`cors`, `helmet`, `cookies`, `body-parser`, `compression`) which
edge fully supports.

**Bundle size is a hard budget, not a suggestion.** Cloudflare Workers caps a deployed script at
1MB. CI measures the gzipped size of the minimal functional edge bundle (core + router +
adapter-edge, no `reflect-metadata`) on every change and fails the build if it regresses past the
internal 30KB gzip target — the measured baseline today is ~13.1KB gzip. If a future change
accidentally drags in a Node-only dependency, this gate catches it before it ships, not after a
user's deploy fails.

## 4. What "conformance" actually means here

You'll see this word constantly in this codebase (`@nextrush/adapter-conformance`,
"conformance suite," "conformance guard," "certification matrix") — it's not marketing language,
it names a specific, real testing discipline.

**The core idea:** every adapter (node, bun, deno, edge, serverless) is supposed to behave
*identically* from the application's point of view. If you write a route handler, it should
produce the same status code, headers, and body whether it's running on plain Node or inside a
Cloudflare Worker. Conformance is the mechanism that proves that claim instead of just asserting
it.

There are two layers, and they catch different classes of bug:

**Compile-time conformance (the "guard").** Each adapter has a `satisfies ServerAdapter` or
`satisfies FetchAdapter` assertion in its source. This catches *shape* drift — a missing method,
a wrong return type — before the code even runs. Cheap, fast, catches the mistake at the exact
moment it's introduced.

**Behavioral conformance (the "suite").** A shared test suite (`@nextrush/adapter-conformance`)
runs the *same* set of requests — real requests, cookies, multipart uploads, SSE streams,
WebSocket upgrades, abort signals, timeouts — against every adapter and asserts the responses are
byte-identical. This is what actually proves "edge-ready" isn't just a claim: the suite runs
against the real Deno binary and inside a real `workerd` isolate, not a Node process simulating
them. If someone breaks the edge adapter, the workerd conformance job fails while the Node,
Deno, and Lambda jobs stay green — the failure is localized to exactly the runtime it broke.

**The certification matrix is conformance turned into a scorecard.** It's generated (not
hand-written) from the conformance suite's actual pass/fail results per feature per runtime:

| Feature | node | bun | deno | edge | serverless |
|---|---|---|---|---|---|
| Request / Streaming / Cookies / Multipart / SSE / Compression / WebSockets | ✅ | ✅ | ✅ | ✅ | ✅ |
| AbortSignal | ✅ | ✅ | ✅ | ✅ | ⚠️ partial |
| Timeouts | ⚠️ partial | ✅ | ✅ | ✅ | ✅ |
| Shutdown | ✅ | ✅ | ✅ | ➖ n/a | ➖ n/a |
| **Coverage** | 95% | 100% | 100% | 100% | 94.4% |

The two partial marks aren't bugs, they're honestly-disclosed platform realities: Lambda/GCF/Azure
deliver a buffered event, so there's no mid-request network-level abort the way a long-lived Node
socket has (`ctx.signal` still fires on *timeout*, just not on transport-level cancellation).
Plain Node enforces timeouts at the socket level rather than racing the handler to a clean 504
the way every other adapter does. Because the matrix is regenerated from real test results, a
future regression that breaks one of these features drops that runtime's score automatically —
nobody has to remember to update a hand-maintained table, and nobody can quietly let a claim go
stale.

**One thing conformance deliberately does *not* cover yet:** a real, credentialed deploy to an
actual AWS/Cloudflare account. The conformance suite proves behavior inside an emulator/real
binary; it can't catch a packaging mistake, an IAM permission gap, or a cold-start-only bug that
only shows up on the real managed service. That's what the separate, scheduled
`deploy → smoke → destroy` workflow is for (nightly, secret-gated, skipped rather than failed
when credentials aren't configured) — it's a different kind of proof than conformance, aimed at
a different kind of bug.

## Where to go deeper

- `docs/adr/ADR-0007-serverless-adapter-and-enforced-contract.md` — the architectural decision
  record for everything in section 1 and 2.
- `docs/guides/serverless-deploy.md` — copy-pasteable deploy examples for all four platforms.
- `docs/runtime-certification-matrix.md` — the live, regenerated matrix (this doc's table is a
  snapshot; that file is the source of truth).
- `packages/adapters/conformance/README.md` — how to run the real-Deno and real-workerd
  conformance jobs locally with `act`.
- `packages/adapters/serverless/README.md` — the full `@nextrush/adapter-serverless` API,
  including the cold-start benchmark methodology.
