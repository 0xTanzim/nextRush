/**
 * @nextrush/template - Template Parser
 *
 * Tokenizes and parses template strings into an AST for compilation.
 * Supports variables, blocks, partials, comments, and raw output.
 *
 * Syntax:
 * - {{variable}} - Escaped variable
 * - {{{variable}}} or {{& variable}} - Raw (unescaped) variable
 * - {{variable | helper}} - Variable with helper
 * - {{#block}}...{{/block}} - Block helper
 * - {{#if condition}}...{{else}}...{{/if}} - Conditional
 * - {{#each items}}...{{/each}} - Iteration
 * - {{> partial}} - Partial inclusion
 * - {{! comment }} - Comment
 *
 * @packageDocumentation
 */

import type {
  AST,
  ASTNode,
  BlockNode,
  CommentNode,
  CompileOptions,
  ExpressionArg,
  HelperCall,
  PartialNode,
  RawNode,
  TemplateErrorCode,
  TextNode,
  VariableNode,
} from './template.types';

// ============================================================================
// Token Types
// ============================================================================

type TokenType =
  | 'text'
  | 'open'
  | 'open_raw'
  | 'close'
  | 'close_raw'
  | 'open_block'
  | 'open_end'
  | 'open_partial'
  | 'open_comment'
  | 'open_unescaped'
  | 'else'
  | 'content';

interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

// ============================================================================
// Template Error
// ============================================================================

export class TemplateParseError extends Error {
  readonly code: TemplateErrorCode;
  readonly line: number;
  readonly column: number;
  readonly source: string;

  constructor(message: string, code: TemplateErrorCode, source: string, position: number) {
    const { line, column } = getLineColumn(source, position);
    super(`${message} at line ${line}, column ${column}`);
    this.name = 'TemplateParseError';
    this.code = code;
    this.line = line;
    this.column = column;
    this.source = source;
  }
}

function getLineColumn(source: string, position: number): { line: number; column: number } {
  const lines = source.slice(0, position).split('\n');
  const lastLine = lines[lines.length - 1];
  return {
    line: lines.length,
    column: (lastLine?.length ?? 0) + 1,
  };
}

// ============================================================================
// Tokenizer
// ============================================================================

const DEFAULT_OPEN = '{{';
const DEFAULT_CLOSE = '}}';

function tokenize(
  source: string,
  delimiters: [string, string] = [DEFAULT_OPEN, DEFAULT_CLOSE]
): Token[] {
  const [openDelim, closeDelim] = delimiters;
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < source.length) {
    const openIndex = source.indexOf(openDelim, pos);

    if (openIndex === -1) {
      if (pos < source.length) {
        tokens.push({
          type: 'text',
          value: source.slice(pos),
          start: pos,
          end: source.length,
        });
      }
      break;
    }

    if (openIndex > pos) {
      tokens.push({
        type: 'text',
        value: source.slice(pos, openIndex),
        start: pos,
        end: openIndex,
      });
    }

    const tripleOpen =
      source.slice(openIndex, openIndex + openDelim.length + 1) === openDelim + '{';
    const afterOpen = source[openIndex + openDelim.length] ?? '';

    let tokenType: TokenType = 'open';
    let skipChars = openDelim.length;

    if (tripleOpen) {
      tokenType = 'open_raw';
      skipChars = openDelim.length + 1;
    } else if (afterOpen === '#') {
      tokenType = 'open_block';
      skipChars = openDelim.length + 1;
    } else if (afterOpen === '/') {
      tokenType = 'open_end';
      skipChars = openDelim.length + 1;
    } else if (afterOpen === '>') {
      tokenType = 'open_partial';
      skipChars = openDelim.length + 1;
    } else if (afterOpen === '!') {
      tokenType = 'open_comment';
      skipChars = openDelim.length + 1;
    } else if (afterOpen === '&') {
      tokenType = 'open_unescaped';
      skipChars = openDelim.length + 1;
    }

    tokens.push({
      type: tokenType,
      value: source.slice(openIndex, openIndex + skipChars),
      start: openIndex,
      end: openIndex + skipChars,
    });

    pos = openIndex + skipChars;

    const tripleClose = tokenType === 'open_raw';
    const closeSearch = tripleClose ? '}' + closeDelim : closeDelim;
    const closeIndex = source.indexOf(closeSearch, pos);

    if (closeIndex === -1) {
      throw new TemplateParseError('Unclosed template tag', 'PARSE_ERROR', source, openIndex);
    }

    const content = source.slice(pos, closeIndex).trim();

    if (content === 'else') {
      tokens.push({
        type: 'else',
        value: content,
        start: pos,
        end: closeIndex,
      });
    } else if (content) {
      tokens.push({
        type: 'content',
        value: content,
        start: pos,
        end: closeIndex,
      });
    }

    const closeLen = tripleClose ? closeDelim.length + 1 : closeDelim.length;
    tokens.push({
      type: tripleClose ? 'close_raw' : 'close',
      value: closeSearch,
      start: closeIndex,
      end: closeIndex + closeLen,
    });

    pos = closeIndex + closeLen;
  }

  return tokens;
}

