# EDS-006 — Page Template (Universal Section Flow)

> Every teaching page is a guided journey from *"why should I care?"* to *"I can do this myself."* This standard is the section order that makes that journey happen reliably.

This is the *universal* flow that underlies every page-type standard (EDS-007–011, 018–020). Each type adapts it; none contradicts it. Not every page needs every section — choose the ones the topic requires — but the **order never changes**, because the order *is* the reader's journey (`SKILL.md`).

---

## The flow

```text
Hook  →  Problem  →  Motivation  →  Mental Model  →  Visual
   →  Internal Mechanics  →  Implementation  →  Production Considerations
   →  Trade-offs  →  Common Mistakes  →  Summary  →  Next Steps
```

This is the pyramid from EDS-002 rendered as sections: problem and concept up top, implementation in the middle, and the deepest internals only after the reader can use the thing. Reference pages are the deliberate exception — they invert this for fast lookup (EDS-011).

---

## The sections

**1. Hook.** Open with something that makes the reader care in one breath: a real problem, a relatable failure, a sharp question. Never a definition. The reader must immediately feel *"this is about my situation."*

**2. Problem.** Name the engineering problem plainly — what's hard, why it's hard, and why the naive fix breaks down as the system grows. This is the motivation everything else rests on (EDS-005).

**3. Motivation.** Introduce the concept as the response to that problem. Why does the framework include it? Why this design over the obvious alternative? Honest, not promotional.

**4. Mental Model.** Before any code, give the reader the one picture to hold: what this owns, what it doesn't, how it relates to the parts around it. If they get the model, the API becomes derivable.

**5. Visual.** Where a diagram or component makes the model concrete, add exactly one (EDS-012, EDS-016) and explain what to notice in the sentence after it. Skip it if prose is already clear — a diagram that restates the sentence above it is noise.

**6. Internal Mechanics.** Now show what actually happens — lifecycle, order of execution, how the pieces interact. Build it up gradually; don't dump the whole machine at once.

**7. Implementation.** Only now, code. Set it up first (*what this does, why, what to watch*), show a complete runnable example (EDS-013), then explain the lines that matter. Code reinforces the understanding you've already built; it doesn't create it.

**8. Production Considerations.** Connect it to real systems — performance, security, scalability, debugging, observability — wherever relevant. This is what separates docs written by someone who's *run* the thing from docs written by someone who only read the source.

**9. Trade-offs.** State the costs honestly: what it gives up, where it's the wrong choice, what a better option would be in those cases. Where the choice is genuinely situational, promote this into a full Decision Guide (EDS-021).

**10. Common Mistakes.** The two-to-four errors real users hit, why they happen, and the fix. This single section prevents more support load than any other.

**11. Summary.** Short. Reinforce the *one idea* and the core takeaway — don't replay the page (EDS-004: end on insight).

**12. Next Steps.** Every page names the next logical page (EDS-002). Learning is a graph; a page with no exit is a dead end. This section is not optional.

---

## Adapt the flow to the page type

- **Concept** uses the whole arc, heavy on model + trade-offs (EDS-007).
- **Tutorial** replaces mechanics/trade-offs with *build → explain → verify* loops (EDS-008).
- **Guide** compresses to problem → approach → steps → production → mistakes (EDS-009).
- **Architecture** expands mechanics, decisions, failure modes, and evolution (EDS-010).
- **Reference** inverts to signature-first, lookup-optimized (EDS-011).

---

## Writing principles for every page

Explain *why* before *how*. Teach one major concept and build one mental model. Prefer understanding over completeness. Connect to what came before and what comes next. Use realistic examples and honest trade-offs. Make it read like a senior engineer teaching a peer (EDS-004).

## Avoid

Starting with a definition or an API. Walls of text or one-fragment-per-line padding. API dumps on a teaching page. Two or more major concepts on one page. Toy examples where a real one is clearer. Code with no explanation. A page with no next step.

## Success

A reader finishes able to answer, without rereading: *why does this exist, what problem does it solve, how does it work, when do I use it, what does it cost, and where do I go next?* If they can, the page did its job.
