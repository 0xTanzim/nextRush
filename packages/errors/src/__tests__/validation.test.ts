/**
 * @nextrush/errors - Validation Error Tests
 */

import { describe, expect, it } from 'vitest';
import { NextRushError } from '../base';
import {
  InvalidEmailError,
  InvalidUrlError,
  LengthError,
  PatternError,
  RangeValidationError,
  RequiredFieldError,
  TypeMismatchError,
  ValidationError,
} from '../validation';

describe('ValidationError', () => {
  describe('constructor', () => {
    it('should create error with issues', () => {
      const issues = [
        { path: 'email', message: 'Invalid email' },
        { path: 'name', message: 'Name is required' },
      ];
      const error = new ValidationError(issues);

      expect(error.status).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.expose).toBe(true);
      expect(error.issues).toEqual(issues);
      expect(error.message).toBe('Validation failed');
    });

    it('should accept custom message', () => {
      const error = new ValidationError(
        [{ path: 'field', message: 'error' }],
        'Form validation failed'
      );
      expect(error.message).toBe('Form validation failed');
    });

    it('should be instanceof NextRushError', () => {
      const error = new ValidationError([{ path: 'field', message: 'error' }]);
      expect(error).toBeInstanceOf(NextRushError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should include issues in details', () => {
      const issues = [{ path: 'email', message: 'Invalid' }];
      const error = new ValidationError(issues);
      expect(error.details).toEqual({ issues });
    });
  });

  describe('fromField', () => {
    it('should create error from single field', () => {
      const error = ValidationError.fromField('email', 'Invalid email format', 'email');

      expect(error.issues).toHaveLength(1);
      expect(error.issues[0]).toEqual({
        path: 'email',
        message: 'Invalid email format',
        rule: 'email',
      });
    });

    it('should work without rule', () => {
      const error = ValidationError.fromField('name', 'Name is required');
      expect(error.issues[0].rule).toBeUndefined();
    });
  });

  describe('fromFields', () => {
    it('should create error from multiple fields', () => {
      const error = ValidationError.fromFields({
        email: 'Invalid email',
        name: 'Name is required',
        age: 'Must be at least 18',
      });

      expect(error.issues).toHaveLength(3);
      expect(error.issues[0].path).toBe('email');
      expect(error.issues[1].path).toBe('name');
      expect(error.issues[2].path).toBe('age');
    });
  });

  describe('hasErrorFor', () => {
    it('should return true if field has errors', () => {
      const error = new ValidationError([
        { path: 'email', message: 'Invalid' },
        { path: 'name', message: 'Required' },
      ]);

      expect(error.hasErrorFor('email')).toBe(true);
      expect(error.hasErrorFor('name')).toBe(true);
      expect(error.hasErrorFor('age')).toBe(false);
    });
  });

  describe('getErrorsFor', () => {
    it('should return errors for specific field', () => {
      const error = new ValidationError([
        { path: 'email', message: 'Invalid format' },
        { path: 'email', message: 'Already exists' },
        { path: 'name', message: 'Required' },
      ]);

      const emailErrors = error.getErrorsFor('email');
      expect(emailErrors).toHaveLength(2);
      expect(emailErrors[0].message).toBe('Invalid format');
      expect(emailErrors[1].message).toBe('Already exists');
    });

    it('should return empty array if no errors', () => {
      const error = new ValidationError([{ path: 'email', message: 'Invalid' }]);
      expect(error.getErrorsFor('name')).toEqual([]);
    });
  });

  describe('getFirstError', () => {
    it('should return first error message for field', () => {
      const error = new ValidationError([
        { path: 'email', message: 'First error' },
        { path: 'email', message: 'Second error' },
      ]);

      expect(error.getFirstError('email')).toBe('First error');
    });

    it('should return undefined if no errors', () => {
      const error = new ValidationError([{ path: 'email', message: 'Invalid' }]);
      expect(error.getFirstError('name')).toBeUndefined();
    });
  });

  describe('toFlatObject', () => {
    it('should convert to flat object', () => {
      const error = new ValidationError([
        { path: 'email', message: 'Invalid' },
        { path: 'name', message: 'Required' },
      ]);

      expect(error.toFlatObject()).toEqual({
        email: 'Invalid',
        name: 'Required',
      });
    });

    it('should use first error for duplicate fields', () => {
      const error = new ValidationError([
        { path: 'email', message: 'First' },
        { path: 'email', message: 'Second' },
      ]);

      expect(error.toFlatObject()).toEqual({ email: 'First' });
    });
  });

  describe('toJSON', () => {
    it('should include issues in JSON', () => {
      const issues = [{ path: 'email', message: 'Invalid' }];
      const error = new ValidationError(issues);
      const json = error.toJSON();

      expect(json).toEqual({
        error: 'ValidationError',
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        status: 400,
        issues,
      });
    });
  });
});

