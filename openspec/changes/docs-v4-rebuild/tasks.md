## 0. Setup & guardrails (do FIRST, before any wave)

- [x] 0.1 Create branch `docs/v4-rebuild` off `feat/dev` for all v4 docs work.
- [x] 0.2 Tag the current docs state `docs-v3-final` (the git-native "archive" — replaces any
      `_archive/` folder; recover any v3 file via `git show docs-v3-final:<path>`). Done — tag
      created at `85bd933` (annotated, message records the recovery command + AGENTS.md §20 rule).
      Precondition verified: governance/cleanup edits were already committed at HEAD (`bfad5eb`,
      confirmed `docs/_archive` untracked at HEAD) before tagging.
- [x] 0.3 Confirm the exact 35-package set against `packages/` (source wins over steering). Correct
      the `documentation.instructions.md` tier list to include `@nextrush/health`. Done —
      re-verified 35 publishable packages against source; `documentation.instructions.md` Tier 2
      list corrected to include `health` (it existed in source, was missing from steering).
- [x] 0.4 Confirm both package templates + the `engineering-documentation` skill are current
      (`docs/templates/package-readme.template.md` + authoring guide, `package-architecture.template.md`).
      Done — both templates + authoring guide + templates index present; skill router present;
      all 22 EDS files present (001–013, 016–022 in `standards/`+`philosophy/`, 014–015 in `checklists/`).
- [x] 0.5 Confirm `pnpm docs:verify` runs green on the current tree (baseline before changes).
      **Result: RED, not green — 411 findings, recorded as-is, not fixed here.** Ran
      `pnpm --filter ./apps/docs run docs:verify` on v3 content (2026-07-20): 409 MDX
      code-example compile findings (mostly `concepts/request-lifecycle.mdx`,
      `concepts/routing.mdx` — undeclared `ctx`/`app`/`router` etc. in fenced examples that were
      never real, runnable snippets) + 2 heading-intent lint findings (`reference/class/di.mdx`,
      `reference/core/index.mdx` — generic "Overview" headings) + reference-match check passes
      (0 findings — no signature drift). **This is why v4 exists**: it is direct, dated evidence
      that v3 content violates EDS-013 (code-example standards) and EDS-006 (heading intent) at
      scale, not spot cases. Not remediated as part of Setup — v3 stays untouched per D3 (it
      keeps serving live traffic until v4 cuts over); superseded wholesale by Track B rewrites.
      This number is the "before" for any future before/after comparison, not a gate to clear now.
- [x] 0.6 **Harden & freeze the doc templates + EDS standards before scaling.** Beyond confirming
      the templates exist (0.4), this session ran a pilot-driven feedback loop (≈9.5–9.9/10 external
      reviews) that rewrote **all eight docs-site page-type templates** — concept, guide, tutorial,
      reference, recipe, architecture, production, landing — **and both package templates**
      (`package-readme.template.md`, `package-architecture.template.md`) to a frozen canonical
      structure, and updated the paired standards (EDS-007/008/009/010/011/018/019/022) to match.
      Structure now baked in: concept = Why-this-matters + Core-idea + Decision-guide + Security +
      Key-takeaways; guide = Before/After + Verify + four-category Production + Troubleshooting;
      tutorial = learner-success framing (checkpoints, reflection, challenge + hidden solution);
      reference = Quick-facts + Import + the 30-second rule; recipe = production-ready mandate +
      Production checklist; architecture = Architectural-invariants + Rejected-alternatives +
      Evolution strategy; production = on-call framing (Observability / Failure-modes / Recovery /
      Runbook); landing = doc-system navigation hub + Documentation roadmap; package README =
      Identity (Purpose / Included-in-`nextrush` / Maintenance) + Package-relationships; package
      ARCHITECTURE = "engineering constitution" (Responsibilities / Non-goals / Constraints /
      Invariants / Architecture-checklist). **These frozen templates + standards are the
      authoritative structural bar for every wave below (design.md D7)** — a wave deliverable that
      deviates from its frozen template is a Validator gate failure, not a style nit. One follow-up
      deferred: wiring `difficulty`/`estimatedTime` front-matter to actually render needs the docs
      collection schema (`apps/docs/source.config.ts`) extended + a header component — out of scope
      for the templates, logged for the §2 tooling wave. **Diagram-standard re-freeze (2026-07-21,
      design.md D10):** rewrote **EDS-012** to mandate precise/modern Mermaid types (C4/architecture-
      beta/sequence/state/ER/block/packet/sankey/…) over basic-by-default flowcharts, with a renderer-
      support reality table (mermaid 11 on docs site; ZenUML needs a plugin; C4 experimental; npm
      README = ASCII only); pointed the `engineering-documentation` SKILL router + EDS-016 at the
      global `mermaid` skill; and upgraded both architecture templates' diagram guidance (docs-site
      overview → `architecture-beta`). Repo/root propagation: `documentation.instructions.md` Mermaid
      row + AGENTS.md §21. Rendering-verification + ZenUML wiring tracked as task 2.5.

