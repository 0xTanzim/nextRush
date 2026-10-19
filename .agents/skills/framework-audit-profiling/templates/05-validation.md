# Audit validation checklist

## Source and measurement integrity

- [ ] Reviewed repository instructions and existing changes.
- [ ] Relevant source paths/lines directly inspected.
- [ ] No old audit numbers presented as current without rerun.
- [ ] Current framework/runtime versions verified from primary sources where required.
- [ ] Commands, flags, machine/runtime, repetitions and output paths recorded.
- [ ] Benchmark workload equivalence and known mismatches documented.
- [ ] Raw-runtime measurement is labeled as a floor, not a feature-equivalent framework.
- [ ] Negative searches include search scope and exact command/pattern.

## Findings quality

- [ ] Each high-priority finding has reproducible or direct source evidence.
- [ ] Root cause is separated from symptom and hypothesis.
- [ ] Severity and confidence are recorded separately.
- [ ] Recommendation includes trade-offs, alternatives and migration risks.
- [ ] Acceptance criteria can confirm or falsify the proposed fix.
- [ ] Counterexamples/defaults/configuration that might invalidate findings were checked.

## Correctness and implementation (if applicable)

- [ ] Relevant regression test/probe written before fix.
- [ ] Supported runtimes tested (e.g., Bun and Node when relevant).
- [ ] Real-socket/byte-exact probes used for HTTP normalization edge cases.
- [ ] Typecheck, lint and package/broader tests recorded as pass/fail/skip.
- [ ] Benchmarks repeated with same setup after fix.
- [ ] Known-failure tracking and budgets changed only after confirmed verification.

## Final status

- **Audit quality:** pass / pass-with-gaps / blocked
- **Most important unresolved gap:**
- **What was not measured:**
- **What evidence could change the conclusions:**
