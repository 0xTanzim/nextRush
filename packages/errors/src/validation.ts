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

  constructor(issues: ValidationIssue[], message = 'Validation failed') {
    super(message, {
      status: 400,
      code: 'VALIDATION_ERROR',
      expose: true,
    });
    this.issues = issues;
  }

  /**
   * Create from a single field error
   */
  static fromField(path: string, message: string, rule?: string): ValidationError {
    return new ValidationError([{ path, message, rule }]);
  }

  /**
   * Create from multiple field errors
   */
  static fromFields(errors: Record<string, string>): ValidationError {
    const issues = Object.entries(errors).map(([path, message]) => ({
      path,
      message,
    }));
    return new ValidationError(issues);
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
  constructor(field: string) {
    super(
      [{ path: field, message: `${field} is required`, rule: 'required' }],
      `${field} is required`
    );
  }
}

/**
 * Field type mismatch
 */
export class TypeMismatchError extends ValidationError {
  constructor(field: string, expected: string, received: string) {
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
      `${field} must be of type ${expected}`
    );
  }
}

/**
 * Value out of range
 */
export class RangeValidationError extends ValidationError {
  constructor(field: string, min?: number, max?: number) {
    const parts: string[] = [];
    if (min !== undefined) parts.push(`at least ${min}`);
    if (max !== undefined) parts.push(`at most ${max}`);
    const message = `${field} must be ${parts.join(' and ')}`;

    super([{ path: field, message, rule: 'range', expected: { min, max } }], message);
  }
}

/**
 * String length violation
 */
export class LengthError extends ValidationError {
  constructor(field: string, min?: number, max?: number) {
    const parts: string[] = [];
    if (min !== undefined) parts.push(`at least ${min} characters`);
    if (max !== undefined) parts.push(`at most ${max} characters`);
    const message = `${field} must be ${parts.join(' and ')}`;

    super([{ path: field, message, rule: 'length', expected: { min, max } }], message);
  }
}

/**
 * Pattern mismatch
 */
export class PatternError extends ValidationError {
  constructor(field: string, pattern: string, message?: string) {
    super(
      [
        {
          path: field,
          message: message ?? `${field} does not match required pattern`,
          rule: 'pattern',
          expected: pattern,
        },
      ],
      message ?? `${field} does not match required pattern`
    );
  }
}

/**
 * Invalid email format
 */
export class InvalidEmailError extends ValidationError {
  constructor(field = 'email') {
    super(
      [{ path: field, message: 'Invalid email address', rule: 'email' }],
      'Invalid email address'
    );
  }
}

/**
 * Invalid URL format
 */
export class InvalidUrlError extends ValidationError {
  constructor(field = 'url') {
    super([{ path: field, message: 'Invalid URL', rule: 'url' }], 'Invalid URL');
  }
}
