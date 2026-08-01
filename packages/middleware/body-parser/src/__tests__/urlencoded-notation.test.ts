/**
 * @nextrush/body-parser - URL-encoded array notation (BP-3)
 *
 * Extended mode must support the `key[]` append notation documented in the
 * README (`tags[]=js&tags[]=ts` → `{ tags: ['js', 'ts'] }`), not silently
 * overwrite.
 */

import { describe, expect, it } from 'vitest';
import { parseUrlEncoded } from '../utils/url-decode.js';

describe('urlencoded key[] array notation (BP-3)', () => {
  it('collects repeated key[] into an array', () => {
    expect(parseUrlEncoded('tags[]=js&tags[]=ts', true, 1000, 20)).toEqual({
      tags: ['js', 'ts'],
    });
  });

  it('supports a single key[] as a one-element array', () => {
    expect(parseUrlEncoded('tags[]=solo', true, 1000, 20)).toEqual({ tags: ['solo'] });
  });

  it('supports nested key[] append', () => {
    expect(parseUrlEncoded('a[b][]=1&a[b][]=2', true, 1000, 20)).toEqual({
      a: { b: ['1', '2'] },
    });
  });

  it('still supports numeric indices', () => {
    expect(parseUrlEncoded('items[0]=apple&items[1]=banana', true, 1000, 20)).toEqual({
      items: ['apple', 'banana'],
    });
  });

  it('still supports nested objects', () => {
    expect(parseUrlEncoded('user[name]=Alice&user[email]=a@b.com', true, 1000, 20)).toEqual({
      user: { name: 'Alice', email: 'a@b.com' },
    });
  });
});
