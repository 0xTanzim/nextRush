## Why

`docs/audits/03-gap-checklist.md` is the repo's stated "single source of truth for
implementation" and "implementation tracker of record," but it is stale. Its Progress Dashboard
shows 0% complete across every phase (Phase 0: 0/8, Phase 2: 0/6, etc.), yet direct source
verification shows several tasks are already done — most from the just-archived
`harden-runtime-edge-serverless` change (T003, T012 partially, T019, T020 partially, T021, T022,
T038) and one from this session's own work (a scoped slice of T005 for `@nextrush/types`). A
stale tracker is a defect per this repo's own engineering standards ("Outdated documentation is a
bug" — `AGENTS.md` §13), and it actively misleads prioritization: without correcting it, the next
planning pass would re-derive "what's next" from wrong inputs, or re-propose work that is already
done.

This corrects the tracker to match verified reality before any further backlog work is picked up,
and gives every task a `Verified` marker so future re-baselines can distinguish "checked against
source" from "marked done on trust."

## What Changes

- Re-verify every task in Phases 0–5 (T001–T065) against actual repository state — source files,
  CI workflows, published docs, README claims — not against memory or the doc's own prior glyphs.
- Update each task's status glyph (`□`/`◐`/`☑`) to match verified reality, with a one-line
  "Verified:" note citing what was checked (file, grep result, workflow name) so the correction
  itself is auditable, not another unverified claim layered on the last one.
- Recompute the Progress Dashboard, Engineering Metrics (readiness percentages), and Dependency
  Graph's "Blocked until their dep lands" list against the corrected statuses.
- Do **not** re-litigate task scope, priority, or effort estimates — this change corrects
  *status*, not the backlog's content or shape. Any task whose description is now inaccurate
  (e.g. no longer reflects current source) is flagged as a separate follow-up note, not silently
  rewritten here.
- Explicitly call out tasks that are **partially** done (e.g. T012's bundle-size gate exists for
  the edge bundle only, not a general "core" budget as originally scoped; T020's WinterCG
  conformance is implicit in the real-runtime conformance suite but has no explicit allowed-global
  assertion test) rather than forcing a binary done/not-done glyph where reality is mixed.

## Capabilities

### New Capabilities
- `gap-checklist-accuracy`: The requirement that `docs/audits/03-gap-checklist.md`'s task
  statuses, dashboard, and readiness metrics are independently verified against source/CI/docs
  rather than asserted, and that each status carries a citable verification note.

### Modified Capabilities
<!-- None. No existing openspec/specs/ capability's behavioral requirements change - this is a
     documentation-accuracy correction to a tracking artifact, not a code/API change. -->

## Impact

- **Docs (modified):** `docs/audits/03-gap-checklist.md` — status glyphs, Progress Dashboard,
  Engineering Metrics, Dependency Graph annotations.
- **Code:** none. This is a read-only verification pass followed by a documentation update; no
  source, tests, or public API are touched.
- **Follow-up backlog (not implemented here):** any task found to have an inaccurate *description*
  (not just status) is logged as a note in the change's tasks.md for a separate future change —
  this change does not rewrite task scope.
