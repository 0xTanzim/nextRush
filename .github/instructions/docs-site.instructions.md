---
description: 'Standards for writing clear, modern, human-first documentation for the NextRush v3 documentation site.'
applyTo: '**'
---


# NextRush Documentation Site Instructions

These instructions guide GitHub Copilot when writing, editing, or improving documentation for the **NextRush v3 documentation site**.

The goal is to help produce documentation that is:

* Human-first
* Clear and practical
* Trustworthy
* Easy to scan
* Production-oriented

Documentation is treated as part of the product, not supporting material.

---

## Scope

Apply these rules when generating or modifying:

* Documentation pages (`.md`, `.mdx`)
* Guides, tutorials, and examples
* Concept explanations
* Package documentation
* API reference text (not type signatures)

Do **not** use these rules for:

* Marketing pages
* Blog posts
* README-only files
* Code comments inside source code

---

## Core Principles

### 1. Write for Humans First

Always prioritize understanding before APIs.

Each page should answer, in order:

1. What problem does this solve?
2. Why does it matter?
3. How should the reader think about it?
4. How do they use it minimally?
5. What happens internally?
6. What mistakes should be avoided?

Do not start with configuration or API tables.

---

### 2. Use Progressive Disclosure

Structure content so readers can stop early without losing value.

Organize sections from:

* Quick understanding
* Basic usage
* Deeper explanation
* Advanced or reference material

Avoid explaining everything at once.

---

### 3. Be Explicit and Honest

Do not hide:

* Default behavior
* Trade-offs
* Performance costs
* Limitations
* Escape hatches

Avoid marketing language or exaggeration.

---

### 4. Code Must Teach

All code examples must:

* Be copy-paste runnable
* Show imports explicitly
* Demonstrate one clear concept
* Include expected behavior or output when relevant
* Prefer TypeScript over JavaScript

Avoid pseudo-code.

---

## File Formats

* Use `.md` by default
* Use `.mdx` only when interaction improves clarity:

  * Tabs
  * Accordions
  * Callouts
  * Visual explanations

Do not convert files to MDX unless there is a clear UX benefit.

---

## Documentation Structure

Follow this structure when creating or editing docs:

1. Getting Started – first-time user flow
2. Concepts – mental models and design decisions
3. Guides – real-world tasks
4. Packages – per-package documentation
5. API Reference – technical reference
6. Examples – complete working applications

Avoid mixing conceptual teaching with API reference on the same page.

---

## Writing Style Rules

### Voice and Tone

* Address the reader directly using “you”
* Use active voice
* Keep sentences short and clear
* Prefer calm, confident language

**Preferred**

* “You can…”
* “This matters because…”
* “A common mistake is…”

**Avoid**

* Passive voice
* Formal or academic tone
* Marketing phrases

---

### Forbidden Words

Do not use:

* simply
* just
* easy
* obviously
* powerful and flexible
* etc.
* “This module provides…”

Avoid “Note:” at the start of paragraphs.

---

### Preferred Patterns

Use phrases like:

* “You might wonder why…”
* “If this feels like magic, here’s what’s happening…”
* “The trade-off here is…”
* “A common mistake is…”

---

## Page Templates

### Concept Pages (`concepts/*`)

Include these sections in order:

* Problem statement
* NextRush approach
* Mental model (text or diagram)
* Basic usage example
* Internal behavior explanation
* Common mistakes
* When not to use
* Next steps

Do not skip the problem or mental model sections.

---

### Package Pages (`packages/*`)

Must document:

1. Why the package exists
2. Default behavior
3. Installation
4. Minimal usage
5. Configuration options
6. Integration examples
7. Troubleshooting

API tables must include context, not only signatures.

---

### Guides (`guides/*`)

Guides must be:

* Task-oriented
* Step-by-step
* Verifiable

Each guide must include:

* Final outcome
* Clear steps
* Testing or verification
* Optional next improvements

Avoid abstract explanations in guides.

---

## Visual Elements

### Callouts (VitePress)

Use sparingly:

* `tip` → optional help
* `warning` → common pitfalls
* `danger` → security or data loss
* `details` → advanced or optional content

Do not stack multiple callouts together.

---

### Diagrams

Use Mermaid or ASCII diagrams for:

* Request lifecycle
* Middleware flow
* Architecture overview
* Plugin pipelines

Diagrams must support the text, not replace it.

---

## Comparisons with Other Frameworks

When comparing NextRush with other frameworks:

* Be factual
* Show real code differences
* Acknowledge strengths of others
* Compare current versions only

Do not use marketing language or dismiss competitors.

---

## Quality Checklist (Required)

Before publishing documentation, ensure:

### Content

* One clear purpose per page
* Problem explained before API
* Mental model included
* Common mistakes documented

### Writing

* Active voice
* No forbidden words
* Consistent terminology
* Clear section structure

### Technical

* Code examples tested
* TypeScript types accurate
* Links work correctly

### Developer Experience

* Faster to read than source code
* Reduces common questions
* Builds confidence for production use

---

## Maintenance Rules

* Update docs immediately for breaking changes
* Update examples with new features
* Add migration guides for major versions
* Incorporate feedback from issues and discussions

Outdated documentation is treated as a bug.

---

## Final Rule

Every documentation page must pass this test:

> “Could a developer ship this feature in production using only this page?”

If not, the documentation is incomplete.

```
