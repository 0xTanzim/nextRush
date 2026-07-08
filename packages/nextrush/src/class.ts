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

// Side-effect: ensure reflect-metadata polyfill is loaded for DI/decorators.
// This runs once when 'nextrush/class' is imported — no manual import needed.
import 'reflect-metadata';

// ============================================
// DI: Dependency Injection Container
// ============================================
export {
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
export {
  // Decorators
  All,
  Body,
  Controller,
  Module,
  createCustomParamDecorator,
  Ctx,
  Delete,
  Get,
  Head,
  Header,
  HttpCode,
  Options,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Redirect,
  Req,
  Res,
  SetHeader,
  UseGuard,
  Catch,
  UseFilter,
  UseInterceptor,
  isOnInit,
  isOnShutdown,
  getModuleMetadata,
  isModule,
  // Controllers
  registerControllers,
  registerModule,
} from '@nextrush/class';
export type {
  // Decorators
  BodyOptions,
  CanActivate,
  ControllerMetadata,
  ControllerOptions,
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
  RouteMetadata,
  RouteOptions,
  TransformFn,
  OnInit,
  OnShutdown,
  // Controllers
  ControllersOptions,
  ModuleRegistrationOptions,
} from '@nextrush/class';
