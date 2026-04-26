/**
 * @nextrush/template - Template Compiler
 *
 * Compiles parsed AST into render functions for fast template execution.
 * Supports synchronous and asynchronous rendering.
 *
 * @packageDocumentation
 */

import { createHelperRegistry } from './helpers';
import { parse } from './parser';
import type {
    ASTNode,
    BlockNode,
    CompiledTemplate,
    CompileOptions,
    ExpressionArg,
    HelperCall,
    HelperContext,
    HelperFn,
    PartialNode,
    RenderOptions,
    ValueHelper,
    VariableNode,
} from './template.types';

// ============================================================================
// Default Compile Options
// ============================================================================

const DEFAULT_COMPILE_OPTIONS: Required<CompileOptions> = {
  escape: true,
  strict: false,
  async: false,
  delimiters: ['{{', '}}'],
  helpers: {},
  partials: {},
};

// ============================================================================
// HTML Escaping
// ============================================================================

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

const HTML_ESCAPE_REGEX = /[&<>"'`]/g;

function escapeHtml(str: string): string {
  return str.replace(HTML_ESCAPE_REGEX, char => HTML_ENTITIES[char] ?? char);
}

// ============================================================================
// Security: Blocked Properties (Prototype Pollution Prevention)
// ============================================================================

/**
 * Properties that are blocked from template access to prevent prototype pollution attacks.
 * Based on CVE-2021-23369 (Handlebars) and similar vulnerabilities.
 */
const BLOCKED_PROPERTIES = new Set([
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
  '__proto__',
]);

/**
 * Check if a property name is safe to access
 */
function isSafeProperty(name: string): boolean {
  return !BLOCKED_PROPERTIES.has(name);
}

// ============================================================================
// Value Resolution
// ============================================================================

function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    // Security: Block access to dangerous prototype properties
    if (!isSafeProperty(part)) {
      return undefined;
    }

    if (current === null || current === undefined) return undefined;

    if (typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else if (Array.isArray(current) && /^\d+$/.test(part)) {
      current = current[parseInt(part, 10)];
    } else {
      return undefined;
    }
  }

  return current;
}

function resolveValue(
  name: string,
  data: Record<string, unknown>,
  root: Record<string, unknown>
): unknown {
  if (name === 'this' || name === '.') {
    // When iterating over primitives, toObject wraps them as { this: value }
    // so we return data.this if it exists, otherwise the whole data object
    return 'this' in data ? data['this'] : data;
  }

  if (name.startsWith('@root.')) {
    return getNestedValue(root, name.slice(6));
  }

  // Handle @index, @key, @first, @last - stored directly in context with @ prefix
  if (name.startsWith('@')) {
    return data[name];
  }

  const value = getNestedValue(data, name);
  if (value !== undefined) return value;

  return getNestedValue(root, name);
}

function resolveArg(
  arg: ExpressionArg,
  data: Record<string, unknown>,
  root: Record<string, unknown>
): unknown {
  switch (arg.type) {
    case 'string':
    case 'number':
    case 'boolean':
      return arg.value;
    case 'path':
      return resolveValue(arg.value, data, root);
  }
}

// ============================================================================
// Helper Execution
// ============================================================================

function applyHelpers(
  value: unknown,
  helpers: HelperCall[],
  data: Record<string, unknown>,
  root: Record<string, unknown>,
  helperRegistry: Map<string, HelperFn | ValueHelper>
): unknown {
  let result = value;

  for (const helper of helpers) {
    const fn = helperRegistry.get(helper.name);
    if (!fn) {
      continue;
    }

    const args = helper.args.map(arg => resolveArg(arg, data, root));
    result = (fn as ValueHelper)(result, ...args);
  }

  return result;
}

