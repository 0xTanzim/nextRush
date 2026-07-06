import { describe, expect, it } from 'vitest';
import { ValidationError } from '@nextrush/errors';
import { validate } from '../validate.js';
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
