# Experiments and profiling log

Record every run, including failed and noisy ones.

## Environment

- Date/time and timezone:
- Commit / branch / dirty state:
- OS / CPU / VM/container limits:
- Runtime + version:
- Framework + dependency versions:
- Benchmark/profiler/tool versions:
- Background load / other caveats:

## Experiment log

| Run ID | Hypothesis | Exact command | Scenario / controls | Result | Repeats / variance | Output path | Interpretation / next step |
|---|---|---|---|---|---|---|---|
| X-001 | | | | | | | |

## Before / after summary

| Metric | Baseline | Candidate | Delta | Noise / confidence | Correctness checks run | Decision |
|---|---:|---:|---:|---|---|---|

## Profiler observations

| Profile artifact | Hot function / stack | Total% / samples | Framework vs runtime vs harness | Hypothesis | Follow-up experiment |
|---|---|---|---|---|---|

## Unsuccessful or invalid experiments

Document crashes, saturated clients, mismatched runtime/workload, profiler distortion, missing tools or non-reproducible runs rather than silently dropping them.
