---
'@nextrush/decorators': minor
'@nextrush/controllers': minor
'nextrush': minor
---

Add `@HttpCode(statusCode)` method decorator

Controller methods can now declare a fixed response status with `@HttpCode(201)`.
The controllers handler applies it when the method returns a value.

`@HttpCode` takes precedence over the route decorator's `statusCode` option when
both are present (`@Post('/', { statusCode: 200 }) @HttpCode(201)` responds
`201`). It does not affect error responses (a thrown `HttpError` keeps its own
status) or `@Redirect` (the redirect status wins).

Exported from `@nextrush/decorators` (with the `getHttpCode` metadata reader) and
re-exported from `nextrush/class`.
