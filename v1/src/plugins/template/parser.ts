/**
 * 🎨 Template Parser
 * Multi-syntax template parsing engine for NextRush
 */

import {
  ParseResult,
  TemplateContext,
  TemplateNode,
  TemplateOptions,
} from './types';
import { parseFrontmatter } from './utils';

/**
 * Ultimate Template Parser - Handles multiple template syntaxes
 */
export class UltimateTemplateParser {
  private pos = 0;
  private input = '';
  private options: TemplateOptions;

  constructor(input: string, options: TemplateOptions = {}) {
    this.input = input;
    this.options = options;
  }

  /**
   * Parse template content into AST nodes
   */
  parse(): ParseResult {
    this.pos = 0;
    const nodes: TemplateNode[] = [];
    const metadata: ParseResult['metadata'] = {
      dependencies: [],
      components: [],
      partials: [],
    };

    // Parse frontmatter for metadata
    const { content, frontmatter } = parseFrontmatter(this.input);
    this.input = content;

    if (frontmatter.layout) {
      metadata.layout = frontmatter.layout;
    }

    // Extract metadata from frontmatter
    Object.assign(metadata, {
      ...frontmatter,
      frontmatter,
    });

    // Parse template nodes
    while (this.pos < this.input.length) {
      const node = this.parseNode();
      if (node) {
        nodes.push(node);

        // Track dependencies
        if (node.type === 'component' && node.name) {
          metadata.components.push(node.name);
        }
        if (node.type === 'partial' && node.name) {
          metadata.partials.push(node.name);
        }
      }
    }

    return { nodes, metadata };
  }

  /**
   * Parse a single template node
   */
  private parseNode(): TemplateNode | null {
    // Check for template syntax
    if (this.peek(2) === '{{') {
      return this.parseHandlebarsLike();
    }

    if (this.peek(2) === '<%') {
      return this.parseJSXLike();
    }

    if (this.peek(1) === '<' && this.peekRegex(/<[A-Z]/)) {
      return this.parseComponent();
    }

    return this.parseText();
  }

  /**
   * Parse Handlebars-like syntax: {{variable}} {{#block}} {{>partial}}
   */
  private parseHandlebarsLike(): TemplateNode | null {
    if (!this.consume('{{')) return null;

    const isUnescaped = this.peek(1) === '{';
    if (isUnescaped) this.consume('{');

    const content = this.readUntil('}}').trim();

    if (isUnescaped) this.consume('}');

    // Block helpers
    if (content.startsWith('#')) {
      return this.parseBlock(content.slice(1));
    }

    // Partials
    if (content.startsWith('>')) {
      return {
        type: 'partial',
        name: content.slice(1).trim(),
      };
    }

    // Helper calls (with arguments)
    if (content.includes(' ')) {
      const parts = content.split(/\s+/);
      const helperName = parts[0];
      const args = parts.slice(1);

      // Check if this looks like a helper call (valid identifier with args)
      if (/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(helperName)) {
        return {
          type: 'helper',
          name: helperName,
          args: args,
          escape: !isUnescaped,
        };
      }
    }

    // Variables
    return {
      type: 'variable',
      key: content,
      escape: !isUnescaped,
    };
  }

  /**
   * Parse JSX-like syntax: <% if %> <% for %> <%= variable %>
   */
  private parseJSXLike(): TemplateNode | null {
    if (!this.consume('<%')) return null;

    const content = this.readUntil('%>').trim();

    // JSX-style conditionals and loops
    if (content.startsWith('if')) {
      const condition = content.slice(2).trim().replace(/[()]/g, '');
      const children = this.parseUntil('<% endif %>');
      return {
        type: 'block',
        condition,
        children,
      };
    }

    if (content.startsWith('for')) {
      const match = content.match(/for\s+(\w+)\s+in\s+(.+)/);
      if (match) {
        const children = this.parseUntil('<% endfor %>');
        return {
          type: 'block',
          iterator: { array: match[2].trim(), item: match[1].trim() },
          children,
        };
      }
    }

    // JSX-style variable
    return {
      type: 'variable',
      key: content,
      escape: true,
    };
  }

  /**
   * Parse React-like components: <Component prop="value">content</Component>
   */
  private parseComponent(): TemplateNode | null {
    const regex = new RegExp(
      '^<([A-Z][a-zA-Z0-9]*)(.*?)(?:/>|>(.*?)</\\1>)',
      's'
    );
    const match = this.input.slice(this.pos).match(regex);
    if (!match) return this.parseText();

    const [fullMatch, name, propsStr, children] = match;
    this.pos += fullMatch.length;

    // Parse props
    const props: TemplateContext = {};
    const propMatches = Array.from(
      propsStr.matchAll(/(\w+)=(?:"([^"]*)"|'([^']*)'|{([^}]*)})/g)
    );
    for (const propMatch of propMatches) {
      const [, key, strValue, strValue2, jsValue] = propMatch;
      props[key] = strValue || strValue2 || jsValue;
    }

    const childNodes = children
      ? new UltimateTemplateParser(children, this.options).parse().nodes
      : [];

    return {
      type: 'component',
      name,
      props,
      children: childNodes,
    };
  }

  /**
   * Parse block helpers: {{#if}} {{#each}}
   */
  private parseBlock(content: string): TemplateNode {
    const parts = content.split(/\s+/);
    const command = parts[0];

    if (command === 'if') {
      const condition = parts.slice(1).join(' ');
      const children = this.parseUntil('{{/if}}');
      return {
        type: 'block',
        condition,
        children,
      };
    }

    if (command === 'each') {
      const array = parts[1];
      const item = parts[3] || 'item';
      const children = this.parseUntil('{{/each}}');
      return {
        type: 'block',
        iterator: { array, item },
        children,
      };
    }

    // Unknown block - treat as text
    return {
      type: 'text',
      content: `{{#${content}}}`,
    };
  }

  /**
   * Parse until a specific end tag is found
   */
  private parseUntil(endTag: string): TemplateNode[] {
    const nodes: TemplateNode[] = [];

    while (this.pos < this.input.length) {
      if (this.peek(endTag.length) === endTag) {
        this.pos += endTag.length;
        break;
      }

      const node = this.parseNode();
      if (node) nodes.push(node);
    }

    return nodes;
  }

  /**
   * Parse plain text content
   */
  private parseText(): TemplateNode | null {
    let text = '';

    while (
      this.pos < this.input.length &&
      !this.peek(2).match(/^(\{\{|<%|<[A-Z])/)
    ) {
      text += this.input[this.pos++];
    }

    return text ? { type: 'text', content: text } : null;
  }

  /**
   * Peek ahead in the input string
   */
  private peek(length: number): string {
    return this.input.slice(this.pos, this.pos + length);
  }

  /**
   * Check if the current position matches a regex
   */
  private peekRegex(regex: RegExp): boolean {
    return regex.test(this.input.slice(this.pos));
  }

  /**
   * Consume a specific string if it matches current position
   */
  private consume(expected: string): boolean {
    if (this.peek(expected.length) === expected) {
      this.pos += expected.length;
      return true;
    }
    return false;
  }

  /**
   * Read until a specific end string is found
   */
  private readUntil(end: string): string {
    let result = '';
    while (this.pos < this.input.length && this.peek(end.length) !== end) {
      result += this.input[this.pos++];
    }
    this.pos += end.length;
    return result;
  }
}
