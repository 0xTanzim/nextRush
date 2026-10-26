# Design

## Context

This change implements Phase 1 of [`RFC-045`](../../../docs/RFC/runtime-adapters/045-bun-request-hotpath-phase-1.md). Read the RFC for the full problem statement, measurements, alternatives, risks, and rollback plan. This document records the implementation decisions that are specific to the change.

Status: design-only. No production code is included until the RFC and the spec deltas are reviewed.

The measured facts that shape the design:

- Bun runner POST: 9.91–10.40 µs for a 1 KB JSON body; native floor 2.47–2.57 µs.
- Buffer body read: `ctx-body-source` 6.07 µs vs `ctx-text-json` 3.81 µs.
- Timeout wrapper: `full-hybrid` 9.88 µs vs `full-callback` 7.39 µs; the timeout probe is noisy, so acceptance is measurement-gated.
- Parser chain: `body-parser` 7.28 µs vs `ctx-body-source` 6.07 µs.
- RFC-043 already uses `request.arrayBuffer()` when `Content-Length` proves the body fits. This change adds the text equivalent for the JSON case and keeps the RFC-043 byte path as the fallback.
- RFC-044 already removed the Bun drain wrapper and the IP-resolver thunk. This change must not reintroduce either.

## Decisions

### 1. The limited text read is an internal capability, not a public `BodySource` method

`BodySource.text()` has no limit parameter. Adding one would let a caller pass a limit to an implementation that ignores it, silently bypassing the parser's configured limit. Instead, `WebBodySource` implements:

```ts
textWithinLimit(limit: number): Promise<string>;
```

The method is not added to `@nextrush/types` `BodySource`. Body-parser detects it structurally:

```ts
interface TextCapableBodySource {
  textWithinLimit?(limit: number): Promise<string>;
}
```

`WebBodySource.text()` calls `textWithinLimit(this.options.limit)`, so existing callers get the native path without a signature change. `AbstractBodySource.text()` and `NodeBodySource.text()` remain for non-Web sources. Node has no `Request.text()` and keeps its event-listener byte path.

**Rejected:** `text(limit?: number)` on `BodySource` — the ignored-limit failure mode is worse than the extra internal method.

### 2. Native text eligibility mirrors RFC-043's provable-length condition

Native `request.text()` is used only when:

- the source's configured encoding is UTF-8 (`utf-8`/`utf8`);
- `contentLength` is present and at or below the effective limit;
- the caller has not requested bytes (`rawBody`/`verify` are absent at the body-parser layer).

Every other case uses `buffer(limit)`:

- no `Content-Length` (chunked/absent);
- declared length over the limit (rejected by the existing pre-check);
- non-UTF-8 encoding (native `text()` is UTF-8 only);
- `rawBody` or `verify` (bytes are part of the contract);
- a source without the internal capability (Node and third-party sources).

This is the same condition RFC-043 uses for `request.arrayBuffer()`. An understated `Content-Length` is still possible; the post-read byte check is the authority, and the platform's framing/body cap remains the backstop. The change does not weaken the post-read check and does not introduce a second read.

### 3. Actual byte-limit enforcement uses bounds before encoding

The text path cannot compare `text.length` to a byte limit. UTF-8 bytes can be up to three times the UTF-16 code-unit length. The check is:

```ts
const UTF8_ENCODER = new TextEncoder();

function assertTextWithinLimit(text: string, limit: number): void {
  if (text.length * 3 <= limit) {
    return;
  }
  if (text.length > limit) {
    throw new BodyTooLargeError(limit, text.length);
  }
  const byteLength = UTF8_ENCODER.encode(text).byteLength;
  if (byteLength > limit) {
    throw new BodyTooLargeError(limit, byteLength);
  }
}
```

- `text.length * 3 <= limit` is an upper bound: actual bytes cannot exceed the limit.
- `text.length > limit` is a lower bound: actual bytes cannot be under the limit.
- Between those bounds, `TextEncoder` computes the exact UTF-8 byte length.

