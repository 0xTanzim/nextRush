/**
 * Input Validation Engine for NextRush v2
 *
 * Provides request body/query/params validation with sanitization.
 *
 * @packageDocumentation
 */

import { URL } from 'node:url';

/**
 * Validation rule interface
 */
export interface ValidationRule {
  required?: boolean;
  type?: 'email' | 'url' | 'number' | 'string' | 'boolean';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  message?: string;
  custom?: (value: unknown) => boolean;
  sanitize?: SanitizeOptions;
}

/**
 * Sanitization options
 */
export interface SanitizeOptions {
  trim?: boolean;
  lowercase?: boolean;
  uppercase?: boolean;
  removeHtml?: boolean;
  escape?: boolean;
  removeSpecialChars?: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
  sanitized: Record<string, unknown>;
}

// Pre-compiled regex patterns
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTML_TAG_REGEX = /<[^>]*>/g;
const SPECIAL_CHARS_REGEX = /[^a-zA-Z0-9\s]/g;

/**
 * Validate email format
 *
 * @param email - Email string to validate
 * @returns true if valid email format
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Validate URL format
 *
 * @param url - URL string to validate
 * @returns true if valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize a string value
 *
 * @param value - Value to sanitize
 * @param options - Sanitization options
 * @returns Sanitized string
 *
 * @example
 * ```typescript
 * const clean = sanitize('  <script>alert(1)</script>  ', {
 *   trim: true,
 *   removeHtml: true,
 *   escape: true
 * });
 * // Returns: ''
 * ```
 */
export function sanitize(
  value: unknown,
  options: SanitizeOptions = {}
): unknown {
  if (typeof value !== 'string') return value;

  let sanitized = value;

  if (options.trim) {
    sanitized = sanitized.trim();
  }

  if (options.lowercase) {
    sanitized = sanitized.toLowerCase();
  }

  if (options.uppercase) {
    sanitized = sanitized.toUpperCase();
  }

  if (options.removeHtml) {
    sanitized = sanitized.replace(HTML_TAG_REGEX, '');
  }

  if (options.escape) {
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  if (options.removeSpecialChars) {
    sanitized = sanitized.replace(SPECIAL_CHARS_REGEX, '');
  }

  return sanitized;
}

/**
 * Recursively sanitize an object
 *
 * @param obj - Object to sanitize
 * @param options - Sanitization options
 * @returns Sanitized object
 */
export function sanitizeObject(
  obj: unknown,
  options: SanitizeOptions = {}
): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof value === 'string') {
      result[key] = sanitize(value, options);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value, options);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Validate a single field against a rule
 *
 * @param value - Value to validate
 * @param rule - Validation rule
 * @param fieldName - Field name for error messages
 * @returns Array of error messages (empty if valid)
 */
export function validateField(
  value: unknown,
  rule: ValidationRule,
  fieldName: string
): string[] {
  const errors: string[] = [];

  // Required check
  if (
    rule.required &&
    (value === undefined || value === null || value === '')
  ) {
    errors.push(rule.message || `${fieldName} is required`);
    return errors;
  }

  // Skip further validation if value is empty and not required
  if (value === undefined || value === null || value === '') {
    return errors;
  }

  // Type validation
  if (rule.type) {
    switch (rule.type) {
      case 'email':
        if (!isValidEmail(String(value))) {
          errors.push(rule.message || `${fieldName} must be a valid email`);
        }
        break;
      case 'url':
        if (!isValidUrl(String(value))) {
          errors.push(rule.message || `${fieldName} must be a valid URL`);
        }
        break;
      case 'number':
        if (isNaN(Number(value))) {
          errors.push(rule.message || `${fieldName} must be a number`);
        }
        break;
    }
  }

  // Length validation
  if (rule.minLength && String(value).length < rule.minLength) {
    errors.push(
      rule.message ||
        `${fieldName} must be at least ${rule.minLength} characters`
    );
  }

  if (rule.maxLength && String(value).length > rule.maxLength) {
    errors.push(
      rule.message ||
        `${fieldName} must be no more than ${rule.maxLength} characters`
    );
  }

  // Number range validation
  if (rule.min !== undefined && Number(value) < rule.min) {
    errors.push(
      rule.message || `${fieldName} must be at least ${rule.min}`
    );
  }

  if (rule.max !== undefined && Number(value) > rule.max) {
    errors.push(
      rule.message || `${fieldName} must be no more than ${rule.max}`
    );
  }

  // Pattern validation
  if (rule.pattern && !rule.pattern.test(String(value))) {
    errors.push(
      rule.message || `${fieldName} does not match the required pattern`
    );
  }

  // Custom validation
  if (rule.custom && typeof rule.custom === 'function' && !rule.custom(value)) {
    errors.push(rule.message || `${fieldName} failed custom validation`);
  }

  return errors;
}

/**
 * Validate multiple fields against rules
 *
 * @param data - Data object to validate
 * @param rules - Validation rules for each field
 * @returns Validation result with errors and sanitized values
 *
 * @example
 * ```typescript
 * const result = validate(req.body, {
 *   email: { required: true, type: 'email' },
 *   name: { required: true, minLength: 2, sanitize: { trim: true } }
 * });
 *
 * if (!result.isValid) {
 *   res.status(400).json({ errors: result.errors });
 * }
 * ```
 */
export function validate(
  data: Record<string, unknown>,
  rules: Record<string, ValidationRule>
): ValidationResult {
  const errors: Record<string, string[]> = {};
  const sanitized: Record<string, unknown> = {};

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];
    const fieldErrors = validateField(value, rule, field);

    if (fieldErrors.length > 0) {
      errors[field] = fieldErrors;
    }

    // Apply sanitization if value exists
    if (value !== undefined && value !== null && value !== '') {
      sanitized[field] = rule.sanitize ? sanitize(value, rule.sanitize) : value;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  };
}
