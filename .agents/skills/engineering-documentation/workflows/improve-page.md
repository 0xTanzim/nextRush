# Workflow — Improve a Page

Iteratively refining a page until it clears the quality bar. Unlike Rewrite (a single structural pass), Improve is a **loop**: score, fix the weakest axis, re-score, repeat.

---

### The loop

1. **Score** the page against the six-axis rubric in `review-page.md`.
2. **Target the weakest axis** — fix the lowest score first, since that's what's blocking the page (any axis below +4 blocks it regardless of average).
3. **Apply the fix** using the governing standard:
   - Prose reads choppy or robotic → EDS-004.
   - Opens weak / no story → EDS-005, EDS-006.
   - Model unclear / missing visual → EDS-012, EDS-016.
   - Examples broken or unrealistic → EDS-013.
   - Missing trade-offs or judgment → EDS-021.
   - Missing front-matter / a11y → EDS-017.
4. **Re-score.** Confirm the axis improved and nothing else regressed.
5. **Repeat** until the average is +7 with no axis below +4.

### Preserve while improving

Never remove correct technical information, an important warning, or accurate API behavior to make the prose flow. Improvement changes *communication*, never *meaning* (same rule as Rewrite). If a change would alter a technical claim, stop — that's a content decision, not a polish pass.

### Stop condition

Stop when the rubric clears the bar — not when the page merely *feels* different. "Different" is not "better"; the score is the arbiter. Then run `EDS-015` before it ships.
