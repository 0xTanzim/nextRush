---
name: engineering-documentation
description: Create, rewrite, review, and improve world-class engineering documentation for frameworks, SDKs, APIs, libraries, developer tools, and technical systems — the standard set by React, Next.js, and Stripe. Covers documentation philosophy, voice, information architecture, the Diátaxis page types, advanced MDX/interactive components, accessibility, SEO, visuals, and code examples. Use proactively whenever the task involves writing or improving docs, tutorials, concept pages, guides, architecture pages, API references, landing pages, recipes, migration guides, README files, or technical articles — even when the user does not say "documentation" but is clearly explaining a feature, writing a guide, or documenting how something works.
---

# Engineering Documentation Skill

Great documentation teaches engineering judgment, not just API surface. A reader should leave understanding the problem, the design decision behind the solution, how it works, and the honest trade-offs — not merely *which method to call*. This skill is the system that produces that standard consistently: a philosophy, a set of writing standards (the **EDS** — Engineering Documentation Standards), MDX-ready templates, workflows, and quality gates.

The rules live in separate files so this router stays short and you load only what the task needs (progressive disclosure). **This page decides the mode and page type, then tells you which files to open.** Do not work from this page alone, and do not read all the files up front.

> This file also models the prose it demands (EDS-004): varied sentence length, tight paragraphs, no one-fragment-per-line padding. If your output reads choppier than this router, it fails its own standard.

---

## First principles (the whole skill in six lines)

- **Teach the *why* before the *how*.** Motivation before mechanics, every time.
- **Start from the reader's problem**, not your API.
- **One page, one purpose, one mental model.** Never mix page types.
- **Reference is not education.** Lookup material and teaching material are different jobs.
- **Be honest about trade-offs.** Trust is worth more than polish.
- **Show, don't decorate.** Every diagram, component, and code block must earn its place by improving understanding.

---

## The reader's journey (the order understanding is built)

Every teaching page answers these in this order. Reversing it — leading with the API — is the most common documentation failure.

```text
Why does this exist?  →  What is it?  →  When do I use it (and when not)?
      →  How do I use it?  →  What are the trade-offs?  →  How does it work inside? (optional)
```

This produces the **documentation pyramid**: problem and concept at the top, API reference near the *bottom*. People adopt software to solve problems, not to memorize signatures — so the signature comes after the understanding that makes it meaningful.

---

## The four content layers (where a page belongs)

Organize the doc set by what the reader is trying to do, never by package name. Full model in `philosophy/EDS-002-Documentation-Architecture.md`.

| Layer | Reader's goal | Page types |
|---|---|---|
| **Learn** | Understand the system | Concept, Architecture, Landing/Overview |
| **Build** | Accomplish a task | Tutorial, Guide, Recipe |
| **Reference** | Look something up fast | Reference |
| **Evolve** | Upgrade / operate / go deep | Migration, Production, Architecture, Decision Guide |

---

## Page types (Diátaxis + engineering extensions)

