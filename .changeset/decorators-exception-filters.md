---
'@nextrush/decorators': minor
---

Add exception filter decorators: `@Catch`, `@UseFilter`, and the `ExceptionFilter` interface.

`ExceptionFilter` is a class-based filter (`catch(error, ctx)`) that turns a thrown error into a
response. `@Catch(...errorTypes)` declares which error constructors a filter handles; no-arg
`@Catch()` is a catch-all. `@UseFilter(...filters)` attaches filters at the controller or method
level (mirroring `@UseGuard`). New metadata readers `getClassFilters`, `getMethodFilters`,
`getAllFilters`, and `getCatchTypes` expose the metadata to the controllers runtime. New metadata
keys `FILTERS` and `CATCH` were added to `DECORATOR_METADATA_KEYS`.

Additive and opt-in — no existing behavior changes.
