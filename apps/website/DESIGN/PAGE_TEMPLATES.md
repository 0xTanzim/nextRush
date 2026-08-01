# Page Templates: Guides, Recipes, Examples

> Design spec for the three content types that form NextRush documentation's teaching layer.
>
> Every page type solves a different developer problem. Their layouts are intentionally distinct so developers know *what they're reading* before they read the title.

---

## The Triad

```
                    ┌─────────────┐
                    │   CONCEPTS  │
                    │ (why it     │
                    │  works)     │
                    └──────┬──────┘
                           │ explains
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │  GUIDE  │──│ RECIPE  │──│ EXAMPLE │
        │(teaches)│  │ (solves)│  │ (shows) │
        └────┬────┘  └─────────┘  └────┬────┘
             │                         │
             │       ┌─────────┐       │
             ├──────▶│REFERENCE├───────┘
             │       │(lookup) │
             │       └─────────┘
             │
             ▼
        ┌──────────┐
        │PRODUCTION│
        │(operate) │
        └──────────┘
```

| | Guide | Recipe | Example |
|---|---|---|---|
| **Goal** | Teach how to build something | Solve one integration task | Show a complete project |
| **Time** | 10-30 min | 5-10 min | 30-120 min |
| **Depth** | Step-by-step walkthrough | Copy-paste and adapt | Architecture + run |
| **Code** | Full code per step | One complete snippet | Full repo to clone |
| **Prose** | Explanatory | Minimal | Architectural |

---

## Content Governance — When to create each page type

Before creating any page, use this decision matrix to pick the right type:

```
Need to teach a concept?
  → Concept page (mental model, no code)

Need to teach how to build something step by step?
  → Guide

Need to show one tool integration (copy-paste)?
  → Recipe

Need to show a complete working project?
  → Example

Need pure API signatures?
  → Reference

Need to compare trade-offs between options?
  → Comparison page

Need a pure verification list?
  → Checklist

Need error → cause → fix?
  → Troubleshooting hub or recipe troubleshooting section
```

This prevents duplicate content. If you can't answer "which type?" clearly, the content is unfocused — reframe it.

---

## Section Classification Levels

Not all sections are mandatory. Over-prescribing burns authors. Three levels:

| Level | Meaning |
|---|---|
| **Required** | Every page MUST contain this. Skip only with design review sign-off. |
| **Recommended** | Include when it adds value. Use judgment. If unsure, include it. |
| **Conditional** | Only when applicable (alternatives exist, concept has related comparison, etc.) |

All section tables in this document use these three levels.

---

## Page Lifecycle

Documentation ages. Every page has a lifecycle status.

Managed in frontmatter:

```yaml
---
lifecycle: stable    # draft | review | stable | deprecated | archived
superseded_by: ~    # path to replacement page (when deprecated/archived)
---
```

| Status | Meaning | Search behavior |
|---|---|---|
| `draft` | In progress, not published | Hidden from search, visible with ?draft=1 |
| `review` | Written, needs technical review | Visible, banner: "Under review" |
| `stable` | Reviewed, accurate, maintained | Normal |
| `deprecated` | Still works but superseded | Visible, banner: "Deprecated — use [link]" |
| `archived` | Old version, kept for reference | Hidden from search, direct URL still works, banner: "Archived" |

All pages default to `stable` if lifecycle field is absent.

---

## Version Strategy

The metadata card shows `v4+` / `v4.2+` — this means the minimum framework version.

When multiple framework versions need separate documentation (e.g. NextRush 3, 4, 5), the site version-switcher routes to a different `content/` tree. Templates remain identical across versions — only the content changes.

Lifecycle status handles per-version deprecation:
```
JWT v3 → lifecycle: archived
JWT v4 → lifecycle: stable
JWT v5 → lifecycle: draft
```

---

## Accessibility Rules

Every page must satisfy these non-negotiable rules:

- **Heading hierarchy** — `h1` (title) → `h2` (sections) → `h3` (subsections). Never skip levels.
- **Table captions** — every table has a `<caption>` or markdown-equivalent description.
- **Alt text** — every image/diagram has meaningful alt text describing the content, not just "architecture diagram."
- **Mermaid fallbacks** — every Mermaid diagram has a preceding text description or table alternative for screen readers.
- **Color-independent callouts** — callouts use icons (💡 ⚠️ ⚙️ ⚡ 🔒 ❌) in addition to color. Meaning is never conveyed by color alone.
- **Code copy labels** — every code block has a visible "Copy" button label for screen readers.
- **Link text** — inline links use descriptive text ("→ Concepts: Middleware"), never "click here" or bare URLs.

