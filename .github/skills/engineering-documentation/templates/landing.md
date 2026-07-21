{/*
  LANDING / OVERVIEW TEMPLATE. Standard: EDS-018. Job: orient + ROUTE in 30 seconds.
  A landing page is an airport, not a README: Where am I? · Is this right for me? · What can I
  build? · Where do I go next? It is the NAVIGATION HUB for the whole doc system — it explains how
  the page types fit together. Scanned, not read: no intro essay, no API table. Route, don't teach.
*/}
---
title: {{ Product / section name }}
description: {{ 120–160 chars — the value proposition, benefit-first }}
---

# {{ Name }}

> {{ One-line value proposition a skimmer grasps instantly — concrete, not marketing (EDS-004).
     e.g. "Minimal, multi-runtime HTTP framework with a zero-dependency core." }}

## Why {{ Name }}

{{ Engineering reasons, not marketing — a few tight bullets. }}
- {{ Small core }} · {{ Composable }} · {{ Multi-runtime }} · {{ Explicit }} · {{ Type-safe }}

## Quick facts

| | |
| --- | --- |
| Latest | `{{ x.y.z }}` |
| Runtimes | {{ Node · Bun · Deno · Edge }} |
| Module format | {{ ESM-only }} |
| Requirements | {{ Node >= 22 }} |
| Dependencies | {{ Zero-dependency core }} |
| Language | {{ TypeScript }} |
| License | {{ MIT }} |

## Who is this for?

**Choose {{ Name }} if you want:**
- ✓ {{ … }}

**Not a fit if you want:**
- ✗ {{ e.g. a full-stack React framework · low-code · convention-over-configuration }}

## Quick start

{{ THE most important element — the full journey to a working server in under two minutes. }}

```bash
{{ install }}
```

```ts title="app.ts"
// {{ smallest working example — complete and runnable (EDS-013) }}
```

```bash
{{ run }}   # → visit http://localhost:8080
```

**Most developers learn next:** [Routing](/docs/concepts/routing) → [Middleware](/docs/concepts/middleware) → [Context](/docs/concepts/context).

## What can you build?

{{ Outcomes, not features — help developers picture using it. }}
- ✓ {{ REST APIs · microservices · WebSocket services · edge services · internal tools }}

## Documentation roadmap

{{ The single most important addition — explain how the doc system fits together. }}

```text
Start Here
   │
   ▼
Tutorials  → Learn by building
Concepts   → Understand the ideas
Guides     → Accomplish specific tasks
Recipes    → Copy production-ready solutions
Reference  → Look up APIs
Architecture → Understand internals
```

## Learning paths

{{ Different readers, different routes. }}
<Cards>
  <Card title="🟢 New here" href="/docs/start">
    Tutorial → Concepts → Guides
  </Card>
  <Card title="🟡 Building an API" href="/docs/concepts/routing">
    Routing → Middleware → Validation
  </Card>
  <Card title="🔵 Migrating" href="/docs/migrate">
    Coming from {{ Express · Fastify · Hono }}? Start here.
  </Card>
</Cards>

## Core concepts

<Cards>
  <Card title="Routing" href="/docs/concepts/routing" />
  <Card title="Middleware" href="/docs/concepts/middleware" />
  <Card title="Context" href="/docs/concepts/context" />
  <Card title="Extensions" href="/docs/concepts/plugins" />
</Cards>

## Popular guides

<Cards>
  <Card title="{{ Build a REST API }}" href="/docs/guides/{{ slug }}" />
  <Card title="{{ Authentication }}" href="/docs/guides/{{ slug }}" />
</Cards>

## Popular recipes

<Cards>
  <Card title="{{ JWT auth }}" href="/docs/recipes/{{ slug }}" />
  <Card title="{{ Rate limiting }}" href="/docs/recipes/{{ slug }}" />
</Cards>

## Reference & architecture

<Cards>
  <Card title="API reference" href="/docs/reference">
    Looking for a specific API? Go straight here.
  </Card>
  <Card title="Architecture" href="/docs/internals">
    Framework internals, engineering decisions, performance.
  </Card>
</Cards>

## Examples

{{ Complete example apps — developers love these. }}
<Cards>
  <Card title="{{ REST API }}" href="{{ link }}" />
  <Card title="{{ Auth server }}" href="{{ link }}" />
</Cards>

## Community

<Cards>
  <Card title="GitHub" href="{{ link }}" />
  <Card title="RFCs" href="{{ link }}" />
  <Card title="Contributing" href="{{ link }}" />
  <Card title="Changelog" href="{{ link }}" />
</Cards>