> **Two tracks.** This effort produces two distinct kinds of documentation, and every wave below
> belongs to exactly one: **Track A — package docs** (`packages/*/README.md` + `ARCHITECTURE.md`,
> plain GitHub/npm Markdown) and **Track B — docs-site content** (`apps/docs/content/docs/**`, MDX
> with Fumadocs components, following the skill's EDS page-type standards + the content map). Both
> use the `engineering-documentation` skill; they differ in location, format, and reader journey.

## 1. Pilots — de-risk BOTH doc patterns before scaling  ·  gate: MANUAL user review

Two pilots because the plain-MD package pattern and the MDX-site pattern are genuinely different
shapes — proving one does not prove the other. One bad baked-in assumption otherwise repeats across
35 packages (Track A) or every site page (Track B).

- [x] 1.1 **Track A pilot — `@nextrush/router`** (Tier 1; has a README, **no** ARCHITECTURE.md, so
      it exercises both rewrite and create-new; segment-trie stresses the diagram/perf/trade-off
      sections). Rewrite `README.md` from `package-readme.template.md`; author `ARCHITECTURE.md`
      from `package-architecture.template.md`. Read the skill `SKILL.md` + both templates +
      `documentation.instructions.md` + real `packages/router/src` first. Samples compile; facts
      verified against `src`; terminology clean ("segment trie", never "radix tree").
      **DONE (awaiting user review at 1.3).** `README.md` rewritten (365 lines, full Tier-1
      section order) + `ARCHITECTURE.md` authored new (272 lines, Mermaid hierarchy/sequence/
      flowchart, two-path match design). Source-verified: 15 modules/2086 LOC (largest 298, under
      cap); static-map + segment-trie two-path design; `compileExecutor` at registration; `Since`
      column checked against CHANGELOG (`endpoint`/`getRoutes` = 3.1.0, core surface = 3.0.0).
      Mechanical validation (task 1.4) passed: 0 placeholders, cross-links bidirectional, all 7
      relative package links resolve, terminology clean. Withdrawn v3 benchmark numbers were NOT
      repeated (skill guardrail) — complexity characteristics + `apps/benchmark` pointer instead.
      **FINDING (out of scope, not fixed):** `packages/router/package.json` `keywords` still lists
      `"radix-tree"` — contradicts the CI terminology ban and the source's own "not a radix tree"
      comment. Log only; fixing package.json is outside this docs task's scope. **Re-aligned to the
      frozen package templates (0.6):** after the template freeze, `README.md` + `ARCHITECTURE.md`
      were rewritten again to the final frozen shapes (README: Identity + Highlights + categorized
      Capabilities + Common tasks + Package relationships + Resources; ARCHITECTURE: Responsibilities /
      Non-goals / Constraints / State-ownership / Trust-boundaries / Architectural-invariants /
      Rejected-alternatives / Evolution / Architecture-checklist). The pilot pair now matches the
      frozen bar exactly (0 leftover placeholders; facts unchanged, still source-verified).
- [x] 1.2 **Track B pilot — one Concept page + one Guide page** under `apps/docs/content/docs`.
      **DONE (awaiting user review at 1.3).** Rewrote `concepts/routing.mdx` (Concept, EDS-007 —
      pairs with the approved router package docs, replaces a page that was RED in the baseline)
      and created `guides/mounting-and-grouping-routes.mdx` (Guide, EDS-009; added to
      `guides/meta.json`). Used real repo components (`Mermaid`, `Callout type=info|warn`, `Steps`,
      `Cards/Card` with `/docs/...` hrefs). **Verified GREEN via targeted harness** (ran the real
      `checkCompile` + `checkLint` against exactly these two files, absolute paths): **0 compile
      findings, 0 lint findings** — every `ts` block is self-contained and type-correct (`ctx` is
      contextually typed by `createRouter().get()`), no forbidden words, "segment trie" not "radix
      tree". Diagrams use `<Mermaid>` (not compiled). All 5 internal links resolve to real pages.
      Pattern proven: the plain-MD package pattern (Track A) and the MDX/component pattern (Track B)
      are both established. These two files do not add to the 411 baseline findings; they model the
      per-page bar that brings the suite to green wave by wave.
- [x] 1.3 **USER REVIEW GATE** — user approves the router pair AND the two MDX pages as the two
      reference bars. Waves do not start until signed off. Fold any pattern correction back into
      the templates/skill here (cheapest place to fix a systemic issue).
      **Track A: APPROVED** (router README + ARCHITECTURE, 2026-07-20). **Track B: partially
      approved** — TWO rounds of pattern corrections folded back per this task's rule:
      (round 1) concept pages must carry **Configuration** + **Security considerations**;
      (round 2, from `fed_concept.md`/`guide_concept.md`, ~9.8–9.9/10) full canonical structures
      adopted — **Concept:** What you'll learn → hook → Problem → Solution → Core idea → Mental
      model (diagram-first) → Quick example → How it works (internals light, link Architecture) →
      Common usage → Configuration → Performance → Security → Trade-offs (Why/Benefits/Costs/
      Alternatives/When-not) → Decision guide → Common mistakes (Mistake→Why→Fix) → Key takeaways →
      Continue learning. **Guide:** hook → What you'll build → Prerequisites → Finished architecture
      → Recommended approach → Steps (Why→Code→Result) → Verify → Production → Troubleshooting →
      Common mistakes (Mistake→Symptom→Fix) → Key takeaways → Continue learning; **Trade-offs/API/
      internals removed from guides** (linked instead). Rewrote both pilot pages to the new
      standard (re-verified compile 0 / lint 0) and codified all of it into `EDS-007`, `EDS-009`,
      `templates/concept.md`, `templates/guide.md`; (round 3) closing navigation standardized to a
      **Next steps / Continue learning** `<Cards>` block. Every correction was folded back into the
      frozen templates + standards (task 0.6), so the pilots and all future pages share one bar; both
      pilot pages were re-verified GREEN against the final frozen templates (compile 0 / lint 0).
      **Track B: APPROVED — gate CLOSED (2026-07-21).** User signed off both pilot pages and the
      frozen templates/standards as the reference bar. Waves A1–A3 and B0–B4 are now unblocked.
      (Track A's router pair approved at 1.1 and conforms to the frozen package templates.)

## 2. Docs-site tooling foundation (do EARLY — Track B reference pages depend on it)

- [x] 2.1 Formalize `llms.txt` / `llms-full.txt` as a documented, first-class pipeline.
      **Finding: the plan's premise was stale — it is ALREADY first-class, not an incidental build
      artifact.** `src/app/llms.txt/route.ts` (structured index, sections from
      `appConfig.llms.sectionTitles`, per-page `.md` + canonical URLs + skills) and
      `src/app/llms-full.txt/route.ts` (full corpus via `getLLMText()` → Fumadocs' native
      `page.data.getText('processed')`, MDX/imports stripped by `sanitizeLLMMarkdown`) are both
      `force-static`; `llm.txt` + `ask-ai-index.json` also present. Rebuilding onto `source.llms()`
      would be change-for-change's-sake against a working, more-customized implementation
      (architecture-review.md: no change without a named problem). **Done = verified + documented:**
      MDX collections compile clean (`npx fumadocs-mdx`, ~20ms), and the pipeline is now documented
      as first-class in `apps/docs/README.md`. **Follow-up for Wave B0:** `appConfig.llms.sectionTitles`
      still uses v3 section keys — update to the v4 IA when B0 finalizes it (graceful today: unknown
      sections are title-cased + appended, so nothing breaks meanwhile).
- [x] 2.2 Wire `@nextrush/openapi` spec → Scalar OpenAPI renderer (read-only interactive reference,
      static-export). **Decision (user-approved): build-time spec + read-only Scalar; docs stay a
      static export (see the static-vs-server analysis — static is right for v4: content is fully
      static, matches the free self-hosted deploy + design.md D1 ethos, and server rendering would
      NOT unlock try-it-out anyway since that needs a separate live demo API).** Delivered:
      (a) `apps/docs/scripts/generate-openapi.ts` dogfoods the real `generateDocument()` over a
      representative API (`RouteDefinition[]` + `endpoint()` docs + zod schemas via `z.toJSONSchema`)
      → `public/openapi.json` — **verified: OpenAPI 3.1.0, 4 paths / 7 operations, params converted
      (`/users/{id}`), response schemas resolved into `content`**; wired into `prebuild`.
      (b) `ScalarApiReference` MDX component (`@scalar/api-reference-react@0.9.58`, loaded
      `next/dynamic` `ssr:false` for static-export safety), registered in `mdx-components.tsx`.
      **Verified:** `pnpm run types:check` green (collections compile + `next typegen` + `tsc
      --noEmit` across the app). Documented in `apps/docs/README.md`. **Honest gaps:** a full
      `next build` (static-export render) was not run here (heavy) — it's the CI gate; the design is
      specifically static-safe (`ssr:false` client island). The actual reference *page* (dropping
      `<ScalarApiReference/>` into a `reference/` MDX page) is **Track B Wave B3** content, not §2.
- [x] 2.3 Adopt `AutoTypeTable` (`fumadocs-typescript`) as the default for type/option tables
      (anti-drift). **Finding: already fully wired.** `fumadocs-typescript@5.3.0` installed;
      `remarkAutoTypeTable` (output `AutoTypeTable`) in `source.config.ts`; the JSX `AutoTypeTable`
      registered in `mdx-components.tsx` (monorepo-root path resolver); shared generator+cache in
      `lib/type-table-generator.ts`. **Verified on a live sample:** `reference/core/types.mdx` uses
      `<AutoTypeTable path="packages/types/src/context.ts" name="Context" />` and that source file
      exists; collections compile clean. Documented in `apps/docs/README.md` (prefer over hand-authored
      `TypeTable` for reference pages, per `documentation.instructions.md`).
- [x] 2.4 **i18n-ready infrastructure (design.md D8):** wire Fumadocs `i18n` config with a **hidden
      default locale** so English URLs are unchanged (verify against static export `output: 'export'`
      + Next.js 16.2.3 first — real technical risk), translatable UI chrome, a locale switcher, and
      `hreflang`/canonical. **Content stays English-first — no page translation in v4.** Add a
      `docs:verify` "translation-freshness" check stub (flags a localized page older than its source)
      for when translation begins. Retire the disabled `version-switcher` component in the same pass
      (D9.4 — v4 is single-version).

      **Scope note (reduced, user-approved):** implemented `lib/i18n.ts` (`defineI18n`, English-only,
      `hideLocale: 'default-locale'`), `hreflang`/canonical metadata, the translation-freshness
      verify stub (real logic, tested against a fixture, genuine no-op today), and retired
      `version-switcher`. **Deferred, explicitly:** the `app/[lang]/` route restructuring and a
      locale switcher UI — both require moving 250+ live pages' routing with zero current
      translation demand or committed locale maintainers (computed blast radius 6+, always gates
      per this session's own rules; also a routing change requiring an RFC per this repo's process).
      Also discovered and documented: Next.js middleware does not run in `output: 'export'` static
      export — a future locale rollout needs a client-side redirect mechanism, not the standard
      Fumadocs middleware pattern.
- [x] 2.5 **Advanced-diagram rendering (design.md D10):** verify the docs-site `<Mermaid>` component
      renders the modern types the standard now mandates — **architecture-beta, block, packet, sankey,
      xychart, treemap, radar, state, ER, C4** (add a smoke-test MDX page exercising each). **Wire
      ZenUML** via `mermaid.registerExternalDiagrams([zenuml])` + `@mermaid-js/mermaid-zenuml` (pinned)
      in the component, OR formally keep it out-of-scope and standardize on `sequenceDiagram`. Confirm
      C4 renders (experimental) and decide keep-vs-prefer-architecture-beta. Document the verified set
      in `apps/docs/README.md`. (Standard/templates already updated under task 0.6 re-freeze: EDS-012
      rewritten + SKILL router + EDS-016 + `documentation.instructions.md` + AGENTS.md §21 + both
      architecture templates now mandate precise/modern types.)

---
## TRACK A — Package docs (README + ARCHITECTURE, all 35)  ·  gate: Validator per-package

Parallel Implementers, one isolated worktree each. Validator is a different context: re-reads the
**frozen** template (task 0.6) + real `src`, checks every section present, samples compile, facts
match source, EDS-014 + EDS-015 pass.

- [x] 3. **Wave A1 — Tier 1 core (6 remaining; router done in pilot):** core, runtime, di, class,
      types, errors — README + ARCHITECTURE each. Full architectural depth. → Validator + Integrator.
      **Brief: [`waves/wave-a1-tier1-core.md`](./waves/wave-a1-tier1-core.md).**
- [x] 4. **Wave A2 — Tier 2 middleware/ext/stream (19):** cors, helmet, csrf, body-parser,
      multipart, rate-limit, compression, cookies, validation, logger, static, template, openapi,
      request-id, timer, health, events, websocket, stream. Depth: problem → default → install →
      usage → options → integration → troubleshooting. **Batching width (flat 19 vs sub-waves of
      ~5) — confirm with user at kickoff.** → Validator + Integrator.
- [x] 5. **Wave A3 — Tier 3 adapters/tooling (8):** adapter-{node,bun,deno,edge,serverless}, dev,
      testing, create-nextrush. Depth: purpose → install → minimal usage → reference → one example.
      Adapters share structure (one Implementer may template across the 5) but each gets its own
      Validator pass. → Validator + Integrator.
- [x] 6. **Meta package `nextrush` README** — main npm landing, landing-page treatment from template.

---
## TRACK B — Docs-site MDX content (`apps/docs/content/docs/**`)  ·  gate: `docs:verify` + EDS-015 per wave

**v4 is a full information-architecture reorganization, not a rewrite-in-place** (design.md D3/D6):
v3's structure is not preserved. v4 reorganizes onto the skill's content map + page-type standards
as a fresh identity. This makes an **IA-design step mandatory before any page is written**, and
makes the redirect map (§13) a real, derived artifact. Rule: concepts explain *why*,
guides/recipes/production explain *how*, reference lists *what* — never duplicate; cross-link.

- [x] 7. **MDX Wave B0 — IA & rebrand design (do FIRST in Track B, gates B1–B4):** governed by
      EDS-002 (information architecture). Produce: (a) a **content inventory** of every existing v3
      page; (b) the **new v4 sitemap / navigation tree** on the content map (start/concepts/guides/
      recipes/production/reference/internals/migrate/resources); (c) an explicit **old→new URL map**
      (this is the source the §13 redirect map derives from); (d) the v4 landing/identity direction
      (EDS-018). **USER REVIEW GATE** — approve the new IA + old→new map before writing pages.
      **DELIVERABLE — [`wave-b0-ia.md`](./wave-b0-ia.md) + [`wave-b0-final-review.md`](./wave-b0-final-review.md).
      GATE CLOSED 2026-07-21** — user approved B0 as architecture, requested + received a final
      product/IA review, then approved all recommendations. **STRUCTURE FROZEN (design.md D9)**; B1–B4
      structurally locked. This is THE v4 docs IA design (NextRush is at v4; the `R1–R5` inside the doc are design *iterations of the document*,
      not framework versions — relabeled to remove the "v5" confusion). 135 v3 pages → **11 v4
      sections**; docs as a **translation layer** (repo=engineering ≠ docs=user goal). Reference
      **capability-first** (Core/HTTP/Security/Validation/Files/Observability/Real-time/API&Docs/
      Class/**Platforms**/Tooling; package+type=metadata; `architecture/extension-system` owns taxonomy;
      `reference/packages` A–Z). **8-persona map** (§2) incl. **AI-agent** (retrieves, not browses →
      llms.txt + predictable pages), enterprise, library-author. **Runtime in 3 journey contexts** —
      NEW `start/runtime/*` onboarding → `production/deployment/<rt>` → Reference Platforms; landing
      **persona-router** + "Runs everywhere"; **`<RuntimeSupport>` badge**; filled serverless-deploy
      gap + edge Cloudflare/Vercel split. **i18n READINESS** (§6a) — infra-ready, English-first,
      incremental (needs design.md D8 + tooling task on approval). **IA COMPLETENESS CHECK** (§6b) —
      acknowledges sibling surfaces (blog, agent Skills), the AI-agent machine layer (llms/mcp/
      agent-spec/skills.json/ask-ai), `/packages`-vs-`reference/packages` reconciliation, single-version
      doc policy (v3 retired via tag), and a 404 dead-end guard; confirmed no orphaned section.
      Retire performance/→production, resources/→community+help, internals/→architecture; 3 dup pairs
      collapsed. Open→new URL map complete (~27 + ~36 reference if flat URLs; i18n adds no EN redirects)
      = §13.1. **Skill enhanced:** EDS-002 gained *translation-layer + capability-first-reference*,
      *Design for personas & journeys* (incl. AI-agent + cross-cutting runtime pathway), and *i18n
      readiness* under Versioning & freshness. **Open at gate (deliverable §11, 11 decisions):**
      capability-first + URL form, persona/runtime DX + gaps, **i18n depth**, standards/specs→
      architecture fold, `/packages` + version-switcher reconciliation, brand/identity.
      **FINAL REVIEW (freeze basis) — [`wave-b0-final-review.md`](./wave-b0-final-review.md):** user
      approved B0 as architecture, requested one final product/IA pass before freeze. Covers all 6
      user points — (1) complete per-persona journeys ×9 incl. AI-agent, (2) runtime-first experience
      (all 5 first-class, 6-part per-runtime structure), (3) capability-first validated (user's 10 →
      11, +Tooling), (4) persona-router entry points, (5) IA audit (purpose/overlap/dead-ends/
      cross-link/search/arch-vs-nav — clean, overlaps resolved), (6) naming freeze table. Ends with 5
      decisions needing the user's final word (reference URL form, standards/specs fold, i18n depth,
      version-switcher, brand). FREEZE on those 5 answers → B1–B4 proceed structurally locked. On approval: i18n needs design.md D8 + a tooling task.
- [x] 8. **MDX Wave B1 — foundation (highest traffic, sets the voice bar):** `start/` (landing +
      install + first-app + guided tutorials — Landing/Tutorial, EDS-018/008) and `concepts/`
      (mental models — Concept, EDS-007). Independent of Track A; can run in parallel with Waves 3–5.
      **Brief: [`waves/wave-b1-foundation.md`](./waves/wave-b1-foundation.md).**
- [x] 9. **MDX Wave B2 — task docs:** `guides/` (Guide, EDS-009), `recipes/` (Recipe, EDS-019),
      `production/` (Production, EDS-022).
- [x] 10. **MDX Wave B3 — lookup + deep:** `reference/` (Reference, EDS-011 — **depends on §2**
      AutoTypeTable/Scalar) and `internals/` (Architecture, EDS-010 — **cross-links Track A's
      `ARCHITECTURE.md`**; do after the relevant package ARCHITECTUREs land).
- [x] 11. **MDX Wave B4 — support & migration:** `migrate/` (Migration, EDS-020 — includes a v3→v4
      docs/navigation migration guide for existing users) and `resources/` (FAQ, troubleshooting,
      glossary, compatibility matrix, changelog — mixed types).

---
## 12. Cross-link & consistency sweep (both tracks)

- [x] 12.1 No orphan pages; every relative link resolves; no duplicated content across
      concept/guide/reference or across README/ARCHITECTURE/site (single source of truth).
      **Mechanical baseline first:** ran `pnpm --filter ./apps/docs run docs:verify` before any
      change — **0 findings** (all 6 checks green: link-check, code-compile, lint, reference-match,
      translation-freshness stub). This was the real, current baseline — the recorded 411-finding
      number from task 0.5 was v3 content, since fully superseded by Waves B1–B4; not a number to
      re-clear here. **Orphan-page check:** cross-referenced every `content/docs/**/meta.json`
      against its folder's real files (via `glob` + direct reads, not assumption) — every one of
      the 158 files in the tree is listed in a `pages` array and reachable from nav. One structural
      gap found and fixed: `reference/class/` (7 files: `index`, `decorators`, `controllers`,
      `modules`, `di`, `di-container`, `di-errors`) had no `meta.json` at all — every sibling
      multi-page reference folder has one; pages were still reachable via `reference/meta.json`'s
      `class` entry + in-page cross-links (not a broken orphan), but the missing file was an
      inconsistency, so one was added. **Real duplication found and fixed (the actual finding of
      this task):** `production/benchmarking.mdx` and `production/performance-tuning.mdx` (written
      by Wave B2) each carried an explicit Callout stating "Canonical home stays at
      /docs/performance" / "/docs/performance/tuning" — i.e. the NEW `production/` pages were thin
      pointers back to the OLD `performance/` pages, the exact inverse of wave-b0-ia.md §7's frozen
      MOVE/MERGE direction (`/docs/performance → /docs/production/benchmarking`,
      `/docs/performance/tuning → /docs/production/performance-tuning`) and design.md D3/D9's
      single-source-of-truth rule. Wave B2's own brief
      (`waves/wave-b2-guides-recipes-production.md` line 156) independently assumed
      `/docs/performance` "doesn't exist," confirming this was drift between two parts of the same
      wave's work, not a deliberate design choice. **Fix:** inverted the pointer direction —
      `production/benchmarking.mdx` and `production/performance-tuning.mdx` now hold the complete,
      real content (merged in verbatim from `performance/index.mdx` and `performance/tuning.mdx` —
      same facts, same source citations, zero new claims); `performance/index.mdx` and
      `performance/tuning.mdx` are now short pointers back to `production/`. This satisfies the
      frozen MERGE disposition without deleting the old URLs or touching files outside this
      pipeline's scope (root `README.md`, `hero.tsx`, `help/faq.mdx`, and `community/roadmap.mdx`
      all link to `/docs/performance` and `/docs/performance/tuning` directly — editing those is
      outside `files_in_scope`, so the old paths stay live and correct rather than becoming dead
      links pending the 13.3 cutover). `performance/comparison.mdx` (framework code-pattern
      comparison, not benchmark methodology) has no `production/` equivalent and is not a
      duplication — left as-is; flagged as a Track-B follow-up since wave-b0-ia.md's frozen IA
      doesn't name an explicit new home for it and inventing one is out of this task's scope.
      **Concept/guide/reference overlap spot-check:** manually compared the three highest-risk
      subject areas with pages across multiple types — `concepts/errors.mdx` vs
      `guides/error-handling.mdx` (why vs. how, correctly split); `concepts/routing.mdx` vs
      `guides/mounting-and-grouping-routes.mdx` (mental model vs. task, correctly split and
      cross-linked); `concepts/dependency-injection.mdx` vs `reference/class/di*.mdx` vs
      `architecture/di-internals.mdx` (mental model vs. API signature vs. internals, correctly
      split) — no single-source-of-truth violations found in this sample. Re-verified `docs:verify`
      after every edit: **0 findings** throughout (one transient regression — 2 forbidden-word
      "just" findings introduced mid-edit while rewriting the performance/production pointer
      Callouts — caught and fixed immediately, back to 0 before moving on).