---

## Mobile Rules

- **Inline ASCII diagrams** — use vertical flow where horizontal doesn't fit:

  ```
  Desktop:        Browser → JWT → API → Database
  Mobile fallback:
                  Browser
                     ↓
                    JWT
                     ↓
                   API
                     ↓
                Database
  ```

- **Tables** — wide tables get horizontal scroll. Never shrink font to fit.
- **Metadata card** — wraps to two lines on narrow screens (difficulty + time on line 1, version + runtime on line 2).
- **Code blocks** — horizontal scroll, never word-wrap code.

---

## Empty-State Rules

When a section has no related content yet, don't leave a hole:

| Situation | Behavior |
|---|---|
| No related recipes | Omit the cross-link. No "None yet" placeholder. |
| No examples yet | Omit the cross-link. |
| Experimental feature | Banner: `🧪 Experimental — API may change` |
| Coming soon | If linked from roadmap, show: `🔮 Coming in v4.5` |
| Deprecated page | Banner + auto-redirect to superseding page after N seconds |

Never render empty cross-link blocks. Remove the entire block if no links exist.

---

## Standardized Callout Taxonomy

One design language for all inline callouts across every page type.

```
> 💡 Tip
> Useful shortcut or best practice.

> ⚠️ Warning
> Something that could go wrong.

> ⚙️ Production
> Operational concern for production deployments.

> ⚡ Performance
> Performance implication or optimization.

> 🔒 Security
> Security boundary or threat model.

> ❌ Common mistake
> Pitfall people hit regularly.
```

These are the ONLY callout types. Use them consistently. Never invent ad-hoc callouts.

Callouts must use icons + text (not color alone) for accessibility.

---

## Search Keywords (Frontmatter)

Every page exposes search aliases in frontmatter:

```yaml
---
title: JWT Authentication
keywords: [bearer, token auth, authorization header, stateless auth, jwt middleware]
aliases: [jwt-v3, token-based-auth]   # renamed/moved pages point here
---
```

Keywords improve findability. Aliases handle renamed pages without breaking search.

Future: `synonyms` and `misspellings` fields can be added when search analytics show the need.

---

## Unified Metadata Card

Every page starts with a compact metadata card. Developers decide relevance in seconds.

```
┌──────────────────────────────────────────┐
│ 🛠  Guide                                │
│                                          │
│  # JWT Authentication                    │
│                                          │
│  🟡 Intermediate  •  20 min  •  v4+     │
│  Node  •  Bun  •  Deno                   │
│                                          │
│  > Add JWT auth to your NextRush app.    │
└──────────────────────────────────────────┘
```

**Keep the card compact** — difficulty, time, version, runtime only. Prerequisites go in "Before you start."

| Field | Required? | Values |
|---|---|---|
| Difficulty | ✅ Required | 🟢 Beginner / 🟡 Intermediate / 🔴 Advanced |
| Time | ✅ Required | Always |
| Version | ✅ Required | `v4+` / `v4.2+` / `experimental` / `deprecated` |
| Runtime | ✅ Required | Node · Bun · Deno · Cloudflare |

Managed in frontmatter:

```yaml
---
title: JWT Authentication
type: guide
difficulty: intermediate
time: 20 min
version: ">=4.0"
runtimes: [node, bun, deno]
keywords: [bearer, token auth, authorization header]
aliases: []
lifecycle: stable
---
```

---

## Before You Start Block

Immediately below the metadata card. Compact checklist format.

```
┌── Before you start ──────────────────────────┐
│                                              │
│  📋 What you'll finish with:                 │
│  ✓ Login endpoint                            │
│  ✓ Refresh token rotation                    │
│  ✓ Protected route middleware                │
│                                              │
│  📖 You should already know:                 │
│  ✓ Middleware           → Concepts           │
│  ✓ Routing              → Concepts           │
│                                              │
│  📐 Assumptions:                             │
│  - REST API architecture                     │
│  - Stateless authentication                  │
│  - SPA frontend (no SSR)                     │
│                                              │
│  🔢 Estimated: 20 min  •  4 sections  •  3  │
│     code blocks                              │
│                                              │
└──────────────────────────────────────────────┘
```

