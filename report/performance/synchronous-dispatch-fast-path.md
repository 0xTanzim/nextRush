# Synchronous dispatch fast path — measurement record

Question: NextRush answered every request through a promise, even when the route handler finished
synchronously. `hono.fetch` returns a bare `Response` in that case. Does removing the promise at the
runtime boundary close the Bun GET gap, and what does it cost elsewhere?

**Outcome: implemented, measured, kept.** Bun GET **−13.6 %** server CPU per request (4/5 pairs)
and Deno GET **−10.9 %** (5/5), with POST unchanged on both by construction and Node POST −3.0 %
(3/3) as a side effect of one shared sentinel. An independent earlier window reproduced the two
headline rows (Bun −11.7 %, 5/5; Deno −6.8 %, 3/3). The Bun GET gap to Hono narrowed from ~1.24× to
**1.10×**; the remaining largest gap is POST body reading (1.31×).

Machine: Intel Core i5-8300H (4C/8T, shared; SMT siblings 0↔4, 1↔5, 2↔6, 3↔7). Measured
2026-10-23 with **Bun 1.4.3**, **Node v26.12.0**, **Deno 2.9.7**, Hono 4.13.0. The box now reports
Bun 1.4.4, so re-measure before quoting these figures as current.

Revisions: 2026-10-23 — first record, written from the cycle's own runs and the raw files under
`report/performance/raw/` (kept on the measurement machine, gitignored, never committed).

## 1. What changed

| #   | Change                                                                                                                                                                                             | File                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | `DISPATCH_SETTLED_SYNC` (`Symbol.for`) and `DispatchMarkerCarrier` — the router→runner protocol                                                                                                    | `packages/types/src/dispatch-marker.ts` (new), `packages/types/src/index.ts` |
| 2   | The no-per-route-middleware executor branch marks the context when the handler returned a non-promise, and returns one shared resolved sentinel instead of allocating `Promise.resolve(undefined)` | `packages/router/src/segment-trie.ts`                                        |
| 3   | `Application.syncDispatchSafe` — true only when the middleware stack is exactly one entry **and** that entry is the root-mounted router dispatch                                                   | `packages/core/src/application.ts`                                           |
| 4   | `createWebRunner` returns `Response \| Promise<Response>` and answers with the built `Response` when the marker is honoured                                                                        | `packages/runtime/src/web-runner.ts`                                         |
| 5   | `BunFetchHandler`, Deno `createHandler`, edge `createFetchHandler` / Cloudflare `fetch` widen their return types to match                                                                          | adapters bun, deno, edge                                                     |
| 6   | Tests for each layer, the changeset, this record, and the raw harness                                                                                                                              | see §7 and §14                                                               |

The Node adapter is untouched: it owns a callback-based runner, so it never had this promise at the
boundary.

## 2. Why the gap existed

The runner was declared `async`, so a synchronous handler still cost a chain of microtask turns
before the runtime received a value. The turn count was measured directly, 2000 requests per arm, by
wrapping the returned value and counting `await`s until it stopped being a thenable:

| Arm                                 | Turns to settle                     |
| ----------------------------------- | ----------------------------------- |
| `hono.fetch`, synchronous handler   | **0** (a bare `Response`)           |
| NextRush, GET route                 | 4 (1999/2000 requests), 10 (1/2000) |
| NextRush, POST route (`bodyParser`) | 13/2000                             |

The mechanism's ceiling was measured before any production code was written: a throwaway runner that
returned a bare `Response` for a synchronous handler, everything else unchanged, gave **−8.2 %
(4/5 pairs)**. That number decided the cycle's direction and bounds what the shipped path can win.

This is a boundary effect, not slower code inside the request. The framework's own work (routing,
context fill, response construction) runs identically in both arms; only the value handed back to
`Bun.serve` / `Deno.serve` differs.

## 3. The invariant that makes it safe

A middleware registered ahead of the router can resume after `next()` and still mutate the response.
That is the entire safety argument:

- **A stack of two or more entries never takes the path**, even when every middleware in it happens
  to be synchronous. `syncDispatchSafe` requires `middlewareStack.length === 1` _and_ that entry to
  be the router dispatch mounted at the root.
- **The root-mounted router's dispatch returns the executor's promise directly** and never resumes
  after the handler. Once the handler returns, nothing remains that could touch the response.
- **The executor sets the marker only in the no-per-route-middleware branch**, and only when the
  handler returned a non-promise. A throw produces a rejection and no marker, so the existing error
  path is unchanged.
- **Any application middleware disables the fast path** — `bodyParser`, `cors`, `logger`. That is
  deliberate conservatism; it is why the POST rows do not move.

The marker is a symbol on the context rather than a widened return type because `Middleware` and
`callback()` are public contracts returning `Promise<void>`; widening them would break callers that
store the result.

## 4. End-to-end results

`before` is a pristine `HEAD` (`8e321121`) built in a detached worktree; `after` is the working
tree. Both arms are built from the same repository entry (`serve-nextrush.ts` /
`serve-nextrush-post.ts`) through `scripts/dev-check/lib/build.ts`, so the only difference is source.
Server pinned to core 0, `wrk -t2 -c64` on cores 1 and 3, 3 s warmup + 8 s measured, pairs
order-flipped, CPU per request from `/proc/<pid>/stat`.

| Workload       | Runtime |   before |        after | paired median | pairs favouring after |            p50 |            p99 |
| -------------- | ------- | -------: | -----------: | ------------: | --------------------: | -------------: | -------------: |
| Minimal GET    | Bun     | 14.82 µs | **12.90 µs** |   **−13.6 %** |                   4/5 | 1170 → 1020 µs | 2480 → 2430 µs |
| Minimal GET    | Deno    | 12.62 µs | **11.10 µs** |   **−10.9 %** |                   5/5 |  1060 → 940 µs | 1970 → 1840 µs |
| Minimal GET    | Node    | 24.12 µs |     23.83 µs |        −1.9 % |                   2/3 | 1790 → 1770 µs | 3400 → 3410 µs |
| JSON POST 1 KB | Bun     | 21.45 µs |     21.19 µs |        −1.3 % |                   4/5 | 1650 → 1620 µs | 2590 → 2710 µs |
| JSON POST 1 KB | Deno    | 34.38 µs |     34.08 µs |        −0.9 % |                   2/3 | 2390 → 2390 µs | 5460 → 5120 µs |
| JSON POST 1 KB | Node    | 41.28 µs |     40.12 µs |        −3.0 % |                   3/3 | 2840 → 2790 µs | 5840 → 5380 µs |

The Bun and Deno POST rows are the control group. The app in those rows registers `bodyParser`, so
its chain is genuinely asynchronous and the fast path cannot apply. Their result — no movement — is
the correct one, not a miss.

Node POST moved −3.0 % (3/3) although the Node adapter never takes the fast path: the executor no
longer allocates a fresh resolved promise per dispatch (finding F-10).

### 4a. Independent replication

An earlier window in the same session, before the harness was rebuilt, reproduced the headline rows:

| Workload       | Runtime |   before |    after | paired median | pairs |
| -------------- | ------- | -------: | -------: | ------------: | ----: |
| Minimal GET    | Bun     | 14.86 µs | 13.20 µs |   **−11.7 %** |   5/5 |
| Minimal GET    | Deno    | 12.75 µs | 11.44 µs |        −6.8 % |   3/3 |
| JSON POST 1 KB | Deno    | 36.59 µs | 34.76 µs |        −2.9 % |   3/3 |
| Minimal GET    | Node    | 24.15 µs | 24.05 µs |        −0.4 % |   3/5 |
| JSON POST 1 KB | Node    | 41.20 µs | 41.21 µs |        +0.0 % |   2/5 |

Those raw files were lost with a `/tmp` wipe; the numbers are recorded here and in the scoreboard.
Two windows, same direction and magnitude class, on the same box: the effect is real and not one
lucky run.

## 5. The gap to Hono and to the floor

Measured in the same session, minutes apart, ratios computed within one run:

