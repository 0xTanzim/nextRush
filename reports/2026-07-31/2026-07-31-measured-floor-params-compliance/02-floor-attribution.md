# 02 — Floor Attribution: the per-request timer and the drain wrapper

> ### ✅ BOTH SHIPPED (2026-07-31) — with an honest caveat on the throughput gate
>
> **F-3, the drain wrapper.** §5's design A ("read the flag in `NodeContext`'s own header-write path")
> **does not work as written**: `json()` is the only `res.writeHead` call in `context.ts`, so moving the
> check there would silently stop advertising `Connection: close` on `send`, `html`, streaming and the
> adapter's own `finalizeSuccess`/`finalizeError` paths. The
> `idle-keepalive-drain.integration.test.ts` case *"marks a response completed during drain"* also
> requires a request **already in flight before drain started** to get the header, which rules out
> patching only while draining.
>
> What shipped instead removes the three per-request **allocations** while keeping coverage identical:
> one `drainAwareWriteHead` defined once per `serve()` (not per request), the original stashed under a
> module-level symbol as a plain reference (not a `bind`), and explicit arity instead of rest-args.
> Measured **[M]**, 5 rounds, `taskset -c 2-5`:
>
> | | B/req | wrapper cost |
> | --- | --- | --- |
> | no wrapper (baseline) | 40.11 (cv 0.01%) | — |
> | OLD bind + closure + rest-args | 232.34 (cv 0.08%) | **192.23** |
> | NEW shared fn + symbol stash | 80.11 (cv 0.05%) | **40.00** |
>
> **−152.23 B/req, 79.2% of the wrapper cost removed.** The residual 40 B is the symbol property store,
> kept deliberately: reading the original from the prototype instead would drop the last 40 B but would
> stop chaining to any earlier instance-level patch, which the `bind` form did.
>
> **F-1, the timeout race.** Shipped as a **synchronous-response fast path**, which is smaller than
> either §5 option: a handler that already committed its response before returning its promise cannot be
> timed out at all, because the 504 branch is guarded on `!ctx.responded && !res.headersSent`. Verified
> empirically that `ctx.responded === true` immediately after `handler(ctx)` returns for a synchronous
> middleware chain (an `async` wrapper runs its body synchronously up to the first `await`), and `false`
> for a handler that awaits. So sync handlers now arm **zero** timers; everything else races exactly as
> before.
>
> ADR-0010 is preserved for every handler that has not responded — clean 504 and `ctx.signal` abort both
> still tested. The one behaviour given up: a handler that answers fast and then keeps working in the
> background no longer gets its signal aborted at the bound. The 504 branch could never have surfaced
> that anyway.
>
> Per-request cost removed **[M]**: one Timeout object at **137.09 B/req** plus **~175–466 ns** of
> arm/disarm. 8 new tests in `handler-timeout-fast-path.test.ts`; adapters/node 251 and
> conformance 290 green.
>
> **Combined deterministic saving: ≈289 B/req.**
>
> ### ⚠️ The throughput gate is INCONCLUSIVE — do not quote a percentage
>
> §7's gate was re-run: 5 arms (`prod-old`, `prod-new`, `no-wrapper`, `no-race`, `none`), pinned
> servers 2-5 / `wrk` 6-7, 256 conns, 3 s warmup + 6 s measure, interleaved, n=9 rounds.
>
> | Contrast | Δ | t | Verdict |
> | -------- | - | - | ------- |
> | remove BOTH from the NEW shape | **+8 rps (+0.04%)** | 0.02 | **gate satisfied — the effect is gone** |
> | `prod-old` → `prod-new` (the change) | −319 rps (−1.48%) | −0.94 | not significant |
> | **remove BOTH from the OLD shape (reference)** | **−311 rps (−1.45%)** | −0.66 | **not significant** |
>
> The first row is exactly what §7 predicted (`both ≈ none`). **But the third row is the problem:** on
> the old shape this contrast originally measured **+1,147 rps, t=3.35**, and this run cannot reproduce
> it. An experiment that cannot detect the original signal proves nothing about its absence. Host load
> was ≈2.6 during this run versus ≈1.4 for the original, and arm cv rose to 4.6–8.3%; detecting a ~1.5%
> effect at that noise needs n≈59, not n=9.
>
> **Therefore:** the changes are justified by their **deterministic** measurements — allocation and timer
> count, both cv ≤0.1% and immune to scheduler noise — and by zero behaviour change under 1,292 passing
> tests. **No throughput improvement is claimed.** §7's `empty-response` prediction (30.48 → ~27.8
> µs/req) remains **unverified** and must be re-run on an idle host before any published figure moves.
>
> ### ❌ REFUTED: the concurrency-scaling mechanism (§4, §8's last row)
>
> §4 attributes the floor's growth with concurrency to the 30 s timer list carrying up to 256 live
> Timeout objects. Measured directly **[M]** — `setTimeout(30s)` + `clearTimeout` with N timers already
> live:
>
> | timers already live | 0 | 64 | 256 | 1024 |
> | --- | --- | --- | --- | --- |
> | ns per arm+disarm | 466.04 | 192.05 | 175.51 | 161.89 |
>
> The cost **falls** as the list grows — it does not scale with it. §8 rated this claim MEDIUM
> confidence; it is now **refuted**, and the concurrency growth in report `01` needs a different
> explanation. The per-request allocation (137 B) and its GC pressure remain real and are what the fix
> actually removes.


