# EDS-020 — Migration & Versioning Pages

> A migration page moves a reader from where they are to where you want them: an older version, or a competing tool. Its job is to make an intimidating change feel **safe, mechanical, and finite** — a checklist, not a leap of faith.

Two flavors share this standard: **version upgrades** (v2 → v3) and **cross-tool migrations** (from Express/Fastify to this framework). Both are read by a reader who has *working code* and something to lose, which shapes every rule below.

---

## The reader's real question

Not "what's new" — that's a changelog. The migrating reader is asking: *"What will break, how much work is it, and how do I not lose a weekend?"* Lead with honest answers to those. Anxiety, not curiosity, is the dominant emotion; reduce it.

## Structure

```text
Overview (what's changing & why) → Who needs to migrate → Effort estimate
   → Breaking changes (table) → Step-by-step migration → Before/after examples
   → Automated migration (codemod, if any) → Verification → Rollback → Getting help
```

## Rules specific to migration pages

- **Lead with a breaking-changes table.** Every breaking change, what it affects, and the required action, scannable at a glance. This is the first thing a reader looks for; put it near the top, not buried.
- **Give an honest effort estimate.** "Most apps: ~30 minutes; apps using the plugin API: half a day." Even rough guidance lets the reader plan and lowers dread. Never undersell it — a reader who's told "quick" and hits a wall loses trust fast.
- **Show before/after for every breaking change.** Old code beside new code (a code group or diff, EDS-016). This is the highest-value content on the page — a reader translates by pattern-matching.
- **Make it a step-by-step checklist.** Ordered, verifiable steps (Steps component, EDS-016), so the reader always knows what's done and what's left. Migration is a procedure; treat it like one.
- **Provide the codemod if one exists,** with the exact command and what it does/doesn't cover. Automating the mechanical 80% is the single biggest kindness a migration page offers.
- **Include verification and rollback.** How to confirm the migration worked, and how to back out if it didn't. A reader is far braver when there's a documented undo.
- **Be honest about what's not ready.** If a feature has no equivalent yet, say so plainly and give the workaround — don't let the reader discover it mid-migration.
- **For cross-tool migrations, map concepts.** "Express's `app.use` ≈ this framework's `app.use`; Express middleware `(req,res,next)` ≈ `(ctx)`." Translate their mental model, respectfully (EDS-005) — never trash the tool they're leaving.

## Anti-patterns

- A changelog masquerading as a migration guide (what changed, not how to migrate).
- Hiding or softening breaking changes — the reader finds them the hard way and stops trusting the page.
- No effort estimate, so the reader can't plan.
- Before/after for only *some* breaking changes.
- No rollback path.
- Disparaging the tool the reader is coming from.

## Success

A reader with a working app on the old version (or another tool) follows the page, knows exactly what breaks and what it costs, migrates by pattern-matching before/after examples, verifies it worked, and knows how to roll back if needed. The scary change became a finite checklist.
