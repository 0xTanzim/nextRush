## ADDED Requirements

### Requirement: The scaffolder has a strict command-line input contract
`create-nextrush` SHALL reject an unknown option, an option missing its required value, or an invalid
value for an enumerated option. It MUST exit non-zero before creating or modifying the target and MUST
name the invalid input, list valid values where applicable, and show a corrected invocation. A valid
non-interactive invocation MUST remain supported without prompts.

#### Scenario: Invalid runtime is rejected
- **WHEN** a caller runs `create-nextrush my-api --yes --runtime nodee`
- **THEN** the CLI exits non-zero without creating `my-api`, identifies `nodee` as invalid, lists `node`, `bun`, and `deno`, and shows a valid `--runtime` example

#### Scenario: Unknown option is rejected
- **WHEN** a caller passes an unsupported option such as `--typo`
- **THEN** the CLI exits non-zero without scaffolding and directs the caller to `--help`

#### Scenario: Complete non-interactive input does not prompt
- **WHEN** a caller supplies a valid directory, style, runtime, middleware, package manager, install choice, Git choice, and `--yes`
- **THEN** the CLI creates the selected project without an interactive prompt

### Requirement: Non-interactive target conflicts are safe and machine-detectable
When the target directory is non-empty, `create-nextrush` MUST preserve existing files. In non-interactive
mode (`--yes` or no TTY), it SHALL not prompt; it MUST exit non-zero with a stable
`TARGET_DIRECTORY_NOT_EMPTY` error and state that no files were changed. Overwriting, if supported,
MUST require an explicit `--overwrite` option and MUST be documented as destructive.

#### Scenario: --yes never silently declines a target conflict
- **WHEN** `--yes` targets a directory containing files without `--overwrite`
- **THEN** the CLI exits non-zero, emits `TARGET_DIRECTORY_NOT_EMPTY`, and leaves every existing file unchanged

#### Scenario: Interactive target conflict remains protective
- **WHEN** an interactive user targets a non-empty directory without `--overwrite`
- **THEN** the CLI presents a confirmation whose default does not overwrite files

#### Scenario: Explicit overwrite is observable
- **WHEN** a caller uses the documented `--overwrite` option on a non-empty directory
- **THEN** the CLI states that existing files may be replaced before writing and reports the files written in its completion result

### Requirement: The scaffolder provides a stable automation interface
The CLI SHALL support `--dry-run` and `--json`. `--dry-run` MUST validate all supplied input and return
the selected options, target path, planned files, package-manager action, Git action, and verification
URL without modifying the filesystem or running install/Git commands. `--json` MUST emit one
schema-versioned result or error document to stdout and no decorative terminal UI; errors MUST have a
stable code, message, and remediation.

#### Scenario: Dry run has no side effects
- **WHEN** a caller runs a valid scaffold command with `--dry-run`
- **THEN** no target directory, file, Git repository, or dependency installation is created, and the plan identifies every file that would be written

#### Scenario: JSON success is machine-readable
- **WHEN** a valid non-interactive scaffold command uses `--json`
- **THEN** stdout contains exactly one valid result document with schema version, target path, selected options, written-file list, post-scaffold action status, and verification URL

#### Scenario: JSON failure is machine-readable
- **WHEN** an invalid option or target conflict occurs with `--json`
- **THEN** stdout contains exactly one valid error document with a stable error code, message, remediation, and non-zero process exit

### Requirement: Offline generation is explicit after package acquisition
After `create-nextrush` is locally available, `--offline` SHALL avoid all registry probes and resolve every
emitted dependency from the embedded per-package fallback map. The CLI MUST state that the generated
dependency ranges are offline fallback ranges. Documentation MUST distinguish this mode from the
separate network requirement to acquire the generator through `npm create` for the first time.

#### Scenario: Cached CLI scaffolds without registry access
- **WHEN** a locally available CLI runs with `--offline` while its configured registry is unreachable
- **THEN** generation succeeds without a registry request and every emitted dependency range comes from its own fallback entry

#### Scenario: First package acquisition is explained honestly
- **WHEN** documentation describes offline scaffolding
- **THEN** it explains that `npm create` must first download or already have cached `create-nextrush`, while `--offline` governs the generator's own dependency-version probes

### Requirement: The default onboarding path minimizes unnecessary decisions
Interactive onboarding SHALL first offer a recommended Node API starter composed of the supported default
style, runtime, and middleware preset. Accepting it MUST proceed without asking separate architecture
questions. Choosing customization MUST expose style, runtime, middleware, and package-manager choices
with concise consequences and preserve keyboard-accessible selection and validation.

#### Scenario: Recommended starter is one decision
- **WHEN** a first-time interactive user accepts the recommended starter
- **THEN** the CLI selects the documented Node API defaults without separately prompting for style, runtime, or middleware

#### Scenario: Customization remains complete
- **WHEN** a user chooses customization
- **THEN** the CLI presents every supported style, runtime, middleware, and package-manager choice with enough description to distinguish them