async function applyHelpersAsync(
  value: unknown,
  helpers: HelperCall[],
  data: Record<string, unknown>,
  root: Record<string, unknown>,
  helperRegistry: Map<string, HelperFn | ValueHelper>
): Promise<unknown> {
  let result = value;

  for (const helper of helpers) {
    const fn = helperRegistry.get(helper.name);
    if (!fn) {
      continue;
    }

    const args = helper.args.map(arg => resolveArg(arg, data, root));
    result = await Promise.resolve((fn as ValueHelper)(result, ...args));
  }

  return result;
}

// ============================================================================
// Safe Array Access
// ============================================================================

function getFirstArg(args: ExpressionArg[]): ExpressionArg | undefined {
  return args[0];
}

// ============================================================================
// Truthiness Check
// ============================================================================

function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (value === 0 || value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === 'object' && Object.keys(value).length === 0) return false;
  return true;
}

// ============================================================================
// Render Context
// ============================================================================

/**
 * Maximum nesting depth for partials and layouts to prevent infinite recursion.
 * This prevents template stack overflow attacks like {{>a}} where partial 'a' includes itself.
 */
const MAX_RECURSION_DEPTH = 100;

interface RenderContext {
  data: Record<string, unknown>;
  root: Record<string, unknown>;
  parent: Record<string, unknown> | null;
  helpers: Map<string, HelperFn | ValueHelper>;
  partials: Map<string, string | CompiledTemplate>;
  options: Required<CompileOptions>;
  renderOptions: RenderOptions;
  /** Current recursion depth for partial/layout rendering */
  depth: number;
}

// ============================================================================
// Node Renderers
// ============================================================================

function renderNode(node: ASTNode, ctx: RenderContext): string {
  switch (node.type) {
    case 'text':
      return node.value;

    case 'variable':
      return renderVariable(node, ctx);

    case 'raw':
      return renderRaw(node, ctx);

    case 'block':
      return renderBlock(node, ctx);

    case 'partial':
      return renderPartial(node, ctx);

    case 'comment':
      return '';
  }
}

async function renderNodeAsync(node: ASTNode, ctx: RenderContext): Promise<string> {
  switch (node.type) {
    case 'text':
      return node.value;

    case 'variable':
      return renderVariableAsync(node, ctx);

    case 'raw':
      return renderRawAsync(node, ctx);

    case 'block':
      return renderBlockAsync(node, ctx);

    case 'partial':
      return renderPartialAsync(node, ctx);

    case 'comment':
      return '';
  }
}

function renderVariable(node: VariableNode, ctx: RenderContext): string {
  let value = resolveValue(node.name, ctx.data, ctx.root);

  if (node.helpers.length > 0) {
    value = applyHelpers(value, node.helpers, ctx.data, ctx.root, ctx.helpers);
  }

  if (value === null || value === undefined) {
    if (ctx.options.strict) {
      throw new Error(`Missing variable: ${node.name}`);
    }
    return '';
  }

  const str = String(value);
  return node.escaped && ctx.options.escape ? escapeHtml(str) : str;
}

async function renderVariableAsync(node: VariableNode, ctx: RenderContext): Promise<string> {
  let value = resolveValue(node.name, ctx.data, ctx.root);

  if (node.helpers.length > 0) {
    value = await applyHelpersAsync(value, node.helpers, ctx.data, ctx.root, ctx.helpers);
  }

  if (value === null || value === undefined) {
    if (ctx.options.strict) {
      throw new Error(`Missing variable: ${node.name}`);
    }
    return '';
  }

  const str = String(value);
  return node.escaped && ctx.options.escape ? escapeHtml(str) : str;
}

function renderRaw(node: { name: string; helpers: HelperCall[] }, ctx: RenderContext): string {
  let value = resolveValue(node.name, ctx.data, ctx.root);

  if (node.helpers.length > 0) {
    value = applyHelpers(value, node.helpers, ctx.data, ctx.root, ctx.helpers);
  }

  if (value === null || value === undefined) {
    if (ctx.options.strict) {
      throw new Error(`Missing variable: ${node.name}`);
    }
    return '';
  }

  return String(value);
}

async function renderRawAsync(
  node: { name: string; helpers: HelperCall[] },
  ctx: RenderContext
): Promise<string> {
  let value = resolveValue(node.name, ctx.data, ctx.root);

  if (node.helpers.length > 0) {
    value = await applyHelpersAsync(value, node.helpers, ctx.data, ctx.root, ctx.helpers);
  }

  if (value === null || value === undefined) {
    if (ctx.options.strict) {
      throw new Error(`Missing variable: ${node.name}`);
    }
    return '';
  }

  return String(value);
}

function renderBlock(node: BlockNode, ctx: RenderContext): string {
  // Handle built-in block helpers first to avoid conflicts with value helpers
  switch (node.name) {
    case 'if':
      return renderIfBlock(node, ctx);
    case 'unless':
      return renderUnlessBlock(node, ctx);
    case 'each':
      return renderEachBlock(node, ctx);
    case 'with':
      return renderWithBlock(node, ctx);
  }

  const blockHelper = ctx.helpers.get(node.name) as HelperFn | undefined;
  if (blockHelper) {
    return renderCustomBlock(node, ctx, blockHelper);
  }

  return renderNodes(node.body, ctx);
}

async function renderBlockAsync(node: BlockNode, ctx: RenderContext): Promise<string> {
  // Handle built-in block helpers first to avoid conflicts with value helpers
  switch (node.name) {
    case 'if':
      return renderIfBlockAsync(node, ctx);
    case 'unless':
      return renderUnlessBlockAsync(node, ctx);
    case 'each':
      return renderEachBlockAsync(node, ctx);
    case 'with':
      return renderWithBlockAsync(node, ctx);
  }

  const blockHelper = ctx.helpers.get(node.name) as HelperFn | undefined;
  if (blockHelper) {
    return renderCustomBlockAsync(node, ctx, blockHelper);
  }

  return renderNodesAsync(node.body, ctx);
}

function renderIfBlock(node: BlockNode, ctx: RenderContext): string {
  const firstArg = getFirstArg(node.args);
  const condition = firstArg
    ? resolveArg(firstArg, ctx.data, ctx.root)
    : resolveValue(node.expression, ctx.data, ctx.root);

  if (isTruthy(condition)) {
    return renderNodes(node.body, ctx);
  }

  return renderNodes(node.inverse, ctx);
}

async function renderIfBlockAsync(node: BlockNode, ctx: RenderContext): Promise<string> {
  const firstArg = getFirstArg(node.args);
  const condition = firstArg
    ? resolveArg(firstArg, ctx.data, ctx.root)
    : resolveValue(node.expression, ctx.data, ctx.root);

  if (isTruthy(condition)) {
    return renderNodesAsync(node.body, ctx);
  }

  return renderNodesAsync(node.inverse, ctx);
}

function renderUnlessBlock(node: BlockNode, ctx: RenderContext): string {
  const firstArg = getFirstArg(node.args);
  const condition = firstArg
    ? resolveArg(firstArg, ctx.data, ctx.root)
    : resolveValue(node.expression, ctx.data, ctx.root);

  if (!isTruthy(condition)) {
    return renderNodes(node.body, ctx);
  }

  return renderNodes(node.inverse, ctx);
}

async function renderUnlessBlockAsync(node: BlockNode, ctx: RenderContext): Promise<string> {
  const firstArg = getFirstArg(node.args);
  const condition = firstArg
    ? resolveArg(firstArg, ctx.data, ctx.root)
    : resolveValue(node.expression, ctx.data, ctx.root);

  if (!isTruthy(condition)) {
    return renderNodesAsync(node.body, ctx);
  }

  return renderNodesAsync(node.inverse, ctx);
}

