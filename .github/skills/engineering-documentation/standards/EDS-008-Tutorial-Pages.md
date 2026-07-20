# EDS-008 — Tutorial Pages

> A tutorial is a guided build. The reader follows along, creates something real, and finishes both with a working project *and* the confidence to keep building without the tutorial open.

Tutorials are Diátaxis *tutorials* — learning-oriented. The measure of success is not that the reader finished, but that they *understood every step well enough to continue on their own*.

---

## The reader

Assume they know JavaScript/TypeScript and basic backend ideas, are new to this framework, and want to build something real while understanding it — not copy code blindly. Never assume they already know the framework's internal concepts; introduce each as it's needed and link the concept page for depth.

## Structure

The universal flow (EDS-006) becomes a loop of small build steps:

```text
Goal → Show the finished result → Why it matters → Setup
   → [ Build step → Explain → Verify ] × N
   → Final result → What happened internally → Common mistakes → Next steps
```

**Show the finished result early.** A screenshot, the endpoint list, a sample response — knowing the destination makes the journey followable.

## The build-step loop (the core of the technique)

Each step introduces **one** new idea and follows the same rhythm:

1. **Goal** — one sentence on what this step accomplishes.
2. **Why** — the reason it exists, before the code (EDS-005).
3. **Implementation** — a small, complete, runnable block (EDS-013).
4. **Explanation** — what changed, why it works, the line that matters, the mistake to avoid.
5. **Verify** — the expected output (response, log, terminal) so the reader confirms success before moving on.

A reader should never wonder "did that work?" — every step ends by showing what "working" looks like.

## Rules specific to tutorials

- **One new idea per step.** No step should require the reader to absorb three concepts at once. If a step is doing too much, split it.
- **Introduce concepts just-in-time, then link out.** A tutorial mentions a concept only as deeply as the step needs; the concept page (EDS-007) teaches it fully. Tutorials introduce, concept pages explain.
- **Build confidence continuously.** Each verified step is a small win. The reader should think "that made sense" repeatedly, never "I'm lost but I'll keep pasting."
- **Warn before the trap, not after.** Middleware order, route registration, missing imports — flag the common mistake at the step where it happens.
- **End with reflection, not "congratulations."** Name what they actually learned: *"You didn't just build a task API — you saw how the app registers routes, runs middleware, and returns a response."*

## Anti-patterns

- A 200-line code dump followed by explanation.
- Long theoretical detours mid-build (link to the concept instead).
- Unexplained APIs or hidden setup the reader can't reproduce.
- Steps that introduce several concepts at once.
- Toy projects that look nothing like real work (EDS-013).

## Success

The reader finishes with a working project, understood every major step, feels confident experimenting, and knows what to learn next. The real test: they can now change the project instead of only having copied it.
