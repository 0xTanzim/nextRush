# @nextrush/types

> The shared TypeScript contracts every NextRush package is built on — `Context`, `Middleware`, the router, DI, extension, adapter, runtime, and streaming shapes — with zero runtime dependencies.

[![npm version](https://img.shields.io/npm/v/@nextrush/types.svg)](https://www.npmjs.com/package/@nextrush/types)
[![downloads](https://img.shields.io/npm/dm/@nextrush/types.svg)](https://www.npmjs.com/package/@nextrush/types)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/types.svg)](https://bundlephobia.com/package/@nextrush/types)
[![types](https://img.shields.io/npm/types/@nextrush/types.svg)](https://www.npmjs.com/package/@nextrush/types)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/types.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | The single source of truth for NextRush's cross-package TypeScript contracts (`Context`, `Middleware`, `Router`, `Container`, `Extension`, adapter/runtime/stream shapes) |
| **Package type** | Core |
| **Status** | Stable ✅ |
| **Included in `nextrush`?** | ✅ Yes — the contracts reach app code transitively (`createApp()` returns a typed `Context`). Install directly only when authoring a package that needs the shapes without a heavier dependency. |
| **Support tier** | Public — core (stable, semver-guarded) — see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal — Node · Bun · Deno · Edge |
| **Requires** | Node `>=22` · ESM-only · TypeScript `>=5.x` |
| **Introduced** | `v3.0.0` |

## Highlights

- ✅ **Zero runtime dependencies** — the root of the package graph; it imports nothing
- ✅ **Near-zero runtime footprint** — only four constant value exports (`HTTP_METHODS`, `HttpStatus`, `ContentType`, `ROUTE_METADATA`); every other export is a type, erased at build
- ✅ **ESM-only**, tree-shakable, side-effect-free (`"sideEffects": false`)
- ✅ **Fully typed** — strict TypeScript, zero `any`; structural stream interfaces avoid coupling to any runtime
- 📦 **Bundle:** ~1 KB min+gzip (the four constants)

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) · [When to use](#when-to-use) · [Installation](#installation) · [Quick start](#quick-start) · [Capabilities](#capabilities) · [Mental model](#mental-model) · [Common tasks](#common-tasks) · [API overview](#api-overview) · [Options](#options) · [Compatibility](#compatibility) · [Troubleshooting](#troubleshooting) · [FAQ](#faq) · [Package relationships](#package-relationships) · [Architecture](#architecture) · [Resources](#resources)

</details>

---

## The problem

In a 30+ package framework, the same `Context` object is read by the core middleware engine, populated by the router, extended by adapters, and consumed by every piece of middleware. If each package declared its own version of that shape, they would drift, packages would import each other only to borrow a type, and the dependency graph would grow cycles.

```ts
// TODAY, without a shared contract package — each layer redeclares the shape,
// and the definitions drift the moment one changes:

// in @nextrush/router
interface Context { params: Record<string, string>; /* … */ }

// in a middleware package
interface Context { params: object; body: any; /* … slightly different, and now `any` leaked */ }

// the router imports the middleware package (or vice versa) solely to reuse a type → a cycle waiting to happen
```

`@nextrush/types` fixes this by owning the contracts in one place, at the bottom of the package hierarchy. Every higher package imports the *same* `Context`, `Middleware`, and `Router` shapes; nothing has to import sideways to share a type; and because the package sits below everything else, it can never introduce a cycle.

## When to use

`@nextrush/types` is the foundation layer — you consume its contracts constantly, usually without importing it by name. `createApp()` already hands you a typed `Context`, and `nextrush` / `@nextrush/core` re-export the everyday shapes.

**Use `@nextrush/types` if:**

- ✓ You're authoring a NextRush **package, adapter, or middleware** and need the shared `Context` / `Middleware` / `Router` / `Container` contracts without pulling in a heavier package
- ✓ You're building an **adapter** and need the `ServerAdapter` / `FetchAdapter` / `AdapterContext` conformance shapes
- ✓ You're writing a **framework-agnostic** utility that should type against the contract, not a concrete implementation
- ✓ You want the runtime constants `HttpStatus`, `HTTP_METHODS`, `ContentType`, or the `ROUTE_METADATA` symbol

**Reach for something else if:**

- ✗ You're building an application — you already get these types through [`nextrush`](../nextrush) / [`@nextrush/core`](../core); you rarely import from here directly
- ✗ You need HTTP **error classes** → use [`@nextrush/errors`](../errors) (it depends on these types)
- ✗ You need the router **implementation**, not its interface → use [`@nextrush/router`](../router)

---

## Installation

```bash
pnpm add @nextrush/types
# npm i @nextrush/types · yarn add @nextrush/types · bun add @nextrush/types
```

> [!NOTE]
> Already using `nextrush`? The contracts you touch daily — `Context`, `Middleware`, `HttpStatus`,
> and friends — are reachable transitively; `createApp()` returns a typed `Context` without a direct
> import. Install `@nextrush/types` only when you're authoring a package/adapter/middleware and want
> to depend on the contract explicitly.

## Quick start

```ts
import type { Context, Middleware } from '@nextrush/types';
import { HttpStatus } from '@nextrush/types';

// A framework-agnostic middleware typed against the shared contract.
// It reads and writes the SAME Context every NextRush package agrees on.
export const requestId: Middleware = async (ctx: Context, next) => {
  ctx.set('X-Request-Id', crypto.randomUUID());
  await next();
  if (!ctx.responded) {
    ctx.status = HttpStatus.NO_CONTENT; // 204, from the shared constant
  }
};
```

`Middleware` is imported with `import type` (it's erased at build); `HttpStatus` is a real value, so it's a plain `import`. That split — types versus the handful of runtime constants — is the whole shape of this package.

## Capabilities

**Request/response contracts**
- **`Context`** — the unified request/response object (`method`, `url`, `path`, `query`, `params`, `body`, `headers`, `ip`, plus `json()`/`send()`/`html()`/`redirect()`, `throw()`/`assert()`, `set()`/`get()`, `next()`, `state`, `raw`, `runtime`, `bodySource`, and `stream()`/`sse()`/`ndjson()`)
- **`Middleware` / `Next` / `RouteHandler`** — Koa-style middleware supporting both `(ctx)` and `(ctx, next)` signatures
- **HTTP primitives** — `HttpMethod`, `HttpStatus`, `ContentType`, `IncomingHeaders`, `OutgoingHeaders`, `ParsedBody`, `ResponseBody`, `RawHttp`

**Framework contracts**
- **Router** — `Router`, `Route`, `RouteMatch`, `RouterOptions`, `RoutePattern`, `RouteParam`
- **Route metadata** — `RouteDefinition`, `RouteMetadata`, `RouteEntry`, and the `ROUTE_METADATA` contribution symbol (the source of truth for OpenAPI and future renderers)
- **Dependency injection** — `Container`, `Provider`, `Scope`, `Token`, `ServiceOptions` (the contract `@nextrush/di` implements)
- **Extensions** — `Extension`, `ExtensionContext`, `ExtensionHost` (the rare long-lived-service model)
- **Adapters** — `ServerAdapter`, `FetchAdapter`, `AdapterContext`, `FetchContext`, `ServerAddress`, `ServerHandle`
- **Runtime & streaming** — `Runtime`, `RuntimeCapabilities`, `BodySource`, and the `TextStreamWriter` / `SSEStreamWriter` / `NDJSONStreamWriter` shapes
- **Standard Schema** — `StandardSchemaV1` (a vendored, dependency-free copy of the [Standard Schema](https://github.com/standard-schema/standard-schema) v1 contract) so Zod / Valibot / ArkType schemas are accepted structurally

**Developer experience**
- **Runtime-independent** — no `node:*`, no runtime globals; structural `NodeStreamLike` / `WebStreamLike` interfaces stand in for platform stream types
- **Fully typed** — strict TypeScript, zero `any`; tree-shakable and side-effect-free

## Mental model

`@nextrush/types` is a **dictionary of shapes**, not a library of behavior. It defines what a request, a route, a container, or an adapter *looks like*; every other package agrees to those shapes and provides the behavior.

```text
                 ┌─ HTTP primitives   (method · status · headers · body)
@nextrush/types ─┼─ Context contract  ──▶ read by every handler & middleware
 (shared shapes) ├─ Router / metadata contracts
                 ├─ DI · Extension · Logger contracts
                 └─ Adapter · Runtime · Stream contracts
        │
        └─ imported by every package · imports nothing itself (the graph root)
```

**Rule:** a contract shared by two or more packages lives here; a shape used by exactly one package stays in that package. This is the one place allowed to be depended on by everything and to depend on nothing.

> [!TIP]
> How these contracts relate, and why `types` sits at the bottom of the hierarchy (with Mermaid
> diagrams), is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Type a middleware or route handler

```ts
import type { Context, Middleware, RouteHandler } from '@nextrush/types';

// Both signatures are valid — `ctx.next()` (modern) or the `next` parameter (traditional).
const logger: Middleware = async (ctx, next) => {
  const start = Date.now();
  await next();
  ctx.state.tookMs = Date.now() - start;
};

const getUser: RouteHandler = (ctx: Context) => {
  ctx.json({ id: ctx.params.id });
};
```

### Use the HTTP constants and their value types

```ts
import { HttpStatus, HTTP_METHODS, ContentType } from '@nextrush/types';
import type { HttpStatusCode, HttpMethod, ContentTypeValue } from '@nextrush/types';

const status: HttpStatusCode = HttpStatus.CREATED;       // 201
const ct: ContentTypeValue = ContentType.JSON;           // 'application/json'

// HTTP_METHODS is a readonly tuple for iteration.
// Note: TRACE and CONNECT are in the `HttpMethod` type but intentionally
// excluded from this tuple (XST risk / proxy-only).
for (const method of HTTP_METHODS) {
  const m: HttpMethod = method; // 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
}
```

### Type an extension (long-lived app-scoped service)

```ts
import type { Extension, ExtensionContext } from '@nextrush/types';

// The optional generic carries the decorated shape so `app.<name>` infers.
export function clock(): Extension<{ now: () => number }> {
  return {
    name: 'clock',
    setup(ctx: ExtensionContext) {
      ctx.decorate('now', () => Date.now()); // throws on name collision
    },
    destroy() {
      /* runs in reverse order at app.close() */
    },
  };
}
```

### Accept any Standard Schema validator without an adapter

```ts
import type { StandardSchemaV1, InferOutput } from '@nextrush/types';

// Works with Zod 3.24+, Valibot 1.0+, ArkType 2.0+ — anything exposing `~standard`.
async function parse<S extends StandardSchemaV1>(
  schema: S,
  input: unknown,
): Promise<InferOutput<S>> {
  const result = await schema['~standard'].validate(input);
  if (result.issues) throw new Error(result.issues[0]?.message);
  return result.value as InferOutput<S>;
}
```

### Type an adapter against the conformance contract

```ts
import type { ServerAdapter, ServerHandle } from '@nextrush/types';

// `satisfies` pins the shape so `serve`/`createHandler` can't drift across adapters.
const nodeAdapter = {
  async serve(app, options) {
    /* … */ return {} as ServerHandle;
  },
  createHandler(app, options) {
    /* … */ return () => {};
  },
} satisfies ServerAdapter;
```

## API overview

Only four exports carry a runtime value; every other export is a **type** (erased at build). The sealed surface (ADR-0005):

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `HttpStatus` | `Readonly<Record<string, number>>` | `3.0.0` | Stable ✅ | Named HTTP status codes (`HttpStatus.OK` → `200`). |
| `HTTP_METHODS` | `readonly HttpMethod[]` | `3.0.0` | Stable ✅ | Iterable tuple of routable methods (excludes `TRACE`/`CONNECT`). |
| `ContentType` | `Readonly<Record<string, string>>` | `3.0.0` | Stable ✅ | Common content-type strings (`ContentType.JSON`). |
| `ROUTE_METADATA` | `unique symbol` | `3.1.0` | Stable ✅ | `Symbol.for('nextrush.route.metadata')` — the route-metadata contribution key. |

### Type exports by domain

Grouped by the module that owns them (all `import type`).

| Domain | Exports |
| ------ | ------- |
| **Context** (`context.ts`) | `Context` · `ContextOptions` · `ContextState` · `RouteParams` · `QueryParams` · `Middleware` · `Next` · `RouteHandler` |
| **HTTP** (`http.ts`) | `HttpMethod` · `CommonHttpMethod` · `HttpStatusCode` · `ContentTypeValue` · `IncomingHeaders` · `OutgoingHeaders` · `ParsedBody` · `ResponseBody` · `RawHttp` · `NodeStreamLike` · `WebStreamLike` |
| **Router** (`router.ts`) | `Router` · `Route` · `RouteMatch` · `RouterOptions` · `RoutePattern` · `RouteParam` |
| **Route metadata** (`route-metadata.ts`) | `RouteDefinition` · `RouteMetadata` · `RouteEntry` · `RouteMetaMarker` · `MetadataContribution` |
| **DI** (`container.ts`) | `Container` · `Provider` · `ClassProvider` · `FactoryProvider` · `ValueProvider` · `Constructor` · `Token` · `Scope` · `ServiceOptions` · `RegisterOptions` |
| **Extensions** (`extension.ts`) | `Extension` · `ExtensionContext` · `ExtensionHost` |
| **Adapters** (`adapter.ts`, `adapter-context.ts`) | `ServerAdapter` · `FetchAdapter` · `FetchHandler` · `HandlerOptions` · `FetchHandlerOptions` · `ServerAddress` · `ServerHandle` · `AdapterContext` · `FetchContext` · `AdapterContextFactory` |
| **Runtime** (`runtime.ts`) | `Runtime` · `RuntimeInfo` · `RuntimeCapabilities` · `BodySource` · `BodySourceOptions` |
| **Streaming** (`stream.ts`) | `SSEEvent` · `BaseStreamWriter` · `TextStreamWriter` · `SSEStreamWriter` · `NDJSONStreamWriter` · `StreamSource` · `StreamRun` |
| **Standard Schema** (`standard-schema.ts`) | `StandardSchemaV1` · `StandardSchemaProps` · `StandardSchemaResult` · `StandardSchemaIssue` · `StandardSchemaPathSegment` · `InferOutput` |
| **Logger** (`logger.ts`) | `Logger` |

## Options

No configuration — `@nextrush/types` exports only type declarations and four constants. There is nothing to instantiate or configure; you import a contract and type against it.

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | `3.x` |
| Node.js | `>=22` |
| TypeScript | `>=5.x` |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js `>=22` | ✅ | ESM-only |
| Bun / Deno / Edge | ✅ / ✅ / ✅ | Contracts are compile-time; the only runtime values are plain constants. Stream types are structural (`NodeStreamLike` / `WebStreamLike`), so no runtime is coupled in. |

**Integration**
- **Peer dependencies:** none — this is the root of the package graph.
- **Works with:** every `@nextrush/*` package (they all depend on it) and any Standard Schema validator (Zod / Valibot / ArkType) structurally.
- **Incompatible with:** none.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** — no CommonJS build. On Node `>=22`, CommonJS consumers can
> `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>"<code>HttpStatus</code> cannot be used as a value because it was imported using <code>import type</code>"</strong></summary>

**Cause:** `HttpStatus`, `HTTP_METHODS`, `ContentType`, and `ROUTE_METADATA` are runtime **values**, not types — with `verbatimModuleSyntax`, `import type` erases them. **Fix:** import the four constants with a plain `import`, and everything else with `import type`.

```ts
import { HttpStatus, HTTP_METHODS, ContentType, ROUTE_METADATA } from '@nextrush/types';
import type { Context, Middleware, Router } from '@nextrush/types';
```

</details>

<details>
<summary><strong>My function isn't accepted where a <code>Middleware</code> is expected</strong></summary>

**Cause:** `Middleware` is `(ctx: Context, next: Next) => void | Promise<void>`. A handler returning a value (e.g. `(ctx) => ctx.json(...)` where `json` returns non-`void`) or one with an incompatible `next` still fits, but returning a truthy value from a synchronous handler can mismatch. **Fix:** type the function *as* `Middleware`/`RouteHandler` so inference flows from the contract, and use `async` when awaiting `next()`.

```ts
const mw: Middleware = async (ctx, next) => { await next(); };
```

</details>

<details>
<summary><strong>My Zod / Valibot schema isn't accepted as <code>StandardSchemaV1</code></strong></summary>

**Cause:** the Standard Schema contract requires the `~standard` property, which older validator versions don't expose. **Fix:** use a version that implements Standard Schema v1 — Zod `3.24+`, Valibot `1.0+`, or ArkType `2.0+`. No adapter is needed; conformance is structural.

</details>

<details>
<summary><strong>"Cannot find module '@nextrush/types' or its corresponding type declarations"</strong></summary>

**Cause:** the package is ESM-only and ships `.d.ts` from `dist`; a `moduleResolution` that predates `node16`/`nodenext`/`bundler` won't resolve its `exports` map. **Fix:** set `"moduleResolution": "nodenext"` (or `"bundler"`) and `"module": "nodenext"` in `tsconfig.json`, on Node `>=22`.

</details>

## FAQ

**Do I need to install `@nextrush/types` directly?**
Usually no. Application code gets `Context`, `Middleware`, and the HTTP constants transitively through `nextrush` / `@nextrush/core`. Install it directly only when you author a package, adapter, or middleware that should depend on the contracts explicitly.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun, Deno, and Edge?**
Yes. The contracts are compile-time and the only runtime values are plain constant objects and one symbol. Platform stream types are represented structurally (`NodeStreamLike` / `WebStreamLike`), so nothing runtime-specific is imported.

**Is this really "zero runtime"?**
Zero runtime *dependencies* — yes, always. Zero runtime *code* — almost: it ships four constant value exports (`HttpStatus`, `HTTP_METHODS`, `ContentType`, `ROUTE_METADATA`, ~1 KB gzipped). Every interface and type alias is erased at build.

---

## Package relationships

```text
                 depends on          (nothing — root of the graph, zero dependencies)
@nextrush/types ─────────────▶
                 depended on by      @nextrush/errors · core · router · runtime · di · class · adapter-* · middleware
                 satisfied by        Zod · Valibot · ArkType   (structurally, via StandardSchemaV1)
```

- **Depends on:** nothing — `@nextrush/types` is the lowest layer and imports no other package (project-rules §1).
- **Depended on by:** [`@nextrush/errors`](../errors), [`@nextrush/core`](../core), [`@nextrush/router`](../router), [`@nextrush/runtime`](../runtime), [`@nextrush/di`](../di), [`@nextrush/class`](../class), the adapters, and the middleware packages — they all import the same contracts from here.
- **Satisfied by:** any [Standard Schema](https://github.com/standard-schema/standard-schema) validator (Zod / Valibot / ArkType) conforms to `StandardSchemaV1` structurally, with no adapter.
- **Alternative:** none — these are the framework's contracts.

## Architecture

Maintaining or contributing to this package? The internal design — how the contracts are grouped
across modules, how `Context` composes the HTTP / runtime / stream types, why `types` sits at the
bottom of the hierarchy, and the architectural invariants that keep it dependency-free (with
diagrams) — is in **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**. Design history:
[ADR-0005 (package tiers & sealed surface)](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md).

## Resources

- 📖 **Learn** — [Documentation](https://0xtanzim.github.io/nextRush/docs) · [Architecture](./ARCHITECTURE.md) · [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- 📝 **Changelog** — [CHANGELOG.md](./CHANGELOG.md)
- 🐛 **Report an issue** — [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- 🤝 **Contribute** — [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT © [Tanzim Hossain](https://github.com/0xTanzim)
