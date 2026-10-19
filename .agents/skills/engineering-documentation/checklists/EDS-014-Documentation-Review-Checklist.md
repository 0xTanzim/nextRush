# EDS-014 — Documentation Review Checklist

> Documentation is reviewed like code: publishing is not the finish line, quality is. This checklist is the *"is this page good enough to return?"* gate. The companion publish checklist (EDS-015) is the *"is it safe to ship right now?"* gate.

Run this after writing, before returning a page. It's the checklist form of the six-axis rubric in `workflows/review-page.md` — score there, verify here.

---

## 1. Type & purpose
- [ ] The page is **exactly one** type (Concept / Tutorial / Guide / Architecture / Reference / Landing / Recipe / Migration) and doesn't blend types (EDS-002).
- [ ] Its purpose is clear in the first screen; it answers one primary question.

## 2. Hook & motivation
- [ ] Opens with a real problem or sharp question — **not** a definition or an API (EDS-005).
- [ ] The reader knows "why should I care?" within the first paragraph.

## 3. Learning flow
- [ ] *Why* before *how*; problem before solution (EDS-001, EDS-006).
- [ ] Complexity is introduced progressively; no information dump.
- [ ] Prose has **natural rhythm** — varied sentence length, no one-fragment-per-line padding, no walls of text (EDS-004).

## 4. Accuracy
- [ ] Every technical claim is correct; every example is valid.
- [ ] Diagrams are technically accurate; trade-offs are honest.
- [ ] Assumptions are stated, never presented as fact.

## 5. Mental model & engineering depth
- [ ] Builds **one** clear mental model, made visible (EDS-012).
- [ ] Explains decisions, alternatives, and trade-offs — teaches judgment, not just usage (EDS-010, EDS-021).

## 6. Code (EDS-013)
- [ ] Every block teaches one idea and is explained before and after.
- [ ] Examples are **complete and runnable** — real imports, no `...`, realistic domain.
- [ ] No insecure or sloppy pattern modelled.

## 7. Visuals & components (EDS-012, EDS-016)
- [ ] Every diagram/component earns its place and is explained; none is decorative.
- [ ] Components fit their job (Tabs for alternatives, Steps for sequences); no component soup.
- [ ] Nothing depends on a component the target surface can't render (npm ≠ docs site).

## 8. Production readiness
- [ ] Performance, security, error handling, and debugging are covered where relevant.

## 9. Accessibility & metadata (EDS-017)
- [ ] Front-matter present: unique `title`, benefit-first `description`.
- [ ] One H1; no skipped heading levels.
- [ ] Alt text / adjacent explanation for every image and diagram.
- [ ] No meaning carried by color alone; descriptive link text.

## 10. Navigation
- [ ] Related pages linked; there is a real **next step** (EDS-002).
- [ ] The page fits the learning journey and isn't an orphan.

## The reader test
After reading once, can the reader answer: *what problem, why this design, how it works, when to use it, what trade-offs?* If not, keep improving.

## Blocking defects (fix before returning)
Information/API dump · walls of text or choppy padding · code that won't run · missing motivation · missing trade-offs · unexplained diagrams · no next step · missing front-matter. Any one of these fails the review regardless of how good the rest is.
