/**
 * @nextrush/controllers - Parameter Resolver Tests
 *
 * Covers `resolveParametersFromPlan`'s error-shaping behavior when a
 * required parameter resolves to nothing — in particular the `@Body()`
 * case, which needs an actionable hint pointing at the missing
 * body-parser middleware rather than a generic "missing parameter"
 * message (see openspec change
 * improve-router-modularity-and-class-dx-papercuts, T015).
 */

import type { Context } from '@nextrush/types';
import { describe, expect, it } from 'vitest';
import { MissingParameterError } from '../errors.js';
import { resolveParametersFromPlan } from '../binding/param-resolver.js';
import type { ParamMetadata } from '../binding/param-types.js';

/**
 * Minimal Context stub covering only what `extractParameterValue` reads.
 * `ctx.body` is left `undefined` to simulate no body-parser middleware
 * having run.
 */
function createContext(overrides: Partial<Context> = {}): Context {
  return {
    body: undefined,
    params: {},
    query: {},
    headers: {},
    get: () => undefined,
    raw: { req: {}, res: {} },
    ...overrides,
  } as unknown as Context;
}

function bodyParam(overrides: Partial<ParamMetadata> = {}): ParamMetadata {
  return {
    index: 0,
    source: 'body',
    required: true,
    ...overrides,
  };
}

describe('resolveParametersFromPlan — missing @Body() with no body-parser', () => {
  it('mentions the body-parser as the likely cause and fix when @Body() resolves to nothing', async () => {
    const ctx = createContext();

    await expect(
      resolveParametersFromPlan(ctx, [bodyParam()], 'UserController', 'create')
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(MissingParameterError);
      const message = (error as Error).message;
      // Must name the likely cause (no body-parser ran) and the fix
      // (registering a body-parser middleware), not just the generic
      // "required parameter is missing" text with no diagnostic hint.
      expect(message).toMatch(/body-?parser/i);
      expect(message).toContain('app.use(json())');
      return true;
    });
  });

  it('still resolves correctly when a body-parser has populated ctx.body', async () => {
    const ctx = createContext({ body: { name: 'Alice' } });

    const args = await resolveParametersFromPlan(
      ctx,
      [bodyParam()],
      'UserController',
      'create'
    );

    expect(args).toEqual([{ name: 'Alice' }]);
  });

  it('keeps the generic missing-parameter message for non-body sources (e.g. @Param)', async () => {
    const ctx = createContext();
    const paramParam: ParamMetadata = {
      index: 0,
      source: 'param',
      required: true,
      name: 'id',
    };

    await expect(
      resolveParametersFromPlan(ctx, [paramParam], 'UserController', 'findOne')
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(MissingParameterError);
      const message = (error as Error).message;
      expect(message).not.toMatch(/body-?parser/i);
      expect(message).toContain('"id"');
      return true;
    });
  });
});