| Comparison                 | NextRush | Comparator |     Ratio |           Consistency |
| -------------------------- | -------: | ---------: | --------: | --------------------: |
| Bun GET vs Hono 4.13.0     | 11.58 µs |   10.51 µs | **1.10×** | 5/5 pairs Hono faster |
| Bun POST 1 KB vs Hono      | 24.55 µs |   18.79 µs | **1.31×** | 5/5 pairs Hono faster |
| Bun GET vs raw `Bun.serve` | 12.80 µs |   10.20 µs |     1.25× |  3/3 pairs raw faster |

The campaign opened at **~1.24×** Hono on Bun GET (13.20 vs 11.86 µs). It is now **1.10×**. The
NextRush GET figure in this table (11.58 µs) is measured in a different sub-window than the
before/after row (12.90 µs after); only ratios within one run are compared.

The repository's canonical gate agrees in direction. `node scripts/dev-check/check.mjs wire --rt bun`
reports `wire.hono.rps` 63815 vs `wire.nextrush.rps` 56469 (0.885) and
`wire.post.nextrush.vs_hono` 0.77. Those rps figures come from an unpinned, client-saturated
harness (note the "+41.0 % vs last run" drift in the same output), so they are cited only as an
independent corroboration of direction, not as a decision input. 1/0.885 ≈ 1.13 and 1/0.77 ≈ 1.30
match the CPU ratios above.

## 6. Category coverage

| Category                                                      | Covered this cycle?                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| Minimal GET, Bun / Deno / Node                                | Yes — the cycle's claim                                      |
| JSON POST 1 KB, Bun / Deno / Node                             | Yes — as a control group (path does not apply)               |
| Dynamic route, middleware chain, raw-body POST, extra headers | No — next cycle                                              |
| Streaming, compression, error paths                           | No                                                           |
| Cold start, bundle size, memory                               | No                                                           |
| Behaviour parity across runtimes                              | Yes — conformance (in-process) plus response-byte comparison |
| Cross-runtime HTTP parity (real sockets)                      | No — conformance runs through the adapters in-process        |

## 7. Verification

Re-run on 2026-10-23 against the working tree (`vitest run`, per package):

| Package                         | Files | Tests | Result |
| ------------------------------- | ----: | ----: | ------ |
| `@nextrush/types`               |     4 |    21 | pass   |
| `@nextrush/router`              |    29 |   434 | pass   |
| `@nextrush/core`                |    15 |   208 | pass   |
| `@nextrush/runtime`             |    32 |   396 | pass   |
| `@nextrush/adapter-bun`         |     9 |   129 | pass   |
| `@nextrush/adapter-deno`        |    10 |   123 | pass   |
| `@nextrush/adapter-edge`        |    12 |   134 | pass   |
| `@nextrush/adapter-node`        |    30 |   301 | pass   |
| `@nextrush/adapter-conformance` |    13 |   436 | pass   |

New tests, each authored failing first:

| File                                                              | Cases                                                                                                          |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `packages/router/src/__tests__/executor-settled-sync.test.ts`     | 4 — marks on a synchronous return; does not mark for an async handler, a throw, or a route with middleware     |
| `packages/core/src/__tests__/sync-dispatch-safe.test.ts`          | 3 — true for a lone root router; false with application middleware; false with no router                       |
| `packages/runtime/src/__tests__/web-runner-sync-response.test.ts` | 4 — bare `Response` when settled; not-found body on that path; promise when not safe; promise when not settled |

`packages/types/src/__tests__/public-surface.test.ts` was updated to lock the new runtime export.

Typecheck (`tsc --noEmit`) and lint (`oxlint`) were run for types, router, core, runtime, and the
four adapters — see §15 for the results of the re-run. Response parity was checked in the earlier
window: GET/POST status, body, and `Content-Type` / `Content-Length` / `Date` were byte-identical
before and after.

## 8. Rejected candidates

