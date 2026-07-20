# EDS-018 — Landing & Overview Pages

> A landing page has one job: help a reader **orient and choose a path** in under thirty seconds. What is this, why should I care, and where do I start? It routes; it doesn't teach.

Every major section of a doc site has an entry point — the site homepage, and the overview page at the top of each area (Concepts, Guides, Reference). These are the most-visited and most-skimmed pages on the site, so they follow their own rules, distinct from teaching pages.

---

## The job: orient, then route

A reader landing here is deciding whether to invest. In one screen they must learn *what this is*, *whether it fits their problem*, and *where to click next*. A landing page that opens with a wall of prose or an API table fails — it answers questions the reader hasn't asked yet.

## Structure

```text
One-line value proposition → What & why (2–3 sentences) → "At a glance" (key facts)
   → Quick start CTA → Choose-your-path cards → Highlights (optional) → Where to go next
```

- **Value proposition** — one sentence a skimmer grasps instantly. Concrete, not marketing ("Minimal, multi-runtime HTTP framework with a zero-dependency core," not "The future of backend").
- **What & why** — the problem it solves and who it's for, in a few tight sentences.
- **At a glance** — the facts a developer scans for: runtimes, module format, size, stability. Bullets or a small table.
- **Quick start CTA** — the single most important element. The fastest path to a working result, front and center. Most readers want copy → paste → run *before* they read philosophy.
- **Choose-your-path cards** — a card grid (EDS-016) routing the main audiences: "New here → Tutorial," "Building X → Guides," "Looking something up → Reference." This is the page's core navigation function.
- **Highlights** — a short feature grid *only if* it earns its place; never a marketing feature-dump.
- **Where to go next** — explicit links onward, same as every page (EDS-002).

## Rules specific to landing pages

- **Optimize for the 30-second skim.** Front-load value and the quick-start; push depth to linked pages.
- **Route, don't teach.** A landing page's success is the reader clicking through to the *right* next page, not learning a concept in place. Link generously.
- **Lead with a runnable quick start,** not a philosophy essay. Curiosity about *why* comes after the first success.
- **Use cards and grids** for path selection (EDS-016) — this is exactly what they're for.
- **Honest, specific value prop.** No "blazingly fast, effortless, magical" (EDS-004). State what it is and what it's good at.

## Anti-patterns

- Opening with an API table or a definition.
- A marketing feature-dump with no path to action.
- A wall of prose before the quick start.
- No clear "where do I go from here" — the reader lands and stalls.
- Decorative card grids that just mirror the sidebar (EDS-016).

## Success

Within thirty seconds a reader knows what this is, whether it fits their need, and exactly where to click next — and the quick start gets them to a working result on the same page or one click away.
