# Spec Delta

## ADDED Requirements

### Requirement: Every declared budget is evaluated on the runtime it applies to

A budget rule SHALL declare the runtimes it applies to. The gate MUST evaluate each applicable
budget on that runtime and MUST NOT evaluate a budget on a runtime it does not apply to. A
runtime-scoped budget that no run evaluates SHALL fail the bookkeeping stage.

#### Scenario: A budget scoped to Bun is gated on Bun

- **WHEN** the gate runs with Bun and a budget declares Bun as an applicable runtime
- **THEN** the metric is reported with PASS, WARN, or FAIL against that rule
- **AND** the metric is recorded for the next run's delta

#### Scenario: A budget scoped away from Node is not gated on Node

- **WHEN** the gate runs with Node and a budget declares only Bun as applicable
- **THEN** the metric may be printed as informational output
- **AND** it MUST NOT produce PASS, WARN, or FAIL for that rule

#### Scenario: An applicable budget that is never evaluated fails bookkeeping

- **WHEN** a budget declares the current runtime as applicable
- **AND** the stage set for the run never evaluates that budget
- **THEN** the bookkeeping stage fails with the unevaluated budget's name

### Requirement: The gate can measure the build users ship without replacing the source gate

The gate SHALL provide an opt-in mode that measures the resolved package build output instead of
the source alias. In that mode it MUST fail fast with an actionable message when a required build
output is missing. Built-mode numbers MUST be recorded separately from source-mode numbers, and
source-mode numbers remain the merge gate until a committed built-mode baseline exists.

#### Scenario: Built mode measures resolved package output

- **WHEN** the gate runs in built mode
- **THEN** entries resolve through the packages' published entry points
- **AND** the run reports the source-versus-built delta for each measured row

#### Scenario: Missing build output fails fast

- **WHEN** the gate runs in built mode and a required package build output is absent
- **THEN** the run stops before measuring
- **AND** the message names the missing output and the command that produces it

#### Scenario: Built mode does not silently become the gate

- **WHEN** a built-mode row exceeds a budget
- **THEN** the row is reported as informational
- **AND** the exit code is not affected by that row alone

### Requirement: The gate covers body-bearing and header-heavy request shapes

The per-request gate SHALL measure a body-bearing POST shape and at least two request-header
counts. The header-count rows MUST measure the same frameworks in the same run so the ratio
cancels machine noise.

#### Scenario: Body-bearing requests are part of the steady-state gate

- **WHEN** the in-process stage runs
- **THEN** it includes a POST shape whose body is parsed before the handler
- **AND** the shape reports microseconds per request for NextRush and its reference

#### Scenario: Header cost is measured at two counts

- **WHEN** the in-process stage runs
- **THEN** it reports a low-header and a high-header row for NextRush and its reference
- **AND** each row is evaluated against the budget for that header count

### Requirement: Informational wire measurements report repeatability

A wire-throughput measurement SHALL run the same server and load generator at least three times
and report the median together with the observed minimum and maximum. Wire measurements MUST NOT
fail the gate.

#### Scenario: Wire reports a median and a spread

- **WHEN** the wire stage completes a case
- **THEN** the row reports the median requests per second
- **AND** the row reports the spread between the lowest and highest run

#### Scenario: Wire noise never fails the build

- **WHEN** a wire case falls below its target or below a reference framework
- **THEN** the row remains informational
- **AND** the run's exit code is unchanged by that row

### Requirement: Deno runs the same gate contract as the other runtimes

The gate SHALL support Deno as a runtime target. A Deno run MUST execute the correctness probe
list through the Deno adapter and MUST apply runtime-scoped exemptions exactly as the Bun and Node
runs do. A Deno probe failure that is not exempt for Deno SHALL fail the gate.

#### Scenario: The probe list runs on Deno

- **WHEN** the gate runs with Deno selected as the runtime
- **THEN** every probe in the registry is sent to a Deno server through a real socket
- **AND** each probe reports the observed status and shape

#### Scenario: An exemption is honoured only on the runtime it names

- **WHEN** a known-failure id lists Bun but not Deno
- **AND** its probe fails on Deno
- **THEN** the run fails
- **AND** the row identifies the unexempted failure

### Requirement: A fast path accepted by the gate is equivalent and falls back

A compiled or otherwise specialized fast path added under this gate SHALL produce the same
observable result as the generic path for every supported input. It MUST fall back to the generic
path when the metadata or schema it depends on is missing or unsupported, and MUST NOT rely on
runtime code generation such as `eval` or `new Function`.

#### Scenario: Fast and generic paths agree

- **WHEN** the same request is processed once through the fast path and once through the generic
  path
- **THEN** the status, headers that affect interpretation, and response bytes are identical

#### Scenario: Unsupported input uses the fallback

- **WHEN** the fast path's required metadata is absent or its schema is unsupported
- **THEN** the request is processed by the generic path
- **AND** no error is surfaced to the client because of the fallback

#### Scenario: Runtime code generation is rejected

- **WHEN** framework source contains `eval`, `new Function`, or an `AsyncFunction` constructor
- **THEN** the gate's source guard fails

### Requirement: The committed gate target matches the programme's success metric

The Bun in-process target SHALL be `1.3` with a hard maximum of `1.9`. A change that alters either
committed value MUST update the RFC success metric that names it in the same change.

#### Scenario: Budget and RFC agree

- **WHEN** the committed Bun in-process target is read from the budget rules
- **THEN** the RFC success metric names the same target
- **AND** the hard maximum is unchanged at `1.9`
