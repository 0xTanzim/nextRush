{/*
  ARCHITECTURE PAGE TEMPLATE — deep Diátaxis "explanation". Standard: EDS-010. Flow: EDS-006 (expanded on mechanics/decisions).
  Audience: engineers who want internals & reasoning. The "Engineering decisions" section is the point of the page.
*/}
---
title: {{ "___ Architecture" — the system/component }}
description: {{ 120–160 chars — the internal design this covers }}
---

## Overview

{{ The architectural problem and why understanding it is valuable. Big picture, not implementation detail (EDS-010). }}

## Design goals & constraints

{{ The goals (simplicity, performance, runtime independence, tiny API) AND the constraints (zero-dep core, multi-runtime) — because constraints are why obvious alternatives were rejected. }}

## Architecture overview

```mermaid
flowchart TB
  {{ high-level system diagram — build from overview to detail; one idea per diagram (EDS-012) }}
  Application --> Middleware --> Router --> Handler --> Adapter --> Runtime
```

{{ Explain the diagram before going deeper. }}

## Component responsibilities

{{ For each major component: what it owns, what it does NOT own, what depends on it, what it depends on (EDS-010). Clear boundaries are the whole value. }}

## Data flow

```mermaid
sequenceDiagram
  {{ sequence diagram where order matters — the request/response lifecycle }}
```

## Engineering decisions

{{ THE core section (EDS-010). For each major decision: }}

### {{ Decision }}
- **Chosen:** {{ what }}
- **Alternatives considered:** {{ what }}
- **Why rejected:** {{ reasoning }}
- **Trade-off accepted:** {{ cost }}

## Trade-offs

{{ Honest strengths and weaknesses of the design as a whole. }}

## Performance

{{ Architectural impact — allocations, hot paths, cold start — tied to real measurement where claimed (EDS-013). }}

## Failure scenarios

{{ How the system behaves when things go wrong: plugin throws, config invalid, runtime misbehaves. }}

## Evolution

{{ Extension points, stable interfaces, how the design grows. }}

## Related

- [{{ Concept }}](/concepts/{{ slug }}) · [{{ RFC / ADR }}]({{ link }}) · [{{ Reference }}](/reference/{{ slug }})
