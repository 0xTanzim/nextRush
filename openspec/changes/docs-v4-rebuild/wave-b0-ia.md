# v4 Documentation — Information Architecture & Rebrand Design (Wave B0)

> **Status:** proposed — awaiting the USER REVIEW GATE (tasks.md §7). No pages are written until the
> IA + old→new URL map here are approved. Governed by **EDS-002** (documentation architecture) +
> **EDS-018** (landing). Source for the **§13.1 redirect map**.
>
> **This is THE v4 docs design.** NextRush is at **v4** — there is no "v5". The `R1…R5` below are
> **design iterations of this document** (how the design converged across review rounds), not
> framework versions. Throughout, "v3 docs" = the current published docs being replaced, "v4" = the
> target. Everything ships as v4.

**Design iterations (this document)**
- **R1** — 9-section proposal.
- **R2** — →11 sections (`internals`→`architecture`; `resources`→`community`+`help`; new `examples`;
  nav labels over folders; audience ownership).
- **R3** — Reference made **capability-first** (reversed a push-back on new evidence): a newcomer
  finds "CORS," not "middleware"; package+type become page metadata; taxonomy → `architecture/extension-system`.
- **R4** — **product/persona lens.** Persona→journey map (§2) + runtime & platform DX pathway (§6);
  docs framed as a **translation layer**; Reference "Adapters" → "Platforms"; landing Capabilities +
  "Runs everywhere" router; filled serverless-deploy gap, edge→Cloudflare/Vercel split.
- **R5** — deepened the product model + a new requirement: (a) **full 8-persona set** incl. **AI
  agent**, enterprise, library author; (b) a **runtime onboarding layer** `start/runtime/*` (runtime
  in **three journey contexts**); (c) an adaptive **`<RuntimeSupport>` badge**; (d) a **persona-first
  landing**; (e) **i18n readiness** (§6a). Plus the **IA completeness check** (§6b).

Companion: `proposal.md`, `design.md` (D1–D7), `tasks.md`.

---

## 1. Method — docs are a translation layer (EDS-002)

The repository reflects **engineering** (`packages/middleware/cors`); the documentation reflects
**user goals** (Security → CORS). We never mirror the package tree in navigation. Implementation
concepts (middleware · extension · registrar · adapter · "package type") are **page metadata**, and
the taxonomy is taught once in `architecture/extension-system`.

| Repository (engineering) | Documentation (user) |
| ------------------------ | -------------------- |
| `middleware/cors` | Reference → **Security → CORS** |
| `middleware/body-parser` | Reference → **HTTP → Body Parser** |
| `middleware/logger` | Reference → **Observability → Logger** |
| `middleware/openapi` | Reference → **API & Docs → OpenAPI** |
| `extensions/websocket` | Reference → **Real-time → WebSocket** |
| `adapters/edge` | Reference → **Platforms → Edge** |

Layers are **navigation labels + icons over semantic folders** (clean, stable URLs):
🚀 Start · 📚 Learn (concepts, architecture) · 🛠 Build (guides, recipes, examples, production) ·
📖 Reference · 🔄 Migration · 💬 Community · ❓ Help.

---

## 2. Personas → journeys (the product view)

The docs are a product with distinct customers. Every persona has a designed front door and a
path that ends in success — no persona hits a dead end (EDS-002 navigation).

