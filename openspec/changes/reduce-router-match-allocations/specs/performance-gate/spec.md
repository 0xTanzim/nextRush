## ADDED Requirements

### Requirement: The benchmark suite covers object-body dispatch, static-file serving, and large request bodies

The comparative benchmark suite SHALL include scenarios exercising `send(object)`-style response
dispatch, static-file serving, and a request body at or above 1 MB — in addition to the scenarios
already covering JSON serialization, routing, query/param parsing, and the existing 5-layer
middleware stack — so that a change to the general request-dispatch or body-handling path can be
measured against real coverage rather than an unmeasured gap.

#### Scenario: An object-dispatch scenario exists and is measured

- **WHEN** the benchmark suite runs
- **THEN** a scenario exists that dispatches a plain object through each framework's response
  helper (not a pre-serialized string), and every compared framework's response for that scenario
  is validated for fairness the same way the other scenarios already are

#### Scenario: A static-file scenario exists and is measured

- **WHEN** the benchmark suite runs
- **THEN** a scenario exists that serves a static file through each framework's static-file
  mechanism, and its response is validated for byte-for-byte parity across frameworks where the
  frameworks' own static-serving mechanisms make that possible

#### Scenario: A large-request-body scenario exists and is measured

- **WHEN** the benchmark suite runs
- **THEN** a scenario exists that sends a request body at or above 1 MB and measures the framework's
  body-parsing and response cost at that size, distinct from the existing smaller `post-json`
  scenario
