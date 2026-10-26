import { describe, expect, it } from 'vitest';
import { createRouter } from '../router';
import { findAllowedMethods } from '../find-node';

describe('root segment pre-check fast exit', () => {
  it('returns null for an unmatched root segment when param routes exist at sub-paths', () => {
    const router = createRouter();
    router.get('/users/:id', () => {});
    router.get('/orders/:orderId', () => {});
    router.get('/files/*', () => {});

    expect(router.match('GET', '/unknown')).toBeNull();
    expect(router.match('GET', '/api/v1/users')).toBeNull();
    expect(router.match('GET', '/other/123')).toBeNull();
  });

  it('correctly matches param routes under known root segments', () => {
    const router = createRouter();
    router.get('/users/:id', () => {});

    const match = router.match('GET', '/users/42');
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({ id: '42' });
  });

  it('correctly matches when a param route is registered at the root level', () => {
    const router = createRouter();
    router.get('/:id', () => {});

    const match = router.match('GET', '/anything');
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({ id: 'anything' });
  });

  it('correctly matches when a wildcard route is registered at the root level', () => {
    const router = createRouter();
    router.get('/*', () => {});

    const match = router.match('GET', '/anything/deep/path');
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({ '*': 'anything/deep/path' });
  });

  it('correctly returns null for misses under known root segments', () => {
    const router = createRouter();
    router.get('/users/:id', () => {});

    expect(router.match('GET', '/users/42/details/extra')).toBeNull();
  });

  it('findAllowedMethods returns empty array for unmatched root segment', () => {
    const router = createRouter();
    router.get('/users/:id', () => {});
    router.post('/users/:id', () => {});

    const allowed = findAllowedMethods('/unknown', (router as unknown as { root: never }).root, false, false);
    expect(allowed).toEqual([]);
  });

  it('findAllowedMethods returns registered methods for known paths', () => {
    const router = createRouter();
    router.get('/users/:id', () => {});
    router.post('/users/:id', () => {});

    const allowed = findAllowedMethods('/users/42', (router as unknown as { root: never }).root, false, false);
    expect(allowed.sort()).toEqual(['GET', 'HEAD', 'POST'].sort());
  });
});
