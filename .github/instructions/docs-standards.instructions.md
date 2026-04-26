---
description: 'Documentation standards, tiering system, page templates, content ownership, and quality enforcement for NextRush. The constitution for all docs.'
applyTo: '**/*.md, **/*.mdx'
---

# NextRush Documentation Standards

Documentation is a **core feature** of NextRush.
If documentation is unclear, the framework is considered broken.

This file governs **what to write**, **how to structure it**, and **how quality is enforced**.

Related instruction files:

- `docs-mdx-ui.instructions.md` — HOW to present (components, visuals)
- `docs-api-reference.instructions.md` — API reference format (signatures, tables)

---

## Philosophy

### Humans Before APIs

Start with the **problem developers already feel**. Not code, not decorators, not class hierarchies.

Documentation must explain:

- Why a feature exists
- What problem it removes
- How to think about it
- What NextRush guarantees

If a reader copies code without understanding intent, the documentation has failed.

### Progressive Disclosure

Structure content so readers can stop early without losing value.

1. Quick understanding
2. Basic usage
3. Deeper explanation
4. Advanced or reference material

### Be Explicit and Honest

Document:

- Default behavior
- Trade-offs
- Performance costs
- Limitations
- Escape hatches

### Zero Config ≠ Zero Explanation

If something works automatically, explain:

- The default behavior
- The trade-off
- The escape hatch

---

## Audience

Write for:

- Junior developers learning the framework
- Senior engineers evaluating design decisions
- Developers reading under pressure during real work

Assume:

- Basic JavaScript and TypeScript knowledge
- No prior NextRush knowledge
- No assumed trust in the framework

---

## Documentation Tiering System

Not every package needs the same depth. Classify before writing.

### Tier 1 — Core Infrastructure

**Packages:** core, runtime, router, di, decorators, controllers, types, errors

**Required sections:**

1. The Real Problem
2. Why NextRush Solves It This Way
3. Mental Model (diagram encouraged)
4. Execution Flow
5. Minimal Correct Usage
6. What Happens Automatically
7. Configuration
8. Error and Failure Behavior
9. Performance Notes
10. Security Considerations
11. Common Mistakes
12. When Not To Use
13. Next Steps

**Word budget:** 1200–2000 words

These pages are architectural. Full depth required.

---

### Tier 2 — Middleware and Plugins

**Packages:** cors, helmet, body-parser, rate-limit, compression, cookies, logger, static, template, events, websocket

**Required sections:**

1. Problem
2. Default Behavior
3. Installation
4. Minimal Usage
5. Configuration Options
6. Integration Example
7. Common Mistakes
8. Troubleshooting

**Word budget:** 600–1200 words

No philosophical essays. Link to concept pages for deeper context.

---

### Tier 3 — Utilities and Adapters

**Packages:** request-id, timer, adapter-node, adapter-bun, adapter-deno, adapter-edge, dev

**Required sections:**

1. Purpose
2. Installation
3. Minimal Usage
4. API Reference
5. One Practical Example

**Word budget:** 300–700 words

Keep lean. If the page exceeds the budget, split or remove filler.

---

## Content Ownership Map

Each content type has a canonical home. No duplication across categories.

```
/concepts/         → Thinking only. Why things work this way.
/packages/         → Behavior and usage. How to use each package.
/api/              → Signatures only. Lookup material.
/guides/           → Tasks only. Step-by-step how-tos.
/examples/         → Complete runnable scenarios.
/getting-started/  → Onboarding path.
/architecture/     → System-level diagrams and flows.
```

**Rules:**

- Concepts explain **why**. Packages explain **how**. API lists **what**.
- Never re-explain a concept inside a package page. Link to the concept page.
- API details live in API reference. Not in concept or package pages.
- Configuration lives in one canonical location per package.
- Cross-link between categories. Duplicate never.

---

## Writing Rules

### Voice and Tone

- Address the reader as **"you"**
- Active voice
- Short sentences (under 22 words average)
- One idea per paragraph (2–4 lines)
- Calm, confident, helpful — never promotional
- Professional, not theatrical

**Use sparingly (max 2 per page):**

- "If this feels like magic, here's what's happening…"
- "This matters because…"
- "The trade-off here is…"

**Never overuse rhetorical questions or meta commentary.** Human tone does not mean theatrical.

### Forbidden Words and Patterns

- simply / just / easy / obviously / straightforward
- powerful / flexible / robust / enterprise-ready
- etc.
- "This module provides…"
- "As mentioned above/below"
- "Note:" at the start of a paragraph
- Excess "You might wonder why…" (max 1 per page)
- Marketing superlatives
- Passive voice in instructions

### Headings

- Describe intent, not structure
- Good: "Why middleware order matters"
- Bad: "Details" / "More information" / "Overview"

### Lists and Tables

- Use lists for steps, rules, options
- Use tables for comparisons and configuration
- Keep tables under 10 rows. Split if larger.

---

## Page Templates by Type

### Concept Pages (`concepts/*`)

Follow the Tier 1 template. Never skip the problem or mental model.

### Package Pages (`packages/*`)

