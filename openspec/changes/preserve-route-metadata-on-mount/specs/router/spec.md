## ADDED Requirements

### Requirement: Mounting a sub-router preserves route metadata in the parent's introspection
When a router mounts another router (`mount(prefix, subRouter)` or
`use(prefix, subRouter)`), every copied route SHALL carry, in the mounting
router's `getRoutes()` output, the same merged route metadata the route exposes
on the sub-router itself — regardless of whether the metadata was contributed by
runtime middleware (e.g. `validate()`) or by a pure metadata marker (e.g.
`endpoint()`). A contributor's metadata MUST NOT depend on where the contributor
happens to be stored in the mount-time reconstruction.

#### Scenario: Mounted route with validation middleware keeps its request schemas
- **WHEN** a sub-router route registered with a request-validating middleware is mounted into a parent router
- **THEN** the parent's `getRoutes()` entry for the mounted path includes the same request-schema metadata the sub-router's `getRoutes()` reports for that route

#### Scenario: Mounted route with an endpoint marker keeps its documentation metadata
- **WHEN** a sub-router route registered with an endpoint documentation marker is mounted into a parent router
- **THEN** the parent's `getRoutes()` entry for the mounted path includes the marker's summary, tags, responses, and any other metadata the marker contributed

#### Scenario: Mounted route with combined contributors keeps the full merge
- **WHEN** a sub-router route carries both a validating middleware and an endpoint marker
- **THEN** the parent's `getRoutes()` entry exposes the complete merged metadata, equivalent to registering both contributors directly on the parent

#### Scenario: Metadata-free mounted routes are unchanged
- **WHEN** a sub-router route carries no metadata contributions and is mounted
- **THEN** the parent's `getRoutes()` entry for it has no metadata, exactly as an equivalent route registered directly on the parent

### Requirement: Mounted route metadata is the source definition transformed only by the mount path
For a metadata-bearing route copied by a mount, the parent's `getRoutes()` entry
MUST equal the sub-router's `getRoutes()` entry for the same route except for
the expected mount-path transformation (prefix joined onto the original pattern)
and any mount-time consolidation (e.g. derived HEAD handling). No metadata
field MAY be dropped, duplicated, or re-ordered in a way that changes merged
content.

#### Scenario: Lossless reconstruction
- **WHEN** a metadata-bearing sub-router route is mounted and both routers' `getRoutes()` outputs are compared
- **THEN** the parent's entry has the same method and the prefix-transformed path, and its metadata is content-equal to the sub-router's entry metadata

#### Scenario: No duplicate contributions
- **WHEN** a sub-router route is mounted into a parent that contributes no additional metadata of its own
- **THEN** the parent's entry metadata is produced exactly once — mounting MUST NOT merge the same contribution twice

### Requirement: Metadata preservation does not alter dispatch behavior or the hot path
Mount-time metadata preservation SHALL be registration-time-only. Request
dispatch for mounted routes MUST keep the same middleware execution order and
execution count as before the change, and the router's hot-path performance
guards MUST continue to pass with no measurable dispatch regression attributable
to metadata retention.

#### Scenario: Mounted middleware executes exactly once in the same order
- **WHEN** a request matches a mounted route whose sub-router middleware chain is unchanged
- **THEN** each middleware and the handler execute exactly once, in the same order, with the same results as before the change

#### Scenario: Hot-path guards remain green
- **WHEN** the router's hot-path guard suite and dispatch benchmarks run
- **THEN** they pass with no regression attributable to retaining metadata on internal route records

#### Scenario: Derived HEAD routes behave as before
- **WHEN** a metadata-bearing GET route on a sub-router is mounted
- **THEN** the derived HEAD entry is handled exactly as today (not copied; the parent re-derives it), and the GET route's metadata is preserved
