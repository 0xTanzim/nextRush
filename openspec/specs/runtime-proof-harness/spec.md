# runtime-proof-harness

## Purpose

The CI proof requirements for NextRush's edge/multi-runtime claims — real-runtime conformance
execution (workerd/Deno via Docker/`act`), the edge bundle-size budget gate, a
conformance-derived runtime certification matrix, and scheduled real-cloud deploy verification
(deploy→smoke→destroy).
## Requirements
### Requirement: Real-runtime conformance execution
The cross-adapter conformance suite SHALL execute on the real target runtime for each advertised edge/self-hosted runtime — at minimum real Deno, a Cloudflare Workers isolate (`workerd`/miniflare), and real Bun — not simulated under Node. Runs MUST use pinned runtime versions and MUST be reproducible locally.

#### Scenario: Deno conformance runs on real Deno
- **WHEN** CI runs the Deno conformance job
- **THEN** the suite executes under the real Deno runtime against the Deno adapter and passes

#### Scenario: Workers conformance runs on a real isolate
- **WHEN** CI runs the Workers conformance job
- **THEN** the suite executes against the edge adapter inside a `workerd`/miniflare isolate and passes

#### Scenario: Bun conformance runs on real Bun
- **WHEN** CI runs the Bun conformance job
- **THEN** the suite executes under the real Bun runtime (`bun test`) against the Bun adapter and passes

#### Scenario: An adapter regression fails only its runtime's job
- **WHEN** a change breaks the edge adapter's behavior
- **THEN** the Workers conformance job fails while unaffected runtime jobs stay green

#### Scenario: A Bun-only regression fails the Bun job
- **WHEN** a change breaks behavior only under Bun (e.g. a `Bun.serve` divergence)
- **THEN** the Bun conformance job fails while the Node/Deno/Workers jobs stay green

#### Scenario: Locally reproducible
- **WHEN** a developer runs the conformance workflow locally with `act` against the pinned Docker images
- **THEN** the same jobs execute and produce the same pass/fail result as CI

### Requirement: Edge bundle-size budget
CI SHALL build the minimal functional edge bundle (core + router + edge adapter, `reflect-metadata`-free) and assert its gzipped size stays under a stated budget — a hard ceiling below the Cloudflare Workers 1 MB limit, with a tighter published internal target. Tree-shaking (`sideEffects: false`) MUST hold for the minimal entry.

#### Scenario: Minimal bundle is under budget
- **WHEN** CI builds the minimal functional edge entry
- **THEN** the gzipped size is under the stated budget and the job passes

#### Scenario: Bloat regression trips the gate
- **WHEN** a change introduces a `node:` import or a non-tree-shakeable dependency into the minimal edge path
- **THEN** the bundle-size job fails and reports the offending size increase

#### Scenario: Reflect-metadata stays out of the functional edge path
- **WHEN** the minimal edge bundle is analyzed
- **THEN** it contains no `reflect-metadata` and no `node:` runtime imports

### Requirement: Cold-start benchmark
The change SHALL publish a cold-start benchmark for the functional serverless path, and disclose the additional cost of the class/DI (`reflect-metadata` + eager DI) path.

#### Scenario: Cold-start baseline is produced
- **WHEN** the serverless cold-start benchmark runs
- **THEN** it reports cold vs warm invocation cost for the functional path and a separate figure for the class path

### Requirement: Runtime certification matrix
The change SHALL publish a runtime certification matrix mapping features (at minimum: Request, Streaming, AbortSignal, Cookies, Multipart, SSE, Compression, WebSockets, Shutdown, Timeouts) to each supported runtime, with a per-runtime coverage score. The matrix MUST be generated from conformance-suite results, not hand-maintained. Each runtime row MUST additionally carry a proof level derived from which driver produced its result — `real-runtime` (executed on the actual runtime/isolate) versus `simulated` (in-process driver only) — and any public "proven"/green status (in the certification matrix, README, or docs) MUST be reserved for `real-runtime` rows.

#### Scenario: Matrix is generated from conformance results
- **WHEN** the conformance suite runs across runtimes
- **THEN** a certification matrix is produced showing per-feature pass/fail and a per-runtime coverage percentage (e.g. Node 100%, Cloudflare 97%, Lambda 95%)

#### Scenario: A capability regression drops a runtime's score
- **WHEN** a change removes a previously-passing feature on a runtime
- **THEN** that runtime's certification score decreases and the matrix reflects the lost feature

#### Scenario: Matrix distinguishes real-runtime from simulated proof
- **WHEN** the certification matrix is generated
- **THEN** each runtime row shows its proof level (`real-runtime` vs `simulated`), reflecting whether its result came from a real runner (Deno/workerd/Bun) or an in-process driver (web/serverless)

#### Scenario: Public matrix reserves proven status for real-runtime rows
- **WHEN** the README/docs runtime matrix is published
- **THEN** the "proven"/green marker appears only for runtimes with a `real-runtime` proof level, and simulated-only runtimes are labeled distinctly

### Requirement: Scheduled real-cloud deployment verification
The change SHALL provide a scheduled (nightly and/or pre-release) workflow that deploys a minimal app to real Lambda, real Cloudflare, real Vercel Edge, and real Google Cloud Functions, runs a smoke test, and destroys the deployment (`deploy → smoke → destroy`). It MUST be gated on repository secrets, MUST NOT run as a per-PR hard gate, and MUST be skipped (not failed) when credentials are absent, per platform independently.

#### Scenario: Scheduled deploy verifies on real cloud
- **WHEN** the scheduled workflow runs with cloud credentials present
- **THEN** it deploys to real Lambda, Cloudflare, Vercel Edge, and GCF, the smoke test passes on each, and all deployed resources are destroyed at the end of the run

#### Scenario: Missing credentials skip rather than fail
- **WHEN** the workflow runs without a given platform's credentials (e.g. on a fork)
- **THEN** that platform's deployment verification is skipped and does not fail the pipeline, independently of the other platforms

#### Scenario: A newly-added platform is verified end to end
- **WHEN** the scheduled workflow runs with Vercel and GCF credentials present
- **THEN** each deploys, returns a passing smoke response, and is destroyed, proving the platform beyond in-process simulation

### Requirement: WinterCG allowed-globals assertion
The conformance harness SHALL include a test that (a) enumerates the WinterCG Minimum Common allowed-global surface the request path may use (at minimum `Request`, `Response`, `URL`, `URLSearchParams`, `fetch`, `Headers`, `AbortSignal`, `crypto.subtle`, Web Streams, `TextEncoder`, `TextDecoder`) and (b) asserts the core request path references no forbidden Node-only global (`process`, `Buffer`, `__dirname`, `node:*`). The test MUST fail when a forbidden global is introduced into the core request path.

#### Scenario: Forbidden Node global fails the assertion
- **WHEN** a `process.hrtime()` (or any Node-only global) reference is added to the core request path
- **THEN** the WinterCG assertion fails and CI reports the offending forbidden global

#### Scenario: Blessed global surface passes
- **WHEN** the request path uses only the enumerated WinterCG-blessed globals
- **THEN** the WinterCG assertion passes

#### Scenario: Allow-list is an explicit, reviewable contract
- **WHEN** a reviewer inspects the assertion
- **THEN** the allowed-global surface is enumerated explicitly in the test (a curated snapshot of the Minimum Common API), not inferred only from an incidental runtime failure
