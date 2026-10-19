/**
 * @nextrush/runtime — request target derivation without `URL`.
 *
 * The context needs three things out of `request.url`: the path, the query
 * string, and the two concatenated. `new URL()` answers all three, and it also
 * *reshapes* the path — WHATWG parsing resolves dot segments, including every
 * percent-encoded spelling of one. That resolution is exactly what a proxy may
 * not have done, and the router's dot-segment rejection cannot fire on a path
 * that was already resolved upstream of it.
 *
 * So the derivation is a scan of the target string. It must agree with `URL`
 * about the ordinary cases (that is what makes it a replacement rather than a
 * behavior change) and it must disagree about the one case that matters: a dot
 * segment stays in the path it returns.
 */

import { describe, expect, it } from 'vitest';
import { requestTargetFromUrl } from '../request-target';

describe('requestTargetFromUrl — agreement with URL on ordinary targets', () => {
  it.each([
    ['https://h/a/b', '/a/b', ''],
    ['https://h/a/b?x=1', '/a/b', '?x=1'],
    ['https://h/a/b?x=1&y=2', '/a/b', '?x=1&y=2'],
    ['https://h/', '/', ''],
    ['https://h', '/', ''],
    ['http://h:8080/a?b=1', '/a', '?b=1'],
    ['https://[::1]:8080/a?b=1', '/a', '?b=1'],
    ['https://h?x=1', '/', '?x=1'],
    ['https://h#frag', '/', ''],
    ['https://h/a#frag', '/a', ''],
    ['https://h/a?x=1#frag', '/a', '?x=1'],
    ['https://h/a/b/', '/a/b/', ''],
    ['https://h//a//b', '//a//b', ''],
    ['https://h/a%20b', '/a%20b', ''],
    ['https://h/a?b?c', '/a', '?b?c'],
    ['https://h/a#f?x', '/a', ''],
    ['/a/b?x=1', '/a/b', '?x=1'],
    ['/a/b', '/a/b', ''],
    ['', '/', ''],
    ['?x=1', '/', '?x=1'],
  ])('%s → path %s, search %s', (url, path, search) => {
    expect(requestTargetFromUrl(url)).toEqual({ path, search });
  });

  it('agrees with URL wherever URL has nothing to re-encode', () => {
    for (const url of [
      'https://h/Users/Alice?Q=1',
      'https://h/a%2Fb/c?d=%20',
      'https://h/a-b_c.d~e!f*g(h)i?j=k',
      'https://h/%7Ea/b?x=%41',
    ]) {
      const parsed = new URL(url);
      expect(requestTargetFromUrl(url)).toEqual({
        path: parsed.pathname,
        search: parsed.search,
      });
    }
  });

  it('publishes bytes URL would percent-encode exactly as they arrived', () => {
    // Deliberate divergence, and the same one the dot segment gets: the path is
    // published as the platform delivered it. Re-encoding it here would publish a
    // form the client never sent and then match routes, mounts and exclude-path
    // lists against that form — the reshaping this derivation exists to avoid. A
    // client that cannot put a raw byte on the wire sends the escape, and then
    // the escape is the path.
    //
    // `URL.pathname` would return `/stra%C3%9Fe`, `/a%3Cb`, `/a%7Bb%7D` and
    // `/?x=%C3%BC` for these four.
    expect(requestTargetFromUrl('https://h/stra\u00dfe')).toEqual({
      path: '/stra\u00dfe',
      search: '',
    });
    expect(requestTargetFromUrl('https://h/a<b')).toEqual({ path: '/a<b', search: '' });
    expect(requestTargetFromUrl('https://h/a{b}')).toEqual({ path: '/a{b}', search: '' });
    expect(requestTargetFromUrl('https://h/?x=\u00fc')).toEqual({ path: '/', search: '?x=\u00fc' });
  });
});

describe('requestTargetFromUrl — a dot segment is preserved, not resolved', () => {
  it.each([
    'https://h/files/../admin',
    'https://h/files/./admin',
    'https://h/files/%2e%2e/admin',
    'https://h/files/.%2e/admin',
    'https://h/%2e%2e',
    'https://h/a/../b/../c',
    'https://h/files/..hidden',
    'https://h/archive.tar.gz',
  ])('leaves %s exactly as the client wrote it', (url) => {
    const target = url.slice('https://h'.length);
    expect(requestTargetFromUrl(url)).toEqual({ path: target, search: '' });
  });

  it('keeps an encoded dot segment that URL would have resolved away', () => {
    // `URL` collapses this to `/`; the segment is preserved so the router can
    // reject it, which is the whole reason the derivation exists.
    expect(requestTargetFromUrl('https://h/%7Ea/%2e%2E?x=%41')).toEqual({
      path: '/%7Ea/%2e%2E',
      search: '?x=%41',
    });
    expect(new URL('https://h/%7Ea/%2e%2E?x=%41').pathname).toBe('/');
  });

  it('keeps a dot segment out of the query string out of the way', () => {
    expect(requestTargetFromUrl('https://h/a/../b?next=/c/../d')).toEqual({
      path: '/a/../b',
      search: '?next=/c/../d',
    });
  });
});

describe('requestTargetFromUrl — bounds', () => {
  it('handles a very long target without reshaping it', () => {
    const path = `/${'segment/'.repeat(5000)}`;
    const url = `https://h${path}?x=1`;
    expect(requestTargetFromUrl(url)).toEqual({ path, search: '?x=1' });
  });

  it('handles a target with no authority and no path', () => {
    expect(requestTargetFromUrl('https://h?')).toEqual({ path: '/', search: '?' });
  });

  it('returns an empty search rather than the string "undefined" for a missing query', () => {
    const result = requestTargetFromUrl('https://h/a');
    expect(result.search).toBe('');
    expect(result.search.slice(1)).toBe('');
  });
});
