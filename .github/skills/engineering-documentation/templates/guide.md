{/*
  GUIDE PAGE TEMPLATE — Diátaxis "how-to". Standard: EDS-009. Flow: EDS-006.
  Solves ONE task for a reader who knows the basics. Takes a position; production is mandatory.
*/}
---
title: {{ "How to ___" — one specific task }}
description: {{ 120–160 chars — the task and the outcome }}
---

## The problem

{{ Open with the problem, not code (EDS-009). Why it exists, when developers hit it. }}

## Goal

{{ Precisely what success looks like: "By the end, your API accepts requests from your frontend and rejects unknown origins." }}

## Before you start

{{ Required knowledge/setup. Link the concept page for anyone missing the foundation (EDS-007) — don't re-teach it. }}

## Recommended approach

{{ Take a position — the recommended solution and WHY, why common alternatives fall short. If the choice is genuinely situational, link a Decision Guide (EDS-021) instead of listing every option. }}

```text
{{ Optional architecture diagram — where this fits the request lifecycle (EDS-012). }}
Client → {{ this feature }} → Router → Handler → Response
```

<Steps>

### {{ Step 1 }}

```ts title="{{ file }}"
// {{ complete, runnable step (EDS-013) }}
```

{{ EXPLAIN every step: what changed, why it matters, what happens under the hood (EDS-009). }}

### {{ Step 2 }}

{{ One idea at a time. }}

</Steps>

## Production considerations

<Callout type="warning">
{{ MANDATORY (EDS-009) — security, performance, error handling, deployment. A guide that stops at "works locally" isn't finished. }}
</Callout>

## Trade-offs

{{ What this approach costs and when another wins. }}

## Common mistakes

- **{{ Mistake }}** — {{ why + impact + fix }}.

## Related

- [{{ Concept behind this }}](/concepts/{{ slug }}) · [{{ Next guide }}](/guides/{{ slug }})
