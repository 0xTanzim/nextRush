/**
 * 🛡️ Validation & Sanitization Plugin - NextRush Framework
 *
 * Provides comprehensive input validation, sanitization, and security features
 * following the unified plugin architecture.
 */

import { Application } from '../../core/app/application';
import { NextRushRequest, NextRushResponse } from '../../types/express';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';

/**
 * Validation rule interface
 */
export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'email' | 'url' | 'boolean' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  in?: any[];
  custom?: (value: any) => boolean | string;
}

/**
 * Validation schema
 */
export interface ValidationSchema {
  [field: string]: ValidationRule;
}

/**
 * Sanitization options
 */
export interface SanitizationOptions {
  removeHtml?: boolean;
  escapeHtml?: boolean;
  trim?: boolean;
  lowercase?: boolean;
  uppercase?: boolean;
  removeSpecialChars?: boolean;
  allowedTags?: string[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
  sanitized: Record<string, any>;
}

/**
 * 🛡️ Validation & Sanitization Plugin
 */
export class ValidationPlugin extends BasePlugin {
  name = 'Validation';

  constructor(registry: PluginRegistry) {
    super(registry);
  }

  /**
   * Install validation capabilities
   */
  install(app: Application): void {
    // Add validation middleware function
    (app as any).validate = (schema: ValidationSchema) => {
      return (
        req: NextRushRequest,
        res: NextRushResponse,
        next: () => void
      ) => {
        const result = this.validateRequest(req, schema);

        if (!result.isValid) {
          res.status(400).json({
            error: 'Validation failed',
            details: result.errors,
          });
          return;
        }

        // Attach sanitized data to request
        req.body = result.sanitized;
        next();
      };
    };

    // Add sanitization middleware
    (app as any).sanitize = (options: SanitizationOptions = {}) => {
      return (
        req: NextRushRequest,
        res: NextRushResponse,
        next: () => void
      ) => {
        if (req.body) {
          req.body = this.sanitizeData(req.body, options);
        }
        next();
      };
    };

    // Add XSS protection middleware
    (app as any).xssProtection = () => {
      return (
        req: NextRushRequest,
        res: NextRushResponse,
        next: () => void
      ) => {
        // Set XSS protection headers
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');

        // Sanitize body for XSS
        if (req.body) {
          req.body = this.sanitizeData(req.body, {
            removeHtml: true,
            escapeHtml: true,
          });
        }

        next();
      };
    };

    this.emit('validation:installed');
  }

  /**
   * Start the validation plugin
   */
  start(): void {
    this.emit('validation:started');
  }

  /**
   * Stop the validation plugin
   */
  stop(): void {
    this.emit('validation:stopped');
  }

  /**
   * 🔍 Validate request against schema
   */
  private validateRequest(
    req: NextRushRequest,
    schema: ValidationSchema
  ): ValidationResult {
    const errors: Record<string, string[]> = {};
    const sanitized: Record<string, any> = {};
    const data = req.body || {};

    for (const [field, rule] of Object.entries(schema)) {
      const value = data[field];
      const fieldErrors: string[] = [];

      // Required validation
      if (rule.required && this.isEmpty(value)) {
        fieldErrors.push(`${field} is required`);
        continue;
      }

      // Skip further validation if not required and empty
      if (!rule.required && this.isEmpty(value)) {
        continue;
      }

      // Type validation
      if (rule.type) {
        const typeResult = this.validateType(value, rule.type, field);
        if (typeResult.error) {
          fieldErrors.push(typeResult.error);
        } else {
          sanitized[field] = typeResult.value;
        }
      }

      // Length validation (for strings)
      if (typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          fieldErrors.push(
            `${field} must be at least ${rule.minLength} characters`
          );
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          fieldErrors.push(
            `${field} must be at most ${rule.maxLength} characters`
          );
        }
      }

      // Number range validation
      if (
        typeof value === 'number' ||
        (rule.type === 'number' && !isNaN(Number(value)))
      ) {
        const numValue = Number(value);
        if (rule.min !== undefined && numValue < rule.min) {
          fieldErrors.push(`${field} must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && numValue > rule.max) {
          fieldErrors.push(`${field} must be at most ${rule.max}`);
        }
      }

      // Pattern validation
      if (rule.pattern && typeof value === 'string') {
        if (!rule.pattern.test(value)) {
          fieldErrors.push(`${field} format is invalid`);
        }
      }

      // Enum validation
      if (rule.in && !rule.in.includes(value)) {
        fieldErrors.push(`${field} must be one of: ${rule.in.join(', ')}`);
      }

      // Custom validation
      if (rule.custom) {
        const customResult = rule.custom(value);
        if (customResult !== true) {
          fieldErrors.push(
            typeof customResult === 'string'
              ? customResult
              : `${field} is invalid`
          );
        }
      }

      // Store errors or sanitized value
      if (fieldErrors.length > 0) {
        errors[field] = fieldErrors;
      } else if (!sanitized[field]) {
        sanitized[field] = value;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      sanitized,
    };
  }

  /**
   * 🧹 Sanitize data recursively
   */
  private sanitizeData(data: any, options: SanitizationOptions): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return this.sanitizeString(data, options);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item, options));
    }

    if (typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeData(value, options);
      }
      return sanitized;
    }

    return data;
  }

  /**
   * 🧹 Sanitize string value
   */
  private sanitizeString(str: string, options: SanitizationOptions): string {
    let result = str;

    if (options.trim !== false) {
      result = result.trim();
    }

    if (options.removeHtml) {
      result = result.replace(/<[^>]*>/g, '');
    }

    if (options.escapeHtml) {
      result = result
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }

    if (options.removeSpecialChars) {
      result = result.replace(/[^\w\s.-]/g, '');
    }

    if (options.lowercase) {
      result = result.toLowerCase();
    }

    if (options.uppercase) {
      result = result.toUpperCase();
    }

    return result;
  }

  /**
   * 🔍 Validate specific type
   */
  private validateType(
    value: any,
    type: string,
    field: string
  ): { value?: any; error?: string } {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          return { error: `${field} must be a string` };
        }
        return { value };

      case 'number':
        const num = Number(value);
        if (isNaN(num)) {
          return { error: `${field} must be a number` };
        }
        return { value: num };

      case 'boolean':
        if (typeof value === 'boolean') {
          return { value };
        }
        if (value === 'true' || value === '1') {
          return { value: true };
        }
        if (value === 'false' || value === '0') {
          return { value: false };
        }
        return { error: `${field} must be a boolean` };

      case 'email':
        if (
          typeof value !== 'string' ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ) {
          return { error: `${field} must be a valid email` };
        }
        return { value: value.toLowerCase() };

      case 'url':
        try {
          new URL(value);
          return { value };
        } catch {
          return { error: `${field} must be a valid URL` };
        }

      case 'array':
        if (!Array.isArray(value)) {
          return { error: `${field} must be an array` };
        }
        return { value };

      case 'object':
        if (
          typeof value !== 'object' ||
          Array.isArray(value) ||
          value === null
        ) {
          return { error: `${field} must be an object` };
        }
        return { value };

      default:
        return { value };
    }
  }

  /**
   * 🔍 Check if value is empty
   */
  private isEmpty(value: any): boolean {
    return (
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === 'object' && Object.keys(value).length === 0)
    );
  }
}