**Required** for all Guides, Recipes, and Examples.

Three sub-sections:
- **What you'll finish with** — checkmark list of concrete outcomes
- **You should already know** — prerequisites with concept links
- **Assumptions** — context the content depends on (prevents misapplication)
- **Estimated** — time, sections, code blocks count

---

## Decision Trees

**Conditional** — only when a page involves choosing between alternatives.

```
Need authentication?

        │
        ▼

  Need OAuth / social login?
        │
    ┌───┴───┐
   YES      NO
    │        │
    ▼        ▼
  Better    Need server
   Auth     sessions?
               │
           ┌───┴───┐
          YES      NO
           │        │
           ▼        ▼
       Sessions    JWT
```

Render as ASCII in markdown or Mermaid flowcharts. Links to Comparison pages when available.

---

## Visual Components Registry

These reusable UI components are referenced across templates. Each is defined once. When implementing, build each as a single MDX component, not ad-hoc markup.

| Component | Used in | Notes |
|---|---|---|
| **MetadataCard** | All pages | Renders difficulty, time, version, runtime from frontmatter |
| **BeforeYouStart** | Guide, Recipe, Example | Accordion/collapsible on mobile |
| **DecisionTree** | Guide, Recipe | Accepts Markdown or Mermaid source |
| **ComparisonTable** | Guide | Feature comparison grid |
| **CompatibilityTable** | Recipe | Runtime × version matrix |
| **TroubleshootingTable** | Recipe | Error → Reason → Fix |
| **Callout** | All pages | 💡 ⚠️ ⚙️ ⚡ 🔒 ❌ — single polymorphic component |
| **FinishedResult** | Guide | Tabbed view: folder tree, API response, screenshot |
| **LearningPath** | Section index page | Progress bar + prev/current/next |
| **CrossLinks** | All pages | Bottom linking block |
| **MetadataBar** | Recipes | Time + category + difficulty badge line |
| **CodeBlock** | All pages | With copy button, language label, line numbers |
| **LifecycleBanner** | All pages | Draft / deprecated / archived / experimental banners |
| **ArchitectureDiagram** | Example | C4 or sequence diagram with screen-reader fallback |

Each component documents: purpose, props, accessibility requirements, responsive behavior. Do not reimplement — use the shared component library.

---

## 🛠 Guide Template — "Teach how to build something"

### Full layout

