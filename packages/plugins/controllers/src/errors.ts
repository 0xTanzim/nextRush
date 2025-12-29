/**
 * @nextrush/controllers - Error Classes
 *
 * Production-grade error classes with actionable messages.
 * Client errors (4xx) extend HttpError for proper status codes.
 */

import {
  BadRequestError,
  ForbiddenError,
  HttpError,
  InternalServerError,
  type HttpErrorOptions,
} from '@nextrush/errors';

/**
 * Base error class for controller-related server errors.
 * These are 500-level errors that indicate server-side issues.
 *
 * Note: We use `declare` for name/message to help TypeScript's declaration
 * emitter recognize that these are inherited from Error via @nextrush/errors.
 */
export class ControllerError extends InternalServerError {
  declare name: string;
  declare message: string;

  constructor(message: string, code: string, options?: HttpErrorOptions) {
    super(message, { code, ...options });
    this.name = 'ControllerError';
  }
}

/**
 * Error thrown when a class is not a valid controller.
 * This is a server configuration error (500).
 */
export class NotAControllerError extends ControllerError {
  constructor(className: string) {
    super(
      `Class "${className}" is not a controller.\n\n` +
        `To make it a controller, add the @Controller decorator:\n\n` +
        `  import { Controller } from '@nextrush/decorators';\n\n` +
        `  @Controller('/path')\n` +
        `  class ${className} {\n` +
        `    // ...\n` +
        `  }\n`,
      'NOT_A_CONTROLLER'
    );
    this.name = 'NotAControllerError';
  }
}

/**
 * Error thrown when controller has no routes defined.
 * This is a server configuration error (500).
 */
export class NoRoutesError extends ControllerError {
  constructor(className: string) {
    super(
      `Controller "${className}" has no routes defined.\n\n` +
        `Add route decorators to your controller methods:\n\n` +
        `  import { Controller, Get, Post } from '@nextrush/decorators';\n\n` +
        `  @Controller('/users')\n` +
        `  class ${className} {\n` +
        `    @Get()\n` +
        `    findAll() { }\n\n` +
        `    @Post()\n` +
        `    create(@Body() data: CreateDto) { }\n` +
        `  }\n`,
      'NO_ROUTES'
    );
    this.name = 'NoRoutesError';
  }
}

/**
 * Error thrown when file discovery fails.
 * This is a server configuration error (500).
 */
export class DiscoveryError extends ControllerError {
  readonly filePath: string;

  constructor(filePath: string, reason: string, cause?: Error) {
    super(
      `Failed to discover controllers in "${filePath}".\n\n` +
        `Reason: ${reason}\n\n` +
        `Possible fixes:\n` +
        `  1. Ensure the file exists and is accessible\n` +
        `  2. Check for syntax errors in the file\n` +
        `  3. Verify the file exports controller classes\n`,
      'DISCOVERY_ERROR',
      { cause }
    );
    this.name = 'DiscoveryError';
    this.filePath = filePath;
  }
}

/**
 * Error thrown when DI resolution fails for a controller.
 * This is a server configuration error (500).
 */
export class ControllerResolutionError extends ControllerError {
  readonly controllerName: string;

  constructor(controllerName: string, cause?: Error) {
    super(
      `Failed to resolve controller "${controllerName}" from DI container.\n\n` +
        `Possible causes:\n` +
        `  1. Controller is not registered in the DI container\n` +
        `  2. Controller has unresolvable dependencies\n` +
        `  3. Circular dependency detected\n\n` +
        `Note: @Controller automatically registers with DI - no @Service() needed!\n\n` +
        `  import { Controller } from '@nextrush/decorators';\n\n` +
        `  @Controller('/path')\n` +
        `  class ${controllerName} {\n` +
        `    constructor(private readonly service: SomeService) { }\n` +
        `  }\n`,
      'CONTROLLER_RESOLUTION_ERROR',
      { cause }
    );
    this.name = 'ControllerResolutionError';
    this.controllerName = controllerName;
  }
}

/**
 * Error thrown when parameter injection fails.
 * This is a CLIENT error (400) - the request is malformed.
 */
export class ParameterInjectionError extends BadRequestError {
  declare name: string;
  declare message: string;
  readonly controllerName: string;
  readonly methodName: string;
  readonly paramIndex: number;

  constructor(
    controllerName: string,
    methodName: string,
    paramIndex: number,
    reason: string
  ) {
    super(
      `Invalid parameter at index ${paramIndex} for "${controllerName}.${methodName}": ${reason}`,
      {
        code: 'PARAMETER_INJECTION_ERROR',
        details: {
          controller: controllerName,
          method: methodName,
          parameterIndex: paramIndex,
          reason,
        },
      }
    );
    this.name = 'ParameterInjectionError';
    this.controllerName = controllerName;
    this.methodName = methodName;
    this.paramIndex = paramIndex;
  }
}

/**
 * Error thrown when a required parameter is missing.
 * This is a CLIENT error (400) - the request is incomplete.
 */
export class MissingParameterError extends BadRequestError {
  declare name: string;
  declare message: string;
  readonly controllerName: string;
  readonly methodName: string;
  readonly paramName: string;
  readonly source: string;

  constructor(
    controllerName: string,
    methodName: string,
    paramName: string,
    source: string
  ) {
    super(`Required ${source} parameter "${paramName}" is missing`, {
      code: 'MISSING_PARAMETER',
      details: {
        parameter: paramName,
        source,
        controller: controllerName,
        method: methodName,
      },
    });
    this.name = 'MissingParameterError';
    this.controllerName = controllerName;
    this.methodName = methodName;
    this.paramName = paramName;
    this.source = source;
  }
}

/**
 * Error thrown when route registration fails.
 * This is a server configuration error (500).
 */
export class RouteRegistrationError extends ControllerError {
  readonly controllerName: string;
  readonly method: string;
  readonly path: string;

  constructor(
    controllerName: string,
    method: string,
    path: string,
    reason: string,
    cause?: Error
  ) {
    super(
      `Failed to register route ${method} ${path} from controller "${controllerName}".\n\n` +
        `Reason: ${reason}\n`,
      'ROUTE_REGISTRATION_ERROR',
      { cause }
    );
    this.name = 'RouteRegistrationError';
    this.controllerName = controllerName;
    this.method = method;
    this.path = path;
  }
}

/**
 * Error thrown when a guard rejects the request.
 * This is a CLIENT error (403) - access denied.
 */
export class GuardRejectionError extends ForbiddenError {
  declare name: string;
  declare message: string;
  readonly guardName: string;

  constructor(guardName: string, message?: string) {
    super(message ?? 'Access denied', {
      code: 'GUARD_REJECTED',
      details: { guard: guardName },
    });
    this.name = 'GuardRejectionError';
    this.guardName = guardName;
  }
}

/**
 * Re-export HttpError for type checking in consumers
 */
export { HttpError };
