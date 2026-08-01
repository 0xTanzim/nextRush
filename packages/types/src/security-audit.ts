/**
 * @nextrush/types - Security Audit Contribution Contract
 *
 * `core` cannot import `@nextrush/{cors,static,cookies,errors}` (lower
 * packages never import from higher ones — `architecture.instructions.md`),
 * so `Application` cannot inspect a middleware instance's configuration
 * directly. This contract lets a middleware factory (`cors()`, `serveStatic()`,
 * `cookies()`, `errorHandler()`, …) optionally attach a boot-time check to the
 * `Middleware` function it already returns from `app.use()` — the same
 * "contribute via a well-known symbol, the owner collects it later" shape as
 * {@link ROUTE_METADATA}, applied to production-safety auditing instead of
 * route documentation (RFC gates this in `docs/RFC/` under the
 * `security-boundaries` capability's boot-audit requirement).
 *
 * @packageDocumentation
 */

import type { Middleware } from './context';

/**
 * Well-known symbol by which a middleware factory contributes a security
 * audit check to the `Middleware` function it returns. `Application.use()`
 * reads this symbol off every registered middleware and collects any checks
 * present; `app.ready()` runs the collected set once, in production only.
 *
 * `Symbol.for` (global registry) matches {@link ROUTE_METADATA}'s choice, so
 * identity holds even across duplicate package instances.
 */
export const SECURITY_AUDIT: unique symbol = Symbol.for('nextrush.security.audit');

/**
 * The outcome of one security audit check.
 *
 * - `ok` — configuration is safe; nothing is reported.
 * - `warn` — configuration is unsafe but has a legitimate use; logged once,
 *   never blocks boot.
 * - `throw` — configuration has no legitimate production use; boot fails.
 */
export type SecurityAuditVerdict =
  | { readonly level: 'ok' }
  | { readonly level: 'warn'; readonly message: string }
  | { readonly level: 'throw'; readonly message: string };

/**
 * A middleware's self-reported boot-time safety check, invoked only when the
 * application is booting in production. Pure and synchronous — a check
 * inspects configuration already closed over at construction time, never I/O.
 */
export type SecurityAuditCheck = () => SecurityAuditVerdict;

/** A middleware function carrying a {@link SecurityAuditCheck} contribution. */
export interface SecurityAudited {
  readonly [SECURITY_AUDIT]: SecurityAuditCheck;
}

/** A registered middleware, optionally carrying a security audit contribution. */
export type AuditableMiddleware = Middleware & Partial<SecurityAudited>;
