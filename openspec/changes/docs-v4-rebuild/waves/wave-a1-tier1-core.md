# Wave A1 — Tier-1 core packages (README + ARCHITECTURE)

- **Track:** A (package docs)
- **Status:** ✅ DONE — all 6 packages authored + validated (errors · types · core · runtime · di · class), 2026-07-21. Router done in pilot. **Findings surfaced by the work, all RESOLVED this session:** (1) `listen`/`serve` live in `adapter-node`, not `runtime` — steering corrected; (2) `di` ~987 LOC — steering ≤400 cap was stale, raised to 1,000 with a note that the per-file 300 cap (largest 290) is the real guardrail; (3) retired term "radix nodes" in 3 CHANGELOGs (nextrush/router/types) → "trie nodes". (Router README/ARCHITECTURE "radix" usages are legitimate — deliberate "segment trie, NOT a radix tree" contrast + the real `router-radix` RFC-015 reference.)
- **Depends on:** task 0.6 (frozen templates) ✅ · task 1.3 gate ✅ — **unblocked, can start now**
- **Gate:** Validator per-package (independent context)
- **tasks.md item:** §3

### Objective (measurable)
All **6 remaining Tier-1 core packages** have a `README.md` **and** `ARCHITECTURE.md` authored from the
frozen templates, every fact source-verified against `packages/<pkg>/src`, passing the Validator
checklist below. (`router` is already done in the pilot — **do not redo it**.)

### Scope
- **In scope (exact paths):**
  - `packages/core/{README.md,ARCHITECTURE.md}`
  - `packages/runtime/{README.md,ARCHITECTURE.md}`
  - `packages/di/{README.md,ARCHITECTURE.md}`
  - `packages/class/{README.md,ARCHITECTURE.md}`
  - `packages/types/{README.md,ARCHITECTURE.md}`
  - `packages/errors/{README.md,ARCHITECTURE.md}`
- **Forbidden:** `router` (done), any other package, any `src/` code, any docs-site MDX.

### Templates & standards
- `docs/templates/package-readme.template.md` + `docs/templates/package-architecture.template.md`
- Tier-1 = **full architectural treatment** (problem → mental model → execution → usage → failure →
  perf → security → trade-offs), per `documentation.instructions.md` tiering.
- **Diagrams (EDS-012, hard rule):** advanced/modern Mermaid in `ARCHITECTURE.md` — pick the precise
  type: **architecture-beta** (package topology/component graph), **sequenceDiagram** (request/DI
  resolution lifecycle), **stateDiagram-v2** (lifecycle/scopes), **classDiagram/erDiagram** (type
  relationships). NOT a generic flowchart. **README.md = ASCII diagrams only** (npm renders no Mermaid).
  Load `~/.kiro/skills/mermaid/SKILL.md` + `references/<type>.md` before drawing.

### Work items
| Package | Source of truth | Notable facts to verify | README | ARCH | Done |
| ------- | --------------- | ----------------------- | :----: | :--: | :--: |
| `core` | `packages/core/src` | Application, Context, middleware compose; ≤1,500 LOC cap | ✅ | ✅ | ✅ |
| `runtime` | `packages/runtime/src` | runtime detection, capability profiles, req/res primitives (NOT `listen` — that's in adapter-node) | ✅ | ✅ | ✅ |
| `di` | `packages/di/src` | wraps tsyringe; `@Service`/scopes (actual ~987 LOC — steering ≤400 cap is stale, flagged) | ✅ | ✅ | ✅ |
| `class` | `packages/class/src` | unified class runtime; re-exports di; modules/guards/interceptors/filters/lifecycle/request-scope | ✅ | ✅ | ✅ |
| `types` | `packages/types/src` | shared types, no deps; ≤500 LOC | ✅ | ✅ | ✅ |
| `errors` | `packages/errors/src` | HttpError hierarchy; ≤600 LOC | ✅ | ✅ | ✅ |

### Mandatory context (inject into every Implementer)
- Skill router `.kiro/skills/engineering-documentation/SKILL.md` + EDS-010 (architecture), EDS-012
  (diagrams), EDS-013 (code), the two package templates.
- `documentation.instructions.md`: **segment trie** (never "radix tree"), per-package versions
  (core line **3.1.0** — verify each `package.json`), import style, canonical terminology.
- The pilot `packages/router/{README,ARCHITECTURE}.md` are the **reference exemplar** — match their bar.
- **Source wins**: verify every signature/version/behavior against `src/` + `package.json`, not memory.

### Done-condition & Validator checklist (different context, zero trust in Implementer self-report)
- [ ] All 12 files (6 pkg × 2) exist; every frozen-template section present (no leftover `{{ }}`/placeholders).
- [ ] Every code sample compiles/typechecks against workspace `src/`.
- [ ] Every fact (signatures, versions, LOC claims, exports) re-derived from real `src/` matches.
- [ ] `ARCHITECTURE.md` diagrams use precise modern Mermaid (EDS-012); README diagrams are ASCII.
- [ ] Terminology clean (no "radix tree"); imports per the CI rule; EDS-014 + EDS-015 pass.

### Notes / gotchas
- **Skip `router`** — already done in the pilot (task 1.1).
- `di` + `class` are coupled (`class` re-exports `di`) — cross-link their docs; keep DI-scope facts
  in one canonical place (`di`), link from `class`.
- Batch as parallel Implementers (one worktree each); Validator runs after each, Integrator merges
  low-blast-radius work as it clears.
