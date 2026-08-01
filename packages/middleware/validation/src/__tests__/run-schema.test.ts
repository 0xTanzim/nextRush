import { describe, expect, it } from 'vitest';
import { runSchema } from '../run-schema.js';
import { catchErr, fake } from './_helpers.js';

describe('runSchema', () => {
  it('returns the coerced value on success', async () => {
    const schema = fake<{ n: number }>(() => ({ value: { n: 42 } }));
    await expect(runSchema(schema, { n: '42' }, 'body')).resolves.toEqual({ n: 42 });
  });

  it('throws ValidationError when the schema reports issues', async () => {
    const schema = fake(() => ({ issues: [{ message: 'Required' }] }));
    await expect(runSchema(schema, {}, 'body')).rejects.toThrow();
  });

  it('awaits an async validate()', async () => {
    const schema = fake<string>(() => Promise.resolve({ value: 'ok' }));
    await expect(runSchema(schema, 'x', 'body')).resolves.toBe('ok');
  });

  it('prefixes issue paths with the target', async () => {
    const schema = fake(() => ({ issues: [{ message: 'bad', path: ['email'] }] }));
    const err = await catchErr(runSchema(schema, {}, 'body'));
    expect(err.issues[0]?.path).toBe('body.email');
  });

  it('joins nested object paths with dots', async () => {
    const schema = fake(() => ({ issues: [{ message: 'bad', path: ['address', 'zip'] }] }));
    const err = await catchErr(runSchema(schema, {}, 'body'));
    expect(err.issues[0]?.path).toBe('body.address.zip');
  });

  it('renders numeric segments as array indices and {key} segments as keys', async () => {
    const schema = fake(() => ({
      issues: [{ message: 'bad', path: [{ key: 'items' }, 0, { key: 'name' }] }],
    }));
    const err = await catchErr(runSchema(schema, {}, 'body'));
    expect(err.issues[0]?.path).toBe('body.items[0].name');
  });

  it('aggregates multiple issues', async () => {
    const schema = fake(() => ({
      issues: [
        { message: 'a', path: ['x'] },
        { message: 'b', path: ['y'] },
      ],
    }));
    const err = await catchErr(runSchema(schema, {}, 'body'));
    expect(err.issues).toHaveLength(2);
    expect(err.issues.map((i) => i.path)).toEqual(['body.x', 'body.y']);
  });

  it('uses the bare prefix when the issue has no path', async () => {
    const schema = fake(() => ({ issues: [{ message: 'invalid' }] }));
    const err = await catchErr(runSchema(schema, 'x', 'query'));
    expect(err.issues[0]?.path).toBe('query');
  });

  it('carries the schema message through unchanged', async () => {
    const schema = fake(() => ({ issues: [{ message: 'Invalid email address', path: ['email'] }] }));
    const err = await catchErr(runSchema(schema, {}, 'body'));
    expect(err.issues[0]?.message).toBe('Invalid email address');
  });
});