### Requirement: Runtime and package-manager choices are observable and actionable
Before a local install or run action, the scaffolder SHALL state the selected or detected package manager
and its source (explicit, detected, or runtime policy). When a selected runtime is expected to be used
locally and its binary is unavailable, the CLI MUST fail or warn with an actionable installation/remoting
path; callers targeting another machine MUST be able to opt out explicitly.

#### Scenario: Detected package manager is visible
- **WHEN** package manager selection is inferred from the invoking environment
- **THEN** the CLI reports the selected manager and that it was detected before it runs installation

#### Scenario: Missing selected runtime is actionable
- **WHEN** a local Bun or Deno scaffold is about to run an action requiring a binary absent from PATH
- **THEN** the CLI identifies the missing runtime and explains how to install it or explicitly skip the local check

### Requirement: Production foundations are available as an opt-in preset
The base starter SHALL remain lean. `create-nextrush` MUST offer a documented opt-in production-service
preset that generates a coherent quality and operational baseline: editor settings, a formatter/linter,
CI validation, container files, and production/health documentation. The preset MUST work with every
supported generated runtime or clearly refuse unsupported combinations before writing files.

#### Scenario: Production preset supplies an operational baseline
- **WHEN** a supported project is generated with the production-service preset
- **THEN** it includes editor, format/lint, CI, container, ignore, and production-operation artifacts that reference its generated scripts and health endpoint

#### Scenario: Base starter remains focused
- **WHEN** a project is generated without the production-service preset
- **THEN** production-preset-only files are not emitted and the ordinary starter remains runnable, testable, and documented

### Requirement: Workspace and task-oriented starters are governed opt-ins
The CLI SHALL provide only documented, tested workspace destinations and task-oriented examples. A
workspace mode MUST detect or require an explicit supported workspace layout and report its resolved
destination. An example MUST be versioned with the CLI, identify its maintained runtime/style contract,
and satisfy the same generated-project verification gate as the base starter.

#### Scenario: Workspace destination is explicit
- **WHEN** a caller requests a workspace destination
- **THEN** the CLI states the resolved path, package name, and workspace policy before writing, or fails with actionable guidance if the workspace is unsupported

#### Scenario: Example is verified like the base starter
- **WHEN** a task-oriented example is offered by the CLI
- **THEN** release verification installs, builds, starts, and checks its documented endpoint on every runtime/style combination it advertises

## MODIFIED Requirements

### Requirement: A generate-then-install matrix gate verifies every scaffold combination
CI SHALL scaffold a project from the published `create-nextrush` artifact for each supported
`style × runtime × middleware` combination, install its dependencies, run its generated tests, build it,
start it, and verify the documented health endpoint. A fast hermetic source-template suite MAY run on
pull requests, but a scheduled and release-blocking published-artifact matrix MUST verify the externally
installable experience. This gate MUST fail the build when any generated combination has an
unresolvable range or fails any required lifecycle stage.

#### Scenario: A combination that cannot install fails CI
- **WHEN** any scaffold combination emits a dependency range that does not resolve against publish versions
- **THEN** the published-artifact matrix fails, naming the offending combination and package

#### Scenario: The matrix covers every offered option
- **WHEN** the published-artifact gate runs
- **THEN** every value of `style`, `runtime`, and `middleware` is exercised in at least one generated, installed, tested, built, started, and health-checked combination

#### Scenario: Published behavior cannot be replaced by a stubbed proof
- **WHEN** release verification reports runtime support for a generated project
- **THEN** it uses the published framework packages and real runtime binary for that reported combination, not only local stubs or static source inspection

### Requirement: The scaffolder onboarding flow is coherent and honest
The CLI onboarding SHALL be internally consistent: an explicitly-passed affirmative flag (`--install`,
`--git`) does not re-prompt for the same decision; a git-initialized project receives an initial commit;
the completion output names the correct brand (`NextRush`), tells the developer the URL to open to
verify the running app, summarizes the selected starter/runtime/middleware/package manager, and points
to a production validation path; and the version probe is not performed when no install will occur
unless the caller explicitly requests online resolution.

#### Scenario: Explicit flags are not re-asked
- **WHEN** the user passes `--install` or `--git` explicitly
- **THEN** the CLI does not prompt again for that same decision

#### Scenario: A git-initialized project has an initial commit
- **WHEN** git initialization is enabled
- **THEN** the generated project is left with an initial commit, not merely staged files

#### Scenario: Completion output is branded correctly and points to a URL
- **WHEN** scaffolding completes
- **THEN** the outro uses `NextRush` (correct casing), names the selected starter/runtime/middleware/package manager, and the next steps include the URL to open (e.g. the health endpoint) for the selected style

#### Scenario: Completion distinguishes development from production
- **WHEN** scaffolding completes
- **THEN** the output and generated README give a concise build-and-start production validation path and a link to the applicable production documentation
