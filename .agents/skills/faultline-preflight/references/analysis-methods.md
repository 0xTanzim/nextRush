# Analysis Methods

Use methods as tools, not as labels to decorate a report.

## Thinking Partner: mental-model selection
Borrow the useful approach from thinking-partner: select only a few models that
fit the problem, apply them to the concrete system, and challenge assumptions.

- **First principles:** what must be true for this behavior to work?
- **Inversion:** what would reliably make this feature fail or become unsafe?
- **Second-order effects:** what happens after the immediate failure or mitigation?
- **Systems thinking:** feedback loops, shared dependencies, coupling, bottlenecks.
- **Base-rate check:** mundane causes such as config, timeouts, data drift and
  operator error often deserve attention before exotic scenarios.
- **Margin of safety:** what buffer exists for load, latency, storage and recovery?
- **Antifragility:** does the system learn safely from failures, or does a failure
  amplify future failures?

Do not list 150 mental models. Choose 2–4 and explain their application.

## Pre-mortem / prospective hindsight
Set a credible horizon and imagine a failure has occurred. Work backward to the
present-day assumptions, missing controls, decisions and warning signals that
made it possible. Balance internal/execution causes and external/dependency/user
causes. Include boring base-rate failures. Avoid fiction detached from evidence.

## FMEA-style failure analysis
For each operation/component: failure mode, cause, local effect, system effect,
existing control, detectability, mitigation and verification. Rank qualitatively;
do not imply precision from ordinal multiplication.

## STRIDE threat modeling
Apply to concrete trust boundaries and flows:
- Spoofing: impersonation or identity confusion.
- Tampering: unauthorized modification of data/code/messages.
- Repudiation: inability to prove an action occurred.
- Information disclosure: data exposure across users/tenants/logs.
- Denial of service: exhaustion or unbounded work.
- Elevation of privilege: crossing authorization boundaries.

Also inspect object-level authorization, tenant isolation, replay, confused deputy,
secrets, supply-chain and insecure defaults where applicable.

## State and invariant analysis
Write invariants such as "a paid order has exactly one fulfillment intent".
Enumerate states and legal transitions. Look for transitions that can be repeated,
concurrent, delayed, reordered, interrupted or performed by stale actors. Construct
explicit interleavings rather than saying "race condition" generically.

## Fault tree and failure chains
Start from a top-level loss (e.g. data corruption, duplicate charge, tenant leak).
Decompose necessary causes using AND/OR reasoning. Include common-cause failures
and recovery failure. Only retain chains with a plausible dependency path.

## STPA-inspired control analysis
Use where multiple controllers (user, scheduler, service, operator, automation)
can issue actions and timing/feedback matters. Identify unsafe control actions:
not provided, provided when unsafe, provided too early/late, or applied too long.

## Boundary and property-based analysis
Partition inputs into valid/invalid/equivalent classes; inspect min/max, just-over,
just-under, empty, missing, duplicate, malformed, Unicode and overflow boundaries.
Derive invariants and properties suitable for generated tests. Name the generator
or test framework only when evidence shows the stack uses it or as an optional
recommendation.

## Mutation testing
Ask whether the existing tests would fail if a condition were inverted, a return
value changed, a validation removed, or a side effect skipped. Mutation testing
measures test sensitivity; it does not discover every defect.

## Chaos/fault injection
Use only in controlled, isolated environments with explicit limits, abort criteria
and rollback. Preflight should propose experiments, not launch destructive chaos.
