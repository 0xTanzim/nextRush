## Context

See [proposal.md](proposal.md) for motivation and
[the project-scaffolding delta](specs/project-scaffolding/spec.md) for behavior. The current
scaffolder already has a pure `generateProject()` boundary and a small prompt layer, but argument
parsing, target handling, terminal presentation, and mutations are interleaved in the CLI path. That
made a human-friendly default path possible, but it does not provide a stable automation contract.

This change remains inside the existing `project-scaffolding` capability. It extends the current
per-package version-resolution and generated-project architecture recorded in RFC-021 and
ADR-0023; it does not change framework request-path behavior or add a new runtime abstraction.

## Goals / Non-Goals

**Goals:**

- Make every invocation resolve to either a validated scaffold plan or a structured error before any
  filesystem, Git, or install side effect.
- Keep the beginner golden path shorter than today's six-question flow while preserving full expert
  choice and non-interactive reproducibility.
- Make human and JSON output two renderings of one semantic result, so they cannot disagree.
- Treat the published package and real runtime as the release truth for claims of supported generated
  output.
- Make production and workspace/example expansion opt-in, composable template layers.

**Non-Goals:**

- Do not make the base starter a full platform template or require Docker, a cloud account, CI, or a
  particular package manager.
- Do not introduce telemetry, persist per-user preferences, or silently overwrite source files.
- Do not claim a first-ever `npm create` can run offline; registry acquisition is outside the CLI.
- Do not add runtime identity branches to framework core. Runtime-specific emitted template code remains
  a scaffold-time selection under the existing adapter contract.

## Decisions

### 1. Resolve a typed invocation before executing it

Introduce a typed pipeline:

```text
argv + terminal capability
  → parsed invocation | validation error
  → resolved scaffold plan | planning error
  → human or JSON rendering
  → execution result | execution error
```

The parsed invocation distinguishes absent, valid, and invalid option values. It never silently drops
an input. The resolved plan contains target, selected template dimensions, package-manager source,
version-resolution mode, planned files, verification URL, and requested post-actions. Executors consume
the plan; they do not re-infer choice.

**Why:** `generateProject()` is already pure. Moving target checks and derived decisions into an
equally pure planning phase lets `--dry-run`, `--json`, and normal execution share exactly one source
of truth.

**Alternative rejected:** Retain permissive parsing and add warnings. A warning still permits CI to
continue with an unintended service, so it cannot satisfy the strict contract.

### 2. Use an explicit side-effect policy for targets

Default behavior is non-destructive. Interactive conflicts retain a default-No confirmation. In
`--yes` or non-TTY mode, a non-empty target becomes a typed conflict error. `--overwrite` is a separate
explicit capability and is never implied by `--yes`; it must enumerate/reconcile the planned writes and
be covered by destructive-path tests.

**Why:** A generator's success exit code is a contract. “No changes made” cannot be encoded as success
in automation.

**Alternative rejected:** Treat `--yes` as permission to overwrite. It is concise but violates the
framework's safety and developer-trust requirements.

### 3. Define one versioned result schema with two renderers

Define internal `ScaffoldSuccess` and `ScaffoldFailure` objects with a schema version. The human
renderer uses Clack only when JSON mode is off; JSON mode writes the object once to stdout and sends no
spinners, banners, or decorative text there. Structured errors include `code`, `message`, `remediation`,
and safe context such as option name or target path.

**Why:** Platform tooling needs stable integration while developers need readable terminal guidance.
One semantic payload prevents parallel, drifting implementations.

**Alternative rejected:** Scrape or add a second “machine message” after normal output. That is
ambiguous, fragile, and defeats JSON parsers.

### 4. Separate acquisition from dependency-resolution connectivity

`--offline` is evaluated in the plan phase. It skips registry requests and selects the embedded
per-package fallback map. The CLI reports fallback use in human and JSON output. Documentation explains
that package acquisition by `npm create` occurs first and remains npm's responsibility.

**Why:** The current fallback is useful only after the executable exists locally. Naming that boundary
prevents a false offline promise.

