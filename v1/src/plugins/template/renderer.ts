/**
 * 🎨 Template Renderer
 * High-performance template rendering engine for NextRush
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Writable } from 'stream';
import { TemplateHelperManager } from './helpers';
import { UltimateTemplateParser } from './parser';
import {
  ParseResult,
  RenderOptions,
  TemplateContext,
  TemplateNode,
  TemplateOptions,
} from './types';
import {
  MockWritableStream,
  createSlotMap,
  escapeHTML,
  evaluateCondition,
  getValue,
} from './utils';

/**
 * Ultimate Template Renderer - High-performance rendering engine
 */
export class UltimateTemplateRenderer {
  private helperManager: TemplateHelperManager;
  private globals: TemplateContext = {};
  private partials = new Map<string, ParseResult>();
  private components = new Map<string, ParseResult>();
  private layouts = new Map<string, ParseResult>();
  private templateCache = new Map<string, ParseResult>();

  constructor(private options: TemplateOptions = {}) {
    this.helperManager = new TemplateHelperManager(options.i18n);

    if (options.helpers) {
      Object.entries(options.helpers).forEach(([name, fn]) => {
        this.helperManager.registerHelper(name, fn);
      });
    }

    if (options.filters) {
      Object.entries(options.filters).forEach(([name, fn]) => {
        this.helperManager.registerFilter(name, fn);
      });
    }

    if (options.globals) {
      Object.assign(this.globals, options.globals);
    }
  }

  /**
   * Load template from file system
   */
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

  /**
   * Get base directory for template type
   */
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

  /**
   * Render nodes to a writable stream
   */
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

  /**
   * Render a single template node
   */
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
        const value = getValue(context, node.key!);
        const output = node.escape ? escapeHTML(String(value)) : String(value);
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

  /**
   * Render helper function calls
   */
  private async renderHelper(
    node: TemplateNode,
    context: TemplateContext,
    stream: Writable,
    options: RenderOptions
  ): Promise<void> {
    if (!node.name || !node.args) return;

    const helper = this.helperManager.getHelper(node.name);
    if (!helper) {
      if (this.options.debug) {
        stream.write(`<!-- Helper ${node.name} not found -->`);
      }
      return;
    }

    try {
      // Resolve arguments
      const resolvedArgs = node.args.map((arg) => {
        if (typeof arg === 'string' && /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(arg)) {
          return getValue(context, arg);
        }
        if (typeof arg === 'string') {
          if (
            (arg.startsWith('"') && arg.endsWith('"')) ||
            (arg.startsWith("'") && arg.endsWith("'"))
          ) {
            return arg.slice(1, -1);
          }
          if (/^\d+$/.test(arg)) return parseInt(arg, 10);
          if (/^\d+\.\d+$/.test(arg)) return parseFloat(arg);
        }
        return arg;
      });

      const result = await helper(...resolvedArgs);
      const output = node.escape ? escapeHTML(String(result)) : String(result);
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

  /**
   * Render block elements (if, each)
   */
  private async renderBlock(
    node: TemplateNode,
    context: TemplateContext,
    stream: Writable,
    options: RenderOptions
  ): Promise<void> {
    if (node.condition) {
      // Conditional rendering
      const conditionValue = evaluateCondition(node.condition, context);
      if (conditionValue && node.children) {
        for (const child of node.children) {
          await this.renderNode(child, context, stream, options);
        }
      }
    } else if (node.iterator) {
      // Loop rendering
      const array = getValue(context, node.iterator.array);
      if (Array.isArray(array) && node.children) {
        for (let i = 0; i < array.length; i++) {
          const currentItem = array[i];
          const itemContext = {
            ...context,
            ...(typeof currentItem === 'object' && currentItem !== null
              ? currentItem
              : {}),
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

  /**
   * Render partial templates
   */
  private async renderPartial(
    node: TemplateNode,
    context: TemplateContext,
    stream: Writable,
    options: RenderOptions
  ): Promise<void> {
    if (!node.name) return;

    let partial = this.partials.get(node.name);

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

    const partialContext = { ...context, ...node.props };

    for (const partialNode of partial.nodes) {
      await this.renderNode(partialNode, partialContext, stream, options);
    }
  }

  /**
   * Render components
   */
  private async renderComponent(
    node: TemplateNode,
    context: TemplateContext,
    stream: Writable,
    options: RenderOptions
  ): Promise<void> {
    if (!node.name) return;

    let component = this.components.get(node.name);

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

    const componentContext = {
      ...context,
      ...node.props,
      $slots: createSlotMap(node.children || []),
      $children: node.children || [],
    };

    for (const componentNode of component.nodes) {
      await this.renderNode(componentNode, componentContext, stream, options);
    }
  }

  /**
   * Render with layout
   */
  private async renderLayout(
    node: TemplateNode,
    context: TemplateContext,
    stream: Writable,
    options: RenderOptions
  ): Promise<void> {
    const layoutName = options.layout || node.props?.layout;

    if (layoutName && typeof layoutName === 'string') {
      let layout = this.layouts.get(layoutName);

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

    if (node.children) {
      for (const child of node.children) {
        await this.renderNode(child, context, stream, options);
      }
    }
  }

  /**
   * Render template to string
   */
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

  /**
   * Render with layout support
   */
  async renderWithLayout(
    parseResult: ParseResult,
    context: TemplateContext,
    options: RenderOptions = {}
  ): Promise<string> {
    const chunks: string[] = [];
    const stream = new MockWritableStream(chunks);

    const layoutName = parseResult.metadata.layout || options.layout;

    if (layoutName) {
      const layoutNode: TemplateNode = {
        type: 'layout',
        props: { layout: layoutName, ...parseResult.metadata.frontmatter },
        children: parseResult.nodes,
      };

      await this.renderNode(layoutNode, context, stream, options);
    } else {
      await this.renderStream(parseResult.nodes, context, stream, options);
    }

    return chunks.join('');
  }

  /**
   * Register a partial template
   */
  registerPartial(name: string, parseResult: ParseResult): void {
    this.partials.set(name, parseResult);
  }

  /**
   * Register a component template
   */
  registerComponent(name: string, parseResult: ParseResult): void {
    this.components.set(name, parseResult);
  }

  /**
   * Register a layout template
   */
  registerLayout(name: string, parseResult: ParseResult): void {
    this.layouts.set(name, parseResult);
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear();
    this.partials.clear();
    this.components.clear();
    this.layouts.clear();
  }
}
