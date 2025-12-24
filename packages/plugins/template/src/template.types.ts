/**
 * @nextrush/template - Type Definitions
 *
 * Comprehensive types for the template engine including helpers, blocks,
 * partials, layouts, and compilation options.
 *
 * @packageDocumentation
 */

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Context passed to helper functions
 */
export interface HelperContext {
  /** Current data scope */
  readonly data: Record<string, unknown>;
  /** Root data object */
  readonly root: Record<string, unknown>;
  /** Parent data scope (for nested blocks) */
  readonly parent: Record<string, unknown> | null;
  /** Current iteration index (in each blocks) */
  readonly index?: number;
  /** First item in iteration */
  readonly first?: boolean;
  /** Last item in iteration */
  readonly last?: boolean;
  /** Current iteration key (for object iteration) */
  readonly key?: string;
  /** Render the inner block content */
  fn: (data?: Record<string, unknown>) => string;
  /** Render the inverse block content (else) */
  inverse: (data?: Record<string, unknown>) => string;
}

/**
 * Helper function signature
 * Helpers transform values or provide block logic
 */
export type HelperFn = (
  ...args: [...unknown[], HelperContext]
) => string | number | boolean | null | undefined | Promise<string | number | boolean | null | undefined>;

/**
 * Simple value helper (non-block)
 * Can return primitives, arrays, or unknown values for flexible transformations
 */
export type ValueHelper = (value: unknown, ...args: unknown[]) => unknown;

/**
 * Block helper signature
 */
export type BlockHelper = (
  context: unknown,
  options: HelperContext
) => string | Promise<string>;

// ============================================================================
// AST Node Types
// ============================================================================

/** Base AST node */
interface BaseNode {
  type: string;
  start: number;
  end: number;
}

/** Raw text node */
export interface TextNode extends BaseNode {
  type: 'text';
  value: string;
}

/** Variable interpolation node {{variable}} */
export interface VariableNode extends BaseNode {
  type: 'variable';
  name: string;
  escaped: boolean;
  helpers: HelperCall[];
}

/** Helper call in a variable expression */
export interface HelperCall {
  name: string;
  args: ExpressionArg[];
}

/** Expression argument (string, number, boolean, or path) */
export type ExpressionArg =
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'path'; value: string };

/** Block node {{#block}}...{{/block}} */
export interface BlockNode extends BaseNode {
  type: 'block';
  name: string;
  expression: string;
  args: ExpressionArg[];
  body: ASTNode[];
  inverse: ASTNode[];
}

/** Partial node {{> partial}} */
export interface PartialNode extends BaseNode {
  type: 'partial';
  name: string;
  context?: string;
  hash: Record<string, ExpressionArg>;
}

/** Comment node {{! comment }} */
export interface CommentNode extends BaseNode {
  type: 'comment';
  value: string;
}

/** Raw block node {{{raw}}} or {{& raw}} */
export interface RawNode extends BaseNode {
  type: 'raw';
  name: string;
  helpers: HelperCall[];
}

/** All AST node types */
export type ASTNode =
  | TextNode
  | VariableNode
  | BlockNode
  | PartialNode
  | CommentNode
  | RawNode;

/** Root AST structure */
export interface AST {
  type: 'root';
  body: ASTNode[];
}

// ============================================================================
// Template Engine Options
// ============================================================================

/**
 * Options for template compilation
 */
export interface CompileOptions {
  /** Escape HTML entities by default (default: true) */
  escape?: boolean;
  /** Strict mode - throw on missing variables (default: false) */
  strict?: boolean;
  /** Enable async helper support (default: false) */
  async?: boolean;
  /** Custom delimiters [open, close] (default: ['{{', '}}']) */
  delimiters?: [string, string];
  /** Helpers available during compilation/rendering */
  helpers?: Record<string, HelperFn | ValueHelper>;
  /** Partials available during compilation/rendering */
  partials?: Record<string, string | CompiledTemplate>;
}

/**
 * Options for template rendering
 */
export interface RenderOptions {
  /** Additional data to merge with context */
  data?: Record<string, unknown>;
  /** Partials available during rendering */
  partials?: Record<string, string | CompiledTemplate>;
  /** Helpers available during rendering */
  helpers?: Record<string, HelperFn | ValueHelper>;
  /** Layout template to wrap content */
  layout?: string;
  /** Layout data */
  layoutData?: Record<string, unknown>;
}

/**
 * Template engine configuration
 */
export interface EngineOptions {
  /** Root directory for template files */
  root?: string;
  /** Default file extension (default: '.html') */
  ext?: string;
  /** Enable template caching (default: true in production) */
  cache?: boolean;
  /** Default layout template */
  layout?: string;
  /** Directory for partial templates */
  partialsDir?: string;
  /** Global helpers available to all templates */
  helpers?: Record<string, HelperFn | ValueHelper>;
  /** Global partials */
  partials?: Record<string, string>;
  /** Compilation options */
  compile?: CompileOptions;
}

/**
 * Normalized engine options with defaults applied
 */
export interface NormalizedEngineOptions {
  root: string;
  ext: string;
  cache: boolean;
  layout: string | null;
  partialsDir: string | null;
  helpers: Map<string, HelperFn | ValueHelper>;
  partials: Map<string, string>;
  compile: Required<CompileOptions>;
}

// ============================================================================
// Compiled Template
// ============================================================================

/**
 * Compiled template ready for rendering
 */
export interface CompiledTemplate {
  /** Render the template with data */
  render(data?: Record<string, unknown>, options?: RenderOptions): string;
  /** Render the template asynchronously */
  renderAsync(data?: Record<string, unknown>, options?: RenderOptions): Promise<string>;
  /** The original template source */
  source: string;
  /** The parsed AST */
  ast: AST;
}

// ============================================================================
// Plugin Options
// ============================================================================

/**
 * Template plugin options for NextRush integration
 */
export interface TemplatePluginOptions extends EngineOptions {
  /** Property name on context for render function (default: 'render') */
  contextProperty?: string;
  /** Enable ctx.render() method (default: true) */
  enableContextRender?: boolean;
}

/**
 * Normalized plugin options
 */
export interface NormalizedPluginOptions extends NormalizedEngineOptions {
  contextProperty: string;
  enableContextRender: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Template parsing error
 */
export interface TemplateError extends Error {
  name: 'TemplateError';
  code: string;
  line?: number;
  column?: number;
  source?: string;
}

/**
 * Template error codes
 */
export type TemplateErrorCode =
  | 'PARSE_ERROR'
  | 'COMPILE_ERROR'
  | 'RENDER_ERROR'
  | 'HELPER_ERROR'
  | 'PARTIAL_NOT_FOUND'
  | 'LAYOUT_NOT_FOUND'
  | 'FILE_NOT_FOUND'
  | 'INVALID_EXPRESSION'
  | 'UNCLOSED_BLOCK'
  | 'UNEXPECTED_CLOSE'
  | 'MISSING_VARIABLE';

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Data context type for templates
 */
export type TemplateData = Record<string, unknown>;

/**
 * Render function signature added to context
 */
export type RenderFunction = (
  template: string,
  data?: TemplateData,
  options?: RenderOptions
) => Promise<void>;

/**
 * File-based render function
 */
export type RenderFileFunction = (
  filename: string,
  data?: TemplateData,
  options?: RenderOptions
) => Promise<void>;
