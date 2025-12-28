---
description: 'Human-first documentation standards for NextRush. Teach intent, mental models, and architectural reasoning. Avoid magic, boilerplate, and API-first explanations.'
applyTo: '**/*.md'
---

# NextRush Documentation Instructions

These instructions guide GitHub Copilot when writing or editing documentation for **NextRush**.

Documentation is a **core feature** of the framework.
If documentation is unclear, the framework is considered broken.

---

## Project Context

- Project: **NextRush**
- Domain: Modern backend framework
- Philosophy: Intent-over-mechanics, minimal configuration, explicit behavior
- Audience:
  - Developers new to NextRush
  - Experienced backend engineers evaluating architectural trust
- Documentation goal: Help developers **understand, decide, and feel safe**

Do not assume readers already trust the framework.

---

## Core Documentation Philosophy (Non-Negotiable)

### Humans Before APIs
- Do not start with code.
- Do not start with decorators, classes, or functions.
- Start with the **problem developers already feel**.

### Teach Thinking, Not Syntax
Documentation must explain:
- why a feature exists
- what problem it removes
- how developers should think about it
- what NextRush guarantees in return

If a reader copies code without understanding the intent, the documentation has failed.

---

## Mandatory Page Structure

Every documentation page MUST follow this order:

### 1. The Problem
Describe a real-world pain point.
Use everyday backend scenarios.

### 2. Why Other Frameworks Struggle
Briefly explain common mistakes in other frameworks:
- too much configuration
- hidden magic
- manual wiring
- unclear lifecycle

Be respectful and factual. No marketing language.

### 3. Why NextRush Exists Here
Explain the design decision.
Focus on **why this approach was chosen**.

### 4. Mental Model
Explain how to think about the feature.
Use simple analogies if helpful.
No implementation details yet.

### 5. Minimal Correct Example
Show the smallest safe example.
No advanced options.
No configuration unless required.

### 6. What NextRush Does Automatically
Explicitly document:
- what happens behind the scenes
- when it happens
- why it is safe
- how to override or opt out

No undocumented magic is allowed.

### 7. Common Mistakes
List mistakes developers are likely to make.
Explain why they happen and how to avoid them.

### 8. When NOT to Use This
Clearly state misuse cases.
Prevent overengineering.

---

## Writing Style Rules

### Language
- Use simple, direct English.
- Short sentences.
- One idea per paragraph.
- Use “you” and “your app”.

### Tone
- Calm
- Confident
- Senior engineer to engineer
- No hype
- No marketing language

### Forbidden Phrases
- “This module provides…”
- “Simply…”
- “Just…”
- “As you can see…”
- “Powerful and flexible…”

### Required Human Patterns
- “You might wonder why…”
- “At first, this feels unnecessary. Here’s why it isn’t.”
- “If this feels like magic, here’s what’s actually happening.”

---

## NextRush-Specific Rules

### Zero Config ≠ Zero Explanation
If something works automatically:
- explain the default behavior
- explain the trade-off
- explain the escape hatch

### Decorators Are Contracts
When documenting decorators:
- explain what contract is created
- explain what NextRush guarantees
- explain what breaks if the contract is violated

### Class-Based Design Must Be Justified
If a feature uses classes:
- explain why functions were not enough
- explain lifecycle implications
- explain DX benefits

Never assume OOP preference.

---

## What to Avoid (Critical)

- API reference before concepts
- Long “Getting Started” without understanding
- Hidden defaults
- Implicit behavior without explanation
- Framework-internal terminology without explanation
- Copy-paste from code comments

If documentation resembles NestJS or Spring reference docs, rewrite it.

---

## Validation Checklist (Before Final Output)

Before completing any documentation, verify:

- [ ] Does this reduce confusion?
- [ ] Would a junior developer feel safe using this?
- [ ] Would a senior engineer trust this design?
- [ ] Are architectural decisions explicit?
- [ ] Is magic explained or eliminated?
- [ ] Does this teach how to think, not just what to type?

If any answer is “no”, revise.

---

## Success Criteria

Documentation is considered successful if:
- onboarding time decreases
- GitHub issues repeat less often
- users stop asking “why does this work?”
- developers feel confident extending NextRush

Documentation is not complete until trust is established.
