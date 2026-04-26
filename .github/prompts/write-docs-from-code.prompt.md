---
description: 'Generate or update NextRush documentation from actual codebase. Code-first accuracy, tier-based structure, verified examples, quality scoring.'
agent: docs-writer-agent
name: 'Write Docs From Code'
argument-hint: 'Package name (e.g., @nextrush/core) and optional focus area'
---

# Write NextRush Documentation From Code

Generate or update documentation that is fully synchronized with the actual codebase.

---

## Hard Rules

- Never write documentation before reviewing the code
- Never guess API behavior — verify from source
- Never invent features, defaults, or options that don't exist in code
- Never duplicate content that exists in another doc page
- If required context is missing, research deeper before stopping
- Code is the single source of truth — always

---

## Inputs

- `${input:packageName}` — Target package (e.g., `@nextrush/core`)
- Optional: `${input:targetDocPath}` — Path to the doc file to write/update
- Optional: `${input:focusArea}` — Specific API, feature, or section

---

## Workflow (6 Steps)

Follow every step in order. Do not skip.

---

### Step 1 — Inspect Code

1. Locate package source: `packages/{name}/src/`
2. Read and analyze:
   - Public exports and barrel file (`index.ts`)
   - Function signatures and return types
   - Default values in source code
   - Error handling and thrown errors
   - Side effects and lifecycle behavior
   - TypeScript types and interfaces
3. Cross-reference with tests to verify expected behavior
4. Map what is implemented, what is configurable, and what is NOT supported
5. If behavior is unclear — read deeper, check tests, check playground usage

---

### Step 2 — Audit Existing Docs

1. Locate any existing docs for this package in `apps/docs/content/`
2. Treat old docs as historical reference — potentially incorrect
3. Create an explicit reconciliation: what code does vs what docs claim
4. Identify:
   - Mismatches with current code
   - Deprecated patterns
   - Incorrect defaults or signatures
   - Content duplicated across pages
5. Code always wins. Mark all discrepancies for correction.

---

### Step 3 — Write

1. Determine page tier from `docs-standards.instructions.md` (Tier 1, 2, or 3)
2. Follow the tier-specific template structure
3. Apply writing rules from `docs-standards.instructions.md`
4. Use correct MDX components from `docs-mdx-ui.instructions.md`:
   - `TypeTable` for API properties and options
   - `PackageInstall` for installation
   - `Steps` for sequential procedures
   - `Tabs` for alternative comparisons
   - `Callout` for warnings, tips, alerts (max 3 per page)
   - Mermaid for flows and architecture (max 2 per page)
5. For API reference pages, follow `docs-api-reference.instructions.md`
6. Only add diagrams when they explain flow or architecture faster than text
7. Stay within the word budget for the page tier

---

### Step 4 — Verify

Cross-reference every claim against source code:

- [ ] Every code example compiles and reflects current API
- [ ] Every default value matches source code
- [ ] Every function signature matches TypeScript definitions
- [ ] Every configuration option exists in source
- [ ] All imports are correct and current
- [ ] No invented features or options
- [ ] No content duplicated from other doc pages
- [ ] Shared concepts link to canonical page instead of re-explaining
- [ ] All links point to existing pages

---

### Step 5 — Score

Apply the quality scoring system from `docs-standards.instructions.md`:

| Dimension       | Min | What It Measures                             |
| --------------- | --- | -------------------------------------------- |
| Code Accuracy   | 9   | Every statement matches actual source code   |
| Structure       | 8   | Follows correct tier template                |
| Clarity         | 8   | Junior developer can understand and use this |
| Example Quality | 8   | Examples are runnable, minimal, and correct  |
| Duplication     | 9   | Zero content duplicated across docs          |
| Completeness    | 8   | All public APIs and behaviors documented     |

If any dimension falls below minimum, revise. Maximum 3 revision cycles.

**This is the only scoring system.** Do not add dimensions.

---

### Step 6 — Self-Review

Before delivering:

- [ ] Correct tier template followed
- [ ] Problem explained before API
- [ ] Active voice throughout
- [ ] No forbidden words (simply, just, easy, obviously, powerful, flexible, robust)
- [ ] No marketing language
- [ ] One idea per paragraph
- [ ] MDX components used correctly (Fumadocs syntax)
- [ ] Within word budget for tier
- [ ] Could a developer ship using only this page?

If any item fails, fix and re-check. Do not deliver unchecked documentation.

---

## Operational Rules

- Document what IS, not what SHOULD BE
- Prefer showing real behavior over describing ideal behavior
- Every claim must be verifiable in source code
- Do not pad documentation with filler content
- Quality over quantity — short and accurate beats long and inaccurate
- If docs and code disagree, the docs are wrong
