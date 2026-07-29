## 1. Structure (Move & Rename)

- [ ] 1.1 Rename `content/docs/start/` to `content/docs/getting-started/`
- [ ] 1.2 Update `getting-started/meta.json` with new sidebar label and order
- [ ] 1.3 Create `content/docs/examples/` directory with `meta.json`
- [ ] 1.4 Create guide sub-category directories under `content/docs/guides/`: `api-development/`, `authentication/`, `data/`, `communication/`, `testing/`, `security/`, `background-jobs/`
- [ ] 1.5 Update `guides/meta.json` to reference sub-categories as nested groups
- [ ] 1.6 Create recipe sub-category directories under `content/docs/recipes/`: `database/`, `authentication/`, `storage/`, `email/`, `queue/`, `payments/`, `deployment/`, `monitoring/`, `ai/`
- [ ] 1.7 Update `recipes/meta.json` to reference sub-categories as nested groups
- [ ] 1.8 Add redirects in `next.config.mjs` for all renamed/moved paths

## 2. Content Relocation (Performance → Production + Architecture)

- [ ] 2.1 Move `content/docs/performance/comparison.mdx` to `content/docs/architecture/benchmarks.mdx`
- [ ] 2.2 Move `content/docs/performance/tuning.mdx` to `content/docs/production/performance-tuning.mdx`
- [ ] 2.3 Delete `content/docs/performance/` directory
- [ ] 2.4 Add redirects: `/docs/performance/*` → respective new locations
- [ ] 2.5 Update any cross-links referencing old performance paths

## 3. Content Relocation (Dissolve Help)

- [ ] 3.1 Distribute `help/faq.mdx` entries to relevant guides, recipes, and concepts as Info/Edge Case callouts
- [ ] 3.2 Distribute `help/glossary.mdx` terms into Concepts pages as Glossary callouts
- [ ] 3.3 Distribute `help/troubleshooting.mdx` to relevant Recipe Troubleshooting sections
- [ ] 3.4 Move `help/compatibility-matrix.mdx` to `getting-started/` or `reference/`
- [ ] 3.5 Delete `content/docs/help/` directory
- [ ] 3.6 Add redirect: `/docs/help/*` → relevant target pages

## 4. Guide Re-grouping

- [ ] 4.1 Move API-related guides into `guides/api-development/`
- [ ] 4.2 Move auth-related guides into `guides/authentication/`
- [ ] 4.3 Move data-related guides into `guides/data/`
- [ ] 4.4 Move communication-related guides into `guides/communication/`
- [ ] 4.5 Move testing-related guides into `guides/testing/`
- [ ] 4.6 Move security-related guides into `guides/security/`
- [ ] 4.7 Move background-job guides into `guides/background-jobs/`
- [ ] 4.8 Create `meta.json` for each guide sub-category with title and learningPath
- [ ] 4.9 Update all cross-links affected by guide moves

## 5. Recipe Re-grouping

- [ ] 5.1 Move database recipes into `recipes/database/`
- [ ] 5.2 Move auth recipes into `recipes/authentication/`
- [ ] 5.3 Move storage recipes into `recipes/storage/`
- [ ] 5.4 Move email recipes into `recipes/email/`
- [ ] 5.5 Move queue recipes into `recipes/queue/`
- [ ] 5.6 Move payments recipes into `recipes/payments/`
- [ ] 5.7 Move deployment recipes into `recipes/deployment/`
- [ ] 5.8 Move monitoring recipes into `recipes/monitoring/`
- [ ] 5.9 Move AI recipes into `recipes/ai/`
- [ ] 5.10 Create `meta.json` for each recipe sub-category with title and learningPath
- [ ] 5.11 Update all cross-links affected by recipe moves

## 6. Examples Section

- [ ] 6.1 Create `content/docs/examples/hello-world/` with example page (Overview, Quick Start, Deploy)
- [ ] 6.2 Create `content/docs/examples/rest-api/` with example page (Architecture, Features, Deploy)
- [ ] 6.3 Create `content/docs/examples/todo-app/` with example page (Full-stack example)
- [ ] 6.4 Create `content/docs/examples/meta.json` with section title and order
- [ ] 6.5 Ensure each example page includes architecture diagram, features table, and deploy section

## 7. Page Templates & Governance

- [ ] 7.1 Finalize `apps/website/DESIGN/PAGE_TEMPLATES.md` with complete Guide/Recipe/Example templates, metadata, decision trees, callouts, components, governance
- [ ] 7.2 Update `apps/website/AGENTS.md` to reference PAGE_TEMPLATES.md and content governance rules
- [ ] 7.3 Add frontmatter validation (status field with lifecycle states, keywords array, difficulty, readingTime, prerequisites) — via Fumadocs config or a custom validation script
- [ ] 7.4 Add deprecation banner rendering for pages with `status: deprecated` — via Fumadocs remark plugin or custom layout

## 8. Learning Paths

- [ ] 8.1 Add `learningPath` array to `guides/api-development/meta.json`
- [ ] 8.2 Add `learningPath` to `guides/authentication/meta.json`
- [ ] 8.3 Add `learningPath` to `guides/data/meta.json`
- [ ] 8.4 Add `learningPath` to `guides/testing/meta.json`
- [ ] 8.5 Add `learningPath` to `guides/security/meta.json`
- [ ] 8.6 Add `learningPath` to relevant recipe sub-category meta.json files

## 9. Polish & Consistency

- [ ] 9.1 Standardize callout usage across all pages: scan for existing ad-hoc callouts and convert to taxonomy
- [ ] 9.2 Add `keywords` frontmatter to every page (search aliases)
- [ ] 9.3 Verify all cross-links are correct after moves (broken link check)
- [ ] 9.4 Verify accessibility: images have alt text, code blocks have language labels
- [ ] 9.5 Verify mobile: tables scroll, code blocks scroll, nav works on 320px viewport
- [ ] 9.6 Run website build — confirm no errors

## 10. Verification

- [ ] 10.1 Confirm all old URLs redirect (301) to new locations
- [ ] 10.2 Confirm `help/`, `performance/` no longer appear in navigation
- [ ] 10.3 Confirm Examples section renders with 3+ examples
- [ ] 10.4 Confirm guide sub-categories appear as nested groups in sidebar
- [ ] 10.5 Confirm recipe sub-categories appear as nested groups in sidebar
- [ ] 10.6 Confirm learning paths are documented in meta.json for each domain section
- [ ] 10.7 Confirm Lighthouse accessibility score ≥ 95 on a documentation page
- [ ] 10.8 Confirm Lighthouse best practices score ≥ 90 on a documentation page
