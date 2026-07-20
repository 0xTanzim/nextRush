{/*
  LANDING / OVERVIEW TEMPLATE. Standard: EDS-018. Job: orient + route in 30 seconds.
  Front-load value and the quick start; route with cards. Components illustrative (EDS-016).
*/}
---
title: {{ Product / section name }}
description: {{ 120–160 chars — the value proposition, benefit-first }}
---

# {{ Name }}

> {{ One-line value proposition a skimmer grasps instantly — concrete, not marketing (EDS-004). }}

{{ 2–3 sentences: the problem it solves and who it's for. }}

## At a glance

{{ The facts a developer scans for — bullets or a small table. }}
- {{ e.g. Multi-runtime: Node · Bun · Deno · Edge }}
- {{ e.g. ESM-only · Node >= 22 }}
- {{ e.g. Zero-dependency core }}

## Quick start

{{ THE most important element (EDS-018): the fastest path to a working result, right here. }}

```bash
{{ install }}
```

```ts title="app.ts"
// {{ smallest working example — complete and runnable (EDS-013) }}
```

## Where to go next

{{ The core routing function — cards for each main audience (EDS-018). }}
<Cards>
  <Card title="New here — start the tutorial" href="/start/{{ slug }}" />
  <Card title="Building something — browse guides" href="/guides" />
  <Card title="Looking something up — API reference" href="/reference" />
  <Card title="How it works — architecture" href="/internals" />
</Cards>

{/* Optional: a SHORT highlights grid only if it earns its place — never a marketing feature-dump (EDS-018). */}
