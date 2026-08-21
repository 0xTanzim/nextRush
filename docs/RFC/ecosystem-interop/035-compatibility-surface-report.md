# RFC-035 Compatibility Surface Report (P0)

**Status:** P0 complete — informs `surface.ts`, does not ship `compat()`.
**Scope:** the ~20-package research set from RFC-035 §8.8.

## Research set

| Package | Required req APIs | Required res APIs | Lifecycle | Stream/abort/body | Native overlap | Proposed level |
| --- | --- | --- | --- | --- | --- | --- |
| `cors` | `method`, `headers` | `setHeader` | terminal | — | `@nextrush/cors` | **native-preferred** |
| `helmet` | `method`, `headers` | `setHeader` | terminal | — | `@nextrush/helmet` | **native-preferred** |
| `cookie-parser` | `headers` | `cookie` (set `req.cookies`) | `next()` | — | `@nextrush/cookies` | **native-preferred** |
| `compression` | `headers`, `method` | `setHeader`, `write`, `end` | `next()`, thenable | streaming | `@nextrush/compression` | **native-preferred** (Partial if bridged) |
| `body-parser` | `headers`, `on` | `setHeader` | `next()` | body stream | `@nextrush/body-parser` | **native-preferred** |
| `multer` | `headers`, `on`, `pipe` | `setHeader` | `next()` | body stream | `@nextrush/form-data` | **native-preferred** (Partial) |
| `morgan` | `method`, `url` | `on('finish')`, `statusCode` | `next()` | — | `@nextrush/logger` (new apps) | **Full (candidate)** |
| `passport` | `headers`, ad-hoc `req.*` | `setHeader` | `next()` | — | — | **Partial** |
| `passport-jwt` | `headers` | — | callback | — | — | **Partial** |
| `http-proxy-middleware` | `headers`, `on`, `pipe` | `write`, `end`, `writeHead` | streaming | streaming + abort | — | **Unsupported in v1** |
| `method-override` | `method`, `headers`, `body` | — | `next()` | body | — | **Partial (candidate)** |
| `response-time` | `method`, `url` | `setHeader` | `next()` | — | — | **Full (candidate)** |
| `on-headers` | — | `writeHead` (assign) | — (utility) | — | — | **surface fixture** |
| `express-validator` | `body`, `params`, `query` | `setHeader` | `next(err)` | — | — | **Partial (candidate)** |
| `connect-timeout` | `headers`, `on` | `setHeader` | `next()` | abort | — | **Partial / P0** |
| `express-session` | ad-hoc `req.session` | `cookie` | `next()` | — | RFC-032 `@nextrush/session` | **Unsupported** |
| `express.Router` | `stack`, `handle` | — | routing | — | `@nextrush/router` | **Unsupported** |
| `csurf` | `headers`, `body` | `setHeader` | `next(err)` | — | `@nextrush/csrf` | **native-preferred** |
| `express-rate-limit` | `ip`, `headers` | `setHeader` | `next()` | — | `@nextrush/rate-limit` | **native-preferred** |
| `serve-static` | `method`, `url`, `headers` | `setHeader`, `end`, stream | `next()` | streaming | `@nextrush/static` | **native-preferred** |

## Key findings

1. **Header/log-only middleware** (`morgan`, `response-time`) needs the smallest surface: `req.method`/`req.url` + `res.on`/`res.statusCode`/`res.setHeader`. These are the strongest `Full` candidates.
2. **`on-headers` needs `writeHead` assignment pass-through**, confirming the captured-`origWriteHead` algorithm in `response-proxy.ts` — not an overlay trap.
3. **Passport** needs ad-hoc `req.*` → `ctx.state` (last-write-wins), confirming bucket 4.
4. **Streaming** (`compression`, `http-proxy-middleware`, `serve-static`) is out of v1 scope; pass-through is preserved but not claimed `Full`.
5. **Native-overlap packages** must stay `native-preferred`, never `Full`.

## Surface decision

The candidate overlay in `surface.ts` (`REQUEST_OVERLAY` / `RESPONSE_OVERLAY`) is **confirmed** for v1. No overlay key was added beyond the RFC §8.4 candidate set; the known-unsupported and pass-through buckets are unchanged. `morgan` and `response-time` are the v1 `Full` candidates; `passport`/`passport-jwt` are `Partial`; `on-headers` is a surface fixture.
