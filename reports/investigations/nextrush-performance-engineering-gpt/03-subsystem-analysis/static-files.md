# Subsystem Analysis — Static File Serving

**Playbook phase:** Part 4 §4.20 (Static File Serving). **Status: Structural analysis Completed;
performance-contribution analysis Blocked** (evidence gate) **and Unrepresented** (no benchmark
scenario exercises this subsystem at all — a distinct, stronger gap than the profiling gate that
applies to the other subsystems).

Related canonical reports: [`../01-benchmark-analysis.md`](../01-benchmark-analysis.md) (10
scenarios, none of which are static-file serving) · [`../07-optimization-roadmap.md`](../07-optimization-roadmap.md)
(P3 — add a static benchmark before any static optimization).

## Purpose

The static middleware serves files from disk in response to matching requests — safe path
resolution, conditional-request support (ETag/freshness), range requests, and either a full read or
a stream depending on file size/type.

## Present design

**Confirmed (structure):** the static middleware performs, per request: prefix matching, path
decoding, path-traversal checks, a safe path join (defending against `../` escapes), a symlink-safe
`stat` call, extension/index-file fallback resolution, dotfile-serving policy enforcement, and
then — depending on outcome — response-header construction (including ETag and freshness/
conditional-request headers), range-request handling, and either an in-memory read-and-send or a
stream. The streaming path additionally creates timeout, listener, and settlement closures,
structurally similar in shape to the body-parser's stream-consumption pattern
([`body-parser.md`](./body-parser.md)).

## Benefits of the present design

- Path-traversal checks and safe joining are a mandatory security property for any file-serving
  code (`project-rules.instructions.md` §4 — untrusted route parameters, and the general "never
  trust external input" rule) — arguably the single most security-sensitive subsystem in the
  framework, since it touches the filesystem directly.
- Symlink-safe `stat` avoids a symlink-based traversal/disclosure vector.
- ETag/freshness/conditional-request support lets well-behaved clients avoid re-downloading
  unchanged files entirely (a `304 Not Modified` response), which is a genuine bandwidth/latency
  win for the cases it applies to — not overhead, but a feature that trades a small amount of
  per-request header work for a potentially much larger savings on repeat requests.
- Choosing between a full read and a stream based on file characteristics avoids unconditionally
  buffering large files into memory.

## Structural costs

Every one of the safety/correctness steps above (traversal checks, safe join, symlink-safe stat,
fallback resolution, dotfile policy, ETag/freshness computation) is real per-request CPU work that
a naive "just read the file" implementation would not do — but every one of them is a deliberate
correctness or security trade, not an accidental cost, and this investigation does not have any
benchmark evidence suggesting they are disproportionate.

## Evidence status

| Claim | Status |
| --- | --- |
| Static middleware performs the traversal/safety/caching/range logic described above | **Confirmed** (source structure) |
| No benchmark scenario in `apps/benchmark`'s current suite exercises static file serving | **Confirmed** (absence — `01-benchmark-analysis.md`'s 10 scenarios are Hello, JSON, Route Params, Query, POST JSON, Deep Route, Middleware, Error, Large JSON, Empty; none is a static-file scenario) |
| Static file serving performance, relative to any competing framework or to raw Node's `fs`/`http` primitives | **Unknown** — genuinely unrepresented, not merely unprofiled |

## Finding

### F-STATIC-01 — Static file serving has no representation in the current benchmark suite; performance is entirely Unknown, and no optimization should be proposed sight-unseen

- **Status/confidence:** Structure Confirmed; performance entirely Unknown (unrepresented, a
  stronger gap than "unprofiled").
- **Priority:** P3 in the roadmap — deliberately last, because "add a benchmark scenario" must
  happen *before* any profiling or optimization work here can even begin, unlike every other
  subsystem in this investigation which at least has a benchmark scenario to reason about
  structurally.
- **Current situation/evidence:** See "Present design" and "Evidence status" above. This is the
  only subsystem in this investigation for which the benchmark suite provides zero signal, not even
  an indirect pattern to form a hypothesis from.
- **Present-design benefits:** mandatory security properties (traversal/symlink safety), bandwidth-
  saving conditional-request support, memory-conscious read-vs-stream choice (see above).
- **Root cause:** Not applicable — no performance gap has been observed because none has been
  measured.
- **Runtime/performance impact:** Unknown.
- **Recommendation:** Do not propose any static-serving optimization from this investigation. Add a
  dedicated static-file benchmark scenario (varying file size, cached-vs-uncached conditional
  requests, and range requests) as a prerequisite before any future investigation of this
  subsystem, per [`../07-optimization-roadmap.md`](../07-optimization-roadmap.md) P3.
- **Alternatives:** Not evaluated — no problem statement exists.
- **Trade-offs:** Not applicable.
- **Risks:** The risk of *not* flagging this gap is that a future contributor assumes static-file
  performance was covered by this investigation because every other subsystem was — it explicitly
  was not.
- **Expected improvement:** Unknown; not applicable, no experiment proposed.
- **Migration difficulty:** Not applicable.
- **Validation:** Not applicable — no change proposed. Once a benchmark scenario exists, this
  subsystem should be re-investigated using the same methodology as the others in this report.

## Edge cases (playbook §4.9)

Range requests, conditional requests (If-None-Match/If-Modified-Since), large files requiring
streaming, and symlinked or dotfile paths are all structurally handled per the design above, but
none have any performance data — every one of them is Unknown.
