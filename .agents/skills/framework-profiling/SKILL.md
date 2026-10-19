---
name: framework-profiling
description: >
  Quickly check NextRush against Hono, Fastify and a raw-runtime floor in development mode (from
  source, no build, 30-60 seconds), find where per-request time goes, verify behaviour parity on
  Bun and Node, and audit a performance or correctness claim. Use when asked to benchmark,
  profile, compare NextRush with another framework (Hono, Elysia, Fastify), check whether a change
  made it slower or broke behaviour, measure bundle size / cold start / memory, reproduce one of
  the FB-01..FB-07 bugs, or add a new probe/competitor to the dev-check toolkit.
---

# Framework profiling — the 60-second dev-mode check

One script does everything: `apps/benchmark/scripts/dev-check/check.mjs`.
It bundles NextRush **from source** (no `pnpm build`), runs Hono and a raw-runtime "floor" next to it,
and prints PASS / WARN / KNOWN / FAIL. Use it instead of the hour-long `pnpm bench:full`.

> Cheap-model rule: **run the command, read the table, quote the numbers.** Do not estimate, do not
> remember numbers from earlier chats, do not claim a speedup without two runs.

## 0. Prerequisites (check once)

```bash
bun --version        # needed: bundler + default runtime (>= 1.4)
node --version       # >= 22
wrk --version        # only for the `wire` stage (skipped with a WARN if missing)
```

Run every command from the repo root (`/home/tanzim/project/framework/nextrush`).
Output and scratch files go to `apps/benchmark/scripts/dev-check/.out/` (git-ignored).

## 1. Quick start

```bash
node apps/benchmark/scripts/dev-check/check.mjs            # all stages, ~30-40 s on Bun
node apps/benchmark/scripts/dev-check/check.mjs probe      # behaviour only, ~2 s (Bun) / ~8 s (Node)
node apps/benchmark/scripts/dev-check/check.mjs probe --rt node
node apps/benchmark/scripts/dev-check/check.mjs inproc     # per-request cost, ~15 s
node apps/benchmark/scripts/dev-check/check.mjs profile    # where the time goes, ~2 s
```

The next run prints `(+x% / -x% vs last run)` for each metric, so **before/after = run twice**.
Exit code `1` means a budget failed or a probe failed that is not a known bug.

## 2. Stages — what each answers

| Stage | Time | Question it answers | Bad result means |
| --- | --- | --- | --- |
| `bundle` | ~5 s | How big is a hello-world bundle (NextRush vs Hono vs Fastify)? | A new import leaked into the entry (budget `hello-nextrush-root` ≤ 40 KB) |
| `cold` | ~8 s | Process start → first response with 25 and 1,000 routes; RSS | Registration got slower or memory grew (ratio vs Hono; today 1.03 and 0.47) |
| `inproc` | ~15 s | Per-request framework cost with **no network** (µs/request) | Context/response/timeout work got heavier (ratio vs Hono; today ≈ 2.1, target ≤ 1.3) |
| `wire` | ~15 s | Real HTTP throughput with `wrk` (needs `wrk`) | Same as above but noisy — **informational**, never trust one run |
| `probe` | ~2-8 s | Is behaviour correct and identical on this runtime? (real sockets, byte-exact) | A bug, or a regression of a fixed bug |
| `profile` | ~2 s | Which functions burn the CPU? (Bun `--cpu-prof-md`; Node `--cpu-prof`) | Read the table (section 5) |

No stage given = all except `profile`.

## 3. Reading the table

```
PASS   cold.n1000.vs_hono        0.47                      <- within budget
WARN   inproc.nextrush.vs_hono   2.15        target 1.3    <- works, not at the goal yet
KNOWN  probe.json-bigint         status=200 bytes=0   FB-01 - ...   <- tracked bug, expected to fail
FAIL   probe.error-code-4xx      status=400 code=...             <- NEW problem: investigate
INFO   inproc.hono.us            2.41 us/req               <- reference number, no gate
```

- **Ratios** (`vs_hono`) are NextRush ÷ Hono measured in the same run. They are the numbers to
  quote; absolute µs and rps change from machine to machine.
- `KNOWN` ids come from `budgets.json → knownFailures`. They map to briefs in
  `report/architecture/fix-briefs/` (FB-01 … FB-07).
- A `FAIL` that is not in `knownFailures` = a **regression**. Fix or revert before anything else.

## 4. Workflows (copy these)

### A. "Did my change make it slower?"
1. `git stash` (or check out the base) → `node …/check.mjs inproc` (baseline).
2. Apply the change → run the same command again.
3. Report the `% vs last run` and the `inproc.nextrush.vs_hono` ratio. Run it a third time if the
   delta is < 5 % — that is noise.
