/**
 * @nextrush/template - Adapter Tests
 *
 * Tests for the template engine adapter system.
 * Tests the unified adapter API and built-in adapter functionality.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    createAdapter,
    createBuiltinAdapter,
    getAvailableEngines,
    hasAdapter,
    registerAdapter,
    type TemplateAdapter,
} from '../adapters';

const TEST_VIEWS_DIR = join(process.cwd(), '.test-views-adapters');

describe('Template Adapters', () => {
  describe('createAdapter', () => {
    it('should create builtin adapter by default', () => {
      const adapter = createAdapter();
      expect(adapter.name).toBe('builtin');
    });

    it('should create adapter by name', () => {
      const adapter = createAdapter('builtin', { root: './views' });
      expect(adapter.name).toBe('builtin');
    });

    it('should throw for unknown engine', () => {
      expect(() => createAdapter('unknown' as 'builtin')).toThrow('Unknown template engine');
    });

    it('should list available engines in error', () => {
      try {
        createAdapter('unknown' as 'builtin');
      } catch (error) {
        expect((error as Error).message).toContain('builtin');
        expect((error as Error).message).toContain('ejs');
        expect((error as Error).message).toContain('handlebars');
      }
    });
  });

  describe('hasAdapter', () => {
    it('should return true for builtin adapter', () => {
      expect(hasAdapter('builtin')).toBe(true);
    });

    it('should return true for registered adapters', () => {
      expect(hasAdapter('ejs')).toBe(true);
      expect(hasAdapter('handlebars')).toBe(true);
      expect(hasAdapter('nunjucks')).toBe(true);
      expect(hasAdapter('pug')).toBe(true);
      expect(hasAdapter('eta')).toBe(true);
    });

    it('should return false for unknown adapter', () => {
      expect(hasAdapter('unknown')).toBe(false);
    });
  });

  describe('getAvailableEngines', () => {
    it('should return all available engines', () => {
      const engines = getAvailableEngines();
      expect(engines).toContain('builtin');
      expect(engines).toContain('ejs');
      expect(engines).toContain('handlebars');
      expect(engines).toContain('nunjucks');
      expect(engines).toContain('pug');
      expect(engines).toContain('eta');
    });
  });

  describe('registerAdapter', () => {
    it('should register custom adapter', () => {
      const customAdapter: TemplateAdapter = {
        name: 'custom',
        render: () => 'custom rendered',
        renderAsync: async () => 'custom rendered async',
        renderFile: async () => 'custom file rendered',
        registerHelper: () => {},
        clearCache: () => {},
      };

      registerAdapter('custom', () => customAdapter);
      expect(hasAdapter('custom')).toBe(true);

      const adapter = createAdapter('custom' as 'builtin');
      expect(adapter.name).toBe('custom');
      expect(adapter.render('test')).toBe('custom rendered');
    });
  });

  describe('Built-in Adapter', () => {
    let adapter: TemplateAdapter;

    beforeEach(() => {
      adapter = createBuiltinAdapter({
        root: TEST_VIEWS_DIR,
        ext: '.html',
        cache: false,
      });
    });

    describe('render', () => {
      it('should render simple template', () => {
        const result = adapter.render('Hello {{name}}!', { name: 'World' });
        expect(result).toBe('Hello World!');
      });

      it('should escape HTML by default', () => {
        const result = adapter.render('{{text}}', { text: '<script>alert("xss")</script>' });
        expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      });

      it('should not escape with triple mustache', () => {
        const result = adapter.render('{{{html}}}', { html: '<b>bold</b>' });
        expect(result).toBe('<b>bold</b>');
      });

      it('should handle nested properties', () => {
        const result = adapter.render('{{user.name}}', { user: { name: 'John' } });
        expect(result).toBe('John');
      });

      it('should handle helpers', () => {
        const result = adapter.render('{{name | upper}}', { name: 'hello' });
        expect(result).toBe('HELLO');
      });

      it('should handle block helpers', () => {
        const result = adapter.render('{{#if show}}visible{{/if}}', { show: true });
        expect(result).toBe('visible');
      });

      it('should handle each block', () => {
        const result = adapter.render('{{#each items}}{{this}},{{/each}}', { items: ['a', 'b', 'c'] });
        expect(result).toBe('a,b,c,');
      });
    });

    describe('renderAsync', () => {
      it('should render async', async () => {
        const result = await adapter.renderAsync('Hello {{name}}!', { name: 'Async' });
        expect(result).toBe('Hello Async!');
      });
    });

    describe('registerHelper', () => {
      it('should register custom helper', () => {
        adapter.registerHelper('shout', (value: unknown) => String(value).toUpperCase() + '!!!');
        const result = adapter.render('{{msg | shout}}', { msg: 'hello' });
        expect(result).toBe('HELLO!!!');
      });
    });
  });

  describe('Built-in Adapter File Operations', () => {
    let adapter: TemplateAdapter;

    beforeEach(async () => {
      await mkdir(TEST_VIEWS_DIR, { recursive: true });
      adapter = createBuiltinAdapter({
        root: TEST_VIEWS_DIR,
        ext: '.html',
        cache: false,
      });
    });

    afterEach(async () => {
      try {
        await rm(TEST_VIEWS_DIR, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should render template file', async () => {
      await writeFile(join(TEST_VIEWS_DIR, 'hello.html'), 'Hello {{name}}!');
      const result = await adapter.renderFile('hello', { name: 'File' });
      expect(result).toBe('Hello File!');
    });

    it('should add extension if not provided', async () => {
      await writeFile(join(TEST_VIEWS_DIR, 'test.html'), 'Test: {{value}}');
      const result = await adapter.renderFile('test', { value: '123' });
      expect(result).toBe('Test: 123');
    });

    it('should support layouts', async () => {
      await writeFile(join(TEST_VIEWS_DIR, 'layout.html'), '<html>{{{body}}}</html>');
      await writeFile(join(TEST_VIEWS_DIR, 'page.html'), '<h1>{{title}}</h1>');
      const result = await adapter.renderFile('page', { title: 'Welcome' }, { layout: 'layout' });
      expect(result).toBe('<html><h1>Welcome</h1></html>');
    });
  });

  describe('Built-in Adapter Security', () => {
    let adapter: TemplateAdapter;

    beforeEach(async () => {
      await mkdir(TEST_VIEWS_DIR, { recursive: true });
      adapter = createBuiltinAdapter({
        root: TEST_VIEWS_DIR,
        ext: '.html',
        cache: false,
      });
    });

    afterEach(async () => {
      try {
        await rm(TEST_VIEWS_DIR, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    describe('Path Traversal Prevention', () => {
      it('should reject path with .. segments', async () => {
        await writeFile(join(TEST_VIEWS_DIR, 'test.html'), 'Test');
        await expect(adapter.renderFile('../test', {})).rejects.toThrow(/Path traversal detected/);
      });

      it('should reject path with multiple .. segments', async () => {
        await expect(adapter.renderFile('../../etc/passwd', {})).rejects.toThrow(/Path traversal detected/);
      });

      it('should reject absolute paths outside root', async () => {
        await expect(adapter.renderFile('/etc/passwd', {})).rejects.toThrow(/Path traversal detected/);
      });

      it('should reject encoded path traversal attempts', async () => {
        // Normalized paths should still be caught
        await expect(adapter.renderFile('subdir/../../../etc/passwd', {})).rejects.toThrow(/Path traversal detected/);
      });

      it('should allow valid subdirectory paths', async () => {
        const subdir = join(TEST_VIEWS_DIR, 'subdir');
        await mkdir(subdir, { recursive: true });
        await writeFile(join(subdir, 'nested.html'), 'Nested: {{value}}');
        const result = await adapter.renderFile('subdir/nested', { value: 'test' });
        expect(result).toBe('Nested: test');
      });
    });
  });

  describe('Adapter Interface Compliance', () => {
    it('builtin adapter should have all required methods', () => {
      const adapter = createBuiltinAdapter();
      expect(adapter.name).toBe('builtin');
      expect(typeof adapter.render).toBe('function');
      expect(typeof adapter.renderAsync).toBe('function');
      expect(typeof adapter.renderFile).toBe('function');
      expect(typeof adapter.registerHelper).toBe('function');
      expect(typeof adapter.clearCache).toBe('function');
    });
  });

  describe('Optional Engine Adapters', () => {
    it('should create ejs adapter', () => {
      const adapter = createAdapter('ejs');
      expect(adapter.name).toBe('ejs');
    });

    it('should create handlebars adapter', () => {
      const adapter = createAdapter('handlebars');
      expect(adapter.name).toBe('handlebars');
    });

    it('should create nunjucks adapter', () => {
      const adapter = createAdapter('nunjucks');
      expect(adapter.name).toBe('nunjucks');
    });

    it('should create pug adapter', () => {
      const adapter = createAdapter('pug');
      expect(adapter.name).toBe('pug');
    });

    it('should create eta adapter', () => {
      const adapter = createAdapter('eta');
      expect(adapter.name).toBe('eta');
    });
  });
});