**Alternative rejected:** Make the default automatically switch offline after a transient request
failure. That hides freshness and can create surprising dependency output.

### 5. Layer onboarding instead of adding prompts

The first prompt offers the recommended Node API starter. “Customize” opens a group containing style,
runtime, middleware, and package-manager choice. An explicit CLI flag always wins, and the resolved
plan reports whether each value was explicit, recommended, detected, or policy-derived.

**Why:** Defaults are already defensible. Progressive disclosure removes choices from the most common
path without removing expert control.

**Alternative rejected:** Remove styles or runtimes. That would reduce capability rather than reduce
cognitive load.

### 6. Make optional output additive and capability-gated

Template construction becomes a base file map plus named additive layers:

```text
base style/runtime/middleware files
  + production-service layer (quality, CI, container, operations docs)
  + workspace destination policy (placement and manifest integration)
  + maintained example layer (task-oriented files and documentation)
```

Each layer declares supported runtime/style combinations and contributes files through the same file-map
and README-generation path. Unsupported combinations fail during planning, before any write. The base
starter remains unchanged when no layer is selected.

**Why:** This prevents a combinatorial fork of templates and keeps production material maintained by
the same generated-output tests.

**Alternative rejected:** A separate production generator/repository. It would duplicate dependency,
runtime, and documentation contracts and drift from the base template.

### 7. Verify release claims from the published artifact

Keep hermetic unit/template tests as the fast pull-request feedback layer. Add a scheduled and
release-blocking matrix that invokes the packed/published `create-nextrush` package, installs each
advertised cell, executes generated tests and production build, starts it with the selected real runtime,
and probes the documented health endpoint. Matrix results retain the generated directory and command
logs on failure.

**Why:** Static and stubbed tests catch generator regressions cheaply but cannot prove registry output,
published package contents, or real runtime integration.

**Alternative rejected:** Run every full matrix on every pull request. It is unnecessarily slow and
registry-sensitive; a small Node critical path can remain per-PR while complete evidence gates releases.

### 8. Make the score target measurable, not promotional

The release checklist records the same audit dimensions: installation, CLI interaction, templates,
generated first success, configuration, output, errors, first-time onboarding, expert automation, and
competitive differentiation. A 9.5+ claim requires all P1/P2 acceptance scenarios to pass, zero silent
input/conflict outcomes, a successful published-artifact matrix, and a repeat audit with evidence.

**Why:** A score is useful only if it can fall when real behavior regresses.

## Risks / Trade-offs

- **Strict parsing breaks scripts that relied on ignored options** → document as a deliberate
  correctness fix, provide corrected-command errors, and include migration notes.
- **`--json` becomes a public compatibility promise** → version the schema, keep it small, and test
  fixtures as public API.
- **`--overwrite` can cause destructive loss** → keep it explicit, never defaulted, show planned
  replacements, and test no-write failure paths.
- **Production/example/workspace layers expand maintenance cost** → make each opt-in, owned, and
  covered by the same matrix; do not add layers without an acceptance fixture.
- **Published runtime matrix is slow or flaky** → separate hermetic PR tests from scheduled/release
  proof; retain artifacts and classify transient registry failures rather than masking them.
- **Runtime checks reject remote generation use cases** → scope them to local invocation/install and
  provide an explicit documented bypass.

## Migration Plan

1. Publish the strict-input and target-conflict semantics as a CLI migration note before release.
2. Land the pure invocation/plan/result model behind unit and CLI-process tests; retain existing human
   output until both renderers consume the new result object.
3. Release `--dry-run`, `--json`, and `--offline` together with schema fixtures and documentation.
4. Introduce recommended onboarding and visible package-manager selection without changing valid flag
   meanings.
5. Add the public-artifact matrix before advertising the expanded production/runtime guarantee.
6. Add production, workspace, and example layers incrementally, each with supported-cell declarations.
7. Create an ADR for the JSON schema and overwrite policy before archiving this change.

Rollback is additive for new flags and layers. If strict parsing reveals unexpected ecosystem use, the
release can temporarily document a compatibility flag, but the default must remain fail-fast; reverting
to silent success is not an acceptable rollback.
