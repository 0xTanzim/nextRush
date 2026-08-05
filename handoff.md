# PROJECT HANDOFF

> Current engineering state of NextRush so any engineer or AI assistant can continue work immediately.

---

# Metadata

| Field | Value |
|--------|-------|
| Project | NextRush — TypeScript-first backend framework |
| Repository | /home/tanzim/project/framework/nextrush |
| Branch | bug/fix |
| Commit | 0bdb7324 "Add create-nextrush scaffolder with installer" |
| Version | Unknown (no version in apps/website/package.json) |
| Last Updated | 2026-08-04 |
| Author | AI engineering session |
| Related Issue / PR | None open |

---

# 1. Mission

## Product Vision

NextRush is a TypeScript-first backend framework that eliminates accidental complexity: explicit architecture, zero hidden behavior, composable HTTP APIs. Runtime-independent by mandate — Node.js, Bun, Deno, Edge, Lambda behave identically behind adapters; the request path speaks only Web-standard primitives. Target users: backend developers who want a calm, trustworthy, well-documented framework with less boilerplate.

## Current Objective

Complete the **design-system rebrand** from the blue "Electric Rush" identity to the **orange identity anchored on the shipped logo** (`#F16913`). Scope is **documentation only** (per user decision): re-theme the `DESIGN/` doc family to orange, promote a new `DESIGN/BRAND.md`, fold and remove the misnamed `DESIGN2.md/` draft directory, and commit the still-uncommitted logo swap.

The immediate next step: resolve the **one open question** — light/dark *surfaces*: keep the existing cool-slate surfaces (recommended, smaller change) or adopt the warm-paper/graphite surfaces from the user's draft.

## Success Criteria

- [ ] `DESIGN/TOKENS.md` re-themed: brand ramp 50–950 anchored `#F16913`, semantic brand tokens, §7 verified-contrast table recomputed
- [ ] `DESIGN/DESIGN.md`, `DESIGN/DESIGN_PLAYBOOK.md`, `DESIGN/MIGRATION.md` re-themed blue→orange ("Electric Rush" references removed)
- [ ] `DESIGN/BRAND.md` created from draft (all `#FF6A00` → `#F16913`); `DESIGN2.md/` folded and removed
- [ ] Logo swap + design docs committed to `bug/fix`
- [ ] `pnpm build` + tsc pass; no CSS file changed (CSS migration deferred)

---

# 2. Current State

## Overall Progress

| Area | Status |
|------|--------|
| Architecture | Established — core + router + adapters, runtime-independent |
| Core Engine | Built |
| API | Built |
| CLI | Built (create-nextrush scaffolder just added) |
| Documentation | In flux — design system mid-rebrand |
| Testing | Passing (per repo standard); verify with pnpm build/tsc |

## Completed

- Logo swap implemented (uncommitted): favicons, `icon.svg`, OG route, `logo.tsx`, header/hero/footer brand marks
- Design consultation decisions locked (3/3):
  1. **#F16913 canonical brand primary** (matches shipped logo); hover `#DB5E10`, active `#C5530E`
  2. **Docs-only scope** — CSS migration deferred to follow-up PR
  3. **Supersede `DESIGN/`** — keep folder + layered token architecture, replace brand elements only
