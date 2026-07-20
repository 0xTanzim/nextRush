# EDS-003 — Engineering Documentation Principles

> Great documentation is measured not by how much it contains, but by how much understanding it creates.

These are the working principles — the checklist form of the philosophy in EDS-001. When a page feels off and you can't say why, run it against this list. Every principle applies to every page type unless a page-type standard says otherwise.

| # | Principle | In practice |
|---|---|---|
| 1 | **Documentation is part of the product** | Treat it like production code: designed, reviewed, tested against reality, maintained. Stale docs are a bug. |
| 2 | **Teach before documenting** | Explain *why it exists* before *how to use it*. A definition-first page teaches nobody. |
| 3 | **Problem before solution** | Open with the reader's pain and why simpler approaches fail. The solution only lands once the problem is felt. |
| 4 | **Why before how** | Motivation, then the design decision, then the mechanics. Implementation without motivation is shallow knowledge. |
| 5 | **Build mental models, not memory** | Readers retain relationships, not signatures. Give one clear model per page (EDS-012/016). |
| 6 | **One page, one purpose** | Exactly one type, one primary question. Split anything that answers three (EDS-002). |
| 7 | **Progressive disclosure** | Introduce complexity in layers — simple path first, edge cases later. Never front-load everything. |
| 8 | **Connect every page** | Link to prerequisites, related concepts, and a concrete next step. Learning is a graph, not a list. |
| 9 | **Understanding over completeness** | A focused explanation beats an exhaustive one. Reference pages carry completeness; concept pages carry understanding. |
| 10 | **Show engineering thinking** | Surface decisions, constraints, rejected alternatives. Teach *how experienced engineers reason*, not just the API. |
| 11 | **Use real engineering examples** | Auth, APIs, payments, jobs, caching — not `Foo`/`Bar`/`Animal`. Production realism builds intuition (EDS-013). |
| 12 | **Visualize the hard parts** | A diagram/component where prose struggles; nothing where prose suffices. One idea per visual (EDS-012). |
| 13 | **Be honest about trade-offs** | Every design has costs. State benefits, limits, and when another approach wins. Trust > polish. |
| 14 | **Teach engineering judgment** | Where meaningful choices exist, give a decision guide: choose X when…, choose Y when… (EDS-021). |
| 15 | **Keep language simple** | Plain words, short paragraphs, active voice. Depth from reasoning, never vocabulary (EDS-004). |
| 16 | **Accessible & findable by default** | Correct headings, alt text, contrast, metadata — a page nobody can use or find has failed (EDS-017). |
| 17 | **Documentation evolves** | Review regularly, update examples, delete what's stale. It ships and improves with the product, never "finished." |
| 18 | **Every page builds confidence** | The reader should finish thinking "I understand this, I could explain it, I can apply it." Confidence is the real metric. |

---

## The through-line

Principles 2–4 are one idea seen three ways: **meaning comes before mechanics.** Principles 5, 10, 13, and 14 are another: **teach reasoning, not recall.** If you internalize just those two, most of the rest follows.

## The final test

Documentation should not merely describe software — it should teach software engineering. If readers become better engineers while learning the framework, these principles have done their job.
