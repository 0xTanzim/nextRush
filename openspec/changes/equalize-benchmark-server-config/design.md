# Design — Equalize benchmark server configuration

## Context

The harness already validates *observable output* (bodies, status, `Content-Type`, middleware
headers, `Content-Length`/`Transfer-Encoding` framing). It validates nothing about *how each server
is constructed*. Every asymmetry found in the audit lived in that blind spot: handler shape, listen
backlog, and middleware-layer count are all invisible to a response-parity check.

The structural lesson is that "fairness" was enforced on the wrong axis. Response parity proves the
servers do the same *work*; it cannot prove they were given the same *conditions*.

## Decisions

### D1 — Equalize the backlog UPWARD to 1024, not down to 511

Two defensible options:

| Option | Argument | Rejected because |
| --- | --- | --- |
| Force NextRush to 511 in the benchmark | Measures all six at the ecosystem default | Measures a NextRush that nobody deploys — the shipped default is 1024, so this understates the real product |
| **Give all six 1024 (chosen)** | Every server gets the same accept queue; the variable under test stays request-handling, not TCP tuning | — |

1024 is also within every competitor's reach in one argument, so this is not a NextRush-specific
capability being generously extended to others — it is removing a difference that was never the
point of the comparison.

The framework default in `@nextrush/adapter-node` is untouched (Non-Goal). Note the asymmetry this
creates in reporting duty: because the benchmark now *overrides* the competitors' defaults, the
report must state that it does so, or it trades a hidden advantage for a hidden intervention.

### D2 — Sync handlers, because five of six already are

`async` on a handler that performs no `await` is pure overhead — a promise and a state machine per
request for nothing. Fastify's own docs use `async` widely, so the current code is defensible as
"idiomatic," but *idiomatic* and *like-for-like* diverge here, and these three scenarios are labeled
like-for-like. Where a handler genuinely awaits (Hono's `await c.req.json()`, body-reading paths),
`async` stays — removing it there would change behavior, not overhead.

### D3 — Disclosure is part of the fix, not a follow-up

An equalization that is not printed is indistinguishable from the bug it replaced: a future edit
re-introduces the skew and nothing catches it. Therefore the report gains a per-server config table
(backlog, handler style) and `validate-parity.js` gains a **hard assertion** on backlog agreement.
An assertion is chosen over a printed warning because the existing `Content-Length` framing check
established the precedent that a fairness violation *fails the run* rather than annotating it.

### D4 — Irreducible asymmetries are documented, not faked

Express's only idiom for `express.static` is `app.use([mount], …)`; Hono's is
`app.use('/static/*', …)`. Neither offers a zero-cost route registration equivalent to
`@fastify/static`'s or NextRush's. Forcing an artificial hand-rolled static handler onto them to
equalize the last ~1% would replace a small measured asymmetry with an unrepresentative server that
no user would write. The residual is documented per-server instead. Honest disclosure of a known
small bias beats a contrived equality.

### D5 — Saturation is a precondition for interpreting any result, so it is measured here

The performance-gate spec already requires that a c128+ number be accompanied by a saturation check
before backing a conclusion, and the existing profiling run measured 99.95%+ event-loop utilization
at only 64 connections. This change measures CPU idle share and GC event count directly so the
re-measurement can state whether the servers were saturated rather than assuming it. If the servers
are *not* saturated at the tested concurrency, throughput differences are bounded by the client or
the loopback, not by framework CPU — which would invalidate framework-CPU conclusions drawn from
those numbers, including favourable ones.

## Risks / Trade-offs

| Risk | Severity | Mitigation |
| --- | --- | --- |
| NextRush's published position gets worse | Expected, not a risk to mitigate | Stated as an explicit Non-Goal outcome; ships as measured |
| Overriding competitors' default backlog is itself an intervention | Medium | D1 requires it be printed in the report; a silent override would be the same class of defect as the original |
| Removing `async` changes Fastify behavior | Low | Only removed where no `await` exists; `bench:validate` proves byte-identical responses |
| A future edit silently re-skews config | Medium | D3's hard parity assertion fails the run |
| Backlog 1024 exceeds a container's `somaxconn` in CI | Low | Host `somaxconn` is 4096; the value is clamped by the OS rather than erroring, and the assertion compares *agreement* between servers, not an absolute number |

## Rollback Plan

Blast radius: reversibility `trivial` (0) — benchmark-harness-only, no framework code, no persisted
state; scope `single_module` (1); detectability `immediate_test_failure` (0) — `bench:validate`
fails loudly on any response divergence. **Total: 1 → auto-apply.**

### Triggers — revert if any occurs

1. `bench:validate` parity fails and is not resolved in-session.
2. Any server fails to start, or its backlog does not read back as expected via `ss -tln`.
3. Fastify's responses change in any way (body, status, headers) after de-async.
4. The new parity assertion produces a false positive against a legitimately-equal configuration.

### Procedure

```bash
git revert --no-edit <sha>
cd apps/benchmark && node scripts/validate-parity.js     # must print Parity OK
```

No rebuild is required — `apps/benchmark` runs its servers from source, and no framework package is
touched by this change. This is the one way its rollback is *simpler* than the preceding
`elide-resolved-promise-allocation` change, which did require `pnpm --filter @nextrush/core build`.

**Partial rollback:** the three fixes are independent. The Fastify de-async (A-1), the backlog
equalization (A-2), and the disclosure/assertion (D3) can each be reverted alone. Reverting only
A-1 restores Fastify's handicap and is therefore the *least* acceptable partial revert — prefer
reverting the whole change over keeping A-2/D3 while dropping A-1.

## Migration

None. Benchmark harness only. Previously published rankings from affected runs are withdrawn, not
migrated.
