/**
 * @nextrush/controllers - Parameter Resolver
 *
 * Resolves controller-method arguments from the request context using a
 * precomputed, pre-sorted parameter injection plan. Supports async transforms
 * (zod, valibot, etc.) and async custom extractors.
 */

import type { ParamMetadata } from './param-types.js';
import type { Context } from '@nextrush/types';
import { MissingParameterError, ParameterInjectionError } from '../errors.js';

/**
 * Resolve parameter values from a precomputed, pre-sorted injection plan.
 * Supports async transform functions for validation libraries (zod, valibot, etc.)
 */
export async function resolveParametersFromPlan(
  ctx: Context,
  sortedMetadata: ParamMetadata[],
  controllerName: string,
  methodName: string
): Promise<unknown[]> {
  if (sortedMetadata.length === 0) {
    return [];
  }

  const maxIndex =
    sortedMetadata.length > 0 ? sortedMetadata[sortedMetadata.length - 1]!.index : -1;
  const args: unknown[] = new Array(maxIndex + 1).fill(undefined);

  for (const param of sortedMetadata) {
    try {
      // Await supports async custom extractors (createCustomParamDecorator)
      const value = await extractParameterValue(ctx, param);

      if (value === undefined) {
        if (param.required && param.defaultValue === undefined) {
          throw new MissingParameterError(
            controllerName,
            methodName,
            param.name ?? `index ${param.index}`,
            param.source
          );
        }
        args[param.index] = param.defaultValue;
      } else {
        // Support both sync and async transform functions
        args[param.index] = param.transform ? await param.transform(value) : value;
      }
    } catch (error) {
      if (error instanceof MissingParameterError) {
        throw error;
      }
      throw new ParameterInjectionError(
        controllerName,
        methodName,
        param.index,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return args;
}

/**
 * Extract parameter value from context based on source
 */
export function extractParameterValue(ctx: Context, param: ParamMetadata): unknown {
  switch (param.source) {
    case 'body':
      if (param.name) {
        return (ctx.body as Record<string, unknown>)?.[param.name];
      }
      return ctx.body;

    case 'param':
      if (param.name) {
        return ctx.params[param.name];
      }
      return ctx.params;

    case 'query':
      if (param.name) {
        return ctx.query[param.name];
      }
      return ctx.query;

    case 'header':
      if (param.name) {
        return ctx.get(param.name);
      }
      return ctx.headers;

    case 'ctx':
      return ctx;

    case 'req':
      return ctx.raw.req;

    case 'res':
      return ctx.raw.res;

    case 'custom':
      if (param.customExtractor) {
        return param.customExtractor(ctx);
      }
      return undefined;

    default:
      return undefined;
  }
}
