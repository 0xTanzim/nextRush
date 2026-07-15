## Context

`docs/audits/03-gap-checklist.md` was authored before `harden-runtime-edge-serverless` was
implemented and archived. Its glyphs and dashboard were never updated after that change closed
78/78 tasks, several of which directly correspond to gap-checklist items (T003, T012, T019, T020,
T021, T022, T038). Separately, this session added a scoped slice of T005 (a public-surface lock
test for `@nextrush/types`). The checklist currently claims 0% completion across every phase,
which is now demonstrably false for at least 6 tasks and needs correction before it's used to
plan the next chunk of work.

This is a verification-then-correction pass, not a re-plan. The checklist's task list, priorities,
and effort estimates are assumed correct from the original audits unless a task's own description
is now factually wrong about current source state (in which case that's flagged, not silently
rewritten — scope creep into "also fix the backlog's content" is explicitly out of bounds per the
proposal).

## Goals / Non-Goals

**Goals:**
- Every task in Phases 0–5 gets checked against real source/CI/docs evidence, not memory or trust.
- Every status change carries a one-line, citable "Verified:" note (file path, grep result,
  workflow name, or "not found" — whichever is true) so the correction itself is auditable.
- Partial completion is represented honestly (e.g. "bundle-size gate exists for edge only, not a
  general core budget") rather than forced into a binary done/not-done glyph.
- The Progress Dashboard, Engineering Metrics readiness percentages, and Dependency Graph's
  "blocked until" list are recomputed from the corrected glyphs, not left stale alongside them.

**Non-Goals:**
- Not re-scoping, re-prioritizing, or re-estimating any task — that's a separate future change if
  warranted.
- Not implementing any of the 65 tasks themselves — this only corrects the tracker.
- Not producing the three missing audits (T063–T065) — verifying *their* absence is in scope;
  writing them is not.
- Not auditing every single claim inside every task's *description* prose for staleness beyond
  what's needed to set an accurate status glyph — a task description contradicted by source is
  flagged as a note, not rewritten line-by-line here.

## Decisions

**Verification method per task: direct source check, not doc cross-reference.** Checking one
audit doc against another audit doc just propagates the same staleness. Every task's verification
uses `search_graph`/`grep`/`glob` against actual source files, `ls` against actual CI workflow
files, or reading the actual published doc/README text — the same standard already applied when
re-verifying T001/T002/T010/T011/T014 in this session's own investigation before this change was
proposed.

**Status glyphs stay binary (□/◐/☑) but gain a "Verified:" annotation, not a new glyph.** Adding a
fourth glyph for "partial" would diverge from the doc's own stated legend and ripple into the
Progress Dashboard's counting logic. Instead, ◐ (In Progress) is used for genuinely partial work
(e.g. T012, T020) with the annotation spelling out exactly what fraction is done — the existing
legend already supports this without a schema change.

**Recompute, don't hand-adjust, the dashboard numbers.** The Progress Dashboard's per-phase counts
and the Engineering Metrics readiness percentages are derived values. Once every task glyph in a
phase is corrected, the phase's □/◐/☑ counts and % are recalculated directly from those glyphs
(not estimated), so the dashboard cannot drift from the task list it summarizes — the exact
failure mode being corrected.

**Tasks whose description text is now stale get a footnote, not a rewrite.** Example: T020
(WinterCG conformance test suite) describes adding "explicit assertions that the request path
uses only WinterCG-blessed APIs" as net-new work, but the real-runtime conformance suite added by
`harden-runtime-edge-serverless` already exercises the request path on real Deno/workerd — it
just doesn't have a standalone allowed-global-surface assertion. The status becomes ◐ with a note
explaining the gap between "runs on real runtimes" (done) and "explicitly asserts the allowed
global surface" (not done), rather than silently editing the task's original scope.

## Risks / Trade-offs

- **Risk:** A "Verified:" note is only as good as the check performed at write time; the doc will
  drift again the next time code changes without the doc being touched. → **Mitigation:** this is
  inherent to any point-in-time tracker; the fix is process discipline (update the checklist in the
  same PR/commit that closes a task), not something this change can enforce mechanically. Flagged
  as an explicit follow-up note in the corrected doc's own header rather than left implicit.
- **Risk:** Marking a task ◐ instead of ☑ for genuinely-partial work could be read as
  under-crediting completed effort. → **Mitigation:** the annotation spells out exactly what's done
  vs. remaining, so the record is more accurate, not less generous — precision over optics.
- **Trade-off:** This change touches only one file (a documentation correction) and produces no
  code, so its "implementation" is entirely the verification work itself, front-loaded into the
  tasks.md rather than split into a build phase. This is appropriate for the scope; forcing a
  code/test split onto a docs-accuracy task would be process theater.

## Migration Plan

Not applicable — no code, API, or schema changes. The corrected `03-gap-checklist.md` replaces the
stale one in place; no versioning or rollback mechanism beyond normal git history is needed.

## Open Questions

- Should the corrected checklist also get a machine-checkable companion (e.g. a script that greps
  for known "done" signatures) so future drift is caught automatically instead of relying on the
  next manual re-baseline? Noted as a candidate follow-up, not decided here — it would be new
  tooling scope beyond "correct this one document."
