## Context

`@nextrush/multipart` is a leaf middleware package (~1,646 LOC, 14 source files) providing streaming `multipart/form-data` parsing for NextRush. It has zero runtime dependencies, works across Node/Bun/Deno/Edge, and includes defense-in-depth security (prototype pollution blocking, filename sanitization, path-containment, MIME whitelisting, 8 configurable limits).

**The problem:** npm rejects publishing under the name `@nextrush/multipart` — "multipart" is a generic HTTP content-type term that triggers npm's name-policy review. npm support was unable to resolve this.

**Scope of rename:** ~350 references across ~100 files in the monorepo — package source, root config, changesets, scripts, skills, website docs (20+ pages), audit docs, ADRs/RFCs, reports, OpenSpec specs, and cross-references from 5+ other packages.

## Goals / Non-Goals

**Goals:**
- Rename npm package from `@nextrush/multipart` to `@nextrush/form-data` to unblock publishing
- Rename source directory from `packages/middleware/multipart/` to `packages/middleware/form-data/`
- Rename exported middleware function from `multipart()` to `formData()` — clean, idiomatic JS naming (camelCase)
- Rename exported types/classes to use `FormData*` prefix instead of `Multipart*` — e.g., `MultipartError` → `FormDataError`, `MultipartOptions` → `FormDataOptions`, `MultipartLimits` → `FormDataLimits`, etc.
- Update every reference across the monorepo
- Provide temporary backward-compat re-exports at the old package path for local development (advisory — old name is never published again)
- Preserve 100% behavioral and API semantics — zero functional changes

**Non-Goals:**
- No new features or behavior changes — this is a pure rename operation
- No change to the parser algorithm, scanner, storage strategies, security guards, or limit defaults
- No change to runtime support matrix
- No change to the underlying `multipart/form-data` content type constant in `@nextrush/types`
- No publishing of the old `@nextrush/multipart` name — it remains blocked

## Decisions

### D1: Rename `multipart()` to `formData()`, not `parseFormData()` or `multipartParser()`

**Chosen:** `formData()`

Rationale:
- `formData()` is concise and reads naturally in middleware chains: `app.use(formData({ maxFileSize: '10mb' }))`
- Parallels the browser `FormData` API — familiar mental model for developers
- `multipartParser()` is technically precise but verbose; the package name already establishes what it does
- `parseFormData()` reads as though it returns parsed data rather than installing middleware

### D2: Type rename strategy — `Multipart*` → `FormData*`

**Chosen:** Full rename of all public types

| Current | New |
|---------|-----|
| `MultipartError` | `FormDataError` |
| `MultipartErrorCode` | `FormDataErrorCode` |
| `MultipartOptions` | `FormDataOptions` |
| `MultipartLimits` | `FormDataLimits` |
| `MultipartState` | `FormDataState` |
| `MultipartField` | `FormDataField` |

The package documentation (`MULTIPART_CONTENT_TYPE` constant, error messages like `INVALID_CONTENT_TYPE`) retains "multipart/form-data" as the HTTP content-type string — this is the standard, not a package name.

### D3: Backward-compat re-exports

**Chosen:** Create a throwaway `packages/middleware/multipart/package.json` + `index.ts` that re-exports from `@nextrush/form-data` during the transitional commit window only. This is never published — it exists solely so the monorepo doesn't break mid-change when we rename the directory.

After the rename commits land, the old directory is removed entirely. No code outside the monorepo depends on `@nextrush/multipart`, so no external deprecation cycle is needed.

### D4: One-shot rename, not gradual deprecation

**Chosen:** Single commit wave — rename everything at once.

Rationale:
- No external consumers (leaf package, no other `@nextrush/*` imports it)
- The old npm name is blocked anyway — can't publish either name from the old identity
- Gradual deprecation would double the work (import both old and new names temporarily) with zero benefit

### D5: Execution order — directory first, then references

The rename is staged as:
1. `git mv packages/middleware/multipart packages/middleware/form-data`
2. Update `package.json` (name, directory, homepage, keywords)
3. Update source file headers with new package header comment
4. Update all source code: exports, type names, function names, test assertions
5. Fix test fixtures and expected values
6. Update config files (changesets, scripts, workspace references)
7. Update docs (README, ARCHITECTURE, CHANGELOG within the package)
8. Update root docs (README.md, CHANGELOG.md, PUBLISHING.md)
9. Update skills references
10. Update website docs (~20 pages)
11. Update OpenSpec specs (public-surface-lock delta)
12. Update audit docs, ADRs, RFCs, reports
13. Run test suite + build to verify nothing is broken

### D6: Non-RFC-gated (but still requires ADR note)

This is a rename of an existing leaf package — no new architectural capability, no new package with new behavior. The existing `ADR-0005` (which lists `@nextrush/multipart` in the middleware tier) needs a minor update to reflect the new name, but no new RFC is required.

## Risks / Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Missed reference in docs/audits/reports (~50 files) | Medium | Low (cosmetic) | Automated grep + manual pass over all files found in reference map |
| Website build breakage from stale import path | Medium | High (site down) | Update workspace config + test build locally before merging |
| Skills AGENTS.md import example drift | Low | Low | Grep after rename to confirm all code examples match new API |
| `FormData` name collision with browser `FormData` API | None | — | `@nextrush/form-data` is the npm package name; `formData()` is the middleware function. No global scope collision. |
| Developer confusion between `form-data` (client-side) and this package | Low | Low | README note: "Not to be confused with the client-side `form-data` package" |
| pnpm-lock.yaml merge conflict | Medium | Low | Regenerate with `pnpm install` after rename; standard lockfile workflow |
