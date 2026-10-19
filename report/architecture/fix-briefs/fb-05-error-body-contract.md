# FB-05 — Error bodies: wrong `code` on 4xx, engine-specific messages, silent acceptance of unknown content types

| Field | Value |
| --- | --- |
| **Severity / Priority** | Medium · P1 |
| **Area** | `@nextrush/core` (`error-handler.ts`), `@nextrush/body-parser` (`errors.ts`, `parsers/json.ts`, `parsers/combined.ts`) |
| **Depends on** | — (RFC 9457 migration is a separate, later RFC — see GP-03) |
| **RFC-gated** | No for (a)(b)(c); the wire-format change to RFC 9457 **is** RFC-gated |
| **Size** | S–M |
| **Probe ids** | `error-code-4xx`, `error-no-engine-text`, `unsupported-content-type` (`knownFailures: FB-05`) |

Three small defects share one theme: the default error body is not a stable, runtime-independent contract.

## (a) `code` is `"INTERNAL_ERROR"` on client errors

- **Current situation:** `POST /echo` with invalid JSON returns `{"error":"BodyParserError","message":"…","code":"INTERNAL_ERROR","status":400}`. `BodyParserError` carries `code: 'INVALID_JSON'`, but the default handler ignores it.
- **Root cause:** `packages/core/src/error-handler.ts:47-53` hard-codes `code: 'INTERNAL_ERROR'` for every non-`NextRushError`.
- **Impact:** Clients cannot branch on `code`; a 400 reads like a server fault. Other `BodyParserError`s (`ENTITY_TOO_LARGE`, `UNSUPPORTED_CONTENT_TYPE`, `INVALID_PARAMETER`) are all mislabelled.
- **Fix:** `code = typeof (error as {code?:unknown}).code === 'string' ? error.code : (status >= 500 ? 'INTERNAL_ERROR' : codeForStatus(status))` (`codeForStatus` is exported by `@nextrush/errors`, `codes.ts:69`). **Keep `INTERNAL_ERROR` for 5xx** — `ERROR_CODES[500]` is `INTERNAL_SERVER_ERROR` but `GENERIC_ERROR_CODE`/`NextRushError` use `INTERNAL_ERROR`; do not change existing 5xx bodies. Only use a string `code` from errors with `status < 500` (an internal 5xx error's code is not for clients). Compare with `packages/errors/src/middleware.ts:102` (`errorHandler()`), which already derives codes — reuse its logic so there is one contract (audit C-1 intent).

## (b) JS-engine parse text leaks into the response and differs per runtime

- **Current situation:** Bun: `"Invalid JSON: JSON Parse error: Expected '}'"`. Node 26: `"Invalid JSON: Expected property name or '}' in JSON at position 1 (line 1 column 2)"`. Same request, different bodies — a parity break and an internals leak.
- **Root cause:** `packages/middleware/body-parser/src/errors.ts:117-118` + `parsers/json.ts:190` embed `(err as Error).message`.
- **Fix:** `invalidJson()` returns the constant message `"Invalid JSON"`. Keep the engine text as a non-enumerable `cause` (logged server-side, never serialized; mirror Elysia 2, which drops `cause` from responses). Apply the same rule to `urlencoded`, `text`, `raw` parsers if they embed engine messages (grep `err.message` in `parsers/`). Our own messages (depth `65 exceeds 64 limit`, size limits) are fine.

## (c) Unknown content types are silently ignored (no 415)

- **Current situation:** `POST` with `Content-Type: application/xml` → `200`, `ctx.body === undefined`. Only `multipart/*` throws (`unsupportedContentType`, `combined.ts:176-181`). Elysia 2 now answers 415 "when unsure about content-type".
- **Impact:** A handler that forgets to check `ctx.body` proceeds with `undefined`; validation middleware reports a confusing "body required" instead of "wrong media type".
- **Fix (non-breaking first):** add `bodyParser({ onUnsupportedContentType: 'ignore' | 'reject' })`, default **`'ignore'`** (today's behaviour). `'reject'` throws `Errors.unsupportedContentType(contentType)` (status 415, code `UNSUPPORTED_CONTENT_TYPE`) when the method has a body, a `Content-Type` is present and no parser matched. Document it; recommend `'reject'` for JSON APIs; list "flip the default to `'reject'`" as a breaking change for the next major.
- Change the probe entry: in `apps/benchmark/scripts/dev-check/entries/probe-server.ts` use `bodyParser({ onUnsupportedContentType: 'reject' })` so the probe asserts the new behaviour.

## Reproduce

```bash
node apps/benchmark/scripts/dev-check/check.mjs probe --rt bun     # FAIL/KNOWN error-code-4xx, error-no-engine-text, unsupported-content-type
node apps/benchmark/scripts/dev-check/check.mjs probe --rt node
```

## Tests first

- `packages/core/src/__tests__/error-handler.test.ts`: a plain `Error` with `status = 400, code = 'INVALID_JSON'` → body `code === 'INVALID_JSON'`; plain `Error` with `status = 404` and no code → `NOT_FOUND`; 5xx with a string `code` → still `INTERNAL_ERROR` and message masked; `NextRushError` unchanged.
- `packages/middleware/body-parser/src/__tests__/body-parser.test.ts`: invalid JSON message is exactly `"Invalid JSON"` and `error.cause` holds the engine message; same body string under Bun and Node (run the package tests on both, or assert via the conformance suite).
- New tests for `onUnsupportedContentType`: `'ignore'` default unchanged; `'reject'` → 415; bodyless methods and absent `Content-Type` never reject; matched types unaffected.
- Conformance: an "invalid JSON body" scenario asserting an identical body on node/bun/deno/edge.

## Acceptance criteria

- [ ] New tests fail before, pass after.
- [ ] `check.mjs probe` on bun **and** node: the three FB-05 probes PASS. `FB-05` removed from `knownFailures`.
- [ ] No change to any existing 5xx response body (snapshot tests).
- [ ] `pnpm --filter @nextrush/core --filter @nextrush/body-parser test`, conformance, typecheck, lint green; docs + CHANGELOG updated.

## Do NOT

- Do not change the error JSON *shape* (`error`, `message`, `code`, `status`) here — the move to `application/problem+json` (RFC 9457) is GP-03.
- Do not expose `cause`, stack traces or engine messages in any response.
