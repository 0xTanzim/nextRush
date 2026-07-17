---
"@nextrush/request-id": patch
---

`@nextrush/request-id`'s default ID generator now uses the global `crypto.randomUUID()` instead of
importing `randomUUID` from `node:crypto`, making the package genuinely edge-safe rather than
Node-only for no functional reason.

The package's `requestId()` middleware already performed a one-time capability check
(`typeof globalThis.crypto?.randomUUID !== 'function'`) before relying on the default generator,
and threw a clear error naming the missing capability if it was absent — but `defaultGenerator`
itself still imported the Node-only module form, so that guard never actually protected against
what it checked for. `defaultGenerator` now calls the same global the guard checks, and the
`node:crypto` import is removed entirely.

Output is unchanged: both forms produce identical RFC 4122 v4 UUIDs. No public API, option, or
behavior change — only the internal generation mechanism, which is now portable to every runtime
the package's README already claimed to support (Node, Bun, Deno, Cloudflare Workers, Vercel Edge).
