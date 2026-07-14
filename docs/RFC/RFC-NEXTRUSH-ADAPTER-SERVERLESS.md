# RFC — `@nextrush/adapter-serverless` (generic, adapter-scoped EventMapper registry)

> Status: Accepted · Change: `harden-runtime-edge-serverless` (Task group 5)
> Realizes the serverless design in `docs/audits/07-runtime-architecture.md` (Serverless Runtime).

## Summary

A new `@nextrush/adapter-serverless` package brings classic serverless (AWS Lambda
Function URL / API Gateway v2, and — as they land — GCF/Azure) onto the shared
`Context` pipeline. It separates the **execution model** from the **provider event
format**:

```
Runtime Core → Adapter (execution model: serverless) → EventMapper (event format) → Platform
```

## Public surface

```ts
// generic over the platform event, result, and optional platform context
interface EventMapper<Event, Result, Ctx = unknown> {
  readonly name: string;
  toRequest(event: Event, platformCtx?: Ctx): Request;
  fromResponse(response: Response, event: Event): Result | Promise<Result>;
  detect?(event: Event): boolean;
}

function createServerlessAdapter<Event, Result, Ctx>(options: {
  readonly mappers: readonly EventMapper<Event, Result, Ctx>[];
  readonly provider?: string;
  readonly timeout?: number;
}): { createHandler(app: Application): (event: Event, ctx?: Ctx) => Promise<Result> };

// built-in mapper
const lambdaFunctionUrl: EventMapper<LambdaFunctionUrlEvent, LambdaFunctionUrlResult>;
```

## Decisions

- **Generic `EventMapper`** — mapper authors get real types at the boundary, not
  `unknown`/`any` (matches the repo TypeScript steering).
- **Adapter-scoped, immutable registry** — mappers are passed at construction, not
  registered globally. A global registry would be **global mutable state**
  (`global-rules.instructions.md` §2 auto-block) with a last-writer-wins hazard.
  New providers (Oracle/Fly.io/OpenFaaS) are added by supplying a mapper — the
  adapter never grows a provider `switch`.
- **Explicit-over-detect** — a configured `provider` wins; `detect()` runs only when
  omitted. Configuration beats silent detection.
- **Execution model reused from the edge adapter** — `createServerlessAdapter`
  delegates the Request→Response engine to `@nextrush/adapter-edge`'s
  `createFetchHandler` (warm `ready()` reuse, per-invocation `timeout`→504, the
  shared `Context` pipeline). This keeps one proven execution path rather than
  duplicating it.

## Deviation from the proposal (noted honestly)

The proposal said the package "returns a `FetchAdapter`". A `FetchAdapter`'s handler
is `(Request) => Response`, but a serverless handler is `(event) => result` — a
different shape. Rather than force a misleading `satisfies FetchAdapter` on an event
handler, the public method is **`createHandler`** returning `(event, ctx?) => result`,
and the `FetchAdapter` conformance lives on the reused edge engine (which already
carries its guard). The mapper layer is guarded by the `EventMapper` type annotation.

## Deferred

- **True Function URL response streaming** (`awslambda.streamifyResponse`) — the
  current `lambda-function-url` mapper uses the **buffered** v2 result format
  (a streamed `Response` body is buffered into the result). True streaming is a
  distinct result shape and lands with the remaining provider work (task group 6).
- **Additional mappers** (`apigw-v1`, `apigw-v2`, `gcf`, `azure`) — task group 6.

## Verification

`pnpm --filter @nextrush/adapter-serverless test` — 10 tests: lambda round-trip
(method/path/query, JSON POST, base64 body, Set-Cookie→cookies), explicit-over-detect
selection, unknown-provider error, adapter-scoped isolation, timeout→504, streamed-body
buffering. Build + typecheck + lint clean.
