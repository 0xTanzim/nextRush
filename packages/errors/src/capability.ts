/**
 * @nextrush/errors - Capability Not Initialized Error
 *
 * The framework-wide diagnostic for "a middleware-provided capability was
 * used before its middleware ran" (RFC-034). The property itself exists and
 * is safe to inspect; invoking an operation on an uninitialized capability
 * throws this error, which answers WHAT was called, WHY it is unavailable,
 * HOW to fix it, and WHERE to learn more.
 *
 * @packageDocumentation
 */

import { NextRushError } from './base';

/**
 * Thrown when an operation is invoked on a `ctx.<capability>` whose
 * activating middleware has not run for the request.
 *
 * @remarks
 * A developer error, not a client error: `status` is 500 and `expose` is
 * `false`, so the install instructions in `message` are never serialized to
 * a client response. `capability` and `code` are stable handles for
 * structured logging and programmatic handling.
 */
export class CapabilityNotInitializedError extends NextRushError {
  /** The capability name the operation belongs to (e.g. `cookies`). */
  readonly capability: string;

  constructor(capability: string, instructions: string) {
    // camelCase → UPPER_SNAKE (signedCookies → SIGNED_COOKIES), then replace
    // any remaining non-alphanumeric separator runs.
    const upper = capability
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-z0-9]+/gi, '_')
      .toUpperCase();
    super(
      `${capability} capability is not initialized.\n\n` +
        'You called an operation on this capability, but its middleware has not run for ' +
        'this request. Possible causes:\n' +
        `  1. The ${capability} middleware was not registered.\n` +
        '  2. The middleware was registered after this route.\n' +
        '  3. The middleware is conditionally skipped for this request.\n\n' +
        'Fix:\n' +
        `${instructions}\n\n` +
        `Docs: https://nextrush.dev/docs/reference/${capability}`,
      { status: 500, code: `${upper}_NOT_INITIALIZED`, expose: false }
    );
    this.capability = capability;
  }
}
