# 03 — `ctx.params` and `ctx.query` are V8 dictionary-mode objects

This is the report for the deficit the user named: **route parameters**. It is also, by measured
margin, the largest single recoverable cost found in this investigation.

---

## 1. Finding

`ctx.params` and `ctx.query` are built with `Object.create(null)`. In V8 that produces an object with
**slow (dictionary) properties**, confirmed directly with `%HasFastProperties` **[M]**:

```
Object.create(null) + key   → fast properties? false
{ __proto__: null } literal → fast properties? false
{} + key                    → fast properties? true
{ id: '42' } literal        → fast properties? true

router params object        → fast properties? false     ← ctx.params, via the real Router
query params object         → fast properties? false     ← ctx.query, via parseQueryString
```

Consequences, all measured:

| | `Object.create(null)` (current) | plain `{}` | ratio |
| --- | --- | --- | --- |
| Build 1 key + read it | **65.24 ns** ±17.33 | 16.55 ns ±4.68 | **3.9×** |
| Allocation | **184.11 B/op** (cv **0.0%**) | 56.03 B/op (cv 0.0%) | **3.3×** |
| Read an existing key | **15.78 ns** ±4.03 | 6.23 ns ±0.72 | **2.5×** |

A dictionary-mode object's property loads **cannot be inline-cached**. So this is not only a
construction cost — **every `ctx.params.id` and `ctx.query.q` read in every user handler, forever, is
a dictionary lookup** rather than a monomorphic inline-cached load. It is a permanent, framework-imposed
deoptimization of application code.

### How it shows up in the router

Real `Router.match()`, allocation per call **[M]**:

| Route shape | B/op | cv |
| ----------- | ---- | -- |
| static (`/users/list`) | **56.11** | 0.1% |
| 1 param (`/users/:id`) | **285.78** | 8.0% |
| 3 params (deep route) | **314.15** | 0.1% |

A one-param match allocates **5.1× a static match**, and **184 of those 285.78 bytes — 64% — is the
params container alone [D]**. This is the mechanism behind the measured `route-params` marginal excess
of **+4.41 µs @1 conn** and **+1.37 µs @256** (report `01` §3), and it also explains why
`route-params` is one of only three scenarios that lose at *both* concurrency levels.

Note this is **on top of** the pooling work already shipped (`reduce-router-match-allocations`, which
took param-route match from 467.6 → 328.9 B/op). Pooling removed the frame/binding-array allocations;
the container itself was never addressed.

---

## 2. Why `Object.create(null)` is there — the constraint that must survive

It is a deliberate security decision (`match-route.ts`, design.md D8): a route parameter named
`__proto__`, `constructor` or `prototype` must bind as an **own key** without mutating any prototype,
and no inherited member may be visible on `ctx.params`. The query parser has the same requirement plus
an explicit `DENIED_KEYS` denylist, because query keys are attacker-controlled.

**Plain `{}` genuinely fails this.** Measured **[M]**:

```
key "__proto__" assigned:      own key created?   value
  Object.create(null)          true               "ATTACK"     ✅ safe
  { __proto__: null }          true               "ATTACK"     ✅ safe
  new NullBag()                true               "ATTACK"     ✅ safe
  plain {}                     FALSE              {}           ❌ went to the setter — pollution vector
```

So `{}` is correctly rejected, and any proposal that reaches for it is wrong. The question is whether
the security property requires *dictionary mode*, or merely requires *no `Object.prototype` in the
chain*. It is the latter.

---

## 3. The fix: a null-prototype **constructor**, not a null-prototype **object**

```ts
function NullBag() {}
NullBag.prototype = Object.create(null);   // built ONCE, at module load
// per request:
const params = new NullBag();
params.id = '42';
```

The prototype chain terminates at a null-prototype object, so `Object.prototype` is unreachable — but
instances are created from a **constructor with a stable initial map**, so V8 gives them fast
properties. Measured against every candidate **[M]**:

| Candidate | fast props | `__proto__` binds as own key | `Object.prototype` reachable | build+read ns | B/op |
| --------- | ---------- | --------------------------- | ---------------------------- | ------------- | ---- |
| `Object.create(null)` **(current)** | ❌ false | ✅ yes | ✅ no | 65.24 ±17.33 | **184.11** |
| `{ __proto__: null }` | ❌ false | ✅ yes | ✅ no | 71.36 ±11.74 | 197.82 |
| **`new NullBag()`** | ✅ **true** | ✅ **yes** | ✅ **no** | **5.96 ±0.31** | **32.04** |
| plain `{}` | ✅ true | ❌ **no** | ❌ **yes** | 16.55 | 56.03 |
| `Object.setPrototypeOf({}, null)` | ✅ true | ✅ yes | ✅ no | not benched | not benched |

