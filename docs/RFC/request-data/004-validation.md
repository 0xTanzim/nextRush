# RFC: `@nextrush/validation` — Request Validation for Any Schema Library

**Status:** ✅ Approved — v4 (final, implementation-ready; editorial polish over the approved v3)
**Date:** 2026-07-06
**Author:** NextRush Core Team
**Package:** `@nextrush/validation` · Ecosystem / Middleware tier · `packages/middleware/validation/`
**Framework impact (v1):** none — a pure middleware package. No change to `@nextrush/types`, `@nextrush/core`, or any other package.

---

## 0. Revision History

- **v1** — Full-featured: `validate({ body, query, params, headers })`, a `ctx.valid<T>()` accessor on `Context`, decorator sugar, a `schema()` transform helper.
- **v2** — DX review cut the surface: added `validate(schema)` shorthand, removed `ctx.valid()` (overwrite `ctx.body`), dropped `headers`, postponed decorators.
- **v3** — Query/params became validation-only (no runtime coercion, no type-lie); Standard Schema internals moved to Architecture; reordered DX-first.
- **v4 (this document)** — Editorial finalization after approval. Renamed the internal `ValidationSpec` → `RequestSchemas` and stopped exporting internal types; ensured user-facing docs show only `validate(User)` (Standard Schema stays in Architecture); reworded query/params behavior as "validated but intentionally left unmodified"; **added a query-only example (§4) and an explicit middleware-ordering section (§6)**; settled the module layout. No architectural change.

---

## 1. Problem

NextRush has no request validation. Every handler checks input by hand — repetitive, inconsistent, ad-hoc error shapes, and `ctx.body` stays `unknown`. Every 2026 framework solved this by standardizing on **Standard Schema**, so the developer brings their own schema library and the framework validates against it. NextRush ships the *glue*, not a validator.

---

## 2. Golden Path (Mode 1 — ~95% of routes)

```typescript
import { validate } from '@nextrush/validation';
import { z } from 'zod';

const User = z.object({ name: z.string().min(1), email: z.string().email() });

app.post('/users', validate(User), (ctx) => {
  const body = ctx.body; // validated + coerced, in place — one body, nothing new to learn
  ctx.status = 201;
  ctx.json(body);
});
```

Pass a schema, get a middleware. On failure it throws the framework's existing `ValidationError` → the existing error handler renders a `400`. On success, `ctx.body` **is** the validated, coerced value. No `ctx.valid()`, no accessor, no generic. This is the path everything else is optimized around.

---

## 3. Works With Any Schema Library

The developer's schema library **is** the validation DSL. Anything implementing Standard Schema works identically — no adapter, no config, no NextRush-specific wrapper:

```typescript
// Zod
import { z } from 'zod';
const User = z.object({ name: z.string(), email: z.string().email() });

// Valibot
import * as v from 'valibot';
const User = v.object({ name: v.string(), email: v.pipe(v.string(), v.email()) });

// ArkType
import { type } from 'arktype';
const User = type({ name: 'string', email: 'string.email' });
```

All three drop into the same call unchanged:

```typescript
app.post('/users', validate(User), handler);
```

Zod (3.24+), Valibot (1.0+), and ArkType (2.0+) all expose the Standard Schema interface, so `validate()` never knows or cares which library produced the schema. Bring the one you already use; switching libraries later doesn't change your routes. (Mechanics in §10.)

---

## 4. Advanced Path (Mode 2 — params & query)

Query-only (a common real case — a search endpoint):

```typescript
const SearchQuery = z.object({ q: z.string().min(1), sort: z.enum(['asc', 'desc']) });

app.get('/search', validate({ query: SearchQuery }), (ctx) => {
  const { q, sort } = ctx.query; // rejected pre-handler if invalid; still strings (§5)
  ctx.json({ q, sort });
});
```

All three targets together:

```typescript
app.get('/users/:id',
  validate({
    body: UpdateUser,                                    // overwritten in place (§5)
    params: z.object({ id: z.string().uuid() }),         // validated, left unmodified
    query: z.object({ sort: z.enum(['asc', 'desc']) }),  // validated, left unmodified
  }),
  (ctx) => {
    const body = ctx.body;
    const { id } = ctx.params;
    const { sort } = ctx.query;
    ctx.json({ id, sort, body });
  },
);
```

Bad `params`/`query` is rejected with a `400` before the handler runs. Treat Mode 2 as the advanced case; it never compromises the golden path.

---

## 5. One Source of Truth (the access model)

