/**
 * Validation utilities for NextRush v2
 *
 * @packageDocumentation
 */

import { Context } from '@/types/context';

/**
 * Validation error class
 */
export class ValidationError extends Error {
  public readonly field?: string;
  public readonly value?: unknown;
  public readonly errors?: Array<{
    field: string;
    message: string;
    value?: unknown;
  }>;

  constructor(message: string, field?: string, value?: unknown) {
    super(message);
    this.name = 'ValidationError';
    if (field !== undefined) {
      this.field = field;
    }
    if (value !== undefined) {
      this.value = value;
    }
  }

  static forField(
    field: string,
    message: string,
    value?: unknown
  ): ValidationError {
    return new ValidationError(`${field}: ${message}`, field, value);
  }

  static forFields(
    errors: Array<{ field: string; message: string; value?: unknown }>
  ): ValidationError {
    const error = new ValidationError('Validation failed');
    (error as any).errors = errors;
    return error;
  }
}

/**
 * Validate request data against a schema
 *
 * @param ctx - Request context
 * @param schema - Validation schema
 * @returns Validated data
 */
export function validateRequest<T = unknown>(
  ctx: Context,
  schema: Record<string, unknown>
): T {
  const validated: Record<string, unknown> = {};
  const errors: Array<{ field: string; message: string; value?: unknown }> = [];

  for (const [field, fieldRules] of Object.entries(schema)) {
    const value = ctx.body?.[field as keyof typeof ctx.body];
    const rules = fieldRules as Record<string, unknown>;

    // Required validation
    if (
      rules['required'] &&
      (value === undefined || value === null || value === '')
    ) {
      errors.push({
        field,
        message: `${field} is required`,
        value,
      });
      continue;
    }

    // Type validation
    if (rules['type'] && value !== undefined) {
      const expectedType = rules['type'] as string;
      const actualType = typeof value;

      if (expectedType === 'string' && actualType !== 'string') {
        errors.push({
          field,
          message: `${field} must be a string`,
          value,
        });
      } else if (expectedType === 'number' && actualType !== 'number') {
        errors.push({
          field,
          message: `${field} must be a number`,
          value,
        });
      } else if (expectedType === 'boolean' && actualType !== 'boolean') {
        errors.push({
          field,
          message: `${field} must be a boolean`,
          value,
        });
      } else if (expectedType === 'array' && !Array.isArray(value)) {
        errors.push({
          field,
          message: `${field} must be an array`,
          value,
        });
      } else if (
        expectedType === 'object' &&
        (actualType !== 'object' || Array.isArray(value))
      ) {
        errors.push({
          field,
          message: `${field} must be an object`,
          value,
        });
      }
    }

    // Length validation
    if (
      rules['minLength'] &&
      typeof value === 'string' &&
      (value as string).length < (rules['minLength'] as number)
    ) {
      errors.push({
        field,
        message: `${field} must be at least ${rules['minLength']} characters long`,
        value,
      });
    }

    if (
      rules['maxLength'] &&
      typeof value === 'string' &&
      (value as string).length > (rules['maxLength'] as number)
    ) {
      errors.push({
        field,
        message: `${field} must be at most ${rules['maxLength']} characters long`,
        value,
      });
    }

    // Range validation
    if (
      rules['min'] &&
      typeof value === 'number' &&
      (value as number) < (rules['min'] as number)
    ) {
      errors.push({
        field,
        message: `${field} must be at least ${rules['min']}`,
        value,
      });
    }

    if (
      rules['max'] &&
      typeof value === 'number' &&
      (value as number) > (rules['max'] as number)
    ) {
      errors.push({
        field,
        message: `${field} must be at most ${rules['max']}`,
        value,
      });
    }

    // Pattern validation
    if (rules['pattern'] && typeof value === 'string') {
      const pattern = new RegExp(rules['pattern'] as string);
      if (!pattern.test(value as string)) {
        errors.push({
          field,
          message: `${field} must match the pattern ${rules['pattern']}`,
          value,
        });
      }
    }

    // Enum validation
    if (rules['enum'] && Array.isArray(rules['enum'])) {
      const allowedValues = rules['enum'] as unknown[];
      if (!allowedValues.includes(value)) {
        errors.push({
          field,
          message: `${field} must be one of: ${allowedValues.join(', ')}`,
          value,
        });
      }
    }

    // Email validation
    if (rules['type'] === 'email' && value !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value as string)) {
        errors.push({
          field,
          message: `${field} must be a valid email address`,
          value,
        });
      }
    }

    // URL validation
    if (rules['type'] === 'url' && value !== undefined) {
      try {
        new URL(value as string);
      } catch {
        errors.push({
          field,
          message: `${field} must be a valid URL`,
          value,
        });
      }
    }

    // Custom validation
    if (rules['validate'] && typeof rules['validate'] === 'function') {
      try {
        const isValid = (rules['validate'] as (value: unknown) => boolean)(
          value
        );
        if (!isValid) {
          errors.push({
            field,
            message:
              (rules['message'] as string) || `${field} validation failed`,
            value,
          });
        }
      } catch (error) {
        errors.push({
          field,
          message: `${field} validation error: ${(error as Error).message}`,
          value,
        });
      }
    }

    validated[field] = value;
  }

  if (errors.length > 0) {
    throw ValidationError.forFields(errors);
  }

  return validated as T;
}

/**
 * Sanitize input data
 *
 * @param data - Input data to sanitize
 * @returns Sanitized data
 */
export function sanitizeInput(data: unknown): unknown {
  if (typeof data === 'string') {
    return data
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, ''); // Remove event handlers
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeInput);
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }

  return data;
}

/**
 * Validate and sanitize request body
 *
 * @param ctx - Request context
 * @param schema - Validation schema
 * @returns Validated and sanitized data
 */
export function validateAndSanitize<T = unknown>(
  ctx: Context,
  schema: Record<string, unknown>
): T {
  const validated = validateRequest<T>(ctx, schema);
  return sanitizeInput(validated) as T;
}
