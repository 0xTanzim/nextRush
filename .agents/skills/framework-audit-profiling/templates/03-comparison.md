# Framework / runtime comparison

## Comparison question and fairness constraints

- Question:
- Same machine/environment:
- Runtime/version per framework:
- Framework/version per entry:
- Workload equivalence:
- Known mismatches:

## Architecture and behavior matrix

| Axis | Target framework | Competitor A | Competitor B | Raw-runtime floor | Evidence/source | Confidence/caveats |
|---|---|---|---|---|---|---|
| Request path | | | | | | |
| Router + middleware | | | | | | |
| Cold start / route registration | | | | | | |
| RSS / heap / allocations | | | | | | |
| Bundle / entrypoints | | | | | | |
| Compile strategy / edge constraints | | | | | | |
| Adapters / runtime portability | | | | | | |
| Correctness / security | | | | | | |
| Public API / DX / maintenance | | | | | | |

## Measurements

| Metric | Scenario | Framework/runtime | Runs | Median / spread | Tool/version | Artifact | Comparable? |
|---|---|---|---:|---|---|---|---|

## Primary external sources

| Claim | Official URL | Published/version date | Access date | Locally reproduced? | Caveats |
|---|---|---|---|---|---|

## Interpretation

Separate facts, measurements, inferences and hypotheses. Explain where comparisons are not apples-to-apples. Do not promote a competitor's architecture without validating fit to project goals.
