import type { TemplatePluginOptions } from '@/types/context';
import { promises as fsp, readFileSync } from 'node:fs';
import { join } from 'node:path';

type CompiledTemplate = (data: Record<string, unknown>) => string;

type ASTNode =
  | { type: 'text'; value: string }
  | { type: 'var'; expr: string; unescaped: boolean }
  | { type: 'if'; expr: string; consequent: ASTNode[]; alternate: ASTNode[] }
  | { type: 'each'; expr: string; body: ASTNode[] }
  | { type: 'with'; expr: string; body: ASTNode[] };

export class SimpleTemplateEngine {
  private helpers = new Map<
    string,
    (value: unknown, ...args: unknown[]) => unknown
  >();
  private partials = new Map<string, string>();
  private cache = new Map<string, CompiledTemplate>();
  private viewsDir?: string;
  private cacheEnabled: boolean;
  private enableFilePartials: boolean;
  private partialExt: string;

  constructor(options: TemplatePluginOptions = {}) {
    this.viewsDir = options.viewsDir ?? '';
    this.cacheEnabled = options.cache !== false;
    this.enableFilePartials = options.enableFilePartials !== false;
    this.partialExt = options.partialExt ?? '.html';

    this.registerHelper('stripHTML', (value: unknown): string =>
      String(value ?? '').replace(/<[^>]*>/g, '')
    );
    this.registerHelper(
      'json',
      (value: unknown): { __safe: true; value: string } => ({
        __safe: true,
        value: JSON.stringify(value, null, 2),
      })
    );
    this.registerHelper('upper', (value: unknown): string =>
      String(value ?? '').toUpperCase()
    );
    this.registerHelper('lower', (value: unknown): string =>
      String(value ?? '').toLowerCase()
    );
    this.registerHelper('date', (value: unknown, fmt?: unknown): string => {
      const d = value instanceof Date ? value : new Date(String(value ?? ''));
      if (Number.isNaN(d.getTime())) return '';
      const iso = d.toISOString();
      if (!fmt || typeof fmt !== 'string') return iso;
      return fmt
        .replace(/YYYY/g, String(d.getUTCFullYear()))
        .replace(/MM/g, String(d.getUTCMonth() + 1).padStart(2, '0'))
        .replace(/DD/g, String(d.getUTCDate()).padStart(2, '0'))
        .replace(/hh/g, String(d.getUTCHours()).padStart(2, '0'))
        .replace(/mm/g, String(d.getUTCMinutes()).padStart(2, '0'))
        .replace(/ss/g, String(d.getUTCSeconds()).padStart(2, '0'));
    });
    this.registerHelper(
      'safe',
      (value: unknown): { __safe: true; value: string } => ({
        __safe: true,
        value: this.toString(value),
      })
    );

    if (options.helpers) {
      for (const [name, fn] of Object.entries(options.helpers))
        this.registerHelper(name, fn);
    }
    if (options.partials) {
      for (const [name, tpl] of Object.entries(options.partials))
        this.partials.set(name, tpl);
    }
  }

  public registerHelper(
    name: string,
    fn: (value: unknown, ...args: unknown[]) => unknown
  ): void {
    this.helpers.set(name, fn);
  }
  public registerPartial(name: string, template: string): void {
    this.partials.set(name, template);
  }

  public async render(
    templateOrName: string,
    data: Record<string, unknown> = {},
    options?: { layout?: string }
  ): Promise<string> {
    let html: string;
    if (
      this.viewsDir &&
      !templateOrName.includes('\n') &&
      !templateOrName.includes('<') &&
      !templateOrName.includes('{{')
    ) {
      const filename = join(this.viewsDir, templateOrName);
      html = await this.renderFile(filename, data);
    } else {
      html = this.renderString(templateOrName, data);
    }
    if (options?.layout && this.viewsDir) {
      const layoutPath = join(this.viewsDir, options.layout);
      const layoutHtml = await fsp.readFile(layoutPath, 'utf8');
      return layoutHtml.replace(/{{{\s*body\s*}}}|{{\s*body\s*}}/g, () => html);
    }
    return html;
  }

  public async renderFile(
    filePath: string,
    data: Record<string, unknown> = {}
  ): Promise<string> {
    const key = `file:${filePath}`;
    let compiled = this.cache.get(key);
    if (!compiled || !this.cacheEnabled) {
      const source = await fsp.readFile(filePath, 'utf8');
      compiled = this.compile(source);
      if (this.cacheEnabled) this.cache.set(key, compiled);
    }
    return compiled(data);
  }

  public renderString(
    source: string,
    data: Record<string, unknown> = {}
  ): string {
    const key = `str:${source}`;
    let compiled = this.cache.get(key);
    if (!compiled || !this.cacheEnabled) {
      compiled = this.compile(source);
      if (this.cacheEnabled) this.cache.set(key, compiled);
    }
    return compiled(data);
  }

