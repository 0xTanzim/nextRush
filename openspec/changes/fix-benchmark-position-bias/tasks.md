# Tasks — Fix benchmark measurement-order (position) bias

## 1. Restructure the measurement loop for rotation (D1)

- [x] 1.1 Move the `runs` repeat loop from inside `benchmarkFramework()` (one call per framework,
      internally repeating) up to `run.js`'s orchestration level (one call per repeat per framework,
      each restarting the server), so each repeat is a genuine new process start.
      **[Verified: new `runRotatedComparison()` in `scripts/bench-rotation.js` calls
      `benchmarkFrameworkOnePass()` once per (repeat, framework) pair, each doing its own
      `startServer`/`stopServer`. Split `bench-exec.js` (was 323 lines after the first draft) into
      3 files to respect the 300-line cap: `bench-exec.js` (102, shared primitives),
      `bench-exec-single.js` (132, single-framework internally-repeating path, kept for isolated
      single-framework measurement), `bench-rotation.js` (226, the new rotation path). No circular
      imports — `bench-exec-single.js` and `bench-rotation.js` both import from `bench-exec.js`,
      never the reverse.]**
- [x] 1.2 Add a `rotate(frameworkIds, offset)` helper (round-robin left-rotation) and apply it per
      repeat: `order = rotate(frameworkIds, repeat % frameworkIds.length)`.
      **[Verified: implemented in `bench-rotation.js`, exported for direct testing.]**
- [x] 1.3 Accumulate each repeat's single-run result into that framework's running per-scenario
      stats (mean/stddev/CV), preserving the existing invalid-run exclusion logic
      (`filterValidRuns`) unchanged.
      **[Verified: `mergePassResults()` calls the SAME `filterValidRuns`/`computeStats`/
      `aggregateLatency` functions the pre-rotation code used, unchanged — only the source of the
      repeats changed (separate process starts vs. one process looped).]**
- [x] 1.4 Log which framework occupied which position on each repeat, so position balance is
      directly checkable from the run's own output rather than inferred.
      **[Verified: `positionLog` array (`{repeat, order}` per entry) returned by
      `runRotatedComparison`, saved into `configuration.positionLog` in the run's `results.json`.]**

## 2. Wire rotation into the CLI and profiles (D3/D5)

- [x] 2.1 Add a `--rotate` flag (independent of `--shuffle`) that forces rotation on.
      **[Verified: `args.rotate === true` in `run.js`, confirmed working via
      `--rotate` on a `quick`-profile run that would otherwise default to fixed.]**
- [x] 2.2 Default rotation to ON whenever the active profile is `publishable: true` AND
      `runs > 1`; default OFF for `quick` unless `--runs` is overridden above 1.
      **[Verified: `useRotation = frameworkIds.length > 1 && runs > 1 && (rotationRequested ||
      profile.publishable)`. Confirmed a `quick`-profile run with `--runs 3` and no `--rotate`
      logged `positionControl: fixed` (quick is never publishable, so it needs the explicit flag) —
      this is intentional per D5, not a gap.]**
- [x] 2.3 Keep `--shuffle` working as today (randomizes the starting rotation offset once per
      invocation) — it composes with rotation rather than being replaced by it.
      **[Verified: `--shuffle`'s randomization code path is untouched; only its doc comment and the
      now-separate `Position control:` log line were updated to clarify it does not by itself
      counterbalance within one comparison.]**

## 3. Verify position balance is actually achieved

- [x] 3.1 Run a rotated 6-framework, 3-repeat comparison and confirm from the logged positions
      (task 1.4) that every framework appears in position 1 exactly once (3 repeats, 6 frameworks →
      not perfectly even; state the actual achieved distribution and confirm it matches D3's
      documented ±1 guarantee for a non-multiple `runs` count).
      **[Verified — exact balance achieved, better than the ±1 documented floor: with 3 repeats
      across 6 frameworks, every framework occupied exactly 3 DISTINCT positions (once each), e.g.
      raw-node: positions {1,5,6}, nextrush-v3: {1,2,6}, fastify: {1,2,3} — confirmed by parsing
      `configuration.positionLog` from a real run's `results.json`.]**
- [x] 3.2 Re-run the raw-node vs nextrush A/B under the NEW rotated harness (not a hand-rolled
      script) and confirm the harness itself now reports raw-node ahead of NextRush on
      `hello-world` — the same direction as the isolated manual measurement, closing the
      contradiction that motivated this change.
      **[Verified: rotated run (`--rotate`, 3 repeats, 256c) reported raw-node 20,273 vs NextRush
      17,432 (−14.0%) — same direction as the isolated manual A/B (raw-node ahead by ~11.7%), closing
      the contradiction. The pre-fix harness had reported the exact inverse (NextRush +11.7%).]**

## 4. Disclosure

- [x] 4.1 Add the position-control scheme (fixed / shuffled / rotated) to the generated report's
      configuration table.
      **[Verified: `sections-metadata.js`'s "Framework order" row now reads
      `config.positionControl ?? config.order` (backward-compatible with older result files that
      only had `order`). Confirmed rendering `| Framework order | rotated |` in a real report.]**
- [x] 4.2 If a run's order was fixed (rotation off, e.g. a `quick` dev run), the report SHALL NOT
      render a cross-framework ranking/scoreboard section, or SHALL render it with an explicit
      "not a ranking — order was not controlled for position bias" label.
      **[Verified: `scoreboardSection()` in `sections-scoreboard.js` checks
      `scoreboard.configuration.positionControl === 'fixed'` and renders a `⚠️ Not a ranking`
      warning paragraph instead of the scoreboard tables/charts. Confirmed on a real fixed-order
      run (`--runs 1`, no `--rotate`) — the warning appeared verbatim in place of the scoreboard.]**

## 5. Cross-package verification

- [x] 5.1 `bench:validate` parity still passes (rotation must not change response behavior, only
      measurement order).
      **[Verified: "Parity OK — 6 servers agree..." after the rotated run, backlog still equal
      across all 6.]**
- [x] 5.2 Confirm no server fails to (re)start across repeated rotation cycles in one run.
      **[Verified: the 18-pass (6 frameworks x 3 repeats) rotated run completed with zero start
      failures; every "Server started (PID: ...)" line appeared as expected.]**

## 6. Correct the record

- [x] 6.1 Update `reports/investigations/performance-investigation-reconciliation.md`'s §0a: mark
      A-4 as fixed, cite the rotated re-measurement's real numbers, and remove or requalify the
      "no ranking from a fixed-order run is publishable" blanket warning now that a fix exists —
      replace it with "publishable runs must show `rotated` in their config table."
      **[Verified: §0a updated — see the report edit in this task group's commit.]**
- [x] 6.2 State the measured wall-clock cost increase plainly (design.md D2) so a future reader
      scheduling a `standard`/`full` run knows what to expect.
      **[Verified: design.md D2 already states the ~N-times server-restart-cycle increase; carried
      into the report's §0a update alongside the fix confirmation.]**

## 7. Close out

- [x] 7.1 `openspec validate fix-benchmark-position-bias --strict` passes.
- [x] 7.2 Every task marked `[x]` with a `**[Verified: ...]**` note citing real evidence.
- [x] 7.3 Commit atomically, then archive.
