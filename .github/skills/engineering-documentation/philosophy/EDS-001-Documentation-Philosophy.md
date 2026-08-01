# EDS-001 — Documentation Philosophy

> Documentation is not an appendix to the product. It **is** part of the product — often the first part a developer touches and the one that decides whether they stay.

This file is the *why* behind everything else in the skill. Read it first, once, to calibrate the mindset. The concrete rules live in the standards; the judgment behind them lives here.

---

## The purpose

Reference tells a developer *what exists*. Documentation's job is larger: help them become a confident engineer while learning the technology. A page has done its job when the reader leaves knowing not only **how** to use something, but **why** it was built that way and **when** to reach for it.

Every page should reduce confusion, build a mental model, and increase confidence. If a page adds information without adding understanding, it has failed — regardless of how complete it is.

## Documentation is a product feature

Developer experience is the sum of the API, the error messages, the tooling, *and* the docs. A framework with a beautiful API and poor docs feels difficult; an average API with excellent docs feels easy. So documentation gets the same care as production code: it is designed, reviewed, tested against reality, and maintained. Outdated documentation is a bug, not a cosmetic issue.

## Teach before you document

Before explaining an API, explain the problem it solves. Before explaining configuration, explain the motivation. Understanding must arrive before implementation, because implementation without motivation produces shallow, copy-paste knowledge that breaks the moment the reader's situation differs from the example.

The failure mode to avoid: opening with a definition. "Middleware is a function that…" teaches nothing to someone who doesn't yet feel the problem middleware solves. Open with the problem — *"Every route needs auth, logging, and validation; copying that into 200 handlers is unmaintainable"* — and the solution becomes meaningful.

## Build understanding, not memorization

Readers remember relationships far better than definitions. Every important concept should let the reader answer: why does this exist, what problem does it solve, how does it work, when should I use it, when should I *not*, and what does it cost? Those six questions are the spine of the reader's journey (see `SKILL.md`), and a strong page answers them in that order.

## Move the reader from confused to independent

A good page walks the reader through a small arc: **confused → curious → confident → independent.** By the end they should be able to solve a similar problem *without* the page open. Copy-paste dependency is the sign the teaching didn't land.

## Show engineering thinking

Don't just state what the framework does — show *why* it was designed that way, which alternatives were considered, and why they were rejected. This is what separates docs that teach a tool from docs that teach engineering. When NextRush differs from Express, Fastify, or Nest, name the difference and the reasoning; that reasoning is often more valuable to the reader than the feature itself.

## Be honest about trade-offs

No design is free. State the costs, the limits, and the cases where a different approach is better. Honesty builds trust, and trust is the entire currency of documentation — a reader who catches one oversold claim discounts everything else on the page. Never hide complexity to make a feature look effortless.

## One mental model per page, made visible

Every teaching page should leave the reader holding one clear picture — the request pipeline, the cookie round-trip, the source→transform→sink of a stream. Make it visible with a diagram or a tight analogy (EDS-012, EDS-016). A reader who holds the model can derive the details; a reader who only memorized the details holds nothing when the details change.

## Simplicity is a feature

Simple writing is not shallow writing. Use plain English, short paragraphs, and active voice so the reader spends their effort on the *engineering*, not on decoding the prose. Assume an intelligent reader who may not be a native English speaker. Technical depth comes from reasoning, never from vocabulary. (The full voice rules are EDS-004.)

## Practical before complete

Most readers arrive mid-task. Help them succeed first, then deepen. Guides prioritize the working path; reference pages carry the exhaustive detail. Don't make someone read everything to do one thing.

## The standard

Every teaching page should leave the reader able to answer, unprompted: *What problem does this solve? Why was it designed this way? How does it work? When should I use it? What trade-offs should I know?* If they can, the page succeeded. If they finish able to recite the API but not answer those questions, it did not.

Documentation is not written to fill pages. It is written to build engineers. If a reader finishes a page a better engineer — not merely a better user of this one tool — the documentation has achieved its purpose.
