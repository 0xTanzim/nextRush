# EDS-021 — Decision Guides

> A decision guide answers the question docs almost always dodge: **"Which option should *I* choose?"** It teaches engineering judgment — when to reach for X, when for Y, and why — instead of neutrally listing features and leaving the reader to guess.

This is usually a **section** inside a concept or guide page (a "Decision Guide" or "Which should I use?" block), and occasionally a standalone page when a choice is big enough (sessions vs. JWT vs. server-side state; monolith vs. modules; which adapter). Very few frameworks do this well, and it's one of the highest-trust things documentation can offer.

---

## Why it matters

A reader facing signed cookies vs. encrypted sessions vs. JWT doesn't need three feature lists — they need *"here's how an experienced engineer picks."* Giving them the criteria, not just the options, is the difference between docs that inform and docs that make someone a better engineer (EDS-001). It also prevents the most expensive mistakes, which come from choosing the wrong tool, not from using a tool wrong.

## The pattern

```text
The decision (framed as a question) → The options (one line each)
   → When to choose each (the criteria) → Comparison table → Recommended default → Pitfalls
```

The heart is **"when to choose each."** Frame it as conditions the reader can check against their own situation:

```md
**Choose signed cookies when** you need integrity but not secrecy — the client may read the value, just not forge it.
**Choose encrypted sessions when** the value must stay secret from the client.
**Choose JWT when** multiple services must verify a token without shared session storage.
**Choose server-side sessions when** you need instant revocation or large/mutable session state.
```

## Rules specific to decision guides

- **Frame it as the reader's decision, not a feature comparison.** "Which session strategy should I use?" beats "Session strategies." The reader has a choice to make; meet them there.
- **Give checkable criteria, not vibes.** "Choose X when you need instant revocation" is actionable; "X is more flexible" is not. Each criterion should map to a condition the reader can evaluate about their own system.
- **Add a comparison table** across the axes that actually drive the decision — security, revocation, statelessness, cost — not superficial similarities (EDS-012). Compare what *differs and matters*.
- **State a default.** Analysis paralysis is a real failure mode. After the criteria, name the choice that's right for most readers: *"If you're unsure, start with signed cookies — most apps never need more."* An honest default is a gift.
- **Be honest about the trade-off each option accepts** (EDS-004). Every option has a cost; a decision guide that makes one option sound free is lying by omission.
- **Name the pitfalls** — the wrong reasons people pick each option (choosing JWT for a single-server app because it "sounds modern"). The anti-pattern is as instructive as the pattern.

## Anti-patterns

- A neutral feature matrix with no recommendation — leaves the reader exactly as stuck as before.
- Criteria that are vibes ("more powerful," "more elegant") instead of checkable conditions.
- Hiding the trade-off that makes an option a bad fit in some cases.
- No default, so the undecided reader stays undecided.
- Pushing the framework's fanciest option as always-best regardless of the reader's need.

## Success

A reader who arrived unsure leaves able to name the right choice *for their situation* and articulate why — and, just as important, why the other options were wrong for them. They didn't just pick; they learned how to pick, which is judgment they keep.