**`new NullBag()` is 11.0× faster to build+read and allocates 5.75× less, while satisfying every
security property the current design has — proven by the same pollution test the current design
passes.** It requires no code generation, so the corpus's standing prohibition on codegen
(`reports/investigations/performance-investigation-reconciliation.md` Rec 11b) is respected.

`{ __proto__: null }` — the modern idiom, and the obvious first guess — is **worse than the status
quo** on both metrics. Worth recording so nobody "modernises" into a regression.

`Object.setPrototypeOf({}, null)` also reports fast properties and is worth benching as a
one-liner alternative; it was not measured here and is listed in §7.

### Scope of the change

| Site | File | Current |
| ---- | ---- | ------- |
| route params materialization | `packages/router/src/match-route.ts` | `Object.create(null)` in the bind loop |
| shared empty params | `packages/router/src/constants.ts` | `EMPTY_PARAMS` — shared and frozen, **leave as-is** (allocated once) |
| query parse result | `packages/runtime/src/query.ts` | `Object.create(null)` per query-bearing request |
| shared empty query | `packages/runtime/src/query.ts` + `adapters/node/src/context.ts` | `EMPTY_QUERY` — shared, **leave as-is** |

Two hot sites; roughly five lines. The shared frozen empties are allocated once at module load and
their dictionary mode is irrelevant — but note they are *read* on every params-less request, and a
dictionary-mode `EMPTY_PARAMS` means even `ctx.params.id` on a static route is a slow read. Whether to
also convert the empties is a **separate, measurable question** (§7).

> ### ✅ RESOLVED (2026-07-31) — shipped as `Object.create(NULL_PROTO)`, see ADR-0021
>
> The "roughly five lines" framing above was **wrong**, and the error was caught while implementing
> it. Three artifacts made the null prototype a **ratified guarantee**, not an implementation detail:
>
> 1. **`openspec/specs/router/spec.md`** — a capability requirement, which AGENTS.md §21 defines as
>    TRUTH: *"The per-request params object materialized by the walk SHALL be a null-prototype object."*
> 2. **`apps/website/content/docs/reference/(core-routing)/runtime.mdx:439`** — published user-facing
>    documentation.
> 3. **`packages/router/src/__tests__/match-safety.test.ts`** — `expect(Object.getPrototypeOf(match?.params)).toBeNull()`.
>
> So this needed the governance path, which was taken: the capability requirement now mandates the
> **invariant** (`prototype chain excludes Object.prototype`, plus fast properties) instead of the
> **mechanism** (`is a null-prototype object`), both documentation claims were corrected, and the
> decision is recorded in **`docs/adr/ADR-0021-fast-property-request-containers.md`**.
>
> **The shipped form is `Object.create(NULL_PROTO)`, not `new NullBag()`.** A shared module-level
> `NULL_PROTO = Object.create(null)` is hoisted once; containers derive from it. Measured equivalent to
> the constructor form (42.41 vs 43.70 ns, within noise at cv ~32%) while avoiding a constructor
> function and its `this` typing — and it is a one-token diff at each site.
>
> **`Object.setPrototypeOf({}, null)` was measured and rejected.** It satisfies the old requirement
> literally (`getPrototypeOf() === null`) and does fix dictionary mode, but **[M]**:
>
> | Candidate | fast props | `getPrototypeOf() === null` | build+read ns | B/op |
> | --------- | ---------- | --------------------------- | ------------- | ---- |
> | `Object.create(null)` (was) | ❌ false | ✅ true | 58.12 | 184.31 |
> | **`Object.create(NULL_PROTO)`** *(shipped)* | ✅ **true** | ❌ false (terminates one hop later) | **43.70** | **56.02** |
> | `new NullBag()` | ✅ true | ❌ false | 42.41 | 32.06 |
> | `Object.setPrototypeOf({}, null)` | ✅ true | ✅ true | **138.03** ← 2.4× slower | 56.02 |
>
> `setPrototypeOf` trades +80 ns of build time for −128 B of allocation — a net time regression for
> any handler reading a param once or twice, so preserving the literal prototype identity was not
> worth its cost. Amending the requirement was the cheaper and more honest fix, because the
> requirement was over-specified: it named a mechanism when it meant an invariant.
>
> **Measured outcome [M]** — `bench:alloc:router`, paired within one session, `taskset -c 2-5`:
>
> | | static B/op | param-route B/op |
> | --- | --- | --- |
> | before | 64.2 (cv 0.01%) | **293.4** (cv 0.77%) |
> | after | 64.2 (cv 0.01%) | **162.0** (cv 0.16%) |
> | delta | unchanged | **−131.4 B (−44.8%)** |
>
> **Scope was wider than this report identified.** `Object.create(null)` was also used for
> `ctx.headers` (`runtime/src/headers.ts`) and for three *duplicated* `EMPTY_PARAMS`/`EMPTY_QUERY`
> sentinels (`runtime/src/web-context-base.ts`, `adapters/node/src/context.ts`). All were converted;
> `NULL_PROTO` is now exported from `@nextrush/runtime` so adapters share one instance. The same
> defect remains in `@nextrush/body-parser`, `@nextrush/cookies` and `@nextrush/form-data` — out of
> scope here, logged as Findings in §8.

