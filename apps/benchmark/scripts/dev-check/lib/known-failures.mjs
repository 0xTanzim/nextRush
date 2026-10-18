// Bookkeeping helpers for the request-cost gate's known-failure exemptions.
//
// A known-failure id exists to keep the gate honest about defects that are real
// but not yet fixed: the probe still runs, still reports what it observed, and
// its failure does not turn the build red. Two ways that mechanism can rot:
//
//   1. An id with no probe behind it — the exemption outlives the probe that
//      justified it, so nothing will ever turn red for it again.
//   2. An id whose probes all pass — the defect is fixed but the exemption was
//      never removed, so the probe silently stopped guarding anything.
//
// The second is the important one: it is what turns "fixed" into "permanently
// exempt", and it is checked per runtime because a platform that normalises the
// request target before the application sees it cannot exhibit a
// target-normalisation defect at all (the id's own spec says which runtimes it
// applies to). Extracted from `check.mjs` to keep that file inside its
// source-size ceiling.

/**
 * Whether `spec` (one entry of `budgets.json`'s `knownFailures`) covers `runtime`.
 *
 * @param spec - `'*'` for every runtime, or an array of runtime names.
 * @param runtime - The runtime the gate is currently running on.
 */
export function coversRuntime(spec, runtime) {
  if (spec === '*' || spec === true) return true;
  return Array.isArray(spec) && spec.includes(runtime);
}

/** Every id declared in `knownFailures`. */
export function declaredIds(knownFailures) {
  return Object.keys(knownFailures ?? {});
}

/**
 * Ids in `knownFailures` that no registered probe references — a permanent
 * exemption with nothing behind it.
 *
 * Scans the WHOLE registry, not the runtime-filtered subset: an id that is
 * legitimately runtime-scoped is still backed by a probe, it is merely not
 * evaluated on this runtime.
 *
 * @param probes - Registry entries, each `{ id, bug }`.
 * @param knownFailures - Parsed `budgets.json` `knownFailures` map.
 */
export function findOrphanIds(probes, knownFailures) {
  const referenced = new Set(probes.map((p) => p.bug).filter((bug) => bug && bug !== '-'));
  return declaredIds(knownFailures).filter((id) => !referenced.has(id));
}

/**
 * Ids that this runtime applies to but that no probe failed for — the defect is
 * gone (or never existed here) and the exemption should be deleted in the same
 * change that fixed it.
 *
 * @param probes - Registry entries, each `{ id, bug }`.
 * @param knownFailures - Parsed `budgets.json` `knownFailures` map.
 * @param runtime - The runtime the gate is currently running on.
 * @param failingBugs - Bug ids of probes that reported a failure in this run.
 */
export function findStaleExemptions(probes, knownFailures, runtime, failingBugs) {
  const failing = new Set(failingBugs);
  return declaredIds(knownFailures).filter((id) => {
    if (!coversRuntime(knownFailures[id], runtime)) return false;
    return !probes.some((p) => p.bug === id && failing.has(p.bug));
  });
}
