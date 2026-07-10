---
title: Middleware & Extensions
type: topic
created: 2026-07-10
sources: [readme-2026-07-10]
tags: [middleware, extensions, packages]
---
# Middleware & Extensions

## Core (bundled in `nextrush`)
`@nextrush/core`, `@nextrush/router`, `@nextrush/adapter-node`, `@nextrush/types`, `@nextrush/errors`.

## Middleware (install separately, 11+ listed in README)
`@nextrush/body-parser`, `@nextrush/multipart`, `@nextrush/cors`, `@nextrush/helmet`, `@nextrush/csrf`, `@nextrush/rate-limit`, `@nextrush/compression`, `@nextrush/cookies`, `@nextrush/validation` (Standard Schema — Zod/Valibot/ArkType), `@nextrush/request-id`, `@nextrush/timer`.

Usage pattern:
```ts
app.use(helmet());
app.use(cors());
app.use(json()); // from @nextrush/body-parser
```

## Extensions (rare — ~0.1% of capability)
Long-lived, stateful services registered with `app.extend()`, booted at `app.ready()`. Only `@nextrush/events` (type-safe event emitter) and `@nextrush/websocket` qualify. Most capability should be middleware or a plain registrar function, not an Extension — Extension is reserved for things needing a boot/teardown lifecycle and app-attached state.

```ts
export function events<T extends EventMap>(): Extension<{ events: EventEmitter<T> }> {
  const emitter = new EventEmitter<T>();
  return {
    name: 'events',
    setup(ctx) { ctx.decorate('events', emitter); },
    destroy() { emitter.clear(); },
  };
}
// const app = createApp().extend(events()); await app.ready();
```

## More Middleware & Registrars
`@nextrush/static` (file serving), `@nextrush/template` (rendering), `@nextrush/logger` (structured logging), `@nextrush/stream` (SSE/NDJSON, built for AI/agentic apps), `@nextrush/openapi` (zero-config OpenAPI 3.1 from route metadata).

## Related
- [[topics/architecture]] — Plugin interface, Application lifecycle.
