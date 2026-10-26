# Proposal

## Why

Two gaps in the response API, both confirmed against the current source:

1. `ctx.json(data)` ignores a second argument. A probe against the built Bun adapter shows
   `ctx.json({ x: 1 }, 202)` answering **200** — silently — so the only way to send a non-200
   response is to assign `ctx.status` on a preceding line.
2. There is no per-call way to set response headers. A handler that needs `Location`,
   `Cache-Control`, `ETag` or a request-id header must call `ctx.set()` separately, per header,
   before writing the body.

User feedback flagged both as deviating from familiar response helpers, and the cost of changing
them grows with adoption rather than with API age. Both changes are additive; the breaking
`ctx.status(code)` redesign stays out of scope.

## What Changes

### Approved API shapes

```ts
ctx.json({ users });                                    // existing behavior, unchanged
ctx.json({ id: 'u_123' }, 201);                         // numeric status shorthand
ctx.json({ id: 'u_123' }, {                             // options object
  status: 201,
  headers: {
    Location: '/users/u_123',
    'Cache-Control': 'no-store',
    'X-Request-Id': requestId,
  },
});
ctx.status = 201;                                       // unchanged, still supported
ctx.json({ id: 'u_123' });
```

The same second argument is added to `ctx.html(content, statusOrOptions?)` and
`ctx.send(body, statusOrOptions?)`. One shared options type is exported from `@nextrush/types` and
reused by all three; the argument's type is the inline union `number | ResponseOptions`, not a
second exported alias.

### Status semantics

1. No second argument → existing behavior exactly: the carried `ctx.status`, default `200`.
2. Numeric second argument → that value is the explicit status for this response.
3. Object second argument → its optional `status` and `headers` are applied.
4. An explicit status wins over a previously assigned `ctx.status` for that response.
5. The effective status is recorded in `ctx.status`, so logging, metrics and post-handler
   middleware observe the status that was actually sent.
6. An invalid status fails predictably and identically on every adapter: a `RangeError` thrown
   before any byte is written, leaving the response uncommitted so the error handler can answer.
7. Body suppression and status-specific behavior are unchanged: `204`, `304`, HEAD and 1xx responses
   stay bodyless.
8. Header merging and multi-value headers behave identically on every adapter.

### Status range

The accepted range is **200-599**, integers only, and the proposal states it explicitly because the
adapters do not agree today: the Web builder rejects informational statuses at response construction
(`packages/runtime/src/response-builder.ts:230`) and the platform `Response` allows 200-599, while
Node's `writeHead` accepts 100-999. 200-599 is the intersection every shipped adapter can answer.
Validating the carried `ctx.status` assignment path is **not** part of this change.

### Header merge policy

- Supplied headers merge with headers already set by middleware or application code.
- For ordinary headers, a supplied value overrides an existing value for the same field
  (case-insensitive), keeping the field's position.
- Multi-value semantics are preserved and are **not** implemented by flattening to a plain object:
  `Set-Cookie` accumulates (middleware cookies survive), and an array value replaces the field and
  then contributes each element — the `ctx.set()` semantics already implemented once in
  `packages/runtime/src/outgoing-headers.ts` and shared by the Node and Web adapters.
- Header names and values pass the existing header-safety validation before they reach the response,
  so the new path cannot bypass the framework's header-write guarantees.
- An explicit `Content-Type` in `headers` overrides the helper's automatic media type, matching
  today's "the body method's content type is a fallback" rule. `ctx.json()` keeps applying
  `application/json` when no explicit content type is supplied.

### Types

`ResponseOptions` is declared in `@nextrush/types` as `{ status?: number; headers?: ResponseHeaders }`,
where the header type mirrors what `ctx.set()` already accepts (`string | number | string[]` per
field). A DOM `HeadersInit` is deliberately not used: it appears nowhere in this repository,
`tsconfig.base.json` compiles against `ES2022` without the DOM lib, and accepting a `Headers`
instance would normalize casing and collapse multi-value fields — the exact behavior the merge
policy must preserve.

### Out of scope

`ctx.status(code)` method form; a `ctx.statusCode` accessor; `statusText` (recorded as a possible
future extension, not supported here); `cookies`, `contentType`, `body`, `signal` and `redirect`
fields in the options object; router mounting changes; error-envelope unification; unrelated
middleware or response API redesign.

## Capabilities

### New Capabilities

None. This extends an existing capability rather than creating one.

### Modified Capabilities

- `runtime-adapter-contract`: adds requirements that the shared `Context` response helpers accept an
  optional numeric status or options object, that the effective status is recorded on the context,
  and that status validation, header merging and body suppression are identical on every adapter.

## Impact

- **Code**: `packages/types/src/context.ts` (public signatures + `ResponseOptions`),
  `packages/runtime/src/web-context-base.ts`, `packages/runtime/src/response-builder.ts`,
  `packages/adapters/node/src/context.ts`. `packages/adapters/node` has its own `json/send/html`
  implementations and `send()` delegates objects to `json()`, so the two paths must be applied
  separately rather than assumed identical.
- **Parity**: `packages/adapters/conformance` gains the cross-adapter scenarios; Bun, Deno, Edge and
  serverless share the Web builder path, Node is the second implementation that must match.
- **Public surface**: additive — optional parameters plus one new exported type. Surface-lock tests
  in `@nextrush/types` and `@nextrush/runtime` are updated accordingly.
- **Docs**: `concepts/(core-framework)/context.mdx`, `guides/api-development/error-handling.mdx`,
  `migrate/from-express.mdx`, `migrate/from-fastify.mdx`.
- **Dependencies**: none added; no new DOM types.
- **Durable decision**: the precedence rule, the 200-599 validation range, the persist-into-`ctx.status`
  rule and the header merge policy MUST be recorded in `docs/RFC/request-data/` before this change is
  archived, because this is a public `Context` API change and is RFC-gated.
