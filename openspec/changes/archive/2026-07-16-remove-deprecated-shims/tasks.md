## 1. Removal

- [x] 1.1 Delete `packages/controllers/` entirely (src, __tests__, README.md, CHANGELOG.md,
  package.json, tsconfig.json, tsup.config.ts, vitest.config.ts, .turbo/)  <!-- done -->
- [x] 1.2 Delete `packages/decorators/` entirely (same file set as 1.1)  <!-- done -->

## 2. Workspace/tooling references

- [x] 2.1 Check `pnpm-workspace.yaml` for explicit package references; remove if present
  (globs like `packages/*` don't need editing — only explicit path/name entries would)  <!-- checked: pnpm-workspace.yaml uses only globs, no explicit entries to remove -->
- [x] 2.2 Check `turbo.json` for any package-specific pipeline overrides referencing either name;
  remove if present  <!-- checked: turbo.json has no package-specific overrides, only generic task definitions -->
- [x] 2.3 Check root `package.json`, `.changeset/config.json` (ignore lists), and any tsconfig
  project-reference arrays for either package name; remove if present  <!-- FOUND and FIXED: .changeset/config.json's `fixed` group explicitly listed both packages - removed. Root package.json had no references. -->
- [x] 2.4 Check `apps/docs/src/lib/package-registry-data-1.ts`, `apps/docs/src/lib/package-links.ts`,
  and `apps/docs/scripts/verify/reference-match.ts` for hardcoded entries for either package;
  remove if present  <!-- FOUND and FIXED all three: registry-data-1.ts had two full entries removed; package-links.ts had two reference-link entries removed; reference-match.ts's inferPackageName() had a REAL LOGIC BUG (not just a stale comment) - its fallback would have resolved decorators.mdx/controllers.mdx to the now-nonexistent packages, breaking the docs verify script. Added an explicit special case mapping both to @nextrush/class, matching the existing modules.mdx pattern in the same function. Also fixed apps/docs/src/app/agent-spec.json/route.ts (2 full deprecated entries removed, @nextrush/class's description fixed) and apps/docs/src/app/(home)/page.tsx (replaced the dead @nextrush/controllers home-page card with @nextrush/class). -->

## 3. Documentation updates

