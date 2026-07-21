# Wave B1 — Docs-site foundation (`start/` + `concepts/`)

- **Track:** B (docs-site MDX content)
- **Status:** in-progress (concepts: `context`·`middleware`·`errors`⊕·`request-lifecycle`·`dependency-injection`·`guards`·`interceptors`·`exception-filters`·`modules`·`application`·`lifecycle`·`runtime-compatibility` ✅ (+`routing` pilot) · start: `quick-start` ✅ — validated 2026-07-21). **Committed:** `994b2a4`, `cefe578`, `49f438c`. **Remaining concepts:** `streaming`⊕, `extensions` (rename from `plugins`). **Tooling signal:** `docs:verify` compile-check samples only 15 files alphabetically by default — raise `sampleSize` at §12 before cutover. **Lint signal:** forbidden-words CI check is context-blind regex (flags "easy" even non-promotionally) — implementers now proactively avoid the tokens rather than healing after the fact. **Finding for B3:** `reference/class/decorators.mdx` shows a function-style interceptor contradicting source.
- **Depends on:** **Wave B0 gate (frozen IA)** ✅ — unblocked. Independent of Track A.
- **Gate:** `docs:verify` green + EDS-015 publish checklist per wave.
- **tasks.md item:** §8

### Objective (measurable)
The highest-traffic foundation of the v4 site is live and sets the voice/quality bar: the rebuilt
**landing** + **`start/`** (incl. the new `start/runtime/*` onboarding) + **`concepts/`**, all
EDS-compliant, `docs:verify` green.

### Scope
- **In scope (exact paths, under `apps/docs/content/docs/`):**
  - `/` landing (nav hub + persona-router + "Runs everywhere" + Capabilities + doc roadmap)
  - `start/`: index · installation · quick-start · hello-world · overview · create-nextrush
  - `start/runtime/`: `node · bun · deno · edge · serverless` (per-runtime onboarding — see
    `wave-b0-final-review.md` §2 for the 6-part structure)
  - `concepts/`: [Core] routing · context · middleware · **errors** ⊕ · [Execution] request-lifecycle ·
    lifecycle · **streaming** ⊕ · runtime-compatibility · [Class] dependency-injection · guards ·
    interceptors · exception-filters · modules · [Extending] extensions
  - `meta.json` sidebar config for the above
- **Forbidden:** guides/recipes/reference/production/migrate (later waves), any package `src/`.

### Templates & standards
- Landing → **EDS-018** (`templates/landing.md`); Concepts → **EDS-007** (`templates/concept.md`);
  `start/` tutorials → **EDS-008** (`templates/tutorial.md`) / Landing hybrid per the content map.
- Voice **EDS-004** (honest, no `simply`/`just`/`powerful`/superlatives — CI-enforced).
- Import style: teaching pages import from `nextrush` / `nextrush/class` (NOT granular `@nextrush/*`).
- **Diagrams (EDS-012):** advanced/modern Mermaid — concepts especially. e.g. `sequenceDiagram` for
  request-lifecycle, `stateDiagram-v2` for lifecycle/scopes, `architecture-beta` for the system
  mental model, `erDiagram`/`classDiagram` where types relate. NO basic flowchart by default. Load
  the `mermaid` skill first.

### Work items (high level — expand per page at execution)
| Group | Pages | Page type | Done |
| ----- | ----- | --------- | :--: |
| Landing | `/` | Landing (EDS-018) | ☐ |
| Start | index · installation · quick-start · hello-world · overview · create-nextrush | Tutorial/Landing | ☐ |
| Start/runtime ⊕ | node · bun · deno · edge · serverless | Tutorial (runtime onboarding) | ☐ |
| Concepts/Core | routing · context · middleware · errors ⊕ | Concept (EDS-007) | ☐ |
| Concepts/Execution | request-lifecycle · lifecycle · streaming ⊕ · runtime-compatibility | Concept | ☐ |
| Concepts/Class | dependency-injection · guards · interceptors · exception-filters · modules | Concept | ☐ |
| Concepts/Extending | extensions | Concept | ☐ |

### Mandatory context (inject into every Implementer)
- Skill router + EDS-007/008/018, EDS-004 (voice), EDS-012 (diagrams), EDS-016 (components), EDS-013 (code).
- `documentation.instructions.md`: MDX components available, terminology, import rules, content map.
- Available components: `<Callout>`, `<Tabs>`, `<Steps>`, `<Cards>`, `<Mermaid>`, `<AutoTypeTable>`,
  `<ScalarApiReference>`, `<RuntimeSupport>` (build in this wave — see final-review §2/§6).
- **Single source of truth:** concepts explain *why* once; never re-explain in guides/reference — link.

### Done-condition & Validator checklist (independent context)
- [ ] Every in-scope page exists + `meta.json` wired; no orphan, every relative link resolves.
- [ ] `pnpm --filter ./apps/docs run docs:verify` **green** on the new pages (compile, links,
      terminology, import-style, forbidden-words, heading-intent, callout-density).
- [ ] Diagrams use precise modern Mermaid (EDS-012), each with an adjacent explanation.
- [ ] Every page ends in a `<Cards>` "Next steps / Continue learning" block (no dead ends).
- [ ] EDS-015 publish checklist + rubric ≥ +7 avg / no axis < +4.

### Notes / gotchas
- **`<RuntimeSupport>` badge** component doesn't exist yet — build it in this wave (props: per-runtime
  support map ✅/❌/⚠), used on runtime-diverging concept pages. Depends on nothing external.
- `start/runtime/*` is ONBOARDING (install→hello-world→deploy→limits→reference-link), distinct from
  `production/deployment/*` (Wave B2) — cross-link, don't duplicate.
- This wave sets the voice bar — spend the extra care here; later waves copy its rhythm.
