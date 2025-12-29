---
description: 'Audit codebase, fix critical bugs and vulnerabilities, improve structure, and generate world-class documentation'
name: 'Comprehensive Code Audit and Documentation'
argument-hint: 'Provide target runtime and library name if applicable'
agent: software-engineer
---

# Comprehensive Code Audit, Hardening, and Documentation

## Mission
Audit the project. Fix bugs and high-risk vulnerabilities. Improve design quality and runtime safety. Produce clean, modular, enterprise-grade code and documentation.

## Scope & Preconditions
- Target: the current repository
- Focus:
  - functional bugs
  - security vulnerabilities
  - maintainability issues
  - architecture and modularity
  - runtime compatibility
  - missing edge-case handling
- Treat **critical security issues as must-fix**
- Avoid breaking public APIs unless necessary; if so, document changes

## Inputs
- Project type (auto-detect): `${workspaceFolder}`
- Package manager (auto-detect): npm | yarn | pnpm
- Optional inputs the user may provide:
  - `${input:targetRuntime:node version or environment?}`
  - `${input:libraryName:package or module name?}`

If required inputs are missing, ask the user. Stop if still undefined.

## Workflow

### 1) Project Understanding
1. Read folder structure
2. Detect language, framework, and runtime targets
3. Map key modules, adapters, and public APIs
4. Identify critical paths and entry points

### 2) Bug and Vulnerability Audit
1. Run static analysis
2. Search for:
   - exception paths
   - unhandled promises/errors
   - insecure APIs
   - unsafe deserialization
   - injection risks
   - weak crypto
   - insecure file or network operations
3. Flag CVE-known vulnerable dependencies
4. Classify by severity: critical, high, medium, low

### 3) Fixes and Hardening
1. **Fix critical and high vulnerabilities first**
2. Add input validation and output encoding where needed
3. Add missing error handling paths
4. Remove dead code and unused permissions
5. Replace unsafe APIs with safe equivalents
6. Add security headers or configuration hardening when relevant

### 4) Code Quality & Design
Improve to **enterprise standard**:
- single-responsibility (no SRP violations)
- small modules
- clear separation of concerns
- adapters where runtime varies
- dependency injection when beneficial
- avoid cyclic dependencies
- write readable, simple functions

### 5) Runtime Compatibility
1. Detect supported Node/browser/runtime versions
2. Check adapter layers
3. Ensure compatibility with:
   - ESM/CJS modules where relevant
   - TypeScript configs
   - build tools
4. Remove runtime-only breakages

### 6) Edge Case Coverage
Add handling for:
- null/undefined
- boundary values
- I/O errors
- network failures
- concurrency conditions
- timeouts and retries where appropriate

### 7) Compare with Popular Libraries
1. Identify similar libraries
2. Note:
   - strengths they have
   - mistakes they make
3. Improve our design using those lessons
4. Avoid known anti-patterns

### 8) Documentation Tasks
#### README.md
Create or improve:
- clear overview
- install and usage
- API examples
- compatibility matrix
- security notes
- FAQ
- contribution guide

#### VitePress Docs

Docs must be:
- concise
- practical
- copy-paste runnable
- world-class developer experience

### 9) Quality Gate
Before finishing, verify:
- build passes
- linter passes
- type checks pass
- tests run
- docs build without errors

## Output Expectations
- fixed source files
- list of key changes
- risk notes if anything remains unresolved
- generated README
- generated VitePress docs skeleton and pages

## Quality Assurance Checklist
- [ ] critical vulns fixed
- [ ] bugs resolved or documented
- [ ] SRP respected
- [ ] modules small and focused
- [ ] edge cases handled
- [ ] no obvious runtime breaking changes
- [ ] docs are complete and readable

## Failure Triggers
Stop and ask for input if:
- repo cannot be analyzed
- runtime version unclear
- build system missing

## Next Steps for the Team
- add CI security scanning
- add unit and integration coverage
- fuzz test critical API inputs
- define support policy and versioning strategy
- publish docs site
