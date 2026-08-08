# Diagnostics

The class runtime can capture an **introspection report** of everything it registered — routes, providers, duplicate-route collisions, circular dependencies, and bootstrap timing — so you can debug and inspect a class-based app. Diagnostics are **opt-in and zero-cost when disabled**: when `diagnostics` is not set, no timings are measured, no report is collected, and nothing is stored.

## Enabling

Turn it on in `registerControllers`:

```ts
import { createApp } from 'nextrush';
import { registerControllers, getClassDiagnostics } from 'nextrush/class';

const app = createApp();
await registerControllers(app, {
  controllers: [UserController],
  diagnostics: true,
});

const report = getClassDiagnostics(app);   // DiagnosticsReport | undefined
```

`getClassDiagnostics(app)` returns the report after registration completes, or `undefined` if diagnostics were not enabled.

## What the report contains

The `DiagnosticsReport` is a read-only snapshot with five fields:

| Field | Type | Holds |
| ----- | ---- | ----- |
| `routes` | `RouteEntry[]` | Every registered route: `method`, `path` (prefix applied), `controller` |
| `providers` | `ProviderEntry[]` | Every provider in the DI graph: `token`, `dependencies` |
| `duplicateRoutes` | `DuplicateRoute[]` | Routes registered more than once (method + path collision), with the registration `count` |
| `circularDependencies` | `CircularDependency[]` | Cycles in the provider graph, as an array of tokens |
| `timings` | `TimingEntry[]` | Bootstrap stage name + duration in ms |

```ts
const { routes, duplicateRoutes, timings } = getClassDiagnostics(app)!;

for (const route of routes) {
  console.log(route.method, route.path);
}

for (const dup of duplicateRoutes) {
  console.warn(`Duplicate: ${dup.method} ${dup.path} (${dup.count}x)`);
}
```

## When to use it

- **Debugging** — confirm which routes and providers actually registered, and how long each bootstrap stage took.
- **Dev tooling** — a scoreboard, a route table, or a startup-profile dump.
- **Detecting collisions** — spot duplicate routes and provider cycles at build time instead of at request time.

The report is keyed to the `Application` instance, so inspect the same `app` object you registered into.

## Related

- [Controllers and Decorators](Controllers-and-Decorators) — the registration options and lifecycle
- [Modules](Modules) — module composition (register via `registerControllers` underneath)
- [Architecture](Architecture) — where the class runtime sits over the functional core
- Diagnostics reference: https://0xtanzim.github.io/nextRush/docs/reference/class/controllers
