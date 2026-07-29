# Design — Elide redundant resolved-promise allocation in `compose()`

## Context

`compose()` is the single hottest function in the framework: every request crosses it exactly once
per middleware layer. It is also load-bearing for three deliberately-tested guarantees — ordered
dispatch, double-`next()` detection, and "never throw synchronously" — so an allocation
optimization here must be provably semantics-preserving, not merely test-passing.

Prior art in this repo, all preserved:

- `packages/router/src/dispatch.ts` — `const RESOLVED: Promise<void> = Promise.resolve()`, returned
  on the miss path.
- `packages/router/src/segment-trie.ts` — `RESOLVED_PROMISE` + `NOOP_NEXT`.
- `archive/2026-07-29-reduce-router-match-allocations` task 4.3 — the general path's per-layer
  `nextFn` closure allocation was investigated and found **not** removable without codegen, because
  the double-next guard needs per-invocation identity captured at closure-creation time. That
  conclusion is not revisited; this change is strictly about the *returned promise*, never about the
  `nextFn` closure.

## Decisions

### D1 — A shared module-level resolved promise is safe to hand out

A promise is immutable from the consumer's side: there is no API to change a settled promise's
state or value. Attaching `.then`/`.catch`/`await` to the same resolved promise from many concurrent
requests is well-defined — each `.then` allocates its *own* derived promise and schedules its own
microtask; the shared sentinel is only ever read. Node's own internals and this repo's router
already rely on this.

What would make it unsafe, and is therefore forbidden: any consumer attaching an expando property
to the returned promise, or relying on referential *uniqueness* of the returned promise to identify
a request. Neither exists in this codebase (verified: no consumer does either), and both would be
defects independent of this change.

### D2 — The predicate is `=== undefined`, never `instanceof Promise` (load-bearing)

`packages/router/src/segment-trie.ts:94` carries an explicit warning against exactly the tempting
shortcut:

> `Promise.resolve(...)` — NOT `x instanceof Promise ? x : RESOLVED` — so a non-Promise THENABLE
> return is adopted (its async work awaited), not dropped

