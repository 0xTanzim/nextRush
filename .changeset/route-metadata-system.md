---
"@nextrush/types": minor
"@nextrush/router": minor
"@nextrush/validation": minor
"@nextrush/controllers": minor
"nextrush": minor
---

Add the Route Metadata System — the framework-level foundation that lets any tool (OpenAPI, and later SDK/Postman/RPC generators) read a route's request/response shapes and documentation without duplication.

- **`@nextrush/types`**: new `RouteDefinition` / `RouteMetadata` contracts and the `ROUTE_METADATA` contribution symbol. `StandardSchemaV1` moved here (from `@nextrush/validation`) as a shared contract.
- **`@nextrush/router`**: new `endpoint()` metadata marker and `getRoutes(): readonly RouteDefinition[]` introspection. The router collects each route's metadata at registration by partitioning entries (functions run; pure markers contribute only) and merging contributions. Metadata lives in a side registry — the request hot path (`match()`, `HandlerEntry`, radix nodes) is byte-identical, and an interleaved A/B benchmark confirmed dispatch throughput is unchanged.
- **`@nextrush/validation`**: `validate()` now contributes its request schemas via the protocol (non-enumerable internal marker — public API unchanged), so validated routes are documented for free.
- **`@nextrush/controllers`**: class-based routes now contribute decorator documentation (`@Controller({ tags })`, `@Get/@Post({ description, deprecated })`) into their `RouteDefinition` via the same protocol, so controller routes appear fully documented in the spec alongside functional routes.
- **`nextrush`**: re-exports `endpoint()` (and the `RouteDefinition` / `RouteMetadata` types) so it sits next to `createRouter` — `import { endpoint } from 'nextrush'`.

Additive and backward-compatible: existing route registration and dispatch are unaffected.