function renderEachBlock(node: BlockNode, ctx: RenderContext): string {
  const firstArg = getFirstArg(node.args);
  const items = firstArg
    ? resolveArg(firstArg, ctx.data, ctx.root)
    : resolveValue(node.expression, ctx.data, ctx.root);

  if (!items || (Array.isArray(items) && items.length === 0)) {
    return renderNodes(node.inverse, ctx);
  }

  const results: string[] = [];

  if (Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const itemCtx = createChildContext(ctx, {
        ...toObject(items[i]),
        '@index': i,
        '@first': i === 0,
        '@last': i === items.length - 1,
      });
      results.push(renderNodes(node.body, itemCtx));
    }
  } else if (typeof items === 'object' && items !== null) {
    const keys = Object.keys(items as Record<string, unknown>);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i] as string;
      const value = (items as Record<string, unknown>)[key];
      const itemCtx = createChildContext(ctx, {
        ...toObject(value),
        '@key': key,
        '@index': i,
        '@first': i === 0,
        '@last': i === keys.length - 1,
      });
      results.push(renderNodes(node.body, itemCtx));
    }
  }

  return results.join('');
}

async function renderEachBlockAsync(node: BlockNode, ctx: RenderContext): Promise<string> {
  const firstArg = getFirstArg(node.args);
  const items = firstArg
    ? resolveArg(firstArg, ctx.data, ctx.root)
    : resolveValue(node.expression, ctx.data, ctx.root);

  if (!items || (Array.isArray(items) && items.length === 0)) {
    return renderNodesAsync(node.inverse, ctx);
  }

  const results: string[] = [];

  if (Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const itemCtx = createChildContext(ctx, {
        ...toObject(items[i]),
        '@index': i,
        '@first': i === 0,
        '@last': i === items.length - 1,
      });
      results.push(await renderNodesAsync(node.body, itemCtx));
    }
  } else if (typeof items === 'object' && items !== null) {
    const keys = Object.keys(items as Record<string, unknown>);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i] as string;
      const value = (items as Record<string, unknown>)[key];
      const itemCtx = createChildContext(ctx, {
        ...toObject(value),
        '@key': key,
        '@index': i,
        '@first': i === 0,
        '@last': i === keys.length - 1,
      });
      results.push(await renderNodesAsync(node.body, itemCtx));
    }
  }

  return results.join('');
}

function renderWithBlock(node: BlockNode, ctx: RenderContext): string {
  const firstArg = getFirstArg(node.args);
  const contextValue = firstArg
    ? resolveArg(firstArg, ctx.data, ctx.root)
    : resolveValue(node.expression, ctx.data, ctx.root);

  if (!isTruthy(contextValue)) {
    return renderNodes(node.inverse, ctx);
  }

  const withCtx = createChildContext(ctx, toObject(contextValue));
  return renderNodes(node.body, withCtx);
}

async function renderWithBlockAsync(node: BlockNode, ctx: RenderContext): Promise<string> {
  const firstArg = getFirstArg(node.args);
  const contextValue = firstArg
    ? resolveArg(firstArg, ctx.data, ctx.root)
    : resolveValue(node.expression, ctx.data, ctx.root);

  if (!isTruthy(contextValue)) {
    return renderNodesAsync(node.inverse, ctx);
  }

  const withCtx = createChildContext(ctx, toObject(contextValue));
  return renderNodesAsync(node.body, withCtx);
}

function renderCustomBlock(node: BlockNode, ctx: RenderContext, helper: HelperFn): string {
  const firstArg = getFirstArg(node.args);
  const contextValue = firstArg
    ? resolveArg(firstArg, ctx.data, ctx.root)
    : resolveValue(node.expression, ctx.data, ctx.root);

  const helperContext: HelperContext = {
    data: ctx.data,
    root: ctx.root,
    parent: ctx.parent,
    fn: (data?: Record<string, unknown>) => {
      const blockCtx = data ? createChildContext(ctx, data) : ctx;
      return renderNodes(node.body, blockCtx);
    },
    inverse: (data?: Record<string, unknown>) => {
      const blockCtx = data ? createChildContext(ctx, data) : ctx;
      return renderNodes(node.inverse, blockCtx);
    },
  };

  const args = node.args.slice(1).map(arg => resolveArg(arg, ctx.data, ctx.root));
  const result = helper(contextValue, ...args, helperContext);

  return String(result ?? '');
}