---

## 4. Alternative designs considered

| | **A. `new NullBag()`** *(recommended)* | **B. Registration-time shaped factory** | **C. Validate names at registration, use `{}`** | **D. Do nothing** |
| --- | --- | --- | --- | --- |
| Design | One shared null-proto constructor for all params/query objects | Per-route factory with the route's param names baked in | Reject `__proto__`/`constructor`/`prototype` as *route param names* at registration; params are then provably safe in a plain `{}` | — |
| Measured | **5.96 ns / 32.04 B** | 9.56 ns / 32.02 B (via `new Function`) | 16.55 ns / 56.03 B | 65.24 ns / 184.11 B |
| Security | Identical to current, proven | Identical | Safe for **params** (names are static); **unsafe for query** (keys are attacker-controlled) | Current |
| Codegen | No | **Yes — `new Function`. Prohibited** | No | — |
| Complexity | ~5 lines, 2 files | Per-route factory cache | Registration-time validation + a new error message | — |
| Inherited-name keys (`toString`) | Not reachable ✅ | Depends | **`ctx.params.toString` returns a function** ❌ | Not reachable ✅ |
| Verdict | **Recommended** | Rejected (codegen) | Rejected (query unsafe, and the `toString` footgun) | Rejected |

**Why A over C:** C is conceptually attractive — move the guard to registration time, which is
PERF-001 §5.1's preferred direction — but it only works for params, not query, so it would leave the
query path unfixed *and* introduce a second container design. A fixes both with one primitive and is
measurably faster than C anyway.

---

## 5. Root cause

```
   SYMPTOM       route-params is one of only three scenarios that lose at both @1 and @256
                            │
                            ▼
   EVIDENCE      %HasFastProperties(ctx.params) === false; 1-param match allocates 5.1× a
                 static match; 64% of that is the container; reads are 2.5× slower
                            │
                            ▼
   TECHNICAL     Object.create(null) yields a dictionary-mode object in V8
   CAUSE
                            │
                            ▼
   ARCHITECTURAL A security requirement ("no reachable Object.prototype") was implemented with
   CAUSE         the most obvious primitive rather than the cheapest primitive that satisfies it.
                 The requirement is about the PROTOTYPE CHAIN; the chosen primitive also changes
                 the OBJECT'S STORAGE MODE. Nobody separated the two, because the cost of the
                 second is invisible without %HasFastProperties — and no gate observes it.
                            │
                            ▼
   LONG-TERM     Every user handler that reads ctx.params/ctx.query pays a permanent,
   IMPACT        un-inline-cacheable lookup. The cost is exported to application code, which
                 is the exact inversion of AGENTS.md §4 ("the framework owns complexity").
```

---

## 6. A related finding, correctly deprioritized

`packages/runtime/src/query.ts:safeDecodeURIComponent` decodes unconditionally, while the router's
`decodeParam` fast-paths on `!value.includes('%')`. Measured on non-encoded input, the guard is
**4.6–4.9× faster** (141.7 → 28.8 ns/call across two independent runs) **[M]**.

**But NextRush already beats Fastify on `query-string` by 3.37 µs @1 conn and 0.63 µs @256** (report
`01` §3). The scenario is not a deficit. This is therefore **P3** — a free win to fold into the
container change while touching the same file, not a priority in its own right. Reported here so it
is not mistaken for a gap, and so the earlier report's framing of it as "High" is corrected.

