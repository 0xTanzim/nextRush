# EDS-010 — Architecture Pages

> An architecture page reveals how the system works inside and — more importantly — **why it was built that way.** Its audience is engineers who want to understand, extend, debug, or contribute to the framework, not use its public API.

Architecture pages are deep Diátaxis *explanation*. The most valuable thing they teach is not which class calls which method, but the *reasoning and trade-offs* that produced the design.

---

## Audience and goal

Assume the reader knows the basics, understands backend development, and wants framework internals — to contribute, to debug, or simply to understand deeply. The page's job is to answer *"why was this designed this way?"* far more than *"how does it work?"* Implementation details are cheap; the reasoning behind them is what transfers.

## Structure — the canonical architecture page

An architecture page is an ADR + internal design doc. Most of it is about *reasoning*, not implementation. ⭐ marks the sections that carry that reasoning:

```text
Architectural problem ⭐ → Requirements & constraints ⭐ → Design principles ⭐
   → Architecture overview → Component boundaries ⭐ → Request lifecycle → Component lifecycle ⭐
   → Engineering decisions ⭐ → Architectural invariants ⭐ → Failure scenarios ⭐
   → Concurrency model ⭐ → Performance characteristics ⭐ → Security boundaries ⭐
   → Extensibility ⭐ → Rejected alternatives ⭐ → Architecture validation → Evolution
   → Future improvements → Related
```

The load-bearing additions:

- **Start with the problem**, not the overview — every architecture exists to solve one.
- **Requirements & constraints** (not goals): "must support Node/Bun/Deno/Edge · zero-dep core · ESM-only" — these *explain* every later decision.
- **Component boundaries** ⭐ — for each component: **owns · does NOT own · depends on · used by · owns-state**, plus the legal **dependency direction**. Prevents drift.
- **Engineering decisions** are ADR-shaped: **Problem → Decision → Alternatives → Trade-offs → Consequences**.
- **Architectural invariants** ⭐ — the constitution: rules that must never break ("router immutable after `ready()`", "Context is request-scoped", "core imports no runtime API"). The single most valuable section for contributors.
- **Failure scenarios** = Failure → Detection → Recovery; **Concurrency model** = what's safe to share across requests.
- **Rejected alternatives** get their own section — valuable history.
- **Architecture validation** — how the design is protected from regression (conformance, golden, benchmark, regression tests).

**No generic "Trade-offs" section.** Trade-offs and consequences live *inside each engineering decision*, which keeps the page cohesive — a standalone trade-offs list just duplicates them.

Three diagrams, three questions (EDS-012): a **system** diagram (overview), a **dependency** diagram (component boundaries), and a **sequence** diagram (request lifecycle). One idea per diagram.

## Rules specific to architecture pages

- **The "Engineering decisions" section is the point of the page.** For each major decision: what was chosen, which alternatives were considered, why they were rejected, and the trade-off accepted. This is where you teach how the team *thinks* (EDS-005).
- **Constraints explain the design.** Zero-dependency core, multi-runtime support, a tiny public API, type safety — state them early, because they're why obvious-looking alternatives were rejected.
- **Diagrams carry the load.** Architecture is inherently visual: system overview, sequence diagrams for flows, dependency/layer diagrams for structure. Build from a small overview to detail (EDS-012). One idea per diagram.
- **Define every boundary.** For each component: what it owns, what it does *not* own, what depends on it, what it depends on. Clear boundaries are the whole value of an architecture doc.
- **Include failure and evolution.** How does the system behave when a plugin throws, a runtime misbehaves, config is invalid? Where are the extension points and stable interfaces? Real architecture docs cover how the design *breaks* and how it *grows*, not just the happy path.
- **Explain internals, don't dump them.** Not every class — the load-bearing ones and how they relate. When this doc and the code disagree, the code wins; fix the doc.

## Anti-patterns

- API documentation, installation, or usage tutorials (wrong page type).
- Large code listings — architecture is about structure and reasoning, not line-by-line code.
- Implementation detail with no rationale ("it does X" without "because Y").
- Explaining every class instead of the important ones.
- Marketing language about how elegant the design is — show the reasoning, let the reader judge.

## Success

The reader finishes thinking *"I understand how this framework thinks,"* not *"I memorized which method calls which."* They can reason about how a change would ripple, where to extend safely, and why the design holds up — the mark of a doc that taught architecture, not code.
