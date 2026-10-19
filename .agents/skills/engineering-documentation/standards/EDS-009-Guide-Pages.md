# EDS-009 — Guide Pages

> A guide solves **one real task** for a reader who already knows the basics: add authentication, upload files, configure CORS, deploy to production. It gets them to a working, production-sound solution — and explains the decisions along the way.

Guides are Diátaxis *how-to* — task-oriented. Unlike a tutorial, a guide assumes competence and doesn't teach fundamentals; unlike a concept page, it's about *doing*, not *understanding for its own sake*.

---

## Guide vs. its neighbors

- Not a **tutorial** — the reader isn't learning the framework, they have a specific job. Skip the hand-holding and the finished-result reveal.
- Not a **concept page** — explain only enough theory to make the solution make sense, then link the concept for depth.
- Not a **recipe** — a guide teaches *how to do one task well*; a Recipe (EDS-019) is a complete, copy-the-whole-thing end-to-end scenario. When in doubt: a guide teaches a technique, a recipe hands over a working feature.

## Structure — the canonical guide page

A guide is a workshop: the reader finishes with something working. ⭐ marks the high-impact sections.

1. **Opening hook** ⭐ — *why this guide exists*: the simple version works → it gets hard as it grows → this guide organizes it. 2–3 sentences. No `## Introduction` heading.
2. **What you'll build** ⭐ — concrete outcome as a checklist, plus the resulting routes/artifacts. A target the reader can picture beats an abstract "Goal".
3. **Before and after** ⭐ — a `❌ before` / `✓ after` comparison. People learn by comparison, and it sells the payoff up front.
4. **Prerequisites** — **Concepts** (linked) and **Required knowledge**. Link the concept for anyone missing the foundation; never re-teach it. (`difficulty`/`estimatedTime` live in front-matter — see the note below — with a visible `Difficulty · time` line here until the platform renders front-matter.)
5. **What you're building** ⭐ — a **diagram** of the target (the shape, not an architecture study — the word "architecture" belongs on Architecture pages, not guides).
6. **Recommended approach** ⭐ — standardized position: **Use X because … / Avoid Y because … / Alternative … / When to choose the alternative …**. Don't turn the guide into a menu.
7. **Steps** — each step answers **Why → Do → Result**: why the step exists, the complete runnable code under a **Do** heading, and what the reader now has. Use `<Steps>`. (A long guide may open with a progress checklist.)
8. **Verify** ⭐ — per check: **Request → Expected response → what success means**. This turns "I typed it in" into "it works".
9. **Production considerations** ⭐ — **mandatory**, and think through **four categories: Security · Performance · Reliability · Deployment**. Omit one only if genuinely irrelevant, and say so. This is what separates framework docs from a blog post.
10. **Troubleshooting** — **Symptom → Cause → Fix**, ordered **most common first** (not alphabetical); readers recognize the symptom first.
11. **Common mistakes** — **Mistake → Why it happens → Fix**. Distinct from Troubleshooting: this owns the *why*, Troubleshooting owns the *symptom* — keep the responsibilities separate.
12. **Key takeaways** ⭐ — 4–6 bullets reinforcing the technique.
13. **Continue learning** — `<Cards>` in fixed order **Concept → next Guide → Reference**.

Close with momentum: what they built, what they learned, where to go next.

> **Front-matter:** guides declare `difficulty` (`beginner|intermediate|advanced`) and `estimatedTime` in front-matter as the authoring standard. The current docs collection schema (`apps/docs/source.config.ts`) captures only `title`/`description`, so until it's extended and a header component renders them, also show them as a visible `Difficulty · time` line under Prerequisites; drop that line once the platform renders the front-matter.

## What a guide NEVER contains

A guide teaches *doing*; these belong on other page types, linked — never inlined:

- ❌ API tables / signatures / type definitions → **Reference**
- ❌ Every configuration option → **Reference**
- ❌ Internal algorithms, data structures, lifecycle → **Architecture**
- ❌ Big architecture discussions, benchmark numbers, RFC discussions → **Architecture / Concept**
- ❌ **Trade-offs** → **Concept** (a guide takes the recommended path and links the concept for the "why not the alternative"; it does not deliberate)

## Rules specific to guides

- **Open with the problem, state the goal precisely.** "By the end, your API accepts requests from your frontend while rejecting unknown origins" — the reader knows exactly what success is.
- **Recommend, don't enumerate.** A guide takes a position: *here is the recommended approach and why*. Mention alternatives briefly and link a Decision Guide (EDS-021) if the choice is genuinely situational — but don't turn the guide into a menu.
- **Every step earns an explanation.** What changed, why it matters, what happens under the hood (EDS-013). A guide that's all code and no reasoning is a snippet, not a guide.
- **Production is mandatory, not optional.** Security, performance, error handling, deployment — a guide that stops at "it works locally" hasn't finished the job. This is the section that separates a real guide from a blog post.
- **Name the common mistakes.** The footguns for *this* task, why they happen, how to avoid them.

## Anti-patterns

- Tutorial-style intros and basics the reader already has.
- Long theory before the solution (link the concept instead).
- An API dump, or several unrelated tasks on one page.
- "Works on my machine" — omitting the production considerations.
- A neutral list of five approaches with no recommendation.

## Success

The reader solves their problem, understands *why* the solution works, can adapt it to their own app, avoids the common production mistakes, and knows what to do next. A guide should read like asking a senior engineer "how would you actually build this?" — and getting a practical, honest answer.
