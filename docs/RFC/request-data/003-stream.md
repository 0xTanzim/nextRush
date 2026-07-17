# RFC: `@nextrush/stream` — Unified Response Streaming for AI/Agentic Applications

**Status:** Draft v5 (final — architecture approved, implementation-ready; see §0)
**Date:** 2026-07-06
**Author:** NextRush Core Team
**Package classification:** **Core** (lockstep versioning group per `RFC-HYBRID-VERSIONING-AND-RELEASE-STRATEGY.md`) — NOT a plugin. See §0 and §4a for why.
**Package location:** `packages/stream/` (sibling of `packages/core/`, `packages/router/`, `packages/runtime/` — not under `packages/plugins/`)
**Package hierarchy position:** `types → errors → core → router → runtime` → **`@nextrush/stream`** → `di → decorators → controllers → adapter-* → middleware/*`

---

## 0. Revision History

- **v1** — API centered on `AsyncIterable<string | Uint8Array>` with an options bag. Rejected: exposed transport concepts instead of developer intent.
- **v2** — Writer-callback model, matching Hono's shape. Approved architecturally; public surface still had five issues (mixed `ctx.stream.from()` namespace, one writer accumulating `write()`/`writeJSON()`/`writeSSE()`, `pipe()` branching inline on three source types, silent no-op on write-after-abort, `ctx.signal` called "internal" but used everywhere).
- **v3** — Fixed all five v2 issues via three protocol-specific entry points, one `normalizeToAsyncIterator()` call site, `StreamAbortedError` instead of silent no-op, `writer.signal` as the only public surface. Approved with two refinements requested.
- **v4** — Removed the second `onError` callback argument (one error-handling system: `try/catch`, not two); renamed `pipe()` to `consume()` (names the actual data direction — the writer consumes an external producer, it doesn't forward its own output elsewhere); introduced the internal `StreamController` to own lifecycle once instead of three times.
- **v5 (this document)** — Final architecture review caught one remaining structural error, inherited from earlier drafts and never actually corrected: **this package was classified as a plugin, which contradicts its own design.** Fixes:
  1. **Reclassified from plugin to core.** §4/§5/§7 already designed `ctx.stream()`/`ctx.sse()`/`ctx.ndjson()` as direct additions to the `Context` interface — the same mechanism `ctx.json()`/`ctx.html()`/`ctx.redirect()` already use. Per `v3-architecture.instructions.md`, a **plugin** is something that implements the `Plugin` interface and calls `install(app: Application)` — registering middleware or routes onto an `Application` instance (that's what `@nextrush/websocket`, `@nextrush/static`, `@nextrush/controllers`, etc. actually do). This package never did that; it extends `Context` directly, which is core behavior, not plugin behavior. The v4 draft's own metadata line ("Tier 2 (Middleware/Plugin)") and its implementation-plan header (`packages/plugins/stream/`) contradicted the design in every other section of the same document — an internal inconsistency, not a stylistic choice, now corrected.
  2. **Moved to `packages/stream/`**, sibling to `packages/core/`, `packages/router/`, `packages/runtime/` — matching the existing convention that core-tier packages sit directly under `packages/`, while only `middleware/*`, `plugins/*`, and `adapters/*` use subfolders.
  3. **Consequential fix, not just a rename**: because `adapter-node`/`adapter-bun`/`adapter-deno`/`adapter-edge` depend on `@nextrush/stream` to implement `ctx.stream()`/`ctx.sse()`/`ctx.ndjson()` on their concrete `Context`, this package sits in the dependency graph exactly where `core`/`router`/`runtime` sit — **before** the adapters, not after. That means it must join the **core lockstep versioning group**, not the independent/ecosystem tier. §13 (Resolved Decisions) is corrected accordingly, and a required follow-up against `RFC-HYBRID-VERSIONING-AND-RELEASE-STRATEGY.md` is logged in §14.
  4. **Explicit, singular API surface.** `ctx.stream()`/`ctx.sse()`/`ctx.ndjson()` are the *only* entry points — there is no competing free-function import (`import { stream } from '@nextrush/stream'`) for application code to call instead. This was implicit in v3/v4's examples but never stated as a rule; §7 now says so explicitly, to prevent a second calling convention from drifting in later.
  5. **Phased implementation order**, replacing v4's single flat 15-step table that interleaved all three protocols. §11 now sequences: `StreamController` → Node adapter → `TextStreamWriter` → `ctx.stream()` → tests → `SSEStreamWriter` → `NDJSONStreamWriter` → cross-adapter integration → benchmarks. Rationale: if `StreamController` is correct, every writer built on it is small; building all three writers in parallel before the shared foundation is proven risks compounding the same bug three times.
  6. **Explicit scope discipline for v1 implementation**, §12 — no `.through()`, no compression, no custom encoders, no convenience helpers beyond what's specified here, even though they'd be easy to add mid-build. Ship the foundation; let real usage drive the next iteration.

---

## 1. Problem Statement

LLM and agentic applications (LangChain, Vercel AI SDK, direct OpenAI/Anthropic SDK usage) do not return a response — they **emit a sequence of tokens over time**. The dominant wire formats are:

- **SSE** (`text/event-stream`) — the browser-native standard; used by ChatGPT-style chat UIs.
- **Raw chunked text** — CLI tools, progress logs, file exports.
- **NDJSON** — server-to-server agent pipelines, structured tool-call traces.

NextRush's transport layer already streams correctly today (verified against source — see §2), but there is no ergonomic API for it. A handler currently must:

```typescript
// What a NextRush user has to write TODAY — every time, by hand
app.post('/chat', async (ctx) => {
  const stream = await openai.chat.completions.create({ stream: true, ... });
  ctx.raw.res.setHeader('Content-Type', 'text/event-stream');
  ctx.raw.res.setHeader('Cache-Control', 'no-cache');
  ctx.raw.res.setHeader('Connection', 'keep-alive');
  ctx.raw.res.flushHeaders();
  try {
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? '';
      ctx.raw.res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
  } finally {
    ctx.raw.res.end();
  }
});
```

Problems: bypasses the Context API (`global-rules.instructions.md` §10), isn't portable across the four adapters, has no cancellation, and hand-rolled SSE framing is easy to get subtly wrong.

---

## 2. What Already Works (do not rebuild this)

Verified directly against source:

| Adapter | Streaming support today | Model |
|---|---|---|
| `adapter-node` (`context.ts` `send()`) | Pipes Node `Readable` and Web `ReadableStream`, with backpressure (`res.write()` return value + `drain`), cleanup on `res.on('close')`, safe mid-stream error fallback | **Eager/push** — writes directly to the live `ServerResponse` |
| `adapter-bun` / `adapter-deno` / `adapter-edge` (`context.ts` `send()`) | Accepts `data instanceof ReadableStream`, assigns to `_responseBuilder.body` | **Lazy/deferred** — builds a `Response`; the runtime drains the stream itself |

This asymmetry stays entirely inside `@nextrush/stream` and the adapters. The public API in §6 is identical regardless of which model sits underneath.

---

## 3. Design Goals

1. **The API teaches itself in one example** — no options bag before the first working handler.
2. **Each streaming protocol gets its own entry point and its own writer.** `write()` always means "write the native unit for this protocol."
3. **One handler, four runtimes.**
4. **Auto-close by default.**
5. **Loud failure, not silent failure, on write-after-abort.** `StreamAbortedError` thrown, not a silent no-op.
6. **`signal` lives on the writer, not on `ctx`.**
7. **One normalization path** for adapting existing sources — a single internal function, called once.
8. **One error-handling system, not two.** No parallel `onError` callback competing with middleware and `try/catch`. (New in v4.)
9. **One shared lifecycle implementation, not three.** All three writers delegate abort/buffer/enqueue/close to a single internal `StreamController`; only formatting differs between them. (New in v4.)
10. **Architecture leaves room for transform pipelines (`.through()`) later without a breaking change** — not built now, but not designed against.
11. **Zero runtime dependencies**, per `global-rules.instructions.md` §6.
12. **Framework-agnostic of any specific AI SDK.**
13. **Additive, not breaking.**

---

## 4. The One New Adapter Primitive

Every adapter implements exactly one new low-level method; `@nextrush/stream` builds the entire public API on top of it and adapters never contain SSE/NDJSON-specific code:

```typescript
// Added to the Context interface (packages/types/src/context.ts)
export interface Context {
  // ... existing members unchanged ...

  /**
   * @internal Adapter-level primitive used by @nextrush/stream. Not intended
   * for direct use in handlers — use writer.signal inside ctx.stream()/
   * ctx.sse()/ctx.ndjson() instead (see §6, §7).
   */
  readonly signal: AbortSignal;

  /** @internal Adapter-level transport primitive. Use ctx.stream()/ctx.sse()/ctx.ndjson() instead. */
  sendStream(source: ReadableStream<Uint8Array>): Promise<void>;
}
```

- **Node**: `sendStream()` is the existing Web-`ReadableStream` branch of `send()`, extracted verbatim into a named method — a behavior-preserving refactor, not new logic.
- **Bun/Deno/Edge**: `sendStream()` is the existing one-line `_responseBuilder.body = stream` assignment, extracted the same way.
- **`ctx.signal`**: synthesized on Node from `res.on('close')`/`req.on('aborted')` (reuses disconnect-detection the Node adapter already has); passed straight through on Bun/Deno/Edge from the platform `Request.signal`, which already exists there today and simply isn't surfaced yet.

`Context.signal` is marked `@internal` in JSDoc and excluded from the public API reference. The documented, supported surface is `writer.signal` (§7).

### 4a. Dependency Direction (why this settles the plugin-vs-core question)

- **`@nextrush/stream` depends only on `@nextrush/types`** — the `Context` interface shape, `AbortSignal`, and `ReadableStream` global types. It does not import from, or depend on, any adapter.
- **Each adapter (`adapter-node`, `adapter-bun`, `adapter-deno`, `adapter-edge`) depends on `@nextrush/stream`** to wire `ctx.stream()`/`ctx.sse()`/`ctx.ndjson()` onto its concrete `Context` implementation, in addition to implementing the low-level `signal`/`sendStream()` primitives itself (adapter-specific, per §4).

This is the same shape `di`/`decorators`/`controllers` already have relative to the adapters — core-tier packages the adapters depend on, never the reverse. A plugin, by contrast, depends on `core` and is registered onto a running `Application` via `app.plugin(...)`; nothing downstream is ever required to depend on a plugin to function. `@nextrush/stream` is required by every adapter to expose a complete `Context` — that alone settles it as core, not optional.

---

## 5. Internal Architecture — `StreamController`

Per review: three independently-implemented writers would duplicate abort-handling, buffering, enqueue, close, and cleanup logic three times, with only the wire-format differing. Instead, one internal component owns the lifecycle; the three public writers are thin formatting wrappers over it.

```
Context
   │
   ▼
StreamController   ← owns: abort, buffering, normalization, enqueue, close, cleanup
   │
   ├──▶ TextStreamWriter   (write() = controller.enqueue(encode(chunk)))
   ├──▶ SSEStreamWriter    (write() = controller.enqueue(formatSSE(event)))
   └──▶ NDJSONStreamWriter (write() = controller.enqueue(encode(JSON.stringify(value) + '\n')))
   │
   ▼
ctx.sendStream()  (adapter primitive, §4)
   │
   ▼
Node / Bun / Deno / Edge HTTP response
```

```typescript
// Internal — never exported from @nextrush/stream's public entry point.
class StreamController {
  readonly signal: AbortSignal;
  get aborted(): boolean { return this.signal.aborted; }

  constructor(ctx: Context) {
    this.signal = ctx.signal; // the @internal Context primitive from §4
  }

  /** Throws StreamAbortedError if aborted; otherwise enqueues a chunk. */
  enqueue(chunk: Uint8Array): void {
    if (this.aborted) throw new StreamAbortedError();
    this._controller.enqueue(chunk);
  }

  onAbort(fn: () => void): void {
    if (this.aborted) { fn(); return; }
    this.signal.addEventListener('abort', fn, { once: true });
  }

  /** Normalizes any accepted source shape to one internal async-iterator shape. See §7.2. */
  normalize(source: AsyncIterable<unknown> | ReadableStream<unknown> | NodeJS.ReadableStream): AsyncIterator<unknown> {
    /* single implementation, described in §7.2 */
  }

  async close(): Promise<void> { /* ends the underlying ReadableStream cleanly */ }

  // Wires the underlying ReadableStream + ctx.sendStream() — the only place
  // that talks to the adapter primitive from §4.
}
```

Each writer becomes essentially:

```typescript
class SSEStreamWriter implements BaseStreamWriter {
  constructor(private controller: StreamController) {}
  get signal() { return this.controller.signal; }
  get aborted() { return this.controller.aborted; }
  onAbort(fn: () => void) { this.controller.onAbort(fn); }

  async write(event: SSEEvent): Promise<void> {
    this.controller.enqueue(formatSSE(event)); // only this line differs per writer
  }

  async consume(source): Promise<void> {
    const iterator = this.controller.normalize(source);
    for (;;) {
      const { done, value } = await iterator.next();
      if (done) return;
      await this.write({ data: value }); // SSE-specific mapping of a raw chunk
    }
  }
}
```

`TextStreamWriter` and `NDJSONStreamWriter` follow the identical pattern, differing only in `write()`'s one line and `consume()`'s per-chunk mapping. This is the de-duplication requested in review — abort/lifecycle logic exists exactly once, in `StreamController`.

---

## 6. `StreamAbortedError`

```typescript
export class StreamAbortedError extends Error {
  readonly name = 'StreamAbortedError';
  constructor() {
    super('Cannot write to stream: client has disconnected.');
  }
}
```

Thrown by `write()` and `consume()` on any of the three writers once the client has disconnected. This is a control-flow signal, not an HTTP error — the client is already gone, nothing gets sent to them.

### 6.1 Where it's caught

`ctx.stream()`/`ctx.sse()`/`ctx.ndjson()` catch `StreamAbortedError` internally, close the underlying stream cleanly, and return normally — a disconnect is an expected outcome, not a failure. It is never logged as an error and never re-thrown to the caller.

### 6.2 Every other error — propagation, and its real limits (v4 change)

Any error other than `StreamAbortedError` thrown inside the callback is **not** caught by a special second argument (v3's `onError` is removed). Instead:

1. `ctx.stream()` ensures the underlying HTTP stream is closed (never leaves a connection hanging open).
2. The error is then re-thrown out of the `await ctx.stream(...)` call, exactly like any other `await`ed call that throws.

```typescript
app.get('/report', async (ctx) => {
  try {
    await ctx.stream(async (writer) => {
      await writer.write('Generating report...\n');
      await generateReport(writer); // may throw
    });
  } catch (error) {
    // Ordinary try/catch — no second streaming-specific error API to learn.
    logger.error('report stream failed', error);
  }
});
```

Or, to write a final message *into* the stream before it closes (the pattern v3's `onError` existed for), do it with a normal `try/catch` **inside** the callback, where the writer is still live:

```typescript
app.post('/chat', async (ctx) => {
  await ctx.sse(async (writer) => {
    try {
      const completion = await openai.chat.completions.create(/* ... */, { signal: writer.signal });
      for await (const chunk of completion) {
        await writer.write({ data: chunk.choices[0]?.delta?.content ?? '' });
      }
    } catch (error) {
      await writer.write({ event: 'error', data: (error as Error).message });
    }
  });
});
```

**Honest caveat, stated rather than glossed over:** "propagates like a normal error" does not mean it behaves identically to an error thrown before any response was sent. By the time a stream has started, headers are already on the wire and some bytes may already be flushed. An `app.use(errorHandler)` middleware that expects to set `ctx.status`/`ctx.json(...)` on the way back up the middleware chain **cannot rewrite a response that has already started** — the same HTTP constraint that applies to `ctx.json()` after `ctx.send()` has already responded applies here too. A global error-handling middleware can still **observe and log** an error that propagated out of a streaming route handler; it cannot change what the client already received. This is why §6.2's second example — a `try/catch` *inside* the callback, writing a final SSE `error` event while the writer is still live — is the documented pattern for "the client should see that something went wrong," not a reliance on outer middleware.

---

## 7. Public API — Three Protocol-Specific Entry Points

```typescript
// ---- Shared writer capabilities (implemented once, via StreamController — §5) ----

export interface BaseStreamWriter {
  /** True once the client has disconnected. */
  readonly aborted: boolean;

  /** Fires when the client disconnects. Pass straight into AI SDKs' own abort options. */
  readonly signal: AbortSignal;

  /** Register a cleanup callback for client disconnect (e.g. cancel an upstream LLM call). */
  onAbort(fn: () => void): void;
}

// ---- ctx.stream() — raw text/bytes --------------------------------------

export interface TextStreamWriter extends BaseStreamWriter {
  /** Write text or bytes. Throws StreamAbortedError if the client has disconnected. */
  write(chunk: string | Uint8Array): Promise<void>;

  /** Consume an existing producer (AsyncIterable, ReadableStream, or Node Readable) as this response's body. */
  consume(source: AsyncIterable<string | Uint8Array> | ReadableStream<Uint8Array> | NodeJS.ReadableStream): Promise<void>;
}

// ---- ctx.sse() — Server-Sent Events -------------------------------------

export interface SSEEvent {
  data: string | unknown;
  event?: string;
  id?: string;
  retry?: number;
}

export interface SSEStreamWriter extends BaseStreamWriter {
  /** Write one Server-Sent Event. Framework handles all wire-format escaping. */
  write(event: SSEEvent): Promise<void>;

  /** Consume an existing producer; each yielded chunk becomes { data: chunk }. */
  consume(source: AsyncIterable<string | Uint8Array> | ReadableStream<Uint8Array> | NodeJS.ReadableStream): Promise<void>;
}

// ---- ctx.ndjson() — newline-delimited JSON ------------------------------

export interface NDJSONStreamWriter extends BaseStreamWriter {
  /** Write one JSON-serializable value as a line. */
  write(value: unknown): Promise<void>;

  /** Consume an existing producer of JSON-serializable values, one per line. */
  consume(source: AsyncIterable<unknown> | ReadableStream<unknown> | NodeJS.ReadableStream): Promise<void>;
}

// ---- Context extension ---------------------------------------------------

declare module '@nextrush/types' {
  interface Context {
    stream(run: (writer: TextStreamWriter) => Promise<void>): Promise<void>;
    sse(run: (writer: SSEStreamWriter) => Promise<void>): Promise<void>;
    ndjson(run: (writer: NDJSONStreamWriter) => Promise<void>): Promise<void>;
  }
}
```

No `ctx.stream.from()`, no second `onError` argument. One argument, one callback, one writer, per protocol.

**This is also the only calling convention.** There is no companion free-function export (e.g. `import { stream } from '@nextrush/stream'`) for application code to call as an alternative to `ctx.stream()`. Supporting both a `Context` method and a standalone import for the same capability would mean two ways to do the same thing with no clear reason to prefer one — exactly the kind of decision that's cheap to rule out now and expensive to walk back once handlers in the wild use both. `ctx.stream()`/`ctx.sse()`/`ctx.ndjson()` sit next to `ctx.json()`/`ctx.html()`/`ctx.redirect()` because streaming a response is the same category of action as sending one — it belongs on `Context`, full stop.

### 7.1 `consume()` naming (v4 change)

Named `consume()`, not `pipe()`. `pipe()` (as in Node's `Readable.pipe(dest)`) implies "forward my output elsewhere" — the opposite of what happens here. The writer is consuming an external producer (an AI SDK's token stream, a DB cursor, a file stream) and turning it into its own output. `consume()` names the actual direction of data flow.

### 7.2 One normalization path inside `consume()`

`consume()`'s public contract accepts three shapes (`AsyncIterable`, `ReadableStream`, Node `Readable`) because that's what real producers hand you — forcing callers to manually convert before calling `consume()` would just move the branching into user code. The fix is **where** the branching lives:

```typescript
// Internal to StreamController (§5) — never exported, never seen by handler authors.
function normalizeToAsyncIterator(
  source: AsyncIterable<unknown> | ReadableStream<unknown> | NodeJS.ReadableStream
): AsyncIterator<unknown> {
  if (Symbol.asyncIterator in source) {
    // Covers plain AsyncIterables AND Node Readable streams, which have
    // implemented Symbol.asyncIterator natively since Node 10.
    return (source as AsyncIterable<unknown>)[Symbol.asyncIterator]();
  }
  // Only a bare Web ReadableStream without native Symbol.asyncIterator needs
  // explicit adaptation via its reader.
  const reader = (source as ReadableStream<unknown>).getReader();
  return {
    async next() {
      const { done, value } = await reader.read();
      return done ? { done: true, value: undefined } : { done: false, value };
    },
    async return(value) {
      await reader.cancel();
      return { done: true, value };
    },
  };
}
```

Called exactly **once**, inside `StreamController.normalize()` (§5). Every writer's `consume()` is then a single loop over one shape — no `if/else if/else` chain appears anywhere else in the package.

---

## 8. Cancellation Semantics

```typescript
app.post('/chat', async (ctx) => {
  await ctx.sse(async (writer) => {
    const completion = await openai.chat.completions.create(
      { model: 'gpt-5', messages: ctx.body as ChatMessage[], stream: true },
      { signal: writer.signal }, // abort the OpenAI call the instant the client disconnects
    );
    for await (const chunk of completion) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) await writer.write({ data: token }); // throws StreamAbortedError if disconnected
    }
  });
});
```

- `writer.signal` — pass straight into any SDK's own abort option (OpenAI, LangChain, Vercel AI SDK all accept a standard `AbortSignal` already).
- `writer.write()`/`writer.consume()` throw `StreamAbortedError` the instant the client disconnects — a handler that ignores cancellation entirely still cannot produce a response that silently drops data.
- `writer.onAbort(fn)` covers cleanup that isn't naturally "the next write throws" — releasing a DB connection, decrementing a concurrency counter, calling `.abort()` on an object that doesn't accept a signal directly.

This is the direct fix for the cost-leak bug identified in the original audit: closing a chat tab now throws inside the handler's loop immediately, unwinding it and letting `writer.signal` (already passed into the SDK) cut off the upstream LLM request.

---

## 9. Examples

### 9.1 Plain text — zero options

```typescript
app.get('/progress', async (ctx) => {
  await ctx.stream(async (writer) => {
    await writer.write('Loading...\n');
    await writer.write('Processing...\n');
    await writer.write('Done.\n');
  });
});
```

### 9.2 SSE — LLM chat streaming

```typescript
app.post('/chat', async (ctx) => {
  await ctx.sse(async (writer) => {
    const completion = await openai.chat.completions.create(
      { model: 'gpt-5', messages: ctx.body as ChatMessage[], stream: true },
      { signal: writer.signal },
    );
    for await (const chunk of completion) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) await writer.write({ data: token });
    }
  });
});
```

### 9.3 SSE — consuming an existing AsyncIterable

```typescript
// LangChain — model.stream() already returns an AsyncIterable
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

### 9.4 NDJSON — agent tool-call trace

```typescript
app.post('/agent/trace', async (ctx) => {
  await ctx.ndjson(async (writer) => {
    await writer.write({ type: 'tool_call', name: 'search', args: { query: '...' } });
    const result = await runTool('search', { query: '...' });
    await writer.write({ type: 'tool_result', result });
    await writer.write({ type: 'final_answer', text: '...' });
  });
});
```

### 9.5 CSV export — plain backend use case, not AI-specific

```typescript
app.get('/export/csv', async (ctx) => {
  ctx.set('Content-Type', 'text/csv');
  await ctx.stream(async (writer) => {
    await writer.write('id,name\n');
    for (const user of await db.streamUsers()) {
      await writer.write(`${user.id},${user.name}\n`);
    }
  });
});
```

### 9.6 Error handling (v4 shape — see §6.2)

```typescript
app.get('/report', async (ctx) => {
  try {
    await ctx.stream(async (writer) => {
      await writer.write('Generating report...\n');
      await generateReport(writer);
    });
  } catch (error) {
    logger.error('report generation failed', error);
  }
});
```

---

## 10. Extensibility — Transform Pipelines (Not Built Now)

The design already leaves room for a future `.through()` without a breaking change, because `consume()` normalizes every source to one internal async-iterator shape (§7.2) *before* consuming it — `StreamController.normalize()` is already a distinct step from the loop that calls `write()` per chunk. A future addition would look like:

```typescript
// FUTURE — not part of this RFC's implementation scope
await ctx.sse(async (writer) => {
  await writer
    .from(ai.textStream)       // returns a chainable Pipeline, doesn't write yet
    .through(markdownParser)   // AsyncIterable<string> -> AsyncIterable<string>
    .through(filterReasoning)
    .consume();                 // now it writes
});
```

Not implemented in this RFC. Called out only to confirm the internal split (normalize → consume) doesn't need to be redesigned to support it later.

---

## 11. Implementation Plan (TDD, per `tdd-workflow.md`)

Package: `packages/stream/` — **core tier**, not a plugin (see §0 and §4a). Lives alongside `packages/core/`, `packages/router/`, `packages/runtime/`.

Per final review: build the foundation once, prove it's correct, then let every protocol writer be a thin, low-risk addition on top — not three parallel, independently-risky implementations. Five phases, in strict order; do not start a phase before the previous one's tests are green.

### Phase 1 — `StreamController` + Node adapter + `TextStreamWriter` + `ctx.stream()`

Everything else in the package depends on this phase being correct. Get backpressure, abort, and cross-runtime plumbing right here, on the simplest protocol (raw text/bytes), before any wire-format complexity (SSE framing, NDJSON) is layered on.

| Step | RED (failing test first) | GREEN (minimal impl) |
|---|---|---|
| 1 | `NodeContext.signal` fires an `AbortController` when `res.on('close')` fires | Wire existing close handler to also call `controller.abort()` |
| 2 | `Bun/Deno/EdgeContext.signal` return `request.signal` unchanged | One-line passthrough getter, ×3 adapters |
| 3 | `NodeContext.sendStream()` pipes a `ReadableStream<Uint8Array>` with backpressure, byte-identical to the existing `send()` Web-stream branch | Extract existing block into named method; `send()` delegates to it (behavior-preserving refactor — characterization test first per `code-structure.md`) |
| 4 | `Bun/Deno/EdgeContext.sendStream()` assigns to `_responseBuilder.body` | One-line delegation from existing `send()` branch |
| 5 | `StreamController.enqueue()` throws `StreamAbortedError` once aborted; otherwise forwards to the underlying `ReadableStreamDefaultController` | Implement per §5 |
| 6 | `StreamController.normalize()` handles `AsyncIterable`, Node `Readable`, and bare Web `ReadableStream` identically — same output sequence for equivalent input across all three shapes | Implement per §7.2, single function, single call site |
| 7 | `StreamController.onAbort(fn)` invoked exactly once when the signal fires, even if registered after the signal already fired | Registry via `signal.addEventListener('abort', fn, { once: true })` + immediate invoke-if-already-aborted check |
| 8 | `ctx.stream(callback)` constructs a `StreamController` + `TextStreamWriter`, calls the callback, closes the controller on return, and ships the result via `sendStream()` — proven on Node, Bun, Deno, **and** Edge before moving on | Wire `TextStreamWriter.write()` to `controller.enqueue(encode(chunk))` |
| 9 | `writer.write()` throws `StreamAbortedError` once aborted; `writer.consume()` throws mid-iteration on disconnect and calls `iterator.return()` for cleanup | Abort check + `finally` block calling `.return()` |
| 10 | If the callback throws a non-`StreamAbortedError`, the controller closes the stream cleanly and the error re-throws out of `await ctx.stream(...)` unchanged; if it throws `StreamAbortedError`, it is swallowed silently | try/finally + `instanceof StreamAbortedError` branch, no second callback |

**Exit criterion for Phase 1**: `ctx.stream()` is fully correct — including abort, backpressure, and cleanup — on all four adapters, with tests green. Do not begin Phase 2 until this is true.

### Phase 2 — `ctx.sse()` / `SSEStreamWriter`

Reuses `StreamController` entirely. The only new logic is wire-format framing.

| Step | RED | GREEN |
|---|---|---|
| 11 | `SSEStreamWriter.write(event)` frames per spec: multi-line `data:` escaping, `event:`/`id:`/`retry:` fields, blank-line terminator | Formatter function feeding `controller.enqueue()` |
| 12 | `SSEStreamWriter.consume(asyncIterable)` wraps each chunk as `{ data: chunk }` automatically | Thin mapping over the Phase 1 consume loop |
| 13 | `ctx.sse()` abort/error semantics are identical to `ctx.stream()`'s (Phase 1, step 10) — no protocol-specific divergence | Reuse, don't reimplement |

### Phase 3 — `ctx.ndjson()` / `NDJSONStreamWriter`

By this point, per review: "almost free."

| Step | RED | GREEN |
|---|---|---|
| 14 | `NDJSONStreamWriter.write(value)` emits `JSON.stringify(value) + '\n'` | Mapper feeding `controller.enqueue()` |
| 15 | `ctx.ndjson()` abort/error semantics identical to Phase 1 | Reuse, don't reimplement |

### Phase 4 — Cross-Adapter Integration Tests

| Step | RED | GREEN |
|---|---|---|
| 16 | Identical `ctx.sse(callback)` handler run against Node/Bun/Deno/Edge test harnesses produces byte-identical SSE output | N/A — proves design goal 3; this is a verification phase, not new implementation |
| 17 | Same cross-adapter parity check repeated for `ctx.stream()` and `ctx.ndjson()` | N/A |

### Phase 5 — Benchmarking

Not optional, and not deferred indefinitely — streaming performance claims should be measured before this ships as "production ready," consistent with the project's existing `apps/benchmark` methodology (README's wrk/autocannon benchmark suite).

| Step | Action |
|---|---|
| 18 | Add a streaming scenario to `apps/benchmark` (SSE token-stream, fixed chunk count/size) for NextRush, Hono, Express, and Fastify, run under the existing wrk/autocannon harness |
| 19 | Record results in the same format as the README's benchmark tables; investigate any regression relative to `ctx.send()`'s existing stream-piping performance before shipping |

Coverage target throughout: 90%+ per `v3-testing.instructions.md`, explicitly including write-after-abort throws (not silent), consume-aborted-mid-iteration cleanup, and the `StreamAbortedError`-is-swallowed-not-rethrown path.

---

## 12. Non-Goals (and Scope Discipline During Implementation)

- **No LLM SDK integration shipped in this package.**
- **No WebSocket overlap** — `@nextrush/websocket` covers bidirectional streaming; this is strictly server→client.
- **No server-side replay buffers for SSE reconnection.**
- **No options bag on `ctx.stream()`/`ctx.sse()`/`ctx.ndjson()` themselves** — header/content-type customization goes through `ctx.set()` before calling the streaming method.
- **No second error-handling callback** — one error-handling model: `try/catch`, same as everywhere else in NextRush.
- **`.through()` transform pipelines are not implemented in this RFC** (§10).
- **No compression, no custom encoders, no convenience helpers beyond what §7 specifies — not even ones that would be easy to add mid-build.** This is an explicit implementation-discipline rule, not just a documentation scope note: every one of the items above is a genuinely easy addition once `StreamController` exists, which is exactly why they're dangerous to add speculatively. Ship the foundation in §11's five phases; let real usage of `ctx.stream()`/`ctx.sse()`/`ctx.ndjson()` in the wild drive what v2 of this package actually needs, rather than guessing now.

---

## 13. Resolved Decisions

| Question | Resolution |
|---|---|
| Should `ctx.stream.from()` exist as a separate namespace? | **No.** Adapting an existing source happens via `writer.consume()` inside the callback. |
| Should the writer have one `write()` per format? | **No.** Three protocol-specific writers, each with a single `write()` whose parameter type is that protocol's native unit. |
| Should the source-adapting method branch on type inline, and what should it be called? | **No branching outside one function** (`StreamController.normalize()`, called once). **Named `consume()`, not `pipe()`** — the writer consumes an external producer; it does not forward its own output elsewhere. |
| Should `write()` silently no-op after abort? | **No.** Throws `StreamAbortedError`, caught and swallowed only at the top-level `ctx.stream()`/`ctx.sse()`/`ctx.ndjson()` boundary. |
| Should cancellation be exposed via `ctx.signal` or `writer.signal`? | **`writer.signal`.** `Context.signal` remains the `@internal` adapter primitive; never appears in public docs or examples. |
| Is `ctx.stream()`/`ctx.sse()`/`ctx.ndjson()` the only calling convention, or should a free-function import also exist? | **`Context` methods only** (v5 — see §7.1). No parallel `import { stream } from '@nextrush/stream'` API. |
| Is this a plugin (`packages/plugins/stream/`, ecosystem-tier versioning) or core (`packages/stream/`, lockstep versioning)? | **Core (v5 — corrected from v4's error).** It extends `Context` directly rather than registering via the `Plugin` interface/`install(app)`, and every adapter depends on it structurally (§4a) — the same relationship `core`/`router`/`runtime` already have to the adapters. Joins the lockstep versioning group; see §14 for the required follow-up. |
| Should there be a second `onError` callback argument? | **No (v4 change).** Removed. Non-abort errors propagate out of the `await ctx.stream(...)` call via ordinary `try/catch`; a handler that wants to write a final message into the stream does so with `try/catch` *inside* the callback, while the writer is still live (§6.2). This is one error-handling system, not two, and is honest about the real limit that a response already in flight cannot be rewritten by outer middleware — only observed/logged by it. |
| Should each writer implement its own lifecycle (abort/buffer/enqueue/close)? | **No.** A single internal `StreamController` (§5) owns lifecycle; `TextStreamWriter`/`SSEStreamWriter`/`NDJSONStreamWriter` are thin formatting wrappers differing only in `write()`'s encoding step and `consume()`'s per-chunk mapping. |

---

## 14. Required Follow-Up Action (out of scope for this document, tracked here so it isn't lost)

Reclassifying this package as core (§0, §13) has one consequence outside this RFC's own scope: `RFC-HYBRID-VERSIONING-AND-RELEASE-STRATEGY.md` (status: Implemented) defines the Changesets `fixed` lockstep group, and `@nextrush/stream` is not in it yet because that document predates this one.

**Before `@nextrush/stream` ships**, the following must be updated (separate change, not part of this RFC's implementation):

1. Add `@nextrush/stream` to the `fixed` group in `.changeset/config.json`, alongside `@nextrush/types`, `@nextrush/errors`, `@nextrush/core`, `@nextrush/router`, `@nextrush/runtime`, `@nextrush/di`, `@nextrush/decorators`, `@nextrush/controllers`, `@nextrush/adapter-node`, `nextrush`.
2. Add `@nextrush/stream` to the "Core (Lockstep)" package classification list in `RFC-HYBRID-VERSIONING-AND-RELEASE-STRATEGY.md` §3.1.
3. Confirm `@nextrush/adapter-bun`/`adapter-deno`/`adapter-edge` (independent/ecosystem tier, per that RFC's §3.2) declare their `@nextrush/stream` dependency the same way they already declare their `@nextrush/core` dependency — workspace range policy per that RFC's §5, since those three adapters are not part of the lockstep group themselves.

This is flagged as a required follow-up rather than edited directly here because it changes a separate, already-"Implemented" RFC and live release tooling (`.changeset/config.json`) — a distinct, reviewable change in its own right, not a byproduct of this document's edits.