  private compile(source: string): CompiledTemplate {
    let tpl = source;
    const partialRe = /{{>\s*([\w-]+)\s*}}/g;
    let guard = 0;
    while (partialRe.test(tpl) && guard++ < 10) {
      tpl = tpl.replace(partialRe, (_m, p1) => {
        const fromMap = this.partials.get(p1);
        if (fromMap) return fromMap;
        if (this.viewsDir && this.enableFilePartials) {
          try {
            const path = join(this.viewsDir!, `${p1}${this.partialExt}`);
            const content = readFileSync(path, 'utf8');
            return content;
          } catch {
            return '';
          }
        }
        return '';
      });
    }
    const ast = this.parse(tpl);
    return (ctx: Record<string, unknown>) => this.renderAST(ast, ctx).join('');
  }

  private parse(tpl: string): ASTNode[] {
    const nodes: ASTNode[] = [];
    let i = 0;
    const len = tpl.length;
    const parseBlock = (
      endMatcher: (tag: string) => boolean,
      allowElse = false
    ): { body: ASTNode[]; alternate: ASTNode[] } => {
      const body: ASTNode[] = [];
      const alternate: ASTNode[] = [];
      let active = body;
      while (i < len) {
        const open = tpl.indexOf('{{', i);
        if (open === -1) {
          active.push({ type: 'text', value: tpl.slice(i) });
          i = len;
          break;
        }
        if (open > i) active.push({ type: 'text', value: tpl.slice(i, open) });
        i = open;
        const isTriple = tpl[i + 2] === '{';
        const endDelim = isTriple ? '}}}' : '}}';
        const close = tpl.indexOf(endDelim, i + (isTriple ? 3 : 2));
        if (close === -1) {
          active.push({ type: 'text', value: tpl.slice(i) });
          i = len;
          break;
        }
        const tag = tpl.slice(i + (isTriple ? 3 : 2), close).trim();
        i = close + endDelim.length;
        if (tag.startsWith('/')) {
          if (endMatcher(tag.slice(1).trim())) break;
          active.push({ type: 'text', value: `{{${tag}}}` });
          continue;
        }
        if (allowElse && tag === 'else') {
          active = alternate;
          continue;
        }
        if (tag.startsWith('#')) {
          const [name, ...rest] = tag.slice(1).trim().split(/\s+/);
          const expr = rest.join(' ');
          if (name === 'if') {
            const inner = parseBlock(t => t === 'if', true);
            active.push({
              type: 'if',
              expr,
              consequent: inner.body,
              alternate: inner.alternate,
            });
            continue;
          }
          if (name === 'each') {
            const inner = parseBlock(t => t === 'each');
            active.push({ type: 'each', expr, body: inner.body });
            continue;
          }
          if (name === 'with') {
            const inner = parseBlock(t => t === 'with');
            active.push({ type: 'with', expr, body: inner.body });
            continue;
          }
          active.push({ type: 'text', value: `{{#${name} ${expr}}}` });
          continue;
        }
        const unescaped = isTriple;
        active.push({ type: 'var', expr: tag, unescaped });
      }
      return { body, alternate };
    };
    while (i < len) {
      const open = tpl.indexOf('{{', i);
      if (open === -1) {
        nodes.push({ type: 'text', value: tpl.slice(i) });
        break;
      }
      if (open > i) nodes.push({ type: 'text', value: tpl.slice(i, open) });
      i = open;
      const isTriple = tpl[i + 2] === '{';
      const endDelim = isTriple ? '}}}' : '}}';
      const close = tpl.indexOf(endDelim, i + (isTriple ? 3 : 2));
      if (close === -1) {
        nodes.push({ type: 'text', value: tpl.slice(i) });
        break;
      }
      const tag = tpl.slice(i + (isTriple ? 3 : 2), close).trim();
      i = close + endDelim.length;
      if (tag.startsWith('#')) {
        const [name, ...rest] = tag.slice(1).trim().split(/\s+/);
        const expr = rest.join(' ');
        if (name === 'if') {
          const inner = parseBlock(t => t === 'if', true);
          nodes.push({
            type: 'if',
            expr,
            consequent: inner.body,
            alternate: inner.alternate,
          });
          continue;
        }
        if (name === 'each') {
          const inner = parseBlock(t => t === 'each');
          nodes.push({ type: 'each', expr, body: inner.body });
          continue;
        }
        if (name === 'with') {
          const inner = parseBlock(t => t === 'with');
          nodes.push({ type: 'with', expr, body: inner.body });
          continue;
        }
        nodes.push({ type: 'text', value: `{{#${name} ${expr}}}` });
        continue;
      }
      if (tag.startsWith('/')) {
        nodes.push({ type: 'text', value: `{{${tag}}}` });
        continue;
      }
      const unescaped = isTriple;
      nodes.push({ type: 'var', expr: tag, unescaped });
    }
    return nodes;
  }

