# ADR-0023 — Scaffolder developer-experience architecture: env config, dependency manifest, Deno parity

- **Status:** `Accepted`
- **Date:** `2026-08-05`
- **Deciders:** @0xTanzim / NextRush core team
- **Governing RFC:** `docs/RFC/scaffolding/021-project-scaffolding-capability.md` (scaffolder capability; the env-config / manifest / Deno-parity decisions recorded here supersede the removed RFC-034/035/036 drafts — see git history)
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0011` (per-package version resolution), `ADR-0008` (dev-tooling capability), `RFC-021`

---

## Lifecycle progress

`Proposed ▶ Accepted`  ·  `[████░░░░░░░░░░░░░░░░]` **Accepted** — 1 / 3 (env config + manifest shipped; Deno `--env-file` pending)

---

## Context

Three scaffolder decisions landed as separate RFCs (034 env config, 035 dependency manifest, 036
Deno `--env-file`), but they are one coherent body of developer-experience architecture for
`create-nextrush`:

1. **Environment configuration** — generated projects were inconsistent (only `functional` had a
   config module; no runtime loaded `.env` in any path; `HOST` ignored; `PORT`/`NODE_ENV` parsing
   fragile).
2. **Dependency model** — adding a dependency required five edits (`getDependencies`,
   `getAllPossiblePackageNames`, fallback map, `tsup.config.ts`, templates); third-party packages
   used a special-cased fallback; the runtime floor was a hardcoded literal.
3. **Deno parity** — Deno generated a different layout (`.env.example` only) and ignored `.env` in
   dev and production.

## Decision

We consolidate the three into one architecture: **the project layout is runtime-agnostic; the
loading mechanism and dependency model are the only seams.**

- **Env config:** every style emits `src/config/index.ts`; every runtime generates `.env` +
  `.env.example`; Node/Bun load via `import 'dotenv/config'` (first line), Deno via `--env-file=.env`;
  the entrypoint forwards `config.host` to `serve`; `PORT`/`NODE_ENV` parsing is edge-case-safe.
- **Dependency model:** a TypeScript `defineDependencies()` manifest is the single source of truth;
  `getAllPossiblePackageNames` + `getDependencies` derive from it; third-party and workspace
  packages resolve identically (no special-case fallback); a single `runtimePolicy` value drives
  `engines.node` + the `@types/node` cap. The resolver (live → per-package fallback → error) is
  **not** rewritten.
- **Deno parity:** `@nextrush/dev` passes `--env-file=.env` when spawning Deno dev/build (gated on
  file existence); no `dotenv` for Deno.

## Options considered

- **Env loading in `@nextrush/dev`** — ❌ rejected: fails generated-project independence (`node
  dist/index.js` runs without the toolchain).
- **Rely on Bun's native `.env` auto-load** — ❌ rejected: `Bun.spawn` bypasses it in dev.
- **JSON dependency manifest** — ❌ rejected: loses TypeScript type safety / autocomplete /
  dynamic computation; the scaffolder is TS.
- **Keep `.env.example`-only for Deno** — ❌ rejected: inconsistent layout; `.env` silently ignored.
- **Rewrite the version resolver** — ❌ rejected: the audit confirms live→fallback→error is correct.
- **Do nothing** — ❌ rejected: five-edit dependency smell multiplies; Deno keeps ignoring `.env`.

## Consequences

- **Positive:** one project layout and one config idiom across every style/runtime; zero manual env
  setup; adding a dependency is a one-line manifest entry; a runtime-floor bump is a one-line policy
  change; `.env` works in dev + prod on every runtime.
- **Negative / cost:** a `dotenv` dependency in every generated Node/Bun project; a new
  `dependency-manifest.ts` module; a `@nextrush/dev` Deno spawn change; Deno `--env-file` errors on a
  missing `.env` (mitigated by gating on existence).
- **Neutral:** `create-nextrush`'s public API and generated output are unchanged (byte-for-byte
  guard); the resolver is untouched.
- **Follow-up:** `runtime-policy-management` (full per-runtime policies), `configuration-validation`
  (typed env parsing), and Deno `--env-file-if-exists` are tracked as future work in RFC-034 §17.

## Compliance / enforcement

Enforced by the OpenSpec changes `standardize-scaffolded-environment-configuration`,
`dependency-manifest-system`, and `deno-env-file-loading`: unit tests (config edge cases, env-file
generation, manifest derivation, `buildDevArgs` `--env-file`, precedence, byte-for-byte output
guard), the generate-then-install CI matrix, and the 90%+ coverage bar. The capability spec
(`openspec/specs/project-scaffolding/`, `openspec/specs/dev-tooling/`) is the living contract.

---

## Checklist

- [x] One decision only (the three scaffolder-DX sub-decisions are one coherent architecture; each is independently revertible).
- [x] Context states the forces/trigger (inconsistent layouts, five-edit smell, Deno gap) without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, alternatives, and "do nothing".
- [x] Consequences include real negatives/costs (dotenv dep, manifest module, spawn change).
- [x] Compliance/enforcement names concrete mechanisms (unit tests, matrix, coverage bar).
- [x] Lifecycle progress bar reflects the current Status field.
- [x] Governing RFC linked.
- [x] All guidance blocks deleted; document is terse.
- [x] Registered in docs/adr/INDEX.md.
