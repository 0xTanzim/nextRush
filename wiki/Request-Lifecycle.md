# Request lifecycle

How a request flows through NextRush from entry point to response, showing where plugins and middleware run.

---

## Complete flow

```mermaid
sequenceDiagram
  participant Client
  participant Adapter as Adapter<br/>Node/Bun/Deno
  participant App as Application
  participant Plugin as Plugins
  participant MW as Middleware<br/>Stack
  participant Router as Router
  participant Handler as Handler

  Client->>Adapter: HTTP request
  Adapter->>App: build Context

  App->>Plugin: extendContext (all plugins)
  App->>Plugin: onRequest (all plugins)

  App->>MW: start middleware chain
  loop Middleware
    MW->>MW: run, await next()
  end

  MW->>Router: match route
  Router->>Handler: invoke handler
  Handler->>Handler: return data or throw

  alt No error
    Handler->>App: result
    App->>Plugin: onResponse (all plugins, reverse)
    App->>Adapter: serialize response
  else Error thrown
    Handler->>App: error
    App->>Plugin: onError (all plugins, reverse)
    App->>App: error handler
    App->>Adapter: serialize error response
  end

  Adapter->>Client: HTTP response
  Plugin->>Plugin: (cleanup on app.close)
```

---

## Timing breakdown

| Stage | Time | Responsibility |
|-------|------|-----------------|
| **Adapter creates Context** | < 1ms | Platform → normalized context |
| **extendContext hooks** | < 1ms | Plugins add custom fields |
| **onRequest hooks** | < 1ms | Plugins observe/mutate pre-chain |
| **Middleware chain** | 1–100ms | Auth, parsing, logging, validation |
| **Route matching** | < 0.1ms | Router lookup (trie) |
| **Handler** | 5–5000ms | Business logic, DB calls, etc. |
| **onResponse / onError** | < 1ms | Plugins observe/cleanup |
| **Serialize & send** | < 1ms | Platform adapts, sends wire bytes |

Handler execution dominates; middleware contributes when parsing large bodies or calling external services.

---

## Error propagation

Errors from middleware or handlers bubble up, skipping remaining middleware:

```mermaid
flowchart LR
  M1["Auth middleware"]
  M2["Body parser"]
  H["Handler"]
  ERR["Error thrown"]
  EH["Global error handler"]

  M1 --> M2 --> H
  H -->|throw| ERR -->|skip rest| EH
```

If middleware throws before calling `next()`, downstream never runs. If middleware throws in cleanup (after `next()`), it still propagates.

---

## State sharing

`ctx.state` is the pass-through for middleware ↔ middleware and middleware ↔ handler:

```mermaid
flowchart LR
  MW1["Request ID middleware<br/>ctx.state.id = uuid()"]
  MW2["Auth middleware<br/>ctx.state.user = verifyToken()"]
  H["Handler<br/>read ctx.state.id<br/>read ctx.state.user"]

  MW1 --> MW2 --> H
```

Never rely on closure or global state; **use** `ctx.state`.

---

## Multi-runtime adaptation

Each platform (Node, Bun, Deno, Edge) has an adapter that translates HTTP into this common pipeline. Core application code stays platform-agnostic:

```mermaid
flowchart TD
  Node["Node.js<br/>IncomingMessage<br/>ServerResponse"]
  Bun["Bun<br/>Request<br/>Response"]
  Deno["Deno<br/>Request<br/>context"]
  Edge["Edge<br/>fetch"]

  Node -->|adapter| Common["Common Context"]
  Bun -->|adapter| Common
  Deno -->|adapter| Common
  Edge -->|adapter| Common

  Common --> App["App logic<br/>middleware/handlers"]
  App --> Serialize["Serialize response"]
  Serialize --> Node
  Serialize --> Bun
  Serialize --> Deno
  Serialize --> Edge
```

You choose the adapter at entry (`listen`, `serve`, `toFetchHandler`); the rest of your code works unchanged.

---

## Performance considerations

- **Middleware order matters** — security/auth before body parsing before routes.
- **Short middleware** — defer heavy work to handlers; middleware runs on every request.
- **Avoid closures in hot paths** — declare middleware outside request loop.
- **Use streaming** for large responses — don't buffer in `ctx.json()`.

See the docs **[Performance](https://0xtanzim.github.io/nextRush/docs/performance)** section for tuning strategies.
