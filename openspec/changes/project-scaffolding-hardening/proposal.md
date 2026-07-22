## Why

`create-nextrush` is every developer's first contact with the framework, yet the scaffolding review
(`report/scaffolding/scaffolding-cli-review.md`, commit `6ab26e9`) found its core promise broken by
design: the version resolver probes only two packages (`nextrush`, `@nextrush/cors`) and fans their
versions across ~10 independently-versioned packages. `.changeset/config.json` proves those packages
are not version-locked — `@nextrush/dev`, `@nextrush/rate-limit`, `@nextrush/request-id`,
`@nextrush/adapter-bun`, `@nextrush/adapter-deno` sit on the `1.x` line while the probes report
`^3.1.0` — so every generated project pins `@nextrush/dev: ^3.1.0`, which cannot resolve, and
`npm install` fails for **every** scaffold. The installer runs with `stdio: 'ignore'`, so the failure
is undiagnosable. The scaffolder is also the one durable NextRush product with no capability spec at
all, so "what does a generated project guarantee?" is unanswerable. This change establishes that
contract and fixes the defects the review exposed.

## What Changes

- **Install integrity (P0).** Replace the two-probe version proxy with per-package resolution: every
  dependency the chosen `{style, runtime, middleware}` emits is resolved from its own registry entry,
  with a build-time per-package fallback *map* (not two scalars) for offline/failure. No generated
  range may reference a version that does not resolve.
- **Verifier gate (P0).** Add a CI gate that scaffolds each `style × runtime × middleware` combination
  and runs a real (or `--dry-run`) install against publish versions — the missing verifier that let
  F-01 ship. This is the loop-engineering "the verifier is the bottleneck" fix, not a duplicate test.
- **Diagnosable failures (P1).** Surface install/git failure output (captured stderr + the exact manual
  retry command) instead of swallowing it under `stdio: 'ignore'`.
- **Runtime-honest generation (P1).** Every offered runtime must scaffold a project that builds and
  runs with working DI. For Deno + class-based/full, generated scripts must route through the toolchain
  (or emit a `deno.json` with decorator options) so decorator metadata is emitted; generated scripts
  must not pin `@latest` or grant blanket permissions (`-A`). *(The builder-side metadata guarantee
  itself is owned by the `dev-tooling` capability — see Capabilities; this change owns only the
  generated config/scripts that make it reachable.)*
- **Correct generated config (P2).** Generated `tsconfig` gains `isolatedModules`/`verbatimModuleSyntax`
  for the SWC per-file toolchain; generated `package.json` gains `engines` and `packageManager`;
  `typescript`/`@types/node` are version-resolved + engine-aligned + single-sourced with the scaffolder.
- **Registry-aware resolution (P2).** Honor `npm_config_registry`/`.npmrc` before defaulting to npmjs.
- **Honest generated docs & conventions (P2).** Generated README structure derives from the actual
  emitted file map (no phantom `not-found.ts`); generated projects follow framework conventions
  (scoped controller-discovery glob, a `test` script + example test, consistent app-construction idiom).
- **Coherent onboarding (P2/P3).** Node-version preflight, an initial git commit, prompt-skip on explicit
  flags, correct `NextRush` branding, a "then open <url>" next step, and a version probe gated on install.

No breaking change to `create-nextrush`'s own public API (its exported functions/types are unchanged).
The changes to *generated output* (scripts, config, deps) are corrections to a currently non-installable
result, not a break of a working contract.

## Capabilities

### New Capabilities
- `project-scaffolding`: The `create-nextrush` project-generation contract — interactive/flag-driven CLI,
  per-package version resolution with an offline fallback map, template generation for every
  `style × runtime × middleware` combination, and the guarantee that a generated project installs,
  builds, and runs with working DI on its selected runtime, carrying production-ready defaults and
  honest, self-consistent documentation. *Justification for a new capability (not requirements added to
  an existing one):* none of the fixed 16 own the scaffolder. `adapter-development-kit` owns only the
  `nextrush generate adapter` slice; `dev-tooling` (introduced by the sibling `dev-tooling-reliability`
  change) is explicitly scoped to `@nextrush/dev` — the dev server, build pipeline, and generators —
  not to `create-nextrush` or the generated-project contract. This mirrors the exact precedent that
  justified `dev-tooling`: a durable, long-lived product the registry did not yet cover.

### Modified Capabilities
- _None._ This change deliberately does **not** re-open `dev-tooling`. `dev-tooling` already owns the
  builder-side guarantee "*Production build is correct and metadata-emitting on every supported runtime*"
  (covering the Deno build fix and Bun decorator-metadata conformance from review findings F-02/F-04 at
  the tool level). `project-scaffolding` owns only the *generated* config and scripts that make that
  guarantee reachable, and cross-references `dev-tooling` rather than restating it — the conflict
  boundary is recorded in `design.md`.

## Impact

- **Package:** `create-nextrush` — `npm-version.ts`, `version-store.ts`, `constants.ts`, `generator.ts`,
  `templates/{shared,functional,class-based,full}.ts`, `prompts.ts`, `cli.ts`, `index.ts`, `tsup.config.ts`.
- **Generated artifacts:** `package.json` (deps, `engines`, `packageManager`, scripts), `tsconfig.json`,
  `deno.json` (new, for the Deno runtime), `README.md`.
- **CI:** a new generate-then-install matrix job (the verifier gate) in the workflows.
- **Tests:** per-package unit coverage for the resolver and generators toward the 90% bar, plus the
  cross-combination install smoke matrix.
- **Coordination:** read-only dependency on `dev-tooling`'s builder guarantees (no edits to that package).
- **RFC gate:** introducing `project-scaffolding` is RFC-gated. A `docs/RFC/` entry (RFC-021 — confirmed
  next-free against `docs/RFC/INDEX.md`; RFC-020 is taken by `framework-composition-integrity`)
  establishing the capability's scope and the durable per-package-resolution-with-fallback-map decision
  MUST land, recorded as an ADR (ADR-0011 — confirmed next-free; ADR-0010 is taken by
  `cross-runtime-parity-hardening`), before this change is archived. Source review:
  `report/scaffolding/scaffolding-cli-review.md`.
