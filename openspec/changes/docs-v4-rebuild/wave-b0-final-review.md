# v4 Docs — Final Product / IA Review & Freeze Record

> **Status:** the final architecture/product pass you asked for before freezing the structure.
> Companion to `wave-b0-ia.md` (the design) — this doc is the **freeze basis**: it answers your six
> review points, audits the IA for gaps, and freezes every name/URL before B1–B4. Once you sign off,
> the structure is frozen; B1–B4 change it only under an explicit, justified exception.
>
> **B0 is approved as architecture** (your call). This review polishes and freezes it.

---

## 1. Persona journeys (your point 1 — highest priority)

Every primary persona, with the five fields you asked for. Runtime developers share one journey
**shape** (§2 breaks out what differs per runtime) so this stays honest, not five copy-pastes.

### 1.1 Beginner learning backend
- **Entry point:** Landing → 🚀 "I'm new to backend"
- **Navigation path:** `start/` → `concepts/[Core]` → `guides/[HTTP]`
- **Main goals:** understand what a backend does, build a first working API, grasp the mental model
- **Destination pages:** `start/quick-start` → `concepts/routing`·`context`·`middleware` → `guides/rest-api`
- **Learning flow:** install → quick-start (working app) → *why it works* (Core concepts) → first real task (REST API) → recipe

### 1.2 Existing NextRush user
- **Entry point:** Landing → search / Reference / Changelog
- **Navigation path:** `reference/<capability>` · `recipes/` · `community/changelog`
- **Main goals:** look something up fast, adopt a new capability, see what changed
- **Destination pages:** capability Reference page · a Recipe · `migrate/upgrade-guide` · `community/changelog`
- **Learning flow:** direct lookup — no learning path; predictable Reference is the product for them

### 1.3 Migration user (Express / Fastify / Koa / NestJS)
- **Entry point:** Landing → 🔄 "I'm migrating from another framework"
- **Navigation path:** `migrate/from-<framework>` → `start/quick-start` → capability Reference + Recipes
- **Main goals:** map familiar API → NextRush, port an app, avoid gotchas
- **Destination pages:** `migrate/from-express` (etc.) → `reference/[Core]` · `recipes/`
- **Learning flow:** side-by-side diff → quick-start → port feature-by-feature via capability Reference → deprecations/breaking-changes

### 1.4 Runtime developer (Node · Bun · Deno · Edge · Serverless)
- **Entry point:** Landing → 🌐 "I'm targeting <runtime>" (the "Runs everywhere" router)
- **Navigation path:** `start/runtime/<rt>` → `production/deployment/<rt>` → `reference/[Platforms]/<rt>`
- **Main goals:** confirm it runs on my platform, ship a hello-world, deploy, know the limits
- **Destination pages:** `start/runtime/<rt>` → `production/deployment/<rt>` → `reference/platforms/<rt>` → `help/compatibility-matrix`
- **Learning flow:** onboard on my runtime → deploy → production-harden → adapter API lookup *(see §2)*

### 1.5 Contributor / framework engineer
- **Entry point:** Landing → 🏗 "I want to contribute" / Architecture
- **Navigation path:** `architecture/` → `community/contributing` → `architecture/rfcs`·`contracts`
- **Main goals:** understand how it's built, extend it safely, submit a change
- **Destination pages:** `architecture/package-hierarchy`·`design-principles`·`extension-system` → `community/contributing`
- **Learning flow:** mental model (architecture) → boundaries/invariants → contribution workflow → RFC process

### 1.6 Library / extension author
- **Entry point:** Landing → 🏗 Architecture / Reference
- **Navigation path:** `architecture/extension-system` → `architecture/contracts/*` → capability Reference
- **Main goals:** build a clean middleware/extension/adapter that fits the framework contract
- **Destination pages:** `architecture/extension-system` → `architecture/contracts/extension-api`·`middleware`·`adapter`
- **Learning flow:** extension taxonomy → the contract to implement → a reference implementation to model

