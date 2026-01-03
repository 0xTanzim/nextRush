---
description: 'Writing standards for clear, human-friendly, production-grade documentation in the NextRush documentation site.'
applyTo: '**/*.md, **/*.mdx'
---

# NextRush Documentation Writing Instructions

These instructions guide GitHub Copilot when **writing or improving documentation text** for the NextRush documentation site.

The focus is on:

* Clear explanations
* Human-friendly language
* Trustworthy technical writing
* High readability for real developers

This file governs **how we write**, not what features exist.

---

## Writing Goals

All documentation text must aim to be:

* Easy to understand on first read
* Calm and confident
* Honest about trade-offs
* Useful under time pressure
* Suitable for production usage

Documentation should reduce confusion, not introduce it.

---

## Audience

Write for:

* Junior developers learning the framework
* Senior engineers evaluating design decisions
* Developers reading quickly during real work

Assume:

* Basic JavaScript and TypeScript knowledge
* No prior knowledge of NextRush internals

Do not assume familiarity with framework-specific terminology.

---

## Voice and Tone

### Use Direct, Human Language

* Address the reader as **“you”**
* Use active voice
* Prefer short sentences
* Keep paragraphs short (2–4 lines)

**Good**

> You can use middleware to run logic before a request reaches a handler.

**Bad**

> Middleware can be utilized to provide functionality prior to request handling.

---

### Tone Guidelines

* Calm, not excited
* Confident, not arrogant
* Helpful, not promotional
* Neutral, not defensive

Avoid hype.

---

## Forbidden Words and Phrases

Do **not** use:

* simply
* just
* easy
* obviously
* powerful and flexible
* etc.
* “This module provides…”
* “As mentioned above/below”
* “Note:” at the start of a paragraph

These words reduce clarity and trust.

---

## Preferred Writing Patterns

Use phrases that reflect real thinking:

* “You might wonder why…”
* “If this feels like magic, here’s what’s happening…”
* “This matters because…”
* “A common mistake is…”
* “The trade-off here is…”
* “In practice, this means…”

Avoid abstract or academic phrasing.

---

## Sentence and Paragraph Rules

* Average sentence length: **under 25 words**
* One idea per paragraph
* Avoid dense blocks of text
* Break long explanations into steps or lists

If a paragraph feels hard to read, split it.

---

## Explaining Concepts

When explaining a concept:

1. Start with the **problem**
2. Explain the **idea**, not the API
3. Introduce terminology after meaning
4. Show minimal usage
5. Explain internal behavior
6. Warn about common mistakes

Do not start with code unless it is trivial.

---

## Technical Terms

* Explain technical terms the first time they appear
* Do not assume knowledge of internal names
* Be consistent with terminology across pages

If two terms mean the same thing, pick one.

---

## Code Explanations

When explaining code:

* Explain **why it exists**, not line-by-line behavior
* Avoid narrating obvious syntax
* Focus on side effects and lifecycle impact

**Good**

> This middleware runs before routing, so it can modify the request safely.

**Bad**

> This function takes `ctx` and returns a response.

---

## Lists and Tables

Use lists when:

* Explaining steps
* Listing rules
* Showing options

Use tables when:

* Comparing approaches
* Documenting configuration
* Mapping concepts

Avoid overly long tables.

---

## Headings

* Use headings to guide scanning
* Headings should describe intent, not structure

**Good**

* “Why middleware order matters”
* “What happens when a request fails”

**Bad**

* “Details”
* “More information”

---

## Warnings and Mistakes

Always document:

* Common mistakes
* Misuse scenarios
* Surprising behavior

Frame mistakes as learning opportunities, not errors.

**Preferred**

> A common mistake is assuming this runs after routing.

**Avoid**

> Do not do this.

---

## Comparisons and Trade-offs

When discussing alternatives:

* Be factual
* Explain trade-offs clearly
* Avoid claiming superiority without explanation

Never use competitive or dismissive language.

---

## Clarity Checks (Required)

Before finalizing text, ensure:

* A junior developer could follow it
* A senior engineer would trust it
* The explanation is faster than reading source code
* The reader knows what to do next

If not, rewrite.

---

## Final Writing Test

Every section must pass this question:

> “If I were reading this at work, would this save me time?”

If the answer is no, the writing needs improvement.

```

---

## What this file does well (for you)

- ✅ Optimized for **GitHub Copilot behavior**
- ✅ Forces human tone, not robotic output
- ✅ Improves explanation quality automatically
- ✅ Reduces verbose, low-signal writing
- ✅ Works for both `.md` and `.mdx`
