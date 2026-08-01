# 05 — The two remaining load-independent deficits: static files and middleware

Report `01` §3 established that only three scenarios lose at **both** @1 and @256 connections.
`route-params` is covered in `03`. These are the other two.

---

## Part A — Static file serving

### A.1 The measurement, and why it is pure overhead

| static-file @256 | RPS | µs/req | p50 | p99 |
| ---------------- | --- | ------ | --- | --- |
| Raw Node | 14,256 | 70.14 | 17.51 ms | 22.46 ms |
| Fastify | 10,669 | 93.73 | 24.57 ms | 28.45 ms |
| **Express** | **10,489** | 95.34 | 24.49 ms | 29.40 ms |
| **NextRush** | **8,948** | **111.76** | **28.86 ms** | **35.88 ms** |
| Hono | 7,848 | 127.42 | 31.76 ms | 42.95 ms |
| Koa | 6,628 | 150.87 | 38.71 ms | 55.31 ms |

**−16.1% vs Fastify, −37.2% vs raw Node, and Express beats NextRush** — the only scenario in the
matrix where that happens.

The decisive context: **`apps/benchmark/public/static/bench.txt` is 36 bytes.** There is no I/O
throughput being measured here. Every microsecond of the 41.62 µs gap to raw Node is framework
overhead — syscalls, header construction, and async boundaries. Marginal cost above each framework's
own empty-response floor: **NextRush 133.71 µs vs Fastify 100.13 µs @1 conn — +33.58 µs [M]**, the
largest single-scenario excess in the entire matrix.

### A.2 What the request path does — `[S]`, read at `700549c`

The benchmark route uses `createSendFile` (`packages/middleware/static/src/index.ts`) →
`sendFile` (`send-file.ts`). For a small file (`size <= highWaterMark`, default 1 MB — so always, here):

| Step | Operation | Cost |
| ---- | --------- | ---- |
| 1 | `safeJoin(root, relativePath)` | path resolution |
| 2 | `statSafe(absolutePath, followSymlinks, root)` | **fs op #1** — `stat`, symlink-safe |
| 3 | `isDotfile(absolutePath)` | string scan |
| 4 | `setFileHeaders` → `getMimeType` | lookup |
| 5 | `setFileHeaders` → `stat.mtime.toUTCString()` | **Date → string formatting, per request** |
| 6 | `setFileHeaders` → `generateETag(stat)` | **string build, per request** |
| 7 | `setFileHeaders` → `Cache-Control` directives `join(', ')` | string build |
| 8 | `isFresh(ctx, stat, etag)` | conditional-request check |
| 9 | `await fsp.open(absolutePath, 'r')` | **fs op #2** — `open` |
| 10 | `await handle.stat()` | **fs op #3** — `fstat`, purely TOCTOU verification (SEC-13) |
| 11 | `await handle.readFile()` | **fs op #4+** — read (Node's `filehandle.readFile` also sizes the buffer internally) |
| 12 | `res.end(content)` | response |
| 13 | `await handle.close()` in `finally` | **fs op #5** — `close` |

That is **≥5 filesystem operations and 4 sequential `await` boundaries per request**, plus two derived
strings (`Last-Modified`, `ETag`) rebuilt from identical inputs on every request, **with no cache of
any kind** — no stat cache, no ETag cache, no content cache.

