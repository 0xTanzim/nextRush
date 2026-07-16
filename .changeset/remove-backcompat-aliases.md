---
"@nextrush/adapter-bun": major
"@nextrush/adapter-deno": major
"@nextrush/adapter-node": major
"@nextrush/adapter-edge": major
"@nextrush/runtime": patch
"@nextrush/core": major
"@nextrush/errors": major
"@nextrush/body-parser": major
"@nextrush/helmet": major
"@nextrush/cors": major
"nextrush": major
"@nextrush/class": patch
---

**BREAKING**: Removed a batch of dead backward-compatibility aliases across several packages.
Each had been superseded for at least one release and carried zero remaining internal use.

**Adapters (`@nextrush/adapter-bun`, `-deno`, `-node`)**: removed the deprecated
`ServeOptions.hostname` / `ServerInstance.hostname` fields. Use `host` instead — it was already
the canonical field; `hostname` was accepted only as a fallback.

**Adapters (`@nextrush/adapter-bun`, `-deno`, `-edge`)**: removed the `{Bun,Deno,Edge}BodySource`
type/value aliases and their `create{Bun,Deno,Edge}BodySource` factory functions. Use
`WebBodySource` / `createWebBodySource` from `@nextrush/runtime` — the aliases were pure
re-exports pointing at the same implementation.

**`@nextrush/core`**: removed the `createHttpError` alias. Use `createError` (same function,
different name) from `@nextrush/core`, `@nextrush/errors`, or `nextrush`.

**`@nextrush/errors`**: removed `ErrorContext` (use `Context` from `@nextrush/types`),
`ErrorMiddleware` (use `Middleware` from `@nextrush/types`), and `catchAsync()` (it was a no-op
wrapper — `return handler` — remove the call, your handler already works without it; async
errors propagate to `errorHandler()` on their own).

**`@nextrush/body-parser`**: removed the Node-stream fallback path — `BodyParserContext.raw`,
the `RequestStream` interface, and the `BodyParserMiddleware` type alias (use `Middleware` from
`@nextrush/types`). Body parsing now requires `ctx.bodySource`, which every current adapter
(Node, Bun, Deno, Edge) already provides — this only affects a custom/third-party adapter that
never implemented `bodySource`.

**`@nextrush/helmet`**: removed `frameguard()`, the `frameguard` option on `helmet()`, and the
`XFrameOptionsValue` type. `X-Frame-Options` is superseded by the Content-Security-Policy
`frame-ancestors` directive, which every modern browser honors. Replace
`helmet({ frameguard: 'DENY' })` with
`helmet({ contentSecurityPolicy: { directives: { 'frame-ancestors': ["'none'"] } } })` (or
`["'self'"]` for the `SAMEORIGIN` equivalent).

**`@nextrush/cors`**: removed the `CorsMiddleware` type alias (confirmed zero real usage anywhere
in this repo). Use `Middleware` from `@nextrush/types`.

**`nextrush`** (meta package): re-exported `catchAsync` — bumped as a consequence of the
`@nextrush/errors` removal above. `@nextrush/class` bumped patch since it re-exports
`@nextrush/di` symbols that are unaffected, included only because its own test suite exercises
`@nextrush/core`'s error re-exports.

No migration tooling is provided for this batch — every replacement is a one-line rename or
import-path swap (`frameguard` is the one exception, needing a CSP directive instead of a
function call; see the table in
[the upgrade guide](https://github.com/0xTanzim/nextRush/blob/main/apps/docs/content/docs/migrate/upgrade-guide.mdx)
for the full old → new mapping).
