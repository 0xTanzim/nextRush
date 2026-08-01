# Streaming (`@nextrush/stream`)

Server→client streaming with cancellation. Works on Node, Bun, Deno, Edge (byte-identical via each adapter's `ctx.sendStream`).

## When to use

- LLM token streams (SSE)
- Agent traces / logs as NDJSON
- Chunked text downloads

## When NOT to use

- Bidirectional sockets → `@nextrush/websocket` (Node) or platform WS
- You only need one JSON blob → `ctx.json`

## Context API

```typescript
// Plain text stream
await ctx.stream(async (writer) => {
  await writer.write('hello ');
  await writer.write('world');
});

// Server-Sent Events (sets Content-Type: text/event-stream, Cache-Control: no-cache)
await ctx.sse(async (writer) => {
  await writer.write({ data: 'token', event: 'token', id: '1' });
  await writer.write({ data: '[DONE]', event: 'done' });
});

// Newline-delimited JSON
await ctx.ndjson(async (writer) => {
  await writer.write({ step: 'plan', ok: true });
  await writer.write({ step: 'act', ok: true });
});

// Raw bytes
await ctx.sendStream(myReadableStream);
```

## LLM chat pattern

```typescript
app.post('/chat', async (ctx) => {
  await ctx.sse(async (writer) => {
    const completion = await openai.chat.completions.create(
      { model: 'gpt-4o', messages: ctx.body as ChatMessage[], stream: true },
      { signal: writer.signal } // abort upstream when client disconnects
    );
    for await (const chunk of completion) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) await writer.write({ data: token });
    }
  });
});
```

## Cancellation

- `writer.signal` / `ctx.signal` abort on client disconnect and adapter timeout
- Always pass `signal` into upstream fetch/SDK calls
- On error inside the runner, stream errors cleanly — do not leave the client hanging

## Headers

Content-Type and framing are fixed per protocol. Call `ctx.set(...)` **before** `ctx.sse`/`ndjson`/`stream` for extra headers.

## Standalone (no full nextrush)

```typescript
import { runSSEStream, runNDJSONStream, runTextStream } from '@nextrush/stream';
// against any StreamCapableContext { signal, set, sendStream }
```

## Lambda streaming

Use `createLambdaStreamingHandler(app)` from `@nextrush/adapter-serverless` with Function URL `RESPONSE_STREAM` mode so chunks flush instead of buffering.