```
┌──────────────────────────────────────────────────────────────┐
│ 🛠  Guide                                                    │
│                                                              │
│  # JWT Authentication                                        │
│                                                              │
│  🟡 Intermediate  •  20 min  •  v4+                          │
│  Node  •  Bun  •  Deno                                       │
│                                                              │
│  > Build complete JWT auth — signup, login, refresh,         │
│  > and protected routes.                                     │
│                                                              │
│  ┌── Before you start ──────────────────────────────────────┐│
│  │  📋 ✓ Login • ✓ Refresh • ✓ Protected routes            ││
│  │  📖 Middleware → Concepts • Routing → Concepts           ││
│  │  📐 REST API, Stateless, SPA frontend                    ││
│  │  🔢 20 min • 4 sections • 3 code blocks                 ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ⚖️  JWT vs Sessions vs Better Auth                          │
│  (Conditional — only when alternatives exist)                │
│                                                              │
│  │ Feature      │ JWT │ Sessions │ Better Auth       │       │
│  │--------------│-----│----------|-------------------│       │
│  │ Stateless    │ ✅  │ ❌       │ ✅                │       │
│  │ Social login │ ❌  │ ❌       │ ✅                │       │
│  │ Server-side  │ ❌  │ ✅       │ ✅                │       │
│  │ Self-contained│ ✅ │ ❌       │ ❌                │       │
│                                                              │
│  > Full comparison → Comparison: Auth Strategies             │
│                                                              │
│  ┌── Decision tree ─────────────────────────────────────────┐│
│  │ Conditionally shown — omitted when no branching choice   ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ## What you'll build  (Required)                            │
│                                                              │
│  Browser → JWT → API → Database                              │
│                                                              │
│  ## 1. Install                                               │
│  ```bash                                                     │
│  > 💡 Tip: Use pnpm for faster installs                      │
│  ```                                                         │
│                                                              │
│  ## 2. Create middleware                                     │
│  ```ts                                                       │
│  import { createMiddleware }  → 📚 Reference  (first use)    │
│  ```                                                         │
│                                                              │
│  ## 3. Protect routes                                        │
│  ```ts                                                       │
│  > 🔒 Security: Never store tokens in localStorage          │
│  > ⚙️ Production: Rotate refresh tokens every 15 min        │
│  ```                                                         │
│                                                              │
│  ## Finished result  (Required)                              │
│                                                              │
│  ```                                                         │
│  src/                                                        │
│  ├── middleware/auth.ts                                      │
│  ├── routes/{login,protected}.ts                             │
│  └── lib/jwt.ts                                              │
│  ```                                                         │
│                                                              │
│  ```json                                                     │
│  POST /api/login → { "token": "eyJ...", "refresh": "..." }  │
│  ```                                                         │
│                                                              │
│  ## Common mistakes  (Required)                              │
│  ❌ Wrong middleware order  → auth before routes             │
│  ❌ No refresh rotation     → implement refresh grant        │
│  ❌ Sync crypto in handler  → use crypto.subtle              │
│                                                              │
│  🧠 Related concept: Request Lifecycle → Concepts            │
│  (Conditional — only when concept page exists)               │
│                                                              │
│  ── cross-links ──  (Required)                               │
│                                                              │
│  ▸ 🍳  Recipe: Better Auth                                   │
│  ▸ 📦  Example: SaaS Starter                                 │
│  ▸ 📚  Reference: @nextrush/jwt                              │
│  ▸ ⚙️  Production: Security · Secrets · Rate Limiting        │
│  ▸ 📖  Comparison: Auth Strategies                           │
│                                                              │
│  ## Next steps  (Required)                                   │
│  - Guide: Add RBAC                                           │
│  - Guide: OAuth with social providers                        │
│  - Production: Deploy with HTTPS                             │
└──────────────────────────────────────────────────────────────┘
```

### Sections

| Section | Level |
|---|---|
| Title + metadata card | ✅ Required |
| Before you start | ✅ Required |
| Comparison / alternatives table | 🔷 Conditional |
| Decision tree | 🔷 Conditional |
| What you'll build (diagram) | ✅ Required |
| Step-by-step body | ✅ Required |
| Inline callouts | 🔷 Conditional (where applicable) |
| Inline reference links | 🔷 Conditional (first occurrence, complex APIs) |
| Inline concept links | 🔷 Conditional (when concept page exists) |
| Finished result | ✅ Required |
| Common mistakes | ✅ Required |
| Cross-links | ✅ Required |
| Next steps | ✅ Required |

### Inline linking rules

- **Link the FIRST occurrence** of each API call or concept. Not every repetition.
- **Link complex APIs** (functions with non-obvious signatures). Skip trivial ones (`next()`, `ctx.json()`).
- **Concept links** — only when the concept has a dedicated page. Don't force links.

### What it answers

> "How do I build a specific feature using NextRush?"
> "Should I even use this approach?"
> "What does finished code look like?"

---

## 🍳 Recipe Template — "Copy, adapt, done"

### Full layout

