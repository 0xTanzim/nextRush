/**
 * @fileoverview Tests for plugins index exports
 * @module tests/unit/plugins/index
 */

import { describe, expect, it } from 'vitest';

describe('Plugins Index', () => {
  describe('Module Exports', () => {
    it('should export BasePlugin', async () => {
      const { BasePlugin } = await import('../../../plugins/index');
      expect(BasePlugin).toBeDefined();
      expect(typeof BasePlugin).toBe('function');
    });

    it('should export LoggerPlugin', async () => {
      const { LoggerPlugin } = await import('../../../plugins/index');
      expect(LoggerPlugin).toBeDefined();
      expect(typeof LoggerPlugin).toBe('function');
    });

    it('should export StaticFilesPlugin', async () => {
      const { StaticFilesPlugin } = await import('../../../plugins/index');
      expect(StaticFilesPlugin).toBeDefined();
      expect(typeof StaticFilesPlugin).toBe('function');
    });

    it('should export TemplatePlugin', async () => {
      const { TemplatePlugin } = await import('../../../plugins/index');
      expect(TemplatePlugin).toBeDefined();
      expect(typeof TemplatePlugin).toBe('function');
    });

    it('should export WebSocketPlugin', async () => {
      const { WebSocketPlugin } = await import('../../../plugins/index');
      expect(WebSocketPlugin).toBeDefined();
      expect(typeof WebSocketPlugin).toBe('function');
    });

    it('should export all plugins correctly', async () => {
      const pluginExports = await import('../../../plugins/index');

      expect(Object.keys(pluginExports)).toContain('BasePlugin');
      expect(Object.keys(pluginExports)).toContain('LoggerPlugin');
      expect(Object.keys(pluginExports)).toContain('StaticFilesPlugin');
      expect(Object.keys(pluginExports)).toContain('TemplatePlugin');
      expect(Object.keys(pluginExports)).toContain('WebSocketPlugin');
    });
  });
});
