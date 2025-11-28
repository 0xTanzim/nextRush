---
applyTo: '**'
---

# Code Refactoring & Engineering Standard — Final (Fortune‑100 Grade)

This document is the single source of truth for how we design, write, review, ship, and evolve code. It reflects production practices used in large, mature engineering organizations while staying pragmatic for everyday developer flow.

---

## Executive summary

- Make code easy to read, safe to change, and cheap to operate.
- Prefer small, well‑named units of work over large, clever ones.
- Build for observability, testability, and incremental change.
- Automate quality gates in CI so human reviewers focus on design and correctness.

---

## Core principles

- **Clarity over cleverness.** Code should communicate intent first.
- **Design for change.** Assume requirements will change; make change low‑cost.
- **Single Responsibility.** Functions, classes, and modules should have one reason to change.
- **High cohesion, loose coupling.** Group by domain and responsibility; avoid global coupling.
- **Fail fast and fail clearly.** Validate inputs and surface errors with context.
- **Automate checks.** Use linters, type checks, static analysis, tests, and security scans.

---

## Files, modules, and repo layout

- Keep files under **500 lines**. Aim for 200–400 for maintainability.
- Group code by **feature/domain** (e.g., `orders/`, `billing/`) rather than technical layer alone.
- Each file should serve one domain responsibility and one abstraction level.
- Prefer small packages/modules with explicit public APIs.
- Keep repository-level conventions documented (`README.md`, contribution guide).

---

## Functions & methods

- Keep functions short (target: **<= 40 lines**). Exceptions require justification in comments.
- One responsibility per function. If you must do two things, extract a helper.
- Prefer pure functions for business logic; isolate I/O and side effects.
- Avoid deep nesting: use guard clauses, early returns, or strategy extraction.
- Minimize parameter lists. Use parameter objects or builders for >3 parameters.
- Avoid boolean arguments that alter behavior. Replace with strategy objects or separate functions.

**Static thresholds (guidelines, enforced via CI if desired):**

- Max function length: 60 lines (recommend 40)
- Max cyclomatic complexity: 10
- Max file length: 500 lines
- PR size: Prefer <400 lines of changes — break large changes into incremental PRs

---

## Naming, comments, and documentation

- Name by intent: `calculateInvoiceTotal` not `doCalc`.
- Comments explain _why_ or tradeoffs, not _what_ the code does.
- Public module APIs must include docstrings/comments explaining contracts and side effects.
- Maintain up‑to‑date CHANGELOG entries for design changes that affect consumers.

---

## Logging, monitoring & observability

- Log at appropriate levels (DEBUG / INFO / WARN / ERROR). Include context and identifiers.
- Do not log PII, secrets, or large binary blobs.
- Emit structured logs (JSON) for automated ingestion.
- Add meaningful metrics: counters, histograms, and gauges for important flows.
- Ensure traces propagate (trace IDs) across service boundaries.
- Add health checks and readiness probes for services.

---

## Error handling & resilience

- Validate inputs early and return clear errors.
- Use typed error objects or custom error classes — include an error code and human message.
- Apply defensive programming for external/unstable inputs.
- Retry with backoff for transient faults; use idempotency tokens for at‑most‑once semantics.
- Use resilience patterns: circuit breakers, bulkheads, timeouts.

---

## Security & secrets

- Never commit secrets. Use a secrets manager (HashiCorp Vault, AWS Secrets Manager, etc.).
- Run dependency vulnerability scans and update regularly.
- Use least privilege for service accounts and IAM roles.
- Sanitize and validate all external inputs to avoid injection attacks.
- Keep libraries and runtimes up to date with security patches.
- Produce an SBOM for releases where possible.

---

## API design & compatibility

- Design clear, stable contracts for public APIs. Use semantic versioning for breaking changes.
- Prefer backward‑compatible changes and deprecation windows.
- Use contract testing between services (consumer‑driven contracts).
- Provide OpenAPI/Swagger for HTTP APIs and publish client SDKs where useful.
- Document error formats, rate limits, and expected latencies.

---

## Data & schema evolution

- Migrate schemas incrementally; design migrations to be backward and forward compatible.
- Use feature flags and dual reads/writes during migrations when necessary.
- Version event schemas and include schema validation.
- Avoid destructive migrations during business hours.

---

## Testing & quality gates

- Tests should exist at unit, integration, and contract levels. Automate them in CI.
- Use fixtures and deterministic test data. Avoid flaky tests.
- Use static analysis tools, linters, and type checks (TypeScript/Pyright, mypy, etc.).
- Enforce quality gates: failing tests, type errors, or high‑severity lint violations block merges.
- Track test coverage trends; prefer meaningful tests over aiming for an arbitrary coverage number.

---

## CI / CD & release practices

