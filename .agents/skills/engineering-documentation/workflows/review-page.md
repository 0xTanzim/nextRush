# Workflow — Review a Page

An **engineering** review, not a grammar pass. Produce a score and specific, actionable fixes — never vague praise. Review does not rewrite; it tells the author exactly what to change.

---

## How to review

1. Read the whole page as the target reader would.
2. Score each of the six axes below from **−10 to +10**.
3. For every axis under +7, give **specific** feedback: the exact line/section, why it fails the standard, and the concrete fix. "Weak intro" is useless; "the opening defines middleware before showing the problem — lead with the 200-routes pain (EDS-005)" is actionable.
4. Report the axis scores, the average, and a short verdict.

## The rubric (−10 … +10 per axis)

| Axis | What it measures | Anchored by |
|---|---|---|
| **Accuracy** | Claims true, code runnable, no invented behavior, assumptions flagged | Guardrails, EDS-013, EDS-015 |
| **Clarity & learning flow** | Problem-first, why-before-how, natural prose rhythm, progressive disclosure | EDS-004, EDS-005, EDS-006 |
| **Engineering depth** | Real mental model, honest trade-offs, decisions/judgment taught | EDS-001, EDS-010, EDS-021 |
| **Visual & code craft** | Diagrams/components earn their place; examples complete, realistic, explained | EDS-012, EDS-013, EDS-016 |
| **Structure & navigation** | Correct single page type, right section flow, real next steps, fits the IA | EDS-002, EDS-006, page-type standard |
| **Accessibility & metadata** | Front-matter, heading outline, alt text, contrast, no color-only signals | EDS-017 |

**Scoring guide:** `+10` best-in-class (React/Next/Stripe bar) · `+7` ships · `+4` usable but flawed · `0` mixed · negative = actively misleads or fails the standard.

## The verdict

- **Ships** when the average is **+7 or higher and no axis is below +4**.
- Any axis below +4 blocks the page regardless of average — a beautifully written page with wrong code, or an accurate page nobody can read, is not done.
- End with the top three fixes, ordered by impact, so the author knows where to start.

## Reviewer discipline

Ground every deduction in a named standard and a visible trigger — never "feels off." Explain *before* you judge (understand what the page is trying to do first). Be honest but useful: the goal is a better page, not a lower score.
