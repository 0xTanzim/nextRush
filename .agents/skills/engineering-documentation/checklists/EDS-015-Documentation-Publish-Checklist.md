# EDS-015 — Documentation Publish Checklist

> EDS-014 asks *"is this page good?"* This asks *"is it safe to publish right now?"* A page can teach beautifully and still break in the reader's hands — a stale API, a dead link, an example that no longer compiles. Run this **after** EDS-014, immediately before it ships.

---

## 1. Accuracy sign-off (check first)
- [ ] Every technical claim is true against the **current** version of the software.
- [ ] APIs, signatures, flags, and config keys match what ships today.
- [ ] Version numbers, package names, and commands are current.
- [ ] Anything unverifiable is marked as an assumption, never stated as fact.

Stale accuracy is the most damaging documentation defect. This is why it comes first.

## 2. Code actually works
- [ ] Every example compiles/runs **as written** — real imports, complete setup, no `...` where the reader needs code.
- [ ] Output shown matches what the code actually produces.
- [ ] No execution-breaking placeholder (`foo()`, `TODO`) where a real value is expected.

## 3. Links & navigation
- [ ] Every internal link resolves; every external link is live.
- [ ] Anchor links jump to the right heading.
- [ ] The "Next steps" section exists and points somewhere real.
- [ ] The page is reachable from a nav/index/related page — not an orphan (EDS-002).

## 4. Metadata, structure & SEO (EDS-017)
- [ ] Front-matter complete: unique `title`, benefit-first `description` (120–160 chars).
- [ ] Slug is short, lowercase, stable; canonical set if the content is versioned/duplicated.
- [ ] Social/OG metadata resolves to a real card.
- [ ] Headings form a correctly-nested outline (one H1, no skipped levels).
- [ ] The page's type is correct and unmixed.

## 5. Accessibility (EDS-017)
- [ ] Every image/diagram has alt text or an adjacent written explanation.
- [ ] No meaning conveyed by color alone; contrast meets AA.
- [ ] Link text is descriptive; interactive components are keyboard/screen-reader accessible.

## 6. Rendering & components (EDS-016)
- [ ] Renders correctly on the **target surface** — no broken tables, code fences, or diagrams.
- [ ] Code blocks have the correct language tag.
- [ ] No component used that the target surface can't render (Mermaid/custom components on npm).
- [ ] No raw template placeholders (`{{ ... }}`) or leftover `{/* comments */}` remain.

## 7. Consistency (EDS-002, EDS-004)
- [ ] Terminology matches sibling pages — one concept isn't called three names.
- [ ] Voice, tone, and formatting match the rest of the docs.
- [ ] No content duplicated from another page — it links instead of repeating (single source of truth).

## 8. Completeness & change hygiene
- [ ] No `TODO` / `FIXME` / `WIP` / "coming soon" in published content.
- [ ] If this documents new/changed behavior, every other page that references it is updated.
- [ ] If it replaces or deprecates a page, the old one redirects or is clearly marked.

## The final question
> If a developer lands here tomorrow, copies an example, and follows the links — does everything work, and do they leave understanding more than when they arrived?

If yes, publish. If any box is unchecked, fix it first — a page that looks done but breaks in the reader's hands costs more trust than shipping nothing.
