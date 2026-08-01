# Subsystem — Static Files

**Playbook phase:** Part 4 §4.20, analysed with the §4.1–4.10 methodology
**Package:** `@nextrush/static` — `packages/middleware/static/src/{index,send-file,utils}.ts`
**Owns finding:** **P-05 (Medium, Hypothesis)** — uncached filesystem `stat` on every request
**Evidence status:** ⚠️ **No benchmark coverage exists for this subsystem at all.** Every performance
statement below is derived from source structure, not measurement, and is labelled accordingly.

---

## 1. Purpose (§4.1)

Serve files from a directory root over HTTP with correct caching headers, range support, directory
index resolution, extension fallbacks, and — critically — path-traversal, symlink-escape and dotfile
protection.

## 2. Architecture (§4.2)

`serveStatic(options)` normalises options once at registration, then returns an `async` middleware:

```
staticMiddleware(ctx, next)
  ├─ method GET/HEAD?            → else next()
  ├─ prefix match?               → else next()
  ├─ stripPrefix → decodeURIComponent            ← per request
  ├─ traversal screen: '..' , '\0' , '//'        ← 3 String.includes per request
  ├─ safeJoin(root, decodedPath)                 ← per request
  ├─ await statSafe(absolutePath, …)             ← FILESYSTEM SYSCALL, per request  ◀ P-05
  ├─ extension fallbacks         → await statSafe per candidate extension
  ├─ directory?                  → await statSafe(join(path, index))
  ├─ dotfile policy check
  └─ sendFile(ctx, path, stat, opts)  → setFileHeaders → streamToResponse
```

A boot-time `SECURITY_AUDIT` verdict is attached via `Object.defineProperty` — registration-time, no
per-request cost. That part of the design is right.

## 3. Request lifecycle participation (§4.3)

Only for requests reaching the middleware — gated by method and prefix, both cheap early exits. The
early-exit ordering is correct: method check, then prefix check, before any string or filesystem work.

## 4. Performance characteristics (§4.4)

**No data.** The benchmark suite has ten scenarios; none serves a static file. There is no CPU
profile, no allocation measurement, and no throughput number for this path anywhere in the workspace.

What can be established from source, and its expected cost class:

| Per-request operation | Cost class | Note |
| --------------------- | ---------- | ---- |
| `await statSafe(...)` | **Filesystem syscall (~1–10 µs warm page cache, far worse cold or on network storage)** | Dominates everything else here by one to two orders of magnitude |
| `decodeURIComponent` | ~1 µs, allocates | Unavoidable for correctness |
| 3 × `String.includes` | Sub-µs | Cheap and load-bearing security screens |
| `safeJoin` | Sub-µs, allocates | Necessary |
| `async` middleware frame | Sub-µs | Justified — the path genuinely awaits I/O |
| Extension fallbacks | **N additional syscalls** | Only when the first stat misses; a miss on a route with 2 configured extensions costs 3 stats |
| Directory index | **1 additional syscall** | When the path resolves to a directory |

For context: a single `stat` in the warm case is comparable to the *entire* 30.30 µs fixed request
cost measured for the framework. On a cold cache or network-backed volume it is orders of magnitude
worse. This is the defining cost of the subsystem, and it is paid per request with no memoisation.

## 5. Runtime behaviour (§4.5)

Per request that reaches file resolution: one `decodeURIComponent` string, one `safeJoin` string,
**at least one `fs.stat`/`fs.lstat`**, one `Stats` object retained through `sendFile`, then
`setFileHeaders` computing cache headers (and, per `send-file.ts`, ETag/Last-Modified derived from the
`Stats`) and `streamToResponse` performing the transfer.

Worst realistic case for a miss with extension fallbacks configured and a directory index:
**four or more filesystem syscalls for one HTTP request.**

## 6. Bottleneck analysis (§4.6)

| Observation | Category | Severity |
| ----------- | -------- | -------- |
| **No stat cache.** Every request for the same unchanged file re-stats it. For a static asset served thousands of times per second — the entire point of the subsystem — this is the same syscall repeated indefinitely. | I/O | **Medium (P-05)** — high potential impact, zero measurement |
| **No negative cache.** A repeatedly-requested missing path re-runs the full stat-plus-fallback cascade every time, so a 404 costs *more* syscalls than a 200. This is also an amplification concern: an attacker requesting nonexistent paths with extension fallbacks configured multiplies syscalls per request. | I/O / abuse surface | Medium |
| **No ETag/Last-Modified memoisation.** Header derivation repeats per request from a freshly-read `Stats`. | CPU | Low — dwarfed by the syscall |
| **No `sendfile(2)` / zero-copy path.** Transfer goes through a Node stream into `res`, so bytes traverse user space. Node exposes no portable zero-copy primitive for `http.ServerResponse`, so this is a runtime limitation, not an implementation defect. | Runtime limitation | Low — record, do not act |
| `serveStatic` is a 138-line function, cyclomatic complexity 20, cognitive 34 | Code shape | Low for runtime; relevant because a cache must be threaded through this logic |

**Explicitly not bottlenecks:**
- Early exits. Method and prefix checks precede all expensive work. Correct.
- The traversal screens. Three `String.includes` calls are sub-microsecond and are genuine security
  controls. Any caching design must run them **before** consulting a cache, or the cache becomes a
  traversal bypass.
- Registration-time option normalisation and the boot-time security verdict. Correctly hoisted.

## 7. Root cause candidates (§4.7)

