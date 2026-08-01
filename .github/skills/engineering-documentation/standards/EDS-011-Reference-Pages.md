# EDS-011 — Reference Pages

> A reference page is built for **fast, exact lookup** by someone who already understands the concept. It describes an API completely, accurately, and consistently — and it does *not* teach.

Reference is the one page type that deliberately **inverts** the universal flow (EDS-006). There's no hook, no story, no slow build. The reader knows what they're looking for and wants it in seconds. Optimize for scanning, not reading.

---

## Audience and goal

Assume the reader already understands the concept (if they don't, they need the concept page — link it in one line at the top). They're mid-implementation and need precise facts: signature, parameters, return value, behavior, errors. Every design choice on the page serves *speed of lookup*.

## Structure

Consistent across every reference page, so readers always know where to look. It reads like a man page — facts first, tables over prose:

```text
Quick Facts → Import → Signature (+ overloads) → Parameters → Returns
   → Properties (optional) → Methods (optional)
   → Behavior (Execution · Lifecycle · Side effects) → Examples (Basic · Advanced)
   → Errors (+ Recovery) → Compatibility → Version Notes → Related Types → Related
```

The high-value additions that make it a real lookup tool:

- **Quick facts** ⭐ — a table answering package · since · stability · runtime · async? · throws? at a glance, before anything else.
- **Import** ⭐ — the exact import line, before the signature. Developers copy imports constantly; never make them guess the barrel (`createRouter` is `@nextrush/router`, not `@nextrush/core`).
- **Overloads** — show every overload; never hide them behind one signature.
- **Behavior split** into **Execution · Lifecycle · Side effects** (bullets, never long paragraphs) — plus complexity and state-transition notes where relevant (lifecycle APIs especially).
- **Examples** ⭐ — Basic + Advanced (Tabs), each copy-paste-run, no pseudo-code.
- **Errors + Recovery** ⭐ — engineers want the fix, not just the error name.
- **Compatibility / Version Notes / Related Types** ⭐ — runtimes, `Since`/`Deprecated`/`Removal`, and the types this API consumes or returns.

## The 30-second rule

Every reference page must be answerable in under 30 seconds: **how do I import it · what's the signature · what do the params mean · what does it return · can it throw · lifecycle/compatibility constraints · where next.** If a reader has to read prose to extract any of those, the page has drifted toward a Concept or Guide and must be tightened.

## Rules specific to reference pages

- **Signature first, prose last.** Show the exact, complete signature as developers actually write it. No warm-up.
- **Tables over paragraphs.** Parameters, options, and return fields go in tables — name, type, required, default, description (`TypeTable` where available, EDS-016). Tables are scannable; paragraphs are not.
- **Complete and exact.** Document *every* parameter, *every* option, *every* error. Reference is the one place completeness beats selectivity — a missing option is a bug. State defaults and constraints explicitly.
- **Accurate above all.** Reference is the source of truth developers trust during implementation; a wrong type or stale default here does more damage than anywhere else in the docs. Verify against the shipping API (EDS-015).
- **One small, realistic example** showing the *typical* call (EDS-013) — not a tutorial, just enough to anchor the signature. Highlight only the API in question.
- **Document errors and failure.** What throws, when, and why — so a reader debugging an exception finds the answer here.
- **Link out for understanding.** Don't teach the concept; link the concept page, the guide, and related APIs. Reference connects to education; it doesn't replace it.

## Consistency is a feature

Every reference page uses the same section order, the same table columns, the same terminology. A reader who learns the shape of one reference page can navigate all of them without thinking. Inconsistency forces re-learning on every page — the opposite of fast lookup.

## Anti-patterns

- A long narrative introduction, a hook, or storytelling (that's a concept page).
- Teaching the concept from scratch instead of linking it.
- Architecture discussion or historical background.
- Incomplete parameter/option/error coverage.
- Prose where a table would scan faster.

## Success

The reader finds the exact fact they need in seconds — signature, an argument's type, a default, what an error means — and gets back to work. If they had to read paragraphs to extract one value, the page failed at its one job.
