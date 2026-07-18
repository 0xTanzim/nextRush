## 1. Preparation & baseline

- [x] 1.1 Record adapter-node + router coverage baselines; confirm `bench:validate` passing and the public-surface snapshots unchanged.
- [x] 1.2 Enumerate every `this.raw.req` / `this.raw.res` site in `packages/adapters/node/src/context.ts` (grep + type-check) — the HP-5 conversion checklist.

## 2. HP-18 — regression guard (no code change; land first, trivial)

- [ ] 2.1 Add a guard test asserting `packages/router/src` match sources contain no backtrack `Reflect.deleteProperty` and no `Object.keys`-based post-match loop. It passes today (P2 removed them); it fails if reintroduced. Commit.

## 3. HP-17 — iterative `findNode`

- [ ] 3.1 RED: differential test — `findAllowedMethods` results identical between the current recursive `findNode` and the (to-be) iterative one across a corpus (static, param, wildcard, nested, trailing-slash, method-miss); precedence (static>param>wildcard) preserved; a **deep-path** (many-segment) 405/OPTIONS case that would overflow the recursive form.
- [ ] 3.2 GREEN: rewrite `findNode` to walk with an explicit stack (mirroring `matchNodeIndexed`), reusing the scalar `segmentAt` scan; keep it method-agnostic (returns the node).
- [ ] 3.3 Full router suite + differential green; the deep-path test no longer risks overflow. Commit.

## 4. HP-5 — lazy `ctx.raw` (measurement-gated, park-able)

- [ ] 4.1 RED: `ctx.raw` returns identical `{ req, res }` and is memoized (`ctx.raw === ctx.raw`); a raw-unread request allocates no wrapper (assert via the micro-bench in 4.4); every response method (`json`/`send`/`html`/`redirect`/streams), `ctx.signal`, and `ctx.ip` behave identically.
- [ ] 4.2 GREEN: add `private readonly _req`/`_res`; rewire ALL `this.raw.req`/`this.raw.res` sites (from 1.2) to `this._req`/`this._res`; replace the `raw` field with a memoized getter `get raw() { return (this._raw ??= { req: this._req, res: this._res }); }`.
- [ ] 4.3 Full adapter-node suite green (response methods, streaming, ip, graceful-shutdown); `bench:validate` byte-identical.
- [ ] 4.4 Allocation micro-bench: a raw-unread request allocates no `{ req, res }` wrapper. **Decision gate (design D2):** if the churn/benefit is poor, park HP-5 (keep HP-17 + the HP-18 guard) and record the outcome. Commit or park accordingly.

## 5. Verification & finalize

- [ ] 5.1 Full adapter-node + router suites green; `bench:validate` parity; `bench:compare:quick` smoke no regression; per-package coverage ≥90% with refactored branches covered; typecheck + lint clean.
- [ ] 5.2 Run `openspec validate router-context-final-cleanup --strict`; keep the work as independent per-finding commits (HP-18 guard, HP-17, HP-5) so each is revertible.
- [ ] 5.3 On archive, update the report §9 findings index (HP-5 / HP-17 / HP-18 → ✅) — completing the roadmap — and note any parked item (e.g. HP-5) honestly.
