{/*
  PRODUCTION / OPERATIONS TEMPLATE. Standard: EDS-022. Reader: a team ALREADY shipping.
  Failure modes and verification are the point — not a feature walkthrough. Components illustrative (EDS-016).
*/}
---
title: {{ The operational concern, e.g. "Graceful shutdown" / "Deploying to Docker" }}
description: {{ 120–160 chars — the day-2 concern this page makes safe }}
---

## The concern

{{ Open with the operational reality — the failure, latency, or cost the reader faces in production, in their terms (EDS-005). Not "the framework provides…". }}

## Why it matters in production

{{ What goes wrong without doing this right — under load, on failure, over time. Concrete. }}

## Recommended setup

{{ The recommended production configuration and WHY. Runtime-honest — say which runtime each claim applies to (EDS-022). }}

```ts title="{{ file }}"
// {{ complete, runnable production configuration (EDS-013) }}
```

## Configuration

{{ Every knob: recommended prod value, default, and the CONSEQUENCE if it's wrong (EDS-022). }}

| Setting | Recommended | Default | If wrong |
| ------- | ----------- | ------- | -------- |
| `{{ setting }}` | `{{ value }}` | `{{ default }}` | {{ blast radius }} |

## Verify it in production

{{ MANDATORY — how the reader CONFIRMS it works: a health probe that responds, a metric that appears, a log line, a load-test result. Prefer a real runnable check. }}

```bash
{{ e.g. curl -s localhost:8080/healthz | jq .status  → "ok" }}
```

## Failure modes

{{ THE core section (EDS-022). For each: the failure, the symptom, the mitigation. }}

| Failure | Symptom | Mitigation |
| ------- | ------- | ---------- |
| {{ e.g. SIGTERM mid-request }} | {{ dropped connections }} | {{ graceful drain with timeout }} |

## Security & cost

<Callout type="warning">
{{ Hardening (secrets, headers, least privilege, rate limits) and resource cost (memory, connections, cold starts) — a "works" config that's insecure or expensive is not production-ready (EDS-022). }}
</Callout>

## Go-live checklist

- [ ] {{ operational check the team runs before shipping }}
- [ ] {{ … }}

## Related

- [{{ Related production page }}](/production/{{ slug }}) · [{{ Concept }}](/concepts/{{ slug }})
