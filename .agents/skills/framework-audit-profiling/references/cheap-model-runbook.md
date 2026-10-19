# Cheap-model runbook for reliable audits

This is the execution policy for models with lower cost or weaker long-context/reasoning performance. It aims to make their work more reliable through externalized state and tool-grounded checks, not to claim model parity with a stronger model.

## Cost tiers

### Tier 0 — Deterministic check first

Use when a repository already has a script, test, typecheck, benchmark, profiler summarizer, code index, or CI budget that answers the question.

- Inspect the command and safety implications.
- Run the narrowest appropriate check.
- Save command, exit code, versions and output path.
- Interpret only the observed result; do not fill missing values from memory.

### Tier 1 — Cheap model + targeted source inspection

Use for normal architecture/performance triage.

- Search exact symbols/terms and read only relevant ranges.
- Record file and line references immediately in `.audit/01-evidence.md`.
- Form at most a few high-value hypotheses at a time.
- For each hypothesis, state what observation would disprove it.
- Run a test/profile or inspect the implementation before deciding.

### Tier 2 — Focused external research

Use when the question depends on current runtime/framework releases or competitor architecture.

- Search official docs/release notes/repositories first.
- Verify a claim against the exact version under comparison.
- Store source URL + publication/version date + access date in `.audit/03-comparison.md`.
- Do not browse widely for information a local command can establish faster.

### Tier 3 — Stronger review or specialist escalation

Escalate only when one or more is true:

- A potential P0/P1 finding lacks decisive evidence.
- Two credible sources or measurements conflict.
- The fix involves a major architecture rewrite, compatibility contract, or security boundary.
- The result depends on complex language/runtime behavior not settled by a targeted experiment.
- The evidence-backed options have material trade-offs that cannot be resolved with a small experiment.

Give the reviewer a compact evidence packet: question, repo revision, relevant source excerpts, commands and raw results, competing hypotheses, and exact decision needed. Do not ask it to redo the entire audit from scratch.

## Stage-gated algorithm

1. **Orient:** inspect project instructions, git state, key scripts, relevant RFC/audit and code-index freshness.
2. **Plan:** add concrete claims/questions to `.audit/00-plan.md`.
3. **Map:** identify the minimum request path and test/benchmark files that can answer them.
4. **Measure:** run the shortest valid existing command before creating new infrastructure.
5. **Explain:** tie result to source. If profiler says a function is hot, inspect it; if code appears expensive, measure it.
6. **Challenge:** try one disconfirming check for each important finding.
7. **Write:** store finding and supporting evidence immediately so session truncation does not lose facts.
8. **Critique:** run the finding checklist against evidence, severity, alternatives, fairness and acceptance criteria.
9. **Escalate:** only unresolved high-impact questions go to a stronger model.
10. **Close:** verify `.audit/` completeness, list exact tests run, disclose unmeasured areas.

## Context budget rules

- Do not paste complete giant reports into the prompt. Search headings and claim keywords, then read a focused range.
- Do not repeatedly summarize the same source. Store a durable, compact observation with a pointer to the original.
- Use shell output and files for large profiles/logs; send the model the relevant top rows plus artifact path.
- Do not make the same tool call twice unless the input, environment or question changed, or the first call failed.
- Avoid parallel calls when one result informs the next command; parallelize only independent checks.
- Keep `.audit/00-plan.md` as the source of truth for scope and `.audit/01-evidence.md` for facts, so context compaction does not reset the investigation.
- End each stage with a short status in the artifacts: confirmed, rejected, or unresolved, and the next decisive check.

## Model task prompt template

Use this when launching a cheaper model that does not automatically discover the skill:

> Follow the `framework-audit-profiling` skill. Use the repository's existing measurement and test tools first. Work read-only except for `.audit/` and temporary outputs. Do not estimate or reuse stale performance numbers. Separate observed measurements, source facts, external claims, and hypotheses. For each high-impact claim, provide the exact source location or command/output and a check that could disprove it. Compare frameworks only under stated equivalent workloads and runtimes. Update `.audit/` as you go, run the audit validator at the end, and clearly list what was not measured. Escalate only if high-impact uncertainty remains; do not claim the skill makes this model equivalent to a stronger one.