// ============================================================================
// Expression Parser
// ============================================================================

function parseExpression(expr: string): { name: string; helpers: HelperCall[] } {
  const parts = expr.split('|').map((p) => p.trim());
  const name = parts[0] ?? '';
  const helpers: HelperCall[] = [];

  for (let i = 1; i < parts.length; i++) {
    const helperExpr = parts[i]?.trim() ?? '';
    const match = helperExpr.match(/^(\w+)(?:\s+(.+))?$/);

    if (match) {
      const helperName = match[1] ?? '';
      const argsStr = match[2] ?? '';
      const args = parseArgs(argsStr);
      helpers.push({ name: helperName, args });
    }
  }

  return { name, helpers };
}

function parseArgs(argsStr: string): ExpressionArg[] {
  if (!argsStr.trim()) return [];

  const args: ExpressionArg[] = [];
  const regex =
    /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|(\d+(?:\.\d+)?)|(\btrue\b|\bfalse\b)|([^\s,]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(argsStr)) !== null) {
    const fullMatch = match[0];
    if (fullMatch.startsWith('"') || fullMatch.startsWith("'")) {
      // Strip surrounding quotes
      const value = fullMatch.slice(1, -1);
      args.push({ type: 'string', value });
    } else if (match[1] !== undefined) {
      args.push({ type: 'number', value: parseFloat(match[1]) });
    } else if (match[2] !== undefined) {
      args.push({ type: 'boolean', value: match[2] === 'true' });
    } else if (match[3] !== undefined) {
      args.push({ type: 'path', value: match[3] });
    }
  }

  return args;
}

function parseBlockExpression(expr: string): {
  name: string;
  expression: string;
  args: ExpressionArg[];
} {
  const firstSpace = expr.indexOf(' ');

  if (firstSpace === -1) {
    return { name: expr, expression: '', args: [] };
  }

  const name = expr.slice(0, firstSpace);
  const expression = expr.slice(firstSpace + 1).trim();
  const args = parseArgs(expression);

  return { name, expression, args };
}

function parsePartialExpression(expr: string): {
  name: string;
  context?: string;
  hash: Record<string, ExpressionArg>;
} {
  const parts = expr.split(/\s+/);
  const name = parts[0] ?? '';
  let context: string | undefined;
  const hash: Record<string, ExpressionArg> = {};

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    const eqIndex = part.indexOf('=');

    if (eqIndex > -1) {
      const key = part.slice(0, eqIndex);
      const valueStr = part.slice(eqIndex + 1);
      const parsedArgs = parseArgs(valueStr);
      const firstArg = parsedArgs[0];
      if (firstArg) {
        hash[key] = firstArg;
      }
    } else if (!context) {
      context = part;
    }
  }

  return { name, context, hash };
}

// ============================================================================
// AST Parser
// ============================================================================

interface ParserState {
  tokens: Token[];
  pos: number;
  source: string;
}

