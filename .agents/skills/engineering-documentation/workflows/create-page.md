# Workflow — Create a Page

Producing a new documentation page from scratch. Follow the steps in order; each names the standard that governs it.

---

### 1. Understand the request
Nail down four things before anything else: the **topic**, the **engineering problem** it solves, the **audience** (beginner / working engineer / contributor), and what the reader should be able to *do* afterward. If a required technical fact is missing, ask — never invent it (`SKILL.md` guardrails).

### 2. Pick the page type
Exactly one, from the page-types table in `SKILL.md`: Concept, Tutorial, Guide, Architecture, Reference, Landing, Recipe, or Migration. This decides everything downstream. If the topic seems to need two types, it's two pages — plan both and link them (EDS-002).

### 3. Load the context
- The page-type **standard** (EDS-007–011, 018–020) and its **template**.
- Always-apply standards: philosophy (EDS-001, 003), voice (EDS-004), storytelling (EDS-005), page flow (EDS-006).
- As needed: visuals (EDS-012), code (EDS-013), MDX components (EDS-016), a11y/metadata (EDS-017), decision guides (EDS-021).
- For this repo: the Fumadocs component set and content map in `.kiro/steering/documentation.instructions.md`.

### 4. Outline before writing
Write down: the one **learning objective**, the **problem**, the single **mental model**, the **visuals** and **code** the page needs, the **trade-offs**, and the **next-step** links. An outline is cheap; a rewrite is not.

### 5. Write
Follow the template's section flow and the reader's-journey order (`SKILL.md`): *why* before *how*, problem before API, one mental model made visible. Fill front-matter (`title`, `description`) per EDS-017. Keep every code block complete and runnable (EDS-013).

### 6. Self-review, then finish
Score against the rubric in `review-page.md` and run `checklists/EDS-014`. Improve until it clears the bar (avg +7, no axis below +4). Run `checklists/EDS-015` before it ships. Return the page only once it passes.