`Date.prototype.toUTCString()` alone is a non-trivial formatting call on a hot path; `send`
(the library behind both Express's `serve-static` and `@fastify/static`) does not re-derive it per
request in the same shape, and neither performs the extra `fstat`.

An attempt to confirm the syscall counts with `strace` **failed to produce interpretable
attribution** (46 `openat` per request, unexplainable by this path) and is excluded from the evidence.
The table above is source-read `[S]`; the syscall count is listed as required further evidence in §A.5.

### A.3 Root cause

```
   SYMPTOM        NextRush is last-but-two on a 36-byte file, behind Express
                            │
                            ▼
   EVIDENCE       +33.58 µs marginal excess @1c; ≥5 fs ops + 4 awaits + 2 rebuilt
                  strings per request; zero caching anywhere in the module
                            │
                            ▼
   TECHNICAL      Every request re-derives everything derivable: stat, ETag,
   CAUSE          Last-Modified, MIME, Cache-Control — and re-verifies TOCTOU
                  with an extra fstat.
                            │
                            ▼
   ARCHITECTURAL  @nextrush/static is written as a CORRECT file server with no
   CAUSE          memoization layer. Each individual step is defensible in isolation
                  (the fstat closes a real TOCTOU race, SEC-13); what is missing is the
                  recognition that a static file's derived metadata is STABLE between
                  mtime changes and therefore cacheable. PERF-001 §5.1's second question
                  — "can it execute less frequently?" — was never asked of this module.
                            │
                            ▼
   LONG-TERM      Static serving is the one workload where users most expect a framework
   IMPACT         to be fast, and the one most likely to be benchmarked by adopters.
```

### A.4 Proposals

| | **A. Derived-metadata cache** *(recommended)* | **B. Content cache for small files** | **C. Drop the TOCTOU `fstat`** | **D. `sendfile(2)` / zero-copy** |
| --- | --- | --- | --- | --- |
| Design | Bounded LRU keyed by absolute path → `{ stat, etag, lastModifiedString, mimeType, cacheControlString }`, revalidated by a single `stat` per request | Additionally cache the bytes for files under a size threshold; serve entirely from memory | Trust the pre-open `stat`, drop `handle.stat()` | Use `stream.pipe`/`sendfile` to avoid userspace copy |
| Removes | 3 string builds + MIME lookup per request | **all** fs ops after the revalidation stat | 1 fs op + 1 await | userspace copy |
| Keeps 1 stat for freshness? | Yes — correctness preserved | Yes (or mtime-poll) | Yes | — |
| Security | Unchanged | Unchanged if revalidated by mtime+size | **Reopens the SEC-13 TOCTOU race — rejected** | Unchanged |
| Complexity | Medium — LRU + invalidation + bounded memory | Medium-high — memory bound becomes a config surface | Trivial | High; irrelevant for a 36-byte file |
| Benefit at 36 bytes | Large (the cost *is* metadata) | Largest | Small | **~zero** |
| Benefit at 5 MB | Small | N/A (over threshold) | Small | Large |
| Verdict | **Recommended first** | Strong second, opt-in | **Rejected** (security regression) | Later, and only for large files |

**Why A first.** It is the change whose benefit matches where the measured cost actually is (metadata
derivation, not bytes), it needs no new configuration surface, and it cannot regress security. B is the
bigger win but introduces a memory-bound config decision that deserves its own RFC. D is tempting and
almost useless here — a reminder that the benchmark measures small-file overhead, so optimizing the
copy path would be optimizing the wrong thing.

**Free wins to fold in regardless:** hoist the `Cache-Control` directive string to normalize-time (it
depends only on options, never on the request), and memoize `getMimeType` per extension.

### A.5 Validation and open questions

- `packages/middleware/static` full suite; range requests, conditional requests (`If-None-Match`,
  `If-Modified-Since`), dotfile policy, symlink policy, and the 304 path must be unchanged.
- New: cache invalidation on mtime/size change; bounded-size eviction; **and the HEAD paths from report
  `04`, which are currently dead code**.
- Benchmark: `static-file` predicted 111.76 → ~95 µs/req **[D, weak — a projection from the removed
  operations, not measured]**.
- **Required further evidence:** a valid per-request syscall count (`strace -c` on a controlled,
  idle-baseline-subtracted window, or `perf trace`). My attempt failed and the count remains `[S]`.
- Open: is the extra `fstat` (step 10) load-bearing given step 2 already stat'd, or does the SEC-13
  race need it? A security-side answer is required before considering C, which is currently rejected.

---

## Part B — Middleware pipeline

### B.1 The measurement

| middleware-stack | NR marginal | Fastify marginal | NR excess |
| ---------------- | ----------- | ---------------- | --------- |
| @1 conn | 12.74 µs | 7.52 µs | **+5.22 µs** |
| @64 conn | 13.32 µs | 7.22 µs | **+6.10 µs** |
| @256 conn | 11.56 µs | 7.35 µs | **+4.21 µs** |

The scenario runs **5 layers**, each setting one header then returning `ctx.next()`. Per-layer excess:
**≈ +1.04 µs @1, +1.22 µs @64, +0.84 µs @256 [D]**. Consistent across the whole ladder — a genuine
load-independent cost.

*Fairness note:* the harness flags this scenario `⚠️ idiomatic` and excludes it from the headline
score, because each framework uses its own middleware mechanism. The comparison is still meaningful as
a per-layer cost signal; it is not a like-for-like claim.

### B.2 Mechanism — `[S]`

The benchmark attaches middleware **per route**, so dispatch goes through
`compileExecutor` (`packages/router/src/segment-trie.ts:78`), not `compose`. Its `len >= 1` branch,
per layer, per request:

1. allocates a `next` closure — `const next = () => dispatch(i + 1)`
2. calls `ctx.setNext(next)` — a write to the context
3. calls `Promise.resolve(mw(ctx, next))`
4. recurses into `dispatch(i + 1)`

So 5 layers = **5 closures + 5 context writes + 5 `Promise.resolve` calls + 5 stack frames**. Fastify's
hook chain is a precompiled linear walk with no per-layer closure allocation.

### B.3 The structural problem behind it

**There are two independent middleware-dispatch implementations in the framework:**

| | File | Used for |
| --- | --- | --- |
| `compose()` | `packages/core/src/middleware.ts:99` | application-level `app.use()` middleware |
| `compileExecutor()` | `packages/router/src/segment-trie.ts:78` | per-route middleware |

Both implement guarded recursive dispatch, both wire `ctx.setNext`, both convert sync throws to
rejections, both carry the "next() called multiple times" guard, and both have hand-maintained fast
paths. `compose` has `len === 0` and `len === 1` specializations; `compileExecutor` has a `len === 0`
one. **Any middleware optimization must be implemented, tested and kept in sync twice** — and the
`len === 1` fast path that exists in `compose` has no counterpart in `compileExecutor`.

The corpus already investigated collapsing `compose`'s per-layer closure and concluded it is not
reducible without codegen, because a single shared `nextFn` breaks double-next detection
(`reconciliation` Rec 11b). **That conclusion was reached for `compose` only.** `compileExecutor` was
not part of it, and it is the implementation the benchmark actually exercises.

### B.4 Proposals

| | **A. Unify the two dispatchers** *(recommended, architectural)* | **B. Hand-unroll small layer counts** | **C. Per-layer `next` reuse** | **D. Accept** |
| --- | --- | --- | --- | --- |
| Design | One dispatch implementation, used by both `compose` and `compileExecutor`; router middleware becomes a composed chain rather than a second recursive walk | In `compileExecutor`, specialize `len === 1..4` into explicit nested calls at registration time — no loop, no recursion, no codegen | One closure capturing a mutable index instead of one per layer | — |
| Removes | the duplication; one place to optimize | per-layer recursion + some closures | 4 of 5 closures | — |
| Double-next detection | Preserved (single implementation, single guard) | Preserved (each specialization keeps its own guard) | **Breaks it** — already established by the corpus | — |
| Complexity | Medium-high, and it is a **public-behaviour-adjacent refactor → RFC-gated** per AGENTS.md §21 | Low-medium; verbose but mechanical | Low | — |
| Long-term value | **High** — removes a permanent 2× maintenance tax on the hottest abstraction | Medium — a faster version of the duplicate | — | Low |
| Verdict | **Recommended** | Good tactical step; do it inside A | **Rejected** | Rejected |

**Why A.** PERF-001 §5.2 puts architectural improvements at Priority 0 and micro-optimizations at
Priority 3. Two hand-synchronised dispatchers is the architectural defect; the +1 µs/layer is its
symptom. Unifying them also gives per-route middleware the `len === 1` fast path it currently lacks —
a benefit that falls out of the refactor rather than being engineered separately.

### B.5 Validation

- `packages/core` + `packages/router` middleware suites, in full. The double-next tests
  (`middleware-single-fastpath.test.ts`'s "next() called n times") are the load-bearing ones.
- Ordering semantics: `ctx.next()` and the `(ctx, next)` argument form must remain interchangeable, and
  post-`next()` code must still run in reverse order.
- `bench:alloc:compose` — the `general` (len ≥ 2) variant should fall; note the harness's own caveat
  that its absolute figures are not cross-comparable with other `bench:alloc:*` numbers.
- Benchmark: `middleware-stack` predicted 42.04 → ~37 µs/req **[D, weak]**.
- **Confidence: HIGH** on the duplication and the per-layer mechanism (both source-read and
  measured); **MEDIUM** on the projected gain, since Fastify's advantage may partly come from its
  precompiled hook chain, which A does not fully replicate.
