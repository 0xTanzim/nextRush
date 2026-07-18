## 1. Preparation, baseline & characterization (do FIRST)

- [x] 1.1 Capture a baseline `pnpm bench:compare --profile full` (Hello World + Route Params) and `pnpm bench:validate` passing; record the router package coverage baseline and the public-surface snapshot.
- [x] 1.2 Write a **differential/characterization harness** running a broad path corpus through the current matcher and snapshotting resolved handler + `params` (contents AND key ownership/prototype) + executor. Corpus MUST include: static, nested params, backtracking, wildcard (incl. empty capture), param+wildcard, cased incl. **non-ASCII uppercase**, percent-encoded incl. **`%2F`/`%2E` and malformed (`%zz`/`%`/`%2`)**, empty/root `/`/repeated-slash (`//a//b`, `///`), trailing-slash (static + param), method-miss, `all()`, and mounted/grouped/prefixed routes.
- [x] 1.3 Add a router match-path **allocation micro-bench** (static + param) capturing current per-request bytes (staticKey string, result objects, tuple arrays, `Object.keys` array) as the before-number.

## 2. HP-10 — one RouteMatch allocation (land FIRST, lowest risk)

- [ ] 2.1 RED: a matched request yields a single `RouteMatch` with the unchanged shape; router-level middleware is attached exactly once (`RouteMatch.middleware === routerMiddleware`).
- [ ] 2.2 GREEN: build the `RouteMatch` once (matchRoute returns the final shape, or resolveMatch attaches `middleware` by mutation) — no second wrapper object.
- [ ] 2.3 Full router suite + differential harness green; allocation micro-bench shows one fewer object per matched request; `--profile full` A/B (Hello World) no regression. Commit.

## 3. HP-9 — method-nested static map

- [ ] 3.1 RED: static hit without a key string; method-miss (→ 405 path); trailing-slash match; `all()` across methods; **static-over-trie precedence** (`/users/me` static preferred over `/users/:id`); **registration flows** (prefix, `mount`/`use` copied routes, `group()`); **`reset()` clears the nested map fully** (no ghost entries).
- [ ] 3.2 GREEN: change `staticRoutes` to `Map<method, Map<path, entry>>`; update `registration.ts`, `router.ts` (`reset()`), `all()`, and the copied-route path; lookup selects the inner map by method, probes by normalized path (no concat); static map probed BEFORE the trie walk.
- [ ] 3.3 Public-surface snapshot unchanged; full router suite + differential harness green; allocation micro-bench shows the `staticKey` string gone; `--profile full` A/B (Hello World) no regression. Commit.

## 4. HP-12 — case-normalization fast-paths (unicode-correct)

- [ ] 4.1 RED: an already-lowercase ASCII path normalizes identically with no new allocation; a **non-ASCII uppercase** path still folds byte-identically to `path.toLowerCase()` (the fast-path does NOT wrongly skip); case-insensitive param matching resolves without a second normalize pass.
- [ ] 4.2 GREEN: skip `toLowerCase()` only when the path is provably case-stable (fall back to full fold on any non-ASCII/uncertain byte); remove the second `normalizePathForMatch` pass (derive original-case segments during the walk).
- [ ] 4.3 Differential harness green (incl. non-ASCII corpus entries); `--profile full` A/B (Route Params) no regression (else revert HP-12 alone). Commit.

## 5. HP-11 + HP-13 — param-walk rewrite (land LAST, riskiest, park-able)

- [ ] 5.1 RED — core invariants: precedence (static>param>wildcard), backtracking-with-no-stale-params, nested params, original-case param values, percent-decode + malformed fallback, wildcard remainder + empty capture, param+wildcard, empty-param, trailing-slash-on-param, param-less→`EMPTY_PARAMS`, `hasParamRoutes` gate.
- [ ] 5.2 RED — safety & critical flow: **null-prototype params** (a `/:__proto__` route binds `params.__proto__` as an own string with no `Object.prototype` mutation; `params.toString` is `undefined`); **encoded-slash/dot never re-segments** (`/files/:name` on `/files/a%2Fb` → `params.name==='a/b'`, still matches `/files/:name`); **concurrency isolation** (many concurrent matches with different params don't cross-contaminate); **deep-path safety** (a very-many-segment path resolves/misses with no new stack-overflow); **miss returns null** → 404 + `next()`; known-path-wrong-method → null → allowedMethods 405; a matched route runs its compiled `executor` (not re-composed).
- [ ] 5.3 GREEN: rewrite `extractSegment`/`matchNodeIndexed` to scan without per-segment tuple arrays and without the second original-case extraction; **prefer an iterative walk** (closing the stack-overflow risk; bounded-recursion is the minimum acceptable fallback, never unbounded); **materialize params once on the accepted terminal path** on a **null-prototype object** (no eager bind + backtrack `Reflect.deleteProperty`); keep `decodeParam` strictly post-split; track a bound-param count to drop the `Object.keys` post-loop (HP-13); return `EMPTY_PARAMS` when count is zero.
- [ ] 5.4 Differential harness green over the FULL corpus (byte-identical handler/params/prototype/executor to the pre-change matcher); full router suite green.
- [ ] 5.5 Allocation micro-bench shows tuple arrays + `Object.keys` array gone and `Reflect.deleteProperty` removed; `--profile full` A/B (Route Params, CPU-pinned).
- [ ] 5.6 **Decision gate (design D6):** keep the performance parts of HP-11 only if Route Params improves beyond stddev; if not, park them (keeping HP-9/HP-10/HP-12) — BUT retain the null-proto (D8) and traversal-safe-decode (D9) hardening on correctness grounds regardless, and the iterative/depth guard on DoS grounds. Record the outcome for RFC 015. Commit or partial-revert accordingly.

## 6. Cross-cutting verification & finalize

- [ ] 6.1 Confirm no router source file exceeds the 300-line cap after the rewrite; extract a helper if needed (design D7).
- [ ] 6.2 Full router suite + adapter-level routing integration + `bench:validate` parity all green; per-package coverage ≥90% with rewritten AND new safety branches covered; typecheck + lint clean.
- [ ] 6.3 Run `openspec validate router-match-path-allocation-trim --strict`; ensure the change is a clean stack of per-trim atomic commits (each independently revertible).
- [ ] 6.4 Feed the HP-11 benchmark + iterative/DoS + null-proto outcomes back into `docs/RFC/runtime-adapters/015-router-radix.md` (D4 deferral now measured) and update the report §9 status when the change archives.