| Persona | Comes asking | Front door | Path → success |
| ------- | ------------ | ---------- | -------------- |
| **Backend newcomer** | "Teach me." | Landing → 🚀 Start | Install → Quick-start tutorial → Concepts (Core) → Guides → *"I built and understood it."* |
| **Experienced switcher** (Express/Fastify/Koa/Nest) | "Show me the diff, fast." | Landing → "Coming from X" | Migration (per-framework) → Quick-start → capability Reference + Recipes → *"My project works."* |
| **Runtime user** (Deno · Edge · Serverless) | "Does it run on my platform, how do I ship, what's different?" | Landing → **"Runs everywhere"** | **`start/runtime/<rt>`** (onboard) → `production/deployment/<rt>` → Platforms reference → compat matrix → *"Deployed on my platform."* |
| **Enterprise / security-first team** | "Is it secure & operable at scale?" | Landing → Security/Production | Security · Authentication · Observability · Production · Scaling → *"It meets our bar."* |
| **Library / extension author** | "How do I extend it cleanly?" | 🏗 Architecture | extension-system · contracts · capability API · RFCs → *"I shipped an extension."* |
| **Operator / on-call** | "Keep it healthy." | 🛠 Production | Deployment · observability · runbooks · scaling · security → *"It survives prod."* |
| **Contributor / maintainer** | "How is it built, where can I extend?" | 🏗 Architecture | package-hierarchy · internals · rfcs → Community/contributing → *"I can contribute safely."* |
| **AI agent** (Claude/Codex/Copilot) | *(searches, doesn't browse)* | `llms.txt` · Reference · Recipes | Predictable, self-contained Reference/Recipe/Example pages + `llms-full.txt` (§2.1) → *"Correct answer retrieved."* |
| *(Evaluator / product owner)* | "Should we adopt?" | Landing persona-router (§9) | Why · Who-is-this-for · Capabilities · Examples · benchmarks stance → *"Decision made."* |

The **AI-agent persona is a first-class v4 audience** — it's why the `llms.txt`/`llms-full.txt`
pipeline (§2.1) and the *predictable, self-contained* structure the frozen templates enforce
matter: agents retrieve pages, they don't follow a learning path.

This map is the acceptance test for the IA: if a section serves no persona, cut it; if a persona
has no path, add one. (§6 exists because the *runtime user* had no front door.)

---

## 3. Content inventory (v3 docs — the "before")

**135 pages, 12 sections.** Dispositions:

| v3 section | Pages | v4 disposition |
| ---------- | ----: | -------------- |
| `start/` | 5 | Keep (absorb `hello-world`) |
| `concepts/` | 14 | Keep (Core/Execution/Class-runtime groups; +2 new) |
| `guides/` | 18 | Keep (domain groups; rehome tutorials/dups) |
| `recipes/` | 7 | Keep |
| `production/` | 17 | Keep (absorb `performance/`; +runbooks; **+serverless deploy**) |
| `reference/` | 44 | **Capability-first** (§4); "Adapters"→"Platforms"; package = metadata |
| `internals/` | 10 | **RENAME → `architecture/`** (+extension-system; move `contributing` out) |
| `migrate/` | 7 | Keep (+breaking-changes) |
| `resources/` | 7 | **RETIRE → `community/` + `help/`** |
| `performance/` | 3 | **RETIRE → `production/`** |
| `community/` | 2 | Keep & expand |
| root `index.mdx` | 1 | Rebuild as landing / nav hub |
| — | — | **NEW `examples/`** |

**Duplicates → one source of truth:** Contributing → `community/contributing`; Performance-Tuning →
`production/performance-tuning`; Benchmarks(+comparison) → `production/benchmarking`.

---

## 4. v4 sitemap — 11 sections

`⊕` new · `⤳` moved in · `[grp]` sidebar grouping (flat/stable URLs).

```text
/ (landing)         nav hub + Capabilities + "Runs everywhere" router + doc roadmap  [rebuilt]

start/       🚀      index · installation · quick-start · hello-world ⤳ · overview · create-nextrush
                     runtime/ ⊕ (node · bun · deno · edge · serverless — per-runtime ONBOARDING:
                                 install → hello-world → deploy → limitations → reference)

concepts/    📚      [Core] routing · context · middleware · errors ⊕
                     [Execution] request-lifecycle · lifecycle · streaming ⊕ · runtime-compatibility
                     [Class runtime] dependency-injection · guards · interceptors · exception-filters · modules
                     [Extending] extensions (was plugins)

guides/      🛠      [HTTP] custom-middleware · mounting-and-grouping-routes · rest-api · validation ·
                           file-upload · error-handling
                     [Security] authentication · security  [Data] database  [Testing] testing
                     [Class] class-based  [Realtime] websocket  [DX] generators · dev-tools

recipes/     🛠      jwt-authentication · rate-limiting · pagination · postgres-service ·
                     cors-multi-tenant · background-jobs

examples/ ⊕  🛠      complete reference apps: todo-api · blog-api · rest-api · jwt-api · chat-app · microservice

production/  🛠      index · configuration · caching · reliability · scaling · security ·
                     benchmarking ⤳ · performance-tuning ⤳ · runbooks ⊕
                     deployment/ (node · bun · deno · edge[cloudflare|vercel] · serverless[lambda] ⊕ · docker)
                     observability/ (logging · request-tracing)

reference/   📖      CAPABILITY-FIRST — package + type are page metadata, not navigation:
                     [Core] nextrush · core · router · runtime · types · errors
                     [HTTP] body-parser · multipart · cookies · compression
                     [Security] cors · helmet · csrf · rate-limit
                     [Validation] validation      [Files] static
                     [Observability] logger · health · timer · request-id
                     [Real-time & streaming] websocket · events · stream
                     [API & docs] openapi · template
                     [Class runtime] class (controllers · decorators · di · di-container · di-errors · modules)
                     [Platforms] node · bun · deno · edge · serverless        (was "Adapters")
                     [Tooling] dev · testing · create-nextrush
                     packages/ ⊕  A–Z package index (engineering-view lookup)

architecture/ 🏗     (was internals/; absorbs standards/ + specs/) design-principles ·
                     package-hierarchy · extension-system ⊕ (middleware→registrar→extension→adapter
                     — taxonomy, out of nav) · request-lifecycle · capability-composition ⊕ ·
                     router-internals · middleware-internals · di-internals · adapters · versioning ·
                     contracts ⊕ (extension-api · adapter-contract) · rfcs · adr ⊕

migrate/     🔄      from-{express,fastify,koa,nestjs} · upgrade-guide · deprecations ·
                     breaking-changes ⊕ · v3-to-v4-docs ⊕ (B4)

community/   💬      contributing (⤳ merges internals/contributing) · roadmap ⤳ · changelog ⤳

help/     ⊕  ❓      faq ⤳ · troubleshooting ⤳ · glossary ⤳ · compatibility-matrix ⤳
```

---

## 5. Capability → package map (Reference single-source-of-truth)

All 35 packages, one canonical home each; spanning concerns cross-linked (never duplicated):

| Capability (nav) | Packages | Cross-link |
| ---------------- | -------- | ---------- |
| **Core** | nextrush · core · router · runtime · types · errors | — |
| **HTTP** | body-parser · multipart · cookies · compression | multipart↔Files |
| **Security** | cors · helmet · csrf · rate-limit | rate-limit↔Observability |
| **Validation** | validation | — |
| **Files** | static | ↔HTTP (uploads) |
| **Observability** | logger · health · timer · request-id | — |
| **Real-time & streaming** | websocket · events · stream | — |
| **API & docs** | openapi · template | — |
| **Class runtime** | class · di | — |
| **Platforms** | adapter-node · bun · deno · edge · serverless | ↔Production/deployment |
| **Tooling** | dev · testing · create-nextrush | — |

Each page's identity block states **Type** (Middleware · Extension · Registrar · Adapter · Core ·
Tooling), so the reader learns the architecture naturally.

