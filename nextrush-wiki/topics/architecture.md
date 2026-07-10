---
title: v3 Architecture
type: topic
created: 2026-07-10
sources: [readme-2026-07-10]
tags: [architecture, di, decorators, controllers, modules]
---
# v3 Architecture

## Package Hierarchy (immutable)
```
types → errors → core → router → di → decorators → controllers → adapters → middleware
```
See [[entities/nextrush-monorepo]] for size ceilings and directory layout.

## Core Concepts
1. **Application** (`@nextrush/core`) — entry point, middleware registration, plugin system.
2. **Context** — request/response wrapper, DX-focused (see [[topics/context-api]]).
3. **Middleware** — Koa-style async, composed via `compose()`.
4. **Plugin** — extension mechanism via `Plugin` interface.
5. **Router** (`@nextrush/router`) — high-performance radix/segment trie routing.
6. **Adapter** — platform-specific HTTP handling (Node.js, Bun, Deno, Edge).
7. **DI Container** (`@nextrush/di`) — wraps tsyringe.
8. **Decorators** (`@nextrush/decorators`) — `@Controller`, `@Get`, `@UseGuard`, param decorators.
9. **Controllers registrar** (`@nextrush/controllers`) — auto-discovery, handler building.
10. **Errors** (`@nextrush/errors`) — HTTP error hierarchy.

## Guard System
Two forms: function guards (`GuardFn`) and class guards (`CanActivate`, DI-resolvable). `GuardContext` is a lightweight, response-method-free view of the request. Guards return boolean/Promise<boolean>; class guards → method guards execution order.

## Controllers Registrar Pipeline
1. Read controller metadata (path, guards)
2. Read route metadata (method, path, guards)
3. Read parameter metadata (source, property, transform)
4. Resolve controller from DI container
5. Build handler: class guards → method guards → extract params (with transforms) → call method → serialize as JSON

## Error Hierarchy
`HttpError` base → `BadRequestError`(400), `UnauthorizedError`(401), `ForbiddenError`(403), `NotFoundError`(404), `MethodNotAllowedError`(405), `ConflictError`(409), `UnprocessableEntityError`(422), `TooManyRequestsError`(429), `InternalServerError`(500), `NotImplementedError`(501), `BadGatewayError`(502), `ServiceUnavailableError`(503), `GatewayTimeoutError`(504). Plus `ValidationError`(400) and controller-specific `MissingParameterError`(400), `GuardRejectionError`(403).

## Related
- [[topics/di-and-class-based]] for `@Service`, `@Module`, request scope details.
- [[topics/engineering-standards]] for the hard rules governing this hierarchy.
