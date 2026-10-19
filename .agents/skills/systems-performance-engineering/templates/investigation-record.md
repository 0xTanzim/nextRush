# Systems Performance Investigation

## Question
- Symptom/goal:
- Affected operation, runtime, and version:
- Metric and success criterion:

## Workload and environment
- Commit/worktree state:
- Machine/OS/container limits:
- Runtime/tool versions and flags:
- Workload, payloads, route/middleware distribution, concurrency:
- Transport and connection setup:

## Architecture and scope
- Relevant execution path:
- Startup / first-use / per-request / per-response stages:
- Relevant code and tests:

## Observations and hypotheses
| Type | Statement | Evidence/source | Confidence |
|---|---|---|---|
| Observed fact | | | |
| Hypothesis | | | |
| Alternative explanation | | | |

## Cost model
- Operations per request / complexity:
- Allocation and copying:
- CPU/runtime/memory/I/O considerations:
- Expected bottleneck and why:
- Falsifying evidence:

## Baseline
- Exact commands actually run:
- Raw artifact/result locations:
- Runs and variation:
- Throughput and latency percentiles:
- Relevant CPU, memory, GC, syscall or queue metrics:
- Limitations / unknowns:

## Change
- Files and behavior changed:
- Why this removes or reduces measured work:
- Trade-offs and preconditions:
- Fallback/ownership/lifetime rules if applicable:

## Verification and after-measurement
- Correctness tests:
- Cross-runtime conformance:
- Benchmark command and results:
- Before/after effect and noise:
- End-to-end impact:
- Regressions or other guardrails:

## Conclusion
- Cause demonstrated, rejected, or unresolved:
- What the evidence supports:
- What remains unknown:
- Follow-up or rollback criterion:
