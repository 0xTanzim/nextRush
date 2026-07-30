## Why

`@nextrush/multipart` cannot be published to npm — the name "multipart" is a generic HTTP content-type term that triggers npm's name-policy review process. Despite contacting npm support, no resolution was reached. The rename to `@nextrush/form-data` unblocks publishing. Additionally, "form-data" better maps to the Web Platform `FormData` API that developers already know from the browser, and pairs naturally with `@nextrush/body-parser` to complete the body-handling story.

## What Changes

- **BREAKING**: Rename npm package from `@nextrush/multipart` to `@nextrush/form-data`
- Rename source directory from `packages/middleware/multipart/` to `packages/middleware/form-data/`
- **BREAKING**: Rename exported middleware function from `multipart()` to `formData()`
- Rename all public type/class exports to drop the `Multipart` prefix in favor of `FormData` (e.g., `MultipartError` → `FormDataError`, `MultipartOptions` → `FormDataOptions`, etc.)
- Update all internal imports, cross-references, docs, skills, website, and config files across the monorepo
- Provide a backward-compat re-export shim at old package path (advisory, no publish)
- The parser, scanner, storage, security guards, and runtime behavior are **unchanged** — this is a pure rename

## Capabilities

### New Capabilities

*(none — this is a rename of an existing package, not a new capability)*

### Modified Capabilities

*(none — the rename affects implementation of one package's surface-lock test, but the capability's requirements (every package has a surface-lock test) are unchanged)*

## Impact

**~350 references across ~100 files** in the monorepo:

| Area | Files | Type |
|------|-------|------|
| Package source | ~30 | Directory rename, package.json, source headers, README, ARCHITECTURE, CHANGELOG |
| Root config | 5 | README.md, CHANGELOG.md, PUBLISHING.md, pnpm-lock.yaml, packages.json |
| Changeset | 2 | config.json, pre.json |
| Scripts | 2 | reset-independent-packages.sh, check-coverage.ts |
| Skills | ~5 | AGENTS.md, SKILL.md, references/middleware.md, references/context.md, etc. |
| Website docs | ~20 | package-registry, reference pages, guides, navigation, meta |
| Other packages | ~15 | body-parser, static, runtime, types, adapters (comments/docs) |
| Audit docs | ~10 | production audit, security review, design review, gap checklist, etc. |
| ADRs/RFCs | ~3 | ADR-0005, RFC release-process, etc. |
| Reports | ~6 | security-review, middleware reviews, architecture review, etc. |
| OpenSpec specs | ~3 | body-parser, portable-middleware, security-boundaries |