| Target | On success | `ctx.*` after validation |
| --- | --- | --- |
| **body** | validate + coerce + **overwrite `ctx.body`** | the coerced value (safe — `ctx.body` is `unknown`) |
| **params** | validate; **leave unmodified** | the original `string` values |
| **query** | validate; **leave unmodified** | the original `string` / `string[]` values |

**Why body overwrites and query/params don't:** `ctx.body` is declared `unknown`, so replacing it with the coerced object is honest — the type never disagrees with the runtime. `ctx.query`/`ctx.params` are declared as `string` maps. Writing a coerced `number` back would make TypeScript report `string` while the runtime holds a `number` — a footgun (`ctx.query.page.toFixed()` compiles, then crashes). NextRush does not ship a type it knows is wrong.

So query/params are **validated but intentionally left unmodified** in v1: malformed input is rejected pre-handler, and what you read is exactly what the URL contained. Need a number? `Number(ctx.query.page)` — explicit and honestly typed. `body` (payload) and `query`/`params` (URL) are different concepts, and only one can be re-typed safely today.

When per-route type threading lands (§9), coerced query/params become correctly typed automatically — a **non-breaking upgrade** (the runtime starts returning what the types already promise, instead of the reverse).

---

## 6. Middleware Order — `validate` Does Not Parse

`validate()` validates the **already-parsed** `ctx.body`. It does not read or parse the request stream. Place it **after** body-parsing middleware:

```typescript
import { json } from '@nextrush/body-parser';

app.post('/users',
  json(),          // 1. parses the request body → ctx.body
  validate(User),  // 2. validates ctx.body, overwrites it with the coerced value
  handler,         // 3. reads the validated ctx.body
);
```

If no body parser ran, `ctx.body` is `undefined`, and the schema decides the outcome (a required object schema fails with a `400`). Parsing and validation are separate responsibilities in separate packages by design — `validate` never owns transport or parsing. Query and params are populated by the router before any middleware, so they need no parser.

---

## 7. Errors

Every failure throws the framework's **existing** `@nextrush/errors` `ValidationError` — no new error type, no custom formatter. It is already rendered by the existing `errorHandler`, and its `toJSON()` already strips raw input (`received`) so passwords/tokens never leak. Issues aggregate across all validated targets, path-prefixed by target so they stay unambiguous:

```json
{
  "error": "ValidationError", "message": "Validation failed",
  "code": "VALIDATION_ERROR", "status": 400,
  "issues": [
    { "path": "body.email", "message": "Invalid email address" },
    { "path": "query.sort",  "message": "Invalid enum value. Expected 'asc' | 'desc'" }
  ]
}
```

A validated route needs zero extra error wiring, and its 400 body is identical to every other validation error in the framework.

---

## 8. Public API Surface

Everything a developer imports:

```typescript
import { validate } from '@nextrush/validation';
import { ValidationError } from '@nextrush/validation'; // re-exported for catch/typing — one import site
```

```typescript
// exports
export { validate };
export { ValidationError, type ValidationIssue }; // re-exported from @nextrush/errors
```

`validate(User)` is the entire developer-facing signature. The Standard Schema type and the internal `RequestSchemas`/`ValidationTarget` types are **not exported** — users never write them (see §10 for the real type-level contract). Nothing else: no accessor, no decorator helper, no schema DSL, no options bag.

---

## 9. Trade-offs & Future Evolution

- **Typed query/params via middleware type threading (the real long-term DX).** Can `ctx.query`/`ctx.params` become the validated, correctly-typed values per route, with no accessor API? NextRush uses `router.get(path, handler)` with a non-parameterized `Middleware` type, so Hono-style threading means parameterizing `Middleware` (`@nextrush/types`) and rewriting router method generics (`@nextrush/core`/`@nextrush/router`) — the framework's hottest central types, framework-wide inference blast radius if it regresses. It is a **separate, gated spike**, not v1 work: prototype on a throwaway branch, get a VALIDATED/INVALIDATED verdict, then its own RFC against `types`+`core`. If it validates, query/params coercion turns on as a non-breaking type upgrade; if not, §5's validate-only model is permanent.
- **`validate` can grow into a namespace** without breaking `validate(schema)`: `validate.request({ body, query })` for symmetry, `validate.response(schema)` when response validation arrives (with `@nextrush/openapi`). Room, not built.
- **Decorator integration** (`@Body(schema)`) is postponed until the middleware API is stable; it would touch `@nextrush/controllers`, so it stays out of v1's middleware-tier-only footprint.

---

## 10. Architecture (under the hood)

*Contributor-facing — application developers can stop at §9.*

Standard Schema is a TypeScript interface, not a library. A schema exposes one property; the entire runtime contract `validate()` relies on is:

```typescript
interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) =>
      | { value: Output; issues?: undefined }
      | { issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }> }
      | Promise<unknown /* same union */>;
    readonly types?: { input: Input; output: Output };
  };
}
```

**Internal type-level contract** (not exported):

```typescript
type ValidationTarget = 'body' | 'query' | 'params';
type RequestSchemas = Partial<Record<ValidationTarget, StandardSchemaV1>>;

function validate(schema: StandardSchemaV1): Middleware; // shorthand → { body: schema }
function validate(schemas: RequestSchemas): Middleware;   // params/query/body
```

**One reusable runner** is the only place that touches the Standard Schema contract — the middleware delegates to it:

```typescript
async function runSchema<S extends StandardSchemaV1>(
  schema: S, value: unknown, pathPrefix: string,
): Promise<InferOutput<S>> {
  let result = schema['~standard'].validate(value);
  if (result instanceof Promise) result = await result;
  if (result.issues) {
    throw new ValidationError(
      result.issues.map((i) => ({ path: joinPath(pathPrefix, i.path), message: i.message })),
    );
  }
  return result.value as InferOutput<S>;
}
```

- **Overload discrimination:** `validate(arg)` checks `'~standard' in arg`. A schema has it → `{ body: arg }`; otherwise `arg` is a `RequestSchemas`. Unambiguous at runtime, resolved by overloads at the type level.
- **Output handling:** for `body`, `runSchema`'s return value overwrites `ctx.body`; for `query`/`params` the return value is discarded (validation side-effect only), which is what keeps those honestly typed (§5).
- **Type inference:** `InferOutput<S> = NonNullable<S['~standard']['types']>['output']` recovers the coerced `body` type from any vendor's schema.
- **Naming:** modules are named by responsibility (`run-schema`, `issues`), not by verb; the public verb `validate` is the entry point.

---

## 11. Implementation Plan (TDD)

Module layout — concerns separated as flat modules (the small package doesn't warrant one-file-per-folder nesting, per `code-structure.md`); `runSchema` and issue-mapping are independently testable:

```text
packages/middleware/validation/src/
  index.ts          # public exports (validate + ValidationError re-export)
  validate.ts       # validate() overload → builds the Middleware
  run-schema.ts     # runSchema() — reusable Standard Schema runner
  issues.ts         # Standard Schema issues → ValidationIssue mapping (joinPath)
  types.ts          # internal types (RequestSchemas, ValidationTarget) — not exported
  __tests__/
    run-schema.test.ts
    validate.test.ts
    integration.test.ts
```

Order (foundation first):

1. **`runSchema()` + issue mapping** — unit-tested with a hand-written fake schema (no Zod dep): success, sync/async failure, nested `path`, `{key}` segments, target prefixing.
2. **`validate(schema)` shorthand** — body-only; in-place `ctx.body` overwrite; throw reaches a mock error handler.
3. **`validate(schemas)`** — multi-target ordering + aggregation; assert `ctx.query`/`ctx.params` are **unmodified** on success and a `400` is thrown on bad input.
4. **Integration test** — a real route + a real Zod schema (test-only devDependency): 400 body byte-for-byte, `ctx.body` holds the coerced value while `ctx.query` stays a string.
5. **README + ARCHITECTURE** to the standard set by `@nextrush/stream`.

Coverage per `v3-testing.instructions.md`: 90% lines/functions/statements, 85% branches.

---

## 12. Non-Goals for v1

- `headers` / `cookies` / `files` targets.
- Coercion/overwrite of `ctx.query`/`ctx.params` (pending §9 spike).
- Decorator integration.
- Response validation (deferred to `@nextrush/openapi`).
- A schema DSL — the user's library is the DSL.
- Body parsing — that is body-parser's job; `validate` runs after it (§6).

---

## 13. Decisions — Status (all resolved)

| Question | Resolution |
| --- | --- |
| Access API | Overwrite `ctx.body` in place. No `ctx.valid()`, no accessor. |
| Query/params | **Validated but intentionally left unmodified** in v1. Coercion arrives as a non-breaking upgrade after the §9 spike. |
| Multi-target form | `validate(schema)` shorthand + `validate({ body, query, params })`. Namespace (`validate.request`/`.response`) left as future room. |
| Errors | Reuse existing `ValidationError`; aggregate; prefix paths by target. |
| Parsing vs validation | Separate. `validate` runs after body-parser; it never parses (§6). |
| Exported types | Only `validate` + `ValidationError`/`ValidationIssue`. Internal types unexported. |
| Decorators | Postponed. |
| Framework change in v1 | None — pure middleware package. |

**Frozen for implementation.** The only tracked-but-separate item is the §9 type-threading spike, which does not block v1.
