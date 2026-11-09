import { describe, expect, it } from 'vitest';
import { ValidationError } from '@nextrush/errors';
import { ROUTE_METADATA } from '@nextrush/types';
import { validate, validated, createValidate } from '../validate.js';
import { catchErr, fake, mockCtx, tracker } from './_helpers.js';

describe('validate (body shorthand)', () => {
  it('overwrites ctx.body with the coerced value and calls next', async () => {
    const schema = fake<{ n: number }>(() => ({ value: { n: 42 } }));
    const ctx = mockCtx({ body: { n: '42' } });
    const t = tracker();
    await validate(schema)(ctx, t.next);
    expect(ctx.body).toEqual({ n: 42 });
    expect(t.called()).toBe(true);
  });

  it('throws ValidationError and does NOT call next when body is invalid', async () => {
    const schema = fake(() => ({ issues: [{ message: 'Required', path: ['name'] }] }));
    const ctx = mockCtx({ body: {} });
    const t = tracker();
    await expect(validate(schema)(ctx, t.next)).rejects.toBeInstanceOf(ValidationError);
    expect(t.called()).toBe(false);
  });

  it('leaves ctx.body untouched when validation fails', async () => {
    const original = { raw: true };
    const schema = fake(() => ({ issues: [{ message: 'bad' }] }));
    const ctx = mockCtx({ body: original });
    await catchErr(validate(schema)(ctx, tracker().next));
    expect(ctx.body).toBe(original);
  });
});

describe('validate (multi-target)', () => {
  it('validates params and query but leaves them unmodified', async () => {
    // schemas "coerce" to numbers, but validate-only must NOT write them back
    const params = fake(() => ({ value: { id: 123 } }));
    const query = fake(() => ({ value: { page: 2 } }));
    const ctx = mockCtx({ params: { id: '123' }, query: { page: '2' } });
    const t = tracker();
    await validate({ params, query })(ctx, t.next);
    expect(ctx.params).toEqual({ id: '123' }); // unchanged — still a string
    expect(ctx.query).toEqual({ page: '2' }); // unchanged — still a string
    expect(t.called()).toBe(true);
  });

  it('overwrites body but leaves query untouched', async () => {
    const body = fake(() => ({ value: { clean: true } }));
    const query = fake(() => ({ value: { page: 1 } }));
    const ctx = mockCtx({ body: { raw: 1 }, query: { page: '1' } });
    await validate({ body, query })(ctx, tracker().next);
    expect(ctx.body).toEqual({ clean: true });
    expect(ctx.query).toEqual({ page: '1' });
  });

  it('aggregates issues across all targets into one error', async () => {
    const body = fake(() => ({ issues: [{ message: 'bad email', path: ['email'] }] }));
    const query = fake(() => ({ issues: [{ message: 'bad sort', path: ['sort'] }] }));
    const ctx = mockCtx({ body: {}, query: {} });
    const err = await catchErr(validate({ body, query })(ctx, tracker().next));
    expect(err.issues.map((i) => i.path)).toEqual(['body.email', 'query.sort']);
  });

  it('does not overwrite body when another target fails (atomic)', async () => {
    const original = { raw: 1 };
    const body = fake(() => ({ value: { clean: true } }));
    const params = fake(() => ({ issues: [{ message: 'bad id', path: ['id'] }] }));
    const ctx = mockCtx({ body: original, params: {} });
    await catchErr(validate({ body, params })(ctx, tracker().next));
    expect(ctx.body).toBe(original); // not overwritten — params failed
  });

  it('calls next and validates nothing for an empty spec', async () => {
    const ctx = mockCtx({ body: { x: 1 } });
    const t = tracker();
    await validate({})(ctx, t.next);
    expect(t.called()).toBe(true);
    expect(ctx.body).toEqual({ x: 1 });
  });
});


describe('validate() route metadata contribution', () => {
  it('attaches request.body under ROUTE_METADATA (body shorthand)', () => {
    const schema = fake(() => ({ value: {} }));
    const mw = validate(schema);
    expect(Reflect.get(mw, ROUTE_METADATA)).toEqual({ request: { body: schema } });
  });

  it('attaches per-target schemas for a multi-target spec', () => {
    const body = fake(() => ({ value: {} }));
    const query = fake(() => ({ value: {} }));
    const mw = validate({ body, query });
    expect(Reflect.get(mw, ROUTE_METADATA)).toEqual({ request: { body, query } });
  });

  it('makes the contribution non-enumerable (public API unchanged)', () => {
    const mw = validate(fake(() => ({ value: {} })));
    const descriptor = Object.getOwnPropertyDescriptor(mw, ROUTE_METADATA);
    expect(descriptor?.enumerable).toBe(false);
    // The middleware still presents as a plain function to callers.
    expect(typeof mw).toBe('function');
  });
});