4. Also run `probe` on **both** runtimes (`--rt bun`, `--rt node`) so speed did not cost behaviour.

### B. "Is NextRush faster/slower than Hono (or Fastify)?"
`node …/check.mjs bundle cold inproc wire` → quote the four `vs_hono` / KB / ms rows. State the
runtime (Bun or Node) and that numbers are directional. Fastify appears in `bundle` only; for
throughput against Fastify use `--rt node` and add an entry (section 7).

### C. "Where does the time go?"
```bash
node …/check.mjs profile                       # Bun, NextRush in-process loop
node …/check.mjs profile --entry inproc-hono   # compare Hono
node …/check.mjs profile --rt node             # Node profile (dominated by undici Request creation in-process; use `wire` for Node)
HEADERS=12 node …/check.mjs profile            # more request headers
```
Read the `Total%` column. **Ignore** `Request`, `Response`, `Headers`, `URL` rows that say
`[native code]` — that is the platform/harness. Look for NextRush functions: `forEach` (the header
copy, `headersToRecord`), `setTimeout`/`race`/`clearTimeout` (timeout race), `WebContextBase`
(context construction), `getResponse`, `matchRoute`. The full markdown file path is printed; `grep`
it. Today's attribution: header copy ≈ 18 %, timeout race ≈ 10 %, `new URL` ≈ 5 %,
`JSON.stringify` ≈ 3.5 %.

### D. "Did I break behaviour?" / "Reproduce a bug"
`node …/check.mjs probe --rt bun` then `--rt node`. Each probe line names its brief (`FB-0n`). Open
that brief — it has the root cause with `file:line`, the fix steps, the tests to write first.

### E. "Fix a bug from a brief" (for another agent)
1. Open the brief; run its **Reproduce** command; see `KNOWN`.
2. Write the failing test first (TDD), then the fix, as the brief says.
3. `probe` on bun **and** node → the probe is now `PASS`.
4. Delete the brief's id (e.g. `"FB-01"`) from `knownFailures` in
   `apps/benchmark/scripts/dev-check/budgets.json`. Now the probe guards against regression.
5. Run the package tests, `pnpm typecheck`, `pnpm lint`.

### F. "Audit a claim" (someone says X is slow / big / broken)
| Claim type | Command | Pass condition to believe it |
| --- | --- | --- |
| "bundle is big" | `check.mjs bundle` | KB row above the budget, repeated |
| "startup is slow" | `check.mjs cold` | `cold.n1000.vs_hono` > 1.2 twice |
| "per-request is slow" | `check.mjs inproc` then `profile` | ratio > budget **and** a NextRush function in the profile |
| "throughput is low" | `check.mjs wire` ×3 | ratio < 0.5 in all three |
| "it's a bug" | write a probe (section 6) | the raw-socket probe fails on a clean checkout |
Always state: runtime, tool version, number of runs, and what you did **not** measure.

## 5. Manual tools (when the script is not enough)

```bash
# CPU profile as grep-friendly markdown (Bun)
bun apps/benchmark/scripts/dev-check/lib/build.ts apps/benchmark/scripts/dev-check/entries/inproc-nextrush.ts /tmp/x.js bun --no-minify
bun --cpu-prof-md --cpu-prof-dir=/tmp/prof /tmp/x.js
bun --heap-prof-md --heap-prof-dir=/tmp/prof <bundle>.js        # allocations

# Node
node --cpu-prof --cpu-prof-dir=/tmp/prof <bundle>.node.js
node apps/benchmark/scripts/dev-check/lib/cpuprofile-top.mjs /tmp/prof/<file>.cpuprofile 20

# Deterministic allocation benches already in the repo (seconds, very low noise)
pnpm --filter nextrush-benchmark bench:alloc:dispatch
pnpm --filter nextrush-benchmark bench:alloc:web
pnpm --filter nextrush-benchmark bench:alloc:router

# Raw load (pin cores if `taskset` exists so server and client do not fight)
taskset -c 0-3 bun apps/benchmark/scripts/dev-check/.out/serve-nextrush.bun.js &   # needs PORT=4300
taskset -c 4-7 wrk -t2 -c64 -d5s --latency http://127.0.0.1:4300/
```

The long, publishable harness is still `pnpm --filter nextrush-benchmark bench:standard|full`
(hours). Use it for release numbers, never for the inner loop.

## 6. Extending the toolkit

**Add a correctness probe** (the most useful extension). In `check.mjs`, add one row to the
`probes` array — `[id, bugId, description, async (port) => [pass, note]]`. Use the raw client so
the request target is sent byte-for-byte:

