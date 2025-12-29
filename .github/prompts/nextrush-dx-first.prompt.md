---
description: 'DX-first audit for NextRush focused on bugs, vulnerabilities, architecture quality, and reducing developer effort'
agent: software-engineer
name: 'NextRush DX and Code Quality Audit'

---

# NextRush — Developer Experience, Code Quality, and Security Audit

## Mission
Audit **NextRush** with a primary goal of delivering the **best possible Developer Experience (DX)** while keeping the system correct, secure, and maintainable.

The priorities, in order:

1) DX: less code, fewer steps, low friction
2) Security and vulnerability safety
3) Correctness and runtime reliability
4) Modular, clean architecture
5) Performance only when it does not hurt DX

## Scope & Focus Areas
Evaluate and report on:

- bugs and incorrect behavior
- security vulnerabilities
- runtime and build compatibility issues
- DX for users and contributors
- API ergonomics and ease of use
- mental model simplicity
- codebase maintainability
- unnecessary complexity or boilerplate
- SRP and modular design violations

Do **not** generate documentation in this prompt.

## Inputs
Project root: `${workspaceFolder}`

Optional:
- `${input:usageMode:library or application?}`
- `${input:runtimeTarget:node version / edge / browser?}`

Ask if missing and pause if unclear.

## Workflow

### 1) Understand NextRush
- infer goals of the project
- detect framework and language
- identify public APIs
- identify onboarding path for new users
- map high-level architecture

Answer:

- What is NextRush trying to make easier?
- Who is the developer persona?
- What friction exists today?

### 2) DX-First Evaluation
Evaluate DX across:

- ease of installation
- zero-config story
- onboarding time
- number of steps to first success
- default behavior vs configuration burden
- clarity of folder structure
- clarity of naming
- amount of boilerplate required
- need to “understand internals” to use
- error message quality
- auto-discovery and auto-wiring
- “pit of success” design

Give a **DX score**:

- Excellent
- Good
- Okay
- Poor
- Unusable

Explain the score.

### 3) Find DX Pain Points
Identify specific problems like:

- too many layers or abstractions
- over-engineering
- leaky abstractions
- unnecessary generics or types
- confusing configuration
- APIs that need too many parameters
- setup repetition
- copy-paste patterns
- verbose boilerplate
- magic without clarity
- hidden side effects

Explain for each:

- why it hurts DX
- how to simplify
- ideal minimal API

### 4) Bugs and Vulnerability Audit
Identify and classify:

- critical vulnerabilities
- insecure APIs
- unvalidated input
- unsafe defaults
- dependency risks
- secrets exposure
- unsafe file or network operations
- missing error handling

Classify severity:
- critical
- high
- medium
- low

Focus on **must-fix items first**.

### 5) Architecture & Code Quality Review
Check for:

- SRP violations
- God objects/modules
- tight coupling
- cyclic dependencies
- runtime-specific logic leaking into core
- missing adapters
- weak boundaries between domains
- hard-to-test code
- unclear intent or naming

Describe:

- what is wrong
- why it matters
- recommended refactor direction

### 6) Runtime Compatibility & Adapters
Verify:

- supported runtimes are clear
- conditionally loaded adapters work
- no accidental Node-only code in browser targets
- ESM/CJS consistency
- TS configuration soundness

Identify risks of:

- dynamic imports misuse
- bundler incompatibility
- breaking tree-shaking
- environment assumptions

### 7) Compare with Popular Ecosystem Libraries
Compare with similar tools or libraries and evaluate:

- ergonomics
- simplicity
- default behavior quality
- abstraction quality
- adapter pattern usage
- onboarding experience

Highlight:

- what they do better that we should learn from
- mistakes they made that we should avoid

### 8) Edge Case Coverage
List missing coverage for:

- null/undefined
- malformed input
- concurrency
- timeouts
- network failures
- large payloads
- race conditions
- partial state recovery

## Output Expectations
Provide:

- DX score and justification
- ranked list of DX problems
- ranked list of bugs and vulnerabilities
- explanation of architecture weaknesses
- specific, concrete improvement suggestions
- proposal for reducing code and configuration for users
- “quick wins” vs “deep refactors”

Do not modify code unless explicitly asked.

## Success Criteria
This audit should enable the team to:

- fix critical issues first
- reduce code required by users
- remove friction points
- redesign APIs for simplicity
- move toward best-in-class DX