> ### ✅ SHIPPED (2026-07-31)
>
> Folded in as planned, as `if (!str.includes('%') && !str.includes('+')) return str;` — guarding on
> **both** `%` and `+`, unlike the router's `decodeParam` which only needs `%`, because form-encoding
> is only relevant on the query path. Behaviour verified byte-identical by 6 new tests
> (`packages/runtime/src/__tests__/query-container.test.ts`) covering `+`→space, `%20`→space, UTF-8
> `%E2%9C%93`→`✓`, mixed `+`/`%`, malformed-encoding fallback, and untouched plain values — plus a
> live server check on `/search`.

---

## 7. Validation plan and open questions

**Functional (must all pass unchanged):**
- `packages/router` full suite, especially the prototype-pollution tests around `__proto__`/
  `constructor`/`prototype` param names, and the `EMPTY_PARAMS` identity tests.
- `packages/runtime` query tests, including `DENIED_KEYS` and the array-value accumulation path.
- `packages/adapters/conformance` — `ctx.params`/`ctx.query` shape and behaviour must stay identical
  across all four adapters.
- **New tests required:** `Object.getPrototypeOf(ctx.params)` changes from `null` to a null-prototype
  object. Anything asserting `=== null` will break. Also verify `JSON.stringify`, spread, `Object.keys`,
  `for...in` and `structuredClone` behave identically, and that `ctx.params.toString === undefined`.

**Performance gates:**
- `bench:alloc:router` — param-route match should fall from ~328.9 B/op by roughly 150 B.
- `bench:alloc:param-match` — depth-8 param case.
- A **new** `%HasFastProperties` assertion in `packages/adapters/conformance`: `ctx.params` and
  `ctx.query` must have fast properties. This is the gate that would have caught the original choice.
- Pinned `standard` re-run: `route-params` predicted 39.88 → ~38 µs/req **[D, weak]** — the container
  is ~150 B and ~59 ns of a 39.88 µs request, so the *end-to-end* effect is small even though the
  component effect is 11×. **State this honestly: the big win is in user-handler read cost and
  allocation rate, not in this one benchmark row.**

**Open questions — all three now ANSWERED [M]:**

1. **Should the shared frozen `EMPTY_PARAMS`/`EMPTY_QUERY` also change? → YES, and it matters more
   than assumed.** The frozen sentinel is dictionary-mode too, and it is *read* on every params-less
   request. Reading an **absent** key on it — the `ctx.params.id` pattern on a static route, the most
   common request shape there is — measured **16.715 ns vs 7.492 ns, a 2.23× penalty**. All four
   sentinel definitions (router `constants.ts`, runtime `web-context-base.ts`, node adapter
   `context.ts` ×2) were converted. Per-request allocation on the static path is unchanged (64.2 B/op,
   cv 0.01% before and after), confirming the change is free.
2. **Is `Object.setPrototypeOf({}, null)` equivalent? → NO.** Fast properties yes, allocation yes
   (56.02 B/op), but **138.03 ns vs 58.12 build+read — 2.4× slower**. Rejected; see the resolution
   block in §3.
3. **Does V8 keep fast mode as param count grows? → YES, through every realistic shape.** Fast at
   **1, 2, 3, 5, 8, 10 and 16 keys**; it converges to dictionary only at **32 keys**, where it matches
   `Object.create(null)` anyway (1893 vs 1875 B — no regression at the crossover). Allocation is
   2–2.6× lower at every realistic shape (1 key 33.7 vs 221.7 B; 3 keys 72.1 vs 184.2; 8 keys 224.1 vs
   504.1; 16 keys 472.1 vs 969.3). The multi-key pollution guarantee holds.

---

## 8. Findings — same defect, out of scope here

`Object.create(null)` is used for per-request containers in three middleware packages that this
report's scope (params/query) did not cover. Each is the identical defect with the identical
one-token fix, and each has its own test suite that would need to be re-run:

| Package | Site | Container |
| ------- | ---- | --------- |
| `@nextrush/body-parser` | `src/utils/url-decode.ts:101,150` | parsed form-body object and its nested objects |
| `@nextrush/cookies` | `src/parser.ts:67` | `ParsedCookies` — read per request by any cookie consumer |
| `@nextrush/form-data` | `src/parser.ts:90` | multipart `fields` record |

Not changed here, to keep the diff attributable to the params/query decision (ADR-0021). Each should
adopt the same `NULL_PROTO` pattern, and the shape gate should be extended to cover them.
