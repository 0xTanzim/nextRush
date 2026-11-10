---
name: faultline-break-sweep
description: >-
  Adversarially inspect and try to falsify an existing implementation. Trace real
  entry points and execution paths, inspect tests and invariants, probe boundary,
  retry, concurrency, partial-failure and recovery behavior, and run safe existing
  checks when authorized. Use for brownfield audits, pre-implementation impact
  analysis, and requests to break or harden existing code.
license: MIT
compatibility: Requires an Agent Skills-compatible coding agent with repository
  search/read tools. Test execution depends on host permissions and project tooling.
metadata:
  project: faultline
  version: "0.3.0"
---

# Faultline Break Sweep

## Mission

Try to falsify the **actual implementation**, not a fictional design. Find
reproducible defects and test gaps while preserving the repository exactly as it
was found.

This is not a normal code review that gives broad style advice. Concentrate on
correctness, security, data integrity, reliability, compatibility and failure
behavior.

## Preconditions

- Identify the target subsystem/change and its expected behavior.
- If no target is supplied, map the repository and select the highest-risk
  reachable subsystems; explain the selection method.
- Read AGENTS.md, project instructions, architecture docs, OpenSpec specs and
  existing tests before interpreting behavior.
- Record repository revision and pre-existing working-tree changes when possible.
- Never overwrite, discard, stage, commit, reset, stash or clean user work.

## Hard safety boundary

Default to read-only. Do not edit application code, configuration, tests,
migrations, lockfiles or deployment files. Do not hit production or mutate shared
services. Do not run destructive, load, chaos, fuzz or migration commands without
explicit approval and an isolated target. Never expose secrets; redact values.
Inspect test scripts before running them. If a command's effects are uncertain,
ask before running it.

## Investigation protocol

### 1. Map the subsystem

Find:
- Entrypoints and public interfaces.
- Callers and downstream side effects.
- Data models, constraints, transactions and storage.
- State machines and invariants.
- Authorization and tenant boundaries.
- External dependencies, queues, caches and background workers.
- Configuration and runtime assumptions.
- Existing tests and missing test regions.

Cite exact files, symbols and line ranges where available.

### 2. Trace actual execution paths

For each important operation trace:
`entrypoint → validation → authorization → core logic → persistence/side effect → response/event`.

Walk every relevant branch, catch block, return path and error mapping. Determine
what work has already committed when an exception, timeout, cancellation or crash
occurs. Inspect callers to see how errors are handled.

### 3. Create adversarial input classes

Consider missing/null/empty, wrong type, malformed, duplicate, boundary,
just-under/just-over, maximum-size, Unicode/encoding, deeply nested, overflow,
stale, expired, unauthorized and semantically unexpected inputs as relevant.
Do not test irrelevant classes just to fill a checklist.

### 4. Break state and time assumptions

Construct explicit sequences for:
- One request, repeated request, retry after timeout, replay after success.
- Concurrent update A/B and stale read/update.
- Events delivered twice, late or out of order.
- Crash/restart between every durable write and external side effect.
- Partial batch completion then retry.
- User abandonment, navigation back, stale form/session, permission change.
- Old/new application versions running during migration/deployment.
- Recovery operation repeated or failing halfway.

Use timelines/interleavings, not vague labels like "race condition".

### 5. Break system boundaries

Inspect process/runtime, network, dependency, database, cache, filesystem,
queue, configuration, deployment, observability, rollback and backup/restore
boundaries. Ask what saturates first, what fails together, and what becomes
irreversible. Trace common-cause failures and cascades.

### 6. Use subagents when useful

Read `../faultline-preflight/references/subagent-protocol.md` from the Faultline
skill root if available. Delegate independent read-only questions to the
system-mapper, runtime-breaker, state-concurrency-breaker, security-abuser,
scale-operations-breaker and skeptical-synthesizer. Use 3–5 roles for a complex
system; do not launch every role for a trivial change. If unavailable, run
separate sequential passes and disclose that they share one agent/context.

### 7. Execute safe checks

First inspect `package.json`, `pyproject.toml`, Cargo manifests, Makefiles,
Taskfiles, CI workflows, test config and scripts appropriate to the stack.
Classify candidate commands:
- SAFE_LOCAL: deterministic local read/test/build with disposable outputs.
- MAY_MUTATE: writes fixtures, database, files, snapshots, codegen or services.
- EXTERNAL: uses network, credentials, cloud resources, paid APIs or live systems.
- DESTRUCTIVE: deletes, migrates, resets, load-tests or modifies shared state.

Run SAFE_LOCAL checks only when permitted. Ask before MAY_MUTATE or EXTERNAL.
Do not run DESTRUCTIVE commands in this skill. Record exact commands, exit codes,
relevant output and environment assumptions. Do not claim execution if not run.

### 8. Validate findings

A finding is strong only when it has:
- A real reachable path or explicit requirement.
- Specific preconditions and trigger.
- Ordered steps showing how behavior fails.
- Expected invariant vs observed result.
- Consequence and realistic impact.
- Evidence and confidence.
- Reproduction steps or a precise test plan.

Label:
- `CONFIRMED`: reproduced or directly demonstrated by executed tests/code.
- `LIKELY`: strongly implied by code/control flow but not executed.
- `POSSIBLE`: credible but dependent on unverified assumptions.
- `NOT_REPRODUCED`: attempted with stated method but not reproduced.

Do not call a missing test a production bug. Do not report style preferences as defects.
Do not force a minimum finding count. `No defect found in inspected scope` is valid.

## Output

Write a report at `docs/engineering/faultline/<scope-slug>.md` unless the user
specifies another path. Never overwrite an existing report.

Include:
1. Scope, revision and pre-existing working-tree state.
2. Subsystem map and inspected entry points.
3. Execution paths and side-effect boundaries.
4. Coverage matrix and uninspected areas.
5. Findings sorted by impact and confidence.
6. Safe commands/tests actually executed and outcomes.
7. Reproductions and proposed tests not yet executed.
8. State/concurrency timelines and failure chains.
9. Subagent provenance and disagreements.
10. Residual risk and next verification steps.

## Final integrity check

State exactly what you inspected, what commands you ran, what failed, what was
not run, and which findings are confirmed vs inferred. The purpose is to expose
how the code can break, not to claim that it cannot break.
