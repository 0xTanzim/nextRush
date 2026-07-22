# EDS-018 — Landing & Overview Pages

> A landing page has one job: help a reader **orient and choose a path** in under thirty seconds. What is this, why should I care, and where do I start? It routes; it doesn't teach.

Every major section of a doc site has an entry point — the site homepage, and the overview page at the top of each area (Concepts, Guides, Reference). These are the most-visited and most-skimmed pages on the site, so they follow their own rules, distinct from teaching pages.

---

## The job: orient, then route

A reader landing here is deciding whether to invest. In one screen they must learn *what this is*, *whether it fits their problem*, and *where to click next*. A landing page that opens with a wall of prose or an API table fails — it answers questions the reader hasn't asked yet.

## Structure — the canonical landing page

A landing page is the **navigation hub** for the whole doc system, scanned in 30 seconds. ⭐ marks the routing/orienting sections that make it more than a README:

```text
Hero (one-line value prop) ⭐ → Why {Name} ⭐ → Quick facts ⭐ → Who is this for? ⭐
   → Quick start ⭐ → What can you build? ⭐ → Documentation roadmap ⭐ → Learning paths ⭐
   → Core concepts ⭐ → Popular guides ⭐ → Popular recipes ⭐ → Reference → Architecture
   → Examples ⭐ → Community
```

The additions that turn it from a product intro into a router:

- **Quick facts** ⭐ — latest version, runtimes, module format, requirements, dependencies, license — as a scannable table, not prose.
- **Who is this for?** ⭐ — an honest **✓ choose if / ✗ not a fit if**. Developers decide fit in seconds; help them.
- **Quick start** ⭐ — the full journey (install → create → run → visit) to a working server in under two minutes, followed by an explicit **"most developers learn next →"** so nobody stalls.
- **What can you build?** ⭐ — outcomes (REST, microservices, WebSocket, edge), not a feature list.
- **Documentation roadmap** ⭐ — the single most important addition: a visual of how the page types fit together (Tutorials → Concepts → Guides → Recipes → Reference → Architecture). This teaches readers how to *use the docs*, not just the product.
- **Learning paths** ⭐ — New / Building-an-API / Migrating (with "coming from Express/Fastify/Hono?" links).
- **Core concepts · Popular guides · Popular recipes · Examples** ⭐ — high-intent entry points, as card grids.

## Route, don't teach

A landing page's success is the reader clicking through to the *right* next page, not learning a concept in place. Front-load the value prop and quick start; push every explanation to a linked page. It should introduce not only the framework but **how to navigate the documentation itself**.

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
