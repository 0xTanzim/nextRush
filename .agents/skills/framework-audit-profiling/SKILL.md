---
name: framework-audit-profiling
description: >-
  Investigate framework bottlenecks, architectural limitations, correctness bugs, performance regressions,
  and framework/runtime comparisons. Use when profiling or auditing a codebase, validating an architecture
  audit or RFC, comparing a framework with Hono, Elysia, Fastify, or raw-runtime baselines, and recording
  reproducible evidence and tests in a .audit/ workspace.
compatibility: Requires repository file access and shell execution. Python 3 is used only by the optional audit-artifact validator. Internet access is useful for current external-framework and runtime comparisons.
metadata:
  author: local
  version: "1.0.0"
---

# Framework Audit and Profiling

## Mission

Produce an evidence-backed answer to: **what is actually wrong or expensive, how do we know, what should change, and how will we prove the change helped without breaking behavior?**

Do not imitate a model's reputation or claim to think like a stronger model. Follow a reproducible method: inspect source, form falsifiable hypotheses, run available checks, compare equivalent workloads, preserve evidence, and challenge conclusions before reporting them.

## When to use

Use this skill for any of these tasks:

- Find performance bottlenecks, runtime overhead, memory growth, startup costs, bundle bloat, or throughput limits.
- Compare a framework with other frameworks and a raw-runtime floor.
- Audit architecture, adapters, routing, middleware, resource budgets, package boundaries, or public APIs.
- Validate an existing audit, RFC, performance claim, or proposed redesign.
- Reproduce bugs, inspect cross-runtime behavior, add probes, or verify a performance change.
- Produce a persistent `.audit/` evidence trail rather than a one-off chat answer.

## Hard rules

1. **Inspect before asserting.** Read the repository's `AGENTS.md`, contributor instructions, package scripts, current git status/diff, existing RFCs/audits, and existing benchmark/test tooling before proposing new infrastructure.
2. **Evidence beats intuition.** Run repository commands when available. Never invent timings, test results, profiler output, file paths, versions, or code facts.
3. **Separate four evidence classes:** `OBSERVED` (directly reproduced/measured), `SOURCE` (confirmed in code/docs), `EXTERNAL` (supported by a dated primary source), and `HYPOTHESIS` (plausible but unverified). Make this distinction visible in `.audit/` and in the final report.
4. **No stale numbers.** Existing reports are leads, not current measurements. Re-run relevant commands and record revision, runtime, machine, flags, repetitions, and date before making current claims.
5. **Keep comparisons fair.** Same host, runtime/version, concurrency, route/handler behavior, payload, middleware, headers, warm-up policy, duration, and tool version. State every mismatch. A raw server is a lower-bound reference, not a feature-equivalent framework competitor.
6. **Repeated runs for noisy metrics.** Use medians or the repository's established aggregation. Do not declare a win from one run; if a change is within about 5% or measurement variance, repeat and call it inconclusive when the signal remains weak. Follow any stricter repo policy.
7. **Correctness is a gate, not a footnote.** Pair performance changes with behavior probes and relevant tests on every supported runtime. Prefer real sockets / byte-exact request targets for HTTP edge cases; ordinary `fetch`/`curl` can normalize malformed or unusual paths.
8. **No architecture rewrite from a single benchmark.** Tie proposed changes to evidence, explain trade-offs, and preserve a fallback/migration path where feasible.
9. **Read-only by default.** Create/update `.audit/` artifacts and temporary benchmark outputs only. Do not modify application code, budgets, lockfiles, dependencies, CI gates, or known-failure registries unless explicitly asked to implement a fix. Never silently delete a known failure or loosen a budget to turn red green.
10. **Do not execute untrusted project scripts blindly.** Inspect commands and their effects first, especially install/postinstall, deploy, cleanup, and scripts that access secrets or external services.
11. **Current ecosystem claims require current sources.** For “latest” versions or architectural changes, verify official release notes/docs/repositories and capture version + publication/access date. Prefer primary sources and clearly label prereleases.
12. **Report limits honestly.** Say what was not run, what access was unavailable, which evidence is inferred, and what remains uncertain.

## Operating procedure

### Phase 0 — Establish task and workspace

