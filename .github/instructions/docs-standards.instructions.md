---
description: 'Documentation philosophy, writing standards, page structure, and content strategy for NextRush. The single source of truth for how documentation is written, structured, and maintained.'
applyTo: '**/*.md, **/*.mdx'
---

# NextRush Documentation Standards

Documentation is a **core feature** of NextRush.
If documentation is unclear, the framework is considered broken.

This file governs **what to write**, **how to write it**, and **how documentation evolves**.

For MDX component usage and visuals, see `docs-mdx-ui.instructions.md`.
For API reference formatting, see `docs-api-reference.instructions.md`.

---

## Philosophy

### Humans Before APIs

Do not start with code, decorators, classes, or functions.
Start with the **problem developers already feel**.

Documentation must explain:

- Why a feature exists
- What problem it removes
- How developers should think about it
- What NextRush guarantees in return

If a reader copies code without understanding the intent, the documentation has failed.

### Progressive Disclosure

Structure content so readers can stop early without losing value.

Organize from:

1. Quick understanding
2. Basic usage
3. Deeper explanation
4. Advanced or reference material

### Be Explicit and Honest

Do not hide:

- Default behavior
- Trade-offs
- Performance costs
- Limitations
- Escape hatches

### Zero Config ≠ Zero Explanation

If something works automatically:

- Explain the default behavior
- Explain the trade-off
- Explain the escape hatch

---

## Audience

Write for:

- Junior developers learning the framework
- Senior engineers evaluating design decisions
- Developers reading quickly during real work

Assume:

- Basic JavaScript and TypeScript knowledge
- No prior knowledge of NextRush internals
- No assumed trust in the framework

---

## Writing Rules

### Voice and Tone

- Address the reader as **"you"**
- Use active voice
- Keep sentences short and clear (under 25 words average)
- One idea per paragraph (2–4 lines)
- Calm, confident, helpful — never promotional

**Preferred phrases:**

- "You might wonder why…"
- "If this feels like magic, here's what's happening…"
- "This matters because…"
- "A common mistake is…"
- "The trade-off here is…"
- "In practice, this means…"

### Forbidden Words

Do not use:

- simply / just / easy / obviously
- powerful and flexible
- etc.
- "This module provides…"
- "As mentioned above/below"
- "Note:" at the start of a paragraph

### Headings

- Describe intent, not structure
- Good: "Why middleware order matters"
- Bad: "Details" / "More information"

### Lists and Tables

- Use lists for steps, rules, options
- Use tables for comparisons, configuration, concept mapping
- Avoid overly long tables

---

## Page Structure

Every documentation page follows this structure (adapt sections to page type):

### 1. The Problem

Describe a real-world pain point using everyday backend scenarios.

### 2. Why NextRush Exists Here

Explain the design decision. Focus on **why this approach was chosen**.
Briefly mention where other frameworks struggle (too much configuration, hidden magic, manual wiring). Be respectful and factual.

### 3. Mental Model

Explain how to think about the feature.
Use analogies if helpful. No implementation details yet.

### 4. Minimal Correct Example

Show the smallest safe example.
No advanced options or configuration unless required.

### 5. What NextRush Does Automatically

Explicitly document:

- What happens behind the scenes
- When it happens
- Why it is safe
- How to override or opt out

### 6. Common Mistakes

List mistakes developers are likely to make.
Explain why they happen and how to avoid them.
Frame mistakes as learning opportunities, not errors.

### 7. When NOT to Use This

Clearly state misuse cases. Prevent overengineering.

### 8. Next Steps

Link to related concepts, guides, or API reference.

---

## Page Type Templates

### Concept Pages (`concepts/*`)

Follow the full page structure above. Do not skip the problem or mental model sections.

### Package Pages (`packages/*`)

Must document:

1. Why the package exists
2. Default behavior
3. Installation
4. Minimal usage
5. Configuration options (with context, not only signatures)
6. Integration examples
7. Troubleshooting

### Guides (`guides/*`)

Must be:

- Task-oriented and step-by-step
- Verifiable (include testing or verification steps)

Each guide must include:

- Final outcome
- Clear steps
- Testing or verification
- Optional next improvements

Avoid abstract explanations in guides.

---

## Code Examples

### Categories

