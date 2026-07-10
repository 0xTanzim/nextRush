---
title: TDD Workflow
type: topic
created: 2026-07-10
sources: []
tags: [tdd, process, rfc]
---
# TDD Workflow

Source: `.kiro/steering/tdd-workflow.md` (project-specific, stricter than the global variant).

## The Iron Law
**NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.** Applies to every package. Code written before its test exists gets deleted and rebuilt test-first — no exception for "small" changes.

## Public APIs Are Contracts
Every exported API: write failing behavioral test → validate API design → implement smallest possible behavior → refactor with tests green. Changing a released exported API is significantly more expensive than changing internals — design carefully before implementing.

## RFC Before Implementation
Major architectural work (new packages, Context API additions, routing/middleware-pipeline changes, DI, decorators, streaming, adapters, runtime behavior, plugin system, public APIs) requires an approved RFC first. RFC defines architecture; TDD validates the implementation.

## RED → GREEN → REFACTOR → COMMIT
1. RED: one minimal failing test, confirm it fails for the right reason.
2. GREEN: minimal implementation, no speculative generality.
3. REFACTOR: clean up with tests green throughout, re-run after each step.
4. COMMIT: one coherent, revertible commit per cycle.

## Build the Foundation First
Never start with the public API. Implementation order: Core Primitive → Internal Engine → Internal Abstractions → Public API → Examples.

## Characterize Before Refactoring
Existing/legacy code with no test covering current behavior gets that test written FIRST, against existing behavior, before any change. Never delete a test to unblock a diff without a same-commit replacement of equal-or-better coverage.

## Adapter Consistency
Every adapter (`node`, `bun`, `deno`, `edge`) must behave identically. New runtime support runs the same behavioral test suite against every supported adapter — correctness is defined by identical observable behavior, not identical implementation. See `packages/adapters/conformance`.

## Backward Compatibility
Every bug fix → regression test. Every released public API keeps compatibility unless a deliberate, approved breaking change. Every production bug becomes a permanent test.

## Performance Follows Correctness
Order: Correctness → Tests → Cross-runtime consistency → Benchmarks → Optimization. Never optimize before behavior is correct.

## Related
- [[topics/engineering-standards]]
- [[topics/performance]] — where optimization fits in the ordering above.
