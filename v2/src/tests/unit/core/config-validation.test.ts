/**
 * Tests for Configuration Validation System
 */

import {
  ConfigUtils,
  ConfigurationError,
  ValidationRules,
  createSafeConfiguration,
  validateApplicationOptions,
  validateField,
} from '@/core/config/validation';
import { describe, expect, it } from 'vitest';

describe('Configuration Validation System', () => {
  describe('ValidationRules', () => {
    it('should validate port correctly', () => {
      expect(ValidationRules.port.validate(3000)).toBe(true);
      expect(ValidationRules.port.validate(80)).toBe(true);
      expect(ValidationRules.port.validate(65535)).toBe(true);

      expect(ValidationRules.port.validate(0)).toBe(true); // Port 0 is valid (OS assigns free port)
      expect(ValidationRules.port.validate(-1)).toBe(false);
      expect(ValidationRules.port.validate(65536)).toBe(false);
      expect(ValidationRules.port.validate(3000.5)).toBe(false);
    });

    it('should validate host correctly', () => {
      expect(ValidationRules.host.validate('localhost')).toBe(true);
      expect(ValidationRules.host.validate('127.0.0.1')).toBe(true);
      expect(ValidationRules.host.validate('example.com')).toBe(true);

      expect(ValidationRules.host.validate('')).toBe(false);
    });

    it('should validate timeout correctly', () => {
      expect(ValidationRules.timeout.validate(30000)).toBe(true);
      expect(ValidationRules.timeout.validate(1000)).toBe(true);
      expect(ValidationRules.timeout.validate(300000)).toBe(true);

      expect(ValidationRules.timeout.validate(0)).toBe(false);
      expect(ValidationRules.timeout.validate(-1000)).toBe(false);
      expect(ValidationRules.timeout.validate(300001)).toBe(false);
      expect(ValidationRules.timeout.validate(1000.5)).toBe(false);
    });

    it('should validate maxBodySize correctly', () => {
      expect(ValidationRules.maxBodySize.validate(1024 * 1024)).toBe(true); // 1MB
      expect(ValidationRules.maxBodySize.validate(100 * 1024 * 1024)).toBe(
        true
      ); // 100MB

      expect(ValidationRules.maxBodySize.validate(0)).toBe(false);
      expect(ValidationRules.maxBodySize.validate(-1)).toBe(false);
      expect(ValidationRules.maxBodySize.validate(101 * 1024 * 1024)).toBe(
        false
      ); // > 100MB
    });

    it('should validate boolean values correctly', () => {
      expect(ValidationRules.boolean.validate(true)).toBe(true);
      expect(ValidationRules.boolean.validate(false)).toBe(true);

      expect(ValidationRules.boolean.validate('true' as any)).toBe(false);
      expect(ValidationRules.boolean.validate(1 as any)).toBe(false);
      expect(ValidationRules.boolean.validate(0 as any)).toBe(false);
    });

    it('should validate string values correctly', () => {
      expect(ValidationRules.string.validate('test')).toBe(true);
      expect(ValidationRules.string.validate('')).toBe(true);

      expect(ValidationRules.string.validate(123 as any)).toBe(false);
      expect(ValidationRules.string.validate(null as any)).toBe(false);
      expect(ValidationRules.string.validate(undefined as any)).toBe(false);
    });

    it('should validate template configuration correctly', () => {
      expect(
        ValidationRules.template.validate({
          engine: 'simple',
          directory: 'views',
        })
      ).toBe(true);

      expect(
        ValidationRules.template.validate({
          engine: '',
          directory: 'views',
        })
      ).toBe(false);

      expect(
        ValidationRules.template.validate({
          engine: 'simple',
          directory: '',
        })
      ).toBe(false);

      expect(ValidationRules.template.validate(null as any)).toBe(false);
      expect(ValidationRules.template.validate('string' as any)).toBe(false);
    });
  });

  describe('validateField', () => {
    it('should validate field successfully', () => {
      expect(() => {
        validateField('port', 3000, ValidationRules.port);
      }).not.toThrow();
    });

    it('should throw ConfigurationError for invalid field', () => {
      expect(() => {
        validateField('port', -1, ValidationRules.port);
      }).toThrow(ConfigurationError);

      try {
        validateField('port', -1, ValidationRules.port);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        expect((error as ConfigurationError).field).toBe('port');
        expect((error as ConfigurationError).value).toBe(-1);
        expect((error as ConfigurationError).message).toContain('Invalid port');
      }
    });
  });

  describe('validateApplicationOptions', () => {
    it('should validate valid options', () => {
      const validOptions = {
        port: 3000,
        host: 'localhost',
        debug: true,
        timeout: 30000,
      };

      expect(() => {
        validateApplicationOptions(validOptions);
      }).not.toThrow();
    });

    it('should throw for invalid options', () => {
      const invalidOptions = {
        port: -1,
        host: '',
        timeout: 500000, // Too high
      };

      expect(() => {
        validateApplicationOptions(invalidOptions);
      }).toThrow(ConfigurationError);
    });

    it('should throw for unknown options', () => {
      const unknownOptions = {
        port: 3000,
        unknownOption: 'value',
      };

      expect(() => {
        validateApplicationOptions(unknownOptions);
      }).toThrow(ConfigurationError);
    });

    it('should handle empty options', () => {
      expect(() => {
        validateApplicationOptions({});
      }).not.toThrow();
    });
  });

  describe('createSafeConfiguration', () => {
    it('should create configuration with defaults', () => {
      const config = createSafeConfiguration();

      expect(config.port).toBe(3000);
      expect(config.host).toBe('localhost');
      expect(config.debug).toBe(false);
      expect(config.trustProxy).toBe(false);
      expect(config.maxBodySize).toBe(1024 * 1024);
      expect(config.timeout).toBe(30000);
      expect(config.cors).toBe(true);
      expect(config.static).toBe('public');
      expect(config.template).toEqual({
        engine: 'simple',
        directory: 'views',
      });
      expect(config.keepAlive).toBe(10000);
    });

    it('should merge provided options with defaults', () => {
      const customOptions = {
        port: 8080,
        debug: true,
        timeout: 60000,
      };

      const config = createSafeConfiguration(customOptions);

      expect(config.port).toBe(8080);
      expect(config.debug).toBe(true);
      expect(config.timeout).toBe(60000);
      expect(config.host).toBe('localhost'); // Default
      expect(config.maxBodySize).toBe(1024 * 1024); // Default
    });

    it('should validate merged configuration', () => {
      const invalidOptions = {
        port: 70000, // Invalid
      };

      expect(() => {
        createSafeConfiguration(invalidOptions);
      }).toThrow(ConfigurationError);
    });

    it('should handle template configuration', () => {
      const customTemplate = {
        template: {
          engine: 'handlebars',
          directory: 'templates',
        },
      };

      const config = createSafeConfiguration(customTemplate);

      expect(config.template).toEqual({
        engine: 'handlebars',
        directory: 'templates',
      });
    });
  });

  describe('ConfigUtils', () => {
    it('should check valid port', () => {
      expect(ConfigUtils.isValidPort(3000)).toBe(true);
      expect(ConfigUtils.isValidPort(-1)).toBe(false);
      expect(ConfigUtils.isValidPort('3000')).toBe(false);
    });

    it('should check valid host', () => {
      expect(ConfigUtils.isValidHost('localhost')).toBe(true);
      expect(ConfigUtils.isValidHost('')).toBe(false);
      expect(ConfigUtils.isValidHost(123)).toBe(false);
    });

    it('should check valid timeout', () => {
      expect(ConfigUtils.isValidTimeout(30000)).toBe(true);
      expect(ConfigUtils.isValidTimeout(-1000)).toBe(false);
      expect(ConfigUtils.isValidTimeout(500000)).toBe(false);
    });

    it('should sanitize configuration', () => {
      const dirtyConfig = {
        port: 3000, // Valid
        host: 'localhost', // Valid
        invalidField: 'should be removed', // Invalid
        debug: 'not a boolean', // Invalid type
      };

      const sanitized = ConfigUtils.sanitize(dirtyConfig);

      expect(sanitized).toEqual({
        port: 3000,
        host: 'localhost',
      });
      expect(sanitized).not.toHaveProperty('invalidField');
      expect(sanitized).not.toHaveProperty('debug');
    });
  });

  describe('ConfigurationError', () => {
    it('should create proper error object', () => {
      const error = new ConfigurationError('Test error', 'port', -1);

      expect(error.name).toBe('ConfigurationError');
      expect(error.message).toBe('Test error');
      expect(error.field).toBe('port');
      expect(error.value).toBe(-1);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex configuration scenarios', () => {
      const complexConfig = {
        port: 8080,
        host: '0.0.0.0',
        debug: true,
        trustProxy: true,
        maxBodySize: 5 * 1024 * 1024, // 5MB
        timeout: 60000,
        cors: false,
        static: 'assets',
        template: {
          engine: 'mustache',
          directory: 'templates',
        },
        keepAlive: 15000,
      };

      const config = createSafeConfiguration(complexConfig);

      expect(config).toEqual(complexConfig);
    });

    it('should handle partial configuration with validation', () => {
      const partialConfig = {
        port: 4000,
        debug: true,
        invalidOption: 'remove me',
      };

      // This should throw due to invalid option
      expect(() => {
        createSafeConfiguration(partialConfig);
      }).toThrow(ConfigurationError);

      // But sanitized version should work
      const sanitized = ConfigUtils.sanitize(partialConfig);
      const config = createSafeConfiguration(sanitized);

      expect(config.port).toBe(4000);
      expect(config.debug).toBe(true);
      expect(config.host).toBe('localhost'); // Default
    });
  });
});
