import { describe, expectTypeOf, it } from 'vitest';
import { createValidate, validate, validated, type ValidatedInput } from '../index.js';
import { mockCtx } from './_helpers.js';

describe('TypeScript ergonomics for validated() and createValidate()', () => {
  it('allows generic typing on validated<T>(ctx)', () => {
    interface MyQuery {
      limit: number;
      page: number;
    }
    interface MyParams {
      id: number;
    }
    const ctx = mockCtx({});

    const val = validated<{ query: MyQuery; params: MyParams }>(ctx);
    expectTypeOf(val.query).toEqualTypeOf<MyQuery>();
    expectTypeOf(val.params).toEqualTypeOf<MyParams>();

    const optVal = validated<{ query?: MyQuery; params?: MyParams }>(ctx);
    expectTypeOf(optVal.query).toEqualTypeOf<MyQuery | undefined>();
    expectTypeOf(optVal.params).toEqualTypeOf<MyParams | undefined>();

    // Test direct property access without casts:
    if (val.query) {
      expectTypeOf(val.query.limit).toEqualTypeOf<number>();
      expectTypeOf(val.query.page).toEqualTypeOf<number>();
    }
  });

  it('allows positional generic typing on validated<TBody, TQuery, TParams>(ctx)', () => {
    interface MyBody {
      title: string;
    }
    interface MyQuery {
      search: string;
    }
    const ctx = mockCtx({});

    const val = validated<MyBody, MyQuery>(ctx);
    expectTypeOf(val.body).toEqualTypeOf<MyBody | undefined>();
    expectTypeOf(val.query).toEqualTypeOf<MyQuery | undefined>();
    expectTypeOf(val.params).toEqualTypeOf<unknown>();
  });

  it('provides target accessors on validated (query, params, body)', () => {
    interface QueryShape {
      active: boolean;
    }
    interface ParamsShape {
      userId: string;
    }
    interface BodyShape {
      amount: number;
    }
    const ctx = mockCtx({});

    const query = validated.query<QueryShape>(ctx);
    expectTypeOf(query).toEqualTypeOf<QueryShape | undefined>();

    const params = validated.params<ParamsShape>(ctx);
    expectTypeOf(params).toEqualTypeOf<ParamsShape | undefined>();

    const body = validated.body<BodyShape>(ctx);
    expectTypeOf(body).toEqualTypeOf<BodyShape | undefined>();
  });

  it('untyped validated(ctx) defaults safely to ValidatedInput without breaking changes', () => {
    const ctx = mockCtx({});
    const val = validated(ctx);
    expectTypeOf(val).toEqualTypeOf<ValidatedInput>();
    expectTypeOf(val.body).toEqualTypeOf<unknown>();
    expectTypeOf(val.query).toEqualTypeOf<unknown>();
    expectTypeOf(val.params).toEqualTypeOf<unknown>();
  });

  it('createValidate returns a middleware factory identical to validate', () => {
    const customValidate = createValidate({ errorStatus: 422 });
    expectTypeOf(customValidate).toEqualTypeOf<typeof validate>();
  });
});
