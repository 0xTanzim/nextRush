/**
 * Validation utilities - pure functions for input validation
 */

export type ValidationRule<T> = (value: T) => string | null;

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate a value against multiple rules
 */
export function validate<T>(
  value: T,
  rules: ValidationRule<T>[]
): ValidationResult {
  const errors: string[] = [];

  for (const rule of rules) {
    const error = rule(value);
    if (error) {
      errors.push(error);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Common validation rules
 */
export const ValidationRules = {
  required: <T>(value: T): string | null => {
    if (value === null || value === undefined || value === '') {
      return 'This field is required';
    }
    return null;
  },

  minLength:
    (min: number) =>
    (value: string): string | null => {
      if (typeof value === 'string' && value.length < min) {
        return `Minimum length is ${min}`;
      }
      return null;
    },

  maxLength:
    (max: number) =>
    (value: string): string | null => {
      if (typeof value === 'string' && value.length > max) {
        return `Maximum length is ${max}`;
      }
      return null;
    },

  pattern:
    (regex: RegExp, message: string) =>
    (value: string): string | null => {
      if (typeof value === 'string' && !regex.test(value)) {
        return message;
      }
      return null;
    },

  email: (value: string): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof value === 'string' && !emailRegex.test(value)) {
      return 'Invalid email format';
    }
    return null;
  },

  numeric: (value: unknown): string | null => {
    if (
      typeof value !== 'number' &&
      (typeof value !== 'string' || isNaN(Number(value)))
    ) {
      return 'Must be a number';
    }
    return null;
  },

  min:
    (min: number) =>
    (value: number): string | null => {
      if (typeof value === 'number' && value < min) {
        return `Minimum value is ${min}`;
      }
      return null;
    },

  max:
    (max: number) =>
    (value: number): string | null => {
      if (typeof value === 'number' && value > max) {
        return `Maximum value is ${max}`;
      }
      return null;
    },

  oneOf:
    <T>(allowedValues: T[]) =>
    (value: T): string | null => {
      if (!allowedValues.includes(value)) {
        return `Must be one of: ${allowedValues.join(', ')}`;
      }
      return null;
    },
};

/**
 * Validate object against schema
 */
export function validateObject<T extends Record<string, unknown>>(
  obj: T,
  schema: Record<keyof T, ValidationRule<unknown>[]>
): Record<keyof T, ValidationResult> {
  const results = {} as Record<keyof T, ValidationResult>;

  for (const [key, rules] of Object.entries(schema) as [
    keyof T,
    ValidationRule<unknown>[]
  ][]) {
    results[key] = validate(obj[key], rules);
  }

  return results;
}

/**
 * Check if all validation results are valid
 */
export function isValidObject<T extends Record<string, unknown>>(
  results: Record<keyof T, ValidationResult>
): boolean {
  return Object.values(results).every((result) => result.isValid);
}
