import type { StandardSchemaV1 } from '@nextrush/types';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defaultConvert, resolveConverter } from '../json-schema.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('defaultConvert — vendor dispatch', () => {
  it('converts a real Zod schema to JSON Schema (vendor: zod)', async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const json = (await defaultConvert(schema as unknown as StandardSchemaV1)) as any;
    expect(json.type).toBe('object');
    expect(json.properties).toHaveProperty('name');
    expect(json.properties).toHaveProperty('age');
  });

  it('returns {} for an unknown vendor (never throws)', async () => {
    const fake = {
      '~standard': { version: 1, vendor: 'nope', validate: () => ({ value: {} }) },
    } as unknown as StandardSchemaV1;
    expect(await defaultConvert(fake)).toEqual({});
  });
});

describe('resolveConverter', () => {
  it('prefers the user override', () => {
    const custom = () => ({ custom: true });
    expect(resolveConverter(custom)).toBe(custom);
  });
  it('falls back to defaultConvert when no override', () => {
    expect(resolveConverter()).toBe(defaultConvert);
  });
});
