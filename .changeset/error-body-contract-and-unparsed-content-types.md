---
'@nextrush/errors': minor
'@nextrush/core': minor
'@nextrush/body-parser': minor
---

Error bodies are now a stable, runtime-independent contract, and an unparsed `Content-Type` is an
explicit choice instead of a silent fallthrough.

**A client error keeps its own code.** `{"code":"INTERNAL_ERROR","status":400}` was what a failed
body parse sent: a 4xx that read to the client like a server fault, so nothing could branch on the
failure. A non-`NextRushError` now reports the code it carries, or its status's canonical code when
it carries none:

| Error | Body before | Body now |
| ----- | ----------- | -------- |
| `BodyParserError` (`INVALID_JSON`, 400) | `code: 'INTERNAL_ERROR'` | `code: 'INVALID_JSON'` |
| A plain error with `status: 404` | `code: 'INTERNAL_ERROR'` | `code: 'NOT_FOUND'` |
| Any 5xx | `code: 'INTERNAL_ERROR'`, masked message | unchanged |

Every 5xx body is byte-for-byte what it was — the code and message of an internal failure still
never reach the client. `@nextrush/errors` exports the derivation both error responses now call,
`resolveErrorCode(error, status)`, so `app`'s default error response and `errorHandler()` cannot
drift apart. `errorHandler()` also now reads a plain error's `status` (via the existing
`getErrorStatus()`) instead of always reporting `500`, which is what made the two surfaces agree.

**Failure messages are framework constants.** `@nextrush/body-parser` put the JS engine's own parse
text in the response — `"Invalid JSON: Expected property name or '}' in JSON at position 1"` — which
differs per runtime for the same bytes, so the body was a function of where the code ran. Every
response-visible message is now fixed (`'Invalid JSON'`, `'Invalid URL-encoded body'`, `'Error
reading request body'`), and the engine's text is retained as a **non-enumerable**
`BodyParserError.cause` for server-side logging. It never appears in `toJSON()`, in
`JSON.stringify(error)`, or in any response. If you matched on a message, read `error.code` or
`error.cause` instead.

**`onUnsupportedContentType`.** A `POST` whose `Content-Type` matches no configured parser used to
answer `200` with `ctx.body === undefined`, so the client's eventual error was whatever validation
said about a missing field. `bodyParser()` now takes an explicit policy:

```ts
app.use(bodyParser({ onUnsupportedContentType: 'reject' }));
```

`'ignore'` is the default and preserves today's behaviour exactly. `'reject'` answers `415` naming
the content type **before any handler runs**. Use `'reject'` for a JSON API: the wrong media type is
the failure, and it should be reported as one. A bodyless method and a request with no
`Content-Type` at all are never rejected under either policy; `multipart/*` rejects under both, as
it always has.

> **Planned for the next major:** the default becomes `'reject'`. Silently accepting an unparsed
> body is the wrong default for the APIs this package exists to build, but flipping it now would
> turn previously-accepted requests into errors without a version to carry the change, so it is
> scheduled rather than shipped. Set the option explicitly to have the future behaviour today.
