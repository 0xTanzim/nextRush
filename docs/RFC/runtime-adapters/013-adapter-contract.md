# RFC — Enforced Adapter Contract (`ServerAdapter` / `FetchAdapter` + `AdapterContextFactory`)

> Status: Accepted · Change: `harden-runtime-edge-serverless` (Task group 1)
> Supersedes the informal `[FORMALIZED]` state in `docs/audits/07-runtime-architecture.md`.

## Summary

NextRush already exports two adapter contract types from `@nextrush/types`
(`ServerAdapter`, `FetchAdapter`, `ServerHandle`, `ServerAddress`, `HandlerOptions`,
`FetchHandlerOptions`, `FetchHandler`). They were documented and satisfiable, but **not
enforced**: no shipped adapter proved conformance at compile time, so `serve` /
`createHandler` / `createFetchHandler` could drift silently across `node` / `bun` / `deno` /
`edge`. This RFC ratifies the contract as **enforced** by adding a per-adapter compile-time
`satisfies` guard, and formalizes the shared context-factory shape as `AdapterContextFactory`.

## Motivation

The two-tier adapter model is the framework's ten-year bet (audit `07`, ADR-R2). A contract
that is documented but unenforced is a convention, not a guarantee — an edited adapter can
widen the surface or change a signature with no signal until a downstream break. This is the
lowest-cost point to lock it (before adoption freezes the import paths at v1).

## Design

- **No new *runtime* API.** The contract types already exist and are already exported; this
  RFC adds enforcement, not surface — with one small additive type export
  (`AdapterContextFactory`).
- **Per-adapter conformance guard.** Each adapter module includes a non-exported
  `satisfies` const proving its server-/fetch-style surface conforms:

  ```ts
  // node/bun/deno
  const _serverAdapterConformance = { serve, createHandler } satisfies ServerAdapter<
    Application,
    ServeOptions,
    ServerInstance
  >;
  void _serverAdapterConformance;

  // edge
  const _fetchAdapterConformance = { createFetchHandler } satisfies FetchAdapter<Application>;
  void _fetchAdapterConformance;
  ```

  A signature drift (missing method, wrong return type, widened `Context`) now fails `tsc` in
  the adapter package itself, at authoring time — before any test runs.

- **`AdapterContextFactory`.** A generic shape formalizing "given platform inputs, produce an
  `AdapterContext` over the shared `Context`":

  ```ts
  export type AdapterContextFactory<
    Args extends readonly unknown[],
    Ctx extends AdapterContext = AdapterContext,
  > = (...args: Args) => Ctx;
  ```

  Node binds `[IncomingMessage, ServerResponse, NodeContextOptions?]`; edge binds
  `[Request, EdgeContextOptions?]`. This pins the "adapters build `Context` via a factory and
  run `app.callback()`" invariant at the type level.

## Alternatives considered

- **Runtime `assertAdapter()`** — rejected: only fails at boot, not at authoring; adds cost.
- **Abstract base class** — rejected: forces inheritance, conflicts with the two distinct
  shapes and the function-style adapter exports.
- **Leave in each adapter package** — rejected: no single source of truth; drift returns.

## Compatibility

**Additive / non-breaking** for consumers: the guards are non-exported; the only new public
symbol is the `AdapterContextFactory` *type*. Existing adapter APIs (`serve`/`createHandler`/
`listen`/`createFetchHandler`) are unchanged. (The proposal listed the contract export as a
BREAKING candidate assuming the types were new; they already ship, so this lands additive.)

## Verification

- `pnpm --filter @nextrush/types test` (positive + `@ts-expect-error` negative shape tests).
- `pnpm typecheck` across the four adapters (guards compile; a seeded drift fails).
- The behavioral conformance suite (`@nextrush/adapter-conformance`) remains the parity oracle.
