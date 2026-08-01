{/*
  GUIDE PAGE TEMPLATE — Diátaxis "how-to". Standard: EDS-009. Flow: EDS-006.
  A guide is a WORKSHOP: the reader finishes with something working. Section order is CANONICAL.
  A Guide answers: What are we building? · Why each step? · How do I verify? · What might break? ·
  What next? It NEVER contains deep theory, API tables, benchmarks, internals, or Trade-offs
  (those are Concept / Reference / Architecture, linked). Take a position. Front-matter required.

  difficulty + estimatedTime live in front-matter as the authoring standard. NOTE: the current
  docs collection schema (apps/website/source.config.ts) captures only title/description, so until
  it's extended + a header component renders them, ALSO surface them as a visible line under
  Prerequisites. Drop the visible line once the platform renders the front-matter.
*/}
---
title: {{ "How to ___" — one specific task }}
description: {{ 120–160 chars — the task and the outcome }}
difficulty: {{ beginner | intermediate | advanced }}
estimatedTime: {{ e.g. "10 minutes" }}
---

{{ OPENING HOOK — "why this guide exists": you can do the simple version → it gets hard as it
   grows → this guide organizes it. 2–3 sentences. No "## Introduction" heading. }}

## What you'll build

{{ Concrete outcome as a checklist, plus the resulting routes/artifacts so the reader has a target. }}
- ✓ {{ … }}

```text
{{ e.g. the endpoints/files that exist at the end }}
```

## Before and after

{{ People learn by comparison. }}

**Before**
- ❌ {{ pain … }}

**After**
- ✓ {{ improvement … }}

## Prerequisites

- **Concepts:** [{{ concept }}](/docs/concepts/{{ slug }})
- **Required knowledge:** {{ … }}
- **Difficulty · time:** {{ Beginner · ~10 minutes }}   {/* remove once front-matter renders */}

## What you're building

{{ The target as a diagram — the shape, not an architecture study. }}

<Mermaid chart="
flowchart TB
  A[{{ … }}] --> B[{{ … }}]
" />

## Recommended approach

{{ Standard shape — take a position: }}
- **Use {{ X }} because** {{ … }}
- **Avoid {{ Y }} because** {{ … }}
- **Alternative:** {{ … }}
- **When to choose the alternative:** {{ … }}

<Steps>

### {{ Step 1 — imperative, e.g. "Split each feature into its own router" }}

**Why:** {{ the reason this step exists }}

**Do:**

```ts title="{{ file }}"
// {{ complete, runnable step — each block type-checks standalone (EDS-013) }}
```

**Result:** {{ what the reader now has }}

### {{ Step 2 }}

**Why:** {{ … }}

**Do:**

```ts title="{{ file }}"
```

**Result:** {{ … }}

</Steps>

## Verify

{{ Standard shape per check: Request → Expected response → what success means. }}

```bash
curl localhost:8080/{{ … }}    # {{ expected status + body }}
```

{{ One line: what it means if the response differs → point to Troubleshooting. }}

## Production considerations

{{ Think through all four; omit one only if genuinely irrelevant, and say so. }}

### Security
{{ … }}

### Performance
{{ … }}

### Reliability
{{ … }}

### Deployment
{{ … }}

## Troubleshooting

{{ Symptom → Cause → Fix, ordered MOST COMMON FIRST (not alphabetical). }}
- **{{ Symptom, e.g. "Every route returns 404" }}.** *Cause:* {{ … }}. *Fix:* {{ … }}.

## Common mistakes

{{ Distinct from Troubleshooting: focus on WHY it happens, not the symptom. }}
- **{{ Mistake }}.** *Why it happens:* {{ … }}. *Fix:* {{ … }}.

## Key takeaways

- {{ 4–6 bullets reinforcing the technique }}

## Continue learning

{{ Fixed order: Concept → next Guide → Reference. }}

<Cards>
  <Card title="{{ Concept behind this }}" href="/docs/concepts/{{ slug }}">
    {{ one line }}
  </Card>
  <Card title="{{ Next guide }}" href="/docs/guides/{{ slug }}">
    {{ one line — the next thing to build }}
  </Card>
  <Card title="{{ Reference }}" href="/docs/reference/{{ slug }}">
    {{ one line — look up the API }}
  </Card>
</Cards>
