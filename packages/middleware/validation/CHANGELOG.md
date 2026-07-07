# @nextrush/validation

## 3.1.0

### Minor Changes

- 0e2b399: Add `@nextrush/validation` — Standard Schema request validation middleware.

  Bring your own schema library (Zod, Valibot, ArkType, or any [Standard
  Schema](https://standardschema.dev) implementation) and validate `ctx.body`,
  `ctx.query`, and `ctx.params` with one function:

  ```typescript
  import { validate } from '@nextrush/validation';
  import { z } from 'zod';

  const User = z.object({ name: z.string().min(1), email: z.string().email() });

  app.post('/users', validate(User), (ctx) => {
    ctx.json(ctx.body); // validated + coerced
  });
  ```

  - `validate(schema)` validates and coerces the request body, overwriting
    `ctx.body` with the coerced value.
  - `validate({ body, query, params })` validates any combination of targets;
    `query`/`params` are validated but intentionally left unmodified so
    TypeScript's declared types are never wrong about them.
  - Every failure throws the framework's existing `ValidationError` (from
    `@nextrush/errors`), rendered by the existing `errorHandler` — no new error
    shape to learn.
  - Zero runtime dependencies.

  See the [package README](../packages/middleware/validation/README.md) for the
  full API and [RFC-NEXTRUSH-VALIDATION](../docs/RFC/RFC-NEXTRUSH-VALIDATION.md)
  for the design rationale.

- 32a0db6: Add the Route Metadata System — the framework-level foundation that lets any tool (OpenAPI, and later SDK/Postman/RPC generators) read a route's request/response shapes and documentation without duplication.
  - **`@nextrush/types`**: new `RouteDefinition` / `RouteMetadata` contracts and the `ROUTE_METADATA` contribution symbol. `StandardSchemaV1` moved here (from `@nextrush/validation`) as a shared contract.
  - **`@nextrush/router`**: new `endpoint()` metadata marker and `getRoutes(): readonly RouteDefinition[]` introspection. The router collects each route's metadata at registration by partitioning entries (functions run; pure markers contribute only) and merging contributions. Metadata lives in a side registry — the request hot path (`match()`, `HandlerEntry`, radix nodes) is byte-identical, and an interleaved A/B benchmark confirmed dispatch throughput is unchanged.
  - **`@nextrush/validation`**: `validate()` now contributes its request schemas via the protocol (non-enumerable internal marker — public API unchanged), so validated routes are documented for free.
  - **`@nextrush/controllers`**: class-based routes now contribute decorator documentation (`@Controller({ tags })`, `@Get/@Post({ description, deprecated })`) into their `RouteDefinition` via the same protocol, so controller routes appear fully documented in the spec alongside functional routes.
  - **`nextrush`**: re-exports `endpoint()` (and the `RouteDefinition` / `RouteMetadata` types) so it sits next to `createRouter` — `import { endpoint } from 'nextrush'`.

  Additive and backward-compatible: existing route registration and dispatch are unaffected.

### Patch Changes

- Updated dependencies [d7eb075]
- Updated dependencies [0e2b399]
- Updated dependencies [32a0db6]
  - @nextrush/types@4.0.0
  - @nextrush/errors@4.0.0