  private renderAST(nodes: ASTNode[], ctx: Record<string, unknown>): string[] {
    const out: string[] = [];
    for (const node of nodes) {
      switch (node.type) {
        case 'text':
          out.push(node.value);
          break;
        case 'var': {
          const s = this.evaluateExpression(node.expr, ctx, node.unescaped);
          out.push(s);
          break;
        }
        case 'if': {
          const cond = this.truthy(this.literalOrPath(ctx, node.expr));
          const chosen = cond ? node.consequent : node.alternate;
          out.push(...this.renderAST(chosen, ctx));
          break;
        }
        case 'each': {
          const iter = this.literalOrPath(ctx, node.expr) as unknown;
          if (Array.isArray(iter)) {
            for (let i = 0; i < iter.length; i++) {
              const item = iter[i];
              const child = this.childScope(ctx);
              (child as any)['this'] = item;
              (child as any)['@index'] = i;
              if (item && typeof item === 'object') {
                for (const k of Object.keys(item))
                  (child as any)[k] = (item as any)[k];
              }
              out.push(...this.renderAST((node as any).body, child));
            }
          } else if (iter && typeof iter === 'object') {
            const dict = iter as Record<string, unknown>;
            const keys = Object.keys(dict);
            for (let i = 0; i < keys.length; i++) {
              const key: string = keys[i] as string;
              const item = dict[key];
              const child = this.childScope(ctx);
              (child as any)['this'] = item;
              (child as any)['@index'] = i;
              (child as any)['@key'] = key;
              if (item && typeof item === 'object') {
                for (const k of Object.keys(item))
                  (child as any)[k] = (item as any)[k];
              }
              out.push(...this.renderAST((node as any).body, child));
            }
          }
          break;
        }
        case 'with': {
          const obj = this.literalOrPath(ctx, node.expr) as any;
          if (obj && typeof obj === 'object') {
            const child = this.childScope(ctx);
            for (const k of Object.keys(obj)) (child as any)[k] = obj[k];
            (child as any)['this'] = obj;
            out.push(...this.renderAST((node as any).body, child));
          }
          break;
        }
      }
    }
    return out;
  }

  private childScope(parent: Record<string, unknown>): Record<string, unknown> {
    return Object.create(parent);
  }

  private evaluateExpression(
    expr: string,
    ctx: Record<string, unknown>,
    unescaped: boolean
  ): string {
    const parts = this.tokenize(expr);
    if (parts.length === 0) return '';
    if (expr.includes('|')) {
      const [head, ...filters] = expr.split('|').map(s => s.trim());
      const headStr = (head ?? '') as string;
      let val = this.resolvePath(ctx, headStr);
      for (const f of filters) {
        const helper = this.helpers.get(f);
        if (helper) val = helper(val);
      }
      if (val && typeof val === 'object' && (val as any).__safe)
        return this.toString((val as any).value);
      return unescaped
        ? this.toString(val)
        : this.escapeHTML(this.toString(val));
    }
    const first = parts[0];
    if (!first) return '';
    if (this.helpers.has(first)) {
      const helper = this.helpers.get(first)!;
      const args = parts.slice(1).map(p => this.literalOrPath(ctx, p));
      const out = helper(args[0], ...args.slice(1));
      if (out && typeof out === 'object' && (out as any).__safe)
        return this.toString((out as any).value);
      return unescaped
        ? this.toString(out)
        : this.escapeHTML(this.toString(out));
    }
    const val = this.resolvePath(ctx, first as string);
    return unescaped ? this.toString(val) : this.escapeHTML(this.toString(val));
  }

  private tokenize(expr: string): string[] {
    const tokens: string[] = [];
    let cur = '';
    let inQuote: '"' | "'" | null = null;
    for (let i = 0; i < expr.length; i++) {
      const ch = expr.charAt(i);
      if (inQuote) {
        if (ch === inQuote) {
          inQuote = null;
        } else {
          cur += ch;
        }
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = ch as '"' | "'";
        continue;
      }
      if (/\s/.test(ch)) {
        if (cur) {
          tokens.push(cur);
          cur = '';
        }
      } else {
        cur += ch;
      }
    }
    if (cur) tokens.push(cur);
    return tokens;
  }

  private literalOrPath(ctx: Record<string, unknown>, token: string): unknown {
    if (token.startsWith('"') && token.endsWith('"')) return token.slice(1, -1);
    if (token.startsWith("'") && token.endsWith("'")) return token.slice(1, -1);
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (token === 'null') return null;
    if (!Number.isNaN(Number(token))) return Number(token);
    return this.resolvePath(ctx, token);
  }

  private truthy(v: unknown): boolean {
    return !!(Array.isArray(v) ? v.length : v);
  }

  private resolvePath(ctx: Record<string, unknown>, path: string): unknown {
    if (!path) return '';
    const parts = path.split('.');
    let cur: any = ctx;
    for (const p of parts) {
      if (cur == null) return '';
      cur = cur[p];
    }
    return cur ?? '';
  }

  private toString(value: unknown): string {
    if (value == null) return '';
    return typeof value === 'string' ? value : String(value);
  }

  private escapeHTML(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
