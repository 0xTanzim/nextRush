## ADDED Requirements

### Requirement: Configurable Deno permission set

The `@nextrush/dev` CLI SHALL allow a project to extend the Deno permission set used when spawning `nextrush dev` and `nextrush build` under the Deno runtime. Configured permissions MUST be merged with the built-in default set (`--allow-net --allow-read --allow-env`), never replace it. When no permissions are configured, the CLI MUST spawn Deno with exactly the default set.

#### Scenario: Default permission set is unchanged when unconfigured
- **WHEN** a project runs `nextrush dev` or `nextrush build` under Deno with no permission configuration
- **THEN** the CLI spawns the Deno process with exactly `--allow-net --allow-read --allow-env` — no additional and no missing permissions

#### Scenario: A configured extra permission is granted
- **WHEN** a project configures an additional permission such as `--allow-write` and runs a Deno app that requires it
- **THEN** the spawned Deno process receives the default set plus `--allow-write`, and the app runs successfully instead of failing on a missing permission

#### Scenario: A configured permission duplicating a default is not passed twice
- **WHEN** a project configures a permission already present in the default set (e.g. `--allow-net`)
- **THEN** the spawned Deno process receives that permission exactly once

#### Scenario: An invalid permission value fails fast
- **WHEN** a configured permission value is not a recognized Deno permission flag (it does not begin with `--allow-` or `--deny-`)
- **THEN** the CLI exits with a non-zero status and an error message naming the offending value, and does not spawn Deno