async function renderCustomBlockAsync(
  node: BlockNode,
  ctx: RenderContext,
  helper: HelperFn
): Promise<string> {
  const firstArg = getFirstArg(node.args);
  const contextValue = firstArg
    ? resolveArg(firstArg, ctx.data, ctx.root)
    : resolveValue(node.expression, ctx.data, ctx.root);

  const helperContext: HelperContext = {
    data: ctx.data,
    root: ctx.root,
    parent: ctx.parent,
    fn: (data?: Record<string, unknown>) => {
      const blockCtx = data ? createChildContext(ctx, data) : ctx;
      return renderNodes(node.body, blockCtx);
    },
    inverse: (data?: Record<string, unknown>) => {
      const blockCtx = data ? createChildContext(ctx, data) : ctx;
      return renderNodes(node.inverse, blockCtx);
    },
  };

  const args = node.args.slice(1).map(arg => resolveArg(arg, ctx.data, ctx.root));
  const result = await Promise.resolve(helper(contextValue, ...args, helperContext));

  return String(result ?? '');
}

function renderPartial(node: PartialNode, ctx: RenderContext): string {
  // Security: Check recursion depth to prevent infinite partial loops
  if (ctx.depth >= MAX_RECURSION_DEPTH) {
    throw new Error(
      `Maximum template nesting depth (${MAX_RECURSION_DEPTH}) exceeded. ` +
      `Check for circular partial references involving "${node.name}".`
    );
  }

  const partial = ctx.partials.get(node.name);
  if (!partial) {
    if (ctx.options.strict) {
      throw new Error(`Partial not found: ${node.name}`);
    }
    return '';
  }

  let partialData = ctx.data;
  if (node.context) {
    const contextValue = resolveValue(node.context, ctx.data, ctx.root);
    partialData = toObject(contextValue);
  }

  for (const [key, arg] of Object.entries(node.hash)) {
    partialData = { ...partialData, [key]: resolveArg(arg, ctx.data, ctx.root) };
  }

  if (typeof partial === 'string') {
    const compiled = compile(partial, ctx.options);
    return compiled.render(partialData, { ...ctx.renderOptions, _depth: ctx.depth + 1 });
  }

  return partial.render(partialData, { ...ctx.renderOptions, _depth: ctx.depth + 1 });
}

async function renderPartialAsync(node: PartialNode, ctx: RenderContext): Promise<string> {
  // Security: Check recursion depth to prevent infinite partial loops
  if (ctx.depth >= MAX_RECURSION_DEPTH) {
    throw new Error(
      `Maximum template nesting depth (${MAX_RECURSION_DEPTH}) exceeded. ` +
      `Check for circular partial references involving "${node.name}".`
    );
  }

  const partial = ctx.partials.get(node.name);
  if (!partial) {
    if (ctx.options.strict) {
      throw new Error(`Partial not found: ${node.name}`);
    }
    return '';
  }

  let partialData = ctx.data;
  if (node.context) {
    const contextValue = resolveValue(node.context, ctx.data, ctx.root);
    partialData = toObject(contextValue);
  }

  for (const [key, arg] of Object.entries(node.hash)) {
    partialData = { ...partialData, [key]: resolveArg(arg, ctx.data, ctx.root) };
  }

  if (typeof partial === 'string') {
    const compiled = compile(partial, ctx.options);
    return compiled.renderAsync(partialData, { ...ctx.renderOptions, _depth: ctx.depth + 1 });
  }

  return partial.renderAsync(partialData, { ...ctx.renderOptions, _depth: ctx.depth + 1 });
}

// ============================================================================
// Render Helpers
// ============================================================================