1. Decide which tracks apply: `architecture`, `performance`, `correctness`, `framework-comparison`, `audit-validation`, or a combination.
2. Confirm repository root and inspect:
   - `git status --short --branch` and `git diff --stat` (do not overwrite or clean the user's work).
   - `AGENTS.md`, README, package manager/workspace files, scripts, CI configuration, and relevant test instructions.
   - Existing RFCs, ADRs, issue briefs, benchmark harnesses, CI budgets, profiling outputs, and prior `.audit/` content.
3. If no `.audit/` workspace exists, run this skill's scaffold script:

   ```bash
   bash /path/to/framework-audit-profiling/scripts/init-audit.sh --root "$PWD"
   ```

   Find the actual installed skill path first. The script does not overwrite existing files unless `--force` is explicitly passed. If the repo's conventions require another location or an existing audit structure, adapt rather than duplicate it.
4. Fill `.audit/00-plan.md` with scope, questions, constraints, relevant commit/branch, requested output, and non-goals. Do not start with an unconstrained whole-repo reading dump.

### Phase 1 — Build a compact map

Inspect the smallest useful set of files first:

- project/package graph and public entrypoints;
- request lifecycle: adapter → context → router → middleware/handler → response;
- runtime capability boundaries and duplicated implementations;
- existing tests, conformance suites, benchmark entries, CI workflows, and budgets;
- the exact RFC/audit findings under review.

Use targeted search (`rg`, symbol search, code index/MCP if available) and expand only into the relevant source ranges. Record file paths and line numbers/anchors in `.audit/01-evidence.md`. If a repository/code-graph index is used, record its timestamp/status and check whether the relevant files were indexed. Treat partial indexes as incomplete evidence.

### Phase 2 — Convert claims into testable questions

For each claim, record:

- Claim and expected user/system impact.
- Evidence currently supporting it and evidence against it.
- A falsifiable hypothesis.
- Cheapest reliable check that could disprove it.
- Command/test/profile and expected interpretation.

Prioritize checks that cover more traffic or higher consequence. Examples: fixed per-request overhead before rare schema optimizations; build/cold-start and bundle metrics for serverless claims; behavior parity before speed comparisons.

### Phase 3 — Reproduce and measure

1. Discover project-specific commands before inventing custom scripts. Use an existing short feedback loop first; reserve multi-hour benchmark suites for release-quality confirmation.
2. Record the environment before numbers: commit, clean/dirty tree, OS/CPU/container constraints, runtime and version, dependency versions, test command/flags, warm-up, duration, repetitions, and any background load.
3. Start with the narrowest test that answers the question. Run a baseline and then a changed version with the same command/environment. Keep raw outputs/profiler files or exact output paths in `.audit/04-experiments.md`.
4. For performance questions, choose the correct measurement layer:
   - **in-process** for framework per-request overhead without network costs;
   - **wire/load** for real HTTP throughput and latency under concurrency;
   - **cold start** for process start to first response and route-registration scaling;
   - **bundle** for the actual entry's dependency footprint;
   - **RSS/heap/allocation** for memory and allocation pressure;
   - **CPU profile** to attribute time to functions;
   - **behavior probe** for correctness/parity, not performance.
5. Use raw runtime as a floor only where semantics and client setup are comparable. If the load generator is saturated, the ratio is invalid. Do not conflate throughput, latency, CPU cost, startup, memory, and bundle size.
6. If one result contradicts expectations, repeat before explaining it. Do not retrofit a story to fit noisy data.

For the NextRush-specific quick workflow and known pitfalls, read `references/nextrush-workflow.md` only when the detected repo actually contains the relevant script paths. Do not assume the uploaded baseline remains current.

### Phase 4 — Compare architectures without cargo culting

When comparing NextRush with Hono, Elysia, Fastify, Bun/Node primitives, or another framework:

1. Verify exact framework/runtime versions and stable-vs-prerelease status from primary sources.
2. Compare equivalent implementation and semantics. Use multiple categories rather than a single RPS ranking:
   - request path and fixed per-request work;
   - routing/matching and middleware dispatch;
   - response creation, header/context/body handling;
   - cold start and route-registration scaling;
   - peak/resident memory, allocations, and memory after load;
   - bundle size, entrypoints, tree shaking, optional dependencies;
   - compile strategy: runtime/JIT/registration-time/build-time AOT and CSP/edge constraints;
   - adapter abstraction, runtime portability, duplicated code, conformance drift;
   - correctness/security guarantees, public API, plugins/extensions, DX and maintenance burden.
3. Separate **architecture facts** (“the adapter duplicates this runner”), **measured behavior** (“profile shows this function takes X% under this scenario”), and **design inference** (“unifying the runner may reduce drift”). Do not use one as proof of another.
4. Explain why a design exists, what it buys, its cost, and alternatives. Do not assume copying a competitor's AOT/compiler/model is automatically best; account for NextRush's zero-config/runtime-portable goals and CSP/edge restrictions.
5. Treat documentation and marketing numbers as test hypotheses. Benchmarks from different machines, runtimes, route behavior, schemas, or measurement tools are not a controlled head-to-head.
6. Put claims in `.audit/03-comparison.md` with a source URL, version/date, method, apples-to-apples caveat, and whether independently reproduced.

### Phase 5 — Write findings that can be acted on

Every finding in `.audit/02-findings.md` must include:

- ID and concise title.
- Severity (`P0`–`P3`) and confidence (`high`/`medium`/`low`).
- Evidence class(es), source path/line or command/output location.
- Reproduction steps and observed result; include a counterexample or disconfirmation check when practical.
- Impact: who/what is affected and under which conditions.
- Root cause vs symptom (do not confuse them).
- Recommendation, alternative(s), expected benefit, trade-offs, migration risk, and estimated effort.
- Validation plan: test/probe/metric and acceptance threshold.
- Status: `open`, `confirmed`, `needs-reproduction`, `fixed-unverified`, `verified`, or `rejected`.

Use priority consistently:

- `P0`: release-blocking correctness/security/reliability issue or severe broadly observed regression.
- `P1`: major impact on a core path, system constraint, or high-value target; strong evidence and a practical mitigation.
- `P2`: meaningful but bounded performance, maintainability, DX, or correctness issue.
- `P3`: low-impact optimization, cleanup, or speculative improvement.

Do not label a hypothesis P0 merely because it sounds architectural. Mark it `needs-reproduction` until evidence supports it. State impact and scope, not just severity labels.

### Phase 6 — Validate the audit itself

Challenge every high-impact finding with these questions:

- Did we inspect the implementation, or only another AI's report?
- Did the command actually run on the stated revision/runtime?
- Can the reported result be reproduced from the saved command and artifact?
- Is this the cause, a symptom, or just correlated code?
- Are there counterexamples, framework defaults, or configuration options that change the result?
- Is the competitor comparison fair and the source current?
- Do tests cover raw HTTP behavior, supported runtimes, and the failure mode?
- Does the proposed fix improve one metric while worsening startup, memory, bundle size, security, portability, or DX?
- Are unmeasured assumptions and unresolved questions explicit?

Use the strongest available reviewer pass for findings with severe impact, low confidence, or conflicting evidence. The independent pass should try to falsify the finding, not merely paraphrase it. Escalate to a stronger model only for unresolved ambiguity or high-stakes trade-offs; tool output and structured evidence should do the routine work.

### Phase 7 — Test and close the loop

If asked to fix something:

1. Reproduce the failure on the current base.
2. Write a failing regression test/probe before the fix (TDD), unless the repository's established process requires otherwise.
3. Make the smallest justified change; do not bundle unrelated cleanups.
4. Run targeted tests, cross-runtime probes, typecheck/lint and relevant broader tests.
5. Rerun the same baseline measurements and compare repeated runs.
6. Update the finding status only after verification. Do not remove known-failure tracking or change budgets until the fix and its acceptance checks are confirmed.

If not asked to implement, stop after evidence-backed findings and an ordered remediation plan.

### Phase 8 — Complete and validate `.audit/`

Maintain the scaffold files and write final conclusions in `.audit/final-report.md`. The final report must say:

- Executive summary (highest-confidence/highest-impact findings first).
- Tested commit and environment.
- Top findings with paths/lines and reproducible evidence.
- Comparative measurements and method caveats.
- Fix order with dependencies and acceptance criteria.
- Tests/probes actually run and pass/fail/skip state.
- What was not measured, inaccessible sources, and remaining uncertainty.
- Links/paths to raw outputs and sources.

Run:

```bash
python3 /path/to/framework-audit-profiling/scripts/validate-audit.py --root "$PWD"
```

Read any warnings; a structurally valid artifact is not proof that the technical conclusions are true. The validator checks completeness of the record, not correctness of benchmark methods.

## Low-cost model operating strategy

- Keep the task and acceptance criteria in `.audit/00-plan.md`; keep large output in files instead of repeatedly pasting it into context.
- Prefer short, deterministic commands and narrow source reads. Search before opening huge files; summarize only relevant ranges.
- Have the model choose a measurement, execute it, inspect the output, then decide the next step. Do not ask it to forecast benchmark numbers.
- Reuse the repository's runner, thresholds, probes and profiler summaries instead of writing parallel tools.
- Use progressive disclosure: load `references/nextrush-workflow.md` for NextRush command details, `references/comparison-method.md` for competitor research, and `references/finding-schema.md` for artifact standards only when relevant.
- Use two passes: (1) evidence collector proposes findings; (2) critic checks each against the rubric and tries to falsify it. Do not count two passes from the same model as truly independent evidence.
- Reserve expensive models for ambiguous source interpretation, conflicting results, high-impact redesign choices, or a final review—not routine command execution.
- A skill improves process reliability; it cannot make a smaller model equal to a stronger model. Expect it to reduce avoidable misses, stale assumptions, and ungrounded claims, not remove reasoning limits.

## References

- NextRush workflow and known measurement pitfalls: `references/nextrush-workflow.md`
- Controlled comparison method: `references/comparison-method.md`
- Finding quality rubric and evidence taxonomy: `references/finding-schema.md`
- Cost tiers and low-cost execution runbook: `references/cheap-model-runbook.md`
- Generated audit workspace formats: `templates/`