| Candidate                                              | Evidence                                  | Verdict                                                                                                  |
| ------------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Remove the timeout race inside the async runner        | +2.4 % (2/5 pairs) — no consistent signal | Rejected at the time; superseded, not wrong about what it tested                                         |
| Reduce interior microtask turns (`SETTLE_TURNS` 0/1/2) | Turn count stayed at ~4                   | Rejected — the promise is at the boundary, not inside                                                    |
| Ablate the timeout machinery entirely                  | −9.3 % in a throwaway arm                 | Rejected — only achievable by removing the promise at the boundary, which is what this cycle does safely |
| Return a `Response` from an `async` function           | Still a promise at the boundary           | Rejected — same structure as the original                                                                |

The second row is the lesson behind F-09: the earlier rejection measured an _implementation_, and
the label read as a verdict on the _mechanism_.

## 9. Public surface and compatibility

- `DISPATCH_SETTLED_SYNC` and `DispatchMarkerCarrier` are exported from `@nextrush/types`, marked
  `@internal` in the source comment and locked by the public-surface test. They are a protocol
  between the router and the adapters, not application surface.
- `createWebRunner` and the bun/deno/edge handler factories now return
  `Response | Promise<Response>`. `await` is unchanged (a `Response` awaits to itself); code that
  stores the value in a `Promise<Response>`-typed variable must widen the annotation. The adapters'
  own handler types already do.
- `Bun.serve`, `Deno.serve`, and the edge runtimes all accept either shape.
- Changeset: `.changeset/synchronous-dispatch-fast-path.md` — minor for types, core, runtime, and
  the three adapters; patch for router.

## 10. Limitations

- **Absolute values drift.** This box swings ~40 % in throughput between runs of the same binary.
  Only paired, order-flipped deltas within one window are used; no cross-window absolute comparison
  is made.
- **Deno 3-pair results can invert.** The first Deno GET run gave +2.6 % (1/3); the same bundles at
  5 pairs gave −10.9 % (5/5). The decisive rows are therefore 5 pairs, and the consistency count is
  reported next to every delta.
- **Bun version drift.** Measurements ran on Bun 1.4.3; the box now reports 1.4.4. Re-measure before
  publishing these as current figures.
- **Client saturation.** The raw-floor comparison runs near the load generator's ceiling
  (~66–67k rps), which compresses the observed ratio. The raw floor is a contextual reference, not
  a feature-equivalent baseline.
- **The fast path is conservative by design.** Any application middleware disables it, so apps
  using `bodyParser`, `cors`, or `logger` see no GET benefit from this change. That is the safety
  invariant, not an oversight.
- **Node takes a different benefit.** Its adapter owns a callback runner, so it never had the
  boundary promise; the −3.0 % POST result comes only from the shared sentinel.

## 11. Remaining opportunities

1. **POST body reading on Bun and Deno** — the largest measured gap (Bun **1.31×** Hono, Deno 1.54×)
   and the only place the campaign is decisively behind. `bodyParser` is an application middleware,
   so it also disables §3's fast path; the two need one design, not two patches.
2. **Context construction** — the largest remaining framework-side item on GET now that the dispatch
   promise hop is gone. Each piece is 15–45 ns; no single item clears the noise floor. Needs a
   structural idea, not a micro-trim.
3. **The unmeasured workloads** — dynamic route, middleware chain, raw-body POST, extra headers,
   streaming/compression/error. They reuse this harness.
4. **The raw-response profile** — the `requestTargetFromUrl` and dispatch items are visible in a
   profile, but reproducing it costs a rebuild of the Deno profiling harness.

## 12. Findings

- **F-09 — "No consistent signal" can describe an implementation, not a mechanism.** The earlier
  rejection of this candidate was recorded as a verdict on the idea; it was a verdict on one way of
  expressing it. Measuring the mechanism's ceiling with throwaway code costs about twenty minutes
  and would have avoided a full cycle's detour.
- **F-10 — The shared resolved sentinel also helps Node.** Node POST moved −3.0 % (3/3) although the
  Node adapter never takes the fast path: the executor no longer allocates a fresh
  `Promise.resolve(undefined)` per dispatch. Small, consistent, worth keeping.
