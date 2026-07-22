/**
 * NextRush Class-Based API — Decorators, DI, and Controllers
 *
 * Import from `nextrush/class` when using the class-based paradigm.
 * This entry point auto-loads `reflect-metadata` and re-exports all
 * DI, decorator, and controller APIs in a single import.
 *
 * Functional users who only need `createApp` / `createRouter` should
 * import from `nextrush` (the default entry) — no reflect-metadata overhead.
 *
 * @packageDocumentation
 * @module nextrush/class
 *
 * @example
 * ```typescript
 * import { createApp, listen } from 'nextrush';
 * import { Controller, Get, Service, registerControllers } from 'nextrush/class';
 *
 * @Service()
 * class UserService {
 *   findAll() { return [{ id: 1, name: 'Alice' }]; }
 * }
 *
 * @Controller('/users')
 * class UserController {
 *   constructor(private users: UserService) {}
 *
 *   @Get()
 *   findAll() { return this.users.findAll(); }
 * }
 *
 * const app = createApp();
 * await registerControllers(app, { root: './src' });
 * await listen(app, 8080);
 * ```
 */

// ============================================
// OPTIONAL-PEER LOADING (framework-composition-integrity)
// ============================================
//
// @nextrush/class, @nextrush/di, and reflect-metadata are OPTIONAL peer dependencies of
// `nextrush` (see docs/RFC/framework-composition/020-framework-composition-integrity.md) — a
// functional-only install never resolves them. A STATIC `export { X } from '@nextrush/class'`
// would fail module LINKING (before any module body runs) with an opaque Node error the moment
// that package is unresolvable — there is no way to catch a static specifier's resolution
// failure from inside the module. So every RUNTIME (value) export below is loaded dynamically
// and re-exported by re-assignment, letting this try/catch convert a missing-peer failure into
// an actionable message. `export type` declarations stay static: type-only specifiers are
// erased before runtime and never cause a module-resolution failure, so they are unaffected.
import { describeMissingClassPeerError } from './class-peer-guard.js';

type DiModule = typeof import('@nextrush/di');
type ClassModule = typeof import('@nextrush/class');

let di: DiModule;
let cls: ClassModule;

try {
  await import('reflect-metadata');
  di = await import('@nextrush/di');
  cls = await import('@nextrush/class');
} catch (err) {
  const guardedMessage = describeMissingClassPeerError(err);
  throw guardedMessage ? new Error(guardedMessage, { cause: err }) : err;
}

// ============================================
// DI: Dependency Injection Container
// ============================================
export const Config = di.Config;
export const container = di.container;
export const createContainer = di.createContainer;
export const delay = di.delay;
export const inject = di.inject;
export const Injectable = di.Injectable;
export const Optional = di.Optional;
export const Repository = di.Repository;
export const Service = di.Service;

export type {
  ClassProvider,
  ConfigOptions,
  Container,
  FactoryProvider,
  Provider,
  Scope,
  ServiceOptions,
  Token,
  ValueProvider,
} from '@nextrush/di';

// ============================================
// DECORATORS & CONTROLLERS: From @nextrush/class
// ============================================
export const All = cls.All;
export const Body = cls.Body;
export const Controller = cls.Controller;
export const Module = cls.Module;
export const createCustomParamDecorator = cls.createCustomParamDecorator;
export const Ctx = cls.Ctx;
export const Delete = cls.Delete;
export const Get = cls.Get;
export const Head = cls.Head;
export const Header = cls.Header;
export const HttpCode = cls.HttpCode;
export const Options = cls.Options;
export const Param = cls.Param;
export const Patch = cls.Patch;
export const Post = cls.Post;
export const Put = cls.Put;
export const Query = cls.Query;
export const Redirect = cls.Redirect;
export const Req = cls.Req;
export const Res = cls.Res;
export const SetHeader = cls.SetHeader;
export const UseGuard = cls.UseGuard;
export const Catch = cls.Catch;
export const UseFilter = cls.UseFilter;
export const UseInterceptor = cls.UseInterceptor;
export const isOnInit = cls.isOnInit;
export const isOnShutdown = cls.isOnShutdown;
export const getModuleMetadata = cls.getModuleMetadata;
export const isModule = cls.isModule;
export const registerControllers = cls.registerControllers;
export const registerModule = cls.registerModule;

export type {
  // Decorators
  BodyOptions,
  CanActivate,
  ControllerMetadata,
  ControllerOptions,
  ControllerRouteMetadata,
  CustomParamExtractor,
  ExceptionFilter,
  GuardContext,
  GuardFn,
  HeaderOptions,
  Interceptor,
  ModuleMetadata,
  ModuleOptions,
  ModuleProvider,
  ModuleProviderConfig,
  ParamMetadata,
  ParamOptions,
  ParamSource,
  QueryOptions,
  /** @deprecated Use ControllerRouteMetadata. Removed in the next major. */
  RouteMetadata,
  RouteOptions,
  TransformFn,
  OnInit,
  OnShutdown,
  // Controllers
  ControllersOptions,
  ModuleRegistrationOptions,
} from '@nextrush/class';
