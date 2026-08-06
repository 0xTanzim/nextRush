# Modules

A module groups a feature's controllers, providers, and imported sub-modules behind one
registration entry point. Instead of registering ten controllers and a dozen services at the app
top level, you declare them once on a `@Module` class and let `registerModule` wire the whole
graph in one call.

Modules are a **composition unit over the registrar** — `@Module` records metadata, and
`registerModule` walks it, registers providers into the DI container, then hands the flattened
controller list to the existing `registerControllers` pipeline. They add no second framework.

## Declaring a module

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
| `exports` | `Function[]` | Providers visible to importers |

> `exports` is captured for future per-module encapsulation and **not enforced today** — every
> provider registered anywhere is currently resolvable everywhere. Record it now so the contract
> is explicit when encapsulation lands.

## Providers

A provider is either a bare class or a full config. A bare class registers with its declared
`@Service` scope (or `singleton` if undecorated). A config picks one of the three forms, exactly:

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

## Registering the graph

```ts
import { createApp, serve } from 'nextrush';
import { registerModule } from 'nextrush/class';

const app = createApp();
await registerModule(app, UserModule, { prefix: '/api' });

await serve(app, { port: 8080 });
```

`registerModule(app, RootModule, options?)` walks `imports` transitively, registers every
module's providers into one container, and registers all controllers across the graph. The same
options that apply to `registerControllers` apply here — minus discovery, since the module graph
replaces `root`/`controllers`:

| Option | Meaning |
| ------ | ------- |
| `prefix` | Prefix prepended to every route |
| `middleware` | Global middleware for all module routes |
| `container` | Explicit container (wins over everything) |
| `isolate` | Give the module graph a fresh, isolated container |
| `validate` | Eagerly resolve every controller at boot (default `true`) |
| `debug` | Log registration to stderr |

## Container selection

The container is chosen once, in order: an explicit `options.container` wins, then `isolate`
gets a fresh container, then `app.container`, then the global container. The chosen container is
passed explicitly through to `registerControllers`, so providers and controllers always share
one graph — even under `isolate: true`.

## Errors teach

Passing a non-module class as the root or in `imports` throws `NotAModuleError`. A provider
config with zero or multiple `use*` forms throws with the token name and a fix hint.

## Next steps

- [Dependency Injection](Dependency-Injection) — what module providers register into
- [Controllers and Decorators](Controllers-and-Decorators) — the pipeline modules plug into
- Modules reference: https://0xtanzim.github.io/nextRush/docs/reference/class/modules
- Modules concept guide: https://0xtanzim.github.io/nextRush/docs/concepts/modules