**Resolves `performance-investigation-reconciliation.md` Rec 4 / P-01**, open since 2026-07-28 and
explicitly blocked on "a CPU-pinned, multi-run version of the same three-arm A/B."

---

## 1. What was open, and why it stayed open

The corpus recorded P-01 — the F-04 handler-level timeout race — as **Critical, mechanism confirmed,
magnitude unmeasured**, with this warning attached:

> an unpinned single-batch A/B of the handler-timeout race measured a +23% gain (16,139 → 19,846 RPS)
> that **fully reversed** under interleaved repetition (RACE-ON 25,187 vs RACE-OFF 24,460 mean over 3
> alternating rounds); the same configuration measured 16,139 in one batch and 25,540 in another, a
> 58% swing on identical code. **Do not accept any timeout-arm conclusion from an unpinned,
> non-interleaved run.**

Two things had to be true to close it: **pinning** and **interleaving**. Both are now available
(`taskset` present; the published run already pins cores 2-7).

A second cost was never tested at all: `serve()`'s F-05 drain wrapper. The existing
`nextrush-v3-timeout-diagnostic.js` cannot test it, because that server bypasses `serve()` entirely —
so no existing arm can toggle the wrapper.

---

## 2. Design: 2×2 factorial, paired within round

A throwaway server exposed both mechanisms as independent toggles, built on raw
`createServer` + `createHandler` so neither is entangled with `serve()`'s option plumbing. Routing was
identical in all arms (`app.use(ctx => ctx.json(HELLO_WORLD))`), as were `server.timeout` and
`keepAliveTimeout`.

| Arm | `writeHead` wrapper (W) | timeout race (R) | Corresponds to |
| --- | ----------------------- | ---------------- | -------------- |
| `both` | ON | ON | **production `serve()` shape** |
| `race` | OFF | ON | — |
| `wrapper` | ON | OFF | — |
| `none` | OFF | OFF | both costs removed |

The wrapper arm reproduces `adapter.ts:478-494` verbatim (bind + arrow closure + rest-args call). The
race arm uses the shipped `diagnostics.disableHandlerTimeoutRace` control.

**Protocol.** Servers pinned to cores 2-5, `wrk` client pinned to cores 6-7, 2 threads, 256
connections, 3 s JIT warmup discarded, 6 s measured. **All four arms measured once per round, then the
round repeated — 11 rounds across two sessions.** Pairing is within-round, so any machine drift moves
all four arms together. This is the design the corpus's warning requires.

The host was **not idle** (load avg ≈1.4) and only 4 cores served, so absolute RPS here (~21k) is
below the published run's hello-world (~32k). Only paired deltas are interpreted.

---

## 3. Results

### Arm means (n = 11 rounds)

| Arm | | RPS | sd | cv |
| --- | --- | --- | --- | --- |
| `both` | W+ R+ — production shape | **20,245** | ±1,086 | 5.4% |
| `race` | W− R+ | 20,907 | ±770 | 3.7% |
| `wrapper` | W+ R− | 21,119 | ±1,232 | 5.8% |
| `none` | W− R− — both removed | **21,392** | ±758 | 3.5% |

