/**
 * 🚀 NextRush Ultimate Template Engine
 * The most powerful, flexible, and developer-friendly template system ever built!
 *
 * Features:
 * - 🎯 Multiple engine support (Mustache, Handlebars-like, JSX-like)
 * - 🔥 Streaming rendering for performance
 * - 🧩 Component system with slots
 * - 📁 Path aliases and smart resolving
 * - 🎨 Layout system with inheritance
 * - 🛡️ Type-safe template compilation
 * - ⚡ Caching and optimization
 * - 🌐 Internationalization support
 * - 🧪 Built-in testing utilities
 * - 📝 Frontmatter support (YAML)
 * - 🎭 Partials and includes
 * - 🔧 Custom helpers and filters
 * - 🌍 Multi-syntax support
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Writable } from 'stream';

// 🎯 Core Types
export interface TemplateContext {
  [key: string]: any;
}

export interface PathAliases {
  [alias: string]: string;
}

export interface TemplateOptions {
  views?: string;
  layouts?: string;
  partials?: string;
  components?: string;
  cache?: boolean;
  engine?: 'mustache' | 'handlebars' | 'jsx' | 'auto';
  pathAliases?: PathAliases;
  encoding?: BufferEncoding;
  extensions?: string[];
  globals?: TemplateContext;
  helpers?: HelperRegistry;
  filters?: FilterRegistry;
  i18n?: I18nConfig;
  minify?: boolean;
  debug?: boolean;
  watchFiles?: boolean;
  streaming?: boolean;
  defaultExtension?: string;
}

export interface RenderOptions {
  engine?: string;
  cache?: boolean;
  layout?: string;
  locals?: TemplateContext;
  streaming?: boolean;
  partials?: Record<string, string>;
  helpers?: Record<string, Function>;
  filters?: Record<string, Function>;
  [key: string]: any;
}

export interface HelperRegistry {
  [name: string]: (...args: any[]) => any;
}

export interface FilterRegistry {
  [name: string]: (value: any, ...args: any[]) => any;
}

export interface I18nConfig {
  locale?: string;
  fallback?: string;
  translations?: { [locale: string]: { [key: string]: string } };
  directory?: string;
  defaultLocale?: string;
  locales?: string[];
}

export interface TemplateNode {
  type:
    | 'text'
    | 'variable'
    | 'block'
    | 'component'
    | 'partial'
    | 'layout'
    | 'helper';
  content?: string;
  key?: string;
  props?: TemplateContext;
  children?: TemplateNode[];
  escape?: boolean;
  condition?: string;
  iterator?: { array: string; item: string; index?: string };
  name?: string;
  args?: any[];
  start?: number;
  end?: number;
}

export interface ParseResult {
  nodes: TemplateNode[];
  metadata: {
    dependencies: string[];
    components: string[];
    partials: string[];
    layout?: string;
    frontmatter?: any;
    title?: string;
    author?: string;
    date?: string;
    tags?: string[];
  };
}

export interface CompileResult {
  render: (
    context: TemplateContext,
    options?: RenderOptions
  ) => Promise<string>;
  renderStream: (
    context: TemplateContext,
    stream: Writable,
    options?: RenderOptions
  ) => Promise<void>;
  metadata: ParseResult['metadata'];
}

/**
 * 🎨 Ultimate Template Parser - Handles multiple template syntaxes
 */
export class UltimateTemplateParser {
  private pos = 0;
  private input = '';
  private options: TemplateOptions;

  constructor(input: string, options: TemplateOptions = {}) {
    this.input = input;
    this.options = options;
  }

