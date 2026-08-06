# Extensions

Extensions are the rare, long-lived runtime services that must attach state to the app, run
async boot, and/or tear down on shutdown — an event bus, a database pool, a websocket attach.
Most framework features are **middleware** (`app.use`) or plain **registrar** functions (like
`registerControllers`); reach for an extension only when you need app-scoped state or a
lifecycle.

## When to use an extension

| Need | Use |
| ---- | --- |
| Per-request logic | Middleware (`app.use`) |
| Register routes/controllers once | A registrar function |
| Attach `app.something`, async boot, or shutdown cleanup | An Extension |

Extensions are rare because they mutate the app and own a lifecycle — each one is a commitment.

## Shape of an extension

```ts
import type { Extension } from '@nextrush/types';

export function events(): Extension<{ events: EventEmitter }> {
  const emitter = new EventEmitter();
  return {
    name: 'events',                     // unique — used for collision detection
    needs: ['logger'],                  // optional: extensions that must be registered first
    setup(ctx) {
      ctx.decorate('events', emitter);  // attach app.events
    },
    destroy() {
      emitter.clear();                  // run at app.close()
    },
  };
}
```

`setup(ctx)` receives an `ExtensionContext` — not the raw app, so future fields are additive:

| Field | Meaning |
| ----- | ------- |
| `app` | The application (add middleware, read decorations) |
| `logger` | The app's structured logger |
| `container` | The app's DI container, if one was configured (`nextrush/class` or `createApp({ container })`) |
| `env` | `development` / `production` / `test` |
| `name` | This extension's own name |
| `decorate(name, value)` | Attach a value to the app under `name`; throws on collision with a core `Application` member |

## Lifecycle

- `app.extend(extension)` — **queues** the extension. No setup runs yet.
- `app.ready()` — runs every queued `setup` once, **in registration order**. Assertions for
  `needs` happen here (asserted, not auto-sorted).
- `app.close()` — runs `destroy` for every extension, **in reverse registration order**.

```ts
const app = createApp()
  .extend(events())
  .extend(pool());

await app.ready();      // setups run: events, then pool
// ... serve requests ...
await app.close();      // destroys run: pool, then events
```

## Typed decorations

The generic `Extension<TDecorated>` carries the shape `setup` attaches through the type system —
`app.events` is inferred with no `declare module` augmentation:

```ts
const app = createApp().extend(events<MyEvents>());
await app.ready();
app.events.emit('user:login', { userId: '1' }); // typed
```

Two caveats worth knowing:

- **TypeScript trusts `TDecorated`, it never verifies it.** If `setup` doesn't actually
  `decorate`, `app.foo` is `undefined` at runtime with no warning. Keep the generic and the
  `decorate()` call in sync by hand.
- **The inferred type is lost on `let` reassignment.** Chain in one expression —
  `const app = createApp().extend(x)` — not `let app = ...; app = app.extend(x)`.

## Real example: the events extension

`@nextrush/events` ships as an extension. `app.extend(events())` attaches `app.events`, a typed
async emitter:

```ts
import { createApp } from '@nextrush/core';
import { events } from '@nextrush/events';

const app = createApp().extend(events());
await app.ready();

app.events.on('user:created', (data) => console.log('User:', data));
app.events.emit('user:created', { id: '1', name: 'Alice' });
```

The same package exports `createEvents()` for standalone/test use with no app at all.

## Errors teach

`decorate()` throws if the name is already decorated or collides with a core `Application`
member, so two extensions can't silently fight over `app.events`. `app.extend()` queues in
order, and `app.ready()` runs in that order — swap the registration order to change boot order.

## Next steps

- [Dependency Injection](Dependency-Injection) — the container `ExtensionContext` may expose
- [Middleware](Middleware) — the per-request alternative to extensions
- [Architecture](Architecture) — where extensions sit in the app lifecycle
- Extensions concept guide: https://0xtanzim.github.io/nextRush/docs/concepts/extensions
- Events reference: https://0xtanzim.github.io/nextRush/docs/reference/events