- [x] 3.1 Rewrite `apps/docs/content/docs/migrate/deprecations.mdx` from a migration table
  ("still supported, migrate at your convenience") to a removal notice ("removed in this
  version, here's how to migrate if you're still on the old import paths") — keep the
  symbol-mapping tables (still accurate and useful) and the codemod instructions, change the
  framing and any present-tense "still exist" language  <!-- done: full rewrite, tables preserved verbatim (they document the last-published shim's exports, which is exactly what a migrator needs) -->
- [x] 3.2 Update `apps/docs/content/docs/internals/package-hierarchy.mdx` to drop the two
  packages from the hierarchy diagram/table  <!-- done: fixed the Class Runtime table intro, the "still exist" callout, the "still depends on" note about nextrush's own dependencies (which was ALSO a real bug - see task 2.4's sibling finding on nextrush's package.json), and the full generated edge list (removed both entries, fixed nextrush's own edge list, fixed the "36 packages" header to 34) -->
- [x] 3.3 Update `apps/docs/content/docs/reference/index.mdx` to remove any reference entries
  for the two packages  <!-- done: fixed the class-based-controllers table row and the deprecated-shims callout -->
- [x] 3.4 Update `apps/docs/content/docs/resources/compatibility-matrix.mdx` (and
  `apps/docs/content/docs/migrate/upgrade-guide.mdx` if it lists them) to drop the two rows  <!-- done: compatibility-matrix.mdx rows removed; upgrade-guide.mdx step 3 updated from "future major removes them" to "already removed" (its historical 3.1.0 changelog example entry correctly left as-is, since that's a record of a past release, not current guidance) -->
- [x] 3.5 Grep the rest of `apps/docs/content/` for any remaining *current-tense* instruction to
  import from either package (not historical/changelog mentions) and fix  <!-- done: also fixed reference/class/index.mdx (deprecated->removed callout + section rename), reference/core/nextrush.mdx (table rows merged into one @nextrush/class row), internals/versioning.mdx (re-derived the real 14/18 package-version split and 9-package fixed group from source after the removal - the old 16/20 split and 11-package fixed group were now wrong), internals/contributing.mdx, resources/faq.mdx, resources/glossary.mdx, resources/roadmap.mdx, migrate/index.mdx, guides/migration.mdx, community/contributing.mdx (stale directory-tree comment). Blog posts and RFCs correctly left alone as historical record. -->

## 4. Root README

- [x] 4.1 Remove the `@nextrush/controllers` and `@nextrush/decorators` rows from the
  "Class-Based Development" package table in root `README.md`  <!-- the table row removal had already happened in an earlier, unrelated edit this session before T053 started; verified via grep that no rows remained. Also fixed a stale project-structure comment (`decorators/  # Controller decorators` folder that no longer exists). -->

## 5. Changeset

- [x] 5.1 Add a changeset (`.changeset/<name>.md`) documenting the breaking removal: what was
  removed, why (zero internal consumers, pure re-export shims, migration tooling already
  existed), and the migration path (codemod command + link to the rewritten deprecations doc)  <!-- done: .changeset/remove-deprecated-controllers-decorators.md, major bump on `nextrush` and `@nextrush/class` -->

## 6. Verification

- [x] 6.1 Run `turbo run typecheck --force` (cache-bypassed, per the lesson from the T005 session
  that `pnpm typecheck` can serve a stale cache) — 0 errors across the remaining workspace  <!-- 58/58 tasks green, re-confirmed after all doc/source fixes -->
- [x] 6.2 Run `turbo run test --force` (cache-bypassed) — confirm green (or only the
  already-known pre-existing DI circular-dependency timeout flake, unrelated to this change)  <!-- 72/74 tasks green; the one failure is the SAME pre-existing @nextrush/class registrar.test.ts CircularDependencyError timeout already logged in the repo-wide-surface-snapshots session, confirmed unrelated to this removal (301/302 individual tests pass) -->
- [x] 6.3 Grep the full repo for `from ['"]@nextrush/(controllers|decorators)['"]` and confirm
  zero real import statements remain (historical mentions in CHANGELOG.md/RFC/ADR docs and the
  removal notice's own before/after examples are fine to keep — verify each remaining hit falls
  into one of those categories, not a live current-tense instruction)  <!-- swept multiple times across this task group; found and fixed 6 LIVE JSDoc @example blocks in packages/class/src (lifecycle-types.ts x2, guards.ts, guard-types.ts, filter-types.ts, interceptor-types.ts - these are IDE-hover-visible doc comments, not historical text, so genuinely in scope), 4 in skills/nextrush/ (SKILL.md, references/controllers.md, references/ecosystem.md), 1 in packages/di/README.md, and 6 in wiki/ (Controllers-and-Decorators.md x4, Packages.md, Dependency-Injection.md - the wiki is published, current-tense end-user docs). Final remaining hits are all correctly historical/example: the codemod's own test fixtures, RFC decision records, CHANGELOG entries, and this change's own report/changeset/deprecations.mdx before-after diffs. -->
- [x] 6.4 Confirm `pnpm install` / workspace resolution succeeds with no dangling
  `workspace:*` references to either removed package from any remaining package's
  `dependencies`/`peerDependencies` (none expected — grep confirmed zero consumers — but verify
  after deletion, not just before)  <!-- FOUND A REAL GAP the original investigation report's grep missed (it only checked import statements, not package.json dependency declarations): `pnpm install` failed outright with ERR_PNPM_WORKSPACE_PKG_NOT_FOUND on apps/playground, which had @nextrush/controllers and @nextrush/decorators as dead dependencies (zero actual imports, same pattern as nextrush's own package.json - see 2.4). Also found packages/nextrush/package.json itself still declared both as direct dependencies. Fixed both package.json files, re-ran pnpm install successfully, confirmed pnpm-lock.yaml dropped all 50 lines referencing either package. -->

## 7. Close out

- [x] 7.1 Update `docs/audits/03-gap-checklist.md`'s T053 entry to ☑ with a verification note
  (packages deleted, docs updated, changeset added, cache-bypassed typecheck/test green,
  zero dangling references) and recompute the dependency graph / critical-path summary now that
  the `T005 → T053 → T060` chain's second link is closed  <!-- done in a follow-up commit -->
- [x] 7.2 Commit in logically scoped commits: (a) package deletion + workspace/tooling refs,
  (b) documentation updates + README, (c) changeset, (d) gap-checklist update — per
  `kiro-git.md`'s one-concern-per-commit discipline  <!-- done -->
- [x] 7.3 Run `openspec validate remove-deprecated-shims --strict`, then archive the change  <!-- done -->
