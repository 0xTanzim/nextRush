# ADR-0036 — Opt-in lazy body parsing with a per-request deferred reader

- **Status:** `Accepted`
- **Date:** `2026-10`
- **Deciders:** `NextRush maintainers`
- **Governing RFC:** `docs/RFC/request-data/047-lazy-body-parsing.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0035`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped` · `[████████████████░░░░]` **Accepted** — 2 / 3

Shipped when the RFC-047 change is released.

---

## Context

The body parser reads, verifies, and parses the body before `next()` runs, for every request with
a matching media type. Measured on Bun 1.4.4 with a 1 KB JSON `POST`, that stage costs ~2.85 µs
of the ~9.4 µs request — and a large share of endpoints never read the body they pay for: health
checks, auth rejections, early `401`/`404` paths, and handlers that read headers or query only.

The read must stay before the handler by default. Deferring it changes error timing (a malformed
body can no longer preempt the handler), so the change cannot be unconditional without a breaking
release and a codemod.

## Decision

**We will ship body parsing as opt-in lazy per `bodyParser()` call, implemented as one deferred
reader installed on the context, and we will keep eager parsing as the default.**

Four parts make the decision:

1. **One flag per call, not per parser.** `lazy: true` on `bodyParser()` or any individual
   factory. Detection (method, existing body, media type) stays eager because it decides
   ownership and needs no bytes; byte acquisition, limit, `verify`, decode, parse, and the depth
   guard all run inside `readBody()`.
2. **One implementation of the work.** Each factory returns `{ middleware, read }` from a single
   closure, and `bodyParser()` calls `read` directly. Lazy mode changes _when_ `read` runs, never
   _what_ it does, so error codes, statuses, envelopes, and `verify` ordering cannot diverge.
3. **A per-request throwing accessor, not a class-level one.** `ctx.body` becomes an own accessor
   on a claimed request only. The alternative — declaring `body` as an accessor on the context
   class — would charge every eager request (the default) for an opt-in feature.
4. **A write is authoritative.** The reader holds unset / in-flight / settled state, and any write
   to `ctx.body` (validation's coercion, the router's or CORS's empty-body writes) settles it: a
   later `readBody()` returns the written value, and a read that resolves afterwards cannot
   overwrite it.

The reader is reached through a `Symbol.for` slot plus `Context.readBody()`, so the parser and the
runtime share one identity even when source and build output are both loaded.

## Options

| Option                                    | Why not                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Lazy by default                           | Breaking: error timing, `413` timing, and `ctx.body` semantics change for every existing app; needs a major and a codemod                  |
| Separate `lazyBodyParser()` middleware    | Two implementations of limits, decode, verify, depth guard, and error mapping — the divergence this design exists to prevent               |
| Class-level `body` accessor in both modes | Removes the ~100 ns install but adds a getter plus two state fields to every eager context; pays for an opt-in feature on the default path |
| Return a promise from `ctx.body`          | Every existing `ctx.body` read changes meaning; no fail-fast for a forgotten await                                                         |

## Consequences

- An unread lazy request skips the parser stage entirely: −31 % end-to-end, −46 % of the
  framework's own CPU above the request floor, with zero body-source calls counted.
- A lazy request that _does_ read pays ~0.4–0.5 µs more than eager (accessor install, reader, one
  promise hop). Documented, measured, and accepted: the win lands on the requests that avoid the
  work, the cost on those that do it anyway.
- `ctx.readBody()` is a required `Context` member: applications are unaffected, but a custom
  `Context` implementation (external adapter, hand-written test double) must add it.
- `@nextrush/express-bridge` stays eager-only; its `req.body` is a synchronous proxy getter.
- Guarded class routes read eagerly (guards and `@Body()` resolution consume the body before the
  handler), so the gain does not apply to that style.
- A transport-level cap still applies where the runtime has one (Bun's `maxRequestBodySize`); the
  other adapters have none, and this change adds and relaxes none.

## Compliance

- `packages/middleware/body-parser/src/__tests__/lazy-parsing.test.ts` pins the contract: no read,
  no parse, no `verify`, no depth walk on the unread path; one read shared by concurrent callers;
  cached failures; write/read agreement; a later eager parser skipping a claimed request.
- `packages/adapters/conformance` runs the shared suite in both modes on all six drivers, plus
  targeted real-socket tests on Bun and Deno and a real-workerd run.
- Measured results and the missed read-path target are recorded in RFC-047 §14 and
  `report/performance/campaign-scoreboard.md` §16.