- Automate builds, tests, linting, and security scans in CI on every PR.
- Enforce protected branches and require passing checks for merges.
- Use semantic versioning and automated changelog generation where possible.
- Prefer trunk‑based development or small short‑lived feature branches.
- Deploy with incremental strategies: canary, blue/green, or feature flags.
- Have automated rollback procedures and runbook links in PRs.

---

## Performance & cost

- Measure before optimizing. Use benchmarks and profiling tools.
- Set performance budgets for critical flows.
- Cache with invalidation strategy (e.g., TTLs, versioned keys) — avoid stale caches.
- Watch cloud cost metrics and set budget alerts.

---

## Observability for production readiness

- Each service must expose metrics, health checks, and structured logs.
- Define SLOs and SLIs for critical user journeys. Track error budgets.
- Maintain runbooks for common incidents (deploy failure, DB connectivity, high latency).
- Post-mortems for incidents: document root cause, impact, and actions with owners and deadlines.

---

## Dependency & build hygiene

- Pin production dependencies or use lockfiles to ensure reproducible builds.
- Periodically upgrade dependencies and test the upgrade in a staging environment.
- Avoid shadowing or republishing transitive dependencies unintentionally.
- Use minimal runtime images and remove build tools from production artifacts.

---

## Architecture & design governance

- Prefer small bounded contexts and clear service boundaries.
- Document domain models and invariants in shared design docs.
- Hold architecture review for cross-cutting changes (security, data model, infra).
- Keep a living architecture board: diagrams, APIs, ownership, and contracts.

---

## Refactoring patterns & when to use them

Apply these standard refactors when corresponding smells appear. Include a brief reason and benefit.

- **Extract Method / Function** — when a function is long or mixes levels of abstraction. Improves readability and testability.
- **Extract Class / Module** — when a class has multiple responsibilities or helper methods are cohesive. Improves modularity and reuse.
- **Introduce Parameter Object** — when many parameters are passed together frequently. Simplifies call sites and documents intent.
- **Replace Conditional with Polymorphism** — when conditionals dispatch behavior. Makes behavior extensible and easier to test.
- **Strategy Pattern** — when multiple algorithms are selected at runtime. Improves open/closed and test isolation.
- **Move Method / Move Field** — when behavior or data belongs to another class. Reduces feature envy and coupling.
- **Encapsulate Field** — when direct field access causes invariant breaks. Centralizes validation and mutation logic.
- **Decompose Conditional** — break complex if/else chains into smaller predicates or strategy objects.
- **Introduce Guard Clauses** — replace nested conditionals to simplify flow and reduce indentation.
- **Replace Magic Number/String with Constant** — improves discoverability and makes global changes safe.

For each pattern used in a PR, include a short note describing the smell and why the chosen pattern fixes it.

---

## Code review & PR checklist

Reviewers should verify:

- Code implements one concept or small cohesive change.
- Names and interfaces are clear and stable.
- No duplication introduced.
- Error handling and logging are present.
- No secrets are present in diffs.
- Tests cover new behavior and important edge cases.
- CI checks pass and performance/security scans show no new critical issues.

Reviewer guidance:

- Prefer asking for small followups rather than large rewrites during review.
- Suggest incremental steps when a full refactor is risky.

---

## Operational readiness & runbooks

- Every service must include a runbook with common failure modes and how to mitigate them.
- Document how to roll back, how to inspect logs/metrics, and escalation contacts.
- Keep runbooks in the repo or in an accessible knowledge base and link them from PRs.

---

## Governance & ownership

- Every module/service must have an owner and a documented maintenance plan.
- Define review owners for critical directories.
- Schedule periodic architecture debt sprints and dependency audits.

---

## Additional best practices (practical checklist)

- Use type systems and static typing everywhere possible.
- Avoid premature optimization; measure first.
- Prefer composition and small pure helpers over large inheritance hierarchies.
- Keep public module surface area minimal. Fewer exported functions means fewer breaking changes.
- Automate mundane tasks: lint, format, typecheck, test, security scan.
- Make changes reversible: feature flags, short-lived branches, and incremental rollouts.

---

## How to use this document

- Keep it alive. Update it when we learn better ways.
- Use it during design reviews, PR reviews, and onboarding.
- Use the prompting rules (previous version) when asking an AI to help refactor.

---

## References & further reading

- "Clean Code" by Robert C. Martin
- "Refactoring" by Martin Fowler
- "Designing Data-Intensive Applications" by Martin Kleppmann
- "The Pragmatic Programmer" by Andrew Hunt and David Thomas
- "Site Reliability Engineering" by Google SRE Team

- ["https://refactoring.guru/refactoring/catalog"](https://refactoring.guru/refactoring/catalog)

_End of final standard._
