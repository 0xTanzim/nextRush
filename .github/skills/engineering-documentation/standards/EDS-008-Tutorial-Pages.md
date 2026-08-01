# EDS-008 — Tutorial Pages

> A tutorial is a guided build. The reader follows along, creates something real, and finishes both with a working project *and* the confidence to keep building without the tutorial open.

Tutorials are Diátaxis *tutorials* — learning-oriented. The measure of success is not that the reader finished, but that they *understood every step well enough to continue on their own*.

---

## The reader

Assume they know JavaScript/TypeScript and basic backend ideas, are new to this framework, and want to build something real while understanding it — not copy code blindly. Never assume they already know the framework's internal concepts; introduce each as it's needed and link the concept page for depth.

## Structure — the canonical tutorial page

A tutorial is a workshop with the teacher leading; ⭐ marks the high-impact sections that keep it a *tutorial*, not a guide.

1. **Finished project** ⭐ — show the DESTINATION first: a checklist plus a real `curl` + response. Motivation comes from knowing where you're going.
2. **Learning journey** ⭐ — the steps as a `✓ / ⬜` progress checklist; "I'm halfway" is a real psychological win.
3. **Prerequisites** — concepts (linked) + required setup. (`difficulty`/`estimatedTime`/`prerequisites` in front-matter, per the note below; visible line until it renders.)
4. **Steps**, each headed **Step N / total** and following the loop below.
5. **Checkpoint** ⭐ — after every few steps: what should be true now, the current file tree, "continue when this works". Dramatically reduces frustration.
6. **Final project** ⭐ — the complete file tree (and full code for larger tutorials) to compare against.
7. **What you learned** ⭐ — recap per idea: Concept → where you used it → why it matters. Not "congratulations".
8. **Think about it** ⭐ — reflection questions that turn copying into understanding (almost no framework docs do this).
9. **Try it yourself** ⭐ — a challenge, with the **Solution hidden** in `<details>`.
10. **Common mistakes** — Mistake → Symptom → Cause → Fix.
11. **Next tutorial** ⭐ — point to the next build so it feels like a course.
12. **Continue learning** — `<Cards>`: Concept → Guide → Reference → Architecture.

Sprinkle short **learning-tip callouts** ("don't memorize this — notice that…") and a **folder-structure block** at each milestone.

## The build-step loop (the core of the technique)

Each step introduces **one** new idea and follows the same rhythm — teaching order first:

1. **Step N / total** — the header itself shows progress.
2. **Why now** — why this step comes *at this point*, before the code (EDS-005). Teaching order, not just "why".
3. **Do** — a small, complete, runnable block (EDS-013).
4. **Expected output** — the response/log/terminal the reader should see.
5. **Why it worked** — the line that mattered and the mechanism behind it.

A reader should never wonder "did that work?" — every step ends by showing what "working" looks like.

> **Front-matter:** tutorials declare `difficulty`, `estimatedTime`, and `prerequisites`. The docs
> collection schema (`apps/website/source.config.ts`) currently captures only `title`/`description`
> and strips the rest, so also show them as a visible line under Prerequisites until the schema +
> a header component render them.

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

**Success is measured by the learner, not the project.** This is the subtle line between a tutorial and a guide, and it drives every structural choice above:

| Page type | Reader goal | Success criteria |
| --------- | ----------- | ---------------- |
| **Concept** | Understand an idea | "Now I understand *why*." |
| **Guide** | Accomplish a task | "Now my project works." (success = the **project**) |
| **Tutorial** | Learn by building | "I built it myself and understand each step." (success = the **learner**) |
| **Reference** | Find exact information | "I found the API I needed in seconds." |

A guide can succeed while the reader stays a black-box copyist; a tutorial has failed if they did. That is why tutorials carry checkpoints, reflection, a challenge, and a learner-facing recap that a guide does not.
