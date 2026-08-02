---
"create-nextrush": minor
---

feat(class-based): proper feature-module scaffold — root `AppModule` composes feature modules via `@Module({ imports })` under `src/modules/<feature>/`; health + todos features demonstrate constructor DI, full CRUD decorators (`@Param`/`@Body`/`@Query`/`@HttpCode`), `@Repository`, and `HttpError` paths.

feat(functional): todos CRUD feature — `src/routes/todos.ts` handlers using `ctx.params`/`ctx.query`/`ctx.body`/`ctx.status`/`ctx.throw`, backed by a pure `createTodoStore()` factory (`src/routes/todos-data.ts`) with unit tests.
