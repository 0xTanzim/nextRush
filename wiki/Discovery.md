# Discovery

Instead of hand-listing every controller at the app top level, `registerControllers` can **scan a directory and find your `@Controller` classes automatically**. Discovery is a layer in front of registration: it finds controller classes, and the registrar registers them.

## Auto-discovery with `root`

Pass `root` and the registrar scans that directory for controller files:

```ts
import { createApp, listen } from 'nextrush';
import { registerControllers } from 'nextrush/class';

const app = createApp();
await registerControllers(app, { root: './src', prefix: '/api' });
await listen(app, 8080);
```

Only files matching the `*.controller.*` naming convention are imported by default — `user.controller.ts`, `orders.controller.ts`. Non-controller modules (services, guards, repositories) still load transitively through the controllers that import them, so their `@Service` / `@Repository` registration side-effects still fire.

## Options

| Option | Type | Default | Meaning |
| ------ | ---- | ------- | ------- |
| `root` | `string` | — | Directory to scan; enables auto-discovery |
| `controllers` | `Function[]` | `[]` | Explicit classes; merged with `root` discovery |
| `include` | `string[]` | `['**/*.controller.ts', '**/*.controller.js']` | Glob patterns for discovery |
| `exclude` | `string[]` | tests / `node_modules` / `dist` | Patterns excluded |
| `prefix` | `string` | `''` | Prefix prepended to every route |
| `strict` | `boolean` | `false` | Throw on discovery errors instead of logging |
| `debug` | `boolean` | `false` | Log discovery/registration to stderr |

To restore scan-**every**-source-file behavior (the pre-v3.2 default), pass `include: ['**/*.ts', '**/*.js']`.

> **Side-effect:** discovery dynamically `import()`s every matched file, running its top-level code. This is load-bearing for DI registration, but prefer a narrow `root`/`include` or an explicit `controllers` list when a source file has other side-effects.

## Explicit lists: no filesystem scan

The `controllers` option is a first-class alternative — greppable registration, deterministic order, and no scan at all. It's the right call for tests, bundled builds, and serverless/edge deployments:

```ts
await registerControllers(app, {
  controllers: [UserController, BillingController],
});
```

## Discovery sources

For full programmatic control, `registerControllers` accepts a `source` — an object with a `discover(): ClassRef[]` method. Two ship with the package, both exported from `nextrush/class`:

| Source | Behavior | Best for |
| ------ | -------- | -------- |
| `FilesystemSource(root, include, exclude, debug)` | The same file-scanning discovery used by `root`, wrapped as a source | Matching `root` behavior programmatically |
| `MemorySource(controllers)` | Returns an explicit list of classes | Tests, programmatic wiring |

```ts
import { registerControllers, MemorySource } from 'nextrush/class';

await registerControllers(app, {
  source: new MemorySource([UserController, BillingController]),
});
```

The `source` takes precedence over `root` and is incompatible with `controllers`.

## The low-level API

If you want discovery without registration, `discoverControllers` returns per-file results you can inspect:

```ts
import {
  discoverControllers,
  getControllersFromResults,
  getErrorsFromResults,
} from 'nextrush/class';

const results = await discoverControllers({ root: './src' });
const controllers = getControllersFromResults(results);  // found @Controller classes
const errors = getErrorsFromResults(results);            // per-file discovery errors
```

## Runtime compatibility

The filesystem source (`root`, `FilesystemSource`) uses Node APIs and is **Node-only**. On Bun, Deno, and edge runtimes, register with an explicit `controllers` list or a `MemorySource`. The decorator, DI, and request pipeline are universal — only the file scan is Node-specific.

## Next steps

- [Controllers and Decorators](Controllers-and-Decorators) — what discovery finds and how it's registered
- [Modules](Modules) — a module graph replaces discovery entirely
- [Testing](Testing) — register an explicit `controllers` list or `MemorySource` in tests
- Discovery reference: https://0xtanzim.github.io/nextRush/docs/reference/class/controllers
