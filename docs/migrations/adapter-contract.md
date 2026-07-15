# Migration — Enforced Adapter Contract

**Who this affects:** authors of a NextRush **adapter** (a package that turns a runtime's
request/response into a NextRush `Context` pipeline). **Application developers are not affected** —
the change is additive at the app level; your `createApp()`, routes, and middleware are unchanged.

Ratified in ADR-0007 (`RFC-NEXTRUSH-ADAPTER-CONTRACT`).

## What changed

`@nextrush/types` now exports the two adapter contracts and a shared context-factory type:

- `ServerAdapter<App, Opts, Instance>` — long-lived server runtimes (`serve()` → handle).
- `FetchAdapter<App, Exec>` — request/response runtimes (`createFetchHandler()` → `(req) => res`).
- `AdapterContextFactory<Args, Ctx>` — the "build a `Context`, then run `app.callback()`" invariant.

Each built-in adapter (`node`, `bun`, `deno`, `edge`) now carries a compile-time conformance guard,
so a drift in its handler shape or context-factory return type stops compiling. The
`AdapterContextFactory` type is **additive** — the existing `ServerAdapter`/`FetchAdapter` shapes
are unchanged.

## If you author an adapter

Add the guard(s) so your adapter is checked against the shared contract. Nothing else changes.

**Before** — an informal fetch adapter:

```ts
export function createFetchHandler(app: Application, options?: MyOptions) {
  return (request: Request) => runContext(app, request, options);
}
```

**After** — the same code, plus a compile-time guard:

```ts
import type { FetchAdapter, AdapterContextFactory } from '@nextrush/types';

export function createFetchHandler(app: Application, options?: MyOptions) {
  return (request: Request) => runContext(app, request, options);
}

// Stops compiling if the exported shape drifts from the contract.
const _conformance: FetchAdapter<Application, MyExecContext> = { createFetchHandler };
void _conformance;

// If you build a Context via a factory, prove its return type too:
const _ctxFactory: AdapterContextFactory<[Request], MyContext> = createMyContext;
void _ctxFactory;
```

Server-tier adapters use `ServerAdapter<...>` with a `serve` guard instead.

## Codemod

**None is provided — the change is additive, so no mechanical transform applies.** Adding the guard
is a one-time, per-adapter manual step (two lines). Scaffolding a *new* adapter already emits the
guard for you:

```bash
nextrush generate adapter my-runtime
```

## Verify

Run the shared conformance suite against your adapter (it certifies identical observable behavior
to the built-in adapters):

```ts
import { describe } from 'vitest';
import { defineConformanceSuite, type ConformanceDriver } from '@nextrush/adapter-conformance';

const myDriver: ConformanceDriver = { name: 'my-runtime', /* ... */ };
describe('my-runtime conformance', () => defineConformanceSuite(myDriver));
```
