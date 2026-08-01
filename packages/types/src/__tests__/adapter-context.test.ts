/**
 * @nextrush/types - Adapter context contract tests (F-13)
 *
 * Models the adapter-internal surface that currently leaks off the concrete
 * context classes (`markResponded`, `getResponse`, `waitUntil`, `env`). These
 * are additive: `AdapterContext`/`FetchContext` extend `Context`, they never
 * weaken it.
 */

import { describe, expect, expectTypeOf, it } from 'vitest';
import type { AdapterContext, FetchContext } from '../adapter-context';
import type { Context } from '../context';

describe('AdapterContext', () => {
  it('extends Context and adds markResponded()', () => {
    // Structural: an AdapterContext is assignable to Context.
    expectTypeOf<AdapterContext>().toMatchTypeOf<Context>();
    expectTypeOf<AdapterContext['markResponded']>().toEqualTypeOf<() => void>();
  });
});

describe('FetchContext', () => {
  it('extends AdapterContext and adds getResponse() plus optional waitUntil/env', () => {
    expectTypeOf<FetchContext>().toMatchTypeOf<AdapterContext>();
    expectTypeOf<FetchContext>().toMatchTypeOf<Context>();
    expectTypeOf<FetchContext['getResponse']>().toEqualTypeOf<() => Response>();
    // waitUntil and env are optional
    expectTypeOf<FetchContext['waitUntil']>().toEqualTypeOf<
      ((promise: Promise<unknown>) => void) | undefined
    >();
  });

  it('is satisfiable by a minimal fetch-context stub (markResponded + getResponse)', () => {
    // Only assert the additive members here; Context members are covered by the
    // concrete adapter context tests. This proves the additive surface is real.
    const partial: Pick<FetchContext, 'markResponded' | 'getResponse'> = {
      markResponded: () => undefined,
      getResponse: () => new Response('ok'),
    };
    partial.markResponded();
    expect(partial.getResponse().status).toBe(200);
  });
});
