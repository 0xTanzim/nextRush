# EDS-007 — Concept Pages

> A concept page answers one question: **"Why does this exist, and how should I think about it?"** It teaches understanding, not API surface and not step-by-step tasks.

Concept pages are Diátaxis *explanation* (EDS-002). They're the pages a reader returns to when they want to *understand* middleware, routing, DI, or the request pipeline — not to build something (that's a Guide) or look something up (that's Reference).

---

## What belongs here — and what doesn't

A concept page teaches one idea deeply: what it is, why it exists, how to think about it, how it fits the system, and its trade-offs. It is **not** a tutorial (no build-along project) and **not** a reference (no exhaustive API table). If you're documenting *how to accomplish a task*, that's a Guide; link to it, don't absorb it.

## Structure

Follow the universal flow (EDS-006), weighted toward the model and the trade-offs:

```text
Hook → Problem → Why simple approaches fail → Introduce the concept
   → Mental model → Visual → Internal mechanics → How it fits the framework
   → Production considerations → Trade-offs → Common mistakes → Related concepts
```

The two sections that make or break a concept page are **"why simple approaches fail"** and **mental model**. Skipping the first turns the concept into an unmotivated definition; skipping the second leaves the reader memorizing instead of understanding.

## Rules specific to concept pages

- **Lead with the problem, not the definition.** "Imagine 200 routes each needing auth and logging" beats "Middleware is a function that…" every time (EDS-005).
- **Build exactly one mental model** and make it visible with a diagram (EDS-012). One page, one model.
- **Explain the idea before naming it** (EDS-004) — the reader should meet the problem, feel it, and only then learn the term.
- **Keep code small.** A concept page shows just enough code to ground the idea; large examples belong in guides. If a block is teaching *how to do a task*, it's in the wrong page type.
- **Connect outward.** End by linking the related concepts and the guides that put this concept to work — a concept is a node in a graph (EDS-002).

## Anti-patterns

- Opening with a textbook definition or an API signature.
- An API dump (that's Reference).
- A build-along project (that's a Tutorial).
- Framework-specific detail before the general idea is clear.
- Multiple concepts crammed onto one page — split them.

## Success

The reader can explain the concept to a teammate in their own words, say when to use it and when not, and name one trade-off — without rereading. They understand the *engineering idea*, not just the framework's spelling of it.
