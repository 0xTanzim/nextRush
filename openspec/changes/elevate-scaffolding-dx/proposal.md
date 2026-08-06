## Why

`npm create nextrush` now produces a proven Node service on its happy path, but its command contract is not yet safe enough for CI, monorepos, and production-service teams: invalid flags can silently select defaults, a non-empty target can cancel with exit code 0, and callers cannot obtain a machine-readable plan or result. The DX audit also identifies a gap between a runnable starter and an opt-in operationally complete service, plus incomplete published-artifact proof across the advertised runtime matrix.

This change turns the scaffolder into a trustworthy default path for newcomers and a deterministic integration point for experienced engineers. The goal is a measured **9.5+ DX score** without turning the interactive path into a configuration questionnaire.

## What Changes

- Make CLI parsing strict: unknown flags, missing values, and invalid enum values fail with actionable guidance and a non-zero exit code.
- Define a safe, non-interactive target-conflict policy: `--yes` never prompts or silently succeeds when a target is non-empty; overwrite requires an explicit, documented opt-in.
- Add a stable automation contract: `--dry-run`, `--json`, deterministic result/error payloads, and an explicit `--offline` mode that uses the embedded per-package version map after the generator is locally available.
- Reduce first-run cognitive load with a recommended Node API starter path, then reveal style/runtime/middleware/package-manager decisions only when the user chooses customization.
- Make runtime and package-manager decisions observable and actionable: report detected package manager, preflight a locally selected runtime when it will be invoked, and preserve an explicit bypass for remote/container targets.
- Add an opt-in production-service preset that supplies quality, CI, container, and operations foundations without bloating the base starter.
- Add governed task-oriented examples and a deliberately scoped workspace destination mode, only after their output contracts and ownership are defined.
- Prove the published artifact—not just source templates—through a release/nightly style × runtime install, build, start, and health-endpoint matrix.
- Improve completion guidance with a production validation path and generated documentation that distinguishes local development from production operation.

## Capabilities

### New Capabilities

_None. These are requirements of the existing project-generation capability, not a new durable framework capability._

### Modified Capabilities

- `project-scaffolding`: Extend the `create-nextrush` contract with strict human/automation interactions, safe conflict handling, offline behavior, progressive onboarding, optional production/workspace/example outputs, and published-artifact verification requirements.

## Impact

- **Affected packages:** `packages/create-nextrush`; generated app templates; published-artifact verification fixtures and CI.
- **Affected public surface:** CLI flags and exit semantics. Strict parsing and non-empty-target errors intentionally correct previously silent success behavior; migration examples and release notes are required.
- **Affected verification:** create-nextrush unit/integration tests, a published-artifact release matrix, and generated-template acceptance fixtures.
- **Affected documentation:** package README, generated README, CLI help, troubleshooting, and production/workspace/example guidance.
- **Durable decision:** The JSON result/error schema and `--overwrite` semantics must be recorded in an ADR before this change is archived; they are public automation contracts.
