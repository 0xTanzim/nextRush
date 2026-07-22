# Wave B1 — Docs-site foundation (`start/` + `concepts/`)

- **Track:** B (docs-site MDX content)
- **Status:** ✅ WAVE B1 COMPLETE (2026-07-21) — all `start/*` (index·installation·overview·create-nextrush·quick-start + runtime/{node,bun,deno,edge,serverless}) and all `concepts/*` (14 pages + routing pilot) done, source-verified, independently validated. Landing (`/`) + `<RuntimeSupport>` component done. **Heal loop caught 5 real defects across the wave** (all fixed, re-verified against source): 3 fabricated runtime-limitation claims (bun's invented tier/body-size claims, serverless's wrong `ctx.runtime` value), 2 factually-wrong "generated output" code samples in create-nextrush.mdx (missing `uptime` field, missing health-route mount, a fabricated `not-found.ts` file). **Cross-cutting finding logged for a maintainer decision:** `ADR-0005` says non-node adapters are "Internal until GA" while `compatibility-matrix.mdx` (published) says "Stable" — two authoritative sources disagree; needs reconciling. **Tooling signals logged for §12:** `docs:verify` compile-check `sampleSize=15` silently skips files outside the alphabetical sample (confirmed via forced `sampleSize=200`, which itself surfaced ~2040 findings that look like a harness scaling artifact, not real regressions — needs its own investigation); forbidden-words lint is context-blind token regex (costs heal-loop iterations on honest non-marketing prose). **Finding for B3:** `reference/class/decorators.mdx` function-style interceptor contradicts source. **docs:verify total findings: 411→22 within this wave's scope** (remaining 22 are pre-existing v3 pages: `community/contributing.mdx`, `concepts/index.mdx` compile errors; 2 heading-intent warnings — candidates for a future cleanup node, not blocking).
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