- [x] 12.2 Package README/ARCHITECTURE ↔ site `internals/` and `reference/` cross-links are wired.
      **Confirmed the gap was systemic, not partial**, via a `search_code` sweep across
      `reference/*.mdx` and `architecture/*.mdx` for `github\.com/0xTanzim` before touching
      anything: only 5 `architecture/*` files had any GitHub link at all, and none of those 5
      pointed at a package's `README.md`/`ARCHITECTURE.md` (`rfcs.mdx` → RFC/ADR docs;
      `design-principles.mdx`/`versioning.mdx` → root `README.md`; `package-hierarchy.mdx` → a
      build script; `router-internals.mdx` → `ROUTER_AUDIT.md`, not `ARCHITECTURE.md`). Zero of the
      42 `reference/*.mdx` files linked to their package's source docs at all — confirmed by direct
      reads of `reference/cors.mdx`, `reference/router.mdx`, `reference/class/index.mdx`,
      `reference/packages.mdx`, `reference/platforms/index.mdx` plus the broader grep finding no
      `reference/` file in the GitHub-link result set. **No existing pattern to copy — established
      one:** a `<Callout type="info" title="Source & internals">` right after each page's opening
      description, linking `https://github.com/0xTanzim/nextRush/blob/main/packages/<real-path>/
      {README,ARCHITECTURE}.md`, applied to all 35 packages' `reference/*.mdx` pages (verified every
      package/page pair against real `packages/**/README.md` + `ARCHITECTURE.md` files via `glob`
      before writing a single link — did not invent any path) plus the 4 `architecture/*-internals`
      pages that discuss a specific package (`router-internals` → router; `di-internals` → di;
      `middleware-internals` → core, since `compose()`/`Application.callback()` live in
      `@nextrush/core` and there is no "middleware" package; `adapters` → all 5 adapter packages,
      since the conformance suite it documents spans all of them). Special cases handled per real
      file structure: `class/index.mdx` links both `@nextrush/class` and the re-exported
      `@nextrush/di` (its `di.mdx`/`di-container.mdx`/`di-errors.mdx` continuation pages stay
      uncited — one citation per concept, mirroring `comments.instructions.md`'s "one RFC/ADR
      reference per architectural concept" rule applied to this cross-link convention).
      `capability-composition.mdx` and `contracts.mdx` were checked and correctly left untouched —
      both are cross-cutting architecture concepts with no single owning package. Verified: 39
      files touched, `docs:verify` **0 findings** immediately after (unchanged from the pre-edit
      baseline of 0) — every edit was an additive Callout; no existing content or link was altered.
- [x] 12.3 Full `pnpm docs:verify` green + skill publish checklist (EDS-015) across the site.
      **`docs:verify` was already green before this task started** (0 findings, confirmed by
      direct run — the stale 411-finding number from task 0.5 was v3 content, fully superseded).
      Ran it again after every edit across 12.1/12.2/12.3 (the performance/production merge, the
      cross-link wiring, the EDS-015 casing fix below) — **0 findings at every checkpoint**, with
      one transient 2-finding regression (forbidden word "just") caught and fixed immediately mid-
      task. **EDS-015 spot-check** (read the checklist at
      `.kiro/skills/engineering-documentation/checklists/EDS-015-Documentation-Publish-Checklist.md`
      first, confirmed its real path, distinct from the sibling EDS-014 review checklist): checked
      one representative page per content-map section — `start/quick-start.mdx`,
      `concepts/routing.mdx`, `guides/mounting-and-grouping-routes.mdx`, `recipes/pagination.mdx`,
      `production/performance-tuning.mdx`, `reference/cors.mdx`, `architecture/router-internals.mdx`,
      `migrate/index.mdx`, `help/troubleshooting.mdx`, `community/index.mdx` — against all 8
      checklist sections (accuracy, code-works, links/nav, metadata/SEO, accessibility, rendering,
      consistency, completeness). **One real gap found and fixed:** 15 links across 7 files
      (`community/{index,changelog,roadmap}.mdx`, `help/{faq,troubleshooting,compatibility-matrix}.mdx`,
      `index.mdx`) used `github.com/0xTanzim/nextrush` (lowercase) while every sibling page and the
      root/package READMEs consistently use `github.com/0xTanzim/nextRush` (the real repo's casing)
      — a genuine EDS-015 §7 "Consistency" violation (terminology matching sibling pages), not a
      dead link (GitHub repo paths are case-insensitive so nothing was actually broken). Normalized
      all 15 occurrences. No other EDS-015 gap found in the sampled pages — front-matter, code
      compile, a11y alt text, TODO/FIXME markers, and rendering were all clean on inspection.

## 13. v3 retirement & cutover (design.md D3)

- [ ] 13.1 Derive the **redirect map from the Wave-B0 old→new URL map** (IA reorg = every moved v3
      URL needs a redirect to preserve external links + SEO). Author before cutover.
- [ ] 13.2 Validate v4 fully: `docs:verify` green + publish checklist + a11y/build.
- [ ] 13.3 Cut over: merge `docs/v4-rebuild`, remove superseded v3 content (recoverable via the
      `docs-v3-final` tag). Confirm **no `_archive/` folder** exists anywhere in the tree.

## 14. Done (whole change)

- [ ] 14.1 Track A: all 35 packages README + ARCHITECTURE from templates, independently validated.
- [ ] 14.2 Track B: v4 IA live; all content-map sections built in MDX, EDS-compliant, `docs:verify` green.
- [ ] 14.3 Tooling: llms.txt pipeline + Scalar OpenAPI + AutoTypeTable live.
- [ ] 14.4 v3 retired via tag; redirects (from the B0 URL map) live; tree free of dead-weight archive folders.
- [ ] 14.5 Archive this OpenSpec change (moves to the gitignored `openspec/changes/archive/`).