### 1.7 AI agent (LLMs / code assistants)
- **Entry point:** `llms.txt` / `llms-full.txt` / `mcp.json` / `agent-spec.json` — **retrieves, never browses**
- **Navigation path:** direct page retrieval (search index, not sidebar)
- **Main goals:** return a correct, self-contained answer from a single retrieved page
- **Destination pages:** any Reference / Recipe / Example page (each self-contained by template design)
- **Learning flow:** none — success = **one retrieved page answers correctly out of context** (why the frozen templates enforce predictable, self-contained pages)

### 1.8 Evaluator / product owner
- **Entry point:** Landing persona-router → "Should we adopt?"
- **Navigation path:** Landing → Why · Who-is-this-for · Capabilities · Examples · benchmarks stance
- **Main goals:** judge fit, maturity, and honesty fast
- **Destination pages:** `/` (landing) · `examples/` · `production/benchmarking`
- **Learning flow:** value prop → capabilities → real examples → honest performance stance → decision

### 1.9 Enterprise / security-first team
- **Entry point:** Landing → Security / Production
- **Navigation path:** `guides/security`·`authentication` → `production/security`·`observability`·`scaling`
- **Main goals:** confirm it's secure, observable, and operable at scale
- **Destination pages:** `guides/authentication` · `production/security`·`reliability`·`scaling`
- **Learning flow:** security posture → auth → production hardening → observability → scaling

**Verdict:** every persona has a designed entry point, a low-friction path, and a success state. The
IA's acceptance test holds — no persona is stranded. ✅

---

## 2. Runtime experience — every runtime a first-class citizen (your point 2)

**Node is NOT the default with others bolted on.** The landing "Runs everywhere" router sends each
runtime developer down an **identical-shape journey**, so Bun/Deno/Edge/Serverless feel exactly as
first-class as Node.

```text
Landing "Runs everywhere"
   ↓
start/runtime/<rt>          ← per-runtime ONBOARDING hub (the "Runtime Guides" layer)
   ↓
production/deployment/<rt>  ← per-runtime DEPLOY + PRODUCTION
   ↓
reference/platforms/<rt>    ← per-runtime ADAPTER REFERENCE
```

Each runtime gets the full six-part experience you specified, mapped to real URLs:

| Your requirement | Where it lives | Notes |
| ---------------- | -------------- | ----- |
| **Installation** | `start/runtime/<rt>` § Install | runtime-specific (`bun add`, `deno add`, npm) |
| **Quick Start** | `start/runtime/<rt>` § Hello-world | runs on *that* runtime, not Node |
| **Runtime limitations** | `start/runtime/<rt>` § Limitations | e.g. no `node:*` on edge, cold starts on serverless |
| **Deployment** | `production/deployment/<rt>` | edge split → `cloudflare` / `vercel`; serverless → `lambda` |
| **Production** | `production/deployment/<rt>` § Harden | scaling/observability links per runtime |
| **Adapter Reference** | `reference/platforms/<rt>` | the adapter API surface |

Per-runtime specifics (what actually differs — proves each is first-class, not a footnote):

| Runtime | Install | Deploy targets | Key limitation to document |
| ------- | ------- | -------------- | -------------------------- |
| **Node** | `npm/pnpm add nextrush` | Docker · PM2 · systemd | baseline (full `node:*`) |
| **Bun** | `bun add nextrush` | Docker · Bun runtime | Bun-native APIs; parity notes |
| **Deno** | `deno add` / npm specifier | Deno Deploy · Docker | permissions model, npm compat |
| **Edge** | npm | **Cloudflare Workers** · **Vercel Edge** | no `node:*`; Web-standard only; size limits |
| **Serverless** | npm | **AWS Lambda** · Vercel Functions | cold starts; handler adapter; statelessness |

**Cross-cutting signal:** the `<RuntimeSupport>` badge on any feature page (`✅ Node · ❌ Edge …`)
means a runtime developer instantly knows if a capability fits — without leaving the page. One site,
many first-class onboarding paths. ✅

---

## 3. Capability-first navigation — validated (your point 3)

**Confirmed and adopted.** Users don't think in package names or "middleware/extension" — they think
in capabilities. Reference and Guides both organize capability-first. Reconciling your list with the
built map (§4/§5 of `wave-b0-ia.md`):

