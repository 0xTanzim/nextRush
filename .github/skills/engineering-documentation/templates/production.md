{/*
  PRODUCTION / OPERATIONS TEMPLATE. Standard: EDS-022. Day-2 operations.
  Write for an ON-CALL ENGINEER, not a developer. The page must answer: will this survive failure? ·
  how do I know it's healthy? · how do I know it's unhealthy? · how do I recover? · how do I deploy
  safely? · how do I monitor it? · how do I scale it? Failure modes, observability, recovery, and a
  runbook are the point — not a feature walkthrough. Be runtime-honest. Components illustrative.
*/}
---
title: {{ The operational concern, e.g. "Graceful shutdown" / "Deploying to production" }}
description: {{ 120–160 chars — the day-2 concern this page makes safe }}
---

## The production problem

{{ The operational reality the reader faces — the failure, latency, or cost — in their terms (EDS-005). }}

## Production goals

{{ What this setup optimizes for, so the config has a reason to exist. }}
- ✓ {{ e.g. Zero-downtime deploys · predictable latency · graceful shutdown · easy rollback }}

## Where this fits

{{ A tiny diagram of where this concern sits in the running system — production changes behavior. }}

```text
Request → Router → Middleware → Handler → (shutdown / adapter)
```

## Recommended setup

{{ Not every deployment is identical — size it. }}
- **Minimum (small API):** {{ … }}
- **Medium:** {{ … }}
- **Large scale:** {{ … }}

```ts title="{{ file }}"
// {{ complete, runnable production configuration (EDS-013) }}
```

## Environment variables

| Variable | Required | Default | Purpose |
| -------- | -------- | ------- | ------- |
| `{{ PORT }}` | {{ Yes }} | `{{ 8080 }}` | {{ … }} |
| `{{ SHUTDOWN_TIMEOUT }}` | {{ No }} | `{{ 10s }}` | {{ … }} |

## Configuration

| Setting | Required | Recommended | Default | If wrong |
| ------- | -------- | ----------- | ------- | -------- |
| `{{ setting }}` | {{ Yes/No }} | `{{ value }}` | `{{ default }}` | {{ blast radius }} |

## Verification

{{ MANDATORY — prove it's healthy: health → logs → metrics → traffic. Prefer real runnable checks. }}

```bash
curl -s localhost:8080/healthz | jq .status   # → "ok"
```

Load-test before trusting it: `{{ k6 run … / autocannon … / wrk … }}`.

## Observability

{{ Production without observability isn't production-ready. }}
- **Logs:** {{ what to emit — access, warn, error; structured; no secrets }}
- **Metrics:** {{ request count · latency (p50/p99) · error rate · memory · open connections }}
- **Alerting:** {{ page on — 5xx rate · p99 latency · memory · crash-loop · failed health checks }}

## Performance

{{ Expected latency/throughput characteristics, plus resource usage: memory, CPU, connections,
   file descriptors, cold starts — the operational cost the team budgets for. }}

## Failure modes

{{ THE core section, SRE-shaped. }}

| Failure | Detection | Impact | Recovery |
| ------- | --------- | ------ | -------- |
| {{ SIGTERM mid-request }} | {{ dropped-connection metric }} | {{ failed requests }} | {{ graceful drain + timeout }} |

## Recovery

{{ Procedures, distinct from mitigation. }}
- **Crash / restart:** {{ restart → reconnect → drain }}
- **Rollback:** {{ deploy → detect regression → roll back → verify — many outages happen here }}
- **Disaster (dependency down):** {{ retry → circuit-break → degrade → recover }}

## Scaling

- **Horizontal:** {{ stateless requirement, session/state externalization (Redis, etc.) }}
- **Vertical:** {{ when it helps, when it doesn't }}

## Security

{{ Separate concerns, not one paragraph (project-rules boundaries apply). }}
- **Secrets:** {{ never committed; from env/secret store }}
- **Least privilege:** {{ non-root, minimal scopes }}
- **TLS:** {{ terminate where, enforce HTTPS }}
- **Headers / rate limits:** {{ security headers, public-endpoint throttling }}

## Operational limits

{{ Boundaries, not exact numbers — where the setup stops being safe. }}
- {{ e.g. ~N req/s per instance · connection ceiling · payload size cap }}

## Deployment targets

{{ How it differs per target. }}
- {{ Docker · systemd · Fly · Railway · Kubernetes — the per-target note that matters }}

## Go-live checklist

- [ ] {{ config }} · [ ] {{ observability wired }} · [ ] {{ alerts set }} · [ ] {{ rollback rehearsed }} · [ ] {{ load-tested }}

## Runbook

{{ What operations teams actually reach for at 2am. }}
- **Deployment fails →** {{ roll back to previous release }}
- **Health checks fail →** {{ restart; check dependency X }}
- **Shutdown hangs →** {{ SIGKILL after timeout; investigate open connections }}

<Callout type="warn">
**Don't:** run as root · use an infinite shutdown timeout · hardcode secrets · leave debug logging on in prod.
</Callout>

## Related

- [{{ Related production page }}](/docs/production/{{ slug }}) · [{{ Concept }}](/docs/concepts/{{ slug }})
