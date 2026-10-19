# Tasks

## 1. Spike: measure the construction variants before touching the builder

- [x] 1.1 Add `apps/benchmark/scripts/alloc/response-construction-alloc-child.js` measuring the five
      variants from design.md D1 (`current`, `literal`, `shared-frozen`, `json`, `pre-serialized`)
      for a hello-world JSON body, and its parent `response-construction-alloc.js` that runs each
      variant in its own `--expose-gc` child and reports bytes-per-op plus a timing figure. Verify:
      the harness runs under Node and reports five rows; a run with a GC inside the measurement
      window is rejected and retried, matching the existing allocation harnesses.
- [x] 1.2 Run the harness under Bun and under Node with the real header shapes (default
      `Content-Type`, plus one non-default header, plus two cookies). Verify: a result file is
      written per runtime and the three shapes are distinguishable in the output.
- [x] 1.3 Record the spike verdict in `design.md` under Decisions: which variant is cheapest, how far
      apart the record variants are, and whether the gap is large enough to be worth an
      implementation. Verify: the verdict names the numbers and, if the answer is "no measurable
      gap", says so plainly.

## 2. Baseline the Bun gate before changing anything

- [x] 2.1 Run `node apps/benchmark/scripts/dev-check/check.mjs inproc --rt bun` three times on a
      pinned CPU and record `inproc.nextrush.us` and `inproc.nextrush.vs_hono` for each. Verify:
      three rows are recorded and their spread is stated.
- [x] 2.2 Confirm the baseline is stable enough to gate on. Verify: if the spread is wider than the
      expected effect, say so in `design.md` and treat the gate as unable to resolve the change —
      do not proceed to implementation on an unresolvable measurement.

## 3. Implement the lazy header record

**Not executed.** The gate closed at 2.2: the Bun effect (~0.007 on the ratio) is roughly six times
smaller than the baseline spread (0.04), and the cheaper-allocation variant measured _slower_ on Bun.
The spec's negative branch applies, so no builder change is made and no RED/GREEN pair is written for
one. The design work these tasks encoded is preserved in design.md D2–D5 for whoever reopens this
with a gate that can resolve it.

## 4. Gate and record the verdict

- [x] 4.2 Run `node apps/benchmark/scripts/dev-check/check.mjs inproc --rt bun` three times on the
      same pinned CPU as 2.1 and compare against the baseline. Verify: the three rows are recorded
      next to the baseline rows and the change is stated as adopted or parked against the rule in
      design.md D6.
      **Parked.** The post-gate full run measured `inproc.nextrush.vs_hono` 1.26 against the 1.18
      baseline median — but with no builder change made, that movement is machine drift, not effect,
      and it is the clearest possible demonstration that the gate cannot resolve an ~0.007 change.
      See design.md D9/D10.
- [x] 4.3 Run the full `dev-check` on Bun and on Node to confirm no other stage regressed. Verify:
      `bundle`, `cold`, `inproc`, `wire`, `probe`, `bookkeeping` and `hygiene` all pass, with the
      `FB-03` exemption unchanged and no new exemption added.
      **Done** — Bun `PASS 24 / KNOWN 1 / FAIL 0`, Node `PASS 20 / KNOWN 3 / FAIL 0`. `FB-03` is
      still the only exemption and it is unchanged.
- [x] 4.4 If the gate rejects the change, revert the builder commit and record the null result
      instead of keeping the code. Verify: `git log` shows the revert, and `design.md` and RFC-039
      both state the measured outcome.
      **Done, with no revert needed** — no builder commit was ever made, because 2.2 closed the gate
      before section 3. `design.md` D9/D10 and RFC-039 §3.10 record the measured outcome.

**Removed from scope, not done:** 4.1 (re-measure the changed tree), 4.5 (record an accepted
outcome) and 5.1 (document the new allocation contract) are adoption-path tasks. The gate rejected
the change, so there is no changed tree, no accepted outcome, and no new contract to document.
Deleting them keeps the tracker honest: it now closes at 9/9 with nothing claimed that did not
happen. They are recoverable from `git log` if the change is ever reopened with a gate that can
resolve it.

## 5. Documentation

- [x] 5.2 Confirm no public API, export, or `.d.ts` changed. Verify: `git diff` touches no
      `index.ts` export surface, and a `pnpm turbo build` of the affected packages succeeds.
      **Done** — the change touches only `apps/benchmark` and `openspec/`; no package source, export
      surface, or `.d.ts` was modified.

## Workflow follow-up

- Archive this change after the gate verdict is recorded, keeping `FB-03` in `knownFailures` (this
  change does not touch compression or the timer).
