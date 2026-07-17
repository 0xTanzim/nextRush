# actionable-body-parser-error Specification

## Purpose
TBD - created by archiving change improve-router-modularity-and-class-dx-papercuts. Update Purpose after archive.
## Requirements
### Requirement: A missing body-parser produces an actionable `@Body` error
When `@Body()` resolves to nothing because no body-parser middleware ran, the resulting error
SHALL name the likely cause and fix, rather than a generic parameter-injection error with no
diagnostic hint.

#### Scenario: A route using `@Body()` with no body-parser installed fails with a helpful error
- **WHEN** a request hits a route using `@Body()` and no body-parser middleware
  (e.g. `json()`) has been registered on the application
- **THEN** the resulting error's message mentions the likely missing body-parser and how to fix
  it (e.g. referencing `app.use(json())`), instead of only a generic `MissingParameterError`
  with no such hint

#### Scenario: A correctly-configured `@Body()` route is unaffected
- **WHEN** a body-parser middleware is registered and a route using `@Body()` receives a valid
  request
- **THEN** the body resolves correctly with no error, exactly as before this change

