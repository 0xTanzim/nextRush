# EDS-007 — Concept Pages

> A concept page answers one question: **"Why does this exist, and how should I think about it?"** It teaches understanding, not API surface and not step-by-step tasks.

Concept pages are Diátaxis *explanation* (EDS-002). They're the pages a reader returns to when they want to *understand* middleware, routing, DI, or the request pipeline — not to build something (that's a Guide) or look something up (that's Reference).

---

## What belongs here — and what doesn't

A concept page teaches one idea deeply: what it is, why it exists, how to think about it, how it fits the system, and its trade-offs. It is **not** a tutorial (no build-along project) and **not** a reference (no exhaustive API table). If you're documenting *how to accomplish a task*, that's a Guide; link to it, don't absorb it.

## Structure — the canonical concept page

Every concept page follows this exact section order. ⭐ marks the sections most often missing and most impactful; each maps to how people actually learn (problem → solution → explanation, concrete before abstract, summary at the end).

1. **What you'll learn** ⭐ — **exactly 3–5** bullets of learning objectives, up front, led by *Understand / Explain / Recognize / Choose*. (Rust, Microsoft, and Google docs all open this way.)
2. **Opening hook** — real-world situation → pain → curiosity, 2–3 sentences. No `## Introduction` heading (heading-intent rule); the hook *is* the introduction.
3. **The problem** — what's hard, and why the naive fix breaks as the system grows.
4. **Why this matters** ⭐ — connect the reader to the stakes *before* the solution: where this runs, and why a small inefficiency compounds (a per-request hot path multiplied by scale). This is the emotional hook that motivates the fix.
5. **The solution** ⭐ — the one-paragraph answer *before* the deep explanation. Problem → Why it matters → Solution → Explanation is the natural learning order.
6. **Core idea** — the concept named and framed. **Exactly one mental model per page** — never a grab-bag. Not "How to think about it" (reads like a blog); "Core idea" is stronger.
7. **Mental model** — the diagram **first**, then the words. End with **one sentence steering attention** ("Don't memorize the tree — notice that matching follows the URL, not the route count").
8. **Quick example** ⭐ — the smallest runnable example, early, demonstrating **only this concept** (no logging, auth, or validation noise). Concrete before abstract.
9. **How it works** — standard shape **Example → Observation → Explanation**. Keep internals **light and link the Architecture page** — a concept teaches the model, not the implementation.
10. **Typical use cases** — *(optional)* include only when it helps the reader **recognize when the concept applies** (Middleware/Routing: yes; Extension lifecycle: probably not). Recognition, not usage instructions — do not force it.
11. **Configuration** — *(optional)* explain what **changing** each option *means* for behavior — not every option (that's Reference). Link Reference for the full table.
12. **Performance** — standard shape **Complexity → Memory → Scaling → benchmark link**. Principles, never unverified numbers.
13. **Security** — **mandatory on every feature page** (routing, cookies, body-parser, JWT, static, CORS, sessions — all of them). Standard order per risk: **Threat → Why → Safe default → What to avoid**.
14. **Trade-offs** — standardized shape: **Benefits → Costs → Alternatives → Why NextRush chose this** (readers want the decision rationale, not just the mechanics).
15. **Decision guide** ⭐ — **Choose X when / Avoid X when / Choose an alternative when**, so the reader leaves knowing what to *do* (see EDS-021).
16. **Common mistakes** — each as **Mistake → Why it happens → Correct approach → What happens if ignored** (the last line reinforces why it matters).
17. **Key takeaways** ⭐ — **4–6** bullets, no paragraphs, no *new* concepts — only what the page taught. Summary-at-the-end measurably improves retention.
18. **Continue learning** — `<Cards>` in fixed navigation order **Concept → Guide → Reference → Architecture**.

A concept page carries **almost no API** — API belongs in Reference, tasks in Guides, implementation detail in Architecture. Concepts teach *thinking*; keeping that boundary is what makes a doc set feel coherent (the Rust/React/TanStack quality bar).

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
