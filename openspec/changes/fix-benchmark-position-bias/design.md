# Design — Fix benchmark measurement-order (position) bias

## Context

`benchmarkFramework()` in `scripts/bench-exec.js` starts ONE server process per framework, and that
single process serves every scenario × every concurrency level × every `runs` repeat before
stopping. `run.js`'s outer loop is `for (frameworkId of frameworkIds) { benchmarkFramework(...) }` —
so "position" is coarse: it means "which framework's dedicated process happened to start 1st, 2nd,
… in this invocation," not something the existing per-scenario `runs` repeat loop touches, because
that loop repeats the SAME already-running process, never restarts it.

This matters for the fix: `runs` repeats cannot rotate framework order by themselves, because they
never re-trigger the position effect (a repeat is not a new process start). Rotating order requires
restarting each framework's server process once per rotation slot, not once per invocation.

## Decisions

### D1 — Restructure to one server restart per (repeat × framework), not once per framework

The loop nesting inverts: instead of

```
for framework in frameworkIds:
    start framework once
    for scenario, connections, run in (all work): measure
    stop framework
```

it becomes

```
for repeat in 0..runs:
    order = rotate(frameworkIds, repeat)
    for framework in order:
        start framework                      # NEW: restarts every repeat
        for scenario, connections: measure ONE run
        stop framework
    accumulate this repeat's single-run result into that framework's running stats
```

Every framework now restarts `runs` times instead of once, and rotation ensures that across the
full set of repeats, every framework occupies the first-measured slot (and every other slot) an
equal (±1) number of times. The position effect then lands equally on every framework's mean instead
of concentrating on whichever framework the old code always started first.

### D2 — This materially increases wall-clock runtime; the tradeoff is stated, not hidden

Total measured work stays the same (same scenario × concurrency × run count), but it is now
chunked into `runs × frameworkIds.length` server start/stop/warmup cycles instead of
`frameworkIds.length`. Each framework's own `warmupDuration` and each scenario's own
`scenarioWarmupDuration` now recur every repeat rather than once — this is the real cost of
counterbalancing, not incidental waste, because skipping re-warmup on a fresh process would
reintroduce a JIT-cold measurement into the very thing being fixed.

Concretely, for the `standard` profile (3 runs) with 6 frameworks: roughly 3× more server
start/stop/warmup cycles than before. For a 13-scenario, 4-concurrency full sweep this is a genuine
multi-hour-to-several-hours increase, not a rounding error. This is disclosed in the report's
configuration section (rotation scheme + a note that wall-clock time increased) rather than
absorbed silently.

**This tradeoff was flagged to the user before implementation** rather than assumed: a slower,
trustworthy comparison is preferred over a fast, order-biased one, since the entire point of this
change is that the current fast version produces results that invert under a direct A/B.

### D3 — Rotation, not full randomization, for reproducibility

A round-robin rotation (`rotate(frameworkIds, repeat) = frameworkIds` rotated left by `repeat mod
frameworkIds.length`) is chosen over re-shuffling randomly every repeat, because rotation
guarantees exact position balance for `runs` a multiple of `frameworkIds.length`, and near-exact
balance otherwise — a property random reshuffling does not guarantee over a small `runs` count (3
random shuffles of 6 items can, and did in exploratory testing, leave one framework in position 1
twice). Rotation is also deterministic given a starting order, which keeps a run reproducible for
debugging without needing to record a random seed.

### D4 — `--shuffle` is retained but documented as insufficient alone

`--shuffle`'s one-time randomization still has a legitimate use: varying the *starting* rotation
offset across separate invocations, so a systematic bias tied to a specific absolute position (not
just relative position) doesn't recur identically every time the suite runs. It is not, by itself, a
substitute for per-repeat rotation within one invocation.

### D5 — Rotation becomes the default for any `publishable: true` profile

`standard` and `full` profiles are marked `publishable: true` in `config/profiles.js`. Given D1-D3,
rotation is enabled by default whenever `runs > 1` under a publishable profile, rather than requiring
an opt-in flag that could be forgotten before a number is quoted externally. `quick` stays
unrotated by default (single run makes rotation meaningless) but MAY be rotated if `--runs` is
overridden above 1 for a dev-scale sanity check.

## Risks / Trade-offs

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Wall-clock runtime increases materially | Expected, not a defect | Disclosed in proposal.md and the report; user was informed before implementation |
| Rotation itself could introduce a NEW bias if `runs` is small and not a multiple of framework count | Low | D3's rotation guarantees ±1 balance even then; documented, not silently accepted as exact |
| More server start/stop cycles could surface a flakier start-up path | Low | Existing `waitForServer` readiness check already handles this per start; no new mechanism needed |
| A user quotes a `quick`-profile (unrotated) number as a ranking | Medium | `quick`'s own `publishable: false` label already exists; the report's disclosure (D5) makes the rotation scheme visible so this is checkable |

## Rollback Plan

Blast radius: reversibility `trivial` (0) — harness-only, no persisted state; scope `single_module`
(1); detectability `immediate_test_failure` (0) — a broken rotation would show as a crash or as
positions not actually balancing (checkable directly). **Total: 1 → auto-apply.**

### Triggers

1. Any framework's server fails to (re)start on a rotation cycle.
2. Position balance is not achieved across a full `runs` set (verifiable by logging which framework
   occupied which position per repeat and checking the counts).
3. `bench:validate` parity fails.
4. Wall-clock cost is judged unacceptable after seeing the real multi-hour number — in which case
   D5's default-on behavior is reverted to opt-in (`--rotate`) rather than the mechanism itself being
   discarded, since the underlying fix is still correct, only its default posture changes.

### Procedure

```bash
git revert --no-edit <sha>
cd apps/benchmark && node scripts/validate-parity.js
```

No rebuild required — harness runs from source.

## Migration

None. Any number published from a prior fixed-order run is provisional until re-measured with
rotation; no code migration for consumers.
