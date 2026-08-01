/**
 * @nextrush/validation
 *
 * Standard Schema request validation middleware for NextRush. Works with any
 * schema library that implements Standard Schema (Zod, Valibot, ArkType, ...).
 *
 * @example
 * ```typescript
 * import { validate } from '@nextrush/validation';
 * import { z } from 'zod';
 *
 * const User = z.object({ name: z.string().min(1), email: z.string().email() });
 *
 * app.post('/users', validate(User), (ctx) => {
 *   ctx.json(ctx.body); // validated + coerced
 * });
 * ```
 *
 * @packageDocumentation
 */

export { validate } from './validate.js';

// Re-exported so validation errors can be caught/typed from a single import
// site. The error itself is owned by @nextrush/errors and rendered by the
// framework's existing error handler.
export { ValidationError, type ValidationIssue } from '@nextrush/errors';
