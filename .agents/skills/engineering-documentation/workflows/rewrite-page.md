# Workflow — Rewrite a Page

Improving an existing page's clarity and structure **without changing its technical meaning**. The bar: the new version teaches better; the facts are identical.

---

### 1. Read the whole page first
Understand what it says and every technical claim it makes *before* touching it. Note what is correct and load-bearing — that content is preserved verbatim in meaning, however you restructure around it.

### 2. Diagnose against the standards
Score the current page with the rubric in `review-page.md` and list concrete defects by axis. The usual suspects:
- **Choppy prose** — one-fragment-per-line, blank-line padding (EDS-004). This is the most common defect and the first to fix.
- **Wrong opening** — leads with a definition or API instead of the problem (EDS-005, EDS-006).
- **No mental model / no visual** (EDS-012).
- **Broken or non-runnable code** (EDS-013).
- **Wrong page type** — a concept page doing reference work, etc. (EDS-002). If so, splitting may beat rewriting.
- **Missing a11y/metadata** — no front-matter, skipped headings, color-only signals (EDS-017).

### 3. Confirm the page type
Load its standard and template. If the page mixes types, the right rewrite is often to split it and cross-link (EDS-002), not to polish the blend.

### 4. Rewrite
Restructure to the template's flow. Tighten prose to natural rhythm (EDS-004). Add the missing mental model, visual, or trade-offs. Make every example runnable. **Preserve technical correctness exactly** — if you're unsure a claim is still true, flag it, don't silently "fix" it.

### 5. Compare, then verify
The new version must be measurably easier to understand, better structured, and more production-focused — never merely *different*. Run `EDS-014`, then `EDS-015`. Confirm no technical meaning changed.
