## Context

`harden-security-boundaries` resolved 19 findings across six workstreams (canonical request path,
typed proxy trust, CSRF, cookie integrity, response/content boundaries, enforcement) and closed
with an explicit, named list of surface it never touched — carried over verbatim from that
change's own proposal into this one's "What Changes" section. `docs/audits/03-gap-checklist.md`'s
T064 (produce a dedicated `05-security-architecture-audit.md`) remains `Not Started` and is a
broader, still-larger effort (threat model, ReDoS, prototype-pollution, dependency CVEs, the
eventual auth/session surface) that this change does not attempt to substitute for — it closes one
specific, named gap, the same way `harden-security-boundaries` closed one specific, named report's
findings rather than trying to be the whole-framework audit.

## Goals / Non-Goals

**Goals:**
- Read and test the seven named areas (Node request parsing, multipart, body-parser JSON charset,
  template auto-escaping, class guards/interceptors, websocket/stream/openapi/logger) for the same
  class of finding this review keeps surfacing elsewhere: a security-relevant decision made from an
  attacker-controlled value, or from a value normalized for one purpose and reused for another.
- Produce one `report/` artifact, structured per `report/TEMPLATE.md`, with every finding
  severity-tagged and evidence-cited (file/line, a failing test, or an observed HTTP response) —
  never an assertion with no cited check, matching this repo's `architecture-review.md` and
  `response-explanation-quality.md` evidence discipline.
- Leave a clean handoff: every finding gets a requirement (new or a `security-boundaries` delta)
  and a task number, in a findings-to-fix table this change's own report carries, mirroring
  `security-review-remediation-index.md`'s shape without merging into that file — SEC-01…SEC-19 in
  that index are already closed per task 9.7's completeness assertion, and reopening that same
  table with a different change's findings would violate that assertion's own stated scope.

**Non-Goals:**
- Implementing any fix. Remediation is out of scope for this change by design — investigation and
  remediation are kept separate so the audit isn't rushed to also patch what it finds, matching how
  `harden-security-boundaries` itself was scoped only after `report/security-review.md` existed as
  a separate, prior artifact.
- Superseding or absorbing T064. T064's threat-model/ReDoS/prototype-pollution/CVE scope is
  materially broader than this change's seven named packages; this change closes a subset T064
  would otherwise have to re-derive from scratch, and its report should be read as an input to a
  future T064 pass, not a replacement for it (already noted in `03-gap-checklist.md`'s T064 entry,
  §9.6 of `harden-security-boundaries`'s own tasks.md).
- Auditing every package in the repo. The seven named areas are the ones `harden-security-
  boundaries`'s own proposal explicitly flagged as out of scope for it — this change is scoped to
  exactly that list, not a fresh, unscoped whole-repo sweep.

## Decisions

- **One report, findings-to-fix table lives in that report, not in `security-review-remediation-
  index.md`.** That index's task 9.7 asserts completeness for SEC-01…SEC-19 specifically; a new
  change landing new findings under fresh SEC numbers in the same file would either force
  renumbering (breaking every existing cross-reference in six merged workstreams' commits and
  decisions logs) or silently coexist in a way that makes "is SEC-14 closed" ambiguous depending on
  which change you're reading. A cross-link between the two documents (this report references the
  prior index by name; a future remediation change references this report) keeps both self-
  consistent without merging.
- **No remediation task list in this change's own `tasks.md`.** Per the Non-Goals above, `tasks.md`
  for this change covers only the investigation-and-report work itself (per-area read/test/write
  tasks), not fixes. A finding requiring a fix becomes its own follow-up change (or one shared
  follow-up change if the findings turn out to cluster the way `harden-security-boundaries`'s six
  workstreams did) — decided after real findings exist, not speculatively now.
- **Investigation order follows the named list's own order** (Node parsing → multipart → body-
  parser charset → template escaping → class guards/interceptors → websocket/stream/openapi/logger),
  since that's the order the risk was originally flagged in and there's no stronger dependency
  between areas — unlike `harden-security-boundaries`'s WS-A→WS-B rebase requirement, nothing here
  requires one area's findings before another's investigation can start, so this can run as
  independent, parallelizable investigation tracks if useful, without WS-A/B's file-collision
  constraint (these seven areas don't share files with each other).

## Risks / Trade-offs

- **Risk: investigation finds nothing in an area, and "nothing found" gets read as "not actually
  checked."** Mitigated by this change's own spec requirement (see `specs/security-boundaries/
  spec.md`'s second scenario): every area's conclusion states the evidence checked, not just a
  clean bill of health with no cited work.
- **Risk: template auto-escaping and class guards/interceptors are both areas where a real finding
  would likely be P1/P2 (first-order XSS; an authorization bypass)** — if either surfaces a serious
  finding, the temptation to fix it inline (violating the investigation/remediation separation
  above) will be real. The Non-Goals section is written explicitly to make that a deliberate,
  visible deviation to flag and get sign-off on, not a silent scope-creep.
- **Trade-off: not merging into `security-review-remediation-index.md` costs a little
  discoverability** (a reader has to know to check two files) **for a clear win in not reopening a
  closure assertion (§9.7) that six merged workstreams' worth of commits already reference by SEC
  number.** Judged worth it given how much of `harden-security-boundaries`'s own governance
  discipline (its decisions logs, its remediation-index cross-references) depends on that index's
  numbering staying stable.
