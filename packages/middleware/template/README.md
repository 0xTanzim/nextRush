# @nextrush/template

> Adapter-based template rendering for NextRush -- a zero-dependency, Mustache-like built-in engine plus optional adapters for EJS, Handlebars, Nunjucks, Pug, and Eta, behind one unified render API.

[![npm version](https://img.shields.io/npm/v/@nextrush/template.svg)](https://www.npmjs.com/package/@nextrush/template)
[![downloads](https://img.shields.io/npm/dm/@nextrush/template.svg)](https://www.npmjs.com/package/@nextrush/template)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/template.svg)](https://bundlephobia.com/package/@nextrush/template)
[![types](https://img.shields.io/npm/types/@nextrush/template.svg)](https://www.npmjs.com/package/@nextrush/template)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/template.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Render HTML templates -- built-in engine by default, or EJS/Handlebars/Nunjucks/Pug/Eta via optional adapters -- behind one `ctx.render()` API |
| **Package type** | Middleware |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install; not re-exported from `nextrush` or `nextrush/class` |
| **Support tier** | Public -- middleware (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Node.js only -- the built-in engine and file-loading paths use `node:fs`/`node:path`; no Bun/Deno/Edge claim is made by this package |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x |
| **Introduced** | v1.0.0 |

## Highlights

- Zero required runtime dependencies -- a types-only dependency on `@nextrush/types`; `@nextrush/core` and all five external template engines are *optional* peer dependencies, never installed automatically
- Built-in Mustache-like engine ships with zero external dependencies: variables, blocks (`#if`/`#unless`/`#each`/`#with`), partials, layouts, comments, and 50+ helpers
- Six real engines behind one adapter interface: `builtin`, `ejs`, `handlebars`, `nunjucks`, `pug`, `eta` -- switch engines without changing call sites
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed, strict TypeScript, zero `any`

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Compatibility](#compatibility) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

Every template engine has its own render function, its own file-loading convention, and its own
caching behavior. Wiring any one of them into a request handler by hand looks simple at first:

```ts
// TODAY, without a shared render contract -- works, until you need a second engine
// or forget to guard file-based caching yourself:
import ejs from 'ejs';
import { readFile } from 'node:fs/promises';

app.get('/users/:id', async (ctx) => {
  const source = await readFile('./views/user.ejs', 'utf-8'); // re-read on every request
  const html = ejs.render(source, { id: ctx.params.id });     // re-compiled on every request
  ctx.set('Content-Type', 'text/html');
  ctx.body = html;
});
```

There is no caching (every request re-reads and re-compiles the template), no layout support, no
path-traversal guard on the template filename, and switching to a second engine later means
rewriting every handler that calls `ejs.render()` directly.

## When to use

**Use `@nextrush/template` if:**

- You want to render server-side HTML from templates, with `ctx.render(name, data)` staying the
  same call site regardless of which engine renders it
- You want file-based templates cached automatically once `NODE_ENV=production`, without wiring a
  cache map yourself
- You want to start with a zero-dependency built-in engine and adopt EJS/Handlebars/Nunjucks/Pug/
  Eta later without changing the middleware call in your app

**Reach for something else if:**

- You're building a client-rendered SPA -- this package renders HTML strings on the server; it has
  no browser runtime or hydration story
- You need a JSON API response -- use `ctx.json()` directly; there's no templating overhead to pay
- You need streaming server-rendered output (partial flush before the full response is ready) --
  see [`@nextrush/stream`](../../stream) for SSE/NDJSON; this package renders a complete string

---

## Installation

```bash
pnpm add @nextrush/template
# npm i @nextrush/template . yarn add @nextrush/template . bun add @nextrush/template
```

> [!NOTE]
> `@nextrush/template` is not re-exported by the `nextrush` meta package -- install and import it
> directly, as shown above. `@nextrush/core` is an *optional* peer dependency (for the
> `Context`/`Middleware` type contracts); installing `nextrush` or `@nextrush/core` separately
> satisfies it. The five external engines (`ejs`, `eta`, `handlebars`, `nunjucks`, `pug`) are also
> optional peer dependencies -- install only the one you use; the built-in engine needs none of them.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { template } from '@nextrush/template';

const app = createApp();

app.use(template()); // built-in engine, views in ./views by default

app.get('/', async (ctx) => {
  await ctx.render('home', { title: 'Hello NextRush!' });
});

listen(app, 8080);
```

```text
<!-- views/home.html -->
<h1>{{title}}</h1>
```

`template()` with no arguments uses the zero-dependency built-in engine and adds `ctx.render()`
to every request; no template engine package needs to be installed to run this example.

## Capabilities

**Engines (via adapters, one unified API)**
- `builtin` (default) -- Mustache-like syntax, zero dependencies, always available
- `ejs`, `handlebars`, `nunjucks`, `pug`, `eta` -- each loaded lazily via a dynamic `import()` the
  first time that engine is used; each is an *optional* peer dependency, not bundled

**Built-in engine syntax**
- `{{variable}}` -- HTML-escaped interpolation; `{{{variable}}}` or `{{& variable}}` -- raw (unescaped) output
- `{{variable | helper}}` -- pipe a value through a registered helper
- `{{#if cond}}...{{else}}...{{/if}}`, `{{#unless cond}}...{{/unless}}`, `{{#each items}}...{{/each}}`, `{{#with obj}}...{{/with}}` -- block helpers
- `{{> partialName}}` -- partial inclusion; `{{! comment }}` -- comments, stripped from output
- 50+ built-in helpers: string (`upper`, `lower`, `capitalize`, `titleCase`, `truncate`, `stripHtml`, ...), number (`formatNumber`, `currency`, `percent`, `round`, ...), date (`formatDate`, `timeAgo`, `day`, `month`, `year`, `now`), array/object (`first`, `last`, `sort`, `unique`, `keys`, `values`, `get`, ...), comparison (`eq`, `ne`, `gt`, `lt`, `and`, `or`, `not`), and `json`/`safe` for output control

**Security**
- HTML-escaping is on by default for `{{variable}}` interpolation (`compile.escape: true`); use `{{{ }}}`/`{{& }}` or the `safe` helper only for trusted content
- Property access through a dotted path (e.g. `{{user.name}}`) blocks `__proto__`, `constructor`, `prototype`, and getter/setter dunder properties -- a template cannot read or trigger a prototype-pollution-style property chain
- Layout/partial rendering is depth-guarded: the compiler's internal recursion cap is 100 nested render calls (`MAX_RECURSION_DEPTH` in `compiler.ts`); the built-in file-based adapter additionally caps layout nesting at 10 (`MAX_LAYOUT_DEPTH` in `adapters/builtin.ts`) and the `TemplateEngine` class's file loader rejects a resolved template/partials path that would escape its configured `root` directory
- These guards apply to the built-in engine and the `TemplateEngine`/`createBuiltinAdapter` file-loading paths; the EJS/Handlebars/Nunjucks/Pug/Eta adapters delegate escaping and recursion behavior to that engine's own library

**Caching**
- File-based rendering (`ctx.render()`, `TemplateEngine.render()`, and every adapter's `renderFile()`) caches the compiled template in memory once loaded
- Caching defaults to **on when `NODE_ENV=production`, off otherwise** -- read directly from `process.env.NODE_ENV` in every adapter and in `TemplateEngine`; pass `cache: true`/`cache: false` explicitly to override
- Each adapter and `TemplateEngine` instance keeps its own in-memory `Map` cache, keyed by resolved file path; `clearCache()` is available on every adapter and on `TemplateEngine`

## Mental model

`template(engine, options)` builds one adapter for the chosen engine and attaches `ctx.render()`
to the request. Every subsequent `ctx.render(name, data)` call goes through that same adapter,
regardless of which engine backs it.

```text
ctx.render(name, data) --> adapter.renderFile(name, { ...ctx.state, ...data })
                                  |
                    load template (cache hit, or read + compile) --> apply layout (if configured)
                                  |
                            ctx.html(renderedString)
```

**Rule:** `ctx.render()` always merges `ctx.state` underneath the data you pass -- explicit render
data overrides anything already on `ctx.state` with the same key.

> [!TIP]
> The full render pipeline, the built-in engine's parse/compile/render stages, and the
> path-traversal/recursion guards (with diagrams) are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Render with the built-in engine (no engine package installed)

```ts
import { template } from '@nextrush/template';

app.use(template({ root: './views' })); // engine defaults to 'builtin'

app.get('/profile/:id', async (ctx) => {
  await ctx.render('profile', { userId: ctx.params.id });
});
```

### Switch to EJS

```bash
pnpm add ejs
```

```ts
app.use(template('ejs', { root: './views' }));

app.get('/', async (ctx) => {
  await ctx.render('home', { title: 'Hello' }); // views/home.ejs
});
```

### Switch to Handlebars, with a layout

```bash
pnpm add handlebars
```

```ts
app.use(
  template('handlebars', {
    root: './views',
    ext: '.hbs',
    layout: 'layouts/main', // wraps every render() in views/layouts/main.hbs
  })
);
```

### Render a template string directly (no files, no middleware)

```ts
import { render, renderAsync } from '@nextrush/template';

const html = render('Hello {{name}}!', { name: 'World' });
// => 'Hello World!'

const htmlAsync = await renderAsync('{{#each items}}{{this}} {{/each}}', {
  items: ['a', 'b', 'c'],
});
// => 'a b c '
```

### Use the standalone `TemplateEngine` outside middleware

```ts
import { createEngine } from '@nextrush/template';

const engine = createEngine({ root: './views', cache: true });
const html = await engine.render('home', { title: 'Hello' });
```

### Register custom helpers

```ts
app.use(
  template({
    root: './views',
    helpers: {
      formatPrice: (value: number) => `$${value.toFixed(2)}`,
    },
  })
);
```

```text
<!-- views/product.html -->
<p>{{price | formatPrice}}</p>
```

## API overview

The sealed public surface (`src/index.ts`, guarded by a public-surface test -- ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `template` | `(engine?: EngineName \| TemplateOptions, options?: TemplateOptions) => Middleware` | 1.0.0 | Stable | Middleware factory; attaches `ctx.render()` for the chosen engine. |
| `render` | `(source: string, data?, options?) => string` | 1.0.0 | Stable | Render a template string synchronously with the built-in engine. |
| `renderAsync` | `(source: string, data?, options?) => Promise<string>` | 1.0.0 | Stable | Render a template string asynchronously with the built-in engine (supports async helpers). |
| `compile` | `(source: string, options?: CompileOptions) => CompiledTemplate` | 1.0.0 | Stable | Compile a template string into a reusable `CompiledTemplate`. |
| `createEngine` | `(options?: EngineOptions) => TemplateEngine` | 1.0.0 | Stable | Create a standalone `TemplateEngine` (file loading, caching, layouts) without middleware. |
| `createViewEngine` | `(options?: EngineOptions) => (filepath, data, callback) => void` | 1.0.0 | Stable | Express-compatible `app.engine(...)` view-engine function. |
| `TemplateEngine` | class | 1.0.0 | Stable | File-based render engine with caching, layouts, helpers, and partials. |
| `createAdapter` | `(engine?: EngineName, config?: AdapterConfig) => TemplateAdapter` | 1.0.0 | Stable | Create an adapter for a named engine (or a custom registered one). |
| `createBuiltinAdapter` / `createEjsAdapter` / `createEtaAdapter` / `createHandlebarsAdapter` / `createNunjucksAdapter` / `createPugAdapter` | `(config?: AdapterConfig) => TemplateAdapter` | 1.0.0 | Stable | Per-engine adapter factories. |
| `registerAdapter` | `(name: string, factory: AdapterFactory) => void` | 1.0.0 | Stable | Register a custom engine adapter under a new name. |
| `hasAdapter` | `(engine: string) => boolean` | 1.0.0 | Stable | Whether an adapter is registered for the given engine name. |
| `getAvailableEngines` | `() => string[]` | 1.0.0 | Stable | List all registered engine names. |
| `parse` | `(source: string, options?: CompileOptions) => AST` | 1.0.0 | Stable | Parse template source into an AST (built-in syntax). |
| `validate` | function | 1.0.0 | Stable | Validate template source without compiling. |
| `TemplateParseError` | class | 1.0.0 | Stable | Thrown on a built-in-engine parse error; carries `line`/`column`/`code`. |
| `VERSION` | `string` | 1.0.0 | Stable | Package version string. |
| 50+ helper functions (`upper`, `lower`, `formatDate`, `eq`, `json`, `safe`, ...) | varies | 1.0.0 | Stable | Individually-exported built-in helpers; see [Capabilities](#capabilities). |
| `builtinHelpers` | `Record<string, HelperFn \| ValueHelper>` | 1.0.0 | Stable | Map of every built-in helper, by name. |
| `createHelperRegistry` | `() => Map<string, HelperFn \| ValueHelper>` | 1.0.0 | Stable | Fresh `Map` pre-populated with `builtinHelpers`. |
| `type TemplateOptions` / `AdapterConfig` / `EngineOptions` / `RenderOptions` / `CompileOptions` / `CompiledTemplate` / `TemplateAdapter` / `EngineName` / `TemplateData` / `AST` / `ASTNode` / ... | -- | 1.0.0 | Stable | Public option, adapter, and AST type contracts. |

## Options

**`template(engine?, options?)`**

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `engine` | `'builtin' \| 'ejs' \| 'handlebars' \| 'nunjucks' \| 'pug' \| 'eta'` | No | `'builtin'` | No | First positional argument; selects the rendering engine. |
| `root` | `string` | No | `'./views'` | Yes | Directory templates are loaded from; every adapter validates the resolved path stays inside `root`. |
| `ext` | `string` | No | per-engine (`.html` builtin, `.ejs`, `.hbs`, `.njk`, `.pug`, `.eta`) | No | Default file extension appended when a template name has none. |
| `cache` | `boolean` | No | `process.env.NODE_ENV === 'production'` | No | Enables the in-memory compiled-template cache. |
| `layout` | `string` | No | `undefined` | No | Default layout template every render is wrapped in. |
| `helpers` | `Record<string, Function>` | No | `{}` | No | Custom helper functions merged with the built-ins (built-in engine) or registered with the underlying engine (adapters). |
| `enableContextRender` | `boolean` | No | `true` | No | Whether `template()` attaches `ctx.render()` to the request. |

**`createEngine(options?)` (`EngineOptions`, for the standalone `TemplateEngine`)**

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `root` | `string` | No | `process.cwd()` | Yes | Root directory; template and partials-directory lookups reject a resolved path outside it. |
| `ext` | `string` | No | `'.html'` | No | Default extension for template files without one. |
| `cache` | `boolean` | No | `process.env.NODE_ENV === 'production'` | No | Enables the engine's compiled-template `Map` cache. |
| `layout` | `string \| null` | No | `null` | No | Default layout wrapping every `render()` call. |
| `partialsDir` | `string \| null` | No | `null` | No | Directory to auto-load partials from via `loadPartials()`. |
| `helpers` | `Record<string, HelperFn \| ValueHelper>` | No | `{}` | No | Custom helpers merged with `builtinHelpers`. |
| `partials` | `Record<string, string>` | No | `{}` | No | Inline partial sources registered at construction. |
| `compile` | `CompileOptions` | No | see below | No | Compile-time options forwarded to `compile()`. |

**`compile(source, options?)` (`CompileOptions`, built-in engine only)**

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `escape` | `boolean` | No | `true` | Yes | HTML-escapes `{{variable}}` output; disabling it removes escaping for every interpolation in that compile. |
| `strict` | `boolean` | No | `false` | No | Throws on a missing variable instead of rendering an empty string. |
| `async` | `boolean` | No | `false` | No | Enables async-helper support during compilation (also settable per-render via `renderAsync`). |
| `delimiters` | `[string, string]` | No | `['{{', '}}']` | No | Custom open/close delimiters for the built-in parser. |
| `helpers` | `Record<string, HelperFn \| ValueHelper>` | No | `{}` | No | Compile-time helpers, merged under render-time helpers. |
| `partials` | `Record<string, string \| CompiledTemplate>` | No | `{}` | No | Compile-time partials, merged under render-time partials. |

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | 3.x |
| Node.js | >=22 |
| TypeScript | >=5.x |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | :---: | ----- |
| Node.js >=22 | Yes | ESM-only; the built-in engine's file loader and `TemplateEngine` use `node:fs/promises`/`node:path` directly |
| Bun / Deno / Edge | Not claimed | This package targets Node's filesystem APIs with no adapter abstraction or conformance-suite coverage; the pure string-based `render()`/`renderAsync()`/`compile()` functions have no Node dependency, but file-based rendering (`ctx.render()`, `TemplateEngine`, adapter `renderFile()`) does |

**Integration**
- **Peer dependencies (all optional):** `@nextrush/core` (for the `Context`/`Middleware` type contracts) and, per chosen engine, `ejs@^3.0.0`, `eta@^3.0.0`, `handlebars@^4.0.0`, `nunjucks@^3.0.0`, `pug@^3.0.0` -- none are installed automatically; install only the one engine you use.
- **Works with:** any NextRush middleware chain; register `template()` before route handlers that call `ctx.render()`.
- **Incompatible with:** none directly.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>"EJS is not installed. Please install it with: npm install ejs" (or the equivalent for another engine)</strong></summary>

**Cause:** the chosen adapter (`ejs`, `handlebars`, `nunjucks`, `pug`, `eta`) lazily `import()`s
its underlying package the first time it renders; that package is an optional peer dependency and
is never installed for you. **Fix:** install the specific engine package the error names.

```bash
pnpm add ejs
```

</details>

<details>
<summary><strong>Template edits aren't showing up after redeploy</strong></summary>

**Cause:** `cache` defaults to `true` whenever `process.env.NODE_ENV === 'production'` -- the
compiled template stays in memory for the process lifetime once loaded. **Fix:** this is expected
in production; restart the process after deploying new templates, or pass `cache: false`
explicitly if templates must be re-read on every request (development-style behavior).

```ts
app.use(template({ root: './views', cache: false }));
```

</details>

<details>
<summary><strong>"Template path traversal detected" / "Path traversal detected" error</strong></summary>

**Cause:** the resolved template or partials-directory path fell outside the configured `root` --
either the template name contained a `..` segment, or (for `TemplateEngine`) the resolved absolute
path didn't stay under `root`. **Fix:** this is by design; pass template names relative to `root`
without `..` segments.

</details>

<details>
<summary><strong>"Maximum template nesting depth (100) exceeded" / "Maximum layout nesting depth (10) exceeded"</strong></summary>

**Cause:** a layout or partial ends up referencing itself (directly or through a chain), and the
compiler's recursion guard (`MAX_RECURSION_DEPTH = 100` in `compiler.ts`) or the built-in file
adapter's layout guard (`MAX_LAYOUT_DEPTH = 10` in `adapters/builtin.ts`) stopped it before it
became an unbounded loop. **Fix:** check the named layout/partial for a circular reference.

</details>

## FAQ

**Which template engines does this package actually support?**
Six: the zero-dependency `builtin` engine (default), plus `ejs`, `handlebars`, `nunjucks`, `pug`,
and `eta` -- each an adapter over that library's real `import()`, gated behind an optional peer
dependency you install yourself (`packages/middleware/template/src/adapters/`).

**Is HTML-escaping on by default?**
Yes, for the built-in engine's `{{variable}}` syntax (`compile.escape: true` by default). Use
`{{{variable}}}`, `{{& variable}}`, or the `safe` helper only for content you trust, since that
output bypasses escaping entirely.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Not claimed for file-based rendering (`ctx.render()`, `TemplateEngine`, any adapter's
`renderFile()`), which use `node:fs`/`node:path` directly. The pure string functions --
`render()`, `renderAsync()`, `compile()` -- have no Node-specific dependency themselves.

---

## Package relationships

```text
                         depends on            @nextrush/types  (Middleware/Context contract, types only)
@nextrush/template ------------------->
                         optional peer          @nextrush/core  (Context/Middleware types)
                         optional peer (x5)      ejs / eta / handlebars / nunjucks / pug
                         often used with         @nextrush/static  (serve compiled assets referenced by templates)
```

- **Depends on:** [`@nextrush/types`](../../types) -- the `Middleware`/`Context` type contracts (types only, erased at build).
- **Optional peer:** [`@nextrush/core`](../../core) -- satisfies the `Context`/`Middleware` shapes this package's types extend; not installed automatically.
- **Optional peers (pick one or more):** `ejs`, `eta`, `handlebars`, `nunjucks`, `pug` -- installed only for the engine you choose.
- **Often used with:** [`@nextrush/static`](../static) -- serve the CSS/JS/image assets a rendered template references.
- **Alternative:** a client-side rendering framework (React, Vue, etc.) if the app doesn't need server-rendered HTML at all.

## Architecture

Maintaining or contributing to this package? The internal design -- the adapter interface, the
built-in engine's parse/compile/render pipeline, the caching and recursion-guard mechanics, the
module layout, and the decisions and trade-offs behind them (with diagrams) -- is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