- **F-11 — `bodyParser` is the single largest obstacle on POST, and it disables the dispatch fast
  path by existing.** Any POST design must decide whether the body read composes as application
  middleware (blocking the fast path) or becomes a per-route concern that can settle
  synchronously. That is a design question, not a trim — candidate #10 in the scoreboard.

## 13. Reproduction

```bash
# `before` is HEAD in a throwaway worktree; `after` is the working tree.
cd ~/project/framework/nextrush
git worktree add --detach /tmp/opencode/before HEAD

# Build both arms from the repository's own entries.
(cd /tmp/opencode/before/apps/benchmark && bun scripts/dev-check/lib/build.ts \
   scripts/dev-check/entries/serve-nextrush.ts /tmp/opencode/ab2/nr-get-before.js bun --no-minify)
cd apps/benchmark && bun scripts/dev-check/lib/build.ts \
   scripts/dev-check/entries/serve-nextrush.ts /tmp/opencode/ab2/nr-get-after.js bun --no-minify

# Paired, order-flipped. CPU/req from /proc, p50/p99 from wrk --latency.
cd ~/project/framework/nextrush/report/performance/raw
node ab2.mjs --runtime bun --workload get \
  --a /tmp/opencode/ab2/nr-get-before.js --b /tmp/opencode/ab2/nr-get-after.js \
  --pairs 5 --label bun-get-ba
node recompute.mjs res-bun-get-ba-*.json
```

The Hono and raw-floor arms use `serve-hono.ts` and `serve-raw.ts` from the same entries directory;
all of them dispatch on `Bun` / `Deno` / `node` at runtime, so one bundle runs on all three runtimes.
Bundles under `/tmp/opencode/ab2/` are ephemeral and rebuildable; every measurement's per-pair rows
are written to `report/performance/raw/` on the measurement machine. That directory is gitignored —
raw benchmark output is reproducible evidence, not repository history.

## 14. Git status

Changed by this cycle (committed as the fast-path change plus the measurement record):

```
packages/types/src/dispatch-marker.ts                      (new)
packages/types/src/index.ts
packages/types/src/__tests__/public-surface.test.ts
packages/router/src/segment-trie.ts
packages/router/src/__tests__/executor-settled-sync.test.ts (new)
packages/core/src/application.ts
packages/core/src/__tests__/sync-dispatch-safe.test.ts      (new)
packages/runtime/src/web-runner.ts
packages/runtime/src/__tests__/web-runner-sync-response.test.ts (new)
packages/adapters/bun/src/adapter.ts
packages/adapters/deno/src/adapter.ts
packages/adapters/edge/src/adapter.ts
.changeset/synchronous-dispatch-fast-path.md                (new)
report/performance/campaign-scoreboard.md
report/performance/synchronous-dispatch-fast-path.md        (new)
```

`report/performance/raw/` holds this cycle's harness and per-pair output on the measurement machine.
It is gitignored and deliberately **not** committed.

Pre-existing uncommitted work in the same tree, preserved untouched: the text-media-type change
(`response-body.ts`, `response-builder.ts`, node `context.ts`, adapter context tests, conformance
suite, website adapters page, `.changeset/text-media-type-deno-fast-path.md`), the static
`send-file` change (`.changeset/static-responses-emit-headers.md`), and the pnpm `12.6.0 → 12.14.0`
bump (`package.json`, `pnpm-lock.yaml`).

## 15. Post-write verification

Re-run after the report was written, against the working tree:

| Gate                                   | Result                                                                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, 8 packages (`tsc --noEmit`) | clean in all: types, router, core, runtime, bun, deno, edge, node                                                                                                         |
| Lint, 8 packages (`oxlint src`)        | 0 errors in all. One **pre-existing** warning in `packages/runtime/src/response-builder.ts:181` (`no-non-null-assertion`) — present at `HEAD` and untouched by this cycle |
| Tests, 9 packages                      | 2182 passing (counts in §7)                                                                                                                                               |

The lint warning is recorded so it is not mistaken for a regression from this change.
