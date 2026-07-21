# @nextrush/events

> Type-safe, async-ready event emitter for NextRush apps -- attach it once with `app.extend()` and get `app.events` everywhere, or use it standalone in any TypeScript project.

[![npm version](https://img.shields.io/npm/v/@nextrush/events.svg)](https://www.npmjs.com/package/@nextrush/events)
[![downloads](https://img.shields.io/npm/dm/@nextrush/events.svg)](https://www.npmjs.com/package/@nextrush/events)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/events.svg)](https://bundlephobia.com/package/@nextrush/events)
[![types](https://img.shields.io/npm/types/@nextrush/events.svg)](https://www.npmjs.com/package/@nextrush/events)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/events.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | A typed pub/sub event emitter, exposed on the app as `app.events` for decoupling side effects (welcome emails, cache invalidation, logging) from the handlers that trigger them |
| **Package type** | Extension |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install. Not re-exported from `nextrush` or `nextrush/class`. |
| **Support tier** | Public -- extensions (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Node.js, verified. Bun/Deno/edge are expected to work (no `node:` imports; core logic uses only `Map`, `Set`, `Promise`, `AggregateError`) but are not covered by a conformance test in this package -- see [Compatibility](#compatibility) |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x |
| **Introduced** | v1.0.0 |

## Highlights

- Zero runtime dependencies -- `@nextrush/core` is an optional peer, needed only because `events()`'s return type references the `Extension`/`ExtensionContext` interfaces declared in `@nextrush/types` (re-exported by `@nextrush/core`)
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed, strict TypeScript, zero `any` -- `app.events` is inferred from `events<T>()`'s generic with no `declare module` augmentation
- Async-native `emit()` -- returns a `Promise` that resolves once every handler (sync or async) has settled

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Compatibility](#compatibility) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

A route handler that creates a user often needs to trigger things that aren't the handler's job: send a welcome email, warm a cache, write an audit log, notify another service. The obvious approach is to call all of it inline -- and now the handler owns four unrelated responsibilities, a slow mail API blocks the response, and every new side effect means editing a handler that has nothing to do with mail.

```ts
// TODAY, without an event bus -- the handler owns everything:
router.post('/users', async (ctx) => {
  const user = await db.users.create(ctx.body);
  await mailer.sendWelcomeEmail(user);   // now the handler knows about email
  await cache.invalidate('users:list');  // ...and caching
  await audit.log('user.created', user); // ...and auditing
  ctx.json(user);
});
```

`@nextrush/events` decouples the "what happened" from the "what to do about it" -- the handler emits one typed event; anything that cares subscribes independently, anywhere in the app.

## When to use

**Use `@nextrush/events` if:**

- You want to decouple side effects (email, cache invalidation, logging, webhooks) from the handler that triggers them
- You want full TypeScript autocomplete on event names and payloads, inferred straight from `app.events`
- You're building a standalone library or writing tests and want a typed pub/sub primitive with no framework dependency

**Reach for something else if:**

- You need cross-process or cross-service messaging -- this emitter is in-process, in-memory only; reach for a real message broker (a queue, Redis pub/sub, etc.) for that
- You need guaranteed delivery, retries, or persistence -- a dropped process loses every pending handler invocation; this package has no durability story
- You want request/response middleware behavior (`ctx.next()`, short-circuiting) -- that's what [`app.use()`](../../core) is for; an Extension like this one is for long-lived, app-scoped services, not per-request logic

---

## Installation

```bash
pnpm add @nextrush/events
# npm i @nextrush/events . yarn add @nextrush/events . bun add @nextrush/events
```

> [!NOTE]
> `@nextrush/events` is not re-exported by the `nextrush` meta package -- install and import it
> directly, as shown above.

## Quick start

`events()` is a NextRush **Extension**, not middleware -- register it with `app.extend()`, then
call `app.ready()` once before handling traffic (adapters do this automatically when you call
`listen()`).

```ts
import { createApp, listen } from 'nextrush';
import { events } from '@nextrush/events';

interface AppEvents {
  'user:created': { id: string; name: string };
}

const app = createApp().extend(events<AppEvents>());
await app.ready();

app.events.on('user:created', (data) => {
  console.log('User created:', data.name);
});

app.use(async (ctx) => {
  await app.events.emit('user:created', { id: '1', name: 'Alice' });
  ctx.json({ ok: true });
});

listen(app, 8080);
```

`app.events` is inferred as `EventEmitter<AppEvents>` straight from the `events<AppEvents>()` call passed to `extend()` -- no `declare module` augmentation, no manual cast.

## Capabilities

**Event emitter**
- `on` / `once` / `off` -- standard subscribe/unsubscribe, each `on`/`once` returning an `Unsubscribe` function as an alternative to calling `off` by hand
- `prepend` / `prependOnce` -- subscribe at the front of the handler list, for a handler (e.g. validation) that must run before everything already registered
- Wildcard subscriptions -- `'*'` receives every event as `{ event, data }`; a `'prefix:*'` pattern receives every event starting with `prefix:` the same way
- `emit()` is `async` -- runs every matching handler (direct, wildcard, pattern) concurrently via `Promise.allSettled` and resolves once they've all settled

**Error handling**
- Error isolation (default) -- one handler throwing never stops the others; the error goes to `onError` if supplied, otherwise `console.error` outside test env
- Strict mode (`errorIsolation: false`) -- every handler still runs, but `emit()` rejects with an `AggregateError` collecting every thrown error once all handlers have settled

**Safety**
- Event names are validated: non-empty string, <=256 chars, or `emit`/`on`/etc. throw `TypeError`/`RangeError`
- `once` handlers are removed synchronously before execution, so concurrent `emit()` calls never invoke a `once` handler more than once
- `maxListeners` (default 10) logs a console warning past the threshold, to catch a likely leak -- it never throws or drops a handler

**Developer experience**
- Fully typed -- event names and payloads are checked against the `EventMap` generic
- Standalone-usable via `createEvents()` -- no NextRush app required, e.g. for tests or non-NextRush libraries

## Mental model

`events()` returns an Extension. `app.extend()` queues it; `app.ready()` runs its `setup()` once, which decorates the app with `app.events` (or a custom property name). `app.close()` runs `destroy()`, clearing every handler.

```text
app.extend(events<T>())  --> queued
app.ready()              --> setup(ctx): ctx.decorate('events', emitter)  --> app.events is live
app.events.emit(name, data)
     |
     +--> direct handlers for `name`
     +--> wildcard handlers on '*'                 (payload: { event, data })
     +--> pattern handlers on 'prefix:*' matching   (payload: { event, data })
     |
     +--> Promise.allSettled(all matched handlers) --> emit() resolves
app.close()               --> destroy(): emitter.clear()
```

**Rule:** `emit()` never rejects because a handler threw, unless you opt into `errorIsolation: false` -- by default, a broken handler is isolated, logged, and every other handler still runs.

> [!TIP]
> The full setup -> emit -> dispatch sequence and the extension boot/teardown lifecycle (both as
> diagrams) are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Attach to the app and use directly

```ts
import { createApp, listen } from 'nextrush';
import { events } from '@nextrush/events';

const app = createApp().extend(events());
await app.ready();

app.events.emit('user:created', { id: '1', name: 'Alice' });
```

### Type every event up front

```ts
interface AppEvents {
  'user:created': { id: string; name: string };
  'user:deleted': { id: string };
  'order:placed': { orderId: string; total: number };
}

const app = createApp().extend(events<AppEvents>());
await app.ready();

app.events.on('user:deleted', ({ id }) => console.log(id)); // autocompletes `id`
```

### Use standalone, without a NextRush app

```ts
import { createEvents } from '@nextrush/events';

const bus = createEvents<{ 'app:ready': undefined }>();
bus.on('app:ready', () => console.log('ready'));
await bus.emit('app:ready', undefined);
```

### Subscribe to a whole category of events

```ts
app.events.on('user:*', ({ event, data }) => {
  console.log(`User event: ${event}`, data);
});

app.events.emit('user:created', data); // matches
app.events.emit('order:placed', data);  // does not match
```

### Run a handler before everything else already registered

```ts
app.events.prepend('user:created', (data) => {
  validateUserData(data); // runs first, regardless of registration order
});
```

### Collect every handler error instead of isolating them

```ts
const bus = createEvents({ errorIsolation: false });
bus.on('test', () => { throw new Error('one'); });
bus.on('test', () => { throw new Error('two'); });

try {
  await bus.emit('test', {});
} catch (err) {
  if (err instanceof AggregateError) {
    console.log(err.errors.length); // 2
  }
}
```

## API overview

The sealed public surface (ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `events` | `<T extends EventMap>(options?: EventsOptions) => Extension<{ events: EventEmitter<T> }>` | 1.0.0 | Stable | The Extension factory -- primary usage. Decorates the app with `app.events` (or a custom property name) at `app.ready()`. |
| `createEvents` | `<T extends EventMap>(options?: EventEmitterOptions) => EventEmitter<T>` | 1.0.0 | Stable | Standalone emitter factory -- no app required. |
| `EventEmitter` | `class EventEmitter<T> implements TypedEventEmitter<T>` | 1.0.0 | Stable | The concrete emitter class returned by both factories above. |
| `VERSION` | `string` | 1.0.0 | Stable | The package's build-time version string. |
| `DEFAULT_EMITTER_OPTIONS` | `{ maxListeners: 10, errorIsolation: true }` | 1.0.0 | Stable | The emitter's default options. |
| `MAX_EVENT_NAME_LENGTH` | `256` | 1.0.0 | Stable | The maximum allowed event-name length. |
| `VALID_PROPERTY_NAME` | `RegExp` | 1.0.0 | Stable | The identifier pattern `events()`'s `propertyName` option is validated against. |
| `type WithEvents<T>` | `{ events: EventEmitter<T> }` | 1.0.0 | Stable | Type helper for functions that accept an app decorated with `app.events` under a custom property name. |
| `type TypedEventEmitter<T>` | -- | 1.0.0 | Stable | The emitter interface (`on`, `once`, `off`, `emit`, `listenerCount`, `clear`, `eventNames`, `listeners`, `hasListeners`, `setMaxListeners`, `getMaxListeners`). |
| `type EventMap` / `EventNames<T>` / `EventHandler<T>` / `Unsubscribe` / `EventEmitterOptions` / `EventsOptions` | -- | 1.0.0 | Stable | Supporting types for defining and consuming typed events. |

## Options

Every default below is read directly from `src/types.ts` and `src/index.ts`.

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `maxListeners` | `number` | No | `10` | No | Warn via `console.warn` once an event's listener count exceeds this. `0` disables the warning entirely -- it never blocks a subscription. |
| `errorIsolation` | `boolean` | No | `true` | No | `true`: one handler's error never stops the others. `false`: every handler still runs, but `emit()` rejects with an `AggregateError` collecting every thrown error. |
| `onError` | `(error: Error, eventName: string) => void` | No | `undefined` | No | Called for each isolated error when `errorIsolation` is `true`. If omitted, the error is logged with `console.error` (skipped when `NODE_ENV === 'test'`). |
| `propertyName` | `string` (Extension only, via `EventsOptions`) | No | `'events'` | Yes | The app property `events()` decorates. Validated against `VALID_PROPERTY_NAME` (`/^[a-zA-Z_$][a-zA-Z0-9_$]*$/`); an invalid value throws `TypeError` at `events()` call time, before `app.extend()` even runs. |

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
| Node.js >=22 | Yes | ESM-only; the package's test suite runs on Node |
| Bun / Deno / Edge | Expected, not conformance-tested | No `node:` imports and no `@nextrush/core` hard dependency, so nothing in the emitter's public API is Node-specific. One defensive check inside `executeHandler()`'s error-logging path reads the bare global `process` (`typeof process === 'undefined' || process.env.NODE_ENV !== 'test'`) to suppress `console.error` noise during this package's own Node-based test run -- it degrades safely (falls through to logging) if `process` is absent, but it means the emitter is not built from *only* `Map`/`Set`/`Promise`/`AggregateError` as earlier drafts of this doc claimed. No conformance suite in this package exercises Bun/Deno/edge; treat "supported" here as "no known blocker," not a tested guarantee. |

**Integration**
- **Peer dependencies:** `@nextrush/core` -- optional (needed only because `events()`'s return type references the `Extension`/`ExtensionContext` interfaces, which are declared in `@nextrush/types` and re-exported by `@nextrush/core`; `createEvents()` and the standalone `EventEmitter` class have no such dependency at all).
- **Works with:** any NextRush app created via `createApp()`, through `app.extend(events())`.
- **Incompatible with:** none.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Why an Extension, not middleware

Most NextRush capabilities are middleware (`app.use()`) -- request-scoped, run per request, composed in order. `events()` is one of the rare Extensions (per the taxonomy in `@nextrush/core`'s docs) because it is a long-lived, app-scoped service: it attaches state to the app once (`app.events`) and must tear that state down cleanly on shutdown (clearing every handler), the same shape a database connection pool or a websocket attach uses. Registering it with `app.use()` instead of `app.extend()` would not compile -- `use()` expects a `Middleware` function, not an `Extension` object.

## Troubleshooting

<details>
<summary><strong><code>app.events</code> is <code>undefined</code> or throws "not a function"</strong></summary>

**Cause:** `app.ready()` was never called (or not yet awaited) -- `setup()`, which decorates the app with `app.events`, only runs at `app.ready()`, not at `app.extend()` time. **Fix:** `await app.ready()` before touching `app.events`; `listen()` from an adapter calls it for you, but standalone `Application` usage does not.

</details>

<details>
<summary><strong>A handler I registered with <code>once</code> ran more than once</strong></summary>

**Cause:** unlikely with this emitter -- `once` handlers are removed from the handler set synchronously, before any handler executes, specifically so concurrent `emit()` calls can't race past the removal. If you're seeing this, check whether you registered the handler twice (once per `on`/`once` call is a separate subscription; call `off`/the returned `Unsubscribe` to remove one). **Fix:** log `listenerCount(eventName)` before emitting to confirm how many subscriptions actually exist.

</details>

<details>
<summary><strong><code>events({ propertyName: '...' })</code> throws a <code>TypeError</code></strong></summary>

**Cause:** the supplied `propertyName` isn't a valid JavaScript identifier (checked against `VALID_PROPERTY_NAME`) -- e.g. it contains a dash, starts with a digit, or is an empty string. **Fix:** use an identifier-safe name (`bus`, `$events`, `_events`); the default `'events'` always works.

</details>

<details>
<summary><strong>Console warning: "Event '...' has N listeners. This might indicate a memory leak."</strong></summary>

**Cause:** more than `maxListeners` (default 10) handlers are registered on one event -- often from re-registering the same handler in a loop or on every request instead of once at startup. **Fix:** move the `on()` call out of the hot path, or call `setMaxListeners()`/pass `{ maxListeners: 0 }` if the count is genuinely expected.

</details>

## FAQ

**Can I use this without `nextrush`?**
Yes -- `createEvents()` and the `EventEmitter` class have no dependency on any NextRush package; only the `events()` Extension factory's return type references the `Extension`/`ExtensionContext` types, which are declared in `@nextrush/types` and re-exported by `@nextrush/core` (an optional peer dependency).

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Expected to, but not conformance-tested by this package. There are no `node:` imports and no hard dependency on `@nextrush/core`, so nothing in the public API is Node-specific -- but one internal error-logging check reads the bare `process` global defensively (see [Compatibility](#compatibility)), and no test in this package runs against Bun/Deno/edge to confirm behavior there.

**Does `emit()` wait for async handlers to finish?**
Yes -- `emit()` collects a promise per matched handler and `await`s `Promise.allSettled(...)` before resolving, regardless of whether a given handler is sync or async.

---

## Package relationships

```text
                   peer depends on (optional, types only)   @nextrush/core  (re-exports Extension / ExtensionContext from @nextrush/types)
@nextrush/events -------------------------------------------------------------->
                   often used with                          @nextrush/class  (services emitting events from controllers)
```

- **Depends on:** none at the runtime-dependency level; `@nextrush/core` is an optional peer, used only because `events()`'s return type references the `Extension`/`ExtensionContext` types (declared in `@nextrush/types`, re-exported by `@nextrush/core`).
- **Often used with:** [`@nextrush/class`](../../class) -- a `@Service` or controller can hold a reference to `app.events` (via constructor/`@Ctx` access) and emit domain events from business logic.
- **Alternative:** `createEvents()` (this same package) for anyone who wants the emitter without the Extension wrapper -- there's no separate package for that.

## Architecture

Maintaining or contributing to this package? The internal design -- the emit-to-dispatch sequence,
the extension boot/teardown lifecycle, and the decisions and trade-offs behind them (with
diagrams) -- is in **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**.

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