### Paired factorial effects (within-round, baseline = `both` = 20,245 rps)

| Effect | Δ RPS | Δ % | sd | t | Verdict |
| ------ | ----- | --- | -- | - | ------- |
| **Remove the timeout race** | **+680** | **+3.36%** | ±834 | **2.71** | **significant, p<0.05** |
| Remove the writeHead wrapper | +467 | +2.31% | ±758 | 2.05 | not significant alone |
| **Remove both** | **+1,147** | **+5.67%** | ±1,136 | **3.35** | **significant, p<0.05** |

Per-request: production shape **49.39 µs** → both removed **46.75 µs** = **−2.65 µs/req**.

### Interpretation

- **The timeout race is real and costs ~3.4%.** Not 23%. The corpus's earlier +23% was an artifact,
  exactly as it suspected — but the effect is not zero either, and this is the first time it has been
  measured on a valid ruler.
- **The wrapper alone is borderline** (t=2.05, just under the p<0.05 threshold at n=11). Its direction
  is consistently positive and its deterministic allocation cost is independently established at
  **+170.98 B/req, cv 0.0%** (prior report, F-2). Treat the magnitude as "small and real," not proven.
- **Together they are unambiguous** (t=3.35) and account for **2.65 of the 5.59 µs floor excess vs
  Fastify @256 — roughly half [D]**.

---

## 4. Root cause

```
   SYMPTOM     empty-response is NextRush's worst like-for-like scenario (−18.3% vs Fastify),
               and the floor excess GROWS 2.2× from 1 → 256 connections
                            │
                            ▼
   EVIDENCE    2×2 factorial: removing both mechanisms recovers +5.67% (t=3.35)
               Latency is proportionally elevated at p50 AND p99 — work, not pauses
                            │
                            ▼
   TECHNICAL   Every request arms a 30-second Node timer (`setTimeout` → Timeout object,
   CAUSE       timer-list insert) and disarms it (`clearTimeout` → list remove), and installs
               a bound function + closure onto the ServerResponse. At 256 in-flight requests
               the timer list carries up to 256 live Timeout objects — which is why the cost
               grows with concurrency rather than staying flat.
                            │
                            ▼
   ARCHITECTURAL  Both are per-request implementations of process-lifetime concerns.
   CAUSE          The timeout is a BOUND on request duration; the drain flag is a
                  PROCESS STATE. Neither needs per-request machinery — they were each
                  implemented at the granularity of the thing they protect (one request)
                  rather than the granularity of the state they read (one process).
                            │
                            ▼
   LONG-TERM   Every future cross-runtime parity guarantee implemented this way adds another
   IMPACT      constant to the floor, and the floor is already large enough to mask NextRush's
               genuinely better marginal costs (report 01 §3).
```

Neither mechanism is wrong to exist. F-04/ADR-0010 requires a clean `504` with cooperative
cancellation on every adapter; F-05 requires `Connection: close` on responses completing mid-drain.
**Both requirements can be met with zero per-request cost.**

---

## 5. Optimization proposals

### F-1 — the timeout race

| | **A. Coarse timer wheel** *(recommended)* | **B. Lazy arm** | **C. Rely on `server.requestTimeout`** |
| --- | --- | --- | --- |
| Design | One `setInterval` at ~250 ms granularity + an intrusive doubly-linked list of in-flight requests; each request is an O(1) list insert/remove, no Timeout object | Arm the timer only if the handler has not settled by the end of the current macrotask (`setImmediate`) — synchronous handlers never allocate a timer | Delete the handler race; use Node's own `server.requestTimeout` / `headersTimeout` |
| Per-request cost | 2 pointer writes | zero for sync handlers; unchanged for async | zero |
| Preserves ADR-0010's clean 504 + `ctx.signal` cancel? | **Yes** | **Yes** | **No** — Node destroys the socket; no 504 body, no cooperative cancel |
| Timeout accuracy | ±250 ms on a 30 s bound (0.8%) | exact | Node's own |
| Complexity | Medium — a new internal structure (~80 lines), needs its own tests | Low | Trivial (deletion) |
| Cross-runtime | Wheel is portable; each adapter keeps its own instance | Portable | Node-only — **breaks parity** |
| Risk | Medium: a leaked list entry becomes a leak. Must be tested for abort/error/disconnect paths | Low-medium: shifts the timeout's start point by one macrotask | **Rejected** — regresses a ratified ADR |

