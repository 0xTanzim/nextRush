{/*
  CONCEPT PAGE TEMPLATE — Diátaxis "explanation". Standard: EDS-007. Flow: EDS-006.
  Copy to your docs, replace {{ }}, delete these comments. Components shown are illustrative
  (EDS-016); use whatever your docs framework provides — see documentation.instructions.md
  for this repo's Fumadocs set. Front-matter is required (EDS-017).
*/}
---
title: {{ Concept name — specific and unique, e.g. "Middleware" }}
description: {{ 120–160 chars, benefit-first — becomes the search snippet and social card }}
---

{/* HOOK (EDS-006 §1) — a real problem or sharp question, never a definition. */}
{{ Open with the engineering situation that makes this concept matter. One or two tight paragraphs. }}

## The problem

{{ What's hard, why it's hard, and why the naive fix breaks as the system grows (EDS-005). }}

<Callout type="info">
{{ Optional: a common misconception to clear up early. Use a callout only for a real aside — not for ordinary prose (EDS-016). }}
</Callout>

## How to think about it

{{ Introduce the concept as the response to the problem — the mental model, in words, before any code (EDS-007). One model per page. }}

```text
{{ ONE diagram of the mental model — ASCII here for portability, or <Mermaid> on the docs site.
   Explain what to notice in the sentence right after it (EDS-012). }}
Request → {{ this concept }} → Handler → Response
```

## How it works

{{ Internal mechanics — lifecycle, order, interactions — built up gradually (EDS-006 §6). }}

## In practice

{{ Explain what the example shows BEFORE the code (EDS-013). Keep it small — a concept page grounds the idea; guides carry the big examples. }}

```ts title="app.ts"
import { createApp } from 'nextrush';
// {{ smallest example that grounds the concept — complete, runnable, no "..." }}
```

{{ After the code: the one line that matters, and the mistake beginners make here. }}

## Trade-offs

{{ Honest costs and limits (EDS-004). If the choice is situational, promote to a Decision Guide (EDS-021): }}

**Choose this when** {{ condition }}. **Reach for {{ alternative }} when** {{ condition }}.

## Common mistakes

- **{{ Mistake }}** — {{ why it happens and the fix }}.

## Related

{{ Next-step links — the concept this builds on, and the guide that puts it to work (EDS-002). Never end without a next step. }}
- [{{ Related concept }}](/concepts/{{ slug }})
- [{{ Guide that applies it }}](/guides/{{ slug }})