1. **Minimal** — prove a concept works
2. **Practical** — show realistic usage
3. **Complete** — production reference

Signal which category an example belongs to. Do not mix categories without explanation.

### Rules

- All examples must be copy-paste runnable
- Show imports explicitly
- Demonstrate one clear concept
- Include expected behavior or output when relevant
- Prefer TypeScript over JavaScript
- Avoid pseudo-code
- If code exceeds ~30 lines, consider an accordion

### Code Explanations

- Explain **why** code exists, not line-by-line syntax
- Focus on side effects, lifecycle impact, and guarantees

---

## Comparisons with Other Frameworks

When comparing NextRush with other frameworks:

- Be factual
- Show real code differences
- Acknowledge strengths of others
- Compare current versions only
- Never use marketing language or dismiss competitors

---

## Error & Troubleshooting Documentation

Document errors when:

- The error message is non-obvious
- The mistake is common
- The fix is unclear

Each error entry must include:

- Exact error message
- Clear cause
- Working solution
- Links to related docs

---

## Content Priorities

### Priority 1 — Critical Path (Day 1)

Getting Started, Quick Start, Core Concepts, Middleware Flow.
If these pages are weak, nothing else matters.

### Priority 2 — Core Productivity (Week 1)

Application lifecycle, Routing, Plugin system, Core middleware, Basic REST API guides.
Reduce "how do I…" questions.

### Priority 3 — Advanced Usage (Month 1)

Authentication, Database integration, Testing, Deployment, Custom plugins.
Not required for first adoption.

### Priority 4 — Reference (Ongoing)

API reference, Package configuration, Type definitions.
Must be accurate, not verbose.

---

## Content Decisions

### When to Create a New Page

- A concept cannot be explained within an existing page
- A task requires multiple ordered steps
- A new package introduces new mental models
- A pattern appears repeatedly in issues

### When to Update an Existing Page

- A new feature extends an existing concept
- Defaults or behavior change
- Common misunderstanding appears
- New best practices emerge

Avoid duplicating information across pages.

---

## Migration Documentation

Required for breaking changes. Must include:

- Before and after examples
- Reason for the change
- Step-by-step migration path
- Deprecation timelines
- Links to updated docs

---

## Terminology

### Canonical Terms

| Concept | Approved Term |
| --- | --- |
| Request context | Context (`ctx`) |
| Middleware unit | Middleware |
| Extension mechanism | Plugin |
| Request handler | Handler |
| URL mapping | Route |
| Application instance | Application / app |

### Capitalization

| Term | Rule |
| --- | --- |
| NextRush | Always capitalized |
| Context | Capitalized as noun, lowercase in code |
| JavaScript | Always capitalized |
| TypeScript | Always capitalized |
| Node.js | Always include `.js` |
| npm / pnpm | Always lowercase |

---

## Maintenance

- Update docs immediately for breaking changes
- Update examples with new features
- Add migration guides for major versions
- Incorporate feedback from issues and discussions
- Stale documentation is worse than missing documentation

### Quarterly Review

1. Review most visited pages
2. Check for outdated examples
3. Verify version numbers
4. Remove deprecated patterns
5. Add newly discovered FAQs

---

## NextRush-Specific Rules

### Decorators Are Contracts

When documenting decorators:

- Explain what contract is created
- Explain what NextRush guarantees
- Explain what breaks if the contract is violated

### Class-Based Design Must Be Justified

If a feature uses classes:

- Explain why functions were not sufficient
- Explain lifecycle implications
- Explain DX benefits

Never assume OOP preference.

---

## Quality Checklist

Before publishing documentation:

- [ ] One clear purpose per page
- [ ] Problem explained before API
- [ ] Mental model included
- [ ] Common mistakes documented
- [ ] Active voice, no forbidden words
- [ ] Consistent terminology
- [ ] Code examples tested and runnable
- [ ] TypeScript types accurate
- [ ] Links work correctly
- [ ] Faster to read than source code
- [ ] Could a developer ship this feature using only this page?
- [ ] Would a junior developer feel safe using this?
- [ ] Would a senior engineer trust this design?

---

## Final Rule

> **A developer who is blocked needs a clear answer right now.**

If a page does not unblock that developer, it needs revision.
