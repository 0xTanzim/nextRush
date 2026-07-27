## ADDED Requirements

### Requirement: Security review scope is explicit about what has and has not been reviewed

The framework's security-review process SHALL make explicit, in a durable artifact, which
packages and surfaces have been reviewed for security findings and which remain outstanding — a
change that resolves a fixed set of findings SHALL NOT be read as certifying the security posture
of surface it never examined.

#### Scenario: A prior security review named specific surface as out of scope

- **WHEN** `harden-security-boundaries`'s proposal explicitly lists Node request parsing beyond
  its own new raw-socket suite, `@nextrush/multipart`'s parser/scanner/storage, `body-parser`'s
  JSON charset handling, `@nextrush/template` auto-escaping, `@nextrush/class` guards/interceptors,
  and `websocket`/`stream`/`openapi`/`logger` as surface it did not review
- **THEN** a follow-up change SHALL exist that investigates exactly that named surface, and its
  findings SHALL be recorded in a report artifact separate from, and cross-referenced with, the
  prior review's own remediation index — so neither document silently absorbs the other's scope

#### Scenario: An investigation-only change produces no findings requiring a fix

- **WHEN** this audit's investigation of the named surface concludes with no P1-P4 finding for a
  given package
- **THEN** that conclusion SHALL be stated explicitly in the report with the evidence checked
  (files read, tests run, behavior observed) — an absence of findings is a stated, verified
  conclusion, never an implicit default from skipping the package
