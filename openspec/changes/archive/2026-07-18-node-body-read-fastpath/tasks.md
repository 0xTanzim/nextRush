## 1. Preparation, baseline & characterization (do FIRST)

- [x] 1.1 Capture a baseline `pnpm bench:compare --profile full` on the **POST JSON** scenario and `pnpm bench:validate` passing; record the `@nextrush/adapter-node` coverage baseline.
- [x] 1.2 Write a **differential/characterization harness** and behavior matrix against the current `buffer()`/`text()`/`json()` over a payload corpus: empty, small, large-but-under-limit, over-limit (via content-length AND via streaming), multi-chunk, and mixed chunk types (`Buffer`/`string`/`Uint8Array`/`ArrayBuffer`) — snapshotting bytes and thrown error types as the contract.

## 2. RED — body-read behavior matrix (write failing/characterizing first)

- [x] 2.1 Normal body → correct bytes; empty body → empty buffer; `text()`/`json()` identical; invalid JSON → `BadRequestError`.
- [x] 2.2 Content-length over limit → `BodyTooLargeError` before any bytes consumed.
- [x] 2.3 Streamed body over limit (no/incorrect content-length) → `this.req.destroy()` + `BodyTooLargeError(limit, totalRead)` mid-stream.
- [x] 2.4 Second read → `BodyConsumedError`; re-read after success → cached buffer, no re-attach.
- [x] 2.5 All chunk types converted via `chunkToBuffer` and concatenated correctly.

## 3. RED — stream-lifecycle edge cases (critical)

- [x] 3.1 Already-ended stream → `buffer()` resolves (empty) without hanging.
- [x] 3.2 Stream `error` mid-read → rejects with that error.
- [x] 3.3 Client disconnect / premature close mid-body → rejects (promise never left pending).
- [x] 3.4 Limit breach near end → settles exactly once (single `BodyTooLargeError`, no resolve-and-reject).
- [x] 3.5 On settle (end / error / limit-destroy) → all `data`/`end`/`error`/`close` listeners removed (assert listener count).
- [x] 3.6 `stream()` path unchanged (regression guard).
- [x] 3.7 Verify §2–§3 tests FAIL/characterize appropriately before the rewrite.

## 4. GREEN — implement the event-listener read

- [x] 4.1 Keep the synchronous preamble (cached return, `BodyConsumedError`, content-length pre-check, `_consumed = true`).
- [x] 4.2 Replace `for await…of` with a `Promise` that attaches `data`/`end`/`error`/`close` synchronously: `data` → `chunks.push(chunkToBuffer(chunk))` + running-total limit check (destroy + reject on breach); `end` → resolve `Buffer.concat(chunks)`; `error`/premature-`close` → reject.
- [x] 4.3 Add the `settled` guard (single settle) + listener cleanup on settle, and the `req.readableEnded` already-ended guard.
- [x] 4.4 Cache `_cachedBuffer` on success; leave `text()`/`json()`/`stream()` unchanged.
- [x] 4.5 Run §2–§3 tests to GREEN; iterate until all pass.

## 5. Verification & finalize

- [x] 5.1 Differential harness green over the full payload corpus (bytes + error types identical to the pre-change reader).
- [x] 5.2 Full `@nextrush/adapter-node` suite + `bench:validate` parity green; `--profile full` POST-JSON A/B shows no regression (record the delta; do not overstate — `JSON.parse` dominates POST).
- [x] 5.3 Per-package coverage ≥90% with the rewritten `buffer()` branches (limits, errors, already-ended, cache) covered; typecheck + lint clean.
- [x] 5.4 Run `openspec validate node-body-read-fastpath --strict`; prepare an atomic commit scoped to `packages/adapters/node/src/body-source.ts` + tests (+ optional micro-bench).
- [x] 5.5 On archive, update the report §9 findings index (HP-16 → ✅) and note whether a `WebBodySource` sibling follow-up is warranted.
