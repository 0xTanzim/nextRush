/**
 * @nextrush/controllers - Public API surface test
 *
 * DEPRECATED compatibility shim (re-exports @nextrush/class) — locks the
 * exported symbol set from `src/index.ts` exactly as it stands today. This is
 * NOT an endorsement of the surface; it's the prerequisite for a safe removal
 * (gap-checklist T053) — you can't remove or codemod a surface you haven't
 * first locked. If this test fails, the shim's re-export surface has changed.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as controllersApi from '../index';
import { ControllerRegistry, ControllerError, ControllerResolutionError, DiscoveryError, GuardRejectionError, HttpError, MissingParameterError, NoRoutesError, NotAControllerError, NotAModuleError, ParameterInjectionError, RouteRegistrationError } from '../index';
import type { BuiltRoute, ControllersOptions, DiscoveryOptions, DiscoveryResult, RegisteredController, ResolvedOptions } from '../index';
import type { ModuleRegistrationOptions } from '../index';
import type { ExceptionFilter, GuardContext, GuardFn, Interceptor, ModuleOptions, ModuleProvider, ModuleProviderConfig, OnInit, OnShutdown } from '../index';
import type { Container } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(controllersApi).sort();

    // SEALED: locked back-compat re-export surface from @nextrush/class + @nextrush/di.
    const expectedRuntime = [
      'registerControllers',
      'registerModule',
      'collectModuleControllers',
      'collectModuleGraph',
      'discoverControllers',
      'getControllersFromResults',
      'getErrorsFromResults',
      'ControllerRegistry',
      'buildRoutes',
      'ControllerError',
      'ControllerResolutionError',
      'DiscoveryError',
      'GuardRejectionError',
      'HttpError',
      'MissingParameterError',
      'NoRoutesError',
      'NotAControllerError',
      'NotAModuleError',
      'ParameterInjectionError',
      'RouteRegistrationError',
      'Body',
      'Controller',
      'Ctx',
      'Catch',
      'Delete',
      'Get',
      'Header',
      'Module',
      'Param',
      'Patch',
      'Post',
      'Put',
      'Query',
      'UseFilter',
      'UseGuard',
      'UseInterceptor',
      'getModuleMetadata',
      'isModule',
      'isOnInit',
      'isOnShutdown',
      'Repository',
      'Service',
      'container',
      'createContainer',
      'inject',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(typeof ControllerRegistry).toBe('function');
    expect(typeof ControllerError).toBe('function');
    expect(typeof ControllerResolutionError).toBe('function');
    expect(typeof DiscoveryError).toBe('function');
    expect(typeof GuardRejectionError).toBe('function');
    expect(typeof HttpError).toBe('function');
    expect(typeof MissingParameterError).toBe('function');
    expect(typeof NoRoutesError).toBe('function');
    expect(typeof NotAControllerError).toBe('function');
    expect(typeof NotAModuleError).toBe('function');
    expect(typeof ParameterInjectionError).toBe('function');
    expect(typeof RouteRegistrationError).toBe('function');
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [
      BuiltRoute,
      ControllersOptions,
      DiscoveryOptions,
      DiscoveryResult,
      RegisteredController,
      ResolvedOptions,
      ModuleRegistrationOptions,
      ExceptionFilter,
      GuardContext,
      GuardFn,
      Interceptor,
      ModuleOptions,
      ModuleProvider,
      ModuleProviderConfig,
      OnInit,
      OnShutdown,
      Container,
    ];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