| Your capability | v4 nav category | Match |
| --------------- | --------------- | ----- |
| HTTP | HTTP | ✅ |
| Security | Security | ✅ |
| Validation | Validation | ✅ |
| Files | Files | ✅ |
| Real-time | Real-time & streaming | ✅ (streaming folded in — same mental space) |
| Observability | Observability | ✅ |
| API & Documentation | API & docs | ✅ |
| Platforms | Platforms | ✅ (renamed from "Adapters") |
| Core | Core | ✅ |
| Class Runtime | Class runtime | ✅ |
| *(none listed)* | **Tooling** (dev · testing · create-nextrush) | ➕ added — dev tools have no other home |

Two honest deltas from your list, both defensible: **"Real-time & streaming"** merges your "Real-time"
with streaming (SSE/NDJSON is the same reader intent — live data); **"Tooling"** is an 11th category
because `dev`/`testing`/`create-nextrush` are real packages with no capability home. Your 10 → **11**.

**Every page keeps the engineering truth visible** in its identity block — exactly as you asked:

```
Package:   @nextrush/cors      Category: Security      Type: Middleware
```

So navigation is capability-first (developer view) while package + type + category stay one glance
away (engineering view). Architecture preserved, DX optimized. ✅

---

## 4. Documentation entry points (your point 4)

**Confirmed as a product-UX decision.** The landing hero leads with the persona router — *"What
brings you to NextRush today?"* — mapping each answer to a first door:

| "What brings you here?" | Routes to | Persona (§1) |
| ----------------------- | --------- | ------------ |
| 🚀 I'm new to backend | `start/` | 1.1 |
| ⚡ I'm building an API | `guides/` | 1.2 / 1.9 |
| 🔄 I'm migrating from another framework | `migrate/from-<fw>` | 1.3 |
| 🌐 I'm targeting Node/Bun/Deno/Edge/Serverless | `start/runtime/<rt>` | 1.4 |
| 📚 I need the API Reference | `reference/` | 1.2 |
| 🏗 I want to contribute | `architecture/` + `community/contributing` | 1.5 / 1.6 |

Below the router: Why → Quick facts → Who-is-this-for (✓/✗) → Quick start → Capabilities →
Runs-everywhere → doc roadmap → popular guides/recipes/examples → Reference/Architecture → Community.
Voice per EDS-004 (honest, no superlatives). ✅

---

## 5. Information architecture audit (your point 5)

A real audit against your six checks — findings, not rubber-stamps.

### ✅ Every page has a clear purpose
Each section maps to exactly one Diátaxis intent (§4): `concepts`=why · `guides`=how (task) ·
`recipes`=copy-paste scenario · `examples`=complete app · `reference`=lookup · `architecture`=internals ·
`production`=day-2 ops. **Finding (resolved):** `guides` vs `recipes` vs `examples` overlap risk →
disambiguated by the frozen templates (Guide = one task with teaching; Recipe = production-ready
copy→adapt→ship; Example = complete runnable app). No page fits two.

### ⚠→✅ No overlapping categories
Audited every pair. Real overlaps found and resolved:
- `concepts/runtime-compatibility` (mental model) vs `help/compatibility-matrix` (the grid) vs
  `reference/platforms` (adapter API) — **three different intents**, cross-linked, not duplicated.
- `production/performance-tuning` vs `production/benchmarking` — tuning = how-to, benchmarking =
  methodology/numbers. Kept distinct (the v3 duplicate pairs are collapsed, §3).
- `guides/security` vs `production/security` — **guide** = implement auth/headers; **production** =
  harden/threat-model. Distinct, cross-linked.

### ✅ No dead ends
Every page ends in a `<Cards>` "Next steps / Continue learning" block (frozen template requirement).
Plus the **404 dead-end guard** (§6b of `wave-b0-ia.md`): search + persona-router + popular links.

### ✅ Cross-linking complete
Single-source-of-truth enforced: concepts explain *why* once; guides/reference link to them, never
re-explain. Spanning capabilities cross-link (multipart↔Files, rate-limit↔Observability, §5). CI
link-check (`docs:verify`) fails the build on any broken relative link.

