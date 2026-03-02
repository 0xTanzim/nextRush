---
description: 'Generate or update NextRush documentation from actual codebase implementation. Enforces code-first accuracy, verifiable examples, quality scoring, and self-review.'
agent: docs-writer-agent
name: "Write Docs From Code"
argument-hint: "Package name (e.g., @nextrush/core) and optional doc path or focus area"
---

# Write NextRush Documentation From Code

## Mission

Generate or update NextRush documentation that is fully synchronized with the actual codebase. Documentation must be derived from real implementation — not assumptions, memory, or old patterns.

---

## Hard Rules

- Never write documentation before reviewing the code
- Never guess API behavior — verify from source
- Never blindly follow old documentation — validate against current implementation
- Never invent features, defaults, or options that don't exist in code
- Never add diagrams without verifying actual runtime behavior in code
- Never duplicate content that exists in another doc page
- If required context is missing, research deeper before stopping

---

## Required Inputs

- `${input:packageName}` — Target package (e.g., `@nextrush/core`)
- Optional: `${input:targetDocPath}` — Path to the doc file to write/update
- Optional: `${input:focusArea}` — Specific API, feature, or section

---

## Workflow (Mandatory Order)

Follow every step in order. Do not skip steps.

---

### Step 1 — Deep Code Inspection

1. Locate package source: `packages/{name}/src/`
2. Read and analyze:
   - Public exports
   - Function signatures
   - Default values
   - Error handling paths
   - Side effects
   - TypeScript types
3. Map:
   - What is actually implemented
   - What is configurable
   - What is NOT supported
4. Cross-reference with existing tests to verify behavior
5. If behavior is unclear, read deeper, check tests, check usage in playground

---

### Step 2 — Existing Documentation Audit

1. Locate any existing docs for this package
2. Treat old docs as historical reference only — potentially incorrect
3. Identify:
   - Mismatches with code
   - Deprecated patterns
   - Missing updates
   - Incorrect defaults
4. Check for duplicate content across doc pages

---

### Step 3 — Code vs Docs Reconciliation

Create an explicit diff: what code does now vs what docs claim.

Code always wins.

---

### Step 4 — Cross-Reference Verification

- Verify all code examples compile and run correctly
- Verify all configuration options exist in source code
- Verify all default values match source code
- Verify all function signatures match TypeScript definitions
- Verify linked pages exist and are current

---

### Step 5 — Diagram Decision (Mermaid Gate)

Only add diagrams when they explain execution flow, lifecycle, or architecture and text alone would be slower to understand.

Rules:
- Use `graph LR` for flow
- Use `sequenceDiagram` for request lifecycle
- Keep small and readable
- Use real component names from code
- No decorative diagrams

---

### Step 6 — Write Documentation

Write following all applicable instruction files:

- `docs-standards.instructions.md` — philosophy, structure, writing rules
- `docs-mdx-ui.instructions.md` — MDX components and visuals (if .mdx)
- `docs-api-reference.instructions.md` — API reference format (if API docs)

---

### Step 7 — Duplication Prevention

Before finalizing, verify:

- No content duplicated from other doc pages
- Shared concepts link to their canonical page instead of re-explaining
- API details live in API reference, not in concept pages
- Configuration details live in one place only

---

### Step 8 — Quality Scoring (Self-Assessment)

Score each dimension 0-10:

| Dimension | Minimum | Description |
|---|---|---|
| Code Accuracy | 9 | Does every statement match the actual source code? |
| Completeness | 8 | Are all public APIs and behaviors documented? |
| Example Quality | 8 | Are examples runnable, minimal, and correct? |
| Structure | 8 | Does the page follow docs-standards structure? |
| Clarity | 8 | Would a junior developer understand this? |
| Duplication | 9 | Is there zero duplicated content across docs? |
| Cross-References | 7 | Are links to related pages correct and current? |
| Visual Accuracy | 8 | Do diagrams match actual runtime behavior? |

If ANY dimension scores below its minimum, revise before delivering. Max 3 revision cycles.

---

### Step 9 — Self-Review Checklist

Before finalizing:

- [ ] Every code example verified against source
- [ ] Every default value verified against source
- [ ] Every function signature matches TypeScript definition
- [ ] No invented features or options
- [ ] No marketing language or superlatives
- [ ] No forbidden words (simply, just, easy, obviously, etc.)
- [ ] Page follows mandatory structure from docs-standards
- [ ] Active voice throughout
- [ ] One idea per paragraph
- [ ] Links tested and valid
- [ ] No content duplicated from other pages
- [ ] Would a developer trust this page to ship production code?

If any item fails, fix and re-check. Do not deliver unchecked documentation.

---

## Operational Rules

- Code is the single source of truth — always
- If docs and code disagree, the docs are wrong
- Prefer showing real behavior over describing ideal behavior
- Document what IS, not what SHOULD BE
- Every claim must be verifiable in source code
- Do not pad documentation with filler content
- Quality over quantity — a short accurate page beats a long inaccurate one
