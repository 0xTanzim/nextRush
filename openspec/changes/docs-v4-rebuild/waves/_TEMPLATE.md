# Wave brief — TEMPLATE

> Copy this per wave into `waves/wave-<id>-<slug>.md`. A wave brief is the **self-contained
> execution contract** a long-running agent (or `se-implementer` sub-agent) reads FIRST, so it can
> do the whole wave without re-reading `tasks.md`, `design.md`, and every EDS from scratch. Delete
> these guidance blocks when filling it in. `tasks.md` stays the master checkbox tracker; this brief
> is the *how* for one wave.

---

## Wave <ID> — <name>

- **Track:** A (package docs) | B (docs-site content) | Tooling
- **Status:** not-started | in-progress | in-review | done
- **Depends on:** <wave ids / gates that must close first>
- **Gate:** <Validator per-package | docs:verify + EDS-015 per wave | user review>
- **tasks.md item:** <§ number>

### Objective (measurable)
{{ One sentence, checkable. e.g. "All 6 Tier-1 core packages have a README.md + ARCHITECTURE.md
   authored from the frozen templates, facts source-verified, that pass the Validator checklist." }}

### Scope
- **In scope (exact paths):** {{ list every file this wave may create/edit }}
- **Forbidden:** everything else (esp. other waves' files, `src/` application code).

### Templates & standards (the frozen bar — do NOT invent structure)
- Template(s): {{ e.g. `docs/templates/package-readme.template.md` + `package-architecture.template.md` }}
- EDS standard(s): {{ e.g. EDS-010 architecture, EDS-012 diagrams, EDS-013 code }}
- **Diagrams:** advanced/modern Mermaid per **EDS-012** — load `~/.kiro/skills/mermaid/SKILL.md`,
  pick the precise type (architecture-beta/sequence/state/ER/…), NOT a basic flowchart. npm README =
  ASCII only; ARCHITECTURE.md = rich Mermaid.

### Work items (the checklist)
| Item | Tier | Source of truth (verify facts here) | README | ARCH / page | Done |
| ---- | ---- | ----------------------------------- | ------ | ----------- | ---- |
| {{ pkg/page }} | {{ 1/2/3 }} | `packages/<pkg>/src` | ☐ | ☐ | ☐ |

### Mandatory context (inject into every sub-agent)
- Skill: `.kiro/skills/engineering-documentation/SKILL.md` (router) + the page-type EDS.
- Terminology & facts: `.kiro/steering/documentation.instructions.md` (segment trie, tiers, imports).
- **Source wins over everything** — verify signatures/versions/behavior against real `src/`, never memory.

### Done-condition (checkable) & Validator checklist (independent context)
- [ ] Every work item's files exist, every frozen-template section present.
- [ ] Every code sample compiles / typechecks (Track B: `docs:verify` green).
- [ ] Every fact matches `packages/<pkg>/src` (Validator re-derives from source).
- [ ] Diagrams use the precise modern type (EDS-012) — no basic-by-default flowchart.
- [ ] EDS-014 review + EDS-015 publish checklist pass.

### Notes / known gotchas
{{ anything wave-specific — e.g. "router already done in pilot; skip it" }}
