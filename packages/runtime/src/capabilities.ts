/**
 * @nextrush/runtime - Uninitialized Cookie Capability Stubs (RFC-034)
 *
 * `Context.cookies` always exists; before the `cookies()` middleware runs it
 * references these frozen, process-shared stubs. Reading or inspecting the
 * property is safe — invoking any operation throws
 * `CapabilityNotInitializedError` with a WHAT / WHY / HOW / WHERE diagnostic.
 *
 * The stubs live here, not in `@nextrush/cookies`, so no package in the
 * core/runtime/adapter layers ever imports middleware code. Activation is a
 * plain reference swap performed by the middleware: `ctx.cookies = store`.
 *
 * @packageDocumentation
 */

import { CapabilityNotInitializedError } from '@nextrush/errors';
import type { CookieCapability, SignedCookieCapability } from '@nextrush/types';

/** Install instructions embedded in the cookies diagnostic. */
const COOKIE_INSTALL_INSTRUCTIONS =
  'Install @nextrush/cookies and register the middleware:\n' +
  '  import { cookies } from \'@nextrush/cookies\';\n' +
  '  app.use(cookies());';

/** Install instructions embedded in the signed-cookies diagnostic. */
const SIGNED_COOKIE_INSTALL_INSTRUCTIONS =
  'Install @nextrush/cookies and register the middleware:\n' +
  '  import { signedCookies } from \'@nextrush/cookies\';\n' +
  '  app.use(signedCookies({ secret: process.env.COOKIE_SECRET }));';

function throwUninitialized(capability: string, instructions: string): never {
  throw new CapabilityNotInitializedError(capability, instructions);
}

/**
 * The uninitialized `ctx.cookies.signed` slot. Frozen and shared; every
 * operation throws `SIGNED_COOKIES_NOT_INITIALIZED`.
 */
export const UNINITIALIZED_SIGNED_COOKIES: SignedCookieCapability = Object.freeze({
  get(): Promise<string | undefined> {
    return throwUninitialized('signedCookies', SIGNED_COOKIE_INSTALL_INSTRUCTIONS);
  },
  set(): Promise<void> {
    return throwUninitialized('signedCookies', SIGNED_COOKIE_INSTALL_INSTRUCTIONS);
  },
  delete(): void {
    throwUninitialized('signedCookies', SIGNED_COOKIE_INSTALL_INSTRUCTIONS);
  },
});

/**
 * The uninitialized `ctx.cookies` slot. Frozen and shared; every operation
 * throws `COOKIES_NOT_INITIALIZED`, and `signed` points at
 * {@link UNINITIALIZED_SIGNED_COOKIES}. Accessing the object itself never
 * throws.
 */
export const UNINITIALIZED_COOKIES: CookieCapability = Object.freeze({
  get(): string | undefined {
    return throwUninitialized('cookies', COOKIE_INSTALL_INSTRUCTIONS);
  },
  set(): void {
    throwUninitialized('cookies', COOKIE_INSTALL_INSTRUCTIONS);
  },
  delete(): void {
    throwUninitialized('cookies', COOKIE_INSTALL_INSTRUCTIONS);
  },
  all(): Record<string, string> {
    return throwUninitialized('cookies', COOKIE_INSTALL_INSTRUCTIONS);
  },
  has(): boolean {
    return throwUninitialized('cookies', COOKIE_INSTALL_INSTRUCTIONS);
  },
  signed: UNINITIALIZED_SIGNED_COOKIES,
});
