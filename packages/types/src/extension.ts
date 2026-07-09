/**
 * @nextrush/types - Extension contract
 *
 * Extensions are the rare (~0.1%) long-lived runtime services that must attach
 * state to the app, run async boot, and/or tear down on shutdown — an event bus,
 * a database pool, a websocket attach. Most framework features are **middleware**
 * (`app.use`) or plain **registrar** functions, not Extensions.
 *
 * See docs/RFC/RFC-NEXTRUSH-PLUGIN-SYSTEM.md.
 *
 * @packageDocumentation
 */

import type { Middleware } from './context';
import type { Container } from './container';
import type { Logger } from './logger';

/**
 * The subset of `Application` an {@link Extension} may use during `setup()`.
 *
 * Kept structural (not the concrete `Application`) so {@link ExtensionContext}
 * can live in `@nextrush/types` without importing `@nextrush/core`. The
 * `Application` class implements this interface. Routing methods are added here
 * when the app-owned router lands (RFC §11.1).
 */
export interface ExtensionHost {
  /** Register middleware on the application. */
  use(middleware: Middleware): this;
  /** Whether a decoration already occupies `name`. */
  hasDecorator(name: string): boolean;
}

/**
 * The argument passed to {@link Extension.setup}.
 *
 * A context object rather than the bare app, so future fields (`runtime`,
 * `container`, `config`, …) are **additive** and never break existing
 * extensions — the same reason VS Code uses `activate(context)`.
 */
export interface ExtensionContext {
  /** The application instance — add middleware, read decorations. */
  readonly app: ExtensionHost;
  /** The app logger (structured, pluggable). */
  readonly logger: Logger;
  /**
   * The app's DI container, if one was configured (per-app, not a global
   * singleton). Present when the app was created via `nextrush/class` or with
   * `createApp({ container })`; `undefined` for functional, DI-free apps.
   */
  readonly container?: Container;
  /** Environment mode. */
  readonly env: 'development' | 'production' | 'test';
  /** This extension's own name (for scoped diagnostics). */
  readonly name: string;
  /**
   * Attach a value to the app under `name`. The extension-author primitive for
   * exposing app-level surface (e.g. `app.events`). Throws if `name` is already
   * decorated or collides with a core `Application` member.
   */
  decorate(name: string, value: unknown): void;
}

/**
 * A NextRush Extension.
 *
 * Registered via `app.extend()` (queues) and booted once at `app.ready()`
 * (runs `setup` in registration order). Torn down at `app.close()`.
 *
 * @example
 * ```typescript
 * export function events(): Extension {
 *   const emitter = new EventEmitter();
 *   return {
 *     name: 'events',
 *     setup(ctx) { ctx.decorate('events', emitter); },
 *     destroy() { emitter.clear(); },
 *   };
 * }
 * ```
 */
/**
 * @template TDecorated - Shape decorated onto the app by this extension's
 * `setup()`. Phantom — never read at runtime, only carried through the type
 * system so `Application.extend()` can return `this & TDecorated`, giving
 * `app.<decoratedProperty>` static inference with zero `declare module`
 * augmentation. Defaults to `{}` so plain, untyped `Extension` usages
 * (the common case for internal/test extensions) are unaffected.
 *
 * @remarks
 * Two things to know before relying on this:
 *
 * - **TypeScript trusts `TDecorated`, it never verifies it.** Nothing checks
 *   that the declared shape actually matches what `setup()` calls
 *   `ctx.decorate()` with — `Extension<{ foo: Foo }>` whose `setup()` never
 *   decorates `foo` still typechecks, and `app.foo` will be `undefined` at
 *   runtime with no warning. Keep the generic and the `decorate()` call in
 *   sync by hand.
 * - **The inferred type is lost on `let` reassignment.** Chain in one
 *   expression (`const app = createApp().extend(x)`), not
 *   `let app = createApp(); app = app.extend(x);` — TypeScript widens the
 *   reassignment to the `let` binding's originally-inferred type, silently
 *   dropping `TDecorated`. Every example below chains for this reason.
 *
 * @example
 * ```typescript
 * function events<T extends EventMap>(): Extension<{ events: EventEmitter<T> }> {
 *   return {
 *     name: 'events',
 *     setup(ctx) { ctx.decorate('events', new EventEmitter<T>()); },
 *   };
 * }
 *
 * const app = createApp().extend(events<MyEvents>());
 * app.events.emit('user:created', { id: '1' }); // inferred, no cast
 * ```
 */
export interface Extension<TDecorated = Record<string, never>> {
  /** Unique name — used for collision detection, dependency assertion, diagnostics. */
  readonly name: string;
  /**
   * Names of other extensions that MUST already be registered before this one.
   * Asserted at `app.ready()` in registration order — not auto-sorted.
   */
  readonly needs?: readonly string[];
  /** Set up the extension. Runs once, at `app.ready()`, in registration order. */
  setup(ctx: ExtensionContext): void | Promise<void>;
  /** Tear down on `app.close()`. Runs in reverse registration order. */
  destroy?(): void | Promise<void>;
  /**
   * Phantom marker carrying `TDecorated` through the type system. Never set
   * at runtime — `TDecorated` has no inhabitant, so no implementation ever
   * assigns this. Purely what lets `extend()` infer its return type.
   */
  readonly __decorated?: TDecorated;
}
