# @nextrush/validation

> Request validation for NextRush -- bring your own Standard Schema library (Zod, Valibot, ArkType) and get one consistent, secure error shape for the body, query, and route params.

[![npm version](https://img.shields.io/npm/v/@nextrush/validation.svg)](https://www.npmjs.com/package/@nextrush/validation)
[![downloads](https://img.shields.io/npm/dm/@nextrush/validation.svg)](https://www.npmjs.com/package/@nextrush/validation)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/validation.svg)](https://bundlephobia.com/package/@nextrush/validation)
[![types](https://img.shields.io/npm/types/@nextrush/validation.svg)](https://www.npmjs.com/package/@nextrush/validation)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/validation.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Validate the request body, query, and route params against any Standard Schema (Zod, Valibot, ArkType) with one middleware call -- integration-tested against Zod |
| **Package type** | Middleware |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install. Not re-exported from `nextrush` or `nextrush/class`. |
| **Support tier** | Public -- middleware/registrar (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal -- Node, Bun, Deno, Edge (zero `node:` imports) |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x |
| **Introduced** | v1.0.0 |

## Highlights

- Zero runtime dependencies (types-only dependencies on `@nextrush/types` and `@nextrush/errors`, erased at build) -- no schema library is bundled or required as a dependency
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed, strict TypeScript, zero `any`
- Works with any [Standard Schema](https://standardschema.dev) library -- structurally compatible with Zod 3.24+, Valibot 1.0+, ArkType 2.0+ (any schema exposing the `~standard` contract) with no adapter; this package's own test suite integration-tests against Zod only -- see [Compatibility](#compatibility)

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Compatibility](#compatibility) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

Every API validates request input, and every hand-rolled version tends to drift the same three ways: each route reinvents its own type/presence/format checks slightly differently, error shapes vary route to route so clients can't rely on a stable contract, and `ctx.body` stays `unknown` until someone casts it by hope rather than by proof.

```ts
// TODAY, without a validation layer -- each route writes its own checks, and its
// own error shape, and ctx.body is still `unknown` after all of it:
app.post('/users', async (ctx) => {
  const body = ctx.body as { name?: string; email?: string }; // cast by hope
  if (!body.name) {
    ctx.status = 400;
    ctx.json({ error: 'name is required' }); // this route's error shape
    return;
  }
  if (!body.email || !body.email.includes('@')) {
    ctx.status = 400;
    ctx.json({ errors: ['bad email'] }); // a DIFFERENT error shape, one file over
    return;
  }
  // ...
});
```

`@nextrush/validation` doesn't add a schema DSL -- it adds the glue between a schema you already trust and the framework's existing error path, so every route's validation failure looks the same to a client.

## When to use

**Use `@nextrush/validation` if:**

- You already use (or want to use) Zod, Valibot, ArkType, or another Standard Schema library and want one consistent `400` shape across every route
- You want the validated, coerced value to become `ctx.body` -- not a second "parsed" object to remember to read from
- You need to validate the body, query, and route params together, with issues from all three aggregated into a single error

**Reach for something else if:**

- You need to parse the raw request stream into `ctx.body` first -- this package validates an already-parsed body; see [`@nextrush/body-parser`](../body-parser)
- You want a framework-provided schema DSL instead of bringing your own library -- this package deliberately has none; your schema library is the DSL
- You need response validation -- planned alongside `@nextrush/openapi`, not yet available

---

## Installation

```bash
pnpm add @nextrush/validation
# npm i @nextrush/validation . yarn add @nextrush/validation . bun add @nextrush/validation
```

Bring any Standard Schema library -- for example Zod:

```bash
pnpm add zod
```

> [!NOTE]
> `@nextrush/validation` is not re-exported by the `nextrush` meta package -- install and import
> it directly, as shown above.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { json } from '@nextrush/body-parser';
import { validate } from '@nextrush/validation';
import { z } from 'zod';

const app = createApp();

const User = z.object({ name: z.string().min(1), email: z.string().email() });

app.post('/users', json(), validate(User), (ctx) => {
  const body = ctx.body; // validated + coerced -- no cast needed
  ctx.status = 201;
  ctx.json(body);
});

listen(app, 8080);
```

On success, `ctx.body` **is** the validated, coerced value -- no accessor, no generic, no options bag. Invalid input never reaches the handler.

## Capabilities

**Schema interop**
- Works with any [Standard Schema](https://standardschema.dev) library -- structurally compatible with Zod, Valibot, ArkType, and others -- with no adapter, because the interop is a structural TypeScript interface, not a NextRush-specific wrapper. This package's own test suite (unit + integration) exercises Zod; Valibot and ArkType interop follows from the shared `~standard` contract but is not separately exercised by this package's tests
- Validates the body, query, and route params in one call: `validate({ body?, query?, params? })`
- Body is overwritten in place with the coerced value; query and params are validated but intentionally left as their original string form

**Security enforcement**
- The offending input value is never carried into an error response -- Standard Schema issues don't expose it, and `ValidationError.toJSON()` strips `received` regardless
- A schema that signals failure with an empty issues array still rejects the request -- failure is tracked with an explicit flag, never inferred from `issues.length`
- Every target is checked before any mutation, so a later failure can never leave `ctx.body` half-updated

**Developer experience**
- Reuses the framework's existing `ValidationError` (from `@nextrush/errors`) -- no new error type, no custom formatter to learn
- Fully typed, zero `any`; edge-safe (no `node:` imports anywhere in the package)
- Issues from every validated target aggregate into a single `400`, path-prefixed by target (`body.email`, `query.sort`)

## Mental model

`validate()` sits between body-parsing and the route handler: it runs the schema you give it, and on success the coerced value **replaces** `ctx.body` -- there is no second "validated" object to reach for.

```text
request --> body-parser (populates ctx.body) --> validate(schema) --> handler
                                                        |
                                                        +-- invalid --> ValidationError --> errorHandler (400)
```

**Rule:** on success, `ctx.body` is overwritten with the coerced value; `ctx.query`/`ctx.params` are validated but never mutated, because they're typed as strings and a coerced non-string value would make TypeScript wrong about them.

> [!TIP]
> The full request lifecycle and the issue-aggregation sequence (with diagrams) are in
> [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Validate the request body

```ts
import { validate } from '@nextrush/validation';
import { z } from 'zod';

const User = z.object({ name: z.string().min(1), email: z.string().email() });

app.post('/users', json(), validate(User), (ctx) => {
  ctx.json(ctx.body); // validated + coerced
});
```

### Validate query parameters

```ts
const SearchQuery = z.object({ q: z.string().min(1), sort: z.enum(['asc', 'desc']) });

app.get('/search', validate({ query: SearchQuery }), (ctx) => {
  const { q, sort } = ctx.query; // rejected pre-handler if invalid; stays a string
  ctx.json({ q, sort });
});
```

### Validate body, params, and query together

```ts
app.get(
  '/users/:id',
  validate({
    body: UpdateUser, // overwritten in place
    params: z.object({ id: z.string().uuid() }), // validated, left unmodified
    query: z.object({ sort: z.enum(['asc', 'desc']) }), // validated, left unmodified
  }),
  (ctx) => {
    const body = ctx.body;
    const { id } = ctx.params;
    const { sort } = ctx.query;
    ctx.json({ id, sort, body });
  }
);
```

### Handle a `ValidationError` explicitly

```ts
import { ValidationError } from '@nextrush/validation';

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    if (err instanceof ValidationError) {
      ctx.status = 400;
      ctx.json(err.toJSON());
      return;
    }
    throw err;
  }
});
```

### Switch schema libraries without changing the route

```ts
// Any of these drop into the same call, unchanged:
import { z } from 'zod';
const ZodUser = z.object({ name: z.string(), email: z.string().email() });

import * as v from 'valibot';
const ValibotUser = v.object({ name: v.string(), email: v.pipe(v.string(), v.email()) });

import { type } from 'arktype';
const ArkTypeUser = type({ name: 'string', email: 'string.email' });

app.post('/users', validate(ZodUser), handler); // or ValibotUser / ArkTypeUser
```

## API overview

The sealed public surface (ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `validate` | `(arg: StandardSchemaV1 \| RequestSchemas) => Middleware` | 1.0.0 | Stable | Validates the body (schema form), or the body/query/params (map form). |
| `ValidationError` | `class` (re-exported from `@nextrush/errors`) | 1.0.0 | Stable | Thrown on any validation failure; carries aggregated `issues`, `status: 400`, `code: 'VALIDATION_ERROR'`. |
| `type ValidationIssue` | -- (re-exported from `@nextrush/errors`) | 1.0.0 | Stable | `{ path, message, rule?, expected?, received? }` -- the shape of one aggregated issue. |

## Options

`validate()` takes exactly one argument -- either a schema (validates the body only) or a spec map (validates any combination of the three targets). There is no options object beyond this.

| Argument form | Type | Required | Default | Security-sensitive | Description |
| -------------- | ---- | -------- | ------- | ------------------- | ----------- |
| `schema` | `StandardSchemaV1` | Yes (one of the two forms) | -- | No | Validates `ctx.body` against this schema; equivalent to `{ body: schema }`. |
| `spec.body` | `StandardSchemaV1` | No | Not validated if omitted | No | Validates and **overwrites** `ctx.body` with the coerced value. |
| `spec.query` | `StandardSchemaV1` | No | Not validated if omitted | No | Validates `ctx.query`; left unmodified (still a string map) on success. |
| `spec.params` | `StandardSchemaV1` | No | Not validated if omitted | No | Validates `ctx.params`; left unmodified (still a string map) on success. |

### One source of truth

| Target | On success | `ctx.*` after validation |
| ------ | ----------- | -------------------------- |
| **body** | validate + coerce + **overwrite `ctx.body`** | the coerced value |
| **params** | validate; leave unmodified | the original `string` values |
| **query** | validate; leave unmodified | the original `string` / `string[]` values |

**Why body overwrites and query/params don't:** `ctx.body` is typed `unknown`, so replacing it with the coerced object is honest -- the type never disagrees with the runtime. `ctx.query`/`ctx.params` are declared as `string` maps; writing a coerced `number` back would make TypeScript report `string` while the runtime holds a `number`. Query and params are validated but intentionally left unmodified: bad input is rejected, and what the handler reads is exactly what the URL contained.

```ts
// query is validated (rejects bad input) but stays a string -- coerce explicitly:
const page = Number(ctx.query.page);
```

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
| Bun / Deno / Edge | Yes / Yes / Yes | Zero `node:` imports -- portability of the schema library you bring (Zod/Valibot/ArkType) depends on that library's own runtime support |

**Schema libraries**

| Library | Compatibility basis | Exercised by this package's tests |
| ------- | -------------------- | ---------------------------------- |
| Zod 3.24+ | Standard Schema (`~standard`) | Yes -- `zod` is a devDependency; unit + integration tests run real Zod schemas |
| Valibot 1.0+ | Standard Schema (`~standard`) | No -- not a dependency of this package, not exercised by its test suite |
| ArkType 2.0+ | Standard Schema (`~standard`) | No -- not a dependency of this package, not exercised by its test suite |
| Any other Standard Schema v1 implementation | Standard Schema (`~standard`) | No -- covered structurally (hand-written fake schemas in the unit tests), not library-by-library |

**Integration**
- **Peer dependencies:** none -- depends only on `@nextrush/types` (the `StandardSchemaV1` contract) and `@nextrush/errors` (`ValidationError`), both types/classes erased or bundled at build.
- **Works with:** runs after `@nextrush/body-parser` -- `validate()` reads the already-parsed `ctx.body`, it does not read the request stream itself.
- **Incompatible with:** none directly.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>Validation runs but `ctx.body` is still `undefined`</strong></summary>

**Cause:** `validate()` validates the **already-parsed** `ctx.body` -- it does not read or parse the request stream. If no body parser ran before it, `ctx.body` is `undefined` and the schema decides the outcome (a required object schema fails with a `400`). **Fix:** place a body parser before `validate()` in the middleware chain.

```ts
app.post('/users', json(), validate(User), handler); // json() must run first
```

</details>

<details>
<summary><strong>`ctx.query.page` is still a string after validating it as a number</strong></summary>

**Cause:** query and params are validated but intentionally never overwritten (see [One source of truth](#one-source-of-truth)) -- `ctx.query`/`ctx.params` stay typed as string maps so TypeScript is never wrong about their runtime shape. **Fix:** coerce explicitly after validation confirms the value is well-formed.

```ts
const SearchQuery = z.object({ page: z.string().regex(/^\d+$/) });
app.get('/search', validate({ query: SearchQuery }), (ctx) => {
  const page = Number(ctx.query.page); // validated shape, explicit coercion
});
```

</details>

<details>
<summary><strong>A schema's own `validate()` call throws, and the response isn't a clean `400`</strong></summary>

**Cause:** this is by design -- a `ValidationError` from a failed schema check is caught and aggregated into the `400` response, but any **other** error a schema throws (a bug in the schema library, an unexpected exception) propagates unchanged rather than being folded into the validation-failure shape. **Fix:** treat a non-`ValidationError` thrown from inside `validate()` as a genuine bug in the schema or its dependencies, not a validation failure.

</details>

## FAQ

**Can I use `@nextrush/validation` without a specific schema library preinstalled?**
No -- you must add a Standard Schema library (Zod, Valibot, ArkType, or another) as a dependency yourself; `@nextrush/validation` provides the glue, not the schema DSL. It depends only on `@nextrush/types` and `@nextrush/errors` at the type/class level.

**Is Valibot/ArkType support actually tested, or only structurally compatible?**
This package's own test suite integration-tests against Zod only (`zod` is a devDependency here). Valibot and ArkType are expected to work because they implement the same `~standard` contract Zod does -- structural, not case-by-case -- but this package does not itself run Valibot/ArkType through its test suite. If you hit an interop gap with either, it's worth a bug report either way.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Yes. The package has zero `node:` imports -- it only calls the schema's `~standard.validate()` method and maps the result; portability beyond that depends on the schema library you bring.

**Why doesn't `validate()` coerce `ctx.query`/`ctx.params` the way it coerces `ctx.body`?**
Because `ctx.query`/`ctx.params` are declared as string maps in the `Context` type. Overwriting them with a coerced non-string value (a `number`, a `boolean`) would make TypeScript's declared type disagree with the runtime value -- a footgun this package avoids by validating without mutating. Typed coercion for query/params is a planned, non-breaking upgrade (see [Non-Goals](#one-source-of-truth)).

---

## Package relationships

```text
                     depends on            @nextrush/types  (StandardSchemaV1 contract, types only)
@nextrush/validation --------------->      @nextrush/errors  (ValidationError, re-exported)
                     often used with       @nextrush/body-parser  (populates ctx.body before validation)
                     usually used next     @nextrush/openapi  (route metadata this middleware contributes)
```

- **Depends on:** [`@nextrush/types`](../../types) -- the `StandardSchemaV1`/`InferOutput` contract (types only, erased at build); [`@nextrush/errors`](../../errors) -- the `ValidationError` class this package throws and re-exports.
- **Often used with:** [`@nextrush/body-parser`](../body-parser) -- populates `ctx.body` before `validate()` runs.
- **Usually used next:** [`@nextrush/openapi`](../openapi) -- reads the request-schema metadata `validate()` attaches to the route for spec generation.
- **Alternative:** none for schema-based request validation -- hand-rolled per-route checks are the alternative this package exists to replace.

## Architecture

Maintaining or contributing to this package? The internal design -- the validation runner, the
issue-mapping pipeline, and the decisions and trade-offs behind them (with diagrams) -- is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
