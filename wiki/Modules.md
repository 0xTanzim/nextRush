# Modules

A module groups a feature's controllers and providers behind **one declaration**, and the class runtime is structured **module-first**: you declare each feature (`users`, `billing`, `orders`) as a `@Module` class, compose those features into a root `AppModule`, and a single `registerModule` call wires the whole graph. Instead of registering ten controllers and a dozen services at the app top level, you declare each feature once and let the framework walk the graph.

Modules are a **composition unit over the registrar** — `@Module` records metadata, and `registerModule` walks it, registers every module's providers into the DI container, then hands the flattened controller list to the existing `registerControllers` pipeline. They add no second framework.

## Why modules: making feature boundaries explicit

A small class-based app registers a flat list of controllers, and each controller's services register themselves through `@Service`. That works until the app grows a `users` feature and a `billing` feature side by side:

```ts
// Every feature's controllers get flattened into one list — no boundary between them.
await registerControllers(app, {
  controllers: [UserController, BillingController],
});
```

`UserController` and `BillingController` sit in the same array with no marker that they belong to different features. "Which controllers belong to billing?" becomes a question answered by reading source, not reading a declaration. A module turns that invisible boundary into something the framework can read and compose.

## Declaring a feature module

```ts
import { Module } from 'nextrush/class';

@Module({
  imports: [BillingModule],                  // other @Module classes to compose
  controllers: [UserController],             // @Controller classes owned here
  providers: [UserService, { provide: 'CONFIG', useValue: cfg }],
  exports: [UserService],
})
class UserModule {}
```

| Option | Type | Meaning |
| ------ | ---- | ------- |
| `imports` | `Function[]` | Other `@Module` classes this module composes |
| `controllers` | `Function[]` | `@Controller` classes owned by this module |
| `providers` | `ModuleProvider[]` | Services/values/factories to register |
| `exports` | `Function[]` | Providers the module *intends* to share with importers |

## Composing an app: the root module

A class-based app is a **root module** — conventionally named `AppModule` — that imports every feature module. Composition is declarative, not a growing flat array:

```ts
@Module({
  imports: [UserModule, BillingModule],
})
class AppModule {}
```

```
                 AppModule  (one registerModule call)
        ┌─────────────┴────────────┬─────────────┐
        ▼                          ▼             ▼
   UserModule                 BillingModule  OrdersModule
   controllers: UserController  controllers:  controllers:
   providers:   UserService     BillingController  imports: UserModule
                                providers:   BillingService  providers: OrderService
```

Each feature owns its controllers and providers; `imports` declares how features depend on each other (`OrdersModule` needs `UserModule`). `registerModule` reads this graph instead of a hand-maintained list.

## Registering the graph

```ts
import { createApp, serve } from 'nextrush';
import { registerModule } from 'nextrush/class';

const app = createApp();
await registerModule(app, AppModule, { prefix: '/api' });

await serve(app, { port: 8080 });
```

`registerModule(app, RootModule, options?)` walks `imports` transitively, registers every module's providers into one container, and registers all controllers across the graph. The same options that apply to `registerControllers` apply here — minus discovery, since the module graph replaces `root`/`controllers`:

| Option | Meaning |
| ------ | ------- |
| `prefix` | Prefix prepended to every route |
| `middleware` | Global middleware for all module routes |
| `container` | Explicit container (wins over everything) |
| `isolate` | Give the module graph a fresh, isolated container |
| `validate` | Eagerly resolve every controller at boot (default `true`) |
| `debug` | Log registration to stderr |

Everything `registerControllers` provides still applies: eager validation, guard validation, [lifecycle-hook bridging](Lifecycle), [request-scope bubbling](Request-Scope), and per-app `isolate`. Modules are a composition layer in front of that pipeline — no route building or validation logic is duplicated.

## Container selection

The container is chosen once, in order: an explicit `options.container` wins, then `isolate` gets a fresh container, then `app.container`, then the global container. The chosen container is passed explicitly through to `registerControllers`, so providers and controllers always share one graph — even under `isolate: true`.

## How the import graph is walked

`registerModule` walks `imports` with three guarantees:

- **Post-order.** An imported module registers *before* the module that imports it, so a feature's providers and controllers are ready before the app's.
- **Diamond imports register once.** Two modules importing the same third module (and duplicate listings) include it exactly once.
- **Import cycles are guarded, not recursed.** A mutual `A imports B imports A` terminates instead of looping forever.

## Providers

A provider is either a bare class or a full config. A bare class registers with its declared `@Service` scope (or `singleton` if undecorated). A config picks one of the three forms, exactly:

```ts
providers: [
  UserService,                               // useClass, @Service scope
  { provide: 'CONFIG', useValue: cfg },      // constant; scope ignored
  {
    provide: EmailClient,                    // factory, tokens injected in order
    useFactory: (smtpUrl) => new EmailClient(smtpUrl),
    inject: ['SMTP_URL'],
  },
],
```

Class and factory providers default to `singleton`; set `scope` to override.

## Modules group — they don't encapsulate (yet)

`exports` is captured as metadata for future per-module encapsulation, but **nothing enforces it today**: every provider registered anywhere in one `registerModule` graph is resolvable from anywhere in that same graph, `exports` or not. Record it now so the contract is explicit when true encapsulation lands. If you need real isolation today, use a separate `registerModule`/`registerControllers` call with `isolate: true` — that gives that call its own container.

## Errors teach

Passing a non-module class as the root or in `imports` throws `NotAModuleError`. A provider config with zero or multiple `use*` forms throws with the token name and a fix hint.

## Next steps

- [Dependency Injection](Dependency-Injection) — what module providers register into
- [Request Scope](Request-Scope) — request-scoped services inside a module's graph
- [Lifecycle](Lifecycle) — `onInit`/`onShutdown` hooks on services in the graph
- [Controllers and Decorators](Controllers-and-Decorators) — the pipeline modules plug into
- Modules reference: https://0xtanzim.github.io/nextRush/docs/reference/class/modules
- Modules concept guide: https://0xtanzim.github.io/nextRush/docs/concepts/modules