```
┌──────────────────────────────────────────────────────────────┐
│ 🍳  Recipe                                                   │
│                                                              │
│  # Use Better Auth with NextRush                             │
│                                                              │
│  🟢 Beginner  •  5 min  •  v4.2+                             │
│  Node  •  Bun  •  Deno  •  Cloudflare                        │
│                                                              │
│  > Add social login, magic links, sessions in minutes.       │
│                                                              │
│  ┌── Before you start ──────────────────────────────────────┐│
│  │  📋 ✓ Signup • ✓ Login • ✓ Session management           ││
│  │  🔢 5 min • 1 code block • 2 config options             ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ## Why Better Auth?  (Required — 3-5 lines)                 │
│  Better Auth handles the full lifecycle out of the box —     │
│  signup, login, session, OAuth, password reset. Unlike JWT   │
│  where you build each piece yourself. Best for apps needing  │
│  social login or avoiding token management.                  │
│                                                              │
│  ## Setup  (Required)                                        │
│  ```bash                                                     │
│  npm install better-auth @nextrush/better-auth               │
│  ```                                                         │
│  > 💡 Tip: Use environment variables for provider secrets    │
│                                                              │
│  ## Usage  (Required)                                        │
│  ```ts                                                       │
│  // Full runnable integration code                           │
│  ```                                                         │
│  > 🔒 Security: Store session data in encrypted cookies      │
│                                                              │
│  ## Options  (Conditional)                                   │
│  | Param | Type | Default | Description              |       │
│                                                              │
│  ## Compatibility  (Required)                                │
│  | Runtime | Supported | Notes                       |       │
│  |---------|-----------|----------------------------|       │
│  | Node    | ✅        | 18+ required                |       │
│  | Bun     | ✅        | 1.0+                        |       │
│  | Deno    | ✅        | —                           |       │
│  | CF      | ⚠️        | Needs polyfill for crypto   |       │
│                                                              │
│  ## Troubleshooting  (Required)                              │
│  | Error | Reason | Fix                             |       │
│  |-------|--------|----------------------------------|       │
│                                                              │
│  ── cross-links ──  (Required)                               │
│                                                              │
│  ▸ 🛠  Guide: JWT Auth (if you want DIY)                    │
│  ▸ 📦  Example: SaaS Starter                                 │
│  ▸ 📚  Reference: @nextrush/better-auth                      │
│  ▸ ⚙️  Production: Secrets · Session Storage                │
│  ▸ 📖  Comparison: Auth Strategies                           │
└──────────────────────────────────────────────────────────────┘
```

### Sections

| Section | Level |
|---|---|
| Title + metadata card | ✅ Required |
| Before you start | ✅ Required |
| Why [tool]? | ✅ Required |
| Setup | ✅ Required |
| Usage | ✅ Required |
| Inline callouts | 🔷 Conditional (where applicable) |
| Options | 🔷 Conditional (if configurable) |
| Compatibility | ✅ Required |
| Troubleshooting | ✅ Required |
| Cross-links | ✅ Required |

### Rules

- **"Why [tool]?" teaches trade-offs** — not just "it's great." Compare to alternatives.
- **One complete code block** — not split across 5 steps
- **Copy buttons on all code blocks** — recipes are for copying
- **5-10 min max** — if longer, it's a Guide

### What it answers

> "How do I connect NextRush with tool X?"
> "Will this work on my stack?"
> "What do I do when it breaks?"

---

## 📦 Example Template — "See a real project"

### Full layout

```
┌──────────────────────────────────────────────────────────────┐
│ 📦  Example: SaaS Starter                                    │
│                                                              │
│  🟡 Intermediate  •  60 min  •  v4+                          │
│  Node  •  Bun                                                 │
│                                                              │
│  > Multi-tenant SaaS backend — auth, teams, billing, keys.  │
│                                                              │
│  ┌── Before you start ──────────────────────────────────────┐│
│  │  📋 ✓ Running app • ✓ Deploy preview                     ││
│  │  📖 JWT Auth → Guide • Stripe → Recipe                   ││
│  │  🔢 60 min • clone + configure + deploy                  ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ──────────────────────────────────────────────────          │
│                                                              │
│  ## Quick Start  (Required)                                  │
│  ```bash                                                     │
│  git clone ... && cd ... && npm install && npm run dev       │
│  ```                                                         │
│                                                              │
│  ## Architecture  (Required)                                 │
│  [C4 / Mermaid diagram + alt text description]               │
│                                                              │
│  ## Features  (Required)                                     │
│  - Auth: JWT + OAuth + API keys                              │
│  - Teams: invite, roles, permissions                         │
│  - Billing: Stripe subscription                              │
│                                                              │
│  ## Project Structure  (Required)                            │
│  ```                                                         │
│  src/                                                        │
│  ├── modules/{auth, team, billing}/                          │
│  └── app.ts                                                  │
│  ```                                                         │
│                                                              │
│  ## Deploy  (Required)                                       │
│  ```bash                                                     │
│  npm run build && npm start                                  │
│  ```                                                         │
│  > ⚙️ Production: See Deployment guide for production config │
│                                                              │
│  ── cross-links ──  (Required)                               │
│                                                              │
│  ▸ 🛠  Guides: Auth · RBAC · Billing · Webhooks             │
│  ▸ 🍳  Recipes: Stripe · Better Auth · PostgreSQL           │
│  ▸ 📚  Reference: All packages used                          │
│  ▸ ⚙️  Production: Deploy · Scaling · Logging               │
└──────────────────────────────────────────────────────────────┘
```

