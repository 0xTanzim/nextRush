## 1. Directory + Package Identity

- [x] 1.1 `git mv packages/middleware/multipart packages/middleware/form-data` — rename source directory
- [x] 1.2 Update `packages/middleware/form-data/package.json`: change `name` to `@nextrush/form-data`, update `description`, `keywords`, `homepage`, `bugs`, `repository.directory`
- [x] 1.3 Update `packages/middleware/form-data/CHANGELOG.md` header to `@nextrush/form-data`
- [x] 1.4 Update internal `import { … } from '@nextrush/multipart'` to `@nextrush/form-data` in all source tests and files under the package itself

## 2. Source Code Rename — Exports, Types, Functions

- [x] 2.1 Rename exported middleware function: `multipart()` → `formData()` in `src/middleware.ts` and `src/index.ts`
- [x] 2.2 Rename public types: `MultipartError` → `FormDataError`, `MultipartErrorCode` → `FormDataErrorCode`, `MultipartOptions` → `FormDataOptions`, `MultipartLimits` → `FormDataLimits`, `MultipartState` → `FormDataState`, `MultipartField` → `FormDataField`, `MultipartContentType` references to `FormDataContentType` pattern
- [x] 2.3 Rename `FileInfo` type (if `MultipartFileInfo`) and ensure `UploadedFile` stays consistent
- [x] 2.4 Update `Errors` factory object keys to use `FormData*` pattern where applicable
- [x] 2.5 Update all test assertions, mock imports, and expected values in `src/__tests__/*.test.ts` to match new export/type names
- [x] 2.6 Update surface-lock test (`public-surface.test.ts`) with new `@nextrush/form-data` locked export list
- [x] 2.7 Update `src/constants.ts`: rename `MULTIPART_CONTENT_TYPE` to `FORM_DATA_CONTENT_TYPE` (keep value `'multipart/form-data'` unchanged — that's the HTTP standard)

## 3. Package Docs

- [x] 3.1 Rewrite `packages/middleware/form-data/README.md`: update package name, install command, import paths, function name in all examples
- [x] 3.2 Rewrite `packages/middleware/form-data/ARCHITECTURE.md`: update package name, module references, diagrams

## 4. Monorepo Root Config

- [x] 4.1 Update `README.md` — package table entry: `@nextrush/multipart` → `@nextrush/form-data`
- [x] 4.2 Update `CHANGELOG.md` — multipart entry → form-data (with migration note)
- [x] 4.3 Update `PUBLISHING.md` — middleware list and publish script arguments: `@nextrush/multipart` → `@nextrush/form-data`
- [x] 4.4 Update `scripts/reset-independent-packages.sh` — key-value mapping `@nextrush/multipart` → `@nextrush/form-data`
- [x] 4.5 Update `scripts/check-coverage.ts` — package name in coverage tracking list
- [x] 4.6 Regenerate `pnpm-lock.yaml` by running `pnpm install`

## 5. Changeset Config

- [x] 5.1 Update `.changeset/config.json` — replace `@nextrush/multipart` with `@nextrush/form-data`
- [x] 5.2 Update `.changeset/pre.json` — replace `@nextrush/multipart` with `@nextrush/form-data`

## 6. Skills

- [x] 6.1 Update `skills/nextrush/AGENTS.md` — multipart in package list → `@nextrush/form-data`
- [x] 6.2 Update `skills/nextrush/SKILL.md` — middleware reference and usage notes: `multipart` → `formData()` / `form-data`
- [x] 6.3 Update `skills/nextrush/references/middleware.md` — import examples: `multipart` → `formData`, `'@nextrush/multipart'` → `'@nextrush/form-data'`
- [x] 6.4 Update `skills/nextrush/references/functional-api.md` — `ContentType.MULTIPART` reference if named (no change if it's just a string constant)
- [x] 6.5 Update `skills/nextrush/references/context.md` — `ctx.body` comment: `multipart` → `form-data`
- [x] 6.6 Update `skills/nextrush/references/best-practices.md` — `multipart` → `form-data`

## 7. Website Docs — Package Registry

- [x] 7.1 Update `apps/website/src/lib/package-links.ts` — route map key from `@nextrush/multipart` to `@nextrush/form-data`
- [x] 7.2 Update `apps/website/src/lib/package-registry-data-1.ts` — package metadata entry (name, description, href, etc.)

## 8. Website Docs — Reference Pages

- [x] 8.1 Rename/update `apps/website/content/docs/reference/(request-body)/multipart.mdx` to `form-data.mdx` — content-wide rename of `@nextrush/multipart` to `@nextrush/form-data`, `multipart()` to `formData()`
- [x] 8.2 Update `apps/website/content/docs/reference/(request-body)/body-parser.mdx` — any `multipart` references → `form-data`
- [x] 8.3 Update `apps/website/content/docs/reference/(request-body)/meta.json` — rename `"multipart"` entry to `"form-data"`
- [x] 8.4 Update `apps/website/content/docs/reference/index.mdx` — multipart links → form-data
- [x] 8.5 Update `apps/website/content/docs/reference/(core-routing)/types.mdx` — if it references multipart

## 9. Website Docs — Guides & Getting Started

- [x] 9.1 Update `apps/website/content/docs/guides/data/file-upload.mdx` — all multipart references → form-data
- [x] 9.2 Update `apps/website/content/docs/getting-started/runtime/node.mdx` — middleware list
- [x] 9.3 Update `apps/website/content/docs/help/compatibility-matrix.mdx` — multipart entry

## 10. Website Docs — Architecture & Community

- [x] 10.1 Update `apps/website/content/docs/architecture/package-hierarchy.mdx` — diagram labels and text
- [x] 10.2 Update `apps/website/content/docs/architecture/versioning.mdx` — multipart reference
- [x] 10.3 Update `apps/website/content/docs/architecture/release-handbook.mdx` — release history
- [x] 10.4 Update `apps/website/content/docs/production/security.mdx` — security checklist
- [x] 10.5 Update `apps/website/content/docs/migrate/breaking-changes.mdx` — add multipart→form-data migration note
- [x] 10.6 Update `apps/website/content/docs/migrate/upgrade-guide.mdx` — multipart reference
- [x] 10.7 Update `apps/website/content/docs/community/roadmap.mdx` — multipart reference
- [x] 10.8 Update `apps/website/content/blog/hardening-security-boundaries.mdx` — multipart reference

## 11. Cross-Package References

- [x] 11.1 Update `packages/types/src/context.ts` — JSDoc: `multipart` → `form-data`
- [x] 11.2 Update `packages/middleware/body-parser/src/errors.ts` — comment reference
- [x] 11.3 Update `packages/middleware/body-parser/src/parsers/combined.ts` — multipart rejection logic (comment only)
- [x] 11.4 Update `packages/middleware/body-parser/src/__tests__/body-parser.test.ts` — update expected error messages referencing multipart
- [x] 11.5 Update `packages/middleware/body-parser/src/__tests__/limit-and-hotpath.test.ts` — multipart references
- [x] 11.6 Update `packages/middleware/body-parser/README.md` — multipart cross-reference
- [x] 11.7 Update `packages/middleware/body-parser/ARCHITECTURE.md` — multipart mentions
- [x] 11.8 Update `packages/middleware/static/README.md` — multipart cross-reference
- [x] 11.9 Update `packages/middleware/static/ARCHITECTURE.md` — multipart mentions
- [x] 11.10 Update `packages/middleware/static/src/static.types.ts` — comment reference

## 12. Adapter & Runtime References

- [x] 12.1 Update `packages/runtime/ARCHITECTURE.md` — "Body parsing is @nextrush/body-parser / @nextrush/multipart" → form-data
- [x] 12.2 Update `packages/adapters/node/ARCHITECTURE.md` — same boundary note
- [x] 12.3 Update `packages/adapters/bun/src/__tests__/utils.test.ts` — multipart content-type test
- [x] 12.4 Update `packages/adapters/conformance/src/certification.ts` — comment reference

## 13. Audit / ADR / RFC / Report Docs

- [x] 13.1 Update `docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md` — multipart → form-data in middleware tier listing
- [x] 13.2 Update `docs/RFC/release-process/001-hybrid-versioning.md` — multipart reference
- [x] 13.3 Update `docs/audits/01-production-readiness-audit.md`
- [x] 13.4 Update `docs/audits/02-production-roadmap.md`
- [x] 13.5 Update `docs/audits/03-gap-checklist.md`
- [x] 13.6 Update `docs/audits/05-security-review.md`
- [x] 13.7 Update `docs/audits/06-framework-design-review.md`
- [x] 13.8 Update `docs/audits/07-runtime-architecture.md`
- [x] 13.9 Update `docs/audits/08-runtime-compatibility-gap-analysis.md`
- [x] 13.10 Update `docs/how-runtime-and-serverless-work-now.md`
- [x] 13.11 Update `docs/runtime-certification-matrix.md`

## 14. Report Docs

- [x] 14.1 Update `report/security-review.md`
- [x] 14.2 Update `report/security-review-remediation-index.md`
- [x] 14.3 Update `report/security-review-unreviewed-surface-followup.md`
- [x] 14.4 Update `report/middleware/middleware-body-parser-review.md`
- [x] 14.5 Update `report/architecture/architecture-review.md`
- [x] 14.6 Update `report/adapters/runtime-platform-review.md`

## 15. OpenSpec Specs (text references, not requirement changes)

- [x] 15.1 Update `openspec/specs/body-parser/spec.md` — multipart → form-data in scenarios
- [x] 15.2 Update `openspec/specs/portable-middleware/spec.md` — multipart → form-data in scenarios
- [x] 15.3 Update `openspec/specs/security-boundaries/spec.md` — multipart → form-data

## 16. Build Verification

- [x] 16.1 Verify TypeScript compilation: `pnpm --filter @nextrush/form-data build` — clean `tsc --strict`
- [x] 16.2 Run full test suite for form-data package: `pnpm --filter @nextrush/form-data test`
- [x] 16.3 Run body-parser tests: `pnpm --filter @nextrush/body-parser test` (no regressions)
- [x] 16.4 Run website build: `pnpm --filter apps-website build` or equivalent
- [x] 16.5 Run full monorepo lint: `pnpm lint` — no new lint errors
- [x] 16.6 Verify coverage thresholds hold: `pnpm --filter @nextrush/form-data coverage` or check `scripts/check-coverage.ts` thresholds
- [x] 16.7 Final regression sweep: `pnpm test` across entire monorepo
