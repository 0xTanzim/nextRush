## Context

v3→v4 documentation rebuild. This document records the decisions and their rationale so future
sessions inherit the *why*, not just the *what*. Companion: `proposal.md` (scope), `tasks.md` (the
resumable wave tracker). Craft authority: `.kiro/skills/engineering-documentation/SKILL.md`. Repo
doc config: `.kiro/steering/documentation.instructions.md`.

---

## D1 — Keep Fumadocs for v4 (do not switch frameworks)

**Decision:** Stay on Fumadocs + Next.js/MDX. Spend the "modernize" budget on features Fumadocs
already ships, not on a toolchain swap.

**Rationale:**
- No named problem. "We want modern/clean/standard" is a request to validate the current choice,
  not evidence of a Fumadocs defect. Per `architecture-review.md`: never recommend change just
  because a different design exists — a recommendation needs a concrete problem it solves.
- Fumadocs' own creator (fumadocs.dev/docs/comparisons) advises *against* switching when you're
  satisfied with your current setup; the one honest gap he cites (Mintlify's OpenAPI polish) is
  covered for us because Fumadocs ships a **Scalar**-based OpenAPI integration (D3).
- **Toolchain fit:** docs authors == framework authors (same Next.js/TS ecosystem). Docusaurus is
  React-but-not-Next.js (real migration cost, ranked behind both Fumadocs and Mintlify in 2026
  comparisons). Mintlify is a managed SaaS — monthly cost, content leaves the repo/CI, vendor
  theming lock-in — the opposite of NextRush's self-hosted, own-your-infra philosophy.
- **`AutoTypeTable`** (`fumadocs-typescript`) generates type tables from live TS source — a
  drift-killer that is rare outside this combo and disproportionately valuable across 35 packages
  at mixed versions.

```
                  Fumadocs   Mintlify   Docusaurus   Scalar
   Hosting        self ✓     SaaS $$    self ✓       self
   Next.js fit    ✓✓         n/a        React(diff)  standalone
   AutoTypeTable  ✓ uniq     ✗          ✗            ✗
   OpenAPI        Scalar ✓   best       plugin       BEST(its job)
   llms.txt       built-in✓  built-in   manual       n/a
   Cost / control $0 / full  $$ / lock  $0 / full    $0 / full
```

**Rejected:** Mintlify (SaaS cost + lock-in, no named gain), Docusaurus (migration cost, behind
in 2026), Scalar-as-site (it's an API-reference tool, not a full docs framework — but we DO use it
under Fumadocs for OpenAPI, D3).

## D2 — Advanced tooling to adopt *within* Fumadocs

- **`llms.txt` / `llms-full.txt`** via `source.llms()` — 2025–26 standard for AI/agent-readable
  docs (Jeremy Howard / Answer.AI spec). We already emit the artifacts incidentally; make it
  first-class and documented.
- **Scalar OpenAPI** fed by `@nextrush/openapi` → interactive reference with try-it-out.
- **`AutoTypeTable`** as the default for every type/option table (anti-drift).

## D3 — v3 → v4 cutover: tag + branch, never an `_archive/` folder

This differs from the `docs/documentation-rebuild` deletion (that was a dead internal planning
folder — pure delete). v3 docs are **live, published content**: real users hit those URLs, search
engines have them indexed. So the *path* needs a cutover even though the *end state* is identical
(no permanent dead-weight in the tree — AGENTS.md §20).

```
   feat/dev
       │
       ├─ tag  docs-v3-final     ← the "archive": cheap, git-native, NOT indexed,
       │                            recover any file via `git show docs-v3-final:<path>`
       ├─ branch docs/v4-rebuild ← v4 built here; v3 stays live on feat/dev throughout
       │     │
       │     ▼  [waves 0..3 + site work + validate]
       ▼     ▼
   merge → old content removed from tree (recoverable via the tag). No _archive/ ever created.
```

Redirect map for any changed v3 URL is authored **before** cutover, not after.

**v4 is a full IA reorganization ("new brand"), not a rewrite-in-place** (confirmed with user).
v3's structure/URLs are not preserved — v4 reorganizes onto the skill's content map + page-type
standards with a fresh identity. Consequences: (1) an IA-design step (tasks §7 / Wave B0, governed
by EDS-002) precedes every MDX page and produces the authoritative **old→new URL map**; (2) the
redirect map is **derived from that URL map** and is substantial, not incidental — every moved v3
page needs a redirect to preserve external links and SEO; (3) a v3→v4 docs-navigation migration
guide ships for existing users (tasks §11 / Wave B4, `migrate/`).

## D4 — Rewrite architecture: tier-driven subagent waves

Maps onto the loaded `software_engineer` v2 model (Planner → parallel Implementers in isolated
worktrees → independent Validator → Integrator). Waves are tier-driven because tier already
determines doc depth (`documentation.instructions.md`), and batching by tier lets a systemic
template mistake be caught at a wave boundary instead of replicating across 35 packages.

- **Isolation:** one git worktree/branch per Implementer — never a shared working dir (parallel
  file-writes collide by construction otherwise).
- **Each Implementer** is scoped to exactly one package's two files, receives the skill + both
  templates + the package's tier + its real `src/` as mandatory context, and builds toward a
  concrete `done_predicate`.
- **Validator is a different context** (never the Implementer grading itself): re-reads the
  template + the real source, checks the predicate mechanically (every template section present,
  every code sample compiles, every fact matches `packages/<pkg>/src`, EDS-014/015 pass).
- **Wave 0 (pilot, 1 package) exists to de-risk the template+skill combo before it scales ×35** —
  one bad baked-in assumption otherwise repeats 34 times.
- **Each wave has a self-contained execution brief in `waves/`** (`waves/_TEMPLATE.md` is the shape):
  scope, exact file paths, the frozen template/EDS to use, per-item checklist, mandatory context, a
  measurable done-condition, and the independent Validator checklist. A long-running agent or
  `se-implementer` reads its wave brief FIRST and runs the whole wave without re-loading `tasks.md` +
  `design.md` + every EDS — the loop-engineering "contract read at start of run." `tasks.md` stays the
  master progress tracker; the brief is the *how*. Distant-wave briefs are written **just-in-time**
  (when the wave starts), not all up front, so they don't go stale as earlier waves reveal refinements.

## D5 — `done` conditions (measurable, per loop-engineering)

- **Per package:** README + ARCHITECTURE match their **frozen** template structure exactly (D7);
  no placeholder
  text; every code example compiles/typechecks; cross-links resolve; EDS-014 (review) + EDS-015
  (publish) checklists pass; every factual claim verified against `packages/<pkg>/src`.
- **Per wave:** every package in the wave meets the per-package bar, independently validated.
- **Site:** `pnpm docs:verify` green (link-check, code compile, terminology, import-style,
  marketing-word ban, heading-intent, callout density) + skill publish checklist.
- **Whole change:** all 35 packages done + site green + v3 retired via tag + redirects live.

## D6 — Two documentation tracks (do not conflate)

The effort produces two distinct kinds of documentation with different location, format, and
reader journey. Every wave in `tasks.md` belongs to exactly one:

- **Track A — package docs:** `packages/*/README.md` (npm landing, usage) + `ARCHITECTURE.md`
  (internals, diagrams). Plain GitHub/npm Markdown (no MDX components — they don't render on npm
  or GitHub, per EDS-016). 35 packages, tier-driven waves.
- **Track B — docs-site content:** `apps/docs/content/docs/**`. MDX with Fumadocs components,
  following the skill's EDS page-type standards and the content map. This is the learning journey
  users read at the docs URL — the primary v4 deliverable, waved by content-map section.

Both use the `engineering-documentation` skill. They are *different patterns* → each gets its own
pilot (tasks §1) before scaling.

**Cross-track dependencies (drive ordering):**
- Track B `reference/` pages depend on the §2 tooling foundation (AutoTypeTable + Scalar OpenAPI) —
  so tooling lands early.
- Track B `internals/` pages cross-link Track A's `ARCHITECTURE.md` — so run after the relevant
  package ARCHITECTUREs.
- Track B `concepts/` and `guides/` are independent of Track A — they run in parallel with the
  package-doc waves.

Single-source-of-truth rule holds across tracks: a concept is explained once (site `concepts/`)
and linked from everywhere else; README/ARCHITECTURE link to the site rather than restating it.

## D7 — Templates & standards are frozen before scaling (pilot-driven)

The shared templates are **not a fixed input** to this change — hardening them is part of it. A
pilot-driven feedback loop (Wave 0, tasks §0.6) rewrote all eight docs-site page-type templates
(concept, guide, tutorial, reference, recipe, architecture, production, landing) and both package
templates to a frozen canonical structure, and updated the paired EDS standards
(007/008/009/010/011/018/019/022) to match.

**Rationale:** the plan's own logic (D4) is that a systemic template mistake caught at a wave
boundary otherwise replicates ×35. So the cheapest place to get the structure right is *before* the
first wave — at the pilot gate — folding every review correction back into the template, never into
the one page it surfaced on. That is exactly what happened: the concept/guide pilots drove three
rounds of structural corrections, each promoted into `concept.md`/`guide.md` + `EDS-007/009`; the
remaining page types and both package templates were frozen the same way against their own reviews.

**Consequence:** every wave authors from the **frozen** templates, and a deliverable that deviates
from its frozen template structure is a Validator gate failure (D5), not a style preference. The
templates are the design system; freezing them first is what makes 35 packages plus a full site
render as one coherent product rather than 35 individually-reasonable-but-divergent pages.

## Open questions (resolve as waves start)

- Wave-2 batching width: one flat batch of 19, or sub-waves of ~5? (Leaning sub-waves for a
  mid-flight checkpoint; confirm at Wave 2 kickoff.)
- Are any v3 URLs actually changing under v4? (Determines whether the redirect map is non-trivial.)
- Meta package `nextrush`: rewrite alongside Tier 1 or as its own final landing-page pass?

## Package inventory (verified against source, 35 total)

- **Tier 1 core (7):** core, runtime, router, di, class, types, errors
- **Tier 2 middleware/ext/stream (19):** cors, helmet, csrf, body-parser, multipart, rate-limit,
  compression, cookies, validation, logger, static, template, openapi, request-id, timer, health,
  events, websocket, stream
- **Tier 3 adapters/tooling (8):** adapter-node, adapter-bun, adapter-deno, adapter-edge,
  adapter-serverless, dev, testing, create-nextrush
- **Meta (1):** nextrush

_Note: `@nextrush/health` is present in source but was absent from the steering tier list — source
wins; steering to be corrected. Re-verify the set at each wave kickoff against `packages/`._

## D8 — i18n: ready now, English-first, translate incrementally

**Decision.** Ship v4 **i18n-*ready*, not i18n-*complete*.** Wire Fumadocs i18n infrastructure (locale
routing with a **hidden default locale** so English URLs are unchanged, translatable UI chrome, a
locale switcher, `hreflang`/canonical). Keep **content English-first**; translate incrementally
(highest-traffic pages first) only for a locale with a committed maintainer, gated by a
translation-freshness CI check. **Do not** block v4 on full-corpus translation.

**Rationale.** Translating 135+ pages × N locales is a permanent tax that re-triggers on every doc
change, and a stale/partial translation actively misleads (worse than none) — violating the
honesty ethos (EDS-001). One maintainer cannot keep it synced (NestJS struggles with a larger team).
Infra-now keeps the door open at near-zero cost; content follows real demand + real maintainers.

| Option | Cost now | Ongoing tax | Verdict |
| ------ | -------- | ----------- | ------- |
| i18n-ready + English-first + incremental | low (infra only) | none until a language opts in | ✅ chosen |
| Translate named languages at launch | high (135× N pages) | permanent, every change | ❌ unsustainable for 1 maintainer |
| Defer i18n entirely (no infra) | none | retrofit later breaks URLs | ❌ URL-churn risk |

Follow-up: tasks.md gains an i18n-infra tooling task; codified in the skill (EDS-002 Versioning & freshness).

## D9 — Final IA freeze (Wave B0 gate close)

**Decision.** The five open product/IA decisions are locked, freezing the v4 documentation structure.
B1–B4 proceed with no further structural change barring a justified, logged exception.

1. **Reference URLs are flat** (`reference/cors`, not `reference/security/cors`). URL = package
   identity (stable); capability = sidebar organization (may evolve). No re-category ever breaks a URL.
2. **Navigation is capability-first**; package name + type + category are page **metadata**. The
   middleware/registrar/extension/adapter taxonomy lives in `architecture/extension-system`, out of nav.
3. **`standards/` + `specs/` fold into `architecture/`** — no new top-level section. Architecture
   sidebar: Design Principles · Contracts (Extension API · Adapter Contract) · Request Lifecycle ·
   Capability Composition · Package Hierarchy · internals · RFC · ADR.
4. **Version switcher retired** — v4 is single-version (v3 retired via the `docs-v3-final` tag);
   per-package versions surface via each Reference page's identity block + the compatibility matrix.
5. **Brand:** the **landing page** gets a premium/modern visual identity; the **documentation** stays
   simple/readable/professional (the Rust/Go/React/Stripe model — beautiful home, minimal docs).

**Rationale.** These are the decisions most expensive to reverse after pages exist (URLs, nav model,
naming). Freezing them now — validated by the persona journeys (§1), runtime experience (§2), and IA
audit (§5) in `wave-b0-final-review.md` — prevents a mid-implementation redesign. Further polish yields
diminishing returns; real refinements will surface naturally during implementation and are handled as
scoped exceptions, not open-ended re-architecture.

## D10 — Advanced, modern diagrams standard (no basic-by-default)

**Decision.** Every non-trivial docs-site page, package `ARCHITECTURE.md`, and blog post uses the
**most precise, modern Mermaid diagram type** for its subject — not a generic flowchart for
everything. The `mermaid` skill (`~/.kiro/skills/mermaid/SKILL.md`) is the syntax source of truth
(load + read the per-type reference before authoring). Codified in **EDS-012** (rewritten), the
`engineering-documentation` SKILL router, EDS-016, `documentation.instructions.md`, AGENTS.md §21,
and the frozen architecture templates.

**Type selection (summary — full catalog in EDS-012):** system topology → **C4 / architecture-beta**;
request lifecycle & handshakes → **sequence**; connection/request state → **state**; data & schema →
**ER / class**; binary/protocol layout → **packet**; data flow by volume → **sankey**; metrics →
**xychart / radar**; hierarchy → **treemap / mindmap**; branching/wiring → flowchart (only then).

**Renderer reality (honesty rule — don't mandate what won't render):**
- **Docs site** (Fumadocs, mermaid **11.x**): all core + modern types render out-of-the-box
  (architecture, block, packet, sankey, xychart, treemap, radar, …). **C4 = experimental** (prefer
  architecture-beta unless C4's formal notation is the point). **ZenUML = not wired** — the
  `<Mermaid>` component doesn't `registerExternalDiagrams`; needs a plugin (tasks.md §2.5). Until
  then, use `sequenceDiagram`.
- **GitHub** (`ARCHITECTURE.md`, RFCs, blog source): rich Mermaid OK.
- **npm** (`README.md`): **no Mermaid** — ASCII only. README = ASCII; ARCHITECTURE = advanced Mermaid.

**Rationale.** The prior EDS-012 allowed (and the templates scaffolded) a default flowchart, which
under-models a real system and reads as amateur — failing the "world-class, Stripe/React-grade"
bar the whole rebuild targets. Fixing it at the standard + template level (before any v4 page is
written) propagates the higher bar to every wave and to the blog automatically. This is a quality
gate, not a suggestion: a basic-by-default diagram where a truer type fit is a Validator/EDS-015 miss.