### ✅ Predictable search
Client-side Orama index powered by frontmatter title/description (EDS-017). Capability-first labels +
self-contained pages mean a search for "CORS" lands on `reference/security/cors` directly — the same
predictability the AI-agent persona depends on.

### ✅ Package architecture vs user navigation separated
The core win: navigation is capability/goal-first (user view); package name + type + category live in
page **metadata** (engineering view); the middleware→registrar→extension→adapter taxonomy lives in
`architecture/extension-system`, **out of nav**. Two models, cleanly separated.

**Audit verdict:** no orphaned section, no unresolved overlap, no dead end. Structure is sound to
freeze.

---

## 6. Naming review — freeze before URLs exist (your point 6)

Decisions locked now, so we never rename after hundreds of pages exist:

| Name in question | Decision | Why |
| ---------------- | -------- | --- |
| `internals/` vs `architecture/` | **`architecture/`** | Matches package `ARCHITECTURE.md` + EDS-010 page type; "internals" sounds private/off-limits |
| `resources/` | **Split → `community/` + `help/`** | Two different audiences: participation vs. getting-unstuck |
| `resources/` → help naming | **`help/`** (not `support/`) | "Support" implies paid/SLA; "help" is honest for OSS |
| `adapters/` (reference) | **`Platforms/`** | Users target a *platform*; "adapter" is the mechanism, not their goal |
| `plugins` concept | **`extensions`** | Matches the framework's Extension taxonomy (canonical term) |
| Capability names | **HTTP · Security · Validation · Files · Observability · Real-time & streaming · API & docs · Core · Class runtime · Platforms · Tooling** | Reader-goal words, not package/type words |
| Runtime naming | **`node · bun · deno · edge · serverless`** (edge → `cloudflare`/`vercel`; serverless → `lambda`) | Lowercase, matches adapter package names + CLI |
| Production terms | **`deployment/` · `observability/` · `reliability` · `scaling` · `runbooks`** | On-call vocabulary (EDS-022), not marketing |
| `start/` vs `getting-started/` | **`start/`** | Shorter, cleaner URL; sidebar label can still read "Get started" |
| New concept pages | **`concepts/errors` · `concepts/streaming`** | Singular capability nouns, consistent with siblings |

Runtime onboarding hub label: sidebar reads **"Runtime guides"**, URL is `start/runtime/`.

---

## 7. Freeze checklist — FROZEN (gate closed 2026-07-21)

**Decided in this review (frozen — design.md D9):**
- ✅ 11-section IA + capability-first Reference + package/type as metadata
- ✅ Persona journeys (§1) + persona-router landing (§4)
- ✅ Runtime-first onboarding, all 5 first-class (§2)
- ✅ All names/URLs above (§6)
- ✅ IA audit clean — no overlaps/dead-ends/orphans (§5)

**The 5 open decisions — resolved (user approved recommendations + one refinement):**
1. **Reference URL form** → **flat** `reference/cors` — URL = identity, sidebar = organization. *(D9.1)*
2. **`standards/` + `specs/`** → **folded into `architecture/`** — sidebar: Design Principles ·
   Contracts (Extension API · Adapter Contract) · Request Lifecycle · **Capability Composition** ⊕ ·
   Package Hierarchy · internals · **RFC · ADR**. *(D9.3; §6)*
3. **i18n** → **i18n-ready infra + English-first + incremental** → design.md **D8** + a tooling task.
4. **`version-switcher`** → **RETIRE** — confirmed a disabled v3/v4 placeholder (references pruned
   PLAN.md); v4 is single-version; per-package versions live in Reference identity + compat matrix. *(D9.4)*
5. **Brand/identity** → **landing refresh + minimal docs** — premium/modern landing; simple/readable/
   professional docs (Rust/Go/React/Stripe model). Hero tagline decided at landing build (B4). *(D9.5)*

**Also confirmed frozen (the two "big decisions" flagged in feedback):** runtime experience (§2 — five
first-class journeys) and capability-first navigation (§3) — already defined here, now locked.

**STRUCTURE FROZEN.** B1–B4 proceed structurally locked; changes only under a justified, logged
exception. Diminishing returns reached — time to build.