**Primary — I/O: absence of a caching layer over an inherently cacheable operation.** File metadata
for a static asset is stable for the lifetime of most deployments (immutable build output behind a
hash), yet it is re-read from the kernel on every request. This is the canonical case for a bounded
cache with a TTL.

**Why it plausibly was not done:** correctness. A stat cache introduces a staleness window in which a
replaced file is served with old metadata, and — more seriously — a cache keyed on the resolved path
becomes a security-relevant structure, since `statSafe` performs symlink-escape validation against the
root. A naive cache that memoises "this path is safe" could be poisoned by a symlink created after
the cache entry was written. **This is why the recommendation in §8 caches metadata only, keyed after
validation, with an explicit TTL and a default that is off or short.** Any design that caches the
*validation verdict* rather than the *metadata* is rejected.

**Confidence: Hypothesis.** The mechanism (uncached per-request stat) is *Confirmed* — it is read in
source. The performance *impact* is unmeasured, because no benchmark covers this path. It is reported
at Medium, not High, precisely because of that.

## 8. Optimisation opportunities (§8.4)

See `05-solution-engineering.md` S-05 for the full design. Summary:

1. **Bounded LRU metadata cache with TTL**, opt-in via an option such as
   `statCache: { max, ttlMs }`, keyed on the **post-validation** absolute path, storing only
   `{ size, mtimeMs, isFile, isDirectory, etag }` — never the safety verdict. Traversal screens and
   symlink validation continue to run per request, before the cache is consulted.
2. **Bounded negative cache** with a short TTL, so repeated misses stop amplifying into syscall
   cascades. Must be bounded and short-TTL, or it becomes its own memory-exhaustion vector.
3. **Precompute per-file immutable headers** (`ETag`, `Content-Type`) alongside the cached metadata,
   removing the per-request derivation.
4. **Optional boot-time manifest** for immutable build output: walk the root once at startup and serve
   entirely from the manifest. Highest performance, but changes deployment semantics (files added
   after boot are invisible), so it must be explicitly opt-in and documented as such.

**None of these may be implemented before the measurement in §10 exists.** Recommending a cache with
a staleness window and a security surface on the strength of a structural argument alone would violate
the playbook's own evidence rule (§1.6). The benchmark scenario comes first.

## 9. Edge cases reviewed (§4.9)

Every one of these is a constraint on the caching design.

| Case | Current behaviour | Cache implication |
| ---- | ----------------- | ----------------- |
| `..` traversal | Rejected before any filesystem access | **Screens must run before cache lookup** |
| Null byte in path | Rejected | Same |
| Double slash | Rejected | Same |
| Symlink escaping root | `statSafe(path, followSymlinks, root)` validates containment | **Never cache the safety verdict — only metadata, keyed post-validation** |
| Dotfiles | `deny` → 403, `ignore` → 404, `allow` → served with a boot-time warning | Cache must not bypass the policy check |
| Directory without index | 403 | Cacheable as metadata |
| Directory needing trailing slash | 301 redirect | Cacheable |
| File replaced on disk | Currently always fresh | **TTL bounds the staleness window; this is the cache's core trade-off and must be documented** |
| File deleted after caching | Would 200 then fail on open | **Cache must tolerate open failure and invalidate, not assume the entry is valid** |
| Invalid percent-encoding | 400 (or `next()` under `fallthrough`) | Before cache |
| Range requests | Handled in `sendFile` | Needs accurate cached `size` |
| Client disconnect mid-transfer | `cleanup`/`settle` in `send-file.ts` handle it | Unaffected |

## 10. Investigation summary (§4.10)

| | |
| --- | --- |
| **Finding** | **P-05** — the static middleware performs at least one uncached filesystem `stat` per request, with no metadata cache, no negative cache and no ETag memoisation. A miss with extension fallbacks plus directory-index resolution can cost four or more syscalls per HTTP request, so a 404 is more expensive than a 200. |
| **Evidence** | `serveStatic` read at HEAD: `await statSafe(...)` on the unconditional per-request path, plus per-extension and index stats. **No performance measurement exists** — the benchmark suite has no static-file scenario. |
| **Root cause** | I/O — absence of a caching layer over an inherently cacheable operation, most likely omitted because a naive cache is a correctness and security hazard |
| **Runtime impact** | Unmeasured. Structurally, one warm `stat` is comparable to the framework's entire 30.30 µs fixed per-request cost, and is far worse cold or on network storage |
| **Performance impact** | **Cannot be projected.** Any number stated here would be invented |
| **Recommendation** | **First, add a static-file benchmark scenario** (cached hit, cache miss, large file, 404) — this is the actual deliverable. Only then implement an opt-in bounded LRU metadata cache with TTL, keyed post-validation, storing metadata but never the safety verdict, with a bounded short-TTL negative cache. |
| **Trade-offs** | A stat cache trades a staleness window for syscall elimination and adds bounded memory. The security constraint (never cache the symlink-safety verdict) is non-negotiable and makes the design more intricate than a plain memoisation. |
| **Priority** | **Medium** — high structural potential, zero measurement. Deliberately not ranked higher: promoting an unmeasured finding above measured ones would invert the playbook's prioritisation rule (§2.3). |
| **Confidence** | Confirmed (mechanism) / **Hypothesis** (impact) |
| **Validation** | `06-validation-regression.md` V-05 — blocked on the benchmark scenario existing |

**Cross-references:** `response.md` (`streamToResponse` shares the write path),
`07-optimization-roadmap.md` Phase 3, `appendix/open-questions.md` OQ-4.
