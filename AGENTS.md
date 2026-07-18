# AGENTS.md — NextRush Engineering Constitution

## Mission

NextRush exists to eliminate accidental complexity from backend development.

Every decision must make applications easier to build, easier to understand, easier to maintain, and easier to scale. The framework should absorb complexity so application developers can focus on solving business problems.

Developer experience is a product feature, not a tradeoff.

---

# 1. Framework Philosophy

NextRush is measured by how much work developers **do not have to write**.

Always ask:

- Can the framework do this automatically?
- Can we remove configuration?
- Can we eliminate boilerplate?
- Can we reduce cognitive load?
- Can the common path become simpler?

Framework complexity is acceptable.

User complexity is not.

---

# 2. Developer Experience First

Every API should feel natural.

Optimize for:

- discoverability
- consistency
- readability
- predictable behavior
- excellent autocomplete
- minimal learning curve

The best API requires little documentation because it behaves exactly as developers expect.

---

# 3. Simplicity Over Cleverness

Prefer:

- explicit code
- simple architecture
- small APIs
- clear naming
- understandable implementations

Avoid:

- magic behavior
- unnecessary abstractions
- hidden side effects
- surprising APIs
- clever optimizations

Simple systems survive longer.

---

# 4. The Framework Owns Complexity

When choosing between:

- increasing framework complexity
- increasing application complexity

always choose framework complexity.

Users should build products—not framework infrastructure.

Internal sophistication should produce external simplicity.

---

# 5. Public API Is Sacred

Every exported API becomes a long-term commitment.

Before exposing anything publicly ask:

- Does this belong in the public API?
- Can users accomplish the same goal without exposing this?
- Will this still make sense in five years?

Internal implementations may change freely.

Public APIs evolve cautiously.

Smaller public APIs create more stable frameworks.

---

# 6. Architecture Before Code

Never implement before understanding the architecture.

Every component must have:

- one responsibility
- explicit boundaries
- minimal coupling
- high cohesion
- predictable behavior

Prefer composition over inheritance.

Prefer interfaces over assumptions.

Avoid architectural shortcuts.

---

# 7. Runtime Independence

The Web Platform is the foundation.

Every runtime is an implementation detail.

Node.js

Bun

Deno

Cloudflare Workers

Vercel Edge

AWS Lambda

Future runtimes

must all remain behind adapters.

Framework core must never depend on runtime-specific behavior.

---

# 8. Convention Over Configuration

Configuration is a cost.

Before adding configuration ask:

Can this be:

- inferred?
- detected?
- automated?
- standardized?

Never ask developers for information the framework already knows.

Smart defaults should solve the majority of use cases.

---

# 9. Clean Package Design

Every package is an independent product.

Every package must have:

- one clear purpose
- minimal dependencies
- stable public exports
- comprehensive documentation
- tests
- examples

Avoid packages becoming collections of unrelated features.

---

# 10. Internal Quality

Internal code should be easier to maintain than application code.

Requirements:

- small modules
- explicit responsibilities
- descriptive names
- no duplication
- clear dependency direction
- consistent architecture

Internal quality directly affects long-term framework velocity.

---

# 11. Performance Is a Feature

Performance matters.

Always consider:

- startup time
- memory usage
- bundle size
- tree shaking
- cold starts
- allocations
- async behavior

Measure before optimizing.

Never sacrifice API clarity for insignificant performance gains.

Optimize proven bottlenecks.

---

# 12. Errors Are Part of the API

Error messages should teach developers.

Every error should explain:

- what happened
- why it happened
- how to fix it

Development errors should maximize clarity.

Production errors should prioritize stability and security.

---

# 13. Documentation Is Part of the Feature

A feature is incomplete until documented.

Every feature should include:

- purpose
- architecture
- public API
- examples
- common use cases
- limitations
- tradeoffs
- migration notes (when applicable)

Documentation should teach concepts—not simply list methods.

Outdated documentation is a bug.

---

# 14. Testing Defines Trust

Claims require verification.

Support for a runtime, platform, or feature must be backed by automated tests.

Testing should include where appropriate:

- unit tests
- integration tests
- conformance tests
- runtime compatibility tests
- performance benchmarks

Never rely on assumptions.

---

# 15. Backward Compatibility

Breaking changes have long-term costs.

Before introducing one:

- verify it is necessary
- evaluate migration cost
- provide migration guidance
- batch breaking changes into major releases

Compatibility is easier to preserve than rebuild.

---

# 16. Engineering Discipline

Do not:

- duplicate logic
- leak abstractions
- expose internal implementation
- introduce unnecessary configuration
- create hidden global state
- tightly couple unrelated modules
- optimize without measurement
- over-engineer simple problems

Every abstraction must justify its existence.

Every line of code must earn its place.

---

# 17. Documentation and Examples Stay Synchronized

Examples are part of the public API.

Whenever behavior changes:

- update documentation
- update examples
- update migration guides
- update tests

Documentation should never lag behind implementation.

---

# 18. Long-Term Thinking

Every design decision should optimize for:

- maintainability
- extensibility
- readability
- operational simplicity
- developer productivity

Prefer the solution that will still be understandable and maintainable five years from now.

Short-term convenience must never create long-term technical debt.

---

# 19. Decision Filter

Before implementing any feature, ask:

1. Does this improve developer experience?
2. Does it reduce user work?
3. Can the framework automate it?
4. Can the public API become smaller or simpler?
5. Does it preserve architectural boundaries?
6. Does it improve long-term maintainability?
7. Will new users understand it without internal knowledge?
8. Is it fully documented?
9. Is it backed by automated tests?
10. Is it runtime independent?
11. Does it introduce unnecessary configuration?
12. Would we still choose this design five years from now?

If any answer raises significant doubt, redesign before implementation.

---

# 20. Specs Are the Source of Truth

NextRush uses OpenSpec (`openspec/`) for spec-driven development. It has two layers with
opposite lifecycles — confusing them is how the system rots.

- **`openspec/specs/` is TRUTH** — what the framework does *now*. A SMALL, STABLE set of
  capability specs (~16), one folder per durable capability (`router`, `node-adapter`, …).
  This is what we read. It must never grow one-folder-per-change.
- **`openspec/changes/archive/` is HISTORY** — why we did it. Disposable, gitignored local
  scratch; git commit history is the record, and durable decisions are promoted to `docs/RFC/`.

**The one rule:** a change **EDITS an existing capability's requirements** (ADDED / MODIFIED /
REMOVED). It does **not** create a new `specs/<capability>/` folder unless a genuinely new,
durable capability is born — a rare, justified decision.

Consequences that are non-negotiable:

- Capabilities are named after durable things (`router`), never after changes
  (`router-match-path-allocation-trim`, `*-fastpath`, `*-trim`, `*-cleanup`).
- Every capability spec carries a real `## Purpose` — never a "TBD - created by archiving" stub.
- Durable architectural decisions land in `docs/RFC/` **before** a change is archived, never
  only in a prunable archive.
- New packages, capabilities, and public-API/breaking changes are RFC-gated.

The capability registry and full governance live in `openspec/README.md`; the enforceable
per-artifact rules live in `openspec/config.yaml`. When either drifts from the code, the code
wins — fix the docs.

---

# Principle

NextRush succeeds when developers spend less time learning the framework and more time building their applications.

Every contribution should move the framework toward greater simplicity, stronger architecture, lower cognitive load, and a better developer experience.