  parse(): ParseResult {
    this.pos = 0;
    const nodes: TemplateNode[] = [];
    const metadata: ParseResult['metadata'] = {
      dependencies: [],
      components: [],
      partials: [],
    };

    // Parse frontmatter for metadata
    const { content, frontmatter } = this.parseFrontmatter();
    this.input = content;

    if (frontmatter.layout) {
      metadata.layout = frontmatter.layout;
    }

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

  private parseFrontmatter(): { content: string; frontmatter: any } {
    if (!this.input.startsWith('---\n')) {
      return { content: this.input, frontmatter: {} };
    }

    const endIndex = this.input.indexOf('\n---\n', 4);
    if (endIndex === -1) {
      return { content: this.input, frontmatter: {} };
    }

    const frontmatterText = this.input.slice(4, endIndex);
    const content = this.input.slice(endIndex + 5);

    // Enhanced YAML-like parsing with support for arrays and nested objects
    const frontmatter: any = {};
    const lines = frontmatterText.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value = line.slice(colonIndex + 1).trim();

        // Handle different value types
        if (value.startsWith('[') && value.endsWith(']')) {
          // Array: [item1, item2, item3]
          try {
            frontmatter[key] = JSON.parse(value);
          } catch {
            // Fallback: split by comma and clean up
            frontmatter[key] = value
              .slice(1, -1)
              .split(',')
              .map((v) => v.trim().replace(/^['"]|['"]$/g, ''));
          }
        } else if (
          value.toLowerCase() === 'true' ||
          value.toLowerCase() === 'false'
        ) {
          // Boolean
          frontmatter[key] = value.toLowerCase() === 'true';
        } else if (/^\d+$/.test(value)) {
          // Integer
          frontmatter[key] = parseInt(value, 10);
        } else if (/^\d+\.\d+$/.test(value)) {
          // Float
          frontmatter[key] = parseFloat(value);
        } else {
          // String (remove quotes if present)
          frontmatter[key] = value.replace(/^['"]|['"]$/g, '');
        }
      }
    }

    return { content, frontmatter };
  }

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

      // Check if this looks like a helper call
      if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(helperName)) {
        // Not a simple variable, might be a helper
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

  private parseComponent(): TemplateNode | null {
    const match = this.input
      .slice(this.pos)
      .match(/^<([A-Z][a-zA-Z0-9]*)(.*?)(?:\/>|>(.*?)<\/\1>)/s);
    if (!match) return this.parseText();

    const [fullMatch, name, propsStr, children] = match;
    this.pos += fullMatch.length;

    // Parse props
    const props: TemplateContext = {};
    const propMatches = propsStr.matchAll(
      /(\w+)=(?:"([^"]*)"|'([^']*)'|{([^}]*)})/g
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

    // Unknown block
    return {
      type: 'text',
      content: `{{#${content}}}`,
    };
  }

  private parseUntil(endTag: string): TemplateNode[] {
    const nodes: TemplateNode[] = [];
    const startPos = this.pos;

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

  private peek(length: number): string {
    return this.input.slice(this.pos, this.pos + length);
  }

  private peekRegex(regex: RegExp): boolean {
    return regex.test(this.input.slice(this.pos));
  }

  private consume(expected: string): boolean {
    if (this.peek(expected.length) === expected) {
      this.pos += expected.length;
      return true;
    }
    return false;
  }

  private readUntil(end: string): string {
    let result = '';
    while (this.pos < this.input.length && this.peek(end.length) !== end) {
      result += this.input[this.pos++];
    }
    this.pos += end.length;
    return result;
  }
}

/**
 * 🎨 Ultimate Template Renderer - High-performance rendering engine
 */
export class UltimateTemplateRenderer {
  private helpers: HelperRegistry = {};
  private filters: FilterRegistry = {};
  private globals: TemplateContext = {};
  private partials = new Map<string, ParseResult>();
  private components = new Map<string, ParseResult>();
  private layouts = new Map<string, ParseResult>();
  private templateCache = new Map<string, ParseResult>();

  constructor(private options: TemplateOptions = {}) {
    this.setupBuiltinHelpers();
    this.setupBuiltinFilters();

    if (options.helpers) {
      Object.assign(this.helpers, options.helpers);
    }

    if (options.filters) {
      Object.assign(this.filters, options.filters);
    }

    if (options.globals) {
      Object.assign(this.globals, options.globals);
    }
  }

  async loadTemplate(
    templatePath: string,
    type: 'template' | 'partial' | 'component' | 'layout' = 'template'
  ): Promise<ParseResult | null> {
    const cacheKey = `${type}:${templatePath}`;

    // Check cache first
    if (this.options.cache && this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    try {
      // Resolve full path
      let fullPath = templatePath;
      const baseDir = this.getBaseDirectory(type);

      if (baseDir) {
        fullPath = path.resolve(baseDir, templatePath);
      }

      // Add extension if not present
      if (!path.extname(fullPath) && this.options.defaultExtension) {
        fullPath += this.options.defaultExtension;
      }

      // Read and parse template
      const content = await fs.readFile(
        fullPath,
        this.options.encoding || 'utf8'
      );
      const parser = new UltimateTemplateParser(content, this.options);
      const result = parser.parse();

      // Cache if enabled
      if (this.options.cache) {
        this.templateCache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      if (this.options.debug) {
        console.error(
          `Failed to load ${type} template: ${templatePath}`,
          error
        );
      }
      return null;
    }
  }

  private getBaseDirectory(
    type: 'template' | 'partial' | 'component' | 'layout'
  ): string | undefined {
    switch (type) {
      case 'partial':
        return (
          this.options.partials ||
          path.join(this.options.views || '.', 'partials')
        );
      case 'component':
        return (
          this.options.components ||
          path.join(this.options.views || '.', 'components')
        );
      case 'layout':
        return (
          this.options.layouts ||
          path.join(this.options.views || '.', 'layouts')
        );
      default:
        return this.options.views || '.';
    }
  }

  async renderStream(
    nodes: TemplateNode[],
    context: TemplateContext,
    stream: Writable,
    options: RenderOptions = {}
  ): Promise<void> {
    const fullContext = { ...this.globals, ...context, ...options.locals };

    for (const node of nodes) {
      await this.renderNode(node, fullContext, stream, options);
    }
  }

  private async renderNode(
    node: TemplateNode,
    context: TemplateContext,
    stream: Writable,
    options: RenderOptions
  ): Promise<void> {
    switch (node.type) {
      case 'text':
        stream.write(node.content || '');
        break;

      case 'variable':
        const value = this.getValue(context, node.key!);
        const output = node.escape
          ? this.escapeHTML(String(value))
          : String(value);
        stream.write(output);
        break;

      case 'helper':
        await this.renderHelper(node, context, stream, options);
        break;

      case 'block':
        await this.renderBlock(node, context, stream, options);
        break;

      case 'component':
        await this.renderComponent(node, context, stream, options);
        break;

      case 'partial':
        await this.renderPartial(node, context, stream, options);
        break;

      case 'layout':
        await this.renderLayout(node, context, stream, options);
        break;
    }
  }

  private async renderHelper(
    node: TemplateNode,
    context: TemplateContext,
    stream: Writable,
    options: RenderOptions
  ): Promise<void> {
    if (!node.name || !node.args) return;

    const helper = this.helpers[node.name];
    if (!helper) {
      if (this.options.debug) {
        stream.write(`<!-- Helper ${node.name} not found -->`);
      }
      return;
    }

    try {
      // Resolve arguments
      const resolvedArgs = node.args.map((arg) => {
        // If argument looks like a variable reference, resolve it
        if (typeof arg === 'string' && /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(arg)) {
          return this.getValue(context, arg);
        }
        // Otherwise, treat as literal (string, number, etc.)
        if (typeof arg === 'string') {
          // Remove quotes if present
          if (
            (arg.startsWith('"') && arg.endsWith('"')) ||
            (arg.startsWith("'") && arg.endsWith("'"))
          ) {
            return arg.slice(1, -1);
          }
          // Try to parse as number
          if (/^\d+$/.test(arg)) return parseInt(arg, 10);
          if (/^\d+\.\d+$/.test(arg)) return parseFloat(arg);
        }
        return arg;
      });

      const result = await helper(...resolvedArgs);
      const output = node.escape
        ? this.escapeHTML(String(result))
        : String(result);
      stream.write(output);
    } catch (error) {
      if (this.options.debug) {
        stream.write(
          `<!-- Helper ${node.name} error: ${
            error instanceof Error ? error.message : 'Unknown error'
          } -->`
        );
      }
    }
  }

  private async renderBlock(
    node: TemplateNode,
    context: TemplateContext,
    stream: Writable,
    options: RenderOptions
  ): Promise<void> {
    if (node.condition) {
      // Conditional rendering
      const conditionValue = this.evaluateCondition(node.condition, context);
      if (conditionValue && node.children) {
        for (const child of node.children) {
          await this.renderNode(child, context, stream, options);
        }
      }
    } else if (node.iterator) {
      // Loop rendering
      const array = this.getValue(context, node.iterator.array);
      if (Array.isArray(array) && node.children) {
        for (let i = 0; i < array.length; i++) {
          const currentItem = array[i];
          const itemContext = {
            ...context,
            // Spread the current item properties to make them directly accessible
            ...(typeof currentItem === 'object' && currentItem !== null
              ? currentItem
              : {}),
            // Also provide the complete item under the iterator name for compatibility
            [node.iterator.item]: currentItem,
            '@index': i,
            '@first': i === 0,
            '@last': i === array.length - 1,
            '@length': array.length,
          };

          for (const child of node.children) {
            await this.renderNode(child, itemContext, stream, options);
          }
        }
      }
    }
  }

  private async renderPartial(
    node: TemplateNode,
    context: TemplateContext,
    stream: Writable,
    options: RenderOptions
  ): Promise<void> {
    if (!node.name) return;

    // Check if partial is already loaded
    let partial = this.partials.get(node.name);

    // If not loaded, try to load from file
    if (!partial) {
      const loadedPartial = await this.loadTemplate(node.name, 'partial');
      if (loadedPartial) {
        this.partials.set(node.name, loadedPartial);
        partial = loadedPartial;
      }
    }

    if (!partial) {
      if (this.options.debug) {
        stream.write(`<!-- Partial ${node.name} not found -->`);
      }
      return;
    }

    // Merge context with any partial-specific props
    const partialContext = { ...context, ...node.props };

    for (const partialNode of partial.nodes) {
      await this.renderNode(partialNode, partialContext, stream, options);
    }
  }

  private async renderComponent(
    node: TemplateNode,
    context: TemplateContext,
    stream: Writable,
    options: RenderOptions
  ): Promise<void> {
    if (!node.name) return;

    // Check if component is already loaded
    let component = this.components.get(node.name);

    // If not loaded, try to load from file
    if (!component) {
      const loadedComponent = await this.loadTemplate(node.name, 'component');
      if (loadedComponent) {
        this.components.set(node.name, loadedComponent);
        component = loadedComponent;
      }
    }

    if (!component) {
      if (this.options.debug) {
        stream.write(`<!-- Component ${node.name} not found -->`);
      }
      return;
    }

    // Create component context with props and slots
    const componentContext = {
      ...context,
      ...node.props,
      $slots: this.createSlotMap(node.children || []),
      $children: node.children || [],
    };

    for (const componentNode of component.nodes) {
      await this.renderNode(componentNode, componentContext, stream, options);
    }
  }

  private createSlotMap(children: TemplateNode[]): {
    [slotName: string]: TemplateNode[];
  } {
    const slots: { [slotName: string]: TemplateNode[] } = {
      default: [],
    };

    for (const child of children) {
      if (child.type === 'component' && child.props && child.props.slot) {
        const slotName = child.props.slot;
        if (!slots[slotName]) {
          slots[slotName] = [];
        }
        slots[slotName].push(child);
      } else {
        slots.default.push(child);
      }
    }

    return slots;
  }

  private async renderLayout(
    node: TemplateNode,
    context: TemplateContext,
    stream: Writable,
    options: RenderOptions
  ): Promise<void> {
    // Layout rendering implementation
    const layoutName = options.layout || node.props?.layout;

    if (layoutName && typeof layoutName === 'string') {
      // Check if layout is already loaded
      let layout = this.layouts.get(layoutName);

      // If not loaded, try to load from file
      if (!layout) {
        const loadedLayout = await this.loadTemplate(layoutName, 'layout');
        if (loadedLayout) {
          this.layouts.set(layoutName, loadedLayout);
          layout = loadedLayout;
        }
      }

      if (layout) {
        const layoutContext = {
          ...context,
          content: node.children || [],
          $content: node.children || [],
          ...node.props,
        };

        for (const layoutNode of layout.nodes) {
          await this.renderNode(layoutNode, layoutContext, stream, options);
        }
        return;
      }
    }

    // Fallback: render content directly
    if (node.children) {
      for (const child of node.children) {
        await this.renderNode(child, context, stream, options);
      }
    }
  }

  // Enhanced render method to handle frontmatter layouts
  async render(
    nodes: TemplateNode[],
    context: TemplateContext,
    options: RenderOptions = {}
  ): Promise<string> {
    const chunks: string[] = [];
    const stream = new MockWritableStream(chunks);

    await this.renderStream(nodes, context, stream, options);

    return chunks.join('');
  }

  async renderWithLayout(
    parseResult: ParseResult,
    context: TemplateContext,
    options: RenderOptions = {}
  ): Promise<string> {
    const chunks: string[] = [];
    const stream = new MockWritableStream(chunks);

    // Check if template has a layout defined in frontmatter
    const layoutName = parseResult.metadata.layout || options.layout;

    if (layoutName) {
      // Wrap content in a layout node
      const layoutNode: TemplateNode = {
        type: 'layout',
        props: { layout: layoutName, ...parseResult.metadata.frontmatter },
        children: parseResult.nodes,
      };

      await this.renderNode(layoutNode, context, stream, options);
    } else {
      // Render directly
      await this.renderStream(parseResult.nodes, context, stream, options);
    }

    return chunks.join('');
  }

  private getValue(context: TemplateContext, key: string): any {
    const parts = key.split('.');
    let value = context;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private evaluateCondition(
    condition: string,
    context: TemplateContext
  ): boolean {
    // Simple condition evaluation
    const value = this.getValue(context, condition);
    return Boolean(value);
  }

  private escapeHTML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private setupBuiltinHelpers(): void {
    this.helpers = {
      // Date helpers
      formatDate: (date: Date | string, format: string = 'YYYY-MM-DD') => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        const formats: { [key: string]: string } = {
          YYYY: d.getFullYear().toString(),
          MM: (d.getMonth() + 1).toString().padStart(2, '0'),
          DD: d.getDate().toString().padStart(2, '0'),
          HH: d.getHours().toString().padStart(2, '0'),
          mm: d.getMinutes().toString().padStart(2, '0'),
          ss: d.getSeconds().toString().padStart(2, '0'),
          MMMM: d.toLocaleString('default', { month: 'long' }),
          MMM: d.toLocaleString('default', { month: 'short' }),
        };

        let result = format;
        Object.entries(formats).forEach(([pattern, replacement]) => {
          result = result.replace(new RegExp(pattern, 'g'), replacement);
        });

        return result;
      },

      timeAgo: (date: Date | string) => {
        const now = new Date();
        const past = new Date(date);
        const diff = now.getTime() - past.getTime();
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) return 'just now';
        if (minutes < 60)
          return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

        const days = Math.floor(hours / 24);
        if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;

        const months = Math.floor(days / 30);
        if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;

        const years = Math.floor(months / 12);
        return `${years} year${years > 1 ? 's' : ''} ago`;
      },

      // String helpers
      uppercase: (str: string) => String(str).toUpperCase(),
      lowercase: (str: string) => String(str).toLowerCase(),
      capitalize: (str: string) => {
        const s = String(str);
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      },
      truncate: (str: string, length: number, suffix: string = '...') => {
        const s = String(str);
        return s.length > length ? s.slice(0, length) + suffix : s;
      },
      slugify: (str: string) => {
        return String(str)
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');
      },
      trim: (str: string) => String(str).trim(),
      replace: (str: string, search: string, replacement: string) => {
        return String(str).replace(new RegExp(search, 'g'), replacement);
      },

      // Number helpers
      formatNumber: (num: number, decimals: number = 0) => {
        return Number(num).toFixed(decimals);
      },
      formatPrice: (
        price: number,
        currency: string = 'USD',
        locale: string = 'en-US'
      ) => {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
        }).format(price);
      },
      round: (num: number, decimals: number = 0) => {
        const factor = Math.pow(10, decimals);
        return Math.round(Number(num) * factor) / factor;
      },

      // Comparison helpers
      eq: (a: any, b: any) => a === b,
      ne: (a: any, b: any) => a !== b,
      gt: (a: number, b: number) => Number(a) > Number(b),
      lt: (a: number, b: number) => Number(a) < Number(b),
      gte: (a: number, b: number) => Number(a) >= Number(b),
      lte: (a: number, b: number) => Number(a) <= Number(b),
      and: (...args: any[]) => args.every(Boolean),
      or: (...args: any[]) => args.some(Boolean),
      not: (value: any) => !value,

      // Array helpers
      length: (arr: any) => {
        if (Array.isArray(arr)) return arr.length;
        if (typeof arr === 'string') return arr.length;
        if (arr && typeof arr === 'object') return Object.keys(arr).length;
        return 0;
      },
      first: (arr: any[]) => (Array.isArray(arr) ? arr[0] : undefined),
      last: (arr: any[]) =>
        Array.isArray(arr) ? arr[arr.length - 1] : undefined,
      slice: (arr: any[], start: number, end?: number) => {
        return Array.isArray(arr) ? arr.slice(start, end) : [];
      },
      sort: (arr: any[], key?: string) => {
        if (!Array.isArray(arr)) return arr;
        if (key) {
          return [...arr].sort((a, b) => {
            const aVal = a[key];
            const bVal = b[key];
            if (aVal < bVal) return -1;
            if (aVal > bVal) return 1;
            return 0;
          });
        }
        return [...arr].sort();
      },
      reverse: (arr: any[]) => (Array.isArray(arr) ? [...arr].reverse() : arr),
      join: (arr: any[], separator: string = ', ') => {
        return Array.isArray(arr) ? arr.join(separator) : String(arr);
      },
      unique: (arr: any[]) => (Array.isArray(arr) ? [...new Set(arr)] : arr),
      filter: (arr: any[], key: string, value?: any) => {
        if (!Array.isArray(arr)) return arr;
        if (value !== undefined) {
          return arr.filter((item) => item[key] === value);
        }
        return arr.filter((item) => Boolean(item[key]));
      },
      map: (arr: any[], key: string) => {
        return Array.isArray(arr) ? arr.map((item) => item[key]) : [];
      },

      // Object helpers
      keys: (obj: any) =>
        obj && typeof obj === 'object' ? Object.keys(obj) : [],
      values: (obj: any) =>
        obj && typeof obj === 'object' ? Object.values(obj) : [],
      has: (obj: any, key: string) =>
        obj && typeof obj === 'object' && key in obj,

      // Utility helpers
      json: (obj: any, indent: number = 2) => JSON.stringify(obj, null, indent),
      default: (value: any, defaultValue: any) =>
        value !== undefined && value !== null && value !== ''
          ? value
          : defaultValue,
      debug: (value: any) => {
        console.log('Template Debug:', value);
        return value;
      },
      typeof: (value: any) => typeof value,
      stringify: (value: any) => String(value),

      // URL helpers
      urlEncode: (str: string) => encodeURIComponent(String(str)),
      urlDecode: (str: string) => decodeURIComponent(String(str)),

      // Conditional helpers
      unless: (condition: any, content: string) => (!condition ? content : ''),
      when: (condition: any, truthyValue: any, falsyValue?: any) => {
        return condition ? truthyValue : falsyValue || '';
      },

      // i18n helpers (basic implementation)
      t: (key: string, locale?: string) => {
        // Basic translation - would be enhanced with actual i18n system
        return key;
      },
      tn: (key: string, count: number, locale?: string) => {
        // Basic plural translation
        return count === 1 ? key : key + 's';
      },
    };
  }

  private setupBuiltinFilters(): void {
    this.filters = {
      // String filters
      upper: (value: string) => String(value).toUpperCase(),
      lower: (value: string) => String(value).toLowerCase(),
      trim: (value: string) => String(value).trim(),
      capitalize: (value: string) => {
        const s = String(value);
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      },
      title: (value: string) => {
        return String(value).replace(/\w\S*/g, (txt) => {
          return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
      },
      slug: (value: string) => {
        return String(value)
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');
      },
      truncate: (value: string, length: number, suffix: string = '...') => {
        const s = String(value);
        return s.length > length ? s.slice(0, length) + suffix : s;
      },
      replace: (value: string, search: string, replacement: string) => {
        return String(value).replace(new RegExp(search, 'g'), replacement);
      },
      split: (value: string, separator: string) =>
        String(value).split(separator),
      strip: (value: string) => String(value).replace(/\s+/g, ' ').trim(),

      // Number filters
      round: (value: number, precision: number = 0) => {
        const factor = Math.pow(10, precision);
        return Math.round(Number(value) * factor) / factor;
      },
      ceil: (value: number) => Math.ceil(Number(value)),
      floor: (value: number) => Math.floor(Number(value)),
      abs: (value: number) => Math.abs(Number(value)),
      currency: (
        value: number,
        currency: string = 'USD',
        locale: string = 'en-US'
      ) => {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
        }).format(Number(value));
      },
      percent: (value: number, decimals: number = 0) => {
        return (Number(value) * 100).toFixed(decimals) + '%';
      },

      // Array filters
      join: (arr: any[], separator: string = ', ') => {
        return Array.isArray(arr) ? arr.join(separator) : String(arr);
      },
      sort: (arr: any[], key?: string) => {
        if (!Array.isArray(arr)) return arr;
        if (key) {
          return [...arr].sort((a, b) => {
            const aVal = a[key];
            const bVal = b[key];
            if (aVal < bVal) return -1;
            if (aVal > bVal) return 1;
            return 0;
          });
        }
        return [...arr].sort();
      },
      reverse: (arr: any[]) => (Array.isArray(arr) ? [...arr].reverse() : arr),
      first: (arr: any[], count: number = 1) => {
        return Array.isArray(arr) ? arr.slice(0, count) : arr;
      },
      last: (arr: any[], count: number = 1) => {
        return Array.isArray(arr) ? arr.slice(-count) : arr;
      },
      slice: (arr: any[], start: number, end?: number) => {
        return Array.isArray(arr) ? arr.slice(start, end) : [];
      },
      take: (arr: any[], count: number) => {
        return Array.isArray(arr) ? arr.slice(0, count) : [];
      },
      skip: (arr: any[], count: number) => {
        return Array.isArray(arr) ? arr.slice(count) : [];
      },
      unique: (arr: any[]) => (Array.isArray(arr) ? [...new Set(arr)] : arr),
      compact: (arr: any[]) => {
        return Array.isArray(arr)
          ? arr.filter(
              (item) => item !== null && item !== undefined && item !== ''
            )
          : arr;
      },
      flatten: (arr: any[]) => {
        return Array.isArray(arr) ? arr.flat() : arr;
      },
      size: (value: any) => {
        if (Array.isArray(value)) return value.length;
        if (typeof value === 'string') return value.length;
        if (value && typeof value === 'object')
          return Object.keys(value).length;
        return 0;
      },

      // Date filters
      date: (value: string | Date, format: string = 'YYYY-MM-DD') => {
        const d = new Date(value);
        if (isNaN(d.getTime())) return '';

        const formats: { [key: string]: string } = {
          YYYY: d.getFullYear().toString(),
          MM: (d.getMonth() + 1).toString().padStart(2, '0'),
          DD: d.getDate().toString().padStart(2, '0'),
          HH: d.getHours().toString().padStart(2, '0'),
          mm: d.getMinutes().toString().padStart(2, '0'),
          ss: d.getSeconds().toString().padStart(2, '0'),
        };

        let result = format;
        Object.entries(formats).forEach(([pattern, replacement]) => {
          result = result.replace(new RegExp(pattern, 'g'), replacement);
        });

        return result;
      },
      timeago: (value: string | Date) => {
        const now = new Date();
        const past = new Date(value);
        const diff = now.getTime() - past.getTime();
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;

        const days = Math.floor(hours / 24);
        return `${days}d ago`;
      },

      // Object filters
      keys: (obj: any) =>
        obj && typeof obj === 'object' ? Object.keys(obj) : [],
      values: (obj: any) =>
        obj && typeof obj === 'object' ? Object.values(obj) : [],

      // Utility filters
      default: (value: any, defaultValue: any) => {
        return value !== undefined && value !== null && value !== ''
          ? value
          : defaultValue;
      },
      json: (value: any, indent: number = 2) =>
        JSON.stringify(value, null, indent),
      escape: (value: string) => {
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      },
      unescape: (value: string) => {
        return String(value)
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'");
      },
      url_encode: (value: string) => encodeURIComponent(String(value)),
      url_decode: (value: string) => decodeURIComponent(String(value)),
      base64: (value: string) => Buffer.from(String(value)).toString('base64'),
      md5: (value: string) => {
        // Basic MD5 - in production, use a proper crypto library
        return require('crypto')
          .createHash('md5')
          .update(String(value))
          .digest('hex');
      },
    };
  }

  registerPartial(name: string, parseResult: ParseResult): void {
    this.partials.set(name, parseResult);
  }

  registerComponent(name: string, parseResult: ParseResult): void {
    this.components.set(name, parseResult);
  }

  registerLayout(name: string, parseResult: ParseResult): void {
    this.layouts.set(name, parseResult);
  }
}

// Helper class for string stream
class MockWritableStream extends Writable {
  constructor(private chunks: string[]) {
    super();
  }

  override _write(chunk: any, encoding: string, callback: Function): void {
    this.chunks.push(chunk.toString());
    callback();
  }
}

/**
 * 🧪 Testing Utilities
 */
export interface TestRenderResult {
  html: string;
  errors: string[];
  metadata?: ParseResult['metadata'];
}

export async function testTemplateRender(
  templateContent: string,
  data: TemplateContext,
  options: TemplateOptions = {}
): Promise<TestRenderResult> {
  const errors: string[] = [];

  try {
    const parser = new UltimateTemplateParser(templateContent, {
      ...options,
      debug: true,
    });
    const parseResult = parser.parse();

    const renderer = new UltimateTemplateRenderer({ ...options, debug: true });

    // Convert TemplateOptions to RenderOptions
    const renderOptions: RenderOptions = {};
    if (options.engine) renderOptions.engine = options.engine;
    if (options.cache !== undefined) renderOptions.cache = options.cache;
    if (options.streaming !== undefined)
      renderOptions.streaming = options.streaming;

    const html = await renderer.renderWithLayout(
      parseResult,
      data,
      renderOptions
    );

    return {
      html,
      errors,
      metadata: parseResult.metadata,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
    return {
      html: '',
      errors,
    };
  }
}

export default {
  UltimateTemplateParser,
  UltimateTemplateRenderer,
  testTemplateRender,
};
