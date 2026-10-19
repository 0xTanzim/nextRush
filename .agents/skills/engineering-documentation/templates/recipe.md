{/*
  RECIPE / COOKBOOK TEMPLATE. Standard: EDS-019. A COMPLETE, production-shaped, runnable solution.
  Reader intent: "just give me the working answer." Optimized for COPY → ADAPT → SHIP, not learning.
  HARD RULE: everything shown is suitable for a real app — no placeholder secrets, no `...`, no
  pseudo-code, no missing imports, no "left as an exercise". Copied into a fresh project, it runs
  with only the documented configuration changes. Front-matter required.
*/}
---
title: {{ "___" — the scenario, e.g. "JWT authentication" }}
description: {{ 120–160 chars — the problem this solves }}
---

## Scenario

{{ The problem, stated so the searcher knows they're on the right page: "You have X. You need Y.
   This recipe gives you Z." 2–4 lines. }}

## Finished result

{{ The endpoints + a real sample response, so the reader confirms this is the recipe they want. }}

```bash
curl -X POST localhost:3000/{{ … }}
# {{ the actual response }}
```

## Requirements

- {{ Node >= 22 }}
- {{ @nextrush/… }}, {{ third-party packages }}
- {{ optional: PostgreSQL, Redis, … }}

## Installation

```bash
pnpm add {{ package-a package-b }}
```

## Project structure

{{ Where every file belongs — readers need this before pasting code. }}

```text
src/
  app.ts
  {{ feature }}/
    {{ file }}.ts
```

## Complete solution

{{ The DEFINING rule (EDS-019): the full, runnable code — real imports, all files, no "...".
   Use a code group for multiple files. }}

<CodeGroup>

```ts title="src/{{ file }}.ts"
// {{ complete file }}
```

```ts title="src/app.ts"
// {{ complete file — wires it together }}
```

</CodeGroup>

## Configuration

{{ The env/config the recipe needs — recipes almost always need this. Never hardcode secrets. }}

```env
{{ JWT_SECRET= }}
{{ DATABASE_URL= }}
```

## Verification

{{ Prove it works: request → expected response. }}

```bash
curl {{ … }}
# {{ expected JSON }}
```

## How it works

{{ File-by-file responsibilities and the decisions that matter — NOT every line. }}
- **`{{ file.ts }}`** — {{ its responsibility }}
- **`{{ app.ts }}`** — {{ how it wires together }}

## Customization

{{ What to change to fit a real app. }}
- **Replace this:** {{ the dev secret, the fake DB, the stub logger — the things that MUST change }}
- **{{ Common adaptation }}** — {{ e.g. "swap Zod for Valibot", "store to S3 instead of disk" }}

<Callout type="warn">
**Don't copy into production as-is:** {{ hardcoded secret · dev-only logger · in-memory/fake store · mock }}.
</Callout>

## Production checklist

{{ Recipes get copied into prod — protect the reader. }}
- [ ] Replace the development secret with a real, rotated one
- [ ] Enable HTTPS and secure cookies
- [ ] Add validation on all untrusted input
- [ ] Add logging and monitoring
- [ ] {{ recipe-specific item }}

## Security

- **Never commit secrets** — {{ … }}
- **HTTPS + secure cookies** — {{ … }}
- **Rotation / expiry** — {{ … }}
- **Validate untrusted input** — {{ … }}

## Troubleshooting

{{ Symptom → Cause → Fix, most common first — copied code breaks in predictable ways. }}
- **`401`.** *Cause:* {{ bad/absent secret }}. *Fix:* {{ … }}.
- **`500`.** *Cause:* {{ missing env var }}. *Fix:* {{ … }}.

## Common pitfalls

{{ Distinct from Troubleshooting: "copied → works locally → fails later". }}
- **{{ Forgot HTTPS }}** → {{ cookies silently fail in production }}.
- **{{ Clock skew }}** → {{ tokens expire early across services }}.

## Variations

{{ The realistic alternatives, so the reader adapts without starting over. }}
- **{{ Alternative approach }}** — {{ JWT vs sessions vs API keys — when each fits }}.

## Next improvements

{{ The natural follow-ups, so the reader keeps building. }}
- {{ Add refresh tokens }} → {{ role authorization }} → {{ rate limiting }} → {{ OpenAPI }}

## Related

- [{{ Concept }}](/docs/concepts/{{ slug }}) · [{{ Related recipe }}](/docs/recipes/{{ slug }})
