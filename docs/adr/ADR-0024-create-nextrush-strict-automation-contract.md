# ADR-0024 — create-nextrush strict automation contract: JSON result schema and explicit overwrite policy

- **Status:** `Accepted`
- **Date:** `2026-08-06`
- **Deciders:** @0xTanzim / NextRush core team
- **Governing RFC:** `docs/RFC/scaffolding/021-project-scaffolding-capability.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0011` (per-package version resolution), `ADR-0023` (scaffolder DX architecture), RFC-021

---

## Lifecycle progress

`Proposed ▶ Accepted`  ·  `[████░░░░░░░░░░░░░░░░]` **Accepted** — 1 / 3 (implemented & tested; shipped with the next release)

---

## Context

The DX audit (`report/scaffolding/scaffolding-cli-review.md`) found the scaffolder's exit
contract unsafe for automation: an invalid `--runtime nodee` and an unknown `--typo` both
generated a project with exit code 0, and `--yes` into a non-empty target could cancel with
success. A generator's exit code is a contract for CI: "no changes made" cannot be encoded as
success. Platform tooling also had no stable way to consume a result — no `--dry-run`, no
schema-versioned JSON, and no stable error codes + remediation.

This change makes the scaffolder trustworthy for automation while keeping the interactive path
unchanged. Because `--json` and `--overwrite` become public compatibility promises, the schema
and the destructive policy must be recorded before this change is archived.

## Decision

We formalize the scaffolder's automation surface as a versioned, stable contract:

1. **One semantic result model, two renderers.** Every invocation resolves to either a
   `ScaffoldErrorResult` or `ScaffoldSuccessResult`, both carrying `schemaVersion: 1`. Human
   and `--json` output are two renderings of the same object, so they cannot disagree. Success
   includes `dryRun`, `offline`, the resolved `project` (name, directory, targetDirectory,
   style, runtime, middleware, packageManager, install, git, verificationUrl), and a
   `files` list annotating each planned write as `create` or `replace`.
2. **Structured errors.** Every failure has a stable `code`, a human `message`, and `remediation`.
   `TARGET_DIRECTORY_NOT_EMPTY` is the stable, machine-detectable target-conflict code; input
   errors use `UNKNOWN_OPTION`, `MISSING_OPTION_VALUE`, `INVALID_<FIELD>`,
   `UNEXPECTED_POSITIONAL`. In `--json` mode the single document goes to stdout; no Clack
   decoration, spinners, or banners appear there.
3. **Overwrite is explicit, destructive, and never implied by `--yes`.** Default behavior is
   non-destructive. Interactive conflicts keep a default-No confirmation. In `--yes`/non-TTY/JSON
   mode a non-empty target without `--overwrite` is a typed `TARGET_DIRECTORY_NOT_EMPTY` error
   with exit non-zero. `--overwrite` is a separate, documented opt-in that warns before writing
   and reports written/replaced files in the result.

**Why:** a correct exit code and a parseable, versioned result are the minimum a CI pipeline can
rely on; silent success violates developer trust and the framework's error contract.

## Options considered

- **`Typed invocation → plan → result` pipeline** — ✅ chosen: strict parsing preserves invalid
  input, dry-run/JSON/execution share one validated plan, human and JSON cannot drift.
- **Keep permissive parsing + warnings** — ❌ rejected: a warning still lets CI continue with an
  unintended service; it cannot satisfy a strict contract.
- **Treat `--yes` as permission to overwrite** — ❌ rejected: concise but violates safety and
  developer trust; overwrite must stay explicit and undefaulted.
- **Scrape a "machine message" off normal output** — ❌ rejected: ambiguous and fragile; JSON
  parsers need one clean document on stdout.
- **Do nothing** — ❌ rejected: F-01/F-02/F-03 stay open and CI retains silent-success behavior.

## Consequences

- **Positive:** strict rejection of invalid/unknown/missing input; safe, machine-detectable
  target conflicts; a stable `--dry-run`/`--json` automation contract; explicit `--overwrite`
  with observable written/replaced files.
- **Negative / cost:** backward-incompatible for scripts that relied on silent mistakes or
  cancelled-success — an intentional contract correction that requires migration notes and a
  release-note changelog entry.
- **Neutral:** `create-nextrush`'s importable API surface is unchanged (CLI-only package); the
  interactive default path keeps its existing confirmations.
- **Follow-up:** bump `RESULT_SCHEMA_VERSION` for any incompatible JSON contract change; keep the
  schema fixtures as public-API tests.

## Compliance / enforcement

Enforced by the OpenSpec change `elevate-scaffolding-dx`: CLI-process tests assert non-zero exit
codes and stable error codes for unknown/missing/invalid input and non-empty targets; the
`result-model` and `target-conflict` suites pin the JSON schema, `create`/`replace` annotations,
remediation, and no-Clack-in-JSON invariant; the 90%+ coverage bar on changed scaffold code. The
capability spec (`openspec/specs/project-scaffolding/`) is the living contract.

---

## Checklist

- [x] One decision only (the JSON schema and overwrite policy are one coherent automation-surface decision; each sub-rule is independently revertible).
- [x] Context states the forces/trigger (F-01/F-02/F-03 audit findings) without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, alternatives, and "do nothing".
- [x] Consequences include real negatives/costs (breaking change for silent-success scripts).
- [x] Compliance/enforcement names concrete mechanisms (CLI-process tests, schema fixtures, coverage bar).
- [x] Lifecycle progress bar reflects the current Status field.
- [x] Governing RFC linked.
- [x] All guidance blocks deleted; document is terse.
- [x] Registered in docs/adr/INDEX.md.
