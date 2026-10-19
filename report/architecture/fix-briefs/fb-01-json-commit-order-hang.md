# FB-01 — `ctx.json()` hangs (Node) or returns an empty 200 (Bun/Deno/Edge) when serialization fails

| Field | Value |
| --- | --- |
| **Severity / Priority** | **High** · P0 |
| **Area** | `@nextrush/adapter-node` (`context.ts`), `@nextrush/runtime` (`response-builder.ts`), `@nextrush/core` (`application.ts` `handleError`) |
| **Depends on** | — |
| **RFC-gated** | No |
| **Size** | S |
| **Probe ids** | `json-bigint`, `json-circular`, `json-undefined` (`knownFailures: FB-01`) |

## Finding

- **Current situation:** `ctx.json(data)` sets `_responded = true` *before* `JSON.stringify(data)`. `BigInt`, circular structures and `undefined`-with-`Buffer.byteLength` throw **after** the flag is set. The app error handler then calls `ctx.json({...error...})`, which sees `_responded === true` and returns silently. Nothing is ever written.
- **Impact:** Node: the client waits until the socket times out (curl: `exit 28` after 6 s) and the default logger printed nothing in the probe run. Bun/Deno/Edge/serverless: **HTTP 200 with an empty body** (wrong status, wrong body). Triggered by very common application bugs (a Prisma/pg `BigInt` id, a cyclic ORM object, returning `undefined` from a repository). Each hung request also holds a connection.
- **Benefits of today's design:** The early flag stops a handler from responding twice.
- **Drawbacks:** The flag means "response started", but it is set before the fallible step, so it also means "response will never be written".
- **Long-term risk:** Same shape exists anywhere a method sets `_responded` before a throwing call (`send()` default branch `String(data)` with a `Symbol`; `html`/`redirect` are safe).
- **Recommendation:** Serialize first, set the flag after. Add a second safety net so an error handler that fails to respond can never leave a request unanswered.
- **Trade-offs:** None measurable — `JSON.stringify` still runs once.
- **Migration difficulty:** Trivial. Behaviour change is a fix (hang/empty → clean 500).

## Reproduce

```bash
node apps/benchmark/scripts/dev-check/check.mjs probe --rt node   # KNOWN json-bigint status=0 timedOut=true
node apps/benchmark/scripts/dev-check/check.mjs probe --rt bun    # KNOWN json-bigint status=200 bytes=0
```

## Root cause (file:line)

- `packages/adapters/node/src/context.ts:323-328` — `if (this._responded || …) return; this._responded = true; … const json = JSON.stringify(data);`
- `packages/runtime/src/response-builder.ts:192-201` — `WebResponseBuilder.json`: `this._responded = true; … this._body = JSON.stringify(data);` (shared by Bun, Deno, Edge, serverless).
- `packages/core/src/application.ts:717-737` — `handleError` calls the default handler, which calls `ctx.json`; no check that the response actually got written.
- Why the safety net never fires: `app.callback()` swallows handler errors into `handleError` (resolves), so the adapter's `finalizeError` 500 path (`adapters/node/src/adapter.ts:250-257`) is never reached.

## Fix — step by step

1. **Serialize before committing.** In both `NodeContext.json` and `WebResponseBuilder.json`:
   ```ts
   json(data: unknown): void {
     if (this._responded) return;               // keep the headersSent check on Node
     const body = JSON.stringify(data);         // may throw: BigInt / circular
     if (body === undefined) {
       throw new TypeError('ctx.json() received a value that cannot be serialized to JSON (undefined, function or symbol)');
     }
     this._responded = true;                    // only after we know we can write
     …
   }
   ```
   Keep one shared helper (e.g. `serializeJsonBody(data): string` in `@nextrush/runtime`) so Node and Web cannot drift again; Node imports it from runtime (core/runtime already sit below adapters).
2. **Never leave a request unanswered.** In `Application.handleError` (after the custom/default handler ran): if `!ctx.responded`, force a minimal 500:
   ```ts
   if (!ctx.responded) {
     try { ctx.status = 500; ctx.json({ error: 'Internal Server Error', message: 'Internal Server Error', code: 'INTERNAL_ERROR', status: 500 }); } catch { /* adapter finalizer will answer */ }
   }
   ```
   (After step 1, `ctx.responded` is accurate, so this is a real signal.)
3. **Adapter finalizers.** In Node `finalizeSuccess` / Web runners, if after the chain `!ctx.responded && ctx.status >= 500`, write the same minimal body instead of returning an empty response. (Web runners already do this for 404.)
4. **Logging.** Make sure the serialization `TypeError` is logged once by the default error path (5xx are always logged — `core/src/error-handler.ts:36`).
5. Audit other write methods for the same ordering (`send` default branch, `ctx.ndjson`/`ctx.sse` writers) and fix if they set a committed flag before a throwing call.

## Tests first

- `packages/adapters/node/src/__tests__/context-json-serialize-failure.test.ts` (new): real `serve()` on port 0; handlers returning `{n: 10n}`, a circular object, `undefined`; assert **HTTP 500 within 1 s**, JSON body, connection answered.
- `packages/runtime/src/__tests__/response-builder.test.ts`: `json(circular)` throws and leaves `responded === false`; a subsequent `json({error})` succeeds.
- `packages/core/src/__tests__/application.test.ts`: custom error handler that forgets to respond → request still gets a 500.
- Conformance scenario `json-serialization-failure` in `packages/adapters/conformance` (all adapters: 500, never empty 200, never hang).

## Acceptance criteria

- [ ] New tests fail before, pass after.
- [ ] `check.mjs probe` on `--rt node` and `--rt bun`: `json-bigint`, `json-circular`, `json-undefined` PASS.
- [ ] `FB-01` removed from `knownFailures`.
- [ ] `check.mjs inproc` — no regression > 5 %; `pnpm bench:alloc:handler` unchanged.
- [ ] `pnpm --filter @nextrush/adapter-node --filter @nextrush/runtime --filter @nextrush/core test`, conformance, typecheck, lint green.

## Do NOT

- Do not catch-and-swallow the `TypeError` inside `json()` — it must reach the app error handler.
- Do not change the "second `json()` call is a no-op" contract for already-written responses.
