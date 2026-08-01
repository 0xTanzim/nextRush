# @nextrush/openapi

> Zero-config OpenAPI 3.1 document generation for NextRush -- reads route metadata your app already produces (validate() schemas, endpoint() docs) and serves it as JSON plus a Swagger UI page.

[![npm version](https://img.shields.io/npm/v/@nextrush/openapi.svg)](https://www.npmjs.com/package/@nextrush/openapi)
[![downloads](https://img.shields.io/npm/dm/@nextrush/openapi.svg)](https://www.npmjs.com/package/@nextrush/openapi)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/openapi.svg)](https://bundlephobia.com/package/@nextrush/openapi)
[![types](https://img.shields.io/npm/types/@nextrush/openapi.svg)](https://www.npmjs.com/package/@nextrush/openapi)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/openapi.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Generate an OpenAPI 3.1 document from a router's already-registered routes, cache it, and serve it plus a Swagger UI page |
| **Package type** | Middleware |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install. Not re-exported from `nextrush` or `nextrush/class`. |
| **Support tier** | Public -- middleware/registrar (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal -- Node, Bun, Deno, Edge (zero `node:` imports; reads route metadata already collected by the router and serves JSON/HTML) |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x |
| **Introduced** | v1.0.0 |

## Highlights

- Zero third-party runtime dependencies -- the only listed dependency is `@nextrush/types` (workspace, types only, erased at build)
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed, strict TypeScript, zero `any`
- Generates the document once, lazily, on the first request to the spec route, then serves a cached copy -- route dispatch never touches the generator

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Compatibility](#compatibility) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

Most OpenAPI tooling makes you describe your data twice: once for runtime request validation, once for the docs (a hand-written JSON Schema, a stack of `@ApiProperty()` decorators, a separately maintained YAML file). The two copies drift the moment someone updates one and forgets the other, and nothing catches the mismatch until a consumer's generated client breaks.

```ts
// TODAY, without this package -- looks fine, has a real gap:
router.post('/users', async (ctx) => {
  const body = CreateUserSchema.parse(ctx.body); // validated here
  // ...
});
// Separately, by hand, in an OpenAPI YAML file or a decorator:
//   requestBody: { schema: { type: 'object', properties: { name: ..., email: ... } } }
// Add a field to CreateUserSchema next sprint and this second copy silently
// goes stale -- nothing fails a build, nothing warns a reviewer.
```

NextRush's router already collects a `RouteDefinition` for every registered route -- the request/response schemas passed to `validate()`, the summary/description/tags passed to `endpoint()`. `@nextrush/openapi` reads that existing metadata instead of asking you to restate it.

## When to use

**Use `@nextrush/openapi` if:**

- You already use `@nextrush/validation`'s `validate()` for request schemas and want an OpenAPI document derived from them, not hand-written separately
- You want a `/docs` Swagger UI page and a `/openapi.json` spec with zero additional annotation beyond what `validate()`/`endpoint()` already capture
- You're using a schema library that implements Standard Schema and has a JSON Schema converter (Zod v4, Valibot) -- or you're willing to supply your own converter for another library

**Reach for something else if:**

- You want request/response validation itself -- that's [`@nextrush/validation`](../validation); this package only *reads* the schemas validation already captured, it does not validate anything
- You need the generated document to include a live `servers` URL for "try it out" tooling -- `generateDocument()` does not add one; supply that in your own tooling if needed
- You're on Zod 3.x and need typed (non-`{}`) request/response schemas in the spec -- see [Schema conversion](#schema-conversion-what-actually-runs) below

---

## Installation

```bash
pnpm add @nextrush/openapi
# npm i @nextrush/openapi . yarn add @nextrush/openapi . bun add @nextrush/openapi
```

> [!NOTE]
> `@nextrush/openapi` is not re-exported by the `nextrush` meta package -- install and import it
> directly, as shown above. `endpoint()`, used in the quick start below, *is* re-exported from
> `nextrush` (it comes from `@nextrush/router`, not from this package).

## Quick start

```ts
import { createApp, createRouter, endpoint, listen } from 'nextrush';
import { validate } from '@nextrush/validation';
import { openapi } from '@nextrush/openapi';
import { z } from 'zod';

const User = z.object({ name: z.string().min(1), email: z.string() });

const app = createApp();
const router = createRouter();

router.post(
  '/users',
  validate(User),
  endpoint({ summary: 'Create a user', responses: { 201: User } }),
  (ctx) => {
    ctx.status = 201;
    ctx.json(ctx.body);
  }
);

app.route('/', router);
app.use(openapi({ router }));

listen(app, 8080);
```

`GET /openapi.json` now returns an OpenAPI 3.1 document with `/users`'s `post` operation carrying the `User` schema as its request body and its `201` response -- generated from the exact same schema `validate()` enforces at runtime. `GET /docs` serves a Swagger UI page pointed at that spec.

## Capabilities

**Document generation**
- Reads `router.getRoutes()` -- the router's own projection of every registered route's `RouteDefinition` -- and builds one OpenAPI path item per route, one operation per HTTP method
- A route with no `validate()`/`endpoint()` metadata still appears in the spec as an untyped operation with a default `{ description: 'Response' }` -- nothing silently vanishes for lack of annotation
- A route registered with `router.all()` / `@All()` (an "any-method" row, flagged `isAnyMethod: true` on its `RouteDefinition`) is expanded into one operation for each of `get, post, put, delete, patch, head, options`, rather than emitting only the single method its `RouteDefinition.method` field happens to carry
- `:param` path segments become OpenAPI `{param}` segments (`/users/:id` -> `/users/{id}`), and are emitted as required `in: 'path'` parameters
- A `validate()` query schema is decomposed into individual `in: 'query'` parameters, one per top-level object property, with `required` following the schema's own `required` array
- A route with `endpoint({ visibility: 'internal' })` is omitted from the document entirely; so is any route whose path starts with a configured `exclude` prefix

**Caching and timing**
- The document is built exactly once per process, on the first `GET` request to the spec path -- not at middleware-registration time, not on every request -- so route/plugin registration order never affects what's captured
- Every subsequent request to the spec path returns the same cached object; the generator function is never re-invoked

**Docs UI**
- `GET /docs` (or your configured `docs` path) serves a minimal Swagger UI HTML page loaded from the `unpkg` CDN, pointed at the spec path

## Mental model

`openapi({ router })` returns middleware that intercepts exactly two paths and passes every other request through untouched. The document itself is built once, lazily, from whatever routes are registered on the router by the time the first spec request arrives.

```text
GET /openapi.json  --> middleware --> cached? --> yes: return cached document
                                            \--> no: generateDocument(router.getRoutes()) --> cache --> return

GET /docs          --> middleware --> Swagger UI HTML page (pointed at the spec path)

any other path     --> middleware --> next()  (never touched)
```

**Rule:** `generateDocument()` never runs on the request hot path for any route except the spec route itself, and even there it runs only once per process -- documenting your API costs nothing on every other request.

> [!TIP]
> The full route-metadata-to-document generation sequence, and exactly how each schema is
> converted, is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Serve the spec and docs UI with defaults

```ts
import { openapi } from '@nextrush/openapi';

app.use(openapi({ router })); // GET /openapi.json + GET /docs
```

### Customize info, paths, and exclusions

```ts
app.use(
  openapi({
    router,
    info: { title: 'My API', version: '2.1.0' },
    path: '/spec.json',
    docs: '/reference',
    exclude: ['/internal'],
  })
);
```

### Disable the docs UI but keep the JSON spec

```ts
app.use(openapi({ router, docs: false }));
```

### Gate exposure in production

```ts
app.use(
  openapi({
    router,
    enabled: process.env.NODE_ENV !== 'production',
  })
);
```

### Keep an internal route out of the spec

```ts
router.get(
  '/internal/metrics',
  endpoint({ visibility: 'internal' }),
  (ctx) => ctx.json(getMetrics())
);
```

### Supply your own schema converter

```ts
app.use(
  openapi({
    router,
    toJsonSchema: (schema) => myConverter(schema),
  })
);
```

## API overview

The sealed public surface (ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `openapi` | `(options: OpenApiOptions) => Middleware` | 1.0.0 | Stable | Creates the middleware. Serves the spec path and docs path, lazily generating and caching the document on first request. |
| `generateDocument` | `(routes: readonly RouteDefinition[], options: Pick<OpenApiOptions, 'info' \| 'exclude' \| 'toJsonSchema'>) => Promise<OpenApiDocument>` | 1.0.0 | Stable | The pure generator. Takes a route list directly -- no router coupling, no I/O. |
| `toOpenApiPath` | `(path: string) => string` | 1.0.0 | Stable | Converts a `:param` path pattern to OpenAPI's `{param}` form. |
| `extractPathParams` | `(path: string) => string[]` | 1.0.0 | Stable | Extracts path parameter names from a `:param` pattern. |
| `type OpenApiOptions` | `{ router, info?, path?, docs?, exclude?, enabled?, toJsonSchema? }` | 1.0.0 | Stable | Options for `openapi()`. |
| `type OpenApiInfo` | `{ title?, version?, description? }` | 1.0.0 | Stable | The document's `info` block. |
| `type OpenApiDocument` | `Record<string, unknown>` | 1.0.0 | Stable | A JSON-serializable OpenAPI document -- kept loose; validate with a real OpenAPI validator if you need strict conformance. |
| `type SchemaConverter` | `(schema: StandardSchemaV1) => unknown` | 1.0.0 | Stable | The shape of a custom `toJsonSchema` converter. May return a Promise. |

## Options

Every default below is read directly from `src/middleware.ts` and `src/types.ts`.

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `router` | `Pick<Router, 'getRoutes'>` | Yes | -- | No | The router whose routes to document -- the same router passed to `registerControllers`/`app.route()`. Only `getRoutes()` is read, and only lazily on the first spec request, never per request. |
| `info` | `OpenApiInfo` | No | `{ title: 'API', version: '1.0.0' }` | No | The document's `info` block. `description` is only included if provided. |
| `path` | `string` | No | `'/openapi.json'` | No | The exact-match path serving the generated JSON document. |
| `docs` | `string \| false` | No | `'/docs'` | No | The exact-match path serving the Swagger UI page, or `false` to disable it entirely. |
| `exclude` | `readonly string[]` | No | `undefined` | Yes | Path prefixes to omit from the document (prefix match via `String.startsWith`). |
| `enabled` | `boolean` | No | `true` | Yes | When `false`, the middleware calls `next()` unconditionally for every request -- neither the spec nor the docs UI is ever served. |
| `toJsonSchema` | `SchemaConverter` | No | vendor-dispatch (see [Schema conversion](#schema-conversion-what-actually-runs)) | No | Overrides how a Standard Schema is converted to JSON Schema. |

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
| Node.js >=22 | Yes | ESM-only |
| Bun / Deno / Edge | Yes / Yes / Yes | Zero `node:` imports -- the middleware only reads `router.getRoutes()` and serializes JSON/HTML; a dynamic `import()` of an optional schema-converter package (see below) is the only runtime-conditional code path, and it degrades safely everywhere it isn't resolvable |

**Integration**
- **Peer dependencies:** none required. Optional, dynamically imported at generation time if present: `zod` (`z.toJSONSchema`) and `@valibot/to-json-schema` -- neither is bundled or statically imported, so their absence never breaks generation.
- **Works with:** [`@nextrush/validation`](../validation)'s `validate()` (contributes `request` schemas) and `endpoint()` from `@nextrush/router`/`nextrush` (contributes `responses`/docs metadata) -- both write to the same `RouteDefinition` this package reads.
- **Incompatible with:** none.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Schema conversion -- what actually runs

There is no universal Standard Schema -> JSON Schema converter today, so the default converter (`defaultConvert`) dispatches on the schema's `~standard.vendor` field:

| Vendor | Converter used | How it's loaded |
| ------ | --------------- | ---------------- |
| `zod` | `zod`'s own `toJSONSchema` free function | `await import('zod')`, then `mod.toJSONSchema(schema)` |
| `valibot` | `@valibot/to-json-schema`'s `toJsonSchema` free function | `await import('@valibot/to-json-schema')`, then `mod.toJsonSchema(schema)` |
| `arktype` | The schema's own `.toJsonSchema()` method | Called directly on the schema object -- no import |
| anything else, or the converter package isn't installed | Falls back to `{}` (untyped) | The `import()`/method call is wrapped in a `try`/`catch`; a missing package or a vendor not in the dispatch table never throws, it just yields an untyped schema |
| `toJsonSchema` was supplied in options | That function, always -- the vendor dispatch above never runs | -- |

Both `zod` and `@valibot/to-json-schema` are loaded via a *variable* dynamic-import specifier specifically so neither is statically bundled into this package and neither package's absence is a hard failure -- generation degrades to an untyped schema for that route instead of throwing.

> [!IMPORTANT]
> **Zod note:** typed JSON Schema output requires **Zod v4**'s `z.toJSONSchema`. Zod 3.x
> implements Standard Schema (so `validate()` itself works against it), but has no
> `toJSONSchema` export -- its schemas render as `{}` (untyped) in the generated document unless
> you pass your own `toJsonSchema` converter.

---

## Troubleshooting

<details>
<summary><strong>A schema renders as `{}` (empty object) in the generated document</strong></summary>

**Cause:** either the schema's vendor isn't one of `zod`/`valibot`/`arktype`, or it is one of those but the matching converter package (`zod` v4+, `@valibot/to-json-schema`) isn't installed -- `defaultConvert` falls back to `{}` in both cases rather than failing generation. **Fix:** install the matching converter package, upgrade to Zod v4 if you're still on Zod 3.x, or pass your own `toJsonSchema` function in `openapi()`'s options.

</details>

<details>
<summary><strong>A route I registered doesn't appear in `/openapi.json`</strong></summary>

**Cause:** most commonly, the route's metadata has `visibility: 'internal'` (set via `endpoint({ visibility: 'internal' })`), or its path starts with a configured `exclude` prefix. **Fix:** remove the `visibility: 'internal'` marker if the route should be public, or check your `exclude` list for an overly broad prefix.

</details>

<details>
<summary><strong>Adding a route after the app has already served `/openapi.json` once doesn't show up</strong></summary>

**Cause:** the document is generated once, on the *first* request to the spec path, and cached in memory for the process's lifetime -- registering a route afterward does not invalidate that cache. **Fix:** register every route before the first request the spec path could plausibly receive (normal for a typical startup sequence); if you need the spec to reflect routes registered dynamically at runtime, restart the process, since there is no cache-invalidation API in this package.

</details>

<details>
<summary><strong>An any-method route (`router.all()` / `@All()`) shows up with 7 operations I didn't explicitly define</strong></summary>

**Cause:** this is intended -- a `RouteDefinition` with `isAnyMethod: true` represents one handler answering every standard HTTP method, so `generateDocument()` expands it into an operation for each of `get, post, put, delete, patch, head, options` rather than emitting only the single placeholder method the row's `.method` field carries. **Fix:** nothing to fix; if you want fewer methods documented, register the route with explicit per-method calls instead of `.all()`.

</details>

## FAQ

**Does this validate requests or responses?**
No. `@nextrush/openapi` only reads schemas that `@nextrush/validation`'s `validate()` already attached to a route's metadata; the actual runtime validation is `validate()`'s job, not this package's.

**Can I use this without `@nextrush/validation`?**
Yes -- `endpoint({ responses, summary, ... })` alone (from `@nextrush/router`/`nextrush`) is enough to document a route's responses and metadata, even with no request-body schema. A route with neither `validate()` nor `endpoint()` still appears in the spec, just untyped.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Yes -- the package has zero `node:` imports; it only reads `router.getRoutes()` and serializes the result. The optional `zod`/`@valibot/to-json-schema` dynamic imports work the same way everywhere `import()` is supported.

---

## Package relationships

```text
                   depends on            @nextrush/types  (Router / RouteDefinition / StandardSchemaV1 contracts, types only)
@nextrush/openapi -------------------->
                   reads metadata from   @nextrush/router  (RouteDefinition, via router.getRoutes())
                   often used with       @nextrush/validation  (validate() contributes the request schemas this package reads)
```

- **Depends on:** [`@nextrush/types`](../../types) -- `Router`/`RouteDefinition`/`StandardSchemaV1` contracts, types only, erased at build.
- **Reads metadata from:** [`@nextrush/router`](../../router) -- `router.getRoutes()` is this package's only I/O with the rest of the framework; `endpoint()` (re-exported from `nextrush`) also lives in `@nextrush/router`.
- **Often used with:** [`@nextrush/validation`](../validation) -- `validate()` is what actually populates the `request`/`responses` schemas this package renders.
- **Alternative:** none within NextRush for OpenAPI generation.

## Architecture

Maintaining or contributing to this package? The internal design -- the route-metadata-to-document
generation sequence, exactly how schema conversion is dispatched, and the decisions and
trade-offs behind them (with diagrams) -- is in **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**.

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
