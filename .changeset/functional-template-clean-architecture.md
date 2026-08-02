---
"create-nextrush": minor
---

Redesign the `functional` project template as a professional, production-grade layered API.

The `functional` style now ships a clean **routes → services → repositories** architecture with
centralized config (`src/config/index.ts`), shared domain types (`src/lib/types.ts`), and custom
middleware (`src/middleware/logger.ts`) — instead of dumping every file into `src/routes/`.

Key changes:
- **Routes** (`src/routes/*.routes.ts`) — HTTP layer: reads `ctx`, sets status, calls service. No
  `try/catch` — errors propagate to the middleware.
- **Services** (`src/services/*.service.ts`) — business logic: validation, filtering. Throws
  framework HTTP errors (`NotFoundError`, `BadRequestError`) from the `nextrush` meta-package.
- **Repositories** (`src/repositories/*.repository.ts`) — pure data access: in-memory CRUD factory.
- **Config** (`src/config/index.ts`) — centralized env reads (`port`, `host`, `nodeEnv`),
  runtime-aware (Deno uses `Deno.env.get`). No scattered `process.env` across handlers.
- **Lib** (`src/lib/types.ts`) — shared domain types (`Todo`, `CreateTodoInput`), independent of
  any layer.
- **Middleware** (`src/middleware/logger.ts`) — request-logging middleware (before/after `next()`).
- **Entrypoint** — uses the framework's built-in `errorHandler` from `nextrush` (first in the
  chain), `config.port` instead of an inline `PORT` constant, and the custom `logger()`.

No classes, decorators, or DI — still pure factory functions. No `@nextrush/class` or
`reflect-metadata` dependencies.