- Contrast computed for the new orange (the binding constraint):
  - `#F16913` on white = 3.10:1 → **AA-large only, FAIL as normal text**
  - `#F16913` on warm paper `#FFF9F4` = 2.97:1 → FAIL even large
  - `#BC4E08` on white = 4.96, on warm = 4.75 → **AA-safe light link** (replaces draft's `#D95A00` = 3.88 fail)
  - `#C5530E` on white = 4.55 → AA (small-button fallback)
  - Dark: `#FF8A34` = 8.05, `#FF8124` = 7.59, `#F16913` on `#0D1117` = 6.10 → all AA
  - White on `#F16913` = 3.10 → button labels need ≥19px bold / ≥24px

## Currently Working On

- Design-system docs re-theme (not yet started — blocked on surfaces A/B decision)

## Remaining

- Re-theme `DESIGN/TOKENS.md` (§3.1 brand ramp, §3.5 application learning hue, §4.2/§4.4 semantic brand tokens, §7 verified contrast)
- Re-theme `DESIGN/DESIGN.md`, `DESIGN/DESIGN_PLAYBOOK.md`, `DESIGN/MIGRATION.md`
- Create `DESIGN/BRAND.md`; remove `DESIGN2.md/`
- Commit logo swap + design docs
- (Deferred) CSS migration: `global.css` + ~26 component files, blue `--rush-*` → orange

## Blockers

- Open user question: surfaces A/B (cool-slate keep vs warm-paper adopt) — answer required before `TOKENS.md` edit

---

# 3. Architecture Snapshot

```text
Website (apps/website — Next.js + Fumadocs)
 │
 ├── src/app          pages, routes, OG images
 ├── src/components   site + MDX components (logo.tsx, hero, header, footer)
 ├── DESIGN/          design system docs (layered tokens, playbook, migration)
 ├── DESIGN2.md/      user's orange draft (to be folded+removed)
 └── public/favicon   logo assets (shipped, orange)
 │
NextRush framework (packages/)
 ├── core
 ├── router
 ├── adapters (Node/Bun/Deno/Edge — conformance suite)
 └── create-nextrush (scaffolder)
```

## Important Decisions

| Decision | Reason |
|----------|--------|
| Logo is canonical source of truth; brand primary `#F16913` | Single consistent brand across logo assets, UI, OG, favicon |
| Design system layered: Foundation → Semantic → Platform (Fumadocs bridge) | Keep the existing architecture; only values change |
| `#F16913` is identity/fill/large-text only, never body text | Fails AA-normal as text on light surfaces (3.10:1) |
| Text links use `#BC4E08` (light) / `#FF8A34` (dark) | AA-compliant link color distinct from identity orange |
| Docs-only this task; CSS deferred | Separation of spec and implementation, lower review risk |
| PAGE_TEMPLATES.md untouched | 0 brand references — already brand-neutral |

---

# 4. Active Context

## Primary Files

| File | Purpose |
|------|---------|
| `apps/website/DESIGN/TOKENS.md` | Layered token spec (30 brand refs) — core re-theme target |
| `apps/website/DESIGN/DESIGN.md` | Philosophy doc (4 brand refs) |
| `apps/website/DESIGN/BRAND.md` | NEW — promote from draft |
| `apps/website/DESIGN2.md/BRAND.md` | User's orange draft (410 lines) |
| `apps/website/DESIGN2.md/TOKENS.md` | User's draft tokens (423 lines, `#FF6A00` superseded) |
| `apps/website/DESIGN2.md/DESIGN.md` | User's draft philosophy (361 lines) |
| `apps/website/DESIGN2.md/NextRush-Design-Preview.html` | Draft preview HTML (obsolete `#FF6A00` — discard on fold) |

## Related Files

| File | Purpose |
|------|---------|
| `apps/website/DESIGN/DESIGN_PLAYBOOK.md` | 12 brand refs → orange |
| `apps/website/DESIGN/MIGRATION.md` | 12 refs; CSS-migration plan (deferred but values should point to orange) |
| `apps/website/DESIGN/PAGE_TEMPLATES.md` | No change (0 refs) |
| `apps/website/src/components/logo.tsx` | Shared logo component (`#f16913` + cream `#fee6ce`) — do not change |
| `apps/website/src/app/global.css` | Live blue `--rush-*` tokens — deferred, do not touch this task |

## Protected Files

- `src/components/logo.tsx` (shipped brand mark — verified, already canonical)
- `public/favicon/*`, `src/app/icon.svg` (shipped logo assets)
- `packages/**` (framework code — this is a website/docs task)

---

# 5. Constraints

## Technical

- Runtime: Node.js (Bun/Deno/Edge adapters exist)
- Language: TypeScript (strict)
- Framework: Next.js + Fumadocs (website); core framework packages
- Package Manager: **pnpm only** (never npm)
- Module System: ESM
- Minimum Versions: Unknown

## Architecture

- Preserve public APIs and backward compatibility.
- Preserve the layered token architecture in `DESIGN/TOKENS.md` (Foundation→Semantic→Platform bridge).
- Never edit `--color-fd-*` directly; derive from Semantic tokens.
- Keep the hybrid Brand Mode / Documentation Mode strategy (re-colored, not deleted).

## Coding Standards

- Docs-as-product (see `apps/website/AGENTS.md`): clarity over decoration, semantic color, accessibility-first.
- Follow existing conventions; keep implementations simple; strict typing; no duplication.
- Comment WHY, never WHAT; no commented-out code.

## Performance

- Docs changes only — no runtime impact. No new dependencies.

## Security

- Never commit secrets.
- No auth/authorization changes in this task.

---

# 6. Decisions Already Made

These are not open for redesign.

| Decision | Reason |
|----------|--------|
| Brand primary `#F16913` (matches approved logo assets) | Logo is canonical; `#FF6A00` was exploration-only, replaced |
| Brand hover `#DB5E10`, active `#C5530E` | User-specified ramp |
| Docs-only scope for this task | Separate spec from implementation; CSS migration is a dedicated follow-up PR |
| Supersede `DESIGN/` with orange; keep folder + structure | One canonical system; "Electric Rush" is predecessor, not parallel |
| Light text-link `#BC4E08` (AA), dark link `#FF8A34` | Contrast requirement (4.5:1 normal text) |
| `#F16913` never used as body text on light surfaces | 3.10:1 fails AA-normal |
| `DESIGN2.md/` gets folded into `DESIGN/` and removed | Misnamed dir; draft superseded by layered system |

---

# 7. Changes Made This Session

## Added

- `apps/website/src/components/logo.tsx` — shared inline-SVG logo (`#f16913` rect + cream paths), uncommitted
- `apps/website/DESIGN2.md/` — user-authored orange draft (BRAND.md, DESIGN.md, TOKENS.md, preview HTML), untracked

## Updated

- `apps/website/public/favicon/*` (apple-touch-icon.png, favicon-96x96.png, favicon.ico, favicon.svg, manifest 192/512) — replaced with orange logo, uncommitted
- `apps/website/src/app/icon.svg` — new mark, uncommitted
- `apps/website/src/app/og/docs/[...slug]/route.tsx` — OG uses logo + `primaryColor="#f16913"`, uncommitted
- `apps/website/src/components/home/hero.tsx`, `home/home-footer.tsx`, `site-header.tsx` — swapped brand `Zap` → `<Logo>`, uncommitted

## Removed

- None yet (pending: `DESIGN2.md/` removal after fold)

## Refactored

- None

## Configuration

- None

## Documentation

- This handoff; design-doc re-theme pending

---

# 8. Failed Attempts

## Attempt

### Goal
N/A — no failed implementation attempts this session.

### Result
None.

### Root Cause
N/A.

### Lesson Learned
N/A.

---

## Never Repeat

- Never write the design system with two oranges (`#FF6A00` + `#F16913`) — user rejected; logo is the single source.
- Never use `#F16913` as normal-size text on light surfaces (contrast fails) — always use the darker link token.
- Never edit `DESIGN/TOKENS.md` without re-running the WCAG contrast computation.

---

# 9. Known Issues

- `DESIGN2.md/` is a **directory misnamed like a file** — planned for removal after fold.
- `#F16913` (3.10:1) fails AA-normal as text on white/warm paper — requires the `#BC4E08` link token and large-bold button labels; small primary buttons may need `#C5530E` fill.
- Logo swap + design docs are **uncommitted** (working tree dirty on `bug/fix`).
- `DESIGN/TOKENS.md` neutral/ink/surface values remain cool-slate; user's draft warm-paper/graphite not yet adopted (open A/B).
- `DESIGN/MIGRATION.md` still describes the blue-era CSS plan — needs value re-pointing (though CSS work is deferred).

---

# 10. Assumptions

- Brand ramp 50–950 derivation from `#F16913` (50=`#FFF2E6`, 100=`#FFE0C2`, 200=`#FFC48A`, 300=`#FFA04D`, 400=`#FB7C1A`, 500=`#F16913`, 600=`#DB5E10`, 700=`#C5530E`, 800=`#8F3D08`, 900=`#6E2E06`, 950=`#4A1F04`) — proposed, not yet user-approved for every step (user confirmed 500/600/700).
- Learning hue `application` (was "brand blue") becomes brand orange `#F16913`; `router` amber `#EA580C` stays.
- Status hues unchanged (semantic, not brand).
- Page templates are brand-neutral — no edits.

---

# 11. Risks

## Technical Risks

- Two design systems coexist until fold completes — agents/readers may read the wrong one.
- Deferred CSS means docs say orange while live site is blue until follow-up PR.

## Performance Risks

- None — docs-only.

## Security Risks

- None.

## Future Risks

- If surfaces A/B adopts warm-paper/graphite, every surface/text/border contrast row must be recomputed (larger change than planned).
- Ramp steps (400/800/900/950) unapproved — may need adjustment during implementation.

---

# 12. Next Steps

Execute in this order.

1. Get user A/B decision on surfaces (cool-slate keep vs warm-paper adopt).
2. Re-theme `DESIGN/TOKENS.md` — brand ramp, semantic tokens, learning hues, §7 contrast table.
3. Re-theme `DESIGN/DESIGN.md`, `DESIGN/DESIGN_PLAYBOOK.md`, `DESIGN/MIGRATION.md` blue→orange.
4. Create `DESIGN/BRAND.md` from `DESIGN2.md/BRAND.md` (`#FF6A00`→`#F16913`); remove `DESIGN2.md/`.
5. Commit logo swap + design docs on `bug/fix`.
6. (Deferred) CSS migration: `global.css` + 26 files, dedicated PR.

After each step verify:

- [ ] Build (`pnpm build`)
- [ ] Tests (`pnpm test` if present)
- [ ] Type Check (`tsc --noEmit`)
- [ ] Lint (`pnpm lint`)

---

# 13. Validation Checklist

Before considering the work complete:

## Build

- [ ] Build succeeds

## Testing

- [ ] Tests pass

## Quality

- [ ] Lint passes
- [ ] Type check passes

## Documentation

- [ ] Updated (DESIGN/* re-themed)

## Security

- [ ] No secrets
- [ ] No debug code

## Performance

- [ ] No measurable regression

---

# 14. Development Commands

```bash
# Install (root)
pnpm install

# Development (website)
cd apps/website && pnpm dev

# Build
cd apps/website && pnpm build

# Test
pnpm test --filter ...   # per-package; website has no suite

# Lint
cd apps/website && pnpm lint

# Type Check
cd apps/website && pnpm tsc --noEmit
```

---

# 15. AI Working Rules

Before making changes:

1. Read this document completely.
2. Understand the current objective.
3. Review constraints.
4. Review architectural decisions.
5. Review failed attempts.
6. Inspect active files.
7. Continue from Next Steps.

## Never

- Redesign architecture without justification.
- Introduce unnecessary dependencies.
- Rename public APIs unnecessarily.
- Ignore documented constraints.
- Revert previous work without evidence.
- Repeat failed attempts.
- Modify protected files unless required.
- Use `#F16913` as body text on light surfaces.
- Touch `global.css` this task (CSS migration deferred).

## If Uncertain

Stop.

Document:

- What is unclear
- Why it is unclear
- What needs investigation
- Which files should be inspected

Do not guess.

---

# 16. Session Resume

## Current Task

Design-system rebrand docs (blue "Electric Rush" → orange `#F16913`), docs-only scope.

## Expected Outcome

`DESIGN/*` docs fully orange; `DESIGN2.md/` removed; logo swap committed; CSS untouched.

## First File To Open

`apps/website/DESIGN/TOKENS.md`

## First Action

Get the surfaces A/B decision from the user, then re-theme §3.1 brand ramp + §4 semantic brand tokens, and recompute §7 verified contrast.

---

# 17. Definition of Done

The work is complete only when:

- [ ] Current objective completed (DESIGN docs re-themed orange)
- [ ] Build passes
- [ ] Tests pass
- [ ] Type check passes
- [ ] Lint passes
- [ ] Documentation updated
- [ ] Constraints preserved (no CSS, no logo changes)
- [ ] No TODOs introduced
- [ ] No temporary code (DESIGN2.md/ removed)
- [ ] No debug logging

---

# Quality Checklist

- [x] Current objective reflects reality (docs-only orange rebrand, surfaces question open)
- [x] Active files are correct
- [x] Next steps are actionable
- [x] Failed attempts are documented (none this session)
- [x] No obsolete information remains
- [x] No duplicate information exists
- [x] Constraints still match the project
- [x] Architecture matches implementation
- [x] Another engineer or AI assistant could continue immediately