```js
['my-case', 'FB-0n', 'what must be true', async (p) => {
  const r = await rawRequest(p, { method: 'POST', target: '/echo',
    headers: { 'content-type': 'application/json' }, body: '{"a":1}' });
  return [r.status === 200 && j(r)?.body?.a === 1, `status=${r.status}`];
}],
```
If the probe needs a new route, add it to `entries/probe-server.ts`. Use `bugId '-'` when it is
not a known bug. If it fails today because of a real bug, write the brief first, then add the id to
`knownFailures`.

**Add a measurement entry**: copy `entries/inproc-nextrush.ts`, change what it exercises, print a
single `US=<number>` (or `T=… RSS=…`) line, and add a stage function in `check.mjs` that spawns it
and calls `gate(name, value, budgets.ratios[name])`.

**Add a competitor** (e.g. Elysia, needs network once): `cd apps/benchmark && bun add elysia@next`
(or `pnpm add -D elysia@next`), mirror `entries/serve-hono.ts` and `entries/inproc-hono.ts`, and
add one row per stage. Do not publish numbers for a beta version without saying so.

**Change a budget**: edit `budgets.json`. `max`/`min` = hard fail, `target` = warn until reached.
Only tighten budgets in the same PR that improves the metric; never loosen one to make a red build
green without a written reason in the PR.

## 7. Pitfalls (these have already caused wrong conclusions)

1. **One run is not data.** The raw `Bun.serve` floor varied 62k-92k rps between runs on this box.
   Use ratios, best-of-N, and repeat.
2. **Load client saturation.** If the raw floor is ≈ the client's limit, ratios against it lie; the
   ratio against Hono is still valid. `autocannon` saturates at ~50k rps — use `wrk`.
3. **`fetch`/`curl` hide path bugs.** They normalise `..` and `%2e`. Use `lib/raw-http.mjs`.
4. **`curl` needs `--noproxy '*'`** inside the sandbox (it routes through a proxy that blocks IP literals).
5. **Check option defaults before calling something broken.** `timer()` only sets its header with
   `exposeHeader: true`; an early wrong claim came from testing the default.
6. **Source bundles are not published bundles.** KB numbers are for comparing and gating, not for
   marketing.
7. **Do not compare across machines or across runtimes.** Bun doubles every framework's numbers.
8. **Do not leave servers running.** The runner kills its children; if you start one by hand, kill it.
   Never `pkill -f` a pattern that appears in your own command line.
9. **A passing unit test is not a passing system.** Mock-context tests missed six bugs. Prefer the
   real-socket probes.

## 8. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `bun: command not found` | Install Bun ≥ 1.4 (needed for the bundler) |
| `build … failed` | Read the printed bundler log; usually a TypeScript syntax error in the changed file |
| `port 43xx not up` | A stale process holds the port: `ps -eo pid,args | grep -E "dev-check|\.out/"` then kill that PID |
| `wire` shows `skipped` | Install `wrk` (`apt install wrk` / `brew install wrk`) |
| Numbers jump ±20 % | Close other apps, run again, compare **ratios** |
| `probe` hangs 2.5 s per line | That probe is detecting a real hang (e.g. FB-01 on Node) — expected while `KNOWN` |

## 9. Where things live

| Thing | Path |
| --- | --- |
| Runner | `apps/benchmark/scripts/dev-check/check.mjs` |
| Source bundler | `apps/benchmark/scripts/dev-check/lib/build.ts` |
| Raw HTTP client | `apps/benchmark/scripts/dev-check/lib/raw-http.mjs` |
| Node profile summariser | `apps/benchmark/scripts/dev-check/lib/cpuprofile-top.mjs` |
| Budgets + known failures | `apps/benchmark/scripts/dev-check/budgets.json` |
| Entries (tiny apps) | `apps/benchmark/scripts/dev-check/entries/*.ts` |
| Fix briefs | `report/architecture/fix-briefs/` |
| Why this exists | `docs/RFC/runtime-adapters/040-resource-budgets-and-request-path-footprint.md` |
| Validation report | `report/architecture/architecture-audit-validation-followup.md` |

## 10. Baseline (2026-10-18, Bun 1.4.3 / Node 26.12, shared 8-core dev box)

| Metric | NextRush | Hono |
| --- | --- | --- |
| Hello bundle (root / Bun adapter / Node serve) | 27.7 / 47.5 / 52.1 KB | 19.1 / – / 38.8 KB |
| Cold start 25 routes / 1,000 routes (Bun) | 7.7 / 11.9 ms | 7.5 / 25.3 ms |
| In-process µs/request, 4 headers (Bun) | 5.17 | 2.41 (raw floor 1.76) |
| Wire rps hello (Bun, wrk) | 42.4k | 75.7k |

If a fresh run differs wildly from this table, suspect the machine first, then the change.
