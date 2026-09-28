# ADR-0027 — Repo linter is Oxlint, pinned in lockstep with the TypeScript major

- **Status:** `Accepted · Shipped`
- **Date:** `2026-09`
- **Deciders:** NextRush maintainers
- **Governing RFC:** `docs/RFC/repo-tooling/037-typescript-7-oxlint-migration.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0008`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[████████████████████]` **Accepted · Shipped** — 3 / 3

---

## Context

`typescript-eslint@8.70.1` declares `peerDependencies.typescript: ">=4.8.4 <6.1.0"`, so the repo
**cannot** move to TypeScript 7 while its lint gate is ESLint: resolution fails, and forcing it
crashes the parser (`@typescript-eslint/typescript-estree`). ESLint core's own TS 7 upgrade
(eslint/eslint#21070) is openly blocked on typescript-eslint with no published ETA. The framework
was therefore held on the last TypeScript 6 line only because of its linter — a cost paid on every
`pnpm verify`, since TS 7's native compiler is several times faster.

Type-aware linting cannot simply be dropped: `no-floating-promises`, `no-misused-promises`, and
`await-thenable` are release gates, and the repo rule `nextrush/no-runtime-identity-capability`
enforces the capability-not-identity guarantee (ADR-0008).

---

## Decision

We will lint the repository with **Oxlint**, delegating type-aware rules to **`oxlint-tsgolint`**,
and we will keep **`typescript` and `oxlint-tsgolint` on a version lockstep** — they are bumped
together.

1. Oxlint + tsgolint is the only option with real-compiler type-aware rules *built on TypeScript 7*
   (tsgolint builds TS programs via `typescript-go`), and it runs far faster than
   ESLint + typescript-eslint at the same rule coverage. Biome's compiler-free inference had
   measured parity gaps (~75% `noFloatingPromises` recall) — a regression for release-gate rules.
2. `oxlint-tsgolint`'s version encodes the TypeScript version it was built for (`7.0.2003` = TS
   `7.0.2`, patch `003`), so the pair must move together or the type-aware companion is built
   against a compiler the workspace no longer runs.

The repo-local rule crosses over as an **Oxlint JS Plugin** with unchanged semantics (including
`capability-exempt`), gated by its existing `RuleTester` fixtures. `eslint` is retained **only** as
a fixture-only devDependency for that harness; the website app keeps a scoped ESLint config for its
Next-specific `eslint-config-next` rule set. Prettier stays the formatter.

---

## Options considered

- **Oxlint + tsgolint** — ✅ chosen: real-compiler type-aware rules on TS 7, fastest, config migration tooling.
- **Biome** — ❌ rejected: compiler-free type inference with documented parity gaps on release-gate rules; also strands the formatter question.
- **Wait for typescript-eslint** — ❌ rejected: blocked upstream with no ETA; staying on TS 6 is the dead end.
- **Do nothing** — ❌ rejected: keeps the workspace on a superseded compiler and pays the lint/typecheck tax on every verify.

---

## Consequences

- **Positive:** the workspace runs TypeScript 7 end to end; typecheck wall-time drops ~5.3× and lint ~2.7–3.3×; type-aware and custom-rule enforcement are preserved.
- **Negative / cost:** a dependency on Oxlint's **alpha** JS-plugin host for the custom rule (a standalone-check fallback is documented if it regresses); contributors lose ESLint editor integration and must install the Oxlint extension; the `typescript` ↔ `oxlint-tsgolint` lockstep is a manual coupling to remember.
- **Neutral:** turbo task names, the `pnpm verify` contract, and all `// eslint-disable` directives are unchanged.
- **Follow-up:** a future RFC may adopt Oxfmt and revisit a native port of the custom rule; the `scripts/` lint-scope gap is tracked separately (RFC-037 §17).

---

## Compliance / enforcement

Kept true by: the root `oxlint.config.ts` plus per-package `lint` scripts in `pnpm verify`; the
custom rule's fixtures and the build-plugin tests wired in as `validate:lint-rules` /
`validate:build-plugins`; the scaffolder's emitted-gate tests (`production-preset`,
`bin-entry` no-`catalog:` guard, published matrix); and a catalog comment in
`pnpm-workspace.yaml` plus the release-age quarantine that pins the pair.

---

## Checklist

- [x] One decision only.
- [x] Context states the forces/trigger without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, ≥1 alternative, and "do nothing".
- [x] Consequences include at least one real negative/cost.
- [x] Compliance/enforcement names a concrete mechanism.
- [x] Lifecycle progress bar reflects the current Status field.
- [x] Governing RFC linked.
- [x] All guidance blocks deleted; document is terse.
- [x] Registered in docs/adr/INDEX.md.
