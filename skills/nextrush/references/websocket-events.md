# WebSocket & Events

## WebSocket — `@nextrush/websocket` (Node only)

### When to use

- Chat, live notifications, rooms on a **Node** NextRush process
- Origin checks, connection limits, heartbeats wanted out of the box

### When NOT to use

- Bun / Deno / Edge → platform native WebSocket or SSE (`@nextrush/stream`)
- Cross-replica fanout → add Redis/NATS pubsub yourself; this package is single-process

### Recommended: Extension form

```typescript
import { createApp, listen } from 'nextrush';
import { createWebSocketExtension } from '@nextrush/websocket';

const app = createApp().extend(createWebSocketExtension());
await app.ready();

app.wss.on('/chat', (conn) => {
  conn.join('general');
  conn.on('message', (msg) => {
    conn.broadcast('general', msg);
  });
  conn.on('close', () => {
    /* cleanup */
  });
});

app.use(app.wss.upgrade()); // registers upgrade middleware (required)
const { server } = await listen(app, 8080);
await app.wss.attach(server); // wires httpServer 'upgrade' — WITHOUT THIS, NOTHING WORKS

// app.close() also closes wss (heartbeat + sockets)
```

### Manual form

```typescript
import { createWebSocket } from '@nextrush/websocket';
const wss = createWebSocket({ /* options */ });
// same: upgrade + attach; call wss.close() yourself on shutdown
```

### Mental model

```
createWebSocket / Extension
  → app.use(wss.upgrade())   // type-level middleware registration
  → wss.attach(httpServer)   // REAL upgrade wiring
  → path match → origin → limits → verifyClient → Connection → route handler
```

### Common tasks

```typescript
// Rooms
conn.join('room-a');
conn.leave('room-a');
conn.broadcast('room-a', { type: 'ping' });

// Auth before accept
createWebSocket({
  verifyClient: (info) => info.req.headers['authorization'] === 'Bearer secret',
});

// Origin allowlist
createWebSocket({ origins: ['https://app.example.com'] });

// Middleware before every WS handler
wss.use(async (conn, next) => {
  // ...
  await next();
});
```

---

## Events — `@nextrush/events`

In-process typed event bus as a NextRush **Extension** (not middleware).

### Quick start

```typescript
import { createApp } from 'nextrush';
import { createEventsExtension } from '@nextrush/events';

type AppEvents = {
  'user.created': { id: string; email: string };
  'order.paid': { orderId: string; cents: number };
};

const app = createApp().extend(createEventsExtension<AppEvents>());
await app.ready();

app.events.on('user.created', async (payload) => {
  await sendWelcomeEmail(payload.email);
});

app.post('/users', async (ctx) => {
  const user = await createUser(ctx.body);
  await app.events.emit('user.created', user);
  ctx.status = 201;
  ctx.json(user);
});
```

### Patterns

- Category subscribe / wildcards (see package README for exact API)
- `prepend` listener for high-priority handlers
- Collect handler errors vs isolate (options)
- Standalone bus without an app (factory export)

### Why Extension not middleware

Events are app lifecycle concerns, not per-request middleware. Extension attaches `app.events` and participates in shutdown cleanly.

### Multi-process

This bus is **in-process only**. For multi-instance, emit to a real broker and have each instance subscribe.
