# ADR-0001 — Commit to the legacy TypeScript decorator dialect

**Status:** Accepted
**Date:** 2026-07-08
**Deciders:** NextRush Core Team
**Packages affected:** `@nextrush/decorators`, `@nextrush/di`, `@nextrush/controllers`, `@nextrush/dev`, `nextrush` (meta)
**Related:** class-based audit finding **HIGH-4** (legacy-decorator lock-in); `docs/RFC/RFC-NEXTRUSH-DI-CONTAINER-OWNERSHIP.md`

---

## Context

The class-based half of NextRush (`@Controller`, `@Get`/`@Post`, `@Body`/`@Param`,
`@Service`, `@UseGuard`, and tsyringe-backed constructor injection) is built on
TypeScript's **legacy experimental decorators**. `tsconfig.base.json` pins:

```json
{
  "experimentalDecorators": true,
  "emitDecoratorMetadata": true,
  "ignoreDeprecations": "6.0"
}
```

This is a deliberate, load-bearing choice — not an accident of an old template — and it
diverges from the TC39 Stage-3 decorators that became the TypeScript 5 default. This ADR
records why we are on the legacy dialect, what it costs consumers, and under what
conditions we would reconsider.

Two capabilities the class-based feature depends on **do not exist** in the standard
(Stage-3) decorator model:

1. **Parameter decorators.** `@Body()`, `@Param('id')`, `@Query()`, `@Header()`, `@Ctx()`,
   and constructor-injection markers are all parameter decorators. TC39 Stage-3 decorators
   have no parameter-decorator form at all.
2. **`emitDecoratorMetadata` / `design:paramtypes` reflection.** tsyringe resolves a
   constructor's dependencies by reading the `design:paramtypes` metadata the compiler
   emits under `emitDecoratorMetadata`. Standard decorators do not emit this metadata;
   there is no standard replacement.

Because both are foundational to the DI + controller model, the entire class-based surface
is coupled to the legacy dialect.

## Decision

**NextRush commits to the legacy `experimentalDecorators` + `emitDecoratorMetadata`
dialect for its class-based feature set for the lifetime of the current major line.**

- The repo-wide `tsconfig.base.json` keeps `experimentalDecorators`,
  `emitDecoratorMetadata`, and the `ignoreDeprecations: "6.0"` escape hatch that silences
  TypeScript's deprecation warning for these flags.
- Documentation and the `@nextrush/dev` toolchain treat the legacy dialect + a
  metadata-emitting build as a hard requirement of the class-based path, stated up front
  rather than discovered on the first cryptic runtime failure.

## Consequences

### Consumer impact (the setup contract)

Any application using the class-based API **must**:

1. Set `experimentalDecorators: true` and `emitDecoratorMetadata: true` in its own
   `tsconfig.json`. Without these, decorators silently no-op and DI cannot resolve
   constructor parameters.
2. Build/run with a **metadata-emitting toolchain**: `tsc`, or `@nextrush/dev` (SWC
   configured to emit decorator metadata). `@nextrush/dev` validates the required
   `tsconfig.json` flags at startup.
3. Import `reflect-metadata` once at the entry point (automatic when using `nextrush/class`).

It **breaks under metadata-stripping runtimes**: bare `tsx`, `esbuild`, and similar
transpile-only tools do not emit `design:paramtypes`, so DI resolution fails at runtime
with a "TypeInfo not known" error. This is the single most common first-run failure and is
called out in the `@nextrush/controllers` troubleshooting docs.

The purely functional API (`createApp`, `createRouter`, middleware) carries **none** of
these requirements — the decorator tax is paid only by users who opt into `nextrush/class`.

### Divergence from the TC39 standard

- We are on the dialect that TypeScript now marks deprecated (hence `ignoreDeprecations`).
- Standard (Stage-3) decorators are **not** a drop-in migration: no parameter decorators,
  no `emitDecoratorMetadata`. Adopting them would require a redesign of parameter
  injection and DI dependency discovery, not a flag flip.

### Supported-lifetime commitment

The legacy dialect is supported for the **entire current major version line**. It will not
be removed, gated, or deprecated in a minor or patch release. Any change to the decorator
dialect is a breaking change gated behind a new major version and the RFC + migration-guide
process (per the repo's "RFC before implementation" and API-contract rules).

### Migration cost & trigger

We would open a migration RFC only if a concrete trigger materializes, for example:

- TypeScript removes or hard-breaks `experimentalDecorators` / `emitDecoratorMetadata`
  (retiring the `ignoreDeprecations` escape hatch), **or**
- The TC39 decorator standard (or an ecosystem successor to `reflect-metadata`) gains a
  supported mechanism for parameter decoration **and** constructor-parameter type
  reflection sufficient to replace `design:paramtypes`.

The migration cost is high and would land as a major version: re-express parameter
injection without parameter decorators, replace `design:paramtypes`-based DI discovery
(likely explicit dependency tokens), re-validate every decorator against the new semantics,
and ship a before/after migration guide. Until such a trigger exists, staying on the legacy
dialect is the correct, lower-risk choice.

## Alternatives considered

- **Adopt TC39 Stage-3 decorators now.** Rejected: no parameter decorators and no
  metadata emission means the DI + parameter-injection model cannot be expressed.
- **Drop decorators for a typed functional-builder API.** Rejected for this line: it would
  discard the NestJS-familiar ergonomics that are the point of the class-based feature. It
  remains a possible direction for a future major, to be explored via RFC.
