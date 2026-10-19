# Finding schema and evidence rubric

## Evidence labels

- `OBSERVED`: directly reproduced by a command/test/profile on a recorded revision and environment.
- `SOURCE`: confirmed in implementation, tests, config, or project documentation. Cite path and line/anchor.
- `EXTERNAL`: from a named external source. Record URL, publication/version date and access date.
- `HYPOTHESIS`: inferred explanation that still needs a disconfirming test or measurement.

A single finding may have multiple labels. Never present a hypothesis as observed fact.

## Finding template

```markdown
### [F-XX] Concise finding title

- **Severity:** P0 | P1 | P2 | P3
- **Confidence:** high | medium | low
- **Status:** open | confirmed | needs-reproduction | fixed-unverified | verified | rejected
- **Evidence class:** OBSERVED / SOURCE / EXTERNAL / HYPOTHESIS
- **Scope:** which runtime, entrypoint, scenario, feature, or users are affected

**Claim**
What is happening, stated narrowly.

**Evidence**
- `path/to/file.ts:123-145` — what the lines show.
- `command ...` — observed result and artifact path, including revision/runtime.
- External URL (version/date) — only for external behavior/architecture claims.

**Reproduction**
Exact steps or command and expected/actual outcome.

**Impact**
Practical user/system effect and conditions where it applies.

**Root cause vs symptom**
What is known and what remains inferred.

**Recommendation**
Smallest justifiable change, alternative(s), expected gain, trade-offs and migration risk.

**Validation / acceptance criteria**
Tests, probes and measurements that must pass; numerical thresholds only when justified.

**Open questions**
Missing evidence or conditions that could reverse this conclusion.
```

## Severity guide

- `P0`: release-blocking correctness/security/reliability issue or severe widely observed regression.
- `P1`: major impact on a core path or target use case, with strong evidence and a practical remediation.
- `P2`: bounded but meaningful performance, maintenance, DX, or correctness issue.
- `P3`: low-impact cleanup/optimization or speculative improvement.

Severity is consequence; confidence is evidence quality. A serious-but-unverified concern can have high potential severity and low confidence, but must be marked `needs-reproduction` rather than reported as a confirmed defect.

## Anti-patterns to reject in review

- Benchmark numbers without runtime/version, machine, command or repeat count.
- “It must be slower because there is an abstraction” without measurement or source explanation.
- An audit finding copied from an old AI-generated report without revalidation.
- A file/line citation that does not support the actual claim.
- An architecture prescription with no trade-offs, falsification check or acceptance test.
- Treating passing unit tests as proof of real HTTP behavior or cross-runtime parity.
- Treating competitor code as inherently superior without validating the relevant constraints.
