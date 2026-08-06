# Streaming

Streaming responds in chunks instead of buffering one full response. Instead of collecting the
whole result and sending it once, you write pieces as they're ready — an LLM's tokens, a
long-running job's progress lines, a feed of events.

NextRush streams over Web-standard `ReadableStream` with zero `node:` imports, so the same
handler runs identically on Node, Bun, Deno, and edge runtimes.

## Three protocols, one shape

```ts
ctx.stream(run);   // raw text / bytes
ctx.sse(run);      // Server-Sent Events
ctx.ndjson(run);   // newline-delimited JSON
```

Each takes a callback that receives a protocol-specific writer. The connection auto-closes when
the callback resolves:

```ts
await ctx.stream(async (writer) => {
  await writer.write('Loading...\n');
  await writer.write('Done.\n');
});

await ctx.sse(async (writer) => {
  await writer.write({ data: { step: 'search' } });
  await writer.write({ data: { step: 'done' }, event: 'result' });
});

await ctx.ndjson(async (writer) => {
  await writer.write({ step: 'search' });
  await writer.write({ step: 'done' });
});
```

## The writers

| Writer | `write(...)` | Best for |
| ------ | ------------ | -------- |
| `TextStreamWriter` | `write(chunk: string \| Uint8Array)` | plain text / bytes |
| `SSEStreamWriter` | `write(event: SSEEvent)` | push events to the client |
| `NDJSONStreamWriter` | `write(value: unknown)` | machine-readable JSON lines |

`SSEEvent` fields: `data` (required; objects are `JSON.stringify`'d, strings sent verbatim),
plus optional `event`, `id`, and `retry`. The framework handles all wire-format framing —
multi-line `data:` escaping, the terminating blank line.

Every writer also exposes `consume(source)` to pipe an existing producer as the body, accepting
either an `AsyncIterable` or a Web `ReadableStream`:

```ts
await ctx.stream((writer) => writer.consume(fileReadStream));
```

## Aborting

The writer carries the client connection state:

| Member | Meaning |
| ------ | ------- |
| `aborted` | `true` once the client has disconnected |
| `signal` | `AbortSignal` — pass into an upstream SDK to cancel work the instant the client goes away |
| `onAbort(fn)` | Register a cleanup callback (release a resource, cancel upstream) |

```ts
await ctx.sse(async (writer) => {
  for await (const token of llm.stream({ signal: writer.signal })) {
    await writer.write({ data: token });
  }
});
```

Writing after disconnect throws `StreamAbortedError` — a **control-flow signal**, not a failure.
It's caught at the top-level streaming boundary and never logged or re-thrown, so a client
closing mid-stream isn't an error in your logs.

## When you need the low-level pieces

The streaming implementation ships in `@nextrush/stream`. The `Context` methods are re-exported
through `nextrush`, so most apps never import it. Import it directly only for the primitives:

```ts
import { StreamController, formatSSE, StreamAbortedError } from '@nextrush/stream';

const frame = formatSSE({ data: { ok: true } }); // the wire bytes, if you need them by hand
```

`ctx.send(...)` is the non-streaming alternative — it accepts a string, a `Buffer`, or a stream
as a one-shot body, and rejects a second send.

## Next steps

- [Request Lifecycle](Request-Lifecycle) — where streaming happens in the request path
- [Runtime Compatibility](Core-Concepts) — Web-standard streams across runtimes
- Streaming concept guide: https://0xtanzim.github.io/nextRush/docs/concepts/streaming
- Stream reference: https://0xtanzim.github.io/nextRush/docs/reference/stream
- Runtime compatibility: https://0xtanzim.github.io/nextRush/docs/concepts/runtime-compatibility
