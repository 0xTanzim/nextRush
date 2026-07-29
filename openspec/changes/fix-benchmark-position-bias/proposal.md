# Fix benchmark measurement-order (position) bias — A-4

## Why

`equalize-benchmark-server-config` found that `apps/benchmark`'s comparison mode measures
frameworks in one fixed order (raw-node always first) within a single invocation, and demonstrated
directly that the FIRST server measured in an invocation scores materially lower than the same
server measured in a later position — regardless of which framework occupies which slot.

Three isolated, interleaved, pinned A/B tests confirm this is a genuine position effect, not
attributable to any one framework:

| Test | 1st position | 2nd position | Effect |
| --- | --- | --- | --- |
| raw-node vs nextrush | raw-node: 25,975 / 26,148 / 25,543 (mean 25,888) | nextrush: 23,214 / 23,020 / 23,276 (mean 23,170) | 1st loses to 2nd by 11.7% |
| nextrush vs raw-node (reversed) | nextrush: 22,221 / 18,222 / 16,912 (declining) | raw-node: 19,795 / 20,704 / 23,844 (climbing) | reversing which framework is 1st reverses which one "wins" |
| koa vs raw-node | koa: 17,424 (its normal baseline) | raw-node: 25,606 (its normal dominant score) | when raw-node is 2nd, it scores normally — no artificial suppression of the framework that follows |

The pinned comparison run that motivated this change reported NextRush beating raw-node by 11.7% on
`hello-world`. Given the above, that result is fully explained by NextRush occupying the 2nd
measurement slot and raw-node the 1st — not by any framework property. **No cross-framework
ranking produced by the harness in its current form is publishable**, in either direction.

An existing `--shuffle` flag randomizes framework order once per invocation, but that does not
cancel the effect within one reported comparison — it only relocates which framework absorbs the
1st-position penalty, invisibly, from run to run. A single comparison still has exactly one
framework in the disadvantaged slot every time it runs.

## What Changes

- Add a **counterbalanced rotation** mode to `scripts/run.js`: across the `runs` repeats already
  requested for a comparison, rotate which framework occupies each measurement position so that,
  summed across the full set of repeats, every framework spends an equal (or as-equal-as-integer-
  division allows) number of runs in every position. The position effect then contributes equally
  to every framework's mean rather than being concentrated on whichever framework happens to be
  first.
- This becomes the **required** mode for any run whose result is reported as a cross-framework
  ranking (`publishable: true` profiles). `--shuffle`'s one-shot randomization remains available for
  quick/dev use but is documented as insufficient for a publishable comparison.
- The generated report discloses the rotation scheme actually used (fixed / shuffled / rotated) so
  a reader can tell whether position bias was controlled for.
- Any previously-published ranking from a fixed-order run — including this session's own — is
  retroactively marked unpublishable in `reports/investigations/performance-investigation-
  reconciliation.md`.

## Non-Goals

- **Not** investigating or eliminating the underlying cause of the position effect itself (CPU
  frequency scaling, kernel/filesystem cache warming, or some other system dynamic). Rotation cancels
  its effect on the reported comparison regardless of cause; root-causing the OS/hardware behavior is
  a separate, lower-priority investigation and is not required to make the harness trustworthy.
- **Not** changing the per-framework internal warmup (`warmupDuration`/`scenarioWarmupDuration`),
  which already exists and addresses JIT warmup, a different concern from process-position warmup.
- **Not** removing `--shuffle`. It stays as a fast, no-restructuring option for exploratory/dev runs
  that do not claim to be a publishable ranking.

## Impact

- `apps/benchmark/scripts/run.js`, `scripts/bench-exec.js` (or wherever the per-framework
  measurement loop needs restructuring to support rotation), the report generator, and
  `reports/investigations/performance-investigation-reconciliation.md`.
- No framework package changes.
- Any number published from a prior fixed-order run must be treated as provisional until
  re-measured with rotation.