Every page is **exactly one** type. The five core types are the [Diátaxis](https://diataxis.fr) model; the rest are extensions this skill adds for real framework docs. Load both the template (structure) and the standard (rules) for the chosen type.

| Page type | Diátaxis role | Answers | Template | Standard |
|---|---|---|---|---|
| **Concept** | Explanation | "Why does this exist, how should I think about it?" | `templates/concept.md` | `standards/EDS-007-Concept-Pages.md` |
| **Tutorial** | Tutorial | "Teach me by building something real." | `templates/tutorial.md` | `standards/EDS-008-Tutorial-Pages.md` |
| **Guide** | How-to | "Help me accomplish one specific task." | `templates/guide.md` | `standards/EDS-009-Guide-Pages.md` |
| **Architecture** | Explanation (deep) | "How does it work inside, and why built this way?" | `templates/architecture.md` | `standards/EDS-010-Architecture-Pages.md` |
| **Reference** | Reference | "Give me exact, complete, scannable facts." | `templates/reference.md` | `standards/EDS-011-Reference-Pages.md` |
| **Landing / Overview** | — | "What is this and where do I start?" | `templates/landing.md` | `standards/EDS-018-Landing-Pages.md` |
| **Recipe / Cookbook** | How-to (complete) | "Give me a full, runnable end-to-end solution." | `templates/recipe.md` | `standards/EDS-019-Recipe-Pages.md` |
| **Migration / Versioning** | — | "How do I upgrade or move from X?" | `templates/migration.md` | `standards/EDS-020-Migration-Pages.md` |
| **Production / Operations** | — | "How do I run this safely in production?" | `templates/production.md` | `standards/EDS-022-Production-Pages.md` |

Never merge a reference table into a concept page, or a tutorial into an architecture page. When two purposes appear on one page, split them and cross-link.

---

## Execution modes

Decide the mode first, then follow its workflow file.

| Mode | Meaning | Workflow |
|---|---|---|
| **Create** | New page from scratch | `workflows/create-page.md` |
| **Rewrite** | Improve structure/clarity, preserve technical meaning | `workflows/rewrite-page.md` |
| **Review** | Score and give actionable feedback, no rewrite | `workflows/review-page.md` |
| **Improve** | Iterate until it clears the quality bar | `workflows/improve-page.md` |

---

## Resource map — what to read and when

Paths are relative to this skill's root. Read a file at the moment its row applies, not before.

| When you are… | Read |
|---|---|
| Starting **any** task (internalize the mindset) | `philosophy/EDS-001-Documentation-Philosophy.md`, `philosophy/EDS-003-Engineering-Documentation-Principles.md` |
| Placing a page in the larger doc set / designing navigation | `philosophy/EDS-002-Documentation-Architecture.md` |
| Writing or editing **any** prose (always) | `standards/EDS-004-Voice-And-Tone.md`, `standards/EDS-005-Engineering-Storytelling.md` |
| Laying out a page's section flow (always) | `standards/EDS-006-Page-Template.md` |
| Adding a diagram | `standards/EDS-012-Visual-Standards.md` |
| Adding a code example | `standards/EDS-013-Code-Example-Standards.md` |
| Using MDX components (Tabs, Steps, Callouts, Cards, CodeGroup, TypeTable, …) | `standards/EDS-016-MDX-And-Interactive-Components.md` |
| Setting front-matter, headings, alt text, titles/descriptions (always for a shipped page) | `standards/EDS-017-Accessibility-SEO-Metadata.md` |
| Writing a "which should I use?" / trade-off section that teaches judgment | `standards/EDS-021-Decision-Guides.md` |
| Choosing the page-type standard + template | the page-types table above |
| Reviewing before returning a page | `checklists/EDS-014-Documentation-Review-Checklist.md` |
| Final pre-publish pass | `checklists/EDS-015-Documentation-Publish-Checklist.md` |

> **Repo seam.** This skill is tool-agnostic — it teaches the craft. Which MDX components actually exist in *this* repo's docs site (Fumadocs), where content lives, and the package tiers are in `.kiro/steering/documentation.instructions.md`. Read that too when writing for `apps/docs`.

---

## The workflow

```text
Understand → Identify the reader → Determine the page type → Load its standard + template
   → Load always-apply standards → Plan the outline → Write → Self-review (rubric) → Improve → Return
```

1. **Understand.** Nail the topic, the engineering problem it solves, and what the reader should be able to do afterward. If a required fact is missing, ask — never invent it.
2. **Identify the reader.** Beginner, working engineer, or contributor; framework user, SDK consumer, or API consumer. Depth, vocabulary, and assumed knowledge follow from this (EDS-004).
3. **Determine the page type.** Exactly one, from the table above. Load its standard and template.
4. **Load the always-apply standards.** Philosophy (001, 003), voice (004), storytelling (005), page flow (006), plus visuals (012), code (013), MDX (016), and metadata/a11y (017) as the page needs them.
5. **Plan the outline.** Primary learning objective, the problem, the one mental model, the visuals and code the page needs, trade-offs, and the next-step links — before writing a sentence.
6. **Write.** Follow the page flow in EDS-006 and the reader's-journey order above. *Why* before *how*, always.
7. **Self-review, then improve.** Score against the rubric below and the review checklist (EDS-014). Iterate until it clears the bar. Run the publish checklist (EDS-015) before it ships.

---

## Quality bar — definition of done

A page is done when it is **technically accurate, genuinely useful, and a pleasure to read** — and when a reader finishes thinking *"I understand the engineering behind this,"* not merely *"I saw the API."* Concretely, it must:

- start from the reader's problem and build one clear mental model;
- teach *why* before *how*, with honest trade-offs;
- carry accurate, runnable code and diagrams/components that earn their place;
- be scannable, correctly structured for its type, and accessible (headings, alt text, contrast);
- link forward to the next logical page; and
- pass the review (EDS-014) and publish (EDS-015) checklists.

**Scoring rubric (used by the Review mode, −10 … +10 per axis).** Accuracy · Clarity & learning flow · Engineering depth (why + trade-offs) · Visual & code craft · Structure & navigation · Accessibility & metadata. A page ships at an average of **+7 or higher with no axis below +4**. The rubric detail lives in `workflows/review-page.md`.

---

## Guardrails (non-negotiable, every mode)

Accuracy always beats readability. Never:

- invent APIs, behavior, benchmarks, or internals — state an assumption explicitly instead of guessing;
- exaggerate a feature or hide a real trade-off;
- cut a necessary technical detail to make prose flow;
- teach an insecure or poor engineering practice, even in a toy example;
- ship a diagram, component, or code block that decorates without teaching.

When uncertain, write the uncertainty down. A visible assumption is a feature; a confident fabrication is a defect.
