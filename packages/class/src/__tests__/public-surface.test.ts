import { describe, it, expect } from 'vitest';
import * as classApi from '../index.js';

/**
 * Public API surface test — locks @nextrush/class exports.
 * If this test fails, the public API has changed.
 * Intentional changes require explicit update to the expected list below.
 */
describe('Public API Surface', () => {
  it('should export exactly the intended public symbols', () => {
    const actualExports = Object.keys(classApi).sort();

    // SEALED: Intentional public runtime API surface
    // Type-only exports (export type { X }) do not appear in Object.keys() — they're compile-time only.
    // This test locks the runtime exports (functions, classes, constants).
    const expectedPublic = [
      // Decorators
      'All',
      'Body',
      'Catch',
      'Controller',
      'Ctx',
      'DECORATOR_METADATA_KEYS',
      'Delete',
      'Get',
      'Head',
      'Header',
      'HttpCode',
      'Module',
      'Options',
      'Param',
      'Patch',
      'Post',
      'Put',
      'Query',
      'Redirect',
      'Req',
      'Res',
      'SetHeader',
      'UseFilter',
      'UseGuard',
      'UseInterceptor',
      'createCustomParamDecorator',

      // Metadata readers (runtime functions)
      'getAllFilters',
      'getAllGuards',
      'getAllInterceptors',
      'getAllParamMetadata',
      'getCatchTypes',
      'getClassDiagnostics',
      'getClassFilters',
      'getClassGuards',
      'getClassInterceptors',
      'getConstructorParamTypes',
      'getControllerDefinition',
      'getControllerMetadata',
      'getControllersFromResults',
      'getErrorsFromResults',
      'getHttpCode',
      'getMethodFilters',
      'getMethodGuards',
      'getMethodInterceptors',
      'getParamMetadata',
      'getRedirectMetadata',
      'getResponseHeaders',
      'getRouteMetadata',
      'isController',

      // Module API
      'getModuleMetadata',
      'isModule',

      // Lifecycle
      'isOnInit',
      'isOnShutdown',

      // Types (runtime functions/constants)
      'isGuardClass',
      'isValidHttpMethod',
      'isValidParamSource',

      // Controllers & Registration
      'ControllerRegistry',
      'buildRoutes',
      'collectModuleControllers',
      'collectModuleGraph',
      'discoverControllers',
      'registerControllers',
      'registerModule',

      // Discovery
      'FilesystemSource',
      'MemorySource',

      // Errors
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

      // DI (re-exported from @nextrush/di)
      'Repository',
      'Service',
      'container',
      'createContainer',
      'inject',
    ].sort();

    // Assertion: actual exports must match expected exactly
    expect(actualExports).toEqual(expectedPublic);
  });
});