---

## 6. Runtime & platform DX (the multi-runtime pathway)

Multi-runtime support (**Node · Bun · Deno · Edge · Serverless**) is a headline differentiator, so a
runtime user gets a **first-class cross-cutting pathway** — **one documentation site, many onboarding
paths** (NOT a runtime dropdown that rewrites the whole site — too complex, rejected). Runtime
appears in **three journey contexts**, so a Deno/Cloudflare/Lambda user never reads Node pages:

1. **Landing "Runs everywhere" router** — five cards (Node/Bun/Deno/Edge/Serverless) → each deep-links
   to `start/runtime/<rt>`, the runtime user's front door (§2).
2. **`start/runtime/<rt>` = per-runtime ONBOARDING** ⊕ (the layer v4 was missing). Each page:
   install/scaffold → hello-world → deploy → **limitations/gotchas** (e.g. no `node:*`, cold starts) →
   next → Reference. A Cloudflare dev goes Landing → `start/runtime/edge` → deployed, without a
   detour through Node install/Express-migration.
3. **`production/deployment/<rt>` = per-runtime DEPLOY** how-to. **Gaps to fill:** add **`serverless`**
   (Lambda/Vercel Functions — `adapter-serverless` has no deploy guide today); **split `edge`** into
   Cloudflare Workers + Vercel Edge (different flows).