Use the template matching the package tier (Tier 1, 2, or 3).

### Guide Pages (`guides/*`)

Must be:

- Task-oriented and step-by-step
- Verifiable (include testing or verification steps)

Required sections:

1. What you will build
2. Prerequisites
3. Step-by-step instructions
4. Verification / testing
5. Next improvements (optional)

No abstract explanations. Guides solve a specific task.

### Example Pages (`examples/*`)

Required sections:

1. What this example demonstrates
2. Prerequisites
3. Full code
4. How to run
5. Expected output

### API Reference Pages (`api/*`)

Follow `docs-api-reference.instructions.md`. Lookup material only.

---

## Code Examples

### Rules

- All examples must be copy-paste runnable
- Show imports explicitly
- Demonstrate one concept per example
- Include expected behavior or output when relevant
- TypeScript by default
- No pseudo-code
- If code exceeds ~30 lines, use an accordion (`<details>`)
- Signal category: minimal, practical, or complete

### Code Explanations

- Explain **why** code exists, not line-by-line syntax
- Focus on side effects, lifecycle impact, and guarantees

---

## Framework Comparisons

When comparing NextRush with other frameworks:

- Be factual and show real code differences
- Acknowledge strengths of alternatives
- Compare current versions only
- No marketing language or dismissiveness

---

## Error Documentation

Document errors when the message is non-obvious, the mistake is common, or the fix is unclear.

Each entry must include:

- Exact error message
- Clear cause
- Working solution
- Link to related docs

---

## Content Priorities

| Priority | Scope                                             | Risk If Weak          |
| -------- | ------------------------------------------------- | --------------------- |
| P1       | Getting Started, Quick Start, Core Concepts       | Adoption failure      |
| P2       | App lifecycle, Routing, Plugin system, Middleware | "How do I…" questions |
| P3       | Auth, Database, Testing, Deployment               | Advanced friction     |
| P4       | API reference, Package config, Types              | Accuracy issues       |

---

## Duplication Prevention

Duplication is a documentation bug. It creates drift and maintenance burden.

- Before writing any section, check if the concept exists elsewhere
- If documented elsewhere, link to it. Do not re-explain.
- API details belong in API reference only
- Concept explanations belong in concept pages only
- Configuration belongs in one canonical location

When auditing existing docs, flag duplicated content and consolidate.

---

## Migration Documentation

Required for breaking changes:

- Before and after examples
- Reason for the change
- Step-by-step migration path
- Deprecation timelines
- Links to updated docs

---

## Terminology

### Canonical Terms

| Concept              | Approved Term     |
| -------------------- | ----------------- |
| Request context      | Context (`ctx`)   |
| Middleware unit      | Middleware        |
| Extension mechanism  | Plugin            |
| Request handler      | Handler           |
| URL mapping          | Route             |
| Application instance | Application / app |

### Capitalization

| Term       | Rule                                   |
| ---------- | -------------------------------------- |
| NextRush   | Always capitalized                     |
| Context    | Capitalized as noun, lowercase in code |
| JavaScript | Always capitalized                     |
| TypeScript | Always capitalized                     |
| Node.js    | Always include `.js`                   |
| npm / pnpm | Always lowercase                       |

---

## Maintenance

- Update docs in the same PR as code changes
- Breaking changes require migration guides
- Stale documentation is worse than missing documentation
- Public API change without doc update blocks the PR

### Quarterly Review

1. Review most visited pages
2. Check for outdated examples
3. Verify version numbers
4. Remove deprecated patterns
5. Consolidate duplicated content
6. Add newly discovered FAQs

---

## NextRush-Specific Rules

### Decorators Are Contracts

When documenting decorators:

- Explain the contract created
- Explain what NextRush guarantees
- Explain what breaks on violation

### Class-Based Design Must Be Justified

If a feature uses classes:

- Explain why functions were insufficient
- Explain lifecycle implications
- Explain DX benefits

Never assume OOP preference.

---

## Quality Scoring (Single System)

Score every documentation page on 6 dimensions before delivery.

| Dimension       | Min Score | What It Measures                               |
| --------------- | --------- | ---------------------------------------------- |
| Code Accuracy   | 9         | Every statement matches the actual source code |
| Structure       | 8         | Follows the correct tier template              |
| Clarity         | 8         | A junior developer can understand and use this |
| Example Quality | 8         | Examples are runnable, minimal, and correct    |
| Duplication     | 9         | Zero content duplicated across docs            |
| Completeness    | 8         | All public APIs and behaviors documented       |

If any dimension falls below its minimum, revise before delivery. Maximum 3 revision cycles.

This is the **only** scoring system. Do not create additional scoring matrices.

---

## Quality Checklist

Before publishing:

- [ ] One clear purpose per page
- [ ] Correct tier template followed
- [ ] Problem explained before API
- [ ] Active voice, no forbidden words
- [ ] Code examples verified against source
- [ ] TypeScript types accurate
- [ ] No content duplicated from other pages
- [ ] Links work correctly
- [ ] Within word budget for tier
- [ ] Could a developer ship using only this page?
