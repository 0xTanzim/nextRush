/**
 * @nextrush/errors - Header Validation Error
 *
 * @packageDocumentation
 */

import { NextRushError } from './base';

/**
 * Thrown when a header field name or value fails RFC 9110 grammar
 * validation (field-name token grammar, field-value grammar — no control
 * characters, no leading/trailing whitespace, no obs-fold).
 *
 * @remarks
 * A rejected write here means the application (or a framework internal) is
 * constructing an invalid header, not that a client sent bad input — so this
 * is a 500-class programming error, not a validation-issue-list shape like
 * {@link ValidationError}.
 */
export class HeaderValidationError extends NextRushError {
  constructor(message: string) {
    super(message, { status: 500, code: 'HEADER_VALIDATION_ERROR', expose: false });
  }
}