4. **Reference → Platforms** = the adapter API lookup per runtime.
5. **Adaptive per-page support badge** — a **`<RuntimeSupport>`** component (new, build in B1/B3)
   renders the real matrix on any feature page: `✅ Node · ✅ Bun · ✅ Deno · ❌ Edge · ⚠ Serverless`.
   The Reference identity block already carries a **Runtime** row; this generalizes it so a reader
   instantly knows if a feature fits their target (the "adaptive docs" idea — same site, contextual
   signal). Backed by the compatibility matrix as source of truth.
6. **`help/compatibility-matrix`** = authoritative grid; **`concepts/runtime-compatibility`** = the
   "edge-first, Web-standard, no `node:*`" mental model.

Progression: **Start (onboard) → Production (deploy) → Reference (adapter API)** — the same runtime
in different contexts. A Node dev simply ignores the runtime pages; a Deno/edge/serverless dev has a
complete, first-class journey — without a redundant top-level section and without splitting the site.

---

## 6a. Internationalization (i18n) readiness — new v4 capability

v4 docs should be **i18n-*ready*, not i18n-*complete*** (needs design.md **D8** + a §2-style tooling
task on approval). Two very different costs:

- **UI-chrome i18n** (nav labels, search, "on this page", theme toggle) — Fumadocs supports this
  natively (`i18n` config, `defineI18n`, `[lang]` routing). **Cheap** — wire it now.
- **Content i18n** (translating 135+ MDX pages) — **expensive and ongoing.** Every v4 change must
  re-sync every language, and **stale/partial translations are worse than none** (a reader on an
  outdated localized page is actively misled) — which violates the honesty ethos the whole doc set
  is built on (EDS-001/017 freshness).

**Recommendation (product owner):**
1. **Wire the infrastructure now** — Fumadocs `i18n` with a **hidden default locale** so English
   URLs are unchanged (`/docs/concepts/routing`; other locales get `/docs/<lang>/…`) → the §7
   redirect map is unaffected for English. Add a locale switcher + translatable UI chrome.
2. **Content stays English-first.** Do **not** block v4 on translating everything — unsustainable
   and guarantees drift.
3. **Translate incrementally** — highest-value first (landing → start → top concepts), **only for a
   language with a committed maintainer**, via a translation platform (Crowdin/Weblate) + human
   review + a **CI "translation-freshness" check** (flag a localized page older than its English
   source). `docs:verify` must learn to scope to `[lang]` when translations exist.

**Out of scope for v4:** translating the full corpus, or any language without a maintainer.
**In scope:** i18n-ready routing + UI chrome + a documented incremental workflow. This is the same
staleness/canonical-URL discipline v4 already applies to versioning (EDS-002/017).



## 6b. IA completeness check — the full product surface & gaps

The docs product is larger than `/docs/**`. This check confirms nothing is orphaned:

- **Sibling content surfaces (keep, cross-link — not part of the `/docs` tree):**
  `content/blog/` (release announcements + design deep-dives — 3 posts today) and `content/skills/`
  (shippable **agent Skills**, e.g. `nextrush.mdx`). The landing routes to Blog (Community) and to
  Skills (the AI-agent path). They are distinct content types, not doc sections.
- **AI-agent surface = the AI-agent persona's front door (§2).** A coherent machine-readable layer
  already exists and v4 keeps/refreshes it: `llms.txt` + `llms-full.txt` (§2.1), `ask-ai-index.json`,
  `mcp.json`, `agent-spec.json`, `skills.json`. Agents *retrieve*, they don't browse — so predictable
  Reference/Recipe/Example structure (frozen templates) + these endpoints are the design for them.
- **`/packages` showcase vs `reference/packages`:** the app has a marketing `/packages` showcase and
  v4 adds a docs `reference/packages` A–Z index. **Decision:** `/packages` = marketing overview
  (home-adjacent); `reference/packages` = the in-docs lookup. Cross-link both; do not duplicate the
  catalog data (single source — reuse `package-registry`).
- **Doc-site versioning:** v4 is **single-version (current)**; v3 is retired via the `docs-v3-final`
  tag + redirects (§13), **not** kept as a live switchable version. The existing `version-switcher`
  component's role must be confirmed at the gate (retire if it was a v3/v4 toggle; keep if it maps
  package versions). Per-package versions (3.1.0 core / 1.0.0 middleware) are surfaced via each
  Reference page's identity block + `help/compatibility-matrix`, not a global site version.
