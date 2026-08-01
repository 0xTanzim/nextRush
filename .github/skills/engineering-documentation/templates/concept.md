{/*
  CONCEPT PAGE TEMPLATE — Diátaxis "explanation". Standard: EDS-007. Flow: EDS-006.
  Copy, replace {{ }}, delete these comments. Section order is CANONICAL — keep it.
  A Concept answers: Why does this exist? · How does it work? · What trade-offs? · When choose it?
  It carries almost NO API (that's Reference) and no build-along task (that's a Guide).
  ONE page = ONE mental model. Components are this repo's Fumadocs set (documentation.instructions.md).
  Front-matter required (EDS-017).
*/}
---
title: {{ Concept name — specific and unique, e.g. "Routing" }}
description: {{ 120–160 chars, benefit-first — becomes the search snippet and social card }}
---

{{ OPENING HOOK — follow: real-world situation → pain → curiosity. 2–3 sentences.
   e.g. "Every request must find the right handler. Simple at 10 routes; at 2,000 it becomes
   part of your hot path." No "## Introduction" heading. }}

## What you'll learn

{{ EXACTLY 3–5 bullets. Lead with Understand / Explain / Recognize / Choose. }}
- {{ Why … }}
- {{ How … }}
- {{ When … }}
- {{ Why not … }}

## The problem

{{ What's hard, and why the naive approach breaks as the system grows (EDS-005). }}

```ts
// {{ OPTIONAL: the naive approach and what it costs — complete + runnable, or use ```text }}
```

## Why this matters

{{ Connect the reader to the stakes BEFORE the solution: where this runs, and why a small
   inefficiency compounds (per-request hot path, multiplied by scale, etc.). 2–4 sentences. }}

## The solution

{{ The one-paragraph answer. Problem → Why it matters → Solution → then the explanation. }}

## Core idea

{{ Name and frame THE ONE mental model for this page — never several. }}

## Mental model

<Mermaid chart="
flowchart TB
  A[{{ … }}] --> B[{{ … }}]
" />

{{ Diagram FIRST. Then ONE sentence steering attention: "Don't memorize the tree — notice that
   matching follows the URL, not the number of routes." (EDS-012). }}

## Quick example

{{ The smallest runnable example — ONLY this concept. No logging, auth, or validation noise.
   Explain what it shows BEFORE the code (EDS-013). }}

```ts title="app.ts"
import { createApp } from 'nextrush';
// {{ smallest complete, runnable example — real imports, no "..." }}
```

## How it works

{{ Standard shape: Example → Observation → Explanation. Concrete before abstract. Keep internals
   LIGHT and link the Architecture page — a concept teaches the model, not the implementation. }}

## Typical use cases

{{ OPTIONAL — include only when it helps recognize WHEN the concept applies (Middleware/Routing:
   yes; Extension lifecycle: probably not). This is recognition, not usage instructions. }}

## Configuration

{{ OPTIONAL. Explain what CHANGING each option MEANS for behavior — not every option (that's
   Reference). Link Reference for the full table. }}

## Performance

{{ Standard shape: Complexity → Memory → Scaling → benchmark link. Principles, never unverified
   numbers. Point to apps/benchmark. }}

## Security

{{ MANDATORY. Standard order per risk: Threat → Why → Safe default → What to avoid. }}

<Callout type="warn">
{{ The one security risk the reader must not miss. }}
</Callout>

## Trade-offs

**Why {{ this design }}** — {{ the property it optimizes for }}.

- **Benefits** — {{ … }}
- **Costs** — {{ … }}
- **Alternatives** — {{ … }} (link a Decision Guide, EDS-021, if situational)
- **Why NextRush chose this** — {{ the decision rationale — readers want to know why }}

## Decision guide

**Choose {{ the default }} when:**
- ✓ {{ … }}

**Avoid {{ the default }} when:**
- ✗ {{ … }}

**Choose {{ an alternative }} when:**
- ✓ {{ … }}

## Common mistakes

- **{{ Mistake }}.** *Why it happens:* {{ … }}. *Correct approach:* {{ … }}. *If ignored:* {{ … }}.

## Key takeaways

{{ 4–6 bullets, no paragraphs, no NEW concepts — only what the page taught. }}
- {{ … }}

## Continue learning

{{ Fixed navigation order: Concept → Guide → Reference → Architecture. }}

<Cards>
  <Card title="{{ Related concept }}" href="/docs/concepts/{{ slug }}">
    {{ one line — the idea to understand next }}
  </Card>
  <Card title="{{ Guide that applies it }}" href="/docs/guides/{{ slug }}">
    {{ one line — put the concept to work }}
  </Card>
  <Card title="{{ Reference }}" href="/docs/reference/{{ slug }}">
    {{ one line — look up the API }}
  </Card>
  <Card title="{{ Architecture }}" href="/docs/internals/{{ slug }}">
    {{ one line — how it's implemented }}
  </Card>
</Cards>
