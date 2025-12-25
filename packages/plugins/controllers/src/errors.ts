/**
 * @nextrush/controllers - Error Classes
 *
 * Production-grade error classes with actionable messages.
 */

/**
 * Base error class for controller-related errors
 */
export class ControllerError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ControllerError';
    this.code = code;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Error thrown when a class is not a valid controller
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
 * Error thrown when controller has no routes defined
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
 * Error thrown when file discovery fails
 */
export class DiscoveryError extends ControllerError {
  readonly filePath: string;
  readonly cause?: Error;

  constructor(filePath: string, reason: string, cause?: Error) {
    super(
      `Failed to discover controllers in "${filePath}".\n\n` +
        `Reason: ${reason}\n\n` +
        `Possible fixes:\n` +
        `  1. Ensure the file exists and is accessible\n` +
        `  2. Check for syntax errors in the file\n` +
        `  3. Verify the file exports controller classes\n` +
        (cause ? `\nOriginal error: ${cause.message}` : ''),
      'DISCOVERY_ERROR'
    );
    this.name = 'DiscoveryError';
    this.filePath = filePath;
    this.cause = cause;
  }
}

/**
 * Error thrown when DI resolution fails for a controller
 */
export class ControllerResolutionError extends ControllerError {
  readonly controllerName: string;
  readonly cause?: Error;

  constructor(controllerName: string, cause?: Error) {
    super(
      `Failed to resolve controller "${controllerName}" from DI container.\n\n` +
        `Possible causes:\n` +
        `  1. Controller is not registered in the DI container\n` +
        `  2. Controller has unresolvable dependencies\n` +
        `  3. Circular dependency detected\n\n` +
        `To fix, ensure the controller is decorated with @Service or @Controller:\n\n` +
        `  import { Service } from '@nextrush/di';\n` +
        `  import { Controller } from '@nextrush/decorators';\n\n` +
        `  @Controller('/path')\n` +
        `  @Service()\n` +
        `  class ${controllerName} {\n` +
        `    constructor(private readonly service: SomeService) { }\n` +
        `  }\n` +
        (cause ? `\nOriginal error: ${cause.message}` : ''),
      'CONTROLLER_RESOLUTION_ERROR'
    );
    this.name = 'ControllerResolutionError';
    this.controllerName = controllerName;
    this.cause = cause;
  }
}

/**
 * Error thrown when parameter injection fails
 */
export class ParameterInjectionError extends ControllerError {
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
      `Failed to inject parameter at index ${paramIndex} for ` +
        `"${controllerName}.${methodName}".\n\n` +
        `Reason: ${reason}\n\n` +
        `Check that the parameter decorator is correctly applied:\n\n` +
        `  @Get('/:id')\n` +
        `  ${methodName}(@Param('id') id: string) { }\n`,
      'PARAMETER_INJECTION_ERROR'
    );
    this.name = 'ParameterInjectionError';
    this.controllerName = controllerName;
    this.methodName = methodName;
    this.paramIndex = paramIndex;
  }
}

/**
 * Error thrown when a required parameter is missing
 */
export class MissingParameterError extends ControllerError {
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
    super(
      `Required parameter "${paramName}" is missing from ${source} ` +
        `for "${controllerName}.${methodName}".\n\n` +
        `The client request must include this parameter.\n`,
      'MISSING_PARAMETER'
    );
    this.name = 'MissingParameterError';
    this.controllerName = controllerName;
    this.methodName = methodName;
    this.paramName = paramName;
    this.source = source;
  }
}

/**
 * Error thrown when route registration fails
 */
export class RouteRegistrationError extends ControllerError {
  readonly controllerName: string;
  readonly method: string;
  readonly path: string;
  readonly cause?: Error;

  constructor(
    controllerName: string,
    method: string,
    path: string,
    reason: string,
    cause?: Error
  ) {
    super(
      `Failed to register route ${method} ${path} ` +
        `from controller "${controllerName}".\n\n` +
        `Reason: ${reason}\n` +
        (cause ? `\nOriginal error: ${cause.message}` : ''),
      'ROUTE_REGISTRATION_ERROR'
    );
    this.name = 'RouteRegistrationError';
    this.controllerName = controllerName;
    this.method = method;
    this.path = path;
    this.cause = cause;
  }
}
