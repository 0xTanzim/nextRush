{/*
  TUTORIAL PAGE TEMPLATE — Diátaxis "tutorial". Standard: EDS-008. Flow: EDS-006.
  A guided build. Loop: build → explain → verify, one new idea per step. Components illustrative (EDS-016).
*/}
---
title: {{ "Build a ___" — the thing they'll create }}
description: {{ 120–160 chars — what they build and what they'll understand by the end }}
---

{{ One paragraph: what we're building and why it's worth 20 minutes. }}

## What you'll build

{{ Show the finished result FIRST (EDS-008) — endpoints, a sample response, a screenshot. Knowing the destination makes the path followable. }}

## What you'll learn

- {{ concept 1 }} · {{ concept 2 }} · {{ concept 3 }}

## Prerequisites

<Callout type="info">
Assumes {{ TS + basic backend }}. Required: {{ Node >= 22 }}. Time: ~{{ N }} min.
</Callout>

<Steps>

### {{ Step 1 — imperative, e.g. "Create the app" }}

{{ WHY this step exists, before the code (EDS-005). }}

```ts title="src/app.ts"
import { createApp, listen } from 'nextrush';
// {{ small, complete, runnable — one new idea only }}
```

{{ EXPLAIN: what changed, why it works, the line that matters, the trap to avoid. }}

**Verify:** {{ the expected output — response, log, terminal — so the reader confirms success (EDS-008). }}

### {{ Step 2 — next single idea }}

{{ Repeat the build → explain → verify loop. Introduce exactly one new concept. Link the concept page for depth (EDS-007) rather than teaching it in full here. }}

</Steps>

## What just happened

{{ Connect the build back to the framework's concepts — the request flow, the lifecycle — in a few sentences. }}

## Common mistakes

- **{{ Mistake }}** — {{ why + fix }}.

## Next steps

{{ Reflection, not "congratulations" (EDS-008): name what they learned, then point onward. }}
<Cards>
  <Card title="{{ Concept to go deeper }}" href="/concepts/{{ slug }}" />
  <Card title="{{ Next tutorial or guide }}" href="/guides/{{ slug }}" />
</Cards>
