---
"@nextrush/types": minor
"@nextrush/adapter-node": patch
"@nextrush/adapter-edge": patch
---

Enforce the two-tier adapter contract (RFC-NEXTRUSH-ADAPTER-CONTRACT).

- **`@nextrush/types`**: add the `AdapterContextFactory<Args, Ctx>` type, formalizing the shared "adapters build `Context` via a factory and run `app.callback()`" invariant at the type level. Additive — the existing `ServerAdapter`/`FetchAdapter`/`ServerHandle` contracts are unchanged.
- **Adapters**: add a compile-time context-factory conformance guard to the node (ServerAdapter tier) and edge (FetchAdapter tier) adapters, so a drift in the context factory's return type stops compiling. The pre-existing shape guards (`serve`/`createHandler`/`createFetchHandler`) remain. Internal, non-exported — no public surface change.

Also adds negative type-enforcement tests to `@nextrush/types` proving a malformed adapter (missing method, wrong return type) fails to satisfy the contract.