The common 1 KB JSON body with a 1 MB limit takes the first branch and does not encode. The uncertain band pays one encode but still avoids the `arrayBuffer` + `Uint8Array` + `TextDecoder` path. `Buffer.byteLength` is faster on Bun, but `runtime` must stay runtime-independent; `TextEncoder` is Web-standard.

**Rejected:** `text.length` directly — unsafe for non-ASCII bodies. **Rejected:** declared `Content-Length` as the final count — it can be understated.

### 4. Body state and cache semantics

`WebBodySource` gains `_cachedText: string | undefined`. The existing `_consumed` and `_cachedBuffer` stay authoritative.

`textWithinLimit` order:

1. Cached buffer exists: decode it with the configured encoding, cache the text, return.
2. Cached text exists: return it.
3. Consumed with no cache: throw `BodyConsumedError`.
4. `contentLength > limit`: throw `BodyTooLargeError`.
5. Eligible native text: mark consumed, `await request.text()`, assert the byte limit, cache text, return.
6. Otherwise: `await this.buffer(limit)`, decode, cache text, return.

`buffer(limit?)` gains one behavior: if `_consumed` is true, `_cachedBuffer` is absent, and `_cachedText` is present, it encodes the cached text once, caches the bytes, and returns them. This preserves the common `text()`-then-`buffer()` cache behavior for valid UTF-8. It is not a general byte-preserving operation for malformed UTF-8, which is why `rawBody` and `verify` never enter the text path. The public `BodySource` docs already state that a second read after consumption may throw; this design keeps the valid-JSON case working.

**Rejected:** throw `BodyConsumedError` after a text read — stricter, but it breaks the current cache behavior for a legitimate later byte read. **Rejected:** cache both representations eagerly — doubles retention for bytes no one asked for.

### 5. Depth guard uses a safe text upper bound

The buffer path keeps the existing exact `buffer.length >= 2 * (maxDepth + 1)` gate. The text path cannot use exact bytes without encoding every request, so it uses:

```ts
const depthThreshold = 2 * (maxDepth + 1);
const mayReachDepth = maxDepth !== undefined && text.length * 3 >= depthThreshold;
```

UTF-8 bytes are at most three per UTF-16 code unit, so `text.length * 3 < depthThreshold` proves the body cannot reach the depth. If the bound is at or above the threshold, the traversal runs. This may walk a small non-ASCII payload the exact byte length would have skipped; it never skips a payload that could exceed `maxDepth`. `maxDepth: Infinity` keeps the current skip behavior.

**Rejected:** `text.length` as the threshold — it is a lower bound; using it to skip can weaken the guard. **Rejected:** exact `TextEncoder` byte length on every text read — safe but gives back part of the measured win; the upper bound is sufficient.

### 6. One shared JSON parse path; combined routes directly

`json.ts` exports an internal `parseJsonPrechecked(ctx, options)` function (not re-exported from the package index). It owns:

- the `rawBody`/`verify` branch (buffer path);
- the text branch (limited text read);
- empty-body `next()` behavior;
- `JSON.parse` with `reviver`;
- strict-mode validation;
- the depth guard;
- `ctx.body` assignment;
- error mapping to `BodyParserError`.

`json()` keeps its public middleware behavior: detect method/content-type unless `prechecked`, call `parseJsonPrechecked`, then `next()`. `combined()` calls `parseJsonPrechecked` directly after its one content-type detection, then calls `next()` itself. This removes one middleware await frame while preserving the existing single-detection contract and the same output as standalone `json()`.

`readText(ctx, limit)` is the one read-policy helper:

1. No body source: return `''`.
2. Declared `content-length > limit`: throw `Errors.entityTooLarge`.
3. Source has `textWithinLimit`: call it, map `BodyConsumedError`/`BodyTooLargeError`/read errors the same way `readBody` does.
4. Otherwise: `readBody(ctx, limit)` + `bufferToString`.

The text and buffer branches share `parseJsonText` and `parseJsonBuffer`; the only difference is how the input is obtained and how the depth threshold is proven.

**Rejected:** keep the current five-await chain and only swap the read — it leaves the extra frame and duplicates the parse/error logic. **Rejected:** put JSON parsing in `runtime` — it belongs to body-parser, and runtime must not depend on middleware.