describe('RequiredFieldError', () => {
  it('should create required field error', () => {
    const error = new RequiredFieldError('name');

    expect(error.status).toBe(400);
    expect(error.message).toBe('name is required');
    expect(error.issues).toHaveLength(1);
    expect(error.issues[0]).toEqual({
      path: 'name',
      message: 'name is required',
      rule: 'required',
    });
  });
});

describe('TypeMismatchError', () => {
  it('should create type mismatch error', () => {
    const error = new TypeMismatchError('age', 'number', 'string');

    expect(error.status).toBe(400);
    expect(error.message).toBe('age must be of type number');
    expect(error.issues[0]).toEqual({
      path: 'age',
      message: 'Expected number, received string',
      rule: 'type',
      expected: 'number',
      received: 'string',
    });
  });
});

describe('RangeValidationError', () => {
  it('should create range error with min', () => {
    const error = new RangeValidationError('age', 18);
    expect(error.message).toBe('age must be at least 18');
  });

  it('should create range error with max', () => {
    const error = new RangeValidationError('quantity', undefined, 100);
    expect(error.message).toBe('quantity must be at most 100');
  });

  it('should create range error with min and max', () => {
    const error = new RangeValidationError('rating', 1, 5);
    expect(error.message).toBe('rating must be at least 1 and at most 5');
    expect(error.issues[0].expected).toEqual({ min: 1, max: 5 });
  });
});

describe('LengthError', () => {
  it('should create length error with min', () => {
    const error = new LengthError('password', 8);
    expect(error.message).toBe('password must be at least 8 characters');
  });

  it('should create length error with max', () => {
    const error = new LengthError('username', undefined, 20);
    expect(error.message).toBe('username must be at most 20 characters');
  });

  it('should create length error with min and max', () => {
    const error = new LengthError('bio', 10, 500);
    expect(error.message).toBe('bio must be at least 10 characters and at most 500 characters');
  });
});

describe('PatternError', () => {
  it('should create pattern error with default message', () => {
    const error = new PatternError('phone', '^\\d{10}$');

    expect(error.message).toBe('phone does not match required pattern');
    expect(error.issues[0].expected).toBe('^\\d{10}$');
    expect(error.issues[0].rule).toBe('pattern');
  });

  it('should create pattern error with custom message', () => {
    const error = new PatternError('phone', '^\\d{10}$', 'Phone must be 10 digits');
    expect(error.message).toBe('Phone must be 10 digits');
  });
});

describe('InvalidEmailError', () => {
  it('should create email error with default field', () => {
    const error = new InvalidEmailError();

    expect(error.message).toBe('Invalid email address');
    expect(error.issues[0].path).toBe('email');
    expect(error.issues[0].rule).toBe('email');
  });

  it('should create email error with custom field', () => {
    const error = new InvalidEmailError('contactEmail');
    expect(error.issues[0].path).toBe('contactEmail');
  });
});

describe('InvalidUrlError', () => {
  it('should create URL error with default field', () => {
    const error = new InvalidUrlError();

    expect(error.message).toBe('Invalid URL');
    expect(error.issues[0].path).toBe('url');
    expect(error.issues[0].rule).toBe('url');
  });

  it('should create URL error with custom field', () => {
    const error = new InvalidUrlError('website');
    expect(error.issues[0].path).toBe('website');
  });
});

describe('Complex validation scenarios', () => {
  it('should handle nested field paths', () => {
    const error = new ValidationError([
      { path: 'user.address.city', message: 'City is required' },
      { path: 'user.address.zipCode', message: 'Invalid zip code' },
      { path: 'items[0].quantity', message: 'Quantity must be positive' },
    ]);

    expect(error.hasErrorFor('user.address.city')).toBe(true);
    expect(error.hasErrorFor('items[0].quantity')).toBe(true);
  });

  it('should handle issues with all properties', () => {
    const error = new ValidationError([
      {
        path: 'age',
        message: 'Age must be between 18 and 120',
        rule: 'range',
        expected: { min: 18, max: 120 },
        received: 150,
      },
    ]);

    expect(error.issues[0].expected).toEqual({ min: 18, max: 120 });
    expect(error.issues[0].received).toBe(150);
  });
});
