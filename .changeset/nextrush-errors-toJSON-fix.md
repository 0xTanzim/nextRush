---
"@nextrush/errors": patch
---

Fix `errorHandler()` silently dropping subclass-specific fields (e.g.
`ValidationError.issues`) from the serialized response body.

`errorHandler()` previously built its own response body by hand
(`{ error, message, code, status, details }`) instead of calling the thrown
error's own `toJSON()`. Any `NextRushError` subclass that overrides `toJSON()`
to add fields — most notably `ValidationError`, which adds `issues` — had
those fields silently dropped when rendered through `errorHandler()`, even
though `error.toJSON()` produced them correctly on its own.

`errorHandler()` now delegates to `err.toJSON()` for any `NextRushError` (which
includes `HttpError` and all its subclasses), and falls back to the previous
hand-rolled shape only for plain `Error`/unknown thrown values. The response
shape for existing `HttpError` usage is unchanged; `ValidationError` responses
now correctly include `issues`.

Found via live end-to-end testing of `@nextrush/validation` against a real
Node HTTP server — no application code needs to change.
