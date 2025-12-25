/**
 * @nextrush/decorators - Class Decorators
 *
 * Controller decorator that marks a class as an HTTP controller.
 * Automatically makes the class injectable for DI (wraps @singleton from tsyringe).
 * Uses legacy decorators for compatibility with parameter decorators.
 */

import 'reflect-metadata';
import { singleton as tsySingleton } from 'tsyringe';
import type { ControllerMetadata, ControllerOptions } from './types.js';
import { DECORATOR_METADATA_KEYS } from './types.js';

/**
 * Marks a class as an HTTP controller with automatic DI registration.
 *
 * This decorator:
 * 1. Registers the class as an HTTP controller with route metadata
 * 2. Makes the class injectable as a singleton (wraps tsyringe's @singleton)
 *
 * You do NOT need to add @Service() when using @Controller() - it's included!
 *
 * @param pathOrOptions - Base path string or controller options
 * @returns Class decorator
 *
 * @example
 * ```typescript
 * // Simple path - DI is automatic!
 * @Controller('/users')
 * class UserController {
 *   constructor(private userService: UserService) {}  // Auto-injected
 * }
 *
 * // With options
 * @Controller({ path: '/users', version: 'v1' })
 * class UserController { }
 *
 * // Default path (uses class name)
 * @Controller()
 * class UserController { }  // → '/user'
 * ```
 */
export function Controller(pathOrOptions?: string | ControllerOptions): ClassDecorator {
  return function controllerDecorator<TFunction extends Function>(target: TFunction): TFunction {
    const options = normalizeControllerOptions(pathOrOptions, target.name);

    const metadata: ControllerMetadata = {
      path: options.path ?? '/',
      version: options.version,
      middleware: options.middleware,
      tags: options.tags,
    };

    // Store controller metadata
    Reflect.defineMetadata(DECORATOR_METADATA_KEYS.CONTROLLER, metadata, target);

    // Make the class injectable as singleton (same as @Service())
    // This allows constructor injection without needing separate @Service() decorator
    tsySingleton()(target as unknown as new (...args: unknown[]) => unknown);

    return target;
  };
}

/**
 * Normalize controller options from string or object input.
 */
function normalizeControllerOptions(input: string | ControllerOptions | undefined, className: string): ControllerOptions {
  if (typeof input === 'string') {
    return { path: normalizePath(input) };
  }

  if (input && typeof input === 'object') {
    return {
      ...input,
      path: input.path ? normalizePath(input.path) : derivePathFromClassName(className),
    };
  }

  return { path: derivePathFromClassName(className) };
}

/**
 * Derive a path from class name by removing 'Controller' suffix and converting to kebab-case.
 *
 * @example
 * UserController → /user
 * UserProfileController → /user-profile
 * APIController → /api
 */
function derivePathFromClassName(className: string): string {
  const baseName = className.replace(/Controller$/i, '');

  if (!baseName) {
    return '/';
  }

  const kebabCase = baseName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();

  return `/${kebabCase}`;
}

/**
 * Normalize path to ensure it starts with / and has no trailing /.
 */
function normalizePath(path: string): string {
  let normalized = path.trim();

  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}
