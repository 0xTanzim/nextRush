# docs-v4-rebuild

v4 documentation: keep Fumadocs + modernize (llms.txt, Scalar OpenAPI, AutoTypeTable, advanced
Mermaid); rewrite all 35 package README/ARCHITECTURE from frozen templates in tier-driven subagent
waves; rebuild the docs-site IA (capability-first, persona/runtime-first) & rebrand; retire v3 via
tag+branch cutover (no `_archive` folder).

## How this change is organized (read this first)

| Artifact | Role |
| -------- | ---- |
| `proposal.md` | Why + what changes + scope/non-goals |
| `design.md` | Durable decisions **D1–D10** (framework, cutover, waves, done-conditions, two tracks, template freeze, IA freeze, i18n, advanced diagrams) |
| `tasks.md` | **Master checkbox tracker** — the source of truth for progress. Always re-read fresh. |
| `wave-b0-ia.md` | Wave B0 deliverable: the v4 IA design (sitemap, personas, capability map, URL map) |
| `wave-b0-final-review.md` | Wave B0 freeze record: persona journeys, runtime experience, IA audit, naming freeze |
| `waves/` | **Per-wave execution briefs** — self-contained contracts a long-running agent/sub-agent reads to run ONE wave without re-loading everything. `tasks.md` = *what/tracking*; a wave brief = *how*. |

`waves/_TEMPLATE.md` is the brief shape. **Distant-wave briefs are generated just-in-time** (when the
wave starts) — not all up front — so they don't go stale as earlier waves reveal refinements
(loop-engineering: don't over-plan distant work). `openspec validate` reports "no delta" **by design**
— this is a docs-only change with no code-capability spec surface (AGENTS.md §20); it is not a bug.

## Execution map (waves → brief → status)

| Wave | Track | Brief | tasks.md | Depends on | Status |
| ---- | ----- | ----- | -------- | ---------- | ------ |
| Setup + template/standard freeze | — | (tasks §0) | §0.1–0.6 | — | ✅ done |
| Pilots + gate | A+B | (tasks §1) | §1.1–1.3 | §0 | ✅ done |
| Tooling: llms.txt · Scalar · AutoTypeTable | Tooling | (tasks §2) | §2.1–2.3 | — | ✅ done |
| Tooling: i18n infra | Tooling | *(jit)* | §2.4 | B0 | ✅ done, reduced scope (config + hreflang/canonical + freshness stub; `[lang]/` route move deferred — see tasks.md §2.4 note) |
| Tooling: advanced-diagram render + ZenUML | Tooling | *(jit)* | §2.5 | — | ✅ done (block/block-beta upstream bug found + documented; ZenUML kept out-of-scope) |
| **B0 — IA & rebrand design** | B | `wave-b0-ia.md` + `wave-b0-final-review.md` | §7 | §1 | ✅ **done / frozen** |
| **A1 — Tier-1 core (6 pkgs)** | A | `waves/wave-a1-tier1-core.md` | §3 | §0.6, §1.3 | ✅ done (6/6 validated) |
| A2 — Tier-2 middleware/ext/stream (19) | A | `waves/wave-a2-tier2-middleware.md` | §4 | §0.6 | ✅ done (19/19 validated) |
| A3 — Tier-3 adapters/tooling (8) | A | `waves/wave-a3-tier3-adapters-tooling.md` | §5 | §0.6 | ✅ done (8/8 validated) |
| Meta `nextrush` README | A | *(jit)* | §6 | A1–A3 | ✅ done (validated, 15/15 real tests re-run) |

**🎯 TRACK A (all 35 packages) COMPLETE — 2026-07-22.**
| **B1 — start/ + concepts/** | B | `waves/wave-b1-foundation.md` | §8 | B0 | ✅ done (all pages validated) |
| B2 — guides/ + recipes/ + production/ | B | `waves/wave-b2-guides-recipes-production.md` | §9 | B0 | ✅ done (dedup + 4 batches validated) |
| B3 — reference/ + architecture/ | B | `waves/wave-b3-reference-architecture.md` | §10 | B0, §2 | ✅ done (D9.1/D9.3 IA migration executed + validated) |
| B4 — migrate/ + community/ + help/ | B | `waves/wave-b4-migrate-community-help.md` | §11 | B0 | ✅ done (resources/ retired, validated) |
| Cross-cutting checks · cutover · archive | — | (tasks §12–14) | §12–14 | all | ⬜ open |

**Next-up, independent, can run in parallel:** A1 (core packages) and B1 (site foundation). Track A
and Track B share no files.
