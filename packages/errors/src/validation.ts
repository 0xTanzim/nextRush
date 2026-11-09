/**
 * @nextrush/errors - Validation Error Classes
 *
 * Specialized errors for input validation.
 *
 * @packageDocumentation
 */

import { NextRushError } from './base';

/**
 * Single validation issue
 */
export interface ValidationIssue {
  /** Field path (e.g., 'user.email' or 'items[0].name') */
  path: string;
  /** Error message for this field */
  message: string;
  /** Validation rule that failed */
  rule?: string;
  /** Expected value or constraint */
  expected?: unknown;
  /** Actual value received */
  received?: unknown;
}

/**
 * Validation error with multiple issues
 */
export class ValidationError extends NextRushError {
  /** List of validation issues */
  readonly issues: ValidationIssue[];

  /**
   * @param issues - Every validation issue to report.
   * @param message - Human-readable summary.
   * @param status - HTTP status to emit. Defaults to `400 Bad Request`.
   *
   * @remarks
   * `status` is overridable because "the request was malformed" and "the request
   * was well-formed but semantically invalid" are different failures, and API
   * specs legitimately map the second to `422 Unprocessable Entity`. The `code`
   * stays `VALIDATION_ERROR` regardless: the code names the *kind* of failure,
   * the status names the *class* of it.
   */
  constructor(issues: ValidationIssue[], message = 'Validation failed', status = 400) {
    super(message, {
      status,
      code: 'VALIDATION_ERROR',
      expose: true,
    });
    // Freeze a snapshot so issues are immutable after construction (audit E-6).
    this.issues = Object.freeze([...issues]) as ValidationIssue[];
  }

  /**
   * Create from a single field error
   */
  static fromField(path: string, message: string, rule?: string, status = 400): ValidationError {
    return new ValidationError([{ path, message, rule }], 'Validation failed', status);
  }

  /**
   * Create from multiple field errors
   */
  static fromFields(errors: Record<string, string>, status = 400): ValidationError {
    const issues = Object.entries(errors).map(([path, message]) => ({
      path,
      message,
    }));
    return new ValidationError(issues, 'Validation failed', status);
  }

  /**
   * Check if a specific field has errors
   */
  hasErrorFor(path: string): boolean {
    return this.issues.some((issue) => issue.path === path);
  }

  /**
   * Get errors for a specific field
   */
  getErrorsFor(path: string): ValidationIssue[] {
    return this.issues.filter((issue) => issue.path === path);
  }

  /**
   * Get first error message for a field
   */
  getFirstError(path: string): string | undefined {
    return this.issues.find((issue) => issue.path === path)?.message;
  }

  /**
   * Convert to flat error object
   */
  toFlatObject(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const issue of this.issues) {
      if (!result[issue.path]) {
        result[issue.path] = issue.message;
      }
    }
    return result;
  }

  override toJSON(): Record<string, unknown> {
    return {
      error: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      // Strip `received` to prevent leaking sensitive input values (passwords, tokens)
      issues: this.issues.map(({ path, message, rule, expected }) => ({
        path,
        message,
        ...(rule !== undefined && { rule }),
        ...(expected !== undefined && { expected }),
      })),
    };
  }
}

/**
 * Required field missing
 */
export class RequiredFieldError extends ValidationError {
  constructor(field: string, status = 400) {
    super(
      [{ path: field, message: `${field} is required`, rule: 'required' }],
      `${field} is required`,
      status
    );
  }
}

/**
 * Field type mismatch
 */
export class TypeMismatchError extends ValidationError {
  constructor(field: string, expected: string, received: string, status = 400) {
    super(
      [
        {
          path: field,
          message: `Expected ${expected}, received ${received}`,
          rule: 'type',
          expected,
          received,
        },
      ],
      `${field} must be of type ${expected}`,
      status
    );
  }
}

/**
 * Value out of range
 */
export class RangeValidationError extends ValidationError {
  constructor(field: string, min?: number, max?: number, status = 400) {
    const parts: string[] = [];
    if (min !== undefined) parts.push(`at least ${min}`);
    if (max !== undefined) parts.push(`at most ${max}`);
    const message = `${field} must be ${parts.join(' and ')}`;

    super([{ path: field, message, rule: 'range', expected: { min, max } }], message, status);
  }
}

/**
 * String length violation
 */
export class LengthError extends ValidationError {
  constructor(field: string, min?: number, max?: number, status = 400) {
    const parts: string[] = [];
    if (min !== undefined) parts.push(`at least ${min} characters`);
    if (max !== undefined) parts.push(`at most ${max} characters`);
    const message = `${field} must be ${parts.join(' and ')}`;

    super([{ path: field, message, rule: 'length', expected: { min, max } }], message, status);
  }
}

/**
 * Pattern mismatch
 */
export class PatternError extends ValidationError {
  constructor(field: string, pattern: string, message?: string, status = 400) {
    super(
      [
        {
          path: field,
          message: message ?? `${field} does not match required pattern`,
          rule: 'pattern',
          expected: pattern,
        },
      ],
      message ?? `${field} does not match required pattern`,
      status
    );
  }
}

/**
 * Invalid email format
 */
export class InvalidEmailError extends ValidationError {
  constructor(field = 'email', status = 400) {
    super(
      [{ path: field, message: 'Invalid email address', rule: 'email' }],
      'Invalid email address',
      status
    );
  }
}

/**
 * Invalid URL format
 */
export class InvalidUrlError extends ValidationError {
  constructor(field = 'url', status = 400) {
    super([{ path: field, message: 'Invalid URL', rule: 'url' }], 'Invalid URL', status);
  }
}
