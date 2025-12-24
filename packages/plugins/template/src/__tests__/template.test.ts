/**
 * @nextrush/template - Test Suite
 *
 * Tests for parser, compiler, helpers, and engine.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';
import { compile } from '../compiler';
import { createEngine } from '../engine';
import * as helpers from '../helpers';
import {
  parse,
  TemplateParseError,
  validate,
} from '../parser';
import type {
  BlockNode,
  CommentNode,
  PartialNode,
  RawNode,
  TextNode,
  VariableNode,
} from '../template.types';

// ============================================================================
// Parser Tests
// ============================================================================

describe('Template Parser', () => {
  describe('parse()', () => {
    describe('Text Nodes', () => {
      it('should parse plain text', () => {
        const ast = parse('Hello World');
        expect(ast.type).toBe('root');
        expect(ast.body).toHaveLength(1);
        expect(ast.body[0]!.type).toBe('text');
        expect((ast.body[0] as TextNode).value).toBe('Hello World');
      });

      it('should parse empty string', () => {
        const ast = parse('');
        expect(ast.body).toHaveLength(0);
      });

      it('should preserve whitespace', () => {
        const ast = parse('  hello  \n  world  ');
        expect((ast.body[0] as TextNode).value).toBe('  hello  \n  world  ');
      });
    });

    describe('Variable Nodes', () => {
      it('should parse simple variable', () => {
        const ast = parse('{{name}}');
        expect(ast.body).toHaveLength(1);
        const node = ast.body[0] as VariableNode;
        expect(node.type).toBe('variable');
        expect(node.name).toBe('name');
        expect(node.escaped).toBe(true);
      });

      it('should parse variable with whitespace', () => {
        const ast = parse('{{ name }}');
        const node = ast.body[0] as VariableNode;
        expect(node.name).toBe('name');
      });

      it('should parse nested property access', () => {
        const ast = parse('{{user.name}}');
        const node = ast.body[0] as VariableNode;
        expect(node.name).toBe('user.name');
      });

      it('should parse unescaped variable with &', () => {
        const ast = parse('{{& html}}');
        const node = ast.body[0] as VariableNode;
        expect(node.name).toBe('html');
        expect(node.escaped).toBe(false);
      });

      it('should parse variable with pipe helper', () => {
        const ast = parse('{{name | upper}}');
        const node = ast.body[0] as VariableNode;
        expect(node.name).toBe('name');
        expect(node.helpers).toHaveLength(1);
        expect(node.helpers[0]!.name).toBe('upper');
      });

      it('should parse variable with multiple pipe helpers', () => {
        const ast = parse('{{name | trim | upper | truncate 10}}');
        const node = ast.body[0] as VariableNode;
        expect(node.helpers).toHaveLength(3);
        expect(node.helpers[0]!.name).toBe('trim');
        expect(node.helpers[1]!.name).toBe('upper');
        expect(node.helpers[2]!.name).toBe('truncate');
      });

      it('should parse helper with string argument', () => {
        const ast = parse('{{date | formatDate "YYYY-MM-DD"}}');
        const node = ast.body[0] as VariableNode;
        expect(node.helpers[0]!.args[0]).toEqual({ type: 'string', value: 'YYYY-MM-DD' });
      });

      it('should parse helper with number argument', () => {
        const ast = parse('{{text | truncate 50}}');
        const node = ast.body[0] as VariableNode;
        expect(node.helpers[0]!.args[0]).toEqual({ type: 'number', value: 50 });
      });
    });

    describe('Raw Output Nodes', () => {
      it('should parse triple mustache as raw', () => {
        const ast = parse('{{{html}}}');
        const node = ast.body[0] as RawNode;
        expect(node.type).toBe('raw');
        expect(node.name).toBe('html');
      });

      it('should parse raw with whitespace', () => {
        const ast = parse('{{{ content }}}');
        const node = ast.body[0] as RawNode;
        expect(node.name).toBe('content');
      });
    });

    describe('Block Nodes', () => {
      it('should parse simple if block', () => {
        const ast = parse('{{#if show}}content{{/if}}');
        const node = ast.body[0] as BlockNode;
        expect(node.type).toBe('block');
        expect(node.name).toBe('if');
        expect(node.expression).toBe('show');
        expect(node.body).toHaveLength(1);
        expect((node.body[0] as TextNode).value).toBe('content');
      });

      it('should parse unless block', () => {
        const ast = parse('{{#unless hidden}}visible{{/unless}}');
        const node = ast.body[0] as BlockNode;
        expect(node.name).toBe('unless');
        expect(node.expression).toBe('hidden');
      });

      it('should parse each block', () => {
        const ast = parse('{{#each items}}{{name}}{{/each}}');
        const node = ast.body[0] as BlockNode;
        expect(node.name).toBe('each');
        expect(node.expression).toBe('items');
        expect(node.body).toHaveLength(1);
      });

      it('should parse with block', () => {
        const ast = parse('{{#with user}}{{name}}{{/with}}');
        const node = ast.body[0] as BlockNode;
        expect(node.name).toBe('with');
        expect(node.expression).toBe('user');
      });

      it('should parse nested blocks', () => {
        const ast = parse('{{#if a}}{{#if b}}nested{{/if}}{{/if}}');
        const outerBlock = ast.body[0] as BlockNode;
        expect(outerBlock.name).toBe('if');
        const innerBlock = outerBlock.body[0] as BlockNode;
        expect(innerBlock.name).toBe('if');
        expect((innerBlock.body[0] as TextNode).value).toBe('nested');
      });
    });

    describe('Partial Nodes', () => {
      it('should parse simple partial', () => {
        const ast = parse('{{> header}}');
        const node = ast.body[0] as PartialNode;
        expect(node.type).toBe('partial');
        expect(node.name).toBe('header');
      });

      it('should parse partial with context', () => {
        const ast = parse('{{> userCard user}}');
        const node = ast.body[0] as PartialNode;
        expect(node.name).toBe('userCard');
        expect(node.context).toBe('user');
      });
    });

    describe('Comment Nodes', () => {
      it('should parse comment', () => {
        const ast = parse('{{! This is a comment }}');
        const node = ast.body[0] as CommentNode;
        expect(node.type).toBe('comment');
        expect(node.value).toBe('This is a comment');
      });

      it('should parse empty comment', () => {
        const ast = parse('{{!}}');
        const node = ast.body[0] as CommentNode;
        expect(node.value).toBe('');
      });
    });

    describe('Mixed Content', () => {
      it('should parse text and variables mixed', () => {
        const ast = parse('Hello {{name}}, welcome!');
        expect(ast.body).toHaveLength(3);
        expect((ast.body[0] as TextNode).value).toBe('Hello ');
        expect((ast.body[1] as VariableNode).name).toBe('name');
        expect((ast.body[2] as TextNode).value).toBe(', welcome!');
      });
    });

    describe('Error Handling', () => {
      it('should throw on unclosed tag', () => {
        expect(() => parse('{{name')).toThrow(TemplateParseError);
      });

      it('should throw on unexpected closing tag', () => {
        expect(() => parse('{{/if}}')).toThrow(TemplateParseError);
      });

      it('should throw on unclosed block', () => {
        expect(() => parse('{{#if show}}content')).toThrow(TemplateParseError);
      });

      it('should throw on mismatched block close', () => {
        expect(() => parse('{{#if show}}content{{/each}}')).toThrow(TemplateParseError);
      });
    });

    describe('Custom Delimiters', () => {
      it('should parse with custom delimiters', () => {
        const ast = parse('<%name%>', { delimiters: ['<%', '%>'] });
        const node = ast.body[0] as VariableNode;
        expect(node.name).toBe('name');
      });
    });
  });

  describe('validate()', () => {
    it('should return true for valid template', () => {
      expect(validate('{{name}}')).toBe(true);
    });

    it('should throw for invalid template', () => {
      expect(() => validate('{{name')).toThrow(TemplateParseError);
    });
  });
});

// ============================================================================
// Compiler Tests
// ============================================================================

describe('Template Compiler', () => {
  describe('compile()', () => {
    it('should compile and render simple text', () => {
      const template = compile('Hello World');
      expect(template.render({})).toBe('Hello World');
    });

    it('should compile and render variable', () => {
      const template = compile('Hello {{name}}');
      expect(template.render({ name: 'John' })).toBe('Hello John');
    });

    it('should escape HTML by default', () => {
      const template = compile('{{html}}');
      expect(template.render({ html: '<script>alert("xss")</script>' }))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should not escape with triple mustache', () => {
      const template = compile('{{{html}}}');
      expect(template.render({ html: '<b>bold</b>' })).toBe('<b>bold</b>');
    });

    it('should not escape with &', () => {
      const template = compile('{{& html}}');
      expect(template.render({ html: '<em>emphasis</em>' })).toBe('<em>emphasis</em>');
    });

    it('should handle undefined values', () => {
      const template = compile('{{missing}}');
      expect(template.render({})).toBe('');
    });

    it('should handle null values', () => {
      const template = compile('{{value}}');
      expect(template.render({ value: null })).toBe('');
    });

    it('should handle number values', () => {
      const template = compile('Count: {{count}}');
      expect(template.render({ count: 42 })).toBe('Count: 42');
    });

    it('should access nested properties', () => {
      const template = compile('{{user.name}}');
      expect(template.render({ user: { name: 'Alice' } })).toBe('Alice');
    });

    it('should return empty for missing nested path', () => {
      const template = compile('{{a.b.c}}');
      expect(template.render({ a: {} })).toBe('');
    });
  });

  describe('Block Helpers', () => {
    describe('#if', () => {
      it('should render body when truthy', () => {
        const template = compile('{{#if show}}yes{{/if}}');
        expect(template.render({ show: true })).toBe('yes');
        expect(template.render({ show: 'truthy' })).toBe('yes');
        expect(template.render({ show: 1 })).toBe('yes');
      });

      it('should not render body when falsy', () => {
        const template = compile('{{#if show}}yes{{/if}}');
        expect(template.render({ show: false })).toBe('');
        expect(template.render({ show: null })).toBe('');
        expect(template.render({ show: 0 })).toBe('');
      });
    });

    describe('#unless', () => {
      it('should render body when falsy', () => {
        const template = compile('{{#unless hidden}}visible{{/unless}}');
        expect(template.render({ hidden: false })).toBe('visible');
      });

      it('should not render body when truthy', () => {
        const template = compile('{{#unless hidden}}visible{{/unless}}');
        expect(template.render({ hidden: true })).toBe('');
      });
    });

    describe('#each', () => {
      it('should iterate over array', () => {
        const template = compile('{{#each items}}{{this}}{{/each}}');
        expect(template.render({ items: ['a', 'b', 'c'] })).toBe('abc');
      });

      it('should iterate with object properties', () => {
        const template = compile('{{#each items}}{{name}}{{/each}}');
        expect(template.render({ items: [{ name: 'A' }, { name: 'B' }] })).toBe('AB');
      });

      it('should provide @index', () => {
        const template = compile('{{#each items}}{{@index}}{{/each}}');
        expect(template.render({ items: ['a', 'b', 'c'] })).toBe('012');
      });

      it('should iterate over object', () => {
        const template = compile('{{#each obj}}{{@key}}:{{this}} {{/each}}');
        const result = template.render({ obj: { a: 1, b: 2 } });
        expect(result).toContain('a:1');
        expect(result).toContain('b:2');
      });
    });

    describe('#with', () => {
      it('should change context', () => {
        const template = compile('{{#with user}}{{name}}{{/with}}');
        expect(template.render({ user: { name: 'Bob' } })).toBe('Bob');
      });
    });
  });

  describe('Helpers (pipe syntax)', () => {
    it('should apply upper helper', () => {
      const template = compile('{{name | upper}}');
      expect(template.render({ name: 'john' })).toBe('JOHN');
    });

    it('should apply lower helper', () => {
      const template = compile('{{name | lower}}');
      expect(template.render({ name: 'JOHN' })).toBe('john');
    });

    it('should apply capitalize helper', () => {
      const template = compile('{{name | capitalize}}');
      expect(template.render({ name: 'john' })).toBe('John');
    });

    it('should chain helpers', () => {
      const template = compile('{{name | trim | upper}}');
      expect(template.render({ name: '  john  ' })).toBe('JOHN');
    });
  });

  describe('Comments', () => {
    it('should strip comments from output', () => {
      const template = compile('{{! This is a comment }}Hello');
      expect(template.render({})).toBe('Hello');
    });
  });

  describe('Custom Helpers', () => {
    it('should use custom helpers', () => {
      const template = compile('{{value | double}}', {
        helpers: {
          double: (v) => (Number(v) * 2).toString()
        }
      });
      expect(template.render({ value: 5 })).toBe('10');
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in text', () => {
      const template = compile('Special: & < > " \' $');
      expect(template.render({})).toBe('Special: & < > " \' $');
    });

    it('should handle newlines in templates', () => {
      const template = compile('Line 1\nLine 2\nLine 3');
      expect(template.render({})).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should handle this reference', () => {
      const template = compile('{{#each items}}{{this}}{{/each}}');
      expect(template.render({ items: [1, 2, 3] })).toBe('123');
    });
  });
});

// ============================================================================
// Helpers Tests
// ============================================================================

describe('Built-in Helpers', () => {
  describe('String Helpers', () => {
    it('upper should convert to uppercase', () => {
      expect(helpers.upper('hello')).toBe('HELLO');
      expect(helpers.upper(null)).toBe('');
      expect(helpers.upper(123)).toBe('123');
    });

    it('lower should convert to lowercase', () => {
      expect(helpers.lower('HELLO')).toBe('hello');
    });

    it('capitalize should capitalize first letter', () => {
      expect(helpers.capitalize('hello')).toBe('Hello');
    });

    it('titleCase should title case string', () => {
      expect(helpers.titleCase('hello world')).toBe('Hello World');
    });

    it('trim should remove whitespace', () => {
      expect(helpers.trim('  hello  ')).toBe('hello');
    });

    it('truncate should limit length with custom suffix', () => {
      expect(helpers.truncate('hello world', 5, '...')).toBe('he...');
      expect(helpers.truncate('hi', 10)).toBe('hi');
    });

    it('replace should replace substring', () => {
      expect(helpers.replace('hello', 'l', 'L')).toBe('heLLo');
    });

    it('padStart should pad string', () => {
      expect(helpers.padStart('5', 3, '0')).toBe('005');
    });

    it('padEnd should pad string', () => {
      expect(helpers.padEnd('5', 3, '0')).toBe('500');
    });

    it('stripHtml should remove HTML tags', () => {
      expect(helpers.stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World');
    });

    it('split should split string', () => {
      expect(helpers.split('a,b,c', ',')).toEqual(['a', 'b', 'c']);
    });

    it('join should join array', () => {
      expect(helpers.join(['a', 'b', 'c'], '-')).toBe('a-b-c');
    });

    it('reverse should reverse string', () => {
      expect(helpers.reverse('hello')).toBe('olleh');
    });

    it('length should return length', () => {
      expect(helpers.length('hello')).toBe(5);
      expect(helpers.length([1, 2, 3])).toBe(3);
    });
  });

  describe('Number Helpers', () => {
    it('round should round number', () => {
      expect(helpers.round(3.7)).toBe(4);
      expect(helpers.round(3.456, 2)).toBe(3.46);
    });

    it('floor should floor number', () => {
      expect(helpers.floor(3.7)).toBe(3);
    });

    it('ceil should ceil number', () => {
      expect(helpers.ceil(3.2)).toBe(4);
    });

    it('abs should return absolute value', () => {
      expect(helpers.abs(-5)).toBe(5);
    });

    it('add should add numbers', () => {
      expect(helpers.add(5, 3)).toBe(8);
    });

    it('subtract should subtract numbers', () => {
      expect(helpers.subtract(5, 3)).toBe(2);
    });

    it('multiply should multiply numbers', () => {
      expect(helpers.multiply(5, 3)).toBe(15);
    });

    it('divide should divide numbers', () => {
      expect(helpers.divide(15, 3)).toBe(5);
    });

    it('mod should return modulo', () => {
      expect(helpers.mod(7, 3)).toBe(1);
    });
  });

  describe('Array Helpers', () => {
    it('first should return first element', () => {
      expect(helpers.first([1, 2, 3])).toBe(1);
      expect(helpers.first([])).toBe(undefined);
    });

    it('last should return last element', () => {
      expect(helpers.last([1, 2, 3])).toBe(3);
    });

    it('at should return element at index', () => {
      expect(helpers.at([1, 2, 3], 1)).toBe(2);
    });

    it('slice should slice array', () => {
      expect(helpers.slice([1, 2, 3, 4], 1, 3)).toEqual([2, 3]);
    });

    it('unique should filter unique values', () => {
      expect(helpers.unique([1, 2, 2, 3])).toEqual([1, 2, 3]);
    });

    it('compact should remove falsy values', () => {
      expect(helpers.compact([0, 1, false, 2, '', 3])).toEqual([1, 2, 3]);
    });

    it('includes should check inclusion', () => {
      expect(helpers.includes([1, 2, 3], 2)).toBe(true);
      expect(helpers.includes([1, 2, 3], 4)).toBe(false);
    });

    it('indexOf should find index', () => {
      expect(helpers.indexOf([1, 2, 3], 2)).toBe(1);
      expect(helpers.indexOf([1, 2, 3], 4)).toBe(-1);
    });
  });

  describe('Object Helpers', () => {
    it('keys should return keys', () => {
      expect(helpers.keys({ a: 1, b: 2 })).toEqual(['a', 'b']);
    });

    it('values should return values', () => {
      expect(helpers.values({ a: 1, b: 2 })).toEqual([1, 2]);
    });

    it('entries should return entries', () => {
      expect(helpers.entries({ a: 1 })).toEqual([['a', 1]]);
    });

    it('get should get nested path', () => {
      expect(helpers.get({ a: { b: { c: 1 } } }, 'a.b.c')).toBe(1);
      expect(helpers.get({ a: {} }, 'a.b.c', 'default')).toBe('default');
    });
  });

  describe('Comparison Helpers', () => {
    it('eq should check equality', () => {
      expect(helpers.eq(1, 1)).toBe(true);
      expect(helpers.eq(1, 2)).toBe(false);
    });

    it('ne should check inequality', () => {
      expect(helpers.ne(1, 2)).toBe(true);
      expect(helpers.ne(1, 1)).toBe(false);
    });

    it('lt should check less than', () => {
      expect(helpers.lt(1, 2)).toBe(true);
      expect(helpers.lt(2, 1)).toBe(false);
    });

    it('gt should check greater than', () => {
      expect(helpers.gt(2, 1)).toBe(true);
      expect(helpers.gt(1, 2)).toBe(false);
    });

    it('and should check both conditions', () => {
      expect(helpers.and(true, true)).toBe(true);
      expect(helpers.and(true, false)).toBe(false);
    });

    it('or should check either condition', () => {
      expect(helpers.or(true, false)).toBe(true);
      expect(helpers.or(false, false)).toBe(false);
    });

    it('not should negate', () => {
      expect(helpers.not(true)).toBe(false);
      expect(helpers.not(false)).toBe(true);
    });
  });

  describe('Type Helpers', () => {
    it('isArray should check array', () => {
      expect(helpers.isArray([])).toBe(true);
      expect(helpers.isArray({})).toBe(false);
    });

    it('isObject should check object', () => {
      expect(helpers.isObject({})).toBe(true);
      expect(helpers.isObject([])).toBe(false);
      expect(helpers.isObject(null)).toBe(false);
    });

    it('isString should check string', () => {
      expect(helpers.isString('hello')).toBe(true);
      expect(helpers.isString(123)).toBe(false);
    });

    it('isNumber should check number', () => {
      expect(helpers.isNumber(123)).toBe(true);
      expect(helpers.isNumber('123')).toBe(false);
    });

    it('isEmpty should check empty', () => {
      expect(helpers.isEmpty('')).toBe(true);
      expect(helpers.isEmpty([])).toBe(true);
      expect(helpers.isEmpty({})).toBe(true);
      expect(helpers.isEmpty(null)).toBe(true);
      expect(helpers.isEmpty('a')).toBe(false);
    });
  });

  describe('Output Helpers', () => {
    it('json should stringify', () => {
      expect(helpers.json({ a: 1 })).toBe('{"a":1}');
      expect(helpers.json({ a: 1 }, 2)).toBe('{\n  "a": 1\n}');
    });

    it('safe should return value', () => {
      expect(helpers.safe('<b>bold</b>')).toBe('<b>bold</b>');
    });

    it('defaultValue should return fallback', () => {
      expect(helpers.defaultValue(null, 'fallback')).toBe('fallback');
      expect(helpers.defaultValue('value', 'fallback')).toBe('value');
    });

    it('conditional should return based on condition', () => {
      expect(helpers.conditional(true, 'yes', 'no')).toBe('yes');
      expect(helpers.conditional(false, 'yes', 'no')).toBe('no');
    });
  });
});

// ============================================================================
// Engine Tests
// ============================================================================

describe('Template Engine', () => {
  describe('createEngine()', () => {
    it('should create engine with defaults', () => {
      const engine = createEngine();
      expect(engine).toBeDefined();
      expect(engine.compile).toBeInstanceOf(Function);
      expect(engine.render).toBeInstanceOf(Function);
    });

    it('should compile string template', async () => {
      const engine = createEngine();
      const result = await engine.renderString('{{name}}', { name: 'Test' });
      expect(result).toBe('Test');
    });

    it('should register and render partial', async () => {
      const engine = createEngine();
      engine.registerPartial('greeting', 'Hello {{name}}');
      const result = await engine.renderString('{{> greeting}}', { name: 'World' });
      expect(result).toBe('Hello World');
    });

    it('should register custom helper', async () => {
      const engine = createEngine();
      engine.registerHelper('shout', (v) => String(v).toUpperCase() + '!');
      const result = await engine.renderString('{{name | shout}}', { name: 'hello' });
      expect(result).toBe('HELLO!');
    });

    it('should clear cache', () => {
      const engine = createEngine({ cache: true });
      engine.clearCache();
      // Should not throw
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration Tests', () => {
  it('should render a page with partials', async () => {
    const engine = createEngine();

    engine.registerPartial('header', '<header>{{title}}</header>');
    engine.registerPartial('footer', '<footer>© {{year}}</footer>');

    const template = `
{{> header}}
<main>{{content}}</main>
{{> footer}}
    `.trim();

    const result = await engine.renderString(template, {
      title: 'My App',
      year: 2024,
      content: 'Hello World'
    });

    expect(result).toContain('<header>My App</header>');
    expect(result).toContain('<main>Hello World</main>');
    expect(result).toContain('<footer>© 2024</footer>');
  });

  it('should properly escape XSS attempts', () => {
    const template = compile('{{comment}}');
    const result = template.render({
      comment: '<script>alert("XSS")</script>'
    });

    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('should handle complex nested iteration', () => {
    const template = compile(`
{{#each departments}}
<h2>{{name}}</h2>
{{#each employees}}
<p>{{name}} - {{title}}</p>
{{/each}}
{{/each}}
    `.trim());

    const data = {
      departments: [
        {
          name: 'Engineering',
          employees: [
            { name: 'Alice', title: 'Senior Dev' },
            { name: 'Bob', title: 'Junior Dev' }
          ]
        },
        {
          name: 'Design',
          employees: [
            { name: 'Carol', title: 'Lead Designer' }
          ]
        }
      ]
    };

    const result = template.render(data);

    expect(result).toContain('<h2>Engineering</h2>');
    expect(result).toContain('<h2>Design</h2>');
    expect(result).toContain('<p>Alice - Senior Dev</p>');
    expect(result).toContain('<p>Carol - Lead Designer</p>');
  });
});

// ============================================================================
// Advanced Edge Cases Tests
// ============================================================================

describe('Advanced Edge Cases', () => {
  describe('Nested Blocks', () => {
    it('should handle deeply nested if blocks', () => {
      const template = compile(`
{{#if a}}
  {{#if b}}
    {{#if c}}
      deep
    {{/if}}
  {{/if}}
{{/if}}
      `.trim());
      expect(template.render({ a: true, b: true, c: true })).toContain('deep');
      expect(template.render({ a: true, b: true, c: false })).not.toContain('deep');
    });

    it('should handle nested each with different contexts', () => {
      const template = compile(`
{{#each users}}
{{name}}:{{#each ../roles}}{{this}}{{/each}}
{{/each}}
      `.trim());
      const result = template.render({
        users: [{ name: 'Alice' }, { name: 'Bob' }],
        roles: ['admin', 'user']
      });
      expect(result).toContain('Alice:');
      expect(result).toContain('Bob:');
    });

    it('should handle each inside if', () => {
      const template = compile('{{#if show}}{{#each items}}{{this}}{{/each}}{{/if}}');
      expect(template.render({ show: true, items: [1, 2, 3] })).toBe('123');
      expect(template.render({ show: false, items: [1, 2, 3] })).toBe('');
    });

    it('should handle if inside each', () => {
      const template = compile('{{#each items}}{{#if active}}{{name}}{{/if}}{{/each}}');
      const data = {
        items: [
          { name: 'A', active: true },
          { name: 'B', active: false },
          { name: 'C', active: true }
        ]
      };
      expect(template.render(data)).toBe('AC');
    });
  });

  describe('Special Variables', () => {
    it('should access @root from nested context', () => {
      const template = compile('{{#with user}}{{@root.siteName}}: {{name}}{{/with}}');
      expect(template.render({ siteName: 'MySite', user: { name: 'John' } })).toBe('MySite: John');
    });

    it('should access @first and @last in each', () => {
      const template = compile('{{#each items}}{{#if @first}}[{{/if}}{{this}}{{#if @last}}]{{/if}}{{/each}}');
      expect(template.render({ items: ['a', 'b', 'c'] })).toBe('[abc]');
    });

    it('should provide correct @index values', () => {
      const template = compile('{{#each items}}{{@index}}:{{this}} {{/each}}');
      expect(template.render({ items: ['a', 'b', 'c'] })).toBe('0:a 1:b 2:c ');
    });
  });

  describe('Empty and Null Values', () => {
    it('should handle empty array in each', () => {
      const template = compile('{{#each items}}{{this}}{{/each}}');
      expect(template.render({ items: [] })).toBe('');
    });

    it('should handle null in if', () => {
      const template = compile('{{#if value}}yes{{/if}}');
      expect(template.render({ value: null })).toBe('');
    });

    it('should handle undefined variables gracefully', () => {
      const template = compile('Hello {{name}}!');
      expect(template.render({})).toBe('Hello !');
    });

    it('should handle deeply nested undefined paths', () => {
      const template = compile('{{a.b.c.d.e}}');
      expect(template.render({})).toBe('');
    });

    it('should handle empty string as falsy', () => {
      const template = compile('{{#if name}}has name{{/if}}');
      expect(template.render({ name: '' })).toBe('');
    });

    it('should handle zero as falsy', () => {
      const template = compile('{{#if count}}has count{{/if}}');
      expect(template.render({ count: 0 })).toBe('');
    });
  });

  describe('Type Coercion', () => {
    it('should convert numbers to strings', () => {
      const template = compile('Value: {{value}}');
      expect(template.render({ value: 42 })).toBe('Value: 42');
    });

    it('should convert booleans to strings', () => {
      const template = compile('Active: {{active}}');
      expect(template.render({ active: true })).toBe('Active: true');
    });

    it('should handle objects in output', () => {
      const template = compile('{{{data | json}}}');
      expect(template.render({ data: { a: 1 } })).toBe('{"a":1}');
    });
  });

  describe('Whitespace Handling', () => {
    it('should preserve whitespace in text', () => {
      const template = compile('  hello  world  ');
      expect(template.render({})).toBe('  hello  world  ');
    });

    it('should handle tabs and newlines', () => {
      const template = compile('line1\n\tline2\n\t\tline3');
      expect(template.render({})).toBe('line1\n\tline2\n\t\tline3');
    });

    it('should handle whitespace around variables', () => {
      const template = compile('{{  name  }}');
      expect(template.render({ name: 'test' })).toBe('test');
    });
  });
});

// ============================================================================
// Async Rendering Tests
// ============================================================================

describe('Async Rendering', () => {
  it('should render async with renderAsync', async () => {
    const template = compile('Hello {{name}}!');
    const result = await template.renderAsync({ name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('should handle async helpers', async () => {
    const template = compile('{{value | asyncDouble}}', {
      helpers: {
        asyncDouble: async (v) => {
          await new Promise(resolve => setTimeout(resolve, 1));
          return (Number(v) * 2).toString();
        }
      }
    });
    const result = await template.renderAsync({ value: 5 });
    expect(result).toBe('10');
  });

  it('should render each blocks async', async () => {
    const template = compile('{{#each items}}{{this}}{{/each}}');
    const result = await template.renderAsync({ items: [1, 2, 3] });
    expect(result).toBe('123');
  });
});

// ============================================================================
// Security Tests
// ============================================================================

describe('Security', () => {
  describe('XSS Prevention', () => {
    it('should escape HTML in variables by default', () => {
      const template = compile('{{html}}');
      const result = template.render({ html: '<script>alert("XSS")</script>' });
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('should escape ampersands', () => {
      const template = compile('{{text}}');
      expect(template.render({ text: 'A & B' })).toBe('A &amp; B');
    });

    it('should escape quotes', () => {
      const template = compile('{{text}}');
      expect(template.render({ text: '"quoted"' })).toBe('&quot;quoted&quot;');
    });

    it('should escape single quotes', () => {
      const template = compile('{{text}}');
      expect(template.render({ text: "it's" })).toBe('it&#39;s');
    });

    it('should allow raw output with triple mustache', () => {
      const template = compile('{{{html}}}');
      const result = template.render({ html: '<b>bold</b>' });
      expect(result).toBe('<b>bold</b>');
    });

    it('should allow raw output with &', () => {
      const template = compile('{{& html}}');
      const result = template.render({ html: '<i>italic</i>' });
      expect(result).toBe('<i>italic</i>');
    });
  });

  describe('Injection Prevention', () => {
    it('should not execute JavaScript in templates', () => {
      const template = compile('{{constructor.constructor("return this")()}}');
      // Should not throw or execute code
      expect(() => template.render({})).not.toThrow();
    });

    it('should handle __proto__ safely', () => {
      const template = compile('{{__proto__}}');
      expect(() => template.render({})).not.toThrow();
    });
  });
});

// ============================================================================
// Helper Combinations Tests
// ============================================================================

describe('Helper Combinations', () => {
  it('should chain string helpers', () => {
    const template = compile('{{name | trim | upper | truncate 5 "..."}}');
    expect(template.render({ name: '  hello world  ' })).toBe('HE...');
  });

  it('should chain number helpers', () => {
    const template = compile('{{value | add 10 | multiply 2}}');
    expect(template.render({ value: 5 })).toBe('30');
  });

  it('should use default with other helpers', () => {
    const template = compile('{{name | default "Anonymous" | upper}}');
    expect(template.render({})).toBe('ANONYMOUS');
    expect(template.render({ name: 'john' })).toBe('JOHN');
  });

  it('should handle conditional helper', () => {
    const template = compile('{{active | if "Yes" "No"}}');
    expect(template.render({ active: true })).toBe('Yes');
    expect(template.render({ active: false })).toBe('No');
  });
});

// ============================================================================
// Engine Advanced Tests
// ============================================================================

describe('Engine Advanced', () => {
  it('should handle multiple partials in same template', async () => {
    const engine = createEngine();
    engine.registerPartial('a', '[A]');
    engine.registerPartial('b', '[B]');
    engine.registerPartial('c', '[C]');

    const result = await engine.renderString('{{>a}}{{>b}}{{>c}}', {});
    expect(result).toBe('[A][B][C]');
  });

  it('should handle partial with data context', async () => {
    const engine = createEngine();
    engine.registerPartial('user', '{{name}} ({{age}})');

    const result = await engine.renderString('{{>user person}}', {
      person: { name: 'John', age: 30 }
    });
    expect(result).toBe('John (30)');
  });

  it('should handle nested partials', async () => {
    const engine = createEngine();
    engine.registerPartial('inner', '{{value}}');
    engine.registerPartial('outer', '[{{>inner}}]');

    const result = await engine.renderString('{{>outer}}', { value: 'test' });
    expect(result).toBe('[test]');
  });

  it('should cache compiled templates', async () => {
    const engine = createEngine({ cache: true });

    const template = '{{name}}';
    const result1 = await engine.renderString(template, { name: 'First' });
    const result2 = await engine.renderString(template, { name: 'Second' });

    expect(result1).toBe('First');
    expect(result2).toBe('Second');
  });

  it('should work without cache', async () => {
    const engine = createEngine({ cache: false });

    const result = await engine.renderString('{{name}}', { name: 'Test' });
    expect(result).toBe('Test');
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
  describe('Parse Errors', () => {
    it('should throw on unclosed variable tag', () => {
      expect(() => parse('{{name')).toThrow(TemplateParseError);
    });

    it('should throw on mismatched block tags', () => {
      expect(() => parse('{{#if a}}{{/each}}')).toThrow(TemplateParseError);
    });

    it('should throw on orphaned closing tag', () => {
      expect(() => parse('{{/if}}')).toThrow(TemplateParseError);
    });

    it('should include line/column in error', () => {
      try {
        parse('line1\n{{name');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(TemplateParseError);
        expect((e as TemplateParseError).line).toBeDefined();
      }
    });
  });

  describe('Render Errors', () => {
    it('should not throw on missing variable', () => {
      const template = compile('{{missing}}');
      expect(() => template.render({})).not.toThrow();
    });

    it('should not throw on missing nested path', () => {
      const template = compile('{{a.b.c}}');
      expect(() => template.render({})).not.toThrow();
    });

    it('should handle helper errors gracefully', () => {
      const template = compile('{{value | badHelper}}', {
        helpers: {
          badHelper: () => { throw new Error('Helper error'); }
        }
      });
      expect(() => template.render({ value: 'test' })).toThrow();
    });
  });
});

// ============================================================================
// Real-World Scenarios Tests
// ============================================================================

describe('Real-World Scenarios', () => {
  it('should render an email template', () => {
    const template = compile(
      'Dear {{user.name | capitalize}},\n\n' +
      'Thank you for your order #{{order.id}}.\n\n' +
      'Items:\n' +
      '{{#each order.items}}\n' +
      '- {{name}} x{{quantity}} @ ${{price | round 2}}\n' +
      '{{/each}}\n\n' +
      'Total: ${{order.total | round 2}}\n\n' +
      'Best regards,\n' +
      '{{company}}'
    );

    const data = {
      user: { name: 'john' },
      order: {
        id: '12345',
        items: [
          { name: 'Widget', quantity: 2, price: 9.99 },
          { name: 'Gadget', quantity: 1, price: 24.99 }
        ],
        total: 44.97
      },
      company: 'ACME Corp'
    };

    const result = template.render(data);
    expect(result).toContain('Dear John');
    expect(result).toContain('order #12345');
    expect(result).toContain('Widget x2');
    expect(result).toContain('44.97');
  });

  it('should render a navigation menu', () => {
    const template = compile(
      '<nav>\n' +
      '{{#each items}}\n' +
      '<a href="{{url}}" class="{{#if active}}active{{/if}}">{{label}}</a>\n' +
      '{{/each}}\n' +
      '</nav>'
    );

    const data = {
      items: [
        { url: '/', label: 'Home', active: true },
        { url: '/about', label: 'About', active: false },
        { url: '/contact', label: 'Contact', active: false }
      ]
    };

    const result = template.render(data);
    expect(result).toContain('class="active"');
    expect(result).toContain('href="/"');
    expect(result).toContain('>Home</a>');
  });

  it('should render a product card', () => {
    const template = compile(
      '<div class="product">\n' +
      '  <h2>{{name}}</h2>\n' +
      '  <p class="price">${{price | round 2}}</p>\n' +
      '  {{#if onSale}}\n' +
      '  <span class="badge">SALE!</span>\n' +
      '  {{/if}}\n' +
      '  <p>{{description | truncate 100 "..."}}</p>\n' +
      '</div>'
    );

    const data = {
      name: 'Super Widget',
      price: 29.99,
      onSale: true,
      description: 'This is a really long description that should be truncated because it exceeds the maximum allowed length for the product card display area.'
    };

    const result = template.render(data);
    expect(result).toContain('<h2>Super Widget</h2>');
    expect(result).toContain('$29.99');
    expect(result).toContain('SALE!');
    expect(result).toContain('...');
  });

  it('should render a data table', () => {
    const template = compile(
      '<table>\n' +
      '<thead><tr><th>#</th><th>Name</th><th>Email</th></tr></thead>\n' +
      '<tbody>\n' +
      '{{#each users}}\n' +
      '<tr class="{{#if @first}}first{{/if}}{{#if @last}}last{{/if}}">\n' +
      '<td>{{@index | add 1}}</td>\n' +
      '<td>{{name}}</td>\n' +
      '<td>{{email}}</td>\n' +
      '</tr>\n' +
      '{{/each}}\n' +
      '</tbody>\n' +
      '</table>'
    );

    const data = {
      users: [
        { name: 'Alice', email: 'alice@example.com' },
        { name: 'Bob', email: 'bob@example.com' },
        { name: 'Carol', email: 'carol@example.com' }
      ]
    };

    const result = template.render(data);
    expect(result).toContain('class="first"');
    expect(result).toContain('class="last"');
    expect(result).toContain('<td>1</td>');
    expect(result).toContain('<td>3</td>');
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  it('should compile templates efficiently', () => {
    const template = '{{#each items}}{{name}}{{/each}}';
    const start = performance.now();

    for (let i = 0; i < 1000; i++) {
      compile(template);
    }

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(500);
  });

  it('should render efficiently', () => {
    const template = compile('{{#each items}}{{name}}{{/each}}');
    const data = { items: Array.from({ length: 100 }, (_, i) => ({ name: `Item ${i}` })) };

    const start = performance.now();

    for (let i = 0; i < 1000; i++) {
      template.render(data);
    }

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(1000);
  });

  it('should handle large datasets', () => {
    const template = compile('{{#each items}}{{name}}{{/each}}');
    const data = { items: Array.from({ length: 10000 }, (_, i) => ({ name: `Item ${i}` })) };

    const start = performance.now();
    template.render(data);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(500);
  });

  it('should handle complex nested templates', () => {
    const template = compile(
      '{{#each categories}}\n' +
      '<h2>{{name}}</h2>\n' +
      '{{#each items}}\n' +
      '<div>{{name}} - ${{price}}</div>\n' +
      '{{/each}}\n' +
      '{{/each}}'
    );

    const data = {
      categories: Array.from({ length: 10 }, (_, i) => ({
        name: `Category ${i}`,
        items: Array.from({ length: 100 }, (_, j) => ({
          name: `Item ${j}`,
          price: (Math.random() * 100).toFixed(2)
        }))
      }))
    };

    const start = performance.now();
    template.render(data);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(500);
  });
});