describe('#69 — coerced query/params are exposed via validated()', () => {
  it('exposes the coerced query while leaving ctx.query as the raw string map', async () => {
    const query = fake(() => ({ value: { limit: 999 } }));
    const ctx = mockCtx({ query: { limit: '999' } });
    const t = tracker();

    await validate({ query })(ctx, t.next);

    // The coerced value is available...
    expect(validated(ctx).query).toEqual({ limit: 999 });
    // ...and the raw context is untouched, so its declared type stays honest.
    expect(ctx.query).toEqual({ limit: '999' });
    expect(t.called()).toBe(true);
  });

  it('exposes coerced params while leaving ctx.params unmodified', async () => {
    const params = fake(() => ({ value: { id: 42 } }));
    const ctx = mockCtx({ params: { id: '42' } });
    const t = tracker();

    await validate({ params })(ctx, t.next);

    expect(validated(ctx).params).toEqual({ id: 42 });
    expect(ctx.params).toEqual({ id: '42' });
  });

  it('exposes body alongside query and params in one pass', async () => {
    const body = fake(() => ({ value: { name: 'ada' } }));
    const query = fake(() => ({ value: { page: 3 } }));
    const params = fake(() => ({ value: { id: 7 } }));
    const ctx = mockCtx({ body: { name: 'ada' }, query: { page: '3' }, params: { id: '7' } });

    await validate({ body, query, params })(ctx, tracker().next);

    expect(validated(ctx)).toEqual({ body: { name: 'ada' }, query: { page: 3 }, params: { id: 7 } });
  });

  it('omits targets that were not configured', async () => {
    const query = fake(() => ({ value: { page: 3 } }));
    const ctx = mockCtx({ query: { page: '3' } });

    await validate({ query })(ctx, tracker().next);

    const got = validated(ctx);
    expect(got.query).toEqual({ page: 3 });
    expect('body' in got).toBe(false);
    expect('params' in got).toBe(false);
  });

  it('writes nothing when validation fails (atomicity holds)', async () => {
    const query = fake(() => ({ value: { page: 3 } }));
    const bad = fake(() => ({ issues: [{ message: 'bad', path: ['x'] }] }));
    const ctx = mockCtx({ query: { page: '3' } });

    await catchErr(validate({ query, params: bad })(ctx, tracker().next));

    expect(ctx.state['validated']).toBeUndefined();
  });

  it('returns an empty object when validate() never ran', () => {
    const ctx = mockCtx();
    expect(validated(ctx)).toEqual({});
  });
});