### Sections

| Section | Level |
|---|---|
| Title + metadata card | ✅ Required |
| Before you start | ✅ Required |
| Quick Start | ✅ Required |
| Architecture diagram | ✅ Required |
| Features | ✅ Required |
| Project Structure | ✅ Required |
| Deploy | ✅ Required |
| Cross-links | ✅ Required |

### Rules

- **Architecture diagram before code** — understand the system first
- **Quick Start ≤ 3 commands** — clone, install, run
- **Deploy section required** — real project ships
- **No step-by-step tutorial** — that's Guides' job. Example shows *finished system*.
- **Diagram has alt text** — for accessibility + Mermaid fallback

### What it answers

> "Show me a complete, real-world project built with NextRush."
> "What does production-ready code look like?"

---

## Author Guidelines — How to Write

This section is the most important for long-term consistency. Follow these rules on every page.

### Voice

- **Write for one persona** — a working developer who knows basic programming but not NextRush internals.
- **One learning objective per page** — if a page teaches two things, split it.
- **Prefer active voice** — "createMiddleware() registers a handler" not "a handler is registered by createMiddleware()."
- **Be direct** — "Install the package" not "you will need to install the package."
- **No marketing language** — "Maps requests to handlers" not "Provides an innovative routing solution."

### Code vs prose

- **Guides: Explain before code** — mental model first, then syntax.
- **Recipes: Code first, minimal prose** — developer came here to copy.
- **Concepts: Code is secondary** — the idea IS the content.
- **Avoid repeating Reference text** — if the API signature exists in Reference, don't re-list it in a Guide. Link instead.
- **Don't duplicate Comparison content** — if a Comparison page exists, summarize and link. Don't recreate the full table.

### Content rules

- **Every page passes the "5-second test"** — within 5 seconds, the developer knows: what this page teaches, whether they're ready for it, what they'll finish with.
- **No "Learn more" as link text** — use descriptive text: "→ Concepts: Request Lifecycle."
- **Examples are complete** — no `...`, no pseudo-code.
- **One idea per paragraph** — if a paragraph covers two ideas, split it.

---

## Cross-Linking Rules

Every page links to every related content type that exists. Do not force artificial links.

```
▸ 🛠  Guide: [Title]
▸ 🍳  Recipe: [Title]
▸ 📦  Example: [Title]
▸ 📚  Reference: [Title]
▸ ⚙️  Production: [Title]
▸ 📖  Comparison: [Title]
```

Cross-linking block position: **after content, before end of page**.

**Rule**: Link to every related content type that actually exists. Some pages (e.g. a pure concept) may only link to Reference and Architecture — that's fine. Honest connectivity, not artificial completeness.

Always include Production when applicable — every feature becomes an operational concern.

If zero cross-links exist for a page, remove the entire block rather than showing an empty section.

---

## Inline Linking (not just bottom block)

Inline links appear throughout the page. They are the primary navigation aid; the bottom cross-linking block is secondary.

| Context | Link | Rule |
|---|---|---|
| `createMiddleware()` first appearance | `→ 📚 Reference` | First occurrence only. Skip trivial APIs (`next()`, `ctx.json()`). |
| "Request lifecycle" first mention | `🧠 Request Lifecycle → Concepts` | First mention only. Don't link every repetition. |
| Production concern arises | `⚙️ Production: [topic] → Production` | Conditional — only when genuinely relevant inline. |
| Common mistake | `❌ Common mistake: ...` | Use the callout, not a prose paragraph. |

---

## Learning Paths

Cross-links form a **graph** — any page connects to related pages.

Learning paths are **curated sequences** — recommended order through a domain.

```
guides/authentication/
├── meta.json              ← owns the learning path
├── jwt.mdx
├── sessions.mdx
├── oauth.mdx
└── rbac.mdx
```

