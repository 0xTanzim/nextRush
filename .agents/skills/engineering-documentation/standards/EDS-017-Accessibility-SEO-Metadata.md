# EDS-017 — Accessibility, SEO & Metadata

> A page nobody can find, and a page some readers can't use, both fail — no matter how well written. Accessibility and discoverability are correctness requirements, not polish.

World-class docs (React, Next.js, Stripe, MDN) are accessible and discoverable by default. This standard makes that non-optional: every shipped page carries correct front-matter, a clean heading outline, accessible components and media, and the metadata that lets search and social surfaces represent it accurately.

Applies to **every page that ships**. It pairs with EDS-016 (component accessibility) and EDS-004 (plain language is itself an accessibility feature).

---

## 1. Front-matter (every page)

Every docs page opens with front-matter. Minimum fields — names vary by framework, the intent does not:

```yaml
---
title: Request Validation            # the <h1> and the browser tab / search title
description: Validate request bodies, params, and query with any Standard Schema library.  # 120–160 chars, benefit-first
---
```

- **`title`** — specific and unique across the site. "Validation" is weak; "Request Validation" is findable. This becomes the `<title>` and the primary SEO signal.
- **`description`** — one sentence, 120–160 characters, stating the *benefit*. It is the search-result snippet and the social-card text; write it for a human deciding whether to click, not for keyword stuffing.
- Add framework fields as needed: `sidebar_position`/`order`, `tags`/`keywords`, `canonical` (for duplicated/versioned content), `icon`. Fill them; a blank description ships a blank search result.

---

## 2. Heading structure

Headings are the page's outline, the in-page nav, *and* the primary structure a screen reader and a search crawler rely on.

- **Exactly one `#` (H1) per page** — usually rendered from the front-matter `title`. Don't write a second `#`.
- **Never skip a level.** `##` → `###` → `####`. Jumping `##` to `####` breaks the outline for assistive tech and the auto-generated table of contents.
- Headings describe content, not cleverness — "Handle validation errors", not "Uh-oh". They double as anchor links, so they must read well out of context.
- Keep them scannable: a reader should understand the page from the headings alone.

---

## 3. Images, diagrams & media

- **Every image has alt text** that states what it *communicates*, not what it *is*: `alt="Request flows through auth, then validation, then the handler"`, not `alt="diagram"`. Decorative-only images (rare in docs) get empty `alt=""`.
- **Mermaid/ASCII diagrams need an adjacent written explanation** (EDS-012) — a screen reader cannot read the picture, and the diagram may fail to render. The prose must carry the same idea.
- Don't put essential text *inside* a raster image — it can't be searched, translated, selected, or zoomed.
- Video/GIF: provide a text summary of what it shows; never make a step *only* available as video.

---

## 4. Color & contrast

- **Never rely on color alone** to carry meaning. A red callout must also *say* "Warning:"; a diff must use `+`/`-`, not just green/red; a status must have a label, not just a dot. Roughly 1 in 12 readers can't distinguish some color pairs.
- Body text and code must meet WCAG **AA contrast** (4.5:1 normal, 3:1 large). This is mostly a theme concern, but don't hand-pick low-contrast inline styles that override it.
- Syntax-highlighting themes must stay legible in both light and dark mode.

---

## 5. Links & navigation

- **Descriptive link text.** "See the [validation guide]", never "click [here]" or a bare URL. Link text is read out of context by screen readers and weighted by search.
- Mark links that leave the site or open a new tab; don't hijack navigation unexpectedly.
- Every page has a **next step** (EDS-006). An orphan page — reachable by no nav, index, or related link — effectively does not exist for search or readers.
- Breadcrumbs and an accurate sidebar position tell the reader *where they are* (EDS-002).

---

## 6. Components, tables & code (accessibility)

- Use the framework's **real** interactive components (Tabs, Accordion, Steps) so keyboard and screen-reader support come built in — never a `div` faked to look like one (EDS-016).
- **Tables:** real header rows (`| --- |`), one concept per table. Don't use tables for layout.
- **Code blocks:** always language-tagged (for highlighting and for tooling), and copy-paste-runnable so the copy button delivers working code (EDS-013).
- Don't hide happy-path content in a collapsed Accordion — collapsed content is skipped by many readers and de-weighted by search (EDS-016).

---

## 7. SEO & discoverability

Good structure *is* good SEO — the same outline that helps a reader helps a crawler.

- **Title + description** (§1) are the biggest levers. Unique, specific, benefit-first.
- **Slugs** are short, lowercase, hyphenated, and stable — `request-validation`, not `RequestValidation1`. A changed slug breaks every inbound link; when you must change one, add a redirect.
- **Canonical URLs** for content that exists at more than one path (versioned docs, mirrored pages) so search doesn't split ranking or show the wrong version.
- **Social/OG metadata** (`og:title`, `og:description`, `og:image`) so a shared link renders a real card, not a bare URL. A per-page or per-section default image is enough.
- **Structured content** — clean headings, lists, and tables — is what powers rich results and in-site search ranking. Write the outline for humans; search benefits automatically.

---

## 8. Language (accessibility through clarity)

Plain language (EDS-004) is an accessibility feature: it serves non-native readers, readers with cognitive load, and translation. Prefer common words, short sentences, expanded acronyms on first use, and active voice. Complexity should come from the engineering, never from the vocabulary.

---

## Definition of done (a11y/SEO gate)

- [ ] Front-matter present: unique `title`, benefit-first `description` (120–160 chars).
- [ ] One H1; no skipped heading levels; headings scannable.
- [ ] Every image/diagram has alt text or an adjacent written explanation.
- [ ] No meaning carried by color alone; contrast meets AA.
- [ ] Link text is descriptive; the page has a real next step and is not an orphan.
- [ ] Interactive components are real (keyboard/screen-reader accessible); tables have headers.
- [ ] Slug is short, lowercase, stable; canonical set if content is duplicated/versioned.
- [ ] Social/OG metadata resolves to a real card.

A page that fails any box is not shippable, exactly like a page with a wrong API signature. (This gate is folded into the publish checklist, EDS-015.)
