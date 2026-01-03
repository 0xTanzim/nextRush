---
description: 'Editorial content strategy and workflow for the NextRush documentation. Defines what to write, when to write it, and how documentation evolves over time.'
applyTo: '**'
---

# NextRush Documentation Content Strategy

This file defines the **editorial strategy** for the NextRush documentation.

It guides **what content to create**, **when to create it**, and **how documentation evolves** as the framework grows.

This file does **not** define writing style, UI usage, or page structure.
Those concerns are handled by other instruction files.

---

## Scope

Use this file when deciding:

* Which documentation to write next
* Whether to create a new page or update an existing one
* How to prioritize documentation work
* How to review, maintain, and evolve documentation
* How to handle migrations, terminology, and long-term consistency

Do not use this file for:

* Sentence phrasing
* Tone or voice rules
* MDX components or visuals
* Page layout templates

---

## Content Hierarchy & Priorities

Documentation work must follow this priority order.

### Priority 1 — Critical Path (Day 1)

These pages determine whether a developer adopts NextRush.

| Area            | Goal                             |
| --------------- | -------------------------------- |
| Getting Started | First success in under 5 minutes |
| Quick Start     | Working app without confusion    |
| Core Concepts   | Correct mental model early       |
| Middleware Flow | Understanding execution order    |

If these pages are weak, nothing else matters.

---

### Priority 2 — Core Productivity (Week 1)

These pages enable real work:

* Application lifecycle
* Routing patterns
* Plugin system
* Core middleware packages
* Basic REST API guides

These pages should reduce “how do I…” questions.

---

### Priority 3 — Advanced Usage (Month 1)

These pages serve experienced users:

* Authentication patterns
* Database integration
* Testing strategies
* Deployment and production concerns
* Custom plugin development

These are not required for first adoption.

---

### Priority 4 — Reference (Ongoing)

These pages are **looked up**, not read:

* API reference
* Package configuration details
* Type definitions

They must be accurate, not verbose.

---

## Decision Framework

### When to Create a New Page

Create a new page when:

* A concept cannot be explained clearly within an existing page
* A task requires multiple ordered steps
* A new package introduces new mental models
* A pattern appears repeatedly in issues or discussions

---

### When to Update an Existing Page

Update an existing page when:

* A new feature extends an existing concept
* Defaults or behavior change
* A common mistake emerges
* Users misunderstand an existing feature

Avoid duplicating information across pages.

---

### New Page vs Update Matrix

| Situation                       | Action                   |
| ------------------------------- | ------------------------ |
| New feature in existing package | Update package page      |
| Breaking change                 | Update + migration guide |
| Repeated user confusion         | Add troubleshooting      |
| Entirely new concept            | New concept page         |
| New integration pattern         | New guide                |

---

## Editorial Workflow

### Phase 1 — Research

Before writing:

1. Read the source code
2. Identify default behavior
3. Review related issues and discussions
4. Check how similar frameworks explain the same idea
5. Identify the real user pain

Do not write before understanding the behavior fully.

---

### Phase 2 — Outline

Create a clear outline before drafting:

* Problem
* Core idea
* Basic usage
* Key behaviors
* Common mistakes
* Next steps

Do not optimize language at this stage.

---

### Phase 3 — Draft

During drafting:

* Focus on correctness first
* Include all required examples
* Mark uncertainty explicitly
* Do not polish prematurely

Completeness matters more than elegance.

---

### Phase 4 — Technical Review

Verify:

* Code examples work
* API signatures match implementation
* Defaults are correct
* Performance claims are accurate
* Edge cases are documented

Incorrect documentation is treated as a bug.

---

### Phase 5 — Editorial Review

Check for:

* Clear purpose
* Logical flow
* No duplicated content
* Correct terminology
* Clear next steps

Pages without a clear goal must be revised.

---

## Terminology Governance

### Canonical Terms

Use these terms consistently across all documentation:

| Concept              | Approved Term     |
| -------------------- | ----------------- |
| Request context      | Context (`ctx`)   |
| Middleware unit      | Middleware        |
| Extension mechanism  | Plugin            |
| Request handler      | Handler           |
| URL mapping          | Route             |
| Application instance | Application / app |

Avoid synonyms that introduce ambiguity.

---

### Capitalization Rules

| Term       | Rule                                   |
| ---------- | -------------------------------------- |
| NextRush   | Always capitalized                     |
| Context    | Capitalized as noun, lowercase in code |
| JavaScript | Always capitalized                     |
| TypeScript | Always capitalized                     |
| Node.js    | Always include `.js`                   |
| npm / pnpm | Always lowercase                       |

---

## Code Example Strategy

Documentation examples fall into three categories:

1. **Minimal** — prove a concept works
2. **Practical** — show realistic usage
3. **Complete** — production reference

Each page should clearly signal which category an example belongs to.

Avoid mixing categories without explanation.

---

## Error & Troubleshooting Strategy

Document errors when:

* The error message is non-obvious
* The mistake is common
* The fix is simple but unclear

Each error entry must include:

* Exact error message
* Clear cause
* Working solution
* Links to related docs

---

## Migration Documentation Strategy

Migration guides are required for breaking changes.

Each migration guide must include:

* Before and after examples
* Reason for the change
* Step-by-step migration path
* Deprecation timelines
* Links to updated docs

Migration docs must be discoverable from the changelog.

---

## Maintenance & Review Cycle

### Continuous Maintenance

Update documentation when:

* Behavior changes
* Defaults change
* Confusion appears in issues
* New best practices emerge

Stale documentation is worse than missing documentation.

---

### Periodic Review

Every quarter:

1. Review most visited pages
2. Check for outdated examples
3. Verify version numbers
4. Remove deprecated patterns
5. Add newly discovered FAQs

---

## Community Contributions

When reviewing community documentation contributions:

* Apply the same standards as core docs
* Verify technical accuracy
* Ensure consistent terminology
* Preserve contributor credit

Quality is more important than speed.

---

## Final Principle

Documentation decisions must always optimize for this user:

> **A developer who is blocked and needs a clear answer right now.**

If a page does not unblock that user, it needs revision.

```

---

## Final state (you’re done with instructions)

You now have a **clean, non-overlapping, professional set**:

1. `docs-site.instructions.md` → structure & standards
2. `docs-writing.instructions.md` → language & explanation
3. `docs-mdx-ui.instructions.md` → MDX, visuals, UI
4. `docs-content-strategy.instructions.md` → **editorial strategy**

This is **exactly how serious OSS projects structure Copilot rules**.
