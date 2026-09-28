# Design

## Context

**See proposal.md — Why** for the motivation. This section records only the current state and the
constraints that shaped the approach. All version facts below were verified against the npm registry
and the repository on **2026-09-28**.

Repository state that constrains the approach:

- The workspace catalog pins `typescript: "~6.0.3"` and `eslint: "~9.39.5"`; the root flat config
  (`eslint.config.mjs`) layers `strictTypeChecked` + `stylisticTypeChecked` plus explicit overrides,
  and applies the repo rule `nextrush/no-runtime-identity-capability` to
  `packages/**/src/**/*.ts` (tests excluded).
- 21 package `lint`/`lint:fix` scripts run ESLint; turbo's `verify` task is
  `build` → `test` + `typecheck` + `lint`, and both CI and the pre-push hook run it.
- 89 `eslint-disable*` directives (70 of them `-next-line`, plus 4 matching `eslint-enable`) exist
  across 51 files under `packages/`, `scripts/`, `tools/`.
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 10080` (7 days) with no `minimumReleaseAgeExclude`
  entry, so the newest published packages are deliberately quarantined at install time.
- `@nextrush/dev` declares `@swc/core` + `@swc-node/register` as its only runtime dependencies and
  never imports `typescript` at runtime. It reaches TypeScript exactly once: the `--dts` declaration
  pass resolves `typescript/package.json` relative to its own dependency tree and spawns that
  package's `bin.tsc` (`commands/build/declaration-builder.ts`).
- `create-nextrush`'s production preset writes an `eslint.config.mjs` that imports `@eslint/js` and
  `typescript-eslint`, while its dependency manifest declares `typescript` (and `@types/node`,
  `vitest`, `dotenv`) only — the emitted lint gate references packages the generated project never
  declares.

Upstream facts that decide the version set:

| Package | Latest | Published | Notes |
| --- | --- | --- | --- |
| `typescript` | **7.0.2** | 2026-07-08 | npm `latest`; `bin: { tsc: "bin/tsc" }`; `type: "module"`; **no `main`**; **no `tsserver` bin**; native compiler pulled per platform via 20 `optionalDependencies` (`@typescript/typescript-<platform>`, all pinned `7.0.2`) |
| `oxlint` | **1.85.0** | 2026-09-21T15:32Z | type-aware linting via tsgolint; `1.83.0` published 2026-09-14 |
| `oxlint-tsgolint` | **7.0.2003** | 2026-09-24T15:18Z | version encodes its TypeScript version — `7.0.2` + patch `003`; `7.0.2002` published 2026-09-18 |
| `typescript-eslint` | 8.70.1 | 2026-09-21 | `peerDependencies.typescript: ">=4.8.4 <6.1.0"` — the hard block |
| `eslint` | 10.11.0 | — | core TS 7 support still blocked on typescript-eslint (eslint/eslint#21070) |

The 7-day quarantine (cutoff **2026-09-21T02:57Z**) makes `oxlint@1.85.0` and
`oxlint-tsgolint@7.0.2003` unresolvable *today*: 1.85.0 becomes installable at 2026-09-28T15:32Z and
7.0.2003 at 2026-10-01T15:18Z. `typescript@7.0.2` (81 days old) is unaffected.

## Goals / Non-Goals

**Goals:**

- Land the toolchain swap in an order where any behaviour delta is attributable to exactly one
  change: linter first (on TypeScript 6, where the current baseline is green), compiler second.
- Fix an exact, reproducible version set that respects the workspace's release-age quarantine and
  keeps `typescript` and `oxlint-tsgolint` on a documented lockstep relationship.
- Keep the custom repo rule's enforcement and all 89 existing suppression directives working
  without a mass edit.
- Make the generated project's lint gate actually runnable, and keep the `--dts` declaration pass
  correct under TypeScript 7's distribution layout.

**Non-Goals:**

- Formatting: Prettier stays. A formatter swap is separate work.
- Introducing a `repo-tooling` capability spec — see Decisions.
- Rewriting the custom rule as a native (Rust) rule — that is oxc-upstream work, not this repo's.
- Any runtime behaviour, adapter, or request-path change; the conformance suite is the proof of that.

## Decisions

### D1 — Swap the linter before bumping the compiler

Two orthogonal changes land as two commit sets: lint engine first (TypeScript still 6.0.3, ESLint
baseline known green), then the compiler bump. **Alternative rejected:** one combined migration —
if findings or type errors appear, neither can be attributed to the linter or the compiler, and the
bisect surface is the whole repo. Splitting costs one extra `pnpm verify` cycle and buys two clean
rollback points.

### D2 — Oxlint + tsgolint is the replacement, not Biome

Oxlint delegates type-aware rules to `oxlint-tsgolint`, which builds real TypeScript programs on
`typescript-go` and therefore works on TypeScript 7 — the exact thing that broke
`typescript-eslint`. Biome's type-aware linting infers types without the compiler and its own launch
data reported `noFloatingPromises` catching roughly 75% of what `typescript-eslint` finds; the repo's
typed rules (`no-floating-promises`, `no-misused-promises`, `await-thenable`) are release gates, so
reduced recall is a regression. **Alternative rejected:** running Oxlint for speed alongside ESLint
for typed/custom rules — ESLint's typed path cannot run on TypeScript 7 at all, so the hybrid still
blocks the goal and doubles lint maintenance. **Alternative rejected:** waiting for
`typescript-eslint` — no published ETA.

### D3 — Pin a quarantine-clean version pair, then bump behind the quarantine

Initial landing uses **`oxlint@1.83.0` + `oxlint-tsgolint@7.0.2002`** — both published more than 7
days ago, so `pnpm install` succeeds under `minimumReleaseAge: 10080` with **no**
`minimumReleaseAgeExclude` entry and no weakening of the repo's supply-chain rule. A follow-up bump
to `oxlint@1.85.0` (allowed from 2026-09-28T15:32Z) and `oxlint-tsgolint@7.0.2003` (from
2026-10-01T15:18Z) happens naturally once they clear quarantine.

`oxlint-tsgolint`'s version encodes the TypeScript version it was built for (`7.0.20xx` = TS 7.0.2),
so it must be bumped together with `typescript`. **Alternative rejected:** adding
`minimumReleaseAgeExclude` for Oxlint — it would permanently exempt the newest, least-reviewed
packages in the supply chain, for a delay of days.

The `oxlint` ↔ `oxlint-tsgolint` pair compatibility is *not* assumed: the type-aware run must be
exercised on the chosen pair before the cutover, because tsgolint is loaded as a companion binary.

### D4 — The custom rule crosses over as a JS Plugin, gated by its own fixtures

`nextrush/no-runtime-identity-capability` encodes the framework's capability-not-identity rule, so it
cannot be dropped and has no native Oxlint equivalent. It is re-exported through an
ESLint-plugin-shaped module and referenced from the config's `jsPlugins`. Oxlint's JS Plugin host
runs on a JavaScript engine rather than the native binary — it is the migration's slowest path and
its type-aware/plugin options carry documented constraints — so the existing `RuleTester` fixtures
become the acceptance gate, run in CI. **Alternative rejected:** waiting for the plugin host to leave
alpha (defers the whole migration on an unrelated timeline). **Fallback:** if the plugin host
regresses, a standalone AST check stands in temporarily so the rule is never unenforced.

### D5 — Existing suppression syntax and the formatter stay as they are

`eslint-disable` comments keep working; translating 89 directives is pure churn and would touch 51
source files for no behavioural gain. Prettier keeps formatting. **Alternative rejected:** adopting
the formatter from the same toolchain in this change — it multiplies diff noise and review load while
the lint gate is being re-proven.

### D6 — The generated project's lint gate is emitted with its dependencies

The production preset stops emitting an ESLint configuration and emits an Oxlint configuration whose
imports are declared as devDependencies, alongside the matching editor recommendation.
**Alternatives rejected:** keeping the ESLint config and merely adding its missing dependencies —
the generated project now inherits a TypeScript 7 range, and `typescript-eslint` cannot run on
TypeScript 7, so the emitted gate would be broken by construction; emitting both linters — two gates
to maintain in a scaffold; emitting no lint configuration at all — silently removes a production
default, which the generated-project contract forbids.

### D7 — No new capability spec for the repo's own toolchain

The lint engine, its version pinning, and the `verify` wiring are engineering infrastructure with no
framework-observable behaviour; the durable decisions belong in `docs/RFC/` (RFC-037), not in a spec
that claims to describe what the framework does. A `repo-tooling` capability would set the precedent
of one spec per tool (CI, changelog, release) — the growth `openspec/README.md` exists to prevent.
The two deltas in this change are the genuinely observable contracts: what a generated project's
toolchain must be, and what the declaration pass must do.

### D8 — The declaration pass keeps resolving its own compiler, and is verified against TS 7

TypeScript 7.0.2 keeps the `bin.tsc` key and still exposes `./package.json` through `exports`, so
resolving `typescript/package.json` → `bin.tsc` remains the correct mechanism. Two layout facts do
change: the compiler arrives as a platform-native binary via `optionalDependencies`, and the package
is ESM-only with no `main` and no `tsserver` bin. The same spawn path is exercised against TypeScript
7 in the build end-to-end and declaration tests before the bump is considered done, and the failure
mode stays loud (a named missing package and the install command, never a green build with silently
absent declarations).

### D9 — The bundling/declaration step moves from `tsup` to `tsdown` (approved 2026-09-28)

`pnpm build` on TypeScript 7 dies inside `tsup@8.5.1`'s **vendored** `rollup-plugin-dts@6.1.1`, which
reads the legacy TypeScript JS API (`ts.sys.useCaseSensitiveFileNames`) that TS 7 no longer exports
(`typeof require('typescript').sys === 'undefined'`). Because the plugin is bundled into tsup's own
`dist/rollup.js`, a dependency override cannot reach it — verified by adding
`overrides: { rollup-plugin-dts: "^6.5.1" }`, reinstalling, and reproducing the identical crash; the
override was reverted rather than left as a no-op. tsup's newest release is 8.5.1, published
2025-11-12 — roughly eight months before TS 7 shipped — with no v9 and no prerelease to wait for.

Alternatives weighed before choosing:

| Alternative | Why not chosen |
| --- | --- |
| `dts: false` + `tsc --emitDeclarationOnly`, keeping tsup for JS | Works, but touches 38 configs and build scripts to change the declaration *shape* (bundled single file → per-file tree) and leaves the JS half on a bundler that cannot follow the ecosystem's TS 7 path |
| Patch tsup via `patchedDependencies` | We would own a patch against a release that is already ten months stale |
| Keep the build on TypeScript 6 | Contradicts this change's goal |

**Decision: move to `tsdown`.** Its declaration path is `rolldown-plugin-dts`
(`peerDependencies.typescript: "^5.0.0 || ^6.0.0 || ~7.0.0"`), built on oxc parsers (`yuku-ast`,
`yuku-parser`, `yuku-codegen`) and never touching the TypeScript JS API; `tsdown` itself treats
`typescript` as an *optional* peer. Both packages clear the release-age quarantine
(`tsdown@0.23.0` → 2026-09-03; `rolldown-plugin-dts@0.28.6` → 2026-09-16).

**The two-stage migration is mandatory**, per tsdown's own migration guide: v0.22.14 is the last release
that still accepts tsup-compatible options (with deprecation warnings); newer releases removed them and
**silently ignore** them at runtime. The migration therefore runs on `0.22.14`, every deprecation warning
is resolved, and only then does the catalog move to `^0.23.0`. Going straight to `^0.23.0` would turn
`external`/`splitting` into silently-dropped options — a build that reports success while producing
different output than intended, which is precisely the failure class this change exists to prevent.

**Behaviour differences to account for:** `splitting: false` is unsupported (code splitting is always
enabled), `external` moves to `deps.neverBundle`, tsup-style `plugins`/`swc`/`metafile` are unavailable,
and `onSuccess` has no direct equivalent (tsdown exposes `hooks`).

## Risks / Trade-offs

- **`oxlint-tsgolint` may not implement every typed rule the repo relies on** → the rule mapping is a
  written artifact produced before the cutover, with each unmapped rule explicitly waived and
  justified; nothing is dropped silently.
- **The pinned `oxlint`/`oxlint-tsgolint` pair may not be mutually compatible** → exercise the
  type-aware run on the pair before the cutover; if incompatible, choose the nearest pair that is
  both quarantine-clean and stable, and record the pairing rule in the catalog comment.
- **The JS Plugin host is alpha** → the custom rule's fixtures run in CI from the first day the rule
  is wired; the standalone-check fallback in D4 keeps the rule enforced if it regresses.
- **Rule-by-rule output differences** (a different engine's edge cases and message shapes) → the swap
  happens while the TypeScript 6 baseline is green, and resulting findings are triaged so each new
  error is either fixed or explicitly waived.
- **`tsc` on TypeScript 7 rejects config the repo carries** (for example a migration-only
  `ignoreDeprecations` value) → config validation is an explicit task in the compiler phase, with the
  option's removal part of that phase rather than an unplanned follow-up.
- **Contributor friction from losing ESLint editor integration** → the Oxlint editor extension and
  the unchanged `pnpm lint` / `pnpm verify` commands are documented in the same change.
- **The bundler's declaration step may be tied to the old compiler** → established before the bump:
  `tsup@8.5.1` vendors `rollup-plugin-dts@6.1.1`, which reads the legacy TypeScript JS API that TS 7
  does not export, and the plugin is bundled so an override cannot reach it. Resolved by D9 (move to
  `tsdown`), with the mitigation carried by tasks that compare build output before and after the
  bundler swap rather than trusting a green exit code.
- **A migration tool can silently drop options it no longer supports** → D9's two-stage rule: migrate
  on the last tsup-compatible release, drive deprecation warnings to zero, and only then upgrade; the
  bundler phase is not complete until output is compared against the tsup-built baseline.

## Migration Plan

Phased so each step is independently revertible (full checklists and rollback table live in
`docs/RFC/repo-tooling/037-typescript-7-oxlint-migration-plan.md`):

1. **Spike + parity map** — install the quarantine-clean Oxlint pair, translate the existing config,
   record the rule mapping, wire the custom rule as a JS Plugin, verify the type-aware run under the
   per-package turbo invocation. Exit: mapping covers 100% of current rules; custom-rule fixtures
   green.
2. **Lint cutover** (still TypeScript 6) — swap the 21 lint scripts, land the new root config, remove
   the ESLint lint-path dependencies, triage findings. Exit: `pnpm verify` green with no ESLint in the
   lint path.
3. **Compiler bump + bundler migration** — move the catalog to `typescript@^7.0.2`, align
   `oxlint-tsgolint` (already built on TS 7.0.2 — see D3), validate config, **migrate the 38 tsup
   configs to tsdown on v0.22.14 first, then upgrade to `^0.23.0`** (D9), fix surfaced type errors.
   Exit: `pnpm typecheck`, `pnpm build`, `pnpm test` green across the workspace with build output
   compared against the tsup-built baseline; conformance suite green.
4. **Downstream consumers + close-out** — generated-project templates, website lint, contributor
   docs, then promote the durable decisions (repo linter is Oxlint; the `typescript` ↔
   `oxlint-tsgolint` lockstep) to an ADR from `docs/adr/TEMPLATE.md`.

**Rollback:** revert the phase's commit set. Reverting the cutover restores the ESLint config and its
dependencies wholesale; reverting the compiler phase re-pins the catalog and restores the previous
config value. No published artifacts, migrations, or data state are involved — the change ships no
runtime code.

## Open Questions

- Which typed rules are absent from the tsgolint implementation, and are any of them in use here —
  answered by the parity map, before the cutover, not during it.
- Whether type-aware mode is best enabled per package on the command line or once in the root
  config, given documented constraints on where type-aware options are honoured — settled by the
  spike, with both options pre-identified so the outcome changes no requirement.
- Whether the website app's Next.js-specific rule set is fully expressible in Oxlint's Next plugin —
  if not, ESLint stays scoped to that one app and the exception is recorded in the parity map.

