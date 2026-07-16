## ADDED Requirements

### Requirement: `nextrush dev`'s SWC-loader resolution is independent of bundle depth
The SWC-loader path resolution used by `nextrush dev` SHALL correctly locate
`loaders/swc-loader.mjs` regardless of which built entry point's bundle the resolution code is
inlined into, rather than assuming a fixed directory depth relative to its own module location.

#### Scenario: Loader resolves correctly when invoked through the CLI entry point
- **WHEN** `nextrush dev` is invoked via the package's real `bin/nextrush.js` entry point (which
  loads the bundled `dist/cli.js`)
- **THEN** the SWC loader is found and `nextrush dev` starts the target application successfully,
  rather than failing with `ERR_MODULE_NOT_FOUND`

#### Scenario: Loader resolution is verified against the actual built artifact
- **WHEN** a regression test for loader resolution runs
- **THEN** it exercises the real built CLI binary (spawning `bin/nextrush.js` or equivalent
  against a fixture project), not only the exported resolution function called in isolation

#### Scenario: The source-mode (non-dist) fallback path is unaffected
- **WHEN** the resolution code runs from an unbundled source location (not under a `dist`
  directory) — the existing dev-mode fallback case
- **THEN** it continues to return the npm package fallback path unchanged, exactly as before this
  fix
