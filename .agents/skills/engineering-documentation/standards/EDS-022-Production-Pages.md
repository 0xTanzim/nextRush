# EDS-022 — Production & Operations Pages

> A production page serves a team that is *already shipping* and now has to run the thing reliably: deploy it, observe it, secure it, scale it, tune it. Its reader isn't learning the framework — they're operating it, often under pressure, sometimes at 2am.

Production pages are the **day-2** layer (the "Evolve" content layer, EDS-002). They're close cousins of Guides (both are how-to), but the audience and stakes differ enough to warrant their own standard: a Guide adds a *feature*; a production page keeps a *system healthy in the real world*.

---

## Production vs. Guide

| | Guide (EDS-009) | Production (EDS-022) |
|---|---|---|
| Reader | Building a feature | Operating a running system |
| Question | "How do I add X?" | "How do I run X safely in prod?" |
| Stakes | It works locally | It survives real traffic, failures, and attackers |
| Emphasis | The happy path | Failure modes, limits, defaults, verification |

A guide's "Production considerations" section is a *paragraph*; a production page is that section made the whole point.

## Structure — the canonical production page

Written for an **on-call engineer**, not a developer. ⭐ marks the SRE-facing sections most framework docs skip:

```text
Production problem ⭐ → Production goals ⭐ → Where this fits ⭐ → Recommended setup (sized)
   → Environment variables ⭐ → Configuration → Verification ⭐ → Observability ⭐ → Performance ⭐
   → Failure modes ⭐ → Recovery ⭐ → Scaling ⭐ → Security ⭐ → Operational limits ⭐
   → Deployment targets ⭐ → Go-live checklist → Runbook ⭐ → Related
```

The additions that make it operational, not developer-facing:

- **Production goals** ⭐ — what the config optimizes for (zero-downtime, predictable latency, easy rollback), so each setting has a reason.
- **Environment variables** ⭐ and **Configuration** with **Required?** and an **If wrong** blast-radius column.
- **Verification** ⭐ = health → logs → metrics → traffic, plus a load test — a real runnable check, not prose.
- **Observability** ⭐ = logs + metrics + **alerting** (what pages someone). Production without it isn't production-ready.
- **Failure modes** ⭐ are SRE-shaped: **Failure → Detection → Impact → Recovery**.
- **Recovery** ⭐ is its own section, distinct from mitigation, and includes **rollback** and **disaster recovery** (dependency down → retry → circuit-break → degrade).
- **Scaling · Operational limits · Deployment targets** ⭐ — boundaries and per-target notes.
- **Runbook** ⭐ — the 2am "if X → do Y" list, plus a **Don't** callout (no root, no infinite shutdown timeout, no hardcoded secrets, no debug logging in prod).

## Think like an on-call engineer

The page must let the reader answer: **will this survive failure · how do I know it's healthy · how do I know it's unhealthy · how do I recover · how do I deploy safely · how do I monitor it · how do I scale it.** If those seven are answerable after reading, the page has done its job. Production is a distinct documentation category — its audience isn't learning the framework, it's keeping a real system up under load, during failure, and across deploys.

## Rules specific to production pages

- **Lead with the operational reality, not the framework.** "Under load, an unbounded connection pool exhausts the database" — the reader operates systems and thinks in failure, latency, and cost, not in API surface (EDS-005).
- **Every setting has a safe default and a stated blast radius.** Show the recommended production value, what it defaults to, and what happens if it's wrong. A production reader needs to know the *consequence* of each knob, not just its existence.
- **Verification is mandatory.** How does the reader *confirm* it's working in prod — the health check that responds, the metric that appears, the log line, the load-test result? A production page that can't be verified is a hope, not a procedure. Prefer a real, runnable check (a `curl`, a Dockerfile that builds, a probe) over prose (EDS-013).
- **Failure modes are the core, not an aside.** What happens on OOM, on a dependency timeout, on SIGTERM mid-request, under a traffic spike? Name the failure, the symptom, and the mitigation. This is the section the reader came for.
- **Security and cost are first-class.** Hardening (headers, secrets, least privilege, rate limits) and resource cost (memory, connections, cold starts) belong on every relevant production page — a "works" config that's insecure or ruinously expensive isn't production-ready (project-rules security boundaries apply).
- **Be runtime-honest.** Deployment and operational behavior differ across Node/Bun/Deno/edge/serverless — say which runtime a claim applies to; don't imply a single answer where the runtimes genuinely diverge.
- **End with an operational checklist** the reader can run down before (and after) going live — the deliverable a shipping team actually uses.

## Anti-patterns

- A feature tutorial wearing a "Production" title (that's a Guide/Tutorial).
- "It works on my machine" — a happy path with no failure modes, no limits, no verification.
- Settings listed with no recommended value, default, or consequence.
- Security or cost hand-waved or omitted.
- A single answer where runtimes actually differ.
- Benchmark numbers with no reproducible method (EDS-013) — an unverifiable claim under a "production" banner is worse than none.

## Success

A team ships to production using the page alone, knows how to confirm it's healthy, knows what will break and how it'll behave when it does, and has hardened it against the obvious security and cost failures. The page reads like a senior SRE handing over a runbook — practical, honest, and focused on *staying up*.