describe('#70 — errorStatus overrides the failure status', () => {
  it('defaults to 400', async () => {
    const schema = fake(() => ({ issues: [{ message: 'bad', path: ['x'] }] }));
    const err = await catchErr(validate(schema)(mockCtx({ body: {} }), tracker().next));
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('emits 422 when errorStatus is 422, keeping the VALIDATION_ERROR code', async () => {
    const schema = fake(() => ({ issues: [{ message: 'bad', path: ['x'] }] }));
    const err = await catchErr(
      validate(schema, { errorStatus: 422 })(mockCtx({ body: {} }), tracker().next)
    );
    expect(err.status).toBe(422);
    // The code names the kind of failure; the status names its class.
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('still aggregates issues across every target under a custom status', async () => {
    const badQuery = fake(() => ({ issues: [{ message: 'q bad', path: ['q'] }] }));
    const badParams = fake(() => ({ issues: [{ message: 'p bad', path: ['p'] }] }));
    const ctx = mockCtx({ query: {}, params: {} });

    const err = await catchErr(
      validate({ query: badQuery, params: badParams }, { errorStatus: 422 })(ctx, tracker().next)
    );

    expect(err.status).toBe(422);
    expect(err.issues).toHaveLength(2);
  });
});

describe('#70 — errorStatus is validated at construction', () => {
  const rejected = [0, -1, 200, 204, 302, 399, 400.5, 500, 999, NaN, Infinity, '422', {}, []];
  for (const value of rejected) {
    it(`rejects errorStatus=${String(value)}`, () => {
      expect(() => validate({ query: fake(() => ({ value: {} })) }, { errorStatus: value as number }))
        .toThrow(RangeError);
    });
  }

  it('accepts every valid 4xx status', () => {
    for (const status of [400, 401, 403, 409, 418, 422, 429, 499]) {
      expect(() => validate({ query: fake(() => ({ value: {} })) }, { errorStatus: status })).not.toThrow();
    }
  });

  it('treats null and undefined as "use the default"', () => {
    expect(() => validate({ query: fake(() => ({ value: {} })) }, { errorStatus: null as never })).not.toThrow();
    expect(() => validate({ query: fake(() => ({ value: {} })) }, { errorStatus: undefined })).not.toThrow();
  });

  it('the rejection message names the accepted range', () => {
    expect(() => validate({}, { errorStatus: 500 })).toThrow(/between 400 and 499/);
  });
});

describe('#69 — stacking validate() on one route', () => {
  it('keeps the first call\'s coerced target when a second runs', async () => {
    const ctx = mockCtx({ params: { id: '7' }, query: { page: '3' } });
    const params = fake(() => ({ value: { id: 7 } }));
    const query = fake(() => ({ value: { page: 3 } }));

    await validate({ params })(ctx, tracker().next);
    await validate({ query })(ctx, tracker().next);

    expect(validated(ctx)).toEqual({ params: { id: 7 }, query: { page: 3 } });
  });

  it('a later target overwrites only its own key', async () => {
    const ctx = mockCtx({ query: { a: '1' } });
    const first = fake(() => ({ value: { a: 1, keep: true } }));
    const second = fake(() => ({ value: { a: 2 } }));

    await validate({ query: first })(ctx, tracker().next);
    await validate({ query: second })(ctx, tracker().next);

    expect(validated(ctx).query).toEqual({ a: 2 });
  });

  it('does not write state when the first call fails', async () => {
    const ctx = mockCtx({ params: {}, query: { page: '3' } });
    const badParams = fake(() => ({ issues: [{ message: 'bad', path: ['id'] }] }));
    const query = fake(() => ({ value: { page: 3 } }));

    await catchErr(validate({ params: badParams, query })(ctx, tracker().next));
    expect(ctx.state['validated']).toBeUndefined();
  });
});

describe('#69 — body schema without a body parser', () => {
  it('names the missing body parser instead of blaming the schema', async () => {
    const schema = fake(() => ({ value: {} }));
    // A request that clearly carries a body, but readBody() resolved nothing.
    const ctx = mockCtx({ body: undefined, headers: { 'content-length': '13' } });

    // Caught manually: this throws a plain Error, and catchErr deliberately
    // rethrows anything that is not a ValidationError.
    let err: unknown;
    try {
      await validate({ body: schema })(ctx, tracker().next);
      throw new Error('expected the middleware to throw');
    } catch (e) {
      err = e;
    }
    // A plain Error, not a ValidationError: this is a misconfiguration, not a
    // client input problem, so it must not be reported as a 400.
    expect(err).not.toBeInstanceOf(ValidationError);
    expect((err as Error).message).toMatch(/body parser/i);
    expect((err as Error).message).toMatch(/bodyParser\(\)/);
  });

  it('a genuinely empty body still reports a schema error, not a parser error', async () => {
    const schema = fake(() => ({ issues: [{ message: 'Required', path: ['name'] }] }));
    const ctx = mockCtx({ body: undefined, headers: { 'content-length': '0' } });

    const err = await catchErr(validate({ body: schema })(ctx, tracker().next));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).not.toMatch(/body parser/i);
  });
});

describe('validate() rejects silent-no-op mistakes at construction', () => {
  it('rejects a misspelled target key instead of validating nothing', () => {
    const schema = fake(() => ({ value: {} }));
    // Without this guard every request would pass through unvalidated.
    expect(() => validate({ querys: schema } as never)).toThrow(TypeError);
    expect(() => validate({ querys: schema } as never)).toThrow(/unknown schema target/);
  });

  it('names every unknown key it found', () => {
    const schema = fake(() => ({ value: {} }));
    expect(() => validate({ querys: schema, param: schema } as never)).toThrow(/"querys", "param"/);
  });

  it('rejects a schema filed under a domain name', () => {
    const schema = fake(() => ({ value: {} }));
    expect(() => validate({ user: schema } as never)).toThrow(/unknown schema target/);
  });

  it('rejects a target whose value is not a Standard Schema', () => {
    expect(() => validate({ query: {} } as never)).toThrow(/not a Standard Schema/);
    expect(() => validate({ body: 'nope' } as never)).toThrow(/not a Standard Schema/);
    expect(() => validate({ params: null } as never)).toThrow(/not a Standard Schema/);
  });

  it('rejects a non-object argument', () => {
    expect(() => validate(null as never)).toThrow(TypeError);
    expect(() => validate(undefined as never)).toThrow(TypeError);
    expect(() => validate('schema' as never)).toThrow(TypeError);
  });

  it('still accepts an empty map as a documented pass-through', async () => {
    const ctx = mockCtx({ body: { x: 1 } });
    const t = tracker();
    await validate({})(ctx, t.next);
    expect(t.called()).toBe(true);
    expect(ctx.body).toEqual({ x: 1 });
  });

  it('still accepts all three valid targets', () => {
    const schema = fake(() => ({ value: {} }));
    expect(() => validate({ body: schema, query: schema, params: schema })).not.toThrow();
  });

  it('still accepts the body shorthand', () => {
    const schema = fake(() => ({ value: {} }));
    expect(() => validate(schema)).not.toThrow();
  });
});

describe('validated target helpers', () => {
  it('validated.query(ctx) reads query target directly', async () => {
    const query = fake(() => ({ value: { page: 3 } }));
    const ctx = mockCtx({ query: { page: '3' } });
    await validate({ query })(ctx, tracker().next);

    expect(validated.query(ctx)).toEqual({ page: 3 });
    expect(validated.params(ctx)).toBeUndefined();
    expect(validated.body(ctx)).toBeUndefined();
  });

  it('validated.params(ctx) reads params target directly', async () => {
    const params = fake(() => ({ value: { id: 42 } }));
    const ctx = mockCtx({ params: { id: '42' } });
    await validate({ params })(ctx, tracker().next);

    expect(validated.params(ctx)).toEqual({ id: 42 });
    expect(validated.query(ctx)).toBeUndefined();
  });

  it('validated.body(ctx) reads body target directly', async () => {
    const body = fake(() => ({ value: { name: 'Ada' } }));
    const ctx = mockCtx({ body: { name: 'Ada' } });
    await validate(body)(ctx, tracker().next);

    expect(validated.body(ctx)).toEqual({ name: 'Ada' });
  });

  it('helpers return undefined when no validation ran', () => {
    const ctx = mockCtx({});
    expect(validated.query(ctx)).toBeUndefined();
    expect(validated.params(ctx)).toBeUndefined();
    expect(validated.body(ctx)).toBeUndefined();
  });
});

describe('createValidate() factory', () => {
  it('creates validate middleware with default errorStatus', async () => {
    const validate422 = createValidate({ errorStatus: 422 });
    const schema = fake(() => ({ issues: [{ message: 'invalid', path: ['field'] }] }));
    const ctx = mockCtx({ body: {} });

    const err = await catchErr(validate422(schema)(ctx, tracker().next));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.status).toBe(422);
  });

  it('allows route-level options to override factory default', async () => {
    const validate422 = createValidate({ errorStatus: 422 });
    const schema = fake(() => ({ issues: [{ message: 'invalid', path: ['field'] }] }));
    const ctx = mockCtx({ body: {} });

    const err = await catchErr(validate422(schema, { errorStatus: 400 })(ctx, tracker().next));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.status).toBe(400);
  });

  it('validates default errorStatus at factory creation', () => {
    expect(() => createValidate({ errorStatus: 302 })).toThrow(RangeError);
    expect(() => createValidate({ errorStatus: 500 })).toThrow(RangeError);
    expect(() => createValidate({ errorStatus: 422.5 })).toThrow(RangeError);
  });

  it('works with default empty options', async () => {
    const customValidate = createValidate();
    const schema = fake(() => ({ value: { ok: true } }));
    const ctx = mockCtx({ body: {} });
    const t = tracker();

    await customValidate(schema)(ctx, t.next);
    expect(t.called()).toBe(true);
  });

  it('attaches ROUTE_METADATA to middleware returned by configured validate', () => {
    const validate422 = createValidate({ errorStatus: 422 });
    const schema = fake(() => ({ value: { ok: true } }));
    const mw = validate422(schema);

    const meta = (mw as unknown as Record<symbol, unknown>)[ROUTE_METADATA];
    expect(meta).toEqual({
      request: { body: schema },
    });
  });

  it('works with multi-target schema maps in configured validate', async () => {
    const validate422 = createValidate({ errorStatus: 422 });
    const querySchema = fake(() => ({ value: { limit: 10 } }));
    const mw = validate422({ query: querySchema });

    const ctx = mockCtx({ query: { limit: '10' } });
    const t = tracker();
    await mw(ctx, t.next);

    expect(t.called()).toBe(true);
    expect(validated.query(ctx)).toEqual({ limit: 10 });
  });

  it('safely handles contexts without state property in validated()', () => {
    const bareCtx = {} as any;
    expect(validated(bareCtx)).toEqual({});
    expect(validated.query(bareCtx)).toBeUndefined();
    expect(validated.params(bareCtx)).toBeUndefined();
    expect(validated.body(bareCtx)).toBeUndefined();
  });

  it('safely initializes state when validate() runs on a context without state property', async () => {
    const querySchema = fake(() => ({ value: { page: 1 } }));
    const mw = validate({ query: querySchema });
    const bareCtx = { query: { page: '1' } } as any;
    const t = tracker();

    await mw(bareCtx, t.next);

    expect(t.called()).toBe(true);
    expect(bareCtx.state).toBeDefined();
    expect(validated.query(bareCtx)).toEqual({ page: 1 });
  });
});
