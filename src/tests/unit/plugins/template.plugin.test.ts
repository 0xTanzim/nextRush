import { createApp } from '@/index';
import { TemplatePlugin } from '@/plugins/template/template.plugin';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('TemplatePlugin', () => {
  it('renders inline template with helpers and escaping', async () => {
    const app = createApp();
    new TemplatePlugin().install(app as any);

    app.get('/t1', async ctx => {
      await (ctx.res as any).render(
        '<h1>{{user.name}}</h1><p>{{stripHTML user.bio}}</p><pre>{{json data}}</pre>',
        {
          user: { name: '<Admin>', bio: '<b>bold</b>' },
          data: { ok: true },
        }
      );
    });

    const server = app.listen(0);
    await new Promise<void>(resolve =>
      server.once('listening', () => resolve())
    );
    const address: any = server.address();
    const res = await fetch(`http://localhost:${address.port}/t1`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('&lt;Admin&gt;'); // escaped
    expect(html).toContain('bold'); // stripped b tag
    expect(html).toContain('"ok": true');
    await app.shutdown();
  });

  it('supports triple mustache to avoid escaping', async () => {
    const app = createApp();
    new TemplatePlugin().install(app as any);

    app.get('/t2', async ctx => {
      await (ctx.res as any).render('<div>{{{html}}}</div>', {
        html: '<b>X</b>',
      });
    });

    const server = app.listen(0);
    await new Promise<void>(resolve =>
      server.once('listening', () => resolve())
    );
    const { port }: any = server.address();
    const res = await fetch(`http://localhost:${port}/t2`);
    const html = await res.text();
    expect(html).toContain('<b>X</b>');
    await app.shutdown();
  });

  it('supports filter chain syntax', async () => {
    const app = createApp();
    new TemplatePlugin().install(app as any);

    app.get('/t3', async ctx => {
      await (ctx.res as any).render('<p>{{ user.name | upper }}</p>', {
        user: { name: 'john' },
      });
    });

    const server = app.listen(0);
    await new Promise<void>(resolve =>
      server.once('listening', () => resolve())
    );
    const { port }: any = server.address();
    const res = await fetch(`http://localhost:${port}/t3`);
    const html = await res.text();
    expect(html).toContain('JOHN');
    await app.shutdown();
  });

  it('supports if/else blocks', async () => {
    const app = createApp();
    new TemplatePlugin().install(app as any);
    app.get('/t4', async ctx => {
      await (ctx.res as any).render('{{#if ok}}Y{{else}}N{{/if}}', {
        ok: true,
      });
    });
    const server = app.listen(0);
    await new Promise<void>(resolve =>
      server.once('listening', () => resolve())
    );
    const { port }: any = server.address();
    const res = await fetch(`http://localhost:${port}/t4`);
    expect(await res.text()).toBe('Y');
    await app.shutdown();
  });

  it('supports each arrays and exposes @index and this', async () => {
    const app = createApp();
    new TemplatePlugin().install(app as any);
    app.get('/t5', async ctx => {
      await (ctx.res as any).render(
        '{{#each items}}({{@index}}:{{this}}){{/each}}',
        { items: ['a', 'b'] }
      );
    });
    const server = app.listen(0);
    await new Promise<void>(resolve =>
      server.once('listening', () => resolve())
    );
    const { port }: any = server.address();
    const res = await fetch(`http://localhost:${port}/t5`);
    expect(await res.text()).toBe('(0:a)(1:b)');
    await app.shutdown();
  });

  it('supports with blocks', async () => {
    const app = createApp();
    new TemplatePlugin().install(app as any);
    app.get('/t6', async ctx => {
      await (ctx.res as any).render(
        '{{#with user}}{{name}}/{{role}}{{/with}}',
        { user: { name: 'Ada', role: 'admin' } }
      );
    });
    const server = app.listen(0);
    await new Promise<void>(resolve =>
      server.once('listening', () => resolve())
    );
    const { port }: any = server.address();
    const res = await fetch(`http://localhost:${port}/t6`);
    expect(await res.text()).toBe('Ada/admin');
    await app.shutdown();
  });

  it('treats empty and null values as falsy in if blocks', async () => {
    const app = createApp();
    new TemplatePlugin().install(app as any);
    app.get('/t8', async ctx => {
      await (ctx.res as any).render('{{#if val}}T{{else}}F{{/if}}', {
        val: '',
      });
    });
    const server = app.listen(0);
    await new Promise<void>(resolve =>
      server.once('listening', () => resolve())
    );
    const { port }: any = server.address();
    const res = await fetch(`http://localhost:${port}/t8`);
    expect(await res.text()).toBe('F');
    await app.shutdown();
  });

  it('escapes helper outputs unless marked safe', async () => {
    const app = createApp();
    new TemplatePlugin({
      helpers: { echo: (v: unknown) => String(v) },
    }).install(app as any);
    app.get('/t9', async ctx => {
      await (ctx.res as any).render('<div>{{ echo html }}</div>', {
        html: '<b>X</b>',
      });
    });
    const server = app.listen(0);
    await new Promise<void>(resolve =>
      server.once('listening', () => resolve())
    );
    const { port }: any = server.address();
    const res = await fetch(`http://localhost:${port}/t9`);
    const html = await res.text();
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;');
    await app.shutdown();
  });

  it('allows raw helper output via safe wrapper', async () => {
    const app = createApp();
    new TemplatePlugin({
      helpers: {
        raw: (v: unknown) => ({ __safe: true, value: String(v) }) as any,
      },
    }).install(app as any);
    app.get('/t10', async ctx => {
      await (ctx.res as any).render('<div>{{ raw html }}</div>', {
        html: '<b>X</b>',
      });
    });
    const server = app.listen(0);
    await new Promise<void>(resolve =>
      server.once('listening', () => resolve())
    );
    const { port }: any = server.address();
    const res = await fetch(`http://localhost:${port}/t10`);
    const html = await res.text();
    expect(html).toContain('<b>X</b>');
    await app.shutdown();
  });

  it('loads file partials and supports layouts', async () => {
    const views = mkdtempSync(join(tmpdir(), 'views-'));
    writeFileSync(join(views, 'header.html'), '<header>H</header>');
    writeFileSync(
      join(views, 'layout.html'),
      '<html><body>{{{body}}}</body></html>'
    );
    writeFileSync(
      join(views, 'page.html'),
      '{{> header}}<main>{{title}}</main>'
    );

    const app = createApp();
    new TemplatePlugin({ viewsDir: views }).install(app as any);
    app.get('/t7', async ctx => {
      await (ctx as any).render(
        'page.html',
        { title: 'Home' },
        { layout: 'layout.html' }
      );
    });
    const server = app.listen(0);
    await new Promise<void>(resolve =>
      server.once('listening', () => resolve())
    );
    const { port }: any = server.address();
    const res = await fetch(`http://localhost:${port}/t7`);
    const html = await res.text();
    expect(html).toBe(
      '<html><body><header>H</header><main>Home</main></body></html>'
    );
    await app.shutdown();
  });
});
