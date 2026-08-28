## 1. Establish the strict CLI and automation contracts

- [x] 1.1 Write failing CLI-process tests for unknown options, missing option values, invalid enum values, and valid complete `--yes` input; assert exit codes, no-write behavior, and actionable text.
- [x] 1.2 Refactor argument parsing into a typed parsed-invocation/result boundary that preserves invalid input rather than silently discarding it; make valid flag semantics backward-compatible.
- [x] 1.3 Write failing tests for `--json` success and error payloads, including one-document stdout, schema version, stable codes, remediation, and no Clack decoration.
- [x] 1.4 Implement the schema-versioned scaffold result/error model and human/JSON renderers from one semantic payload; update `--help` with automation flags.
- [x] 1.5 Write failing tests proving `--dry-run` validates input and reports a complete plan without filesystem, Git, install, or registry side effects beyond its selected resolution mode.
- [x] 1.6 Implement a pure scaffold-plan resolver and `--dry-run` executor path; make normal execution consume the same validated plan.

## 2. Make destructive and connectivity behavior explicit

- [x] 2.1 Write failing interactive and non-interactive target-conflict tests: default-No interactive confirmation, `--yes`/non-TTY non-zero conflict, zero writes, JSON error, and explicit overwrite behavior.
- [x] 2.2 Implement typed target-conflict handling and an explicit destructive `--overwrite` policy; ensure all target writes remain inside the resolved target and report written/replaced files.
- [x] 2.3 Write failing resolver tests for `--offline`: zero registry requests, per-package fallback ranges, result annotation, and documentation-facing acquisition distinction.
- [x] 2.4 Implement explicit offline resolution through the plan/result model without changing ordinary online fallback behavior.
- [x] 2.5 Write failing tests for visible package-manager provenance and missing selected Bun/Deno runtime guidance, including documented remote/container opt-out.
- [x] 2.6 Implement package-manager provenance output and scoped runtime availability preflight without requiring a target runtime merely to generate a remote project.

## 3. Reduce first-run cognitive load and improve handoff

- [x] 3.1 Write prompt-flow tests for the recommended Node API starter, Customize path, explicit-flag precedence, and accessible option descriptions.
- [x] 3.2 Implement progressive onboarding: recommended starter first, then a complete Customize group for style, runtime, middleware, and package manager.
- [x] 3.3 Write failing generated-README and completion-output tests for selected-option summary, health URL, build/start production validation, and production documentation link.
- [x] 3.4 Implement the completion and README handoff changes while preserving correct per-style URLs and no-install/Git-skipped guidance.

## 4. Add opt-in production, workspace, and example layers

- [x] 4.1 Define production-service preset support cells and write failing file-map/manifest tests for editor settings, formatter/linter, CI, container files, ignores, operations guidance, and unsupported-combination refusal.
- [x] 4.2 Implement the production-service template layer as an additive file-map contribution; verify the base starter output remains unchanged when it is not selected.
- [x] 4.3 Write failing workspace-mode tests for supported workspace detection, explicit destination/package-name plan output, unsupported layout errors, and no-write failures.
- [x] 4.4 Implement the smallest documented workspace destination policy and manifest integration; defer unsupported workspace managers rather than guessing.
- [x] 4.5 Define the first maintained task-oriented example contract and write its generated-output, README, and supported-cell acceptance tests.
- [x] 4.6 Implement the governed `--example` layer and ensure it composes through the same dependency, template, and completion paths as the base starter.

## 5. Prove the published artifact across supported runtimes

- [x] 5.1 Write the published-artifact matrix harness that packs or installs `create-nextrush`, records generated-project logs/artifacts, and runs install → generated tests → build → start → documented health check.
- [x] 5.2 Add real runtime matrix cells for every advertised `style × runtime × middleware` combination; use published framework packages and real Node/Bun/Deno binaries rather than stubs for release claims.
- [x] 5.3 Configure a fast hermetic pull-request subset plus scheduled and release-blocking full matrix; classify transient registry failures without masking product failures.
- [x] 5.4 Run the full matrix against the change and fix every failing generated-project contract before release approval.

## 6. Document the public contract and migration

- [x] 6.1 Create an ADR from `docs/adr/TEMPLATE.md` defining the JSON result/error schema and destructive overwrite policy; link it to this change and the scaffolding RFC.
- [x] 6.2 Update `packages/create-nextrush/README.md`, generated README templates, CLI help, and troubleshooting with strict flags, JSON/dry-run/offline behavior, target conflicts, runtime checks, production preset, workspace mode, and examples.
- [x] 6.3 Add migration/release notes explaining the intentional change from silent flag/conflict success to non-zero actionable failures, with before/after commands.
- [x] 6.4 Update the DX audit with fresh public-artifact evidence and score every original audit dimension; claim 9.5+ only when all P1/P2 scenarios and release matrix pass.

## 7. Validate and ship safely

- [x] 7.1 Add and run focused unit, CLI-process, generated-file, and public-artifact tests test-first; maintain at least 90% coverage for changed create-nextrush code.
- [x] 7.2 Run `pnpm --filter create-nextrush lint`, `typecheck`, `test`, and package build; fix strict TypeScript and lint failures.
- [x] 7.3 Run the relevant NextRush verification and adapter conformance checks for any runtime-template or dev-tooling changes; record command results in the change evidence.
- [x] 7.4 Run `openspec validate elevate-scaffolding-dx --strict`, review the diff for generated-output/documentation consistency, and obtain RFC/ADR approval before archive.