- **404 / dead-end guard (EDS-002 "never a dead end"):** ship a helpful not-found page that offers
  **search + the persona-router + popular links** — a runtime/newcomer who mistypes a URL still gets
  routed, not stranded.
- **Already covered (confirmed present):** client-side **search** (Orama) powered by titles/
  descriptions (EDS-017); **sequential prev/next** for `start/` tutorial series (EDS-002); **OG/SEO**
  (`/og`, sitemap, robots); **accessibility** (a11y contrast work in `source.config.ts`).

**No orphaned section, and every persona (§2) has a served surface** — including the machine one.



## 7. Old → new URL map (source for §13.1)

Legend: **MOVE**/**MERGE** → redirect · **KEEP** → none · **NEW** → no v3 source.

### Renamed / retired sections
| v3 URL | v4 URL | Disposition |
| ------ | ------ | ----------- |
| `/docs/internals/*` (9) | `/docs/architecture/*` | MOVE |
| `/docs/internals/contributing` | `/docs/community/contributing` | MERGE |
| `/docs/performance` · `/performance/comparison` | `/docs/production/benchmarking` | MERGE |
| `/docs/performance/tuning` | `/docs/production/performance-tuning` | MERGE |
| `/docs/resources/{faq,troubleshooting,glossary,compatibility-matrix}` | `/docs/help/*` | MOVE |
| `/docs/resources/{roadmap,changelog}` | `/docs/community/*` | MOVE |
| `/docs/resources` | `/docs/help` | MOVE |

### Reference — capability reorg (flat package URLs recommended)
| v3 URL (pattern) | v4 URL | Disposition |
| ---------------- | ------ | ----------- |
| `/docs/reference/{core,middleware,plugins,adapters}/{pkg}` | `/docs/reference/{pkg}` | MOVE (~36) |
| `/docs/reference/class/*` | `/docs/reference/class/*` | KEEP (cohesive) |
*(Zero-churn alternative: KEEP folder URLs, regroup sidebar only.)*

### Rehomed pages
| v3 URL | v4 URL | Disposition |
| ------ | ------ | ----------- |
| `/docs/guides/hello-world` | `/docs/start/hello-world` | MOVE |
| `/docs/guides/migration` | `/docs/migrate` | MERGE |
| `/docs/guides/deployment` | `/docs/production/deployment` | MERGE |
| `/docs/concepts/plugins` | `/docs/concepts/extensions` | MOVE |

### New (no v3 source)
`concepts/{errors,streaming}` · `examples/*` · **`start/runtime/{node,bun,deno,edge,serverless}`** ·
`production/runbooks` · `production/deployment/serverless` · `architecture/{extension-system,contracts/*}` ·
`reference/packages` · `migrate/breaking-changes` · `migrate/v3-to-v4-docs`. *(i18n adds a `[lang]`
routing segment; the hidden default locale keeps all English URLs above unchanged — no new redirects.)*

**Redirect summary:** ~27 section/rehome + ~36 reference (if flat URLs) = §13.1 input.
> ⚠️ Cutover fixups: root `README.md` links `/docs/performance` + `/docs/api-reference`;
> `appConfig.llms.sectionTitles` v3 keys → v4 (task 2.1).

---

## 8. Per-section audience ownership (EDS-002)

Start → first-timers · Concepts → learners · Guides → feature-builders · Recipes → solution-copiers ·
Examples → learn-from-complete-apps · Production → operators/on-call · Reference → capability lookup ·
Architecture → contributors/maintainers · Migration → upgraders/switchers · Community → contributors/
followers · Help → anyone blocked. (Runtime users are served cross-cuttingly, §6.)

---

## 9. Landing & identity (EDS-018)

Root `/` = navigation hub, led by a **persona router — "What brings you to NextRush today?"**:
🚀 New to backend → Start · ⚡ Building an API → Guides · 🔄 Migrating → Migration ·
🌐 Deploying to Node/Bun/Deno/Edge/Serverless → `start/runtime/<rt>` · 📚 Need the API → Reference ·
🏗 Understand the architecture → Architecture · 🤝 Contribute → Community. Then: Hero → Why →
Quick facts → **Who is this for?** (✓/✗) → Quick start → **Capabilities** (HTTP · Security ·
Validation · Files · Real-time · Streaming · Templates · OpenAPI · Observability · Testing ·
Deployment — each → Guides→Reference→Architecture) → **Runs everywhere** (Node·Bun·Deno·Edge·
Serverless → `start/runtime/<rt>`, §6) → Documentation roadmap → Popular guides · recipes · Examples →
Reference · Architecture → Community. **Voice** (EDS-004): honest, engineering-first, no superlatives.

**Open (your call):** hero tagline; visual identity (keep theme vs. refresh); "rebrand" scope.

---

## 10. Feedback disposition (running)

| Feedback | Verdict |
| -------- | ------- |
| Reference capability-first; package = metadata | ✅ Adopt (R3) |
| Docs as translation layer (repo≠docs structure) | ✅ Adopt (R4, §1) |
| Reference "Adapters" → "Platforms" | ✅ Adopt |
| "Capabilities" entry point on landing | ✅ Adopt (§9) |
| Extension taxonomy → `architecture/extension-system` | ✅ Adopt |
| `internals`→`architecture`; `resources`→`community`+`help`; `examples`; nav labels; audience map | ✅ Adopt (R2) |
| **Persona-driven journeys + runtime DX pathway** | ✅ Adopt (R4, §2/§6) — *your product ask* |
| **Fill serverless deploy gap; split edge Cloudflare/Vercel** | ✅ Adopt (§6) — *gap found* |
| **8-persona set incl. AI agent / enterprise / library author** | ✅ Adopt (R5, §2) |
| **`start/runtime/*` onboarding layer (3 journey contexts)** | ✅ Adopt (R5, §4/§6) |
| **`<RuntimeSupport>` per-page badge (adaptive docs)** | ✅ Adopt (R5, §6 — build B1/B3) |
| **Persona-router landing ("What brings you here?")** | ✅ Adopt (R5, §9) |
| **i18n support** *(your new requirement)* | ✅ Adopt as **i18n-ready** (R5, §6a) — infra now, English-first content, incremental translation; NOT full-corpus translation |
| Whole-docs runtime switching (Option 1 in feedback) | ❌ Reject — too complex; one site + many onboarding paths instead |
| Recipes `integrations/` | 🟡 Defer (grows in recipes/) |
| `standards/` + `specifications/` as top sections | 🟠 Fold into `architecture/` (overlap/sprawl) |

---

## 11. Decisions requiring approval at the gate

1. **11-section v4 IA** (§4) + layer→nav-label model + docs-as-translation-layer (§1). **[structural]**
2. `internals`→`architecture`; `resources`→`community`+`help`; new `examples`. **[structural]**
3. Collapse the 3 duplicate pairs. **[structural]**
4. **Reference capability-first**; "Adapters"→"Platforms"; package/type as metadata;
   `architecture/extension-system`; `reference/packages` A–Z. **[the big change]**
5. **Persona map (§2, 8 personas incl. AI-agent) + runtime DX (§6)** — landing **persona-router** +
   **"Runs everywhere"**, the **`start/runtime/<rt>` onboarding layer**, deploy-page hubs, **new
   `serverless` deploy page**, **edge → Cloudflare/Vercel split**, and a **`<RuntimeSupport>` badge**
   on feature pages. One site, many onboarding paths (whole-docs runtime switching rejected). **[product/DX]**
6. **i18n readiness (§6a)** — wire Fumadocs i18n infra (hidden default locale, keeps EN URLs), UI
   chrome translatable; content English-first + incremental workflow; **NOT** full-corpus translation.
   Needs **design.md D8** + a tooling task on approval. **[your new requirement — confirm depth]**
7. **Reference URL form:** flat `reference/<pkg>` (recommended) vs keep-folders + sidebar regroup
   (zero-churn). **[confirm]**
8. New pages (§7 "New"): concepts/errors·streaming, start/runtime/*, production/runbooks·deployment/
   serverless, architecture/extension-system·contracts, reference/packages, migrate/breaking-changes. **[scope]**
9. `standards/`/`specifications/` fold into `architecture/`. **[confirm push-back]**
10. Old→new URL map (§7) complete as §13.1 source. **[verification]**
11. Brand/identity specifics (§9). **[your input]**

On approval, this unblocks **B1** (start/ + concepts/) — the voice bar for everything after.
