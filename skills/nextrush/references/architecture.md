# Architecture Overview

## Package hierarchy

```
@nextrush/types          # contracts only
@nextrush/errors
@nextrush/runtime        # WebContextBase, detection, body/IP helpers
@nextrush/stream         # stream runners (injected into context)
@nextrush/router
@nextrush/core           # Application, compose
@nextrush/di  →  @nextrush/class
adapters/*               # node bun deno edge serverless nextjs
middleware/*
extensions/*             # websocket events
nextrush                 # opinionated functional meta-package
```

Dependency direction flows **down** toward types/runtime. Core never imports adapters.

## Application responsibilities

- Own middleware stack (`compose`)
- Own router (or accept injected)
- Optional container hook for class path
- `handle(Request) → Response` for adapters
- Lifecycle: boot / ready / close

## Request lifecycle

```
Adapter receives host request
  → builds Context (WebContextBase subclass)
  → Application dispatches middleware chain
      errorHandler (outer)
      … cross-cutting middleware …
      router match
        → route middleware
        → [class] guards → interceptors → controller method → filters
        → [functional] handlers
  → Context builds Web Response
  → Adapter returns host response
```

Errors throw upward; outermost `errorHandler` maps to JSON status responses.

## Dual paradigm

| | Functional | Class |
|--|------------|-------|
| Entry | `nextrush` | `nextrush` + `nextrush/class` |
| Routing | `router.get` / `app.get` | `@Controller` + `@Get` |
| DI | none by default | `@Service` + constructor inject |
| Registration | imperative | `registerControllers` / `registerModule` |
| Cost | minimal deps | reflect-metadata + DI |

Both can share one `Application` and one router (playground does).

## Context design

`WebContextBase` implements the Fetch-shaped context:

- Parses URL/query/headers once
- Lazy `raw` handles
- Combined abort signal (client + timeout)
- Stream runners injected (core does not import stream package)
- `platform` optional (edge/serverless)

Adapters only differ in: IP resolution, runtime id, `sendStream` plumbing, host bootstrap.

## Adapter contract

Every adapter must:

1. Convert host request → Web `Request` (or already is)
2. Run `app.callback()(ctx)` — the composed middleware + routing + error pipeline
3. Convert Web `Response` → host response
4. Pass conformance suite (`packages/adapters/conformance`)

Observable behavior must match across adapters.

## Extension model

Extensions (`app.extend(...)`) attach long-lived capabilities (websocket server, event bus) and hook dispose into `app.close()`.

## Edge-first philosophy

Node is the **extra capabilities** case (filesystem, WS library, long process). Baseline features must work on Fetch hosts. Features that cannot → document as Node-only (websocket package).
