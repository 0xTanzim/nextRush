## 1. Structure (Move & Rename)

- [x] 1.1 Rename `content/docs/start/` to `content/docs/getting-started/`
- [x] 1.2 Update `getting-started/meta.json` with new sidebar label and order
- [x] 1.3 Create `content/docs/examples/` directory with `meta.json`
- [x] 1.4 Create guide sub-category directories under `content/docs/guides/`: `api-development/`, `authentication/`, `data/`, `communication/`, `testing/`, `security/`, `background-jobs/`
- [x] 1.5 Update `guides/meta.json` to reference sub-categories as nested groups
- [x] 1.6 Create recipe sub-category directories under `content/docs/recipes/`: `database/`, `authentication/`, `storage/`, `email/`, `queue/`, `payments/`, `deployment/`, `monitoring/`, `ai/`
- [x] 1.7 Update `recipes/meta.json` to reference sub-categories as nested groups
- [x] 1.8 Add redirects in `legacy-redirects.ts` for all renamed/moved paths

## 2. Content Relocation (Performance → Production + Architecture)

- [x] 2.1 Move `content/docs/performance/comparison.mdx` to `content/docs/architecture/benchmarks.mdx`
- [x] 2.2 Move `content/docs/performance/tuning.mdx` to `content/docs/production/performance-tuning.mdx` (already existed at destination)
- [x] 2.3 Delete `content/docs/performance/` directory
- [x] 2.4 Add redirects: `/docs/performance/*` → respective new locations
- [ ] 2.5 Update any cross-links referencing old performance paths

## 3. Content Relocation (Dissolve Help)

- [x] 3.1 Distribute FAQ to `getting-started/faq.mdx` (full reference page in Getting Started for setup/usage questions)
- [x] 3.2 Distribute glossary to `reference/glossary.mdx` (reference document by nature)
- [x] 3.3 Distribute troubleshooting to `reference/troubleshooting.mdx` (consolidated reference page)
- [x] 3.4 Move compatibility-matrix to `getting-started/compatibility-matrix.mdx`
- [x] 3.5 Delete `content/docs/help/` directory
- [x] 3.6 Add redirect: `/docs/help/*` → relevant target pages

## 4. Guide Re-grouping

- [x] 4.1 Move API-related guides into `guides/api-development/`
- [x] 4.2 Move auth-related guides into `guides/authentication/`
- [x] 4.3 Move data-related guides into `guides/data/`
- [x] 4.4 Move communication-related guides into `guides/communication/`
- [x] 4.5 Move testing-related guides into `guides/testing/`
- [x] 4.6 Move security-related guides into `guides/security/`
- [x] 4.7 Move background-job guides into `guides/background-jobs/`
- [x] 4.8 Create `meta.json` for each guide sub-category with title and learningPath
- [ ] 4.9 Update all cross-links affected by guide moves

## 5. Recipe Re-grouping

- [x] 5.1 Move database recipes into `recipes/database/`
- [x] 5.2 Move auth recipes into `recipes/authentication/`
- [ ] 5.3 Move storage recipes into `recipes/storage/` (no existing storage recipes)
- [ ] 5.4 Move email recipes into `recipes/email/` (no existing email recipes)
- [x] 5.5 Move queue recipes into `recipes/queue/`
- [ ] 5.6 Move payments recipes into `recipes/payments/` (no existing payments recipes)
- [ ] 5.7 Move deployment recipes into `recipes/deployment/` (no existing deployment recipes)
- [ ] 5.8 Move monitoring recipes into `recipes/monitoring/` (no existing monitoring recipes)
- [ ] 5.9 Move AI recipes into `recipes/ai/` (no existing AI recipes)
- [x] 5.10 Create `meta.json` for each recipe sub-category with title and learningPath
- [ ] 5.11 Update all cross-links affected by recipe moves

## 6. Examples Section

- [x] 6.1 Create `content/docs/examples/hello-world.mdx` with example page (Overview, Quick Start, Deploy)
- [x] 6.2 Create `content/docs/examples/rest-api.mdx` with example page (Architecture, Features, Deploy)
- [x] 6.3 Create `content/docs/examples/todo-app.mdx` with example page (Full-stack example)
- [x] 6.4 Create `content/docs/examples/meta.json` with section title and order
- [x] 6.5 Ensure each example page includes architecture diagram, features table, and deploy section

## 7. Page Templates & Governance

- [x] 7.1 Finalize `apps/website/DESIGN/PAGE_TEMPLATES.md` with complete Guide/Recipe/Example templates, metadata, decision trees, callouts, components, governance
- [x] 7.2 Update `apps/website/AGENTS.md` to reference PAGE_TEMPLATES.md and content governance rules
- [x] 7.3 Add frontmatter validation (status field with lifecycle states, keywords array, difficulty, readingTime, prerequisites) — via `source.config.ts` frontmatterSchema extension
- [x] 7.4 Add deprecation banner rendering for pages with `status: deprecated` — via `page.tsx` layout check

## 8. Learning Paths

- [x] 8.1 Add `learningPath` array to `guides/api-development/meta.json`
- [x] 8.2 Add `learningPath` to `guides/authentication/meta.json`
- [x] 8.3 Add `learningPath` to `guides/data/meta.json`
- [x] 8.4 Add `learningPath` to `guides/testing/meta.json`
- [x] 8.5 Add `learningPath` to `guides/security/meta.json`
- [x] 8.6 Add `learningPath` to relevant recipe sub-category meta.json files
- [x] 8.7 Extend metaSchema in `source.config.ts` to accept custom meta.json fields

## 9. Cross-Linking Audit

- [ ] 9.1 Standardize callout usage across all pages: scan for existing ad-hoc callouts and convert to taxonomy
- [ ] 9.2 Add `keywords` frontmatter to every page (search aliases)
- [x] 9.3 Add `references` cross-link arrays to all guide/recipe sub-category meta.json files
- [x] 9.4 Add `seeAlso` frontmatter field to page schema
- [ ] 9.5 Verify all cross-links are correct after moves (broken link check)
- [ ] 9.6 Verify accessibility: images have alt text, code blocks have language labels
- [ ] 9.7 Verify mobile: tables scroll, code blocks scroll, nav works on 320px viewport

## 10. Verification

- [ ] 10.1 Confirm all old URLs redirect (301) to new locations (requires dev server)
- [ ] 10.2 Confirm `help/`, `performance/` no longer appear in navigation (requires dev server)
- [ ] 10.3 Confirm Examples section renders with 3+ examples (requires dev server)
- [ ] 10.4 Confirm guide sub-categories appear as nested groups in sidebar (requires dev server)
- [ ] 10.5 Confirm recipe sub-categories appear as nested groups in sidebar (requires dev server)
- [ ] 10.6 Confirm learning paths are documented in meta.json for each domain section
- [x] 10.7 Schema validation passes: fumadocs-mdx generates successfully with extended schemas
- [x] 10.8 Next.js compilation succeeds (94s) — pre-existing type-check error in generate-openapi.ts (needs @nextrush/types built first) unrelated to this change
- [x] 10.9 Frontmatter validation passes for all existing content (prerequisites now accepts string or array)
- [x] 10.10 Legacy redirects Map syntax fixed (array entries were placed outside Map constructor)
