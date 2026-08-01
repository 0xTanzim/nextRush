# Engineering Documentation Skill

> A reusable system for producing documentation that teaches engineering judgment — the standard set by React, Next.js, and Stripe — not just documents an API.

This skill bundles a documentation **philosophy**, a set of writing **standards** (the EDS — Engineering Documentation Standards), MDX-ready **templates**, **workflows**, and quality **checklists** into one consistent system. It applies to frameworks, SDKs, APIs, libraries, developer tools, and technical articles. The goal isn't to produce pages — it's to produce pages that make readers better engineers.

---

## How it works

`SKILL.md` is the entry point: a lean **router** that decides the mode and page type, then points to the exact standard, template, workflow, and checklist to read for the task. Detailed rules live in the folders so the router stays short and the right context loads only when needed (progressive disclosure). You don't read everything up front — the router tells you which file to open and when.

```text
engineering-documentation/
├── SKILL.md            # router — start here
├── README.md           # this overview
├── philosophy/         # WHY docs exist (EDS-001–003)
├── standards/          # HOW to write — the EDS rules (EDS-004–021)
├── templates/          # MDX page skeletons, one per type
├── workflows/          # process per mode (create / rewrite / review / improve)
└── checklists/         # quality gates (EDS-014 review, EDS-015 publish)
```

The layers stack: **Philosophy → Standards → Templates → Workflows → Checklists → Final page.**

---

## The EDS map

**Philosophy (why)** — 001 Philosophy · 002 Architecture/IA · 003 Principles.

**Cross-cutting standards (always apply)** — 004 Voice & Tone · 005 Storytelling · 006 Page Template (universal flow) · 012 Visual Standards · 013 Code Examples · **016 MDX & Interactive Components** · **017 Accessibility, SEO & Metadata** · **021 Decision Guides**.

**Page-type standards (one per type)** — 007 Concept · 008 Tutorial · 009 Guide · 010 Architecture · 011 Reference · **018 Landing/Overview** · **019 Recipe/Cookbook** · **020 Migration/Versioning** · **022 Production/Operations**.

**Checklists** — 014 Review · 015 Publish.

Templates define structure only; they never replace the standards.

---

## The page types (Diátaxis + extensions)

The five core types are the [Diátaxis](https://diataxis.fr) model — the industry standard that separates learning, doing, looking up, and understanding. The skill adds three extensions for real framework docs (Landing, Recipe, Migration) plus Decision Guides for teaching judgment. Every page is exactly one type; mixing types is the most common documentation failure.

---

## Core principles (the short version)

Start with the problem · explain *why* before *how* · one page, one mental model · reference is not education · be honest about trade-offs · show, don't decorate · teach engineering judgment, not API recall. The full set is EDS-003.

---

## Using it in a repo

The skill is **tool-agnostic** — it teaches the craft. Repo-specific facts (which MDX components exist, where content lives, package tiers) belong in that repo's steering. For NextRush, that's `.kiro/steering/documentation.instructions.md`; read it alongside the skill when writing for `apps/website`.

---

## Versioning

The EDS numbering (001…021) is the stable reference scheme — a new standard gets the next number, never a reused one. Improve standards from real practice; don't add a standard without practical justification. **v2** was a full quality rewrite: tightened every file to model its own voice rules, added MDX/component, accessibility/SEO, and information-architecture standards, and added the Landing, Recipe, Migration, and Decision-Guide types.

## The standard

Success isn't page count — it's understanding created. If readers become better engineers after reading, the skill did its job.
