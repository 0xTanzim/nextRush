/**
 * @nextrush/types - Cookie Capability Contract Tests (RFC-034)
 *
 * Compile-time contract: `Context.cookies` is a required, non-optional
 * `CookieCapability` with a nested `signed` sub-capability, and the moved
 * cookie data contracts typecheck from this package.
 */

import { describe, expectTypeOf, it } from 'vitest';
import type {
  CookieCapability,
  CookieOptions,
  CookiePriority,
  ParsedCookies,
  SameSiteValue,
  SignedCookieCapability,
} from '../cookies';
import type { Context } from '../context';

describe('Cookie capability contract (type-level)', () => {
  it('CookieCapability exposes get/set/delete/all/has plus signed', () => {
    expectTypeOf<CookieCapability>().toHaveProperty('get');
    expectTypeOf<CookieCapability>().toHaveProperty('set');
    expectTypeOf<CookieCapability>().toHaveProperty('delete');
    expectTypeOf<CookieCapability>().toHaveProperty('all');
    expectTypeOf<CookieCapability>().toHaveProperty('has');
    expectTypeOf<CookieCapability>().toHaveProperty('signed');
  });

  it('SignedCookieCapability exposes async get/set and sync delete', () => {
    expectTypeOf<SignedCookieCapability>().toHaveProperty('get');
    expectTypeOf<SignedCookieCapability>().toHaveProperty('set');
    expectTypeOf<SignedCookieCapability>().toHaveProperty('delete');
  });

  it('Context.cookies is required and non-optional', () => {
    type CookiesMember = Context['cookies'];
    expectTypeOf<CookiesMember>().not.toBeNullable();
    // Structural spot-check: the member carries the capability's methods.
    expectTypeOf<Context['cookies']>().toHaveProperty('get');
    expectTypeOf<Context['cookies']>().toHaveProperty('set');
    expectTypeOf<Context['cookies']>().toHaveProperty('signed');
  });

  it('Context.cookies is NOT part of ContextState (capability vs state)', () => {
    // ContextState remains the open-ended record — cookies are a first-class
    // member of Context itself, not a key of state.
    expectTypeOf<Context['cookies']>().toHaveProperty('get');
    expectTypeOf<Context['cookies']>().toHaveProperty('signed');
  });

  it('moved data contracts typecheck from @nextrush/types', () => {
    expectTypeOf<CookieOptions>().toHaveProperty('httpOnly');
    expectTypeOf<CookieOptions>().toHaveProperty('maxAge');
    expectTypeOf<CookieOptions>().toHaveProperty('secure');
    const sameSite: SameSiteValue = 'strict';
    void sameSite;
    const priority: CookiePriority = 'low';
    void priority;
    const parsed: ParsedCookies = { a: '1' };
    void parsed;
  });
});
