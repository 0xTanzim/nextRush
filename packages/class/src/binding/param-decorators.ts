/**
 * @nextrush/class - Standard Parameter Decorators
 *
 * Parameter decorators for injecting request data into controller method parameters.
 * Uses legacy decorators (parameter decorators not supported in Stage 3).
 */

import type {
  BodyOptions,
  HeaderOptions,
  ParamMetadata,
  ParamOptions,
  QueryOptions,
} from '../types.js';
import { createParamDecorator, pushParamMetadata } from './param-factory.js';

/**
 * @Body decorator - Injects the request body into the parameter.
 *
 * @example
 * ```typescript
 * @Controller('/users')
 * class UserController {
 *   // Inject entire body
 *   @Post()
 *   create(@Body() data: CreateUserDto) { }
 *
 *   // Inject specific property from body
 *   @Post('/email')
 *   updateEmail(@Body('email') email: string) { }
 *
 *   // With transform
 *   @Post()
 *   create(@Body({ transform: validateCreateUser }) data: CreateUserDto) { }
 * }
 * ```
 */
export const Body: {
  (): ParameterDecorator;
  (property: string): ParameterDecorator;
  (options: BodyOptions): ParameterDecorator;
  (property: string, options: BodyOptions): ParameterDecorator;
} = createParamDecorator<BodyOptions>('body', true) as typeof Body;

/**
 * @Param decorator - Injects route parameters into the parameter.
 *
 * @example
 * ```typescript
 * @Controller('/users')
 * class UserController {
 *   // Inject all params
 *   @Get('/:id')
 *   findOne(@Param() params: { id: string }) { }
 *
 *   // Inject specific param
 *   @Get('/:id')
 *   findOne(@Param('id') id: string) { }
 *
 *   // With transform (e.g., parse to number)
 *   @Get('/:id')
 *   findOne(@Param('id', { transform: Number }) id: number) { }
 * }
 * ```
 */
export const Param: {
  (): ParameterDecorator;
  (name: string): ParameterDecorator;
  (options: ParamOptions): ParameterDecorator;
  (name: string, options: ParamOptions): ParameterDecorator;
} = createParamDecorator<ParamOptions>('param', true) as typeof Param;

/**
 * @Query decorator - Injects query parameters into the parameter.
 *
 * @example
 * ```typescript
 * @Controller('/users')
 * class UserController {
 *   // Inject all query params
 *   @Get()
 *   findAll(@Query() query: { page?: number; limit?: number }) { }
 *
 *   // Inject specific query param
 *   @Get()
 *   findAll(@Query('page') page: string) { }
 *
 *   // With default value
 *   @Get()
 *   findAll(@Query('limit', { defaultValue: 10, transform: Number }) limit: number) { }
 * }
 * ```
 */
export const Query: {
  (): ParameterDecorator;
  (name: string): ParameterDecorator;
  (options: QueryOptions): ParameterDecorator;
  (name: string, options: QueryOptions): ParameterDecorator;
} = createParamDecorator<QueryOptions>('query', false) as typeof Query;

/**
 * @Header decorator - Injects request headers into the parameter.
 *
 * @example
 * ```typescript
 * @Controller('/api')
 * class ApiController {
 *   // Inject all headers
 *   @Get()
 *   handle(@Header() headers: Record<string, string>) { }
 *
 *   // Inject specific header
 *   @Get()
 *   handle(@Header('authorization') auth: string) { }
 *
 *   // With default value
 *   @Get()
 *   handle(@Header('x-api-version', { defaultValue: 'v1' }) version: string) { }
 * }
 * ```
 */
export const Header: {
  (): ParameterDecorator;
  (name: string): ParameterDecorator;
  (options: HeaderOptions): ParameterDecorator;
  (name: string, options: HeaderOptions): ParameterDecorator;
} = createParamDecorator<HeaderOptions>('header', false) as typeof Header;

/**
 * @Ctx decorator - Injects the full NextRush Context object.
 *
 * @example
 * ```typescript
 * @Controller('/users')
 * class UserController {
 *   @Get('/:id')
 *   findOne(@Ctx() ctx: Context) {
 *     const id = ctx.params.id;
 *     ctx.json({ id });
 *   }
 * }
 * ```
 */
export function Ctx(): ParameterDecorator {
  return function ctxDecorator(
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void {
    if (propertyKey === undefined) {
      throw new Error('@Ctx can only be used on method parameters, not constructor parameters.');
    }

    const metadata: ParamMetadata = {
      source: 'ctx',
      index: parameterIndex,
      required: false,
    };

    pushParamMetadata(target, propertyKey, metadata);
  };
}

/**
 * @Req decorator - Injects the raw request object (adapter-specific).
 *
 * @example
 * ```typescript
 * @Controller('/files')
 * class FileController {
 *   @Post('/upload')
 *   upload(@Req() req: IncomingMessage) {
 *     // Access raw Node.js request for streaming
 *   }
 * }
 * ```
 */
export function Req(): ParameterDecorator {
  return function reqDecorator(
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void {
    if (propertyKey === undefined) {
      throw new Error('@Req can only be used on method parameters, not constructor parameters.');
    }

    const metadata: ParamMetadata = {
      source: 'req',
      index: parameterIndex,
      required: false,
    };

    pushParamMetadata(target, propertyKey, metadata);
  };
}

/**
 * @Res decorator - Injects the raw response object (adapter-specific).
 *
 * @example
 * ```typescript
 * @Controller('/files')
 * class FileController {
 *   @Get('/download/:id')
 *   download(@Res() res: ServerResponse) {
 *     // Access raw Node.js response for streaming
 *   }
 * }
 * ```
 */
export function Res(): ParameterDecorator {
  return function resDecorator(
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void {
    if (propertyKey === undefined) {
      throw new Error('@Res can only be used on method parameters, not constructor parameters.');
    }

    const metadata: ParamMetadata = {
      source: 'res',
      index: parameterIndex,
      required: false,
    };

    pushParamMetadata(target, propertyKey, metadata);
  };
}