**Why A.** It removes the per-request allocation *and* the concurrency-scaling list cost while keeping
the ADR-0010 contract exactly. **B is the better first move** if effort is constrained: it is far
smaller, and the benchmark's handlers are synchronous, so B captures most of the measured 3.36%
for a fraction of A's risk. **A and B compose** — B as the fast path, A as the fallback for genuinely
async handlers. C is listed only to be rejected: ADR-0010 already considered and rejected it.

### F-3 — the drain wrapper

**A (recommended):** thread the mutable `drainState` reference through the already-hoisted, frozen
`contextOptions` and read the boolean in `NodeContext`'s own header-write path. Removes the bind, the
closure, the rest-args array and the property store on a core object. Same package, no API change,
`Connection: close` still decided at response time (which is the requirement — a request already in
flight when the drain begins must still pick it up).
**B:** track in-flight responses in a `Set` and patch only those live at drain start — trades one
per-request cost for another; strictly worse than A.

---

## 6. Risk assessment

| Item | API compat | Behaviour | HTTP compliance | Regression risk | Notes |
| ---- | ---------- | --------- | --------------- | --------------- | ----- |
| F-1 A (wheel) | None | 504 fires within +250 ms of the bound | Preserved | **Medium** | A leaked entry is a memory leak; needs abort/error/disconnect/keep-alive tests and a leak assertion |
| F-1 B (lazy arm) | None | Timer starts one macrotask later | Preserved | Low | Must still arm for handlers that go async after the first tick |
| F-3 A | None (internal) | Identical | Preserved | Low | `drainState` becomes a mutable field on a frozen options object — freeze the wrapper, not the ref |
| Both | None | — | — | — | Ship separately so each is independently attributable and revertible (PERF-001 §2.10) |

---

## 7. Validation plan (PERF-001 §4.9, §2.11)

**Functional:** full `packages/adapters/node` suite + `packages/adapters/conformance` (the 504/abort
parity tests are the ones that matter) + the graceful-shutdown suite for F-3's
`Connection: close` behaviour.

**Performance, and this is the binding gate:**

1. Re-run **this exact 2×2 factorial** post-change. The `none` arm becomes the new production shape,
   so the expected result is `both ≈ none` — i.e. the effect measured here **disappears**.
2. Re-run the pinned `standard` profile and confirm `empty-response` moves. **Predicted: 30.48 →
   ~27.8 µs/req [D]**, closing ~half the Fastify gap. If it does not move, PERF-001 §2.11 applies:
   reject or revert.
3. `bench:alloc:handler` before/after — the `timeout > 0` arm should now drop rather than rise (note
   the corpus's honest caveat that the last change to this path measured a 5-7% *increase* on that
   metric; this one should not).

**Do not** accept any conclusion from an unpinned or non-interleaved run. That rule produced the
+23% phantom, and it applies to the validation as much as to the original measurement.

---

## 8. Confidence

| Claim | Confidence | Why |
| ----- | ---------- | --- |
| Timeout race costs ~3.36% | **HIGH** | Pinned, interleaved, paired, n=11, t=2.71; mechanism read in source; direction consistent across both sessions |
| Drain wrapper costs ~2.31% | **MEDIUM** | t=2.05 (below threshold) but consistent direction, and +170.98 B/req is deterministic at cv 0.0% |
| Combined 5.67% / 2.65 µs | **HIGH** | t=3.35 |
| 2.65 µs ≈ half the Fastify floor gap | **MEDIUM** | Arithmetic on two runs measured at different scales (my 4-core arms vs the published 6-core run); the *ratio* is the fragile part, not the 2.65 µs |
| Timer-list growth explains concurrency scaling | **MEDIUM** | Consistent with the +2.53 → +5.59 µs growth and with proportional (non-tail-heavy) latency, but not isolated by a dedicated experiment. **A per-concurrency-level 2×2 would resolve it** |
