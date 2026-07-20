# EDS-009 — Guide Pages

> A guide solves **one real task** for a reader who already knows the basics: add authentication, upload files, configure CORS, deploy to production. It gets them to a working, production-sound solution — and explains the decisions along the way.

Guides are Diátaxis *how-to* — task-oriented. Unlike a tutorial, a guide assumes competence and doesn't teach fundamentals; unlike a concept page, it's about *doing*, not *understanding for its own sake*.

---

## Guide vs. its neighbors

- Not a **tutorial** — the reader isn't learning the framework, they have a specific job. Skip the hand-holding and the finished-result reveal.
- Not a **concept page** — explain only enough theory to make the solution make sense, then link the concept for depth.
- Not a **recipe** — a guide teaches *how to do one task well*; a Recipe (EDS-019) is a complete, copy-the-whole-thing end-to-end scenario. When in doubt: a guide teaches a technique, a recipe hands over a working feature.

## Structure

A compressed form of the universal flow (EDS-006):

```text
Problem → Goal → Before you start → Recommended approach → Architecture (if useful)
   → Steps (implement + explain each) → Production considerations → Trade-offs
   → Common mistakes → Related guides
```

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