function getToken(state: ParserState, offset = 0): Token | undefined {
  return state.tokens[state.pos + offset];
}

function parseAST(tokens: Token[], source: string): AST {
  const state: ParserState = { tokens, pos: 0, source };
  const body = parseNodes(state, null);

  return { type: 'root', body };
}

function parseNodes(state: ParserState, endBlock: string | null): ASTNode[] {
  const nodes: ASTNode[] = [];

  while (state.pos < state.tokens.length) {
    const token = getToken(state);
    if (!token) break;

    if (token.type === 'open_end') {
      if (endBlock === null) {
        throw new TemplateParseError(
          'Unexpected closing tag',
          'UNEXPECTED_CLOSE',
          state.source,
          token.start
        );
      }

      const content = getToken(state, 1);
      if (content?.type === 'content' && content.value === endBlock) {
        state.pos += 3;
        return nodes;
      }

      throw new TemplateParseError(
        `Expected {{/${endBlock}}} but found {{/${content?.value ?? ''}}}`,
        'UNEXPECTED_CLOSE',
        state.source,
        token.start
      );
    }

    if (token.type === 'else' || (token.type === 'content' && token.value === 'else')) {
      if (endBlock === null) {
        throw new TemplateParseError(
          'Unexpected {{else}} outside of block',
          'PARSE_ERROR',
          state.source,
          token.start
        );
      }
      return nodes;
    }

    const node = parseNode(state, endBlock);
    if (node) {
      nodes.push(node);
    }
  }

  if (endBlock !== null) {
    const firstToken = state.tokens[0];
    throw new TemplateParseError(
      `Unclosed block: ${endBlock}`,
      'UNCLOSED_BLOCK',
      state.source,
      firstToken?.start ?? 0
    );
  }

  return nodes;
}

function parseNode(state: ParserState, currentBlock: string | null): ASTNode | null {
  const token = getToken(state);
  if (!token) return null;

  switch (token.type) {
    case 'text':
      state.pos++;
      return {
        type: 'text',
        value: token.value,
        start: token.start,
        end: token.end,
      } satisfies TextNode;

    case 'open':
    case 'open_unescaped':
      return parseVariable(state, token.type === 'open');

    case 'open_raw':
      return parseRaw(state);

    case 'open_block':
      return parseBlock(state, currentBlock);

    case 'open_partial':
      return parsePartial(state);

    case 'open_comment':
      return parseComment(state);

    default:
      state.pos++;
      return null;
  }
}

function parseVariable(state: ParserState, escaped: boolean): VariableNode {
  const openToken = getToken(state);
  if (!openToken) {
    throw new TemplateParseError('Unexpected end of input', 'PARSE_ERROR', state.source, 0);
  }
  state.pos++;

  const contentToken = getToken(state);
  if (!contentToken || contentToken.type !== 'content') {
    throw new TemplateParseError(
      'Expected variable name',
      'PARSE_ERROR',
      state.source,
      openToken.start
    );
  }
  state.pos++;

  const closeToken = getToken(state);
  if (!closeToken || closeToken.type !== 'close') {
    throw new TemplateParseError(
      'Unclosed variable tag',
      'PARSE_ERROR',
      state.source,
      openToken.start
    );
  }
  state.pos++;

  const { name, helpers } = parseExpression(contentToken.value);

  return {
    type: 'variable',
    name,
    escaped,
    helpers,
    start: openToken.start,
    end: closeToken.end,
  };
}

function parseRaw(state: ParserState): RawNode {
  const openToken = getToken(state);
  if (!openToken) {
    throw new TemplateParseError('Unexpected end of input', 'PARSE_ERROR', state.source, 0);
  }
  state.pos++;

  const contentToken = getToken(state);
  if (!contentToken || contentToken.type !== 'content') {
    throw new TemplateParseError(
      'Expected variable name',
      'PARSE_ERROR',
      state.source,
      openToken.start
    );
  }
  state.pos++;

  const closeToken = getToken(state);
  if (!closeToken || closeToken.type !== 'close_raw') {
    throw new TemplateParseError('Unclosed raw tag', 'PARSE_ERROR', state.source, openToken.start);
  }
  state.pos++;

  const { name, helpers } = parseExpression(contentToken.value);

  return {
    type: 'raw',
    name,
    helpers,
    start: openToken.start,
    end: closeToken.end,
  };
}