### 7. Timeout dispatch uses the committed-response signal, then races directly

`dispatchWithTimeout` becomes:

```ts
async function dispatchWithTimeout(
  ctx: WebRunnerContext,
  dispatch: Dispatch,
  timeoutMs: number,
  onTimeout: () => void
): Promise<boolean> {
  for (let turn = 0; turn < SETTLE_TURNS && !ctx.responded; turn += 1) {
    await Promise.resolve();
  }
  if (ctx.responded) {
    await dispatch;
    return false;
  }

  const TIMEOUT = Symbol('timeout');
  let timerId: ReturnType<typeof setTimeout> | undefined;
  try {
    const winner = await Promise.race([
      dispatch,
      new Promise<typeof TIMEOUT>((resolve) => {
        timerId = setTimeout(resolve, timeoutMs, TIMEOUT);
      }),
    ]);
    if (winner === TIMEOUT) {
      onTimeout();
      return true;
    }
    return false;
  } finally {
    if (timerId !== undefined) clearTimeout(timerId);
  }
}
```

The settlement promise is gone. `Promise.race` attaches handlers to `dispatch`, so a late rejection is observed rather than unhandled. A handler that settles without committing a response may arm a timer, but its promise wins the race and the timer is cleared; no 504 is produced. A handler that commits after the timeout still hits the caller's `hasCommittedResponse(ctx)` check and returns its response. `ctx.responded` is the same signal the Node adapter's fast path checks (`ctx.responded || res.headersSent`), so the timer-skip semantics align across adapters.

This is a clarification of the existing spec wording "settled synchronously": the meaningful condition is a committed response, not promise settlement. The 504 body, signal abort, warning, and late-committed-response behavior are unchanged. A new spec scenario makes the settled-no-response timer behavior explicit.

**Rejected:** keep the settlement promise — it preserves the old no-timer behavior for a settled-no-response handler but retains the allocation this phase targets. **Rejected:** shared timer wheel — larger, separate RFC.

### 8. Cross-runtime and package boundaries

- `runtime` and `body-parser` import no adapter and no `node:*`.
- `TextEncoder`/`TextDecoder` are Web-standard.
- `WebBodySource` is shared by Bun, Deno, and Edge; `NodeBodySource` is untouched.
- The capability is detected structurally, not by runtime name.
- No new dependency, no `eval`/`new Function`, no build step.

## Risks and trade-offs

- **Malformed UTF-8 after a text read:** a later `buffer()` returns canonical UTF-8 bytes, not the original malformed sequence. `rawBody`/`verify` never use the text path; valid JSON is valid UTF-8. Add a valid-UTF-8 round-trip test and document the caveat.
- **Understated `Content-Length`:** the text read may materialize more than the declared length before the post-read check rejects it. This is the same condition RFC-043 accepts for `arrayBuffer()`; the platform framing/body cap is the backstop. Add an understated-length test.
- **Timer-skip predicate:** a settled-no-response handler may arm a timer. The direct race clears it and no 504 is produced; add an explicit test and spec scenario.
- **Error-shape drift:** share the parse helpers and assert `code`, `status`, and client-safe message on both paths.
- **Depth guard:** use only the safe upper bound; test payloads just below and just above `maxDepth` on both paths.
- **Performance noise:** the timeout probe is noisy; accept on a CPU-pinned A/B above spread, otherwise park the timeout change. The body and parser changes are measured separately.

## Verification

- Runtime unit tests: native text, buffer fallback, absent/chunked/understated/over-limit, `text()`/`buffer()` order, valid-UTF-8 round-trip, `BodyConsumedError`.
- Body-parser unit tests: text vs buffer equality, empty body, strict, depth, `rawBody`, `verify`, invalid JSON, `next()` ordering, combined vs standalone.
- Runner tests: sync commit, async settle, settled-no-response, timeout 504, signal abort, late commit, rejection before/after timeout, no-timeout.
- Adapter/conformance: Bun, Deno, Edge identical; Node suite unchanged.
- Performance: CPU-pinned in-process A/B; `dev-check inproc`; wire directional only; coverage `>= 90%`; lint and `tsc --strict` clean.