**Ownership rules:**
- **One owner per learning path** — the section's `meta.json` declares the canonical path.
- **No duplicate learning paths** — if Authentication and Security both define a sequence through auth, the Authentication section owns it. Security links to it.
- **One canonical path** — the primary recommended order.
- **Optional alternate paths** — `meta.json` can declare `alternatePaths` for different personas (e.g. "frontend dev path" vs "backend dev path").

```json
{
  "title": "Authentication",
  "canonicalPath": [
    "concepts/middleware",
    "jwt",
    "sessions",
    "rbac",
    "oauth",
    "production/security"
  ],
  "alternatePaths": {
    "Frontend-focused": ["jwt", "oauth", "better-auth-recipe"],
    "Backend-focused": ["sessions", "rbac", "production/security"]
  }
}
```

Render on section index pages as a visual progress indicator:

```
Authentication

  ██████░░░░  4/10

  Previous: Middleware (concept)
  Current:  JWT (guide)
  Next:     RBAC (guide)
```

Learning paths are distinct from cross-links:
- **Cross-links** = "related to this specific page"
- **Learning path** = "curated order for mastering this domain"

---

## Developer Reading Flow by Type

```

                   GUIDE                          RECIPE                       EXAMPLE
                   ─────                          ──────                       ───────

Sees metadata   "Should I use this?"          "Will this work on            "Is this relevant
                "Am I ready?"                  my stack?"                    to my stack?"

Before you      "What will I finish            "What will I get?"            "What do I need
start           with?"                                                      to know first?"

Decision        "Which approach                "Why this tool vs             N/A
support         should I choose?"              alternatives?"

Body            Step-by-step with              One code block +             Architecture +
                inline callouts                options + compat             features + structure

End             Finished result +              Troubleshooting              Deploy +
                mistakes + next steps          + cross-links                cross-links
```

---

## Future Page Types

Not needed immediately, but plan for:

### Comparison pages

```
Comparison: Auth Strategies
Comparison: SSE vs WebSocket
Comparison: BullMQ vs Cron
Comparison: Redis vs Memory Cache
```

Format: two-column or table layout comparing features, trade-offs, use cases, performance. Linked from Guide/Recipe decision sections via `📖 Comparison: [Title]`.

### Checklists

```
Production Checklist
Security Checklist
Performance Checklist
Deployment Checklist
```

Format: single-page checklist with expandable items. Not a Guide, not a Recipe — pure verification tool.

### Troubleshooting hub

```
Common Errors
Startup Failures
Memory Leaks
High CPU
Slow Responses
```

Format: error → cause → fix table. Aggregates troubleshooting from individual Recipes into one searchable hub.

---

## Summary: Three Templates at a Glance

```
                    GUIDE                    RECIPE                    EXAMPLE
                    ─────                    ──────                    ───────

Metadata card   🟡 Int · 20m · v4+       🟢 Beg · 5m · v4.2+      🟡 Int · 60m · v4+

Before you      ✅ Required                ✅ Required                ✅ Required
start

Decision        🔷 Conditional             🔷 Conditional             N/A
support         (when alternatives exist)  (when choice exists)

Body            Steps + inline             Setup + Usage +            Quick start +
                callouts (💡 ⚠️ ⚙️ 🔒 ❌)  Options + Compat           Architecture +
                                         + Troubleshooting         Features + Structure

Inline links    🔷 First occurrence         🔷 First occurrence        ⚙️ Production
                of major APIs              of major APIs              callouts only

End             Finished result ✅          Troubleshooting ✅         Deploy ✅
                Mistakes ✅                 Cross-links ✅             Cross-links ✅
                Cross-links ✅
                Next steps ✅
```

---

## Applies To

This template spec applies to every page in:
- `content/docs/guides/`
- `content/docs/recipes/`
- `content/docs/examples/` (when created)

Follow these layouts. Do not invent new page patterns for these sections. Deviations only with explicit design review.

---

## References

- AGENTS.md — mission, philosophy, voice, visual hierarchy rules
- DESIGN.md — overall site design system
- `feedback/fed.md` — original IA feedback (the triad)
- `feedback/w.md` — product-quality review (metadata, decision trees, learning paths, callouts)
- `feedback/a.md` — governance review (section classification, lifecycle, a11y, author guidelines, components)
- The Diátaxis model — tutorial/guide/concept/reference separation