function parseBlock(state: ParserState, _currentBlock: string | null): BlockNode {
  const openToken = getToken(state);
  if (!openToken) {
    throw new TemplateParseError('Unexpected end of input', 'PARSE_ERROR', state.source, 0);
  }
  state.pos++;

  const contentToken = getToken(state);
  if (!contentToken || contentToken.type !== 'content') {
    throw new TemplateParseError(
      'Expected block expression',
      'PARSE_ERROR',
      state.source,
      openToken.start
    );
  }
  state.pos++;

  const closeToken = getToken(state);
  if (!closeToken || closeToken.type !== 'close') {
    throw new TemplateParseError(
      'Unclosed block opening tag',
      'PARSE_ERROR',
      state.source,
      openToken.start
    );
  }
  state.pos++;

  const { name, expression, args } = parseBlockExpression(contentToken.value);
  const body = parseNodes(state, name);

  let inverse: ASTNode[] = [];
  const prevToken = getToken(state, -3);
  if (prevToken?.type === 'else' || (prevToken?.type === 'content' && prevToken.value === 'else')) {
    const afterElse = getToken(state, -2);
    if (afterElse?.type === 'close') {
      inverse = parseNodes(state, name);
    }
  }

  const lastToken = getToken(state, -1);

  return {
    type: 'block',
    name,
    expression,
    args,
    body,
    inverse,
    start: openToken.start,
    end: lastToken?.end ?? openToken.end,
  };
}

function parsePartial(state: ParserState): PartialNode {
  const openToken = getToken(state);
  if (!openToken) {
    throw new TemplateParseError('Unexpected end of input', 'PARSE_ERROR', state.source, 0);
  }
  state.pos++;

  const contentToken = getToken(state);
  if (!contentToken || contentToken.type !== 'content') {
    throw new TemplateParseError(
      'Expected partial name',
      'PARSE_ERROR',
      state.source,
      openToken.start
    );
  }
  state.pos++;

  const closeToken = getToken(state);
  if (!closeToken || closeToken.type !== 'close') {
    throw new TemplateParseError(
      'Unclosed partial tag',
      'PARSE_ERROR',
      state.source,
      openToken.start
    );
  }
  state.pos++;

  const { name, context, hash } = parsePartialExpression(contentToken.value);

  return {
    type: 'partial',
    name,
    context,
    hash,
    start: openToken.start,
    end: closeToken.end,
  };
}

function parseComment(state: ParserState): CommentNode {
  const openToken = getToken(state);
  if (!openToken) {
    throw new TemplateParseError('Unexpected end of input', 'PARSE_ERROR', state.source, 0);
  }
  state.pos++;

  let value = '';
  const contentToken = getToken(state);
  if (contentToken?.type === 'content') {
    value = contentToken.value;
    state.pos++;
  }

  const closeToken = getToken(state);
  if (!closeToken || closeToken.type !== 'close') {
    throw new TemplateParseError('Unclosed comment', 'PARSE_ERROR', state.source, openToken.start);
  }
  state.pos++;

  return {
    type: 'comment',
    value,
    start: openToken.start,
    end: closeToken.end,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Parse a template string into an AST
 *
 * @param source - Template source string
 * @param options - Compile options
 * @returns Parsed AST
 */
export function parse(source: string, options: CompileOptions = {}): AST {
  const delimiters = options.delimiters ?? [DEFAULT_OPEN, DEFAULT_CLOSE];
  const tokens = tokenize(source, delimiters);
  return parseAST(tokens, source);
}

/**
 * Validate a template string without fully parsing
 *
 * @param source - Template source string
 * @param options - Compile options
 * @returns True if valid, throws TemplateParseError if invalid
 */
export function validate(source: string, options: CompileOptions = {}): boolean {
  parse(source, options);
  return true;
}
