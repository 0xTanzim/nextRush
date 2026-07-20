{/*
  RECIPE / COOKBOOK TEMPLATE. Standard: EDS-019. A COMPLETE, runnable end-to-end solution.
  Show the whole thing, then annotate the key parts. Guide teaches a technique; a recipe hands over a working feature.
*/}
---
title: {{ "___" — the complete scenario, e.g. "JWT authentication" }}
description: {{ 120–160 chars — what the recipe builds }}
---

## What you'll build

{{ The scenario + the result up front (EDS-019) — endpoints, behavior, a sample response — so the reader confirms this is the recipe they want. }}

## When to use this

{{ The situation it fits, and when NOT to use it — a recipe is opinionated and specific (EDS-019). Link a Decision Guide (EDS-021) if there's a real choice. }}

## Prerequisites

<Callout type="info">
{{ Packages, setup, assumed knowledge. }}
</Callout>

## The complete solution

{{ The DEFINING rule (EDS-019): the full, runnable code. Real imports, all files, no "..." (EDS-013). Use a code group for multiple files. }}

<CodeGroup>

```ts title="src/auth.ts"
// {{ complete file }}
```

```ts title="src/app.ts"
// {{ complete file — wires it together }}
```

</CodeGroup>

## How it works

{{ Annotate the parts that matter — the decisions, not every line (EDS-019). The reader can run first, understand second. }}

<Callout type="warning">
{{ The security / correctness point that must not be removed when adapting. }}
</Callout>

## Variations

- **{{ Common adaptation }}** — {{ what to change, e.g. "swap Zod for Valibot" }}.

## Production notes

{{ What to harden before shipping — this gets copied into real apps verbatim. }}

## Related

- [{{ Concept }}](/concepts/{{ slug }}) · [{{ Related recipe }}](/recipes/{{ slug }})
