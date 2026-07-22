# @nextrush/stream

> Runtime-agnostic response streaming for NextRush - text, Server-Sent Events, and NDJSON. Built for AI/agentic apps, works for any chunked response.

[![npm version](https://img.shields.io/npm/v/@nextrush/stream.svg)](https://www.npmjs.com/package/@nextrush/stream)
[![downloads](https://img.shields.io/npm/dm/@nextrush/stream.svg)](https://www.npmjs.com/package/@nextrush/stream)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/stream.svg)](https://bundlephobia.com/package/@nextrush/stream)
[![types](https://img.shields.io/npm/types/@nextrush/stream.svg)](https://www.npmjs.com/package/@nextrush/stream)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/stream.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Implement `ctx.stream()` / `ctx.sse()` / `ctx.ndjson()` once, in a runtime-agnostic core, so every platform adapter gets identical chunked-response behavior |
| **Package type** | Middleware/registrar (a shared runtime layer consumed by every platform adapter, not something you `app.use()` directly) |
| **Status** | Stable |
| **Included in `nextrush`?** | Yes -- re-exported. `ctx.stream()` / `ctx.sse()` / `ctx.ndjson()` work out of the box with `nextrush`; install this package directly only for `StreamController` / `StreamAbortedError` / `formatSSE` advanced integrations |
| **Support tier** | Public -- middleware/registrar (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal -- Node, Bun, Deno, Edge (zero `node:` imports; built only on Web-standard `ReadableStream` / `AbortSignal`) |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x |
| **Introduced** | v3.1.0 |

## Highlights

- Zero runtime dependencies -- the only listed dependency is `@nextrush/types` (workspace, types only, erased at build)
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed, strict TypeScript, zero `any`
- One shared lifecycle (`StreamController`) drives Node's eager pump and Bun/Deno/Edge's lazy `Response` body identically -- the same handler runs unmodified on all four

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Compatibility](#compatibility) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

LLM responses don't arrive as a value -- they arrive as a sequence of tokens over time. Streaming them correctly means solving four problems at once, and most hand-rolled implementations get at least one wrong:

```ts
// TODAY, without this package -- looks fine, has real gaps:
app.get('/chat', async (ctx) => {
  ctx.raw.res.setHeader('Content-Type', 'text/event-stream'); // bypasses the Context API
  for await (const chunk of completion) {
    ctx.raw.res.write(`data: ${chunk}\n\n`); // no multi-line escaping, no field injection guard
  }
  // nothing stops the upstream LLM call when the client closes the tab --
  // it keeps running and keeps costing money for tokens nobody will read
  ctx.raw.res.end();
});
```

- **Manual SSE framing is subtle and error-prone.** Multi-line `data:` fields need per-line escaping, `event:`/`id:`/`retry:` fields must precede `data:`, and the terminating blank line is commonly omitted -- all silent failures the browser's `EventSource` parser won't explain.
- **Streaming code is not portable across runtimes.** Node's `ServerResponse.write()` and the Fetch `Response`/`ReadableStream` model used by Bun, Deno, and edge runtimes are fundamentally different APIs. A handler written for one doesn't run on the other without a rewrite.
- **Cancellation is usually missing entirely.** When a user closes a chat tab mid-response, nothing tells the handler to stop. The upstream LLM call keeps running.
- **Bypassing the Context API breaks the framework's own contract.** Without a streaming primitive, the only escape hatch is raw response access -- defeating the point of a unified request/response API.

## When to use

**Use `@nextrush/stream` if:**

- Yes: You're streaming LLM/agent output token-by-token to a browser (`ctx.sse()`) or another service (`ctx.ndjson()`)
- Yes: You need real cancellation -- the upstream call should stop the instant the client disconnects
- Yes: You want the same handler code to run unmodified on Node, Bun, Deno, and edge runtimes

**Reach for something else if:**

- No: You need bidirectional communication (client -> server messages, not just server -> client) -- use [`@nextrush/websocket`](../extensions/websocket)
- No: You just need to send a complete response in one shot -- use `ctx.json()` / `ctx.send()`, not a streaming writer

---

## Installation

```bash
pnpm add @nextrush/stream
# npm i @nextrush/stream . yarn add @nextrush/stream . bun add @nextrush/stream
```

> [!NOTE]
> Already using `nextrush`? This is included -- `ctx.stream()`, `ctx.sse()`, and `ctx.ndjson()`
> are wired by every platform adapter automatically. Install `@nextrush/stream` directly only to
> import `StreamController`, `StreamAbortedError`, or `formatSSE` for advanced integrations.

## Quick start

```ts
import { createApp, listen } from 'nextrush';

const app = createApp();

app.get('/progress', async (ctx) => {
  await ctx.stream(async (writer) => {
    await writer.write('Loading...\n');
    await writer.write('Processing...\n');
    await writer.write('Done.\n');
  });
});

listen(app, 8080);
```

No options, no headers to set, no content type to remember. The connection closes automatically when the callback returns.

## Capabilities

**Capabilities**
- **Three protocol-specific entry points** -- `ctx.stream()` (text/bytes), `ctx.sse()` (Server-Sent Events), `ctx.ndjson()` (newline-delimited JSON), each with a writer that speaks exactly one wire format
- **Real cancellation** -- `writer.signal` fires the instant the client disconnects; wire it into any AI SDK's abort option and the upstream call actually stops
- **Loud failure on write-after-abort** -- throws `StreamAbortedError` rather than silently dropping data
- **Source consumption** -- `writer.consume(source)` adapts an existing `AsyncIterable` or Web `ReadableStream` (including a Node `Readable`, which satisfies `AsyncIterable`) in one call

**Developer experience**
- Writer-callback API -- no options bag to read before the first working handler
- Fully typed, zero `any`
- Tree-shakable, side-effect-free

## Mental model

`ctx.stream()` / `ctx.sse()` / `ctx.ndjson()` all follow the same shape: pass a callback, receive a protocol-specific writer, write until done. The connection closes automatically when the callback resolves -- nothing to remember, nothing to configure first.

```text
ctx.sse(async writer => ...) --> StreamController --> writer.write() / writer.consume()
                                        |                        |
                                        |                        v
                                        |                 formatSSE() / encode()
                                        |                        |
                                        v                        v
                              client disconnects          ctx.sendStream()
                              (writer.signal fires)               |
                                        |                Node: eager pump
                                        v                Bun/Deno/Edge: Response body
                              StreamAbortedError
                              (thrown from write()/consume())
```

**Rule:** `StreamController` owns cancellation, backpressure, and source normalization exactly once. `TextWriter`, `SSEWriter`, and `NDJSONWriter` are thin formatters on top of it -- each knows one wire format and nothing else.

> [!TIP]
> The full request lifecycle (Mermaid) is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Stream Server-Sent Events to an LLM chat UI

```ts
app.post('/chat', async (ctx) => {
  await ctx.sse(async (writer) => {
    const completion = await openai.chat.completions.create(
      { model: 'gpt-5', messages: ctx.body as ChatMessage[], stream: true },
      { signal: writer.signal } // abort OpenAI the instant the client disconnects
    );

    for await (const chunk of completion) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) await writer.write({ data: token });
    }
  });
});
```

`ctx.sse()` sets `Content-Type: text/event-stream` and `Cache-Control: no-cache`, and formats every event to spec -- multi-line `data:` escaping, `event:`/`id:`/`retry:` fields, the terminating blank line.

### Stream structured agent traces as NDJSON

```ts
app.post('/agent/trace', async (ctx) => {
  await ctx.ndjson(async (writer) => {
    await writer.write({ type: 'tool_call', name: 'search', args: { query: '...' } });
    const result = await runTool('search', { query: '...' });
    await writer.write({ type: 'tool_result', result });
    await writer.write({ type: 'final_answer', text: '...' });
  });
});
```

For structured agent traces and tool-call logs where SSE framing isn't needed -- server-to-server pipelines, CLI consumers.

### Consume an existing AsyncIterable or ReadableStream

AI SDKs and database cursors already hand you an `AsyncIterable` or `ReadableStream`. `writer.consume()` adapts it in one call -- no manual loop, no manual type-checking.

```ts
// LangChain - model.stream() already returns an AsyncIterable
app.post('/agent', async (ctx) => {
  await ctx.sse(async (writer) => {
    const model = new ChatOpenAI({ model: 'gpt-5', streaming: true });
    const stream = await model.stream(ctx.body as string, { signal: writer.signal });
    await writer.consume(stream);
  });
});

// Vercel AI SDK
app.post('/ai', async (ctx) => {
  await ctx.sse(async (writer) => {
    const result = streamText({
      model: openai('gpt-5'),
      prompt: (ctx.body as { prompt: string }).prompt,
      abortSignal: writer.signal,
    });
    await writer.consume(result.textStream);
  });
});
```

For `ctx.sse()`, each consumed chunk is automatically wrapped as `{ data: chunk }`. `writer.consume(source)` accepts `StreamSource<T>` -- `AsyncIterable<T> | ReadableStream<T>` -- normalized internally to one code path and never branched on in application code. A Node `Readable` is accepted through the `AsyncIterable` branch (it has implemented `Symbol.asyncIterator` natively since Node 10); it is not a distinct third member of the union.

### Wire real cancellation into an upstream call

```ts
await ctx.sse(async (writer) => {
  writer.onAbort(() => console.log('client disconnected - upstream cancelled'));

  for await (const chunk of completion) {
    if (writer.aborted) break; // optional early exit for expensive work
    await writer.write({ data: chunk }); // throws StreamAbortedError once aborted
  }
});
```

Every writer exposes real cancellation backed by an `AbortSignal`. Writing after disconnect **throws** `StreamAbortedError` -- it does not silently no-op. The framework catches it at the `ctx.stream()` / `ctx.sse()` / `ctx.ndjson()` boundary and closes cleanly: it is never logged as an error and never re-thrown to the caller.

### Handle errors inside a streaming handler

```ts
await ctx.sse(async (writer) => {
  try {
    await runAgent(writer);
  } catch (error) {
    await writer.write({ event: 'error', data: (error as Error).message });
  }
});
```

There is one error-handling model -- `try`/`catch` -- not a second callback to learn. Once a stream has started, headers are already on the wire: a global error-handling middleware can observe and log an error that propagates out of a streaming handler, but it cannot rewrite a response that has already begun. Write a final error event inside the callback if the client needs to see it.

## API overview

The sealed public surface (ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `StreamController` | `class` | 3.1.0 | Stable | Owns abort/backpressure/enqueue/close lifecycle. Consumed by platform adapters to implement `ctx.stream()`/`ctx.sse()`/`ctx.ndjson()`; most applications never construct one directly. |
| `StreamAbortedError` | `class extends Error` | 3.1.0 | Stable | Thrown by a writer's `write()`/`consume()` once the client has disconnected. |
| `formatSSE` | `(event: SSEEvent) => string` | 3.1.0 | Stable | Formats one `SSEEvent` to its `text/event-stream` wire representation. |
| `runTextStream` | `(ctx, run) => Promise<void>` | 3.1.0 | Stable | Implements `ctx.stream()`. |
| `runSSEStream` | `(ctx, run) => Promise<void>` | 3.1.0 | Stable | Implements `ctx.sse()`. |
| `runNDJSONStream` | `(ctx, run) => Promise<void>` | 3.1.0 | Stable | Implements `ctx.ndjson()`. |
| `TextWriter` | `class implements TextStreamWriter` | 3.1.0 | Stable | Raw text/byte writer. |
| `SSEWriter` | `class implements SSEStreamWriter` | 3.1.0 | Stable | Server-Sent Events writer. |
| `NDJSONWriter` | `class implements NDJSONStreamWriter` | 3.1.0 | Stable | Newline-delimited JSON writer. |
| `type BaseStreamWriter` | `{ aborted, signal, onAbort(fn) }` | 3.1.0 | Stable | Capabilities shared by every writer, regardless of protocol. |
| `type TextStreamWriter` | `extends BaseStreamWriter` | 3.1.0 | Stable | Adds `write(chunk: string \| Uint8Array)` and `consume(source: StreamSource<string \| Uint8Array>)`. |
| `type SSEStreamWriter` | `extends BaseStreamWriter` | 3.1.0 | Stable | Adds `write(event: SSEEvent)` and `consume(source: StreamSource<string \| Uint8Array>)`. |
| `type NDJSONStreamWriter` | `extends BaseStreamWriter` | 3.1.0 | Stable | Adds `write(value: unknown)` and `consume(source: StreamSource<unknown>)`. |
| `type SSEEvent` | `{ data, event?, id?, retry? }` | 3.1.0 | Stable | One Server-Sent Event. |
| `type StreamSource<T>` | `AsyncIterable<T> \| ReadableStream<T>` | 3.1.0 | Stable | Source shapes `consume()` accepts. |
| `type StreamRun<W>` | `(writer: W) => Promise<void>` | 3.1.0 | Stable | The callback shape passed to `ctx.stream()`/`ctx.sse()`/`ctx.ndjson()`. |

> [!IMPORTANT]
> `consume()` is declared on each concrete writer interface (`TextStreamWriter`, `SSEStreamWriter`,
> `NDJSONStreamWriter`), not on `BaseStreamWriter` -- the base interface only carries
> `aborted`/`signal`/`onAbort`. There is no `NodeJS.ReadableStream` member in `StreamSource<T>`;
> it is exactly the two-member union `AsyncIterable<T> | ReadableStream<T>`.

Most applications never construct `StreamController` or the writer classes directly -- they exist so platform adapters can build `ctx.stream()` / `ctx.sse()` / `ctx.ndjson()` without duplicating lifecycle logic. Set custom headers (e.g. a different `Content-Type`) with `ctx.set(...)` before calling the streaming method -- there is no options bag on the streaming methods themselves.

## Options

No configuration -- `ctx.stream()` / `ctx.sse()` / `ctx.ndjson()` each take one callback and nothing else. Content-Type, cache headers, and wire-format framing are fixed per protocol; use `ctx.set(...)` before the call for anything else.

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | 3.x |
| Node.js | >=22 |
| TypeScript | >=5.x |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js >=22 | Yes | Eager pump -- `ctx.sendStream()` writes directly to `ServerResponse` with backpressure |
| Bun / Deno / Edge | Yes / Yes / Yes | Native `Response` body -- the runtime drains the stream; `ctx.sendStream()` is a one-line body assignment on each |

The public writer API is identical across all four runtimes -- only the internal transport primitive (`ctx.sendStream()`) differs per adapter, and application code never touches it directly. Verified with real integration tests against Node's HTTP server, and against real `Bun.serve` / `Deno.serve` instances producing byte-identical output.

**Integration**
- **Peer dependencies:** none
- **Works with:** any AI SDK exposing an `AsyncIterable` or an abort-signal option (OpenAI, LangChain, Vercel AI SDK -- see [Common tasks](#common-tasks))
- **Incompatible with:** none

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>The upstream LLM call keeps running after the client disconnects</strong></summary>

**Cause:** `writer.signal` was never passed into the upstream SDK's own abort option -- a disconnected client still leaves the LLM request running server-side unless something tells it to stop. **Fix:** always pass `{ signal: writer.signal }` (or the SDK's equivalent) to any long-running upstream call inside a streaming handler.

```ts
await ctx.sse(async (writer) => {
  const completion = await openai.chat.completions.create(
    { model: 'gpt-5', messages, stream: true },
    { signal: writer.signal } // <-- this line
  );
});
```

</details>

<details>
<summary><strong>`StreamAbortedError` appears to swallow a real bug</strong></summary>

**Cause:** `StreamAbortedError` is a control-flow signal, not an application error -- it is thrown deliberately when a write happens after the client has disconnected, and the framework catches it at the `ctx.stream()`/`ctx.sse()`/`ctx.ndjson()` boundary without logging or re-throwing. **Fix:** if you need to distinguish "cancelled" from "something broke," catch `StreamAbortedError` explicitly inside your callback; a genuine bug throws a different error type and propagates normally.

</details>

<details>
<summary><strong>A response never completes, or hangs on the client</strong></summary>

**Cause:** most commonly, the callback passed to `ctx.stream()`/`ctx.sse()`/`ctx.ndjson()` never resolves -- the connection closes exactly when that callback returns. **Fix:** confirm every code path inside the callback (including error paths) either returns or throws; there is no separate "end the stream" call to remember.

</details>

## FAQ

**Can I use this without `nextrush`?**
Yes -- install `@nextrush/stream` directly and call `runTextStream()` / `runSSEStream()` / `runNDJSONStream()` against any object satisfying the minimal `StreamCapableContext` shape (`signal`, `set()`, `sendStream()`). Most applications should use `ctx.stream()`/`ctx.sse()`/`ctx.ndjson()` through `nextrush` instead.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Yes -- all four runtimes are wired and verified byte-identical (see [Compatibility](#compatibility)). The package itself has zero runtime-specific code; each adapter supplies its own `ctx.sendStream()`.

**Does this handle WebSocket-style bidirectional streaming?**
No -- this package is strictly server-to-client. For bidirectional communication, see [`@nextrush/websocket`](../extensions/websocket).

---

## Package relationships

```text
                depends on            @nextrush/types
@nextrush/stream ------------------->
                consumed by           adapter-node / adapter-bun / adapter-deno / adapter-edge
                distinct from         @nextrush/websocket (bidirectional, not server-to-client only)
```

- **Depends on:** [`@nextrush/types`](../types) -- `BaseStreamWriter`/`StreamSource`/`SSEEvent`/`StreamRun` contracts, types only
- **Consumed by:** every platform adapter (`adapter-node`, `adapter-bun`, `adapter-deno`, `adapter-edge`) -- each implements `ctx.sendStream()` and wires `runTextStream`/`runSSEStream`/`runNDJSONStream` into `Context`
- **Distinct from:** [`@nextrush/websocket`](../extensions/websocket) -- bidirectional streaming; this package is server-to-client only
- **Alternative:** none within NextRush for chunked HTTP responses

## Architecture

Maintaining or contributing to this package? The internal design -- `StreamController`'s
lifecycle, backpressure, source normalization, and cross-runtime wiring (with diagrams) -- is in
**[`ARCHITECTURE.md`](./ARCHITECTURE.md)**. Design history:
[`docs/RFC/request-data/003-stream.md`](../../docs/RFC/request-data/003-stream.md).

## Resources

- **Learn** -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- **Changelog** -- [CHANGELOG.md](./CHANGELOG.md)
- **Report an issue** -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- **Contribute** -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
