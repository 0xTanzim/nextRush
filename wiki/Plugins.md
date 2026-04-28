# Plugins

Plugins extend the application without changing core. They implement a lifecycle interface and hook into key moments: after app initialization, before/after request handling, and on errors.

---

## Plugin interface

```typescript
import type { Plugin, Application, Context } from 'nextrush';

const myPlugin: Plugin = {
  name: 'my-plugin',
  install(app: Application) {
    // runs once during app setup
    app.use(/* middleware */);
  },
};

app.plugin(myPlugin);
```

---

## Full lifecycle: `PluginWithHooks`

```mermaid
sequenceDiagram
  participant A as App
  participant P as Plugin
  participant MW as Middleware
  participant H as Handler

  A->>P: install(app)
  A->>P: extendContext(ctx) — per request
  P->>MW: extend ctx with custom fields
  A->>P: onRequest(ctx)
  A->>MW: middleware chain
  MW->>H: handler
  A->>P: onResponse(ctx)
  A->>P: onError(error, ctx) — if throws
  A->>P: destroy() — on app.close()
```

```typescript
import type { PluginWithHooks, Context } from 'nextrush';

const telemetryPlugin: PluginWithHooks = {
  name: 'telemetry',

  install(app) {
    // global middleware
    app.use(async (ctx, next) => {
      await next();
    });
  },

  extendContext(ctx: Context) {
    // add fields to every context
    ctx.state.traceId = crypto.randomUUID();
  },

  async onRequest(ctx: Context) {
    // before middleware chain
    console.log('request started', ctx.path);
  },

  async onResponse(ctx: Context) {
    // after middleware chain completes
    console.log('response status', ctx.status);
  },

  async onError(error: Error, ctx: Context) {
    // error in middleware or handler
    console.error('error caught', error.message);
  },

  destroy() {
    // cleanup when app.close() is called
  },
};

app.plugin(telemetryPlugin);
```

---

## Hook execution order

```mermaid
flowchart TD
  Start["Request arrives"]
  Ext["extendContext<br/>(all plugins in order)"]
  OnReq["onRequest<br/>(all plugins in order)"]
  MW["Middleware chain"]
  H["Handler"]
  OnResp["onResponse<br/>(all plugins, reverse order)"]
  End["Response sent"]

  Err["Error thrown"]
  OnErr["onError<br/>(all plugins, reverse order)"]

  Start --> Ext --> OnReq --> MW --> H
  H --> OnResp --> End
  H -.->|throw| Err --> OnErr -.-> End
  MW -.->|throw| Err
```

---

## Check for plugin presence

```typescript
if (app.hasPlugin('my-plugin')) {
  const plugin = app.getPlugin('my-plugin');
}
```

Use this when plugins need to integrate with optional peers (for example a logger plugin that auto-integrates with a database plugin if present).

---

## Built-in plugins

See the **[Packages](Packages)** page and **[plugins section](https://0xtanzim.github.io/nextRush/docs/api-reference/plugins)** on the docs site for the full list: controllers, logger, static files, WebSocket, template engines, events.

---

## Plugin errors

Errors thrown during `install`, hook execution, or `destroy` propagate and must be handled by the caller. No automatic recovery.

```typescript
try {
  await app.plugin(databasePlugin({ uri: '...' }));
} catch (error) {
  console.error('Plugin initialization failed:', error);
  process.exit(1);
}
```
