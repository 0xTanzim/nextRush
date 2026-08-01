/**
 * @nextrush/class - Parameter Type Definitions
 *
 * Metadata and options shapes for parameter decorators (@Body, @Param, @Query,
 * @Header, and custom param decorators), plus their transform/extractor types.
 */

import type { Context } from '@nextrush/types';

/**
 * Parameter source types for parameter decorators
 */
export type ParamSource = 'body' | 'query' | 'param' | 'header' | 'ctx' | 'req' | 'res' | 'custom';

/**
 * Transform function for parameter value transformation.
 * Supports both sync and async transforms.
 */
export type TransformFn<TInput = unknown, TOutput = unknown> =
  | ((value: TInput) => TOutput)
  | ((value: TInput) => Promise<TOutput>);

/**
 * Custom parameter extractor function.
 *
 * Receives the context object and returns the extracted value.
 * Supports both sync and async extraction.
 */
export type CustomParamExtractor<T = unknown> =
  | ((ctx: Context) => T)
  | ((ctx: Context) => Promise<T>);

/**
 * Parameter metadata stored by @Body, @Param, etc. decorators
 */
export interface ParamMetadata {
  /** Source of the parameter value */
  readonly source: ParamSource;

  /** Parameter index in method signature */
  readonly index: number;

  /** Property name to extract (e.g., 'id' from params.id) */
  readonly name?: string;

  /** Whether the parameter is required (default: true for body/param) */
  readonly required?: boolean;

  /** Default value if not provided */
  readonly defaultValue?: unknown;

  /** Validation pipe or transform function */
  readonly transform?: TransformFn;

  /** Custom extractor function for user-defined param decorators */
  readonly customExtractor?: CustomParamExtractor;
}

/**
 * Options for @Body decorator
 */
export interface BodyOptions {
  /** Whether the body is required (default: true) */
  required?: boolean;

  /** Transform function to apply */
  transform?: TransformFn;
}

/**
 * Options for @Param decorator
 */
export interface ParamOptions {
  /** Whether the param is required (default: true) */
  required?: boolean;

  /** Default value if not provided */
  defaultValue?: unknown;

  /** Transform function (e.g., parseInt for numeric IDs) */
  transform?: TransformFn;
}

/**
 * Options for @Query decorator
 */
export interface QueryOptions {
  /** Whether the query param is required (default: false) */
  required?: boolean;

  /** Default value if not provided */
  defaultValue?: unknown;

  /** Transform function */
  transform?: TransformFn;
}

/**
 * Options for @Header decorator
 */
export interface HeaderOptions {
  /** Whether the header is required (default: false) */
  required?: boolean;

  /** Default value if not provided */
  defaultValue?: unknown;
}
