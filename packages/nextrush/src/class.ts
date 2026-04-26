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
 * import { Controller, Get, Service, controllersPlugin } from 'nextrush/class';
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
 * app.plugin(controllersPlugin({ root: './src' }));
 * listen(app, 3000);
 * ```
 */

// Side-effect: ensure reflect-metadata polyfill is loaded for DI/decorators.
// This runs once when 'nextrush/class' is imported — no manual import needed.
import 'reflect-metadata';

// ============================================
// DI: Dependency Injection Container
// ============================================
export {
  AutoInjectable,
  Config,
  container,
  createContainer,
  delay,
  inject,
  Injectable,
  Optional,
  Repository,
  Service,
} from '@nextrush/di';
export type {
  ClassProvider,
  ConfigOptions,
  ContainerInterface,
  FactoryProvider,
  Provider,
  Scope,
  ServiceOptions,
  Token,
  ValueProvider,
} from '@nextrush/di';

// ============================================
// DECORATORS: Controller, Route & Parameter
// ============================================
export {
  // Route decorators
  All,
  // Parameter decorators
  Body,
  // Class decorators
  Controller,
  // Custom param decorator factory
  createCustomParamDecorator,
  Ctx,
  Delete,
  Get,
  Head,
  Header,
  Options,
  Param,
  Patch,
  Post,
  Put,
  Query,
  // Response decorators
  Redirect,
  Req,
  Res,
  SetHeader,
  // Guard decorators
  UseGuard,
} from '@nextrush/decorators';
export type {
  BodyOptions,
  CanActivate,
  ControllerMetadata,
  ControllerOptions,
  CustomParamExtractor,
  GuardContext,
  GuardFn,
  HeaderOptions,
  ParamMetadata,
  ParamOptions,
  ParamSource,
  QueryOptions,
  RouteMetadata,
  RouteOptions,
  TransformFn,
} from '@nextrush/decorators';

// ============================================
// CONTROLLERS: Auto-discovery Plugin
// ============================================
export { controllersPlugin } from '@nextrush/controllers';
export type { ControllersPluginOptions } from '@nextrush/controllers';
