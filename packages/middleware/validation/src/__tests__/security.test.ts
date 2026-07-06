import { describe, expect, it } from 'vitest';
import { ValidationError } from '@nextrush/errors';
import { validate } from '../validate.js';
import { catchErr, fake, mockCtx, tracker } from './_helpers.js';

describe('validate — edge cases & security', () => {
  it('rejects when body is undefined (no body parser ran) and the schema requires it', async () => {
    const schema = fake((v) =>
      v === undefined
        ? { issues: [{ message: 'Expected object, received undefined' }] }
        : { value: v }
    );
    const ctx = mockCtx({ body: undefined });
    const t = tracker();
    await expect(validate(schema)(ctx, t.next)).rejects.toBeInstanceOf(ValidationError);
    expect(t.called()).toBe(false);
  });

  it('validates a non-object body (primitive) the schema accepts', async () => {
    const schema = fake<number>((v) =>
      typeof v === 'number' ? { value: v } : { issues: [{ message: 'Expected number' }] }
    );
    const ctx = mockCtx({ body: 42 });
    await validate(schema)(ctx, tracker().next);
    expect(ctx.body).toBe(42);
  });

  it('propagates (does not swallow) a non-validation error thrown by the schema', async () => {
    const boom = new Error('schema exploded');
    const schema = fake(() => {
      throw boom;
    });
    const ctx = mockCtx({ body: {} });
    const t = tracker();
    await expect(validate(schema)(ctx, t.next)).rejects.toBe(boom);
    expect(t.called()).toBe(false);
  });

  it('propagates an async schema rejection', async () => {
    const boom = new Error('async boom');
    const schema = fake(() => Promise.reject(boom));
    const ctx = mockCtx({ body: {} });
    await expect(validate(schema)(ctx, tracker().next)).rejects.toBe(boom);
  });

  it('treats a failure with an empty issues array as a failure (no silent pass)', async () => {
    const schema = fake(() => ({ issues: [] }));
    const ctx = mockCtx({ body: { a: 1 } });
    const t = tracker();
    await expect(validate(schema)(ctx, t.next)).rejects.toBeInstanceOf(ValidationError);
    expect(t.called()).toBe(false);
  });

  it('does not pollute Object.prototype via __proto__/constructor issue paths', async () => {
    const schema = fake(() => ({
      issues: [
        { message: 'x', path: ['__proto__', 'polluted'] },
        { message: 'y', path: ['constructor', 'prototype', 'polluted'] },
      ],
    }));
    const ctx = mockCtx({ body: {} });
    const err = await catchErr(validate(schema)(ctx, tracker().next));
    expect(err.issues[0]?.path).toBe('body.__proto__.polluted');
    expect(Object.prototype).not.toHaveProperty('polluted');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('never leaks the raw invalid value in the serialized error', async () => {
    const schema = fake(() => ({ issues: [{ message: 'Invalid', path: ['password'] }] }));
    const ctx = mockCtx({ body: { password: 'super-secret-value' } });
    const err = await catchErr(validate(schema)(ctx, tracker().next));
    expect(JSON.stringify(err.toJSON())).not.toContain('super-secret-value');
  });

  it('handles a symbol path segment without throwing', async () => {
    const schema = fake(() => ({ issues: [{ message: 'x', path: [Symbol('secret-key')] }] }));
    const ctx = mockCtx({ body: {} });
    const err = await catchErr(validate(schema)(ctx, tracker().next));
    expect(err.issues[0]?.path).toContain('body.');
  });

  it('does not run later targets short-circuit — reports every failing target', async () => {
    const body = fake(() => ({ issues: [{ message: 'b', path: ['a'] }] }));
    const query = fake(() => ({ issues: [{ message: 'q', path: ['b'] }] }));
    const params = fake(() => ({ issues: [{ message: 'p', path: ['c'] }] }));
    const ctx = mockCtx({ body: {}, query: {}, params: {} });
    const err = await catchErr(validate({ body, query, params })(ctx, tracker().next));
    expect(err.issues.map((i) => i.path)).toEqual(['body.a', 'query.b', 'params.c']);
  });
});