function renderNodes(nodes: ASTNode[], ctx: RenderContext): string {
  return nodes.map(node => renderNode(node, ctx)).join('');
}

async function renderNodesAsync(nodes: ASTNode[], ctx: RenderContext): Promise<string> {
  const results = await Promise.all(nodes.map(node => renderNodeAsync(node, ctx)));
  return results.join('');
}

function createChildContext(parent: RenderContext, data: Record<string, unknown>): RenderContext {
  return {
    ...parent,
    data,
    parent: parent.data,
  };
}

function toObject(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { this: value };
}

// ============================================================================
// Compile Function
// ============================================================================

/**
 * Compile a template string into a reusable template function
 *
 * @param source - Template source string
 * @param options - Compile options
 * @returns Compiled template with render methods
 *
 * @example
 * ```typescript
 * const template = compile('Hello {{name}}!');
 * const result = template.render({ name: 'World' });
 * // => 'Hello World!'
 * ```
 */
export function compile(source: string, options: CompileOptions = {}): CompiledTemplate {
  const opts: Required<CompileOptions> = { ...DEFAULT_COMPILE_OPTIONS, ...options };
  const ast = parse(source, opts);

  const createContext = (
    data: Record<string, unknown>,
    renderOptions: RenderOptions & { _depth?: number }
  ): RenderContext => {
    // Start with built-in helpers, then compile-time helpers, then render-time helpers
    const helpers = createHelperRegistry();
    if (opts.helpers) {
      for (const [name, fn] of Object.entries(opts.helpers)) {
        helpers.set(name, fn);
      }
    }
    if (renderOptions.helpers) {
      for (const [name, fn] of Object.entries(renderOptions.helpers)) {
        helpers.set(name, fn);
      }
    }

    // Same for partials: compile-time then render-time
    const partials = new Map<string, string | CompiledTemplate>();
    if (opts.partials) {
      for (const [name, partial] of Object.entries(opts.partials)) {
        partials.set(name, partial);
      }
    }
    if (renderOptions.partials) {
      for (const [name, partial] of Object.entries(renderOptions.partials)) {
        partials.set(name, partial);
      }
    }

    return {
      data,
      root: data,
      parent: null,
      helpers,
      partials,
      options: opts,
      renderOptions,
      depth: renderOptions._depth ?? 0,
    };
  };

  return {
    source,
    ast,

    render(data: Record<string, unknown> = {}, renderOptions: RenderOptions = {}): string {
      const ctx = createContext(data, renderOptions);

      // Security: Check layout recursion depth
      if (ctx.depth >= MAX_RECURSION_DEPTH) {
        throw new Error(
          `Maximum template nesting depth (${MAX_RECURSION_DEPTH}) exceeded. ` +
          `Check for circular layout references.`
        );
      }

      let result = renderNodes(ast.body, ctx);

      if (renderOptions.layout) {
        const layoutCompiled = compile(renderOptions.layout, opts);
        return layoutCompiled.render(
          { ...data, ...renderOptions.layoutData, body: result },
          { ...renderOptions, layout: undefined, _depth: ctx.depth + 1 }
        );
      }

      return result;
    },

    async renderAsync(
      data: Record<string, unknown> = {},
      renderOptions: RenderOptions = {}
    ): Promise<string> {
      const ctx = createContext(data, renderOptions);

      // Security: Check layout recursion depth
      if (ctx.depth >= MAX_RECURSION_DEPTH) {
        throw new Error(
          `Maximum template nesting depth (${MAX_RECURSION_DEPTH}) exceeded. ` +
          `Check for circular layout references.`
        );
      }

      let result = await renderNodesAsync(ast.body, ctx);

      if (renderOptions.layout) {
        const layoutCompiled = compile(renderOptions.layout, opts);
        return layoutCompiled.renderAsync(
          { ...data, ...renderOptions.layoutData, body: result },
          { ...renderOptions, layout: undefined, _depth: ctx.depth + 1 }
        );
      }

      return result;
    },
  };
}
