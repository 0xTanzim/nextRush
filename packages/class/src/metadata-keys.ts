/**
 * @nextrush/decorators - Metadata Keys & Runtime Helpers
 *
 * The reflect-metadata storage keys plus the runtime type-guard helpers that
 * back the decorator implementations. These are the only runtime values in the
 * type layer — everything else in the sibling *-types modules is type-only.
 */

import type { Guard, Constructor, CanActivate } from './guard-types.js';
import type { ParamSource } from './param-types.js';
import type { RouteMethods } from './route-types.js';

/**
 * Metadata keys used for decorator storage
 */
export const DECORATOR_METADATA_KEYS = {
  CONTROLLER: Symbol.for('nextrush:controller'),
  MODULE: Symbol.for('nextrush:module'),
  ROUTES: Symbol.for('nextrush:routes'),
  PARAMS: Symbol.for('nextrush:params'),
  MIDDLEWARE: Symbol.for('nextrush:middleware'),
  GUARDS: Symbol.for('nextrush:guards'),
  INTERCEPTORS: Symbol.for('nextrush:interceptors'),
  FILTERS: Symbol.for('nextrush:filters'),
  CATCH: Symbol.for('nextrush:catch'),
  RESPONSE_HEADERS: Symbol.for('nextrush:response-headers'),
  REDIRECT: Symbol.for('nextrush:redirect'),
  HTTP_CODE: Symbol.for('nextrush:http-code'),
} as const;

/**
 * Type guard to check if a value is a valid HTTP method
 */
export function isValidHttpMethod(method: string): method is RouteMethods {
  return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(method);
}

/**
 * Type guard to check if a value is a valid param source
 */
export function isValidParamSource(source: string): source is ParamSource {
  return ['body', 'query', 'param', 'header', 'ctx', 'req', 'res', 'custom'].includes(source);
}

/**
 * Type guard to check if a guard is a class (constructor) rather than a function.
 *
 * This checks if the guard has a prototype with the canActivate method defined,
 * which indicates it's a class implementing CanActivate rather than a function.
 */
export function isGuardClass(guard: Guard): guard is Constructor<CanActivate> {
  // Check if it's a function (both classes and functions are typeof 'function')
  if (typeof guard !== 'function') {
    return false;
  }

  // Check if it has a prototype with canActivate method
  // Arrow functions and regular functions won't have canActivate on their prototype
  const proto = guard.prototype;
  if (!proto || typeof proto !== 'object') {
    return false;
  }

  // Check if canActivate is defined on the prototype (class method)
  return typeof proto.canActivate === 'function';
}
