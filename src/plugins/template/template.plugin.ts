/**
 * Template Plugin for NextRush v2
 *
 * Safe, minimal, helper-based HTML templating with auto-escaping.
 *
 * Features:
 * - Auto-escape by default; triple mustache {{{expr}}} to output raw
 * - Helpers: stripHTML, json, upper, lower, date, safe
 * - Partials: {{> partialName}} (inline or file-based when viewsDir is set)
 * - Nested path access: {{user.name}}, {{profile.bio}}
 * - File-based rendering when viewsDir provided; otherwise inline templates
 * - Simple cache of compiled templates (in-memory)
 * - Block syntax:
 *   - Conditionals: {{#if cond}}...{{else}}...{{/if}}
 *   - Loops: {{#each items}}...{{/each}} with {{this}}, {{@index}}, {{@key}}
 *   - With: {{#with obj}}...{{/with}}
 * - Layouts (when viewsDir provided): render(template, data, { layout: 'layout.html' })
 */
import { BasePlugin } from '@/plugins/core/base-plugin';
import type {
  Application,
  Middleware,
  TemplatePluginOptions,
} from '@/types/context';
import { SimpleTemplateEngine } from './engine/simple-engine';

export class TemplatePlugin extends BasePlugin {
  public override name = 'TemplatePlugin';
  public override version = '2.0.0-alpha.1';
  public override description =
    'Safe, minimal HTML templating with helpers and partials';

  private engine: SimpleTemplateEngine;

  constructor(options: TemplatePluginOptions = {}) {
    super();
    this.engine = new SimpleTemplateEngine(options);
  }

  public override onInstall(app: Application): void {
    const middleware: Middleware = async (ctx, next) => {
      const boundRender = async (
        templateOrName: string,
        data?: Record<string, unknown>,
        options?: { layout?: string }
      ) => {
        const html = await this.engine.render(
          templateOrName,
          (data || {}) as Record<string, unknown>,
          options
        );
        ctx.res.setHeader('Content-Type', 'text/html');
        ctx.res.end(html);
      };
      (ctx.res as any).render = boundRender;
      (ctx as any).render = boundRender;
      await next();
    };

    app.use(middleware);
  }
}
