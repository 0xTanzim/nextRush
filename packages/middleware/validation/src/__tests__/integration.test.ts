import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ValidationError } from '@nextrush/errors';
import { createValidate, validate, validated } from '../validate.js';
import { catchErr, mockCtx, tracker } from './_helpers.js';

/**
 * Integration tests against real Zod — proves the package works end-to-end with
 * a production Standard Schema implementation, not just the hand-written fake.
 */

const User = z.object({ name: z.string().min(1), email: z.string().email() });

describe('integration: real Zod', () => {
  it('validates and coerces a real Zod body', async () => {
    const schema = z.object({ page: z.coerce.number().int().min(1) });
    const ctx = mockCtx({ body: { page: '3' } });
    await validate(schema)(ctx, tracker().next);
    expect(ctx.body).toEqual({ page: 3 }); // string → number, in place
  });

  it('rejects an invalid Zod body with the framework ValidationError', async () => {
    const ctx = mockCtx({ body: { name: '', email: 'not-an-email' } });
    const err = await catchErr(validate(User)(ctx, tracker().next));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.status).toBe(400);
    expect(err.issues.map((i) => i.path).sort()).toEqual(['body.email', 'body.name']);
  });

  it('produces the documented 400 JSON shape (RFC §7)', async () => {
    const ctx = mockCtx({ body: { name: 'x', email: 'bad' } });
    const err = await catchErr(validate(User)(ctx, tracker().next));
    const json = err.toJSON();
    expect(json).toMatchObject({
      error: 'ValidationError',
      code: 'VALIDATION_ERROR',
      status: 400,
    });
    const issues = json['issues'] as Array<Record<string, unknown>>;
    expect(Array.isArray(issues)).toBe(true);
    expect(issues[0]).toHaveProperty('path');
    expect(issues[0]).toHaveProperty('message');
  });

  it('validates a real Zod query without modifying ctx.query (stays a string)', async () => {
    const Query = z.object({ page: z.coerce.number() });
    const ctx = mockCtx({ query: { page: '2' } });
    await validate({ query: Query })(ctx, tracker().next);
    expect(ctx.query).toEqual({ page: '2' }); // NOT coerced — validate-only
  });

  it('validates params + body together with real Zod', async () => {
    const ctx = mockCtx({
      body: { name: 'Ada', email: 'ada@example.com' },
      params: { id: '123e4567-e89b-12d3-a456-426614174000' },
    });
    const t = tracker();
    await validate({ body: User, params: z.object({ id: z.string().uuid() }) })(ctx, t.next);
    expect(ctx.body).toEqual({ name: 'Ada', email: 'ada@example.com' });
    expect(t.called()).toBe(true);
  });

  it('does not leak the raw invalid value for a real Zod failure', async () => {
    const Login = z.object({ email: z.string().email(), password: z.string().min(8) });
    const ctx = mockCtx({ body: { email: 'bad', password: 'secret-password-123' } });
    const err = await catchErr(validate(Login)(ctx, tracker().next));
    expect(JSON.stringify(err.toJSON())).not.toContain('secret-password-123');
  });

  it('exposes coerced real Zod query via validated(ctx) and validated.query(ctx)', async () => {
    const Query = z.object({ page: z.coerce.number().int().min(1), limit: z.coerce.number().int().default(20) });
    const ctx = mockCtx({ query: { page: '5' } });
    await validate({ query: Query })(ctx, tracker().next);

    expect(ctx.query).toEqual({ page: '5' });
    expect(validated(ctx).query).toEqual({ page: 5, limit: 20 });
    expect(validated.query(ctx)).toEqual({ page: 5, limit: 20 });
  });

  it('exposes coerced real Zod params via validated(ctx) and validated.params(ctx)', async () => {
    const Params = z.object({ id: z.coerce.number().int() });
    const ctx = mockCtx({ params: { id: '42' } });
    await validate({ params: Params })(ctx, tracker().next);

    expect(ctx.params).toEqual({ id: '42' });
    expect(validated(ctx).params).toEqual({ id: 42 });
    expect(validated.params(ctx)).toEqual({ id: 42 });
  });

  it('supports errorStatus: 422 with real Zod failure', async () => {
    const Query = z.object({ limit: z.coerce.number().int() });
    const ctx = mockCtx({ query: { limit: 'not-a-number' } });

    const err = await catchErr(validate({ query: Query }, { errorStatus: 422 })(ctx, tracker().next));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.status).toBe(422);
    expect(err.toJSON().status).toBe(422);
  });

  it('works with createValidate({ errorStatus: 422 }) and real Zod', async () => {
    const validate422 = createValidate({ errorStatus: 422 });
    const Query = z.object({ limit: z.coerce.number().int() });
    const ctx = mockCtx({ query: { limit: 'abc' } });

    const err = await catchErr(validate422({ query: Query })(ctx, tracker().next));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.status).toBe(422);
  });
});