An `instanceof Promise` test would classify a **non-Promise thenable** (a `{ then(cb) {...} }`
object, a Bluebird/`zone.js` promise, a mock in a user's test) as "not a promise" and substitute
`RESOLVED` — silently discarding that thenable's async work and resolving the request early. That
is a correctness bug, not a performance trade-off.

Therefore the branch is:

```ts
const result = fn(ctx, nextFn);
return result === undefined ? RESOLVED : Promise.resolve(result);
```

`undefined` is the *only* value short-circuited, and `Promise.resolve(undefined)` is by
specification a promise resolved with `undefined` — observably identical to `RESOLVED`. Every other
value, thenable or not, keeps its current `Promise.resolve(...)` adoption path byte-for-byte.

Deliberately **not** short-circuited, even though they look harmless:

| Return value | Why it must not take the sentinel |
| --- | --- |
| `null` | `Promise.resolve(null)` resolves with `null`, not `undefined`. Distinguishable by a consumer that inspects the resolved value. |
| `false`, `0`, `''` | Same — falsy is not `undefined`. A `!result` test would be a bug. |
| a thenable | Must be adopted so its async work is awaited (D2's whole point). |

### D3 — The return type stays `Promise<void>`; no sync-return API

The larger theoretical win is returning `void` for synchronous middleware and skipping the promise
entirely. Rejected:

- `ComposedMiddleware` is exported from `@nextrush/core`; widening it to `void | Promise<void>` is a
  public API change, RFC-gated under this repo's own rules.
- Every consumer (`Application.callback()`'s `fn(ctx).then(...)`, each adapter) would need a
  `typeof result?.then === 'function'` branch, pushing cost and a new failure mode onto ~6 call
  sites to save one allocation.
- It would break the "never throw synchronously" contract's uniformity: a sync return path has no
  promise to reject into.

The sentinel captures most of the available win at a fraction of the blast radius.

### D4 — Scope is one file, and the benchmark is explicitly not the success metric

Only `packages/core/src/middleware.ts` changes. The success metric is the allocation harness on a
*synchronous* middleware stack, because that is the only instrument that can observe this change.
Stating a benchmark-throughput goal would be unfalsifiable noise on this hardware — the measured
between-batch drift is ±25–58% unpinned and ~1–5% pinned, both far larger than a 72 B/op effect.

## Risks / Trade-offs

| Risk | Severity | Mitigation |
| --- | --- | --- |
| A thenable return gets dropped instead of adopted | **High** — silent early resolution | D2's `=== undefined` predicate; a dedicated RED test asserting a non-Promise thenable's work still completes |
| A falsy-but-defined return (`null`/`0`/`false`/`''`) collapses to `undefined` | Medium — changes the resolved value | Predicate is strict `===`, never `!result`; RED test per falsy value |
| A consumer relies on the returned promise's identity | Low — none exists today | Verified no consumer does; D1 documents it as a forbidden pattern |
| Shared sentinel accumulates `.then` handlers | None — a misconception | Each `.then` allocates its own derived promise; the sentinel holds no handler list after settling |
| Masks a future `await`-inside-compose refactor | Low | The sentinel is only returned where the current code already returns an immediately-resolved promise; no new synchronicity assumption is introduced |

## Rollback Plan

The change is a single-file, additive-constant edit with no migration, no persisted state, no
public API change, and no cross-package coupling — so rollback is a plain revert with nothing to
undo behind it.

**Blast radius:** reversibility `trivial` (0) — `git revert` fully restores prior behavior, no
redeploy-only side effects, no data touched. Scope `single_module` (1). Detectability
`immediate_test_failure` (0) — every risk in the table above is covered by a test that fails loudly
rather than degrading silently. **Total: 1 → auto-apply, no gate.**

### Triggers — revert immediately if any occurs

1. Any test in `packages/core` fails and is not fixed within the same session.
2. `packages/adapters/conformance` shows any cross-adapter divergence.
3. The thenable-adoption or falsy-return tests fail (that is the D2 hazard materializing).
4. Any `unhandledRejection` or `MaxListenersExceededWarning` appears in a benchmark server log that
   was not present before.
5. `bench:validate` parity breaks across the six servers.
6. The synchronous-middleware allocation measurement does **not** improve — meaning the change adds
   risk for zero benefit, which is itself a revert trigger, not a "ship anyway."

### Procedure

```bash
# 1. Revert the single commit (or the file, pre-commit)
git revert --no-edit <sha>          # committed
git checkout HEAD -- packages/core/src/middleware.ts   # uncommitted

# 2. Rebuild the one affected package
pnpm --filter @nextrush/core build

# 3. Confirm restoration — all three must pass
cd packages/core && pnpm test                    # 173 tests
cd packages/adapters/conformance && pnpm test    # 290 tests
cd apps/benchmark && node scripts/validate-parity.js
```

Rebuilding `@nextrush/core` is required because dependent packages consume `dist/`, not `src/` —
a source-only revert without a rebuild leaves the old artifact in place and makes the revert look
ineffective. This is the one non-obvious step.

**Verification that rollback worked:** the spike proved the pre-change behavior is directly
observable — a synchronous middleware's composed call returns a *fresh* promise per invocation
(84.0 B/op) rather than a shared sentinel. `composed(ctx) !== composed(ctx)` distinguishes
reverted from applied without relying on a benchmark.

**Partial-rollback option:** the four call sites are independent. If one specific path is
implicated, that single `RESOLVED` can be reverted to `Promise.resolve()` while the other three
stay — no all-or-nothing coupling. The middleware-return path (D2's hazard) is the one most likely
to be reverted alone, and it is also the one carrying the measured benefit, so a partial rollback
there is effectively a full functional rollback.

## Migration

None. No public API, type, or behavior change; no consumer action required.
