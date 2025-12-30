# Template Engine

> Secure, multi-engine template system with 70+ built-in helpers and zero dependencies.

## The Problem

Server-side templating is essential for modern web applications:

- **SEO-critical pages** need server-rendered HTML that search engines can crawl
- **Transactional emails** require dynamic content with user-specific data
- **Initial page loads** benefit from server-rendered content for faster time-to-first-paint
- **PDF generation** and document rendering depend on template engines

Yet the most popular Node.js template engines have serious problems:

### Security Vulnerabilities

EJS, the most downloaded template engine, has had multiple CVEs. Handlebars suffered from **CVE-2021-23369** (prototype pollution), allowing attackers to execute arbitrary code through crafted templates. Pug has had path traversal vulnerabilities. These aren't theoretical risks—they've been exploited in production systems.

### Engine Lock-in

When you choose EJS for a project, you're committing to EJS syntax forever. Migrating 200 templates to a different engine is a multi-sprint undertaking. This makes teams stick with problematic engines long past when they should have switched.

### Inconsistent APIs

Every engine has different patterns for helpers, partials, and layouts. Learning one doesn't help you learn another. Teams waste time on engine-specific quirks instead of building features.

## How NextRush Approaches This

The `@nextrush/template` plugin was designed with three principles:

### 1. Security by Default

Every variable is HTML-escaped automatically. Prototype pollution is blocked at the property access level. Path traversal is prevented before files are read. Recursion attacks are stopped with depth limits. You get safe defaults without thinking about them.

### 2. Engine Flexibility Through Adapters

Use the built-in engine for zero-dependency simplicity, or swap to EJS, Handlebars, Nunjucks, Pug, or Eta with a single parameter change. Same `ctx.render()` API, same helper registration, same layout system. Your choice of engine becomes a configuration decision, not an architectural commitment.

### 3. Batteries Included

70+ helpers for strings, numbers, dates, arrays, objects, and comparisons ship with the built-in engine. No need to write `formatDate`, `currency`, or `truncate` for the hundredth time.

## Mental Model

Think of the template system as a pipeline:

```
Template Source → Compile → Render Function → Data In → HTML Out
```

**Templates** are text with placeholders. The `compile()` function parses the template once and returns a reusable render function. This function accepts data and returns HTML. Compilation happens once; rendering happens many times.

**Helpers** are transformers in the pipeline. The pipe syntax `{{price | currency "USD"}}` passes `price` through the `currency` helper with argument `"USD"`. Helpers can be chained: `{{text | trim | upper | truncate 50}}`.

**Adapters** are interchangeable engines. They all implement the same interface—`render()`, `renderFile()`, `registerHelper()`. Switching from the built-in engine to Handlebars changes the syntax your templates use, not how your application code works.

**Partials** are reusable template fragments. **Layouts** are templates that wrap other templates, receiving the child content as `{{{body}}}`.

## Quick Start

### With NextRush Application

```typescript
import { createApp } from '@nextrush/core';
import { template } from '@nextrush/template';

const app = createApp();

// One-liner setup with built-in engine
app.use(template());

app.get('/', async (ctx) => {
  await ctx.render('home', {
    title: 'Welcome',
    user: { name: 'Alice' }
  });
});

app.listen(3000);
```

Create `views/home.html`:

```html
<!DOCTYPE html>
<html>
<head><title>{{title}}</title></head>
<body>
  <h1>Hello, {{user.name}}!</h1>
</body>
</html>
```

### Standalone Usage

```typescript
import { compile } from '@nextrush/template';

const template = compile('Hello {{name | upper}}!');

const result = template.render({ name: 'world' });
// => 'Hello WORLD!'
```

## Installation

```bash
pnpm add @nextrush/template
```

For optional template engines:

```bash
# Choose one (or none for built-in engine)
pnpm add ejs           # EJS
pnpm add handlebars    # Handlebars
pnpm add nunjucks      # Nunjucks
pnpm add pug           # Pug
pnpm add eta           # Eta (modern EJS)
```

## Template Syntax Reference

The built-in engine uses Mustache-like syntax. If you're using a different engine (EJS, Handlebars, etc.), refer to that engine's documentation for syntax.

### Variables

```html
<!-- Escaped output (safe) -->
{{name}}
{{user.email}}
{{items.0.title}}

<!-- Unescaped output (use only for trusted content) -->
{{{trustedHtml}}}
{{& trustedHtml}}
```

::: warning
Only use `{{{ }}}` or `{{& }}` for content you completely trust. User-generated content must always use `{{ }}` to prevent XSS attacks.
:::

### Helpers with Pipe Syntax

Helpers transform values. Chain them with the pipe `|` operator:

```html
<!-- Single helper -->
{{name | upper}}

<!-- Chained helpers -->
{{description | trim | truncate 100 "..."}}

<!-- Helper with arguments -->
{{price | currency "USD" "en-US"}}

<!-- Multiple arguments -->
{{text | replace "old" "new"}}
```

### Conditionals

```html
<!-- If block -->
{{#if user}}
  <p>Welcome back, {{user.name}}!</p>
{{/if}}

<!-- If-else -->
{{#if isAdmin}}
  <a href="/admin">Admin Panel</a>
{{else}}
  <a href="/profile">My Profile</a>
{{/if}}

<!-- Unless (inverse if) -->
{{#unless loggedIn}}
  <a href="/login">Please log in</a>
{{/unless}}
```

### Loops

```html
<!-- Array iteration -->
{{#each users}}
  <li>{{name}} - {{email}}</li>
{{/each}}

<!-- With loop metadata -->
{{#each items}}
  <div class="item {{#if @first}}first{{/if}} {{#if @last}}last{{/if}}">
    <span class="index">{{@index}}</span>
    <span class="name">{{name}}</span>
  </div>
{{/each}}

<!-- Object iteration -->
{{#each settings}}
  <dt>{{@key}}</dt>
  <dd>{{this}}</dd>
{{/each}}

<!-- Empty state -->
{{#each notifications}}
  <div class="notification">{{message}}</div>
{{else}}
  <p>No notifications</p>
{{/each}}
```

**Loop Variables:**

| Variable | Description |
|----------|-------------|
| `{{@index}}` | Zero-based iteration index |
| `{{@first}}` | `true` on first iteration |
| `{{@last}}` | `true` on last iteration |
| `{{@key}}` | Object key (when iterating objects) |
| `{{this}}` | Current item value |

### Context Switching

```html
<!-- Change context with #with -->
{{#with user.address}}
  <p>{{street}}</p>
  <p>{{city}}, {{state}} {{zip}}</p>
{{/with}}

<!-- Access parent context -->
{{#with order}}
  <p>Order #{{id}} for {{@root.user.name}}</p>
{{/with}}
```

### Partials

```html
<!-- Include a partial -->
{{> header}}

<!-- Partial with context -->
{{> userCard user}}

<!-- Partial with explicit data -->
{{> productItem product=item showPrice=true}}
```

### Comments

```html
{{! This comment won't appear in output }}

{{!--
  Multi-line comments work too.
  Use these for template documentation.
--}}
```

## Built-in Helpers

The built-in engine includes 70+ helpers organized by category.

### String Helpers

| Helper | Usage | Result |
|--------|-------|--------|
| `upper` | `{{name \| upper}}` | `"ALICE"` |
| `lower` | `{{name \| lower}}` | `"alice"` |
| `capitalize` | `{{name \| capitalize}}` | `"Alice"` |
| `titleCase` | `{{"hello world" \| titleCase}}` | `"Hello World"` |
| `trim` | `{{text \| trim}}` | Removes whitespace |
| `truncate` | `{{text \| truncate 50 "..."}}` | Limits to 50 chars |
| `replace` | `{{text \| replace "old" "new"}}` | String replacement |
| `padStart` | `{{num \| padStart 3 "0"}}` | `"007"` |
| `padEnd` | `{{code \| padEnd 10 "-"}}` | `"ABC-------"` |
| `stripHtml` | `{{html \| stripHtml}}` | Removes HTML tags |
| `split` | `{{csv \| split ","}}` | Returns array |
| `join` | `{{arr \| join ", "}}` | Joins array |
| `reverse` | `{{text \| reverse}}` | Reverses string |
| `length` | `{{text \| length}}` | Character count |

### Number Helpers

| Helper | Usage | Result |
|--------|-------|--------|
| `formatNumber` | `{{num \| formatNumber "en-US"}}` | `"1,234.56"` |
| `currency` | `{{price \| currency "USD"}}` | `"$99.99"` |
| `percent` | `{{ratio \| percent 1}}` | `"75.5%"` |
| `round` | `{{num \| round 2}}` | Rounds to decimals |
| `floor` | `{{num \| floor}}` | Rounds down |
| `ceil` | `{{num \| ceil}}` | Rounds up |
| `abs` | `{{num \| abs}}` | Absolute value |
| `add` | `{{num \| add 10}}` | Addition |
| `subtract` | `{{num \| subtract 5}}` | Subtraction |
| `multiply` | `{{num \| multiply 2}}` | Multiplication |
| `divide` | `{{num \| divide 4}}` | Division |
| `mod` | `{{num \| mod 3}}` | Modulo |

### Date Helpers

| Helper | Usage | Result |
|--------|-------|--------|
| `formatDate` | `{{date \| formatDate "YYYY-MM-DD"}}` | `"2025-12-29"` |
| `timeAgo` | `{{date \| timeAgo}}` | `"2 hours ago"` |
| `now` | `{{now}}` | Current ISO timestamp |
| `year` | `{{date \| year}}` | `2025` |
| `month` | `{{date \| month}}` | `12` (1-12) |
| `day` | `{{date \| day}}` | `29` |

**Date Format Tokens:**

| Token | Output |
|-------|--------|
| `YYYY` | 4-digit year |
| `YY` | 2-digit year |
| `MM` | 2-digit month |
| `M` | Month (no padding) |
| `DD` | 2-digit day |
| `D` | Day (no padding) |
| `HH` | 24-hour hours |
| `mm` | Minutes |
| `ss` | Seconds |

### Array Helpers

| Helper | Usage | Result |
|--------|-------|--------|
| `first` | `{{items \| first}}` | First element |
| `last` | `{{items \| last}}` | Last element |
| `at` | `{{items \| at 2}}` | Element at index |
| `slice` | `{{items \| slice 1 3}}` | Subarray |
| `sort` | `{{items \| sort}}` | Sorted array |
| `sort` | `{{items \| sort "name"}}` | Sort by property |
| `unique` | `{{items \| unique}}` | Remove duplicates |
| `compact` | `{{items \| compact}}` | Remove falsy values |
| `flatten` | `{{items \| flatten}}` | Flatten nested |
| `includes` | `{{items \| includes "x"}}` | Boolean check |
| `indexOf` | `{{items \| indexOf "x"}}` | Find index |

### Object Helpers

| Helper | Usage | Result |
|--------|-------|--------|
| `keys` | `{{obj \| keys}}` | Array of keys |
| `values` | `{{obj \| values}}` | Array of values |
| `entries` | `{{obj \| entries}}` | Key-value pairs |
| `get` | `{{obj \| get "user.name"}}` | Deep property access |

### Comparison Helpers

| Helper | Usage | Result |
|--------|-------|--------|
| `eq` | `{{a \| eq b}}` | `a === b` |
| `ne` | `{{a \| ne b}}` | `a !== b` |
| `lt` | `{{a \| lt b}}` | `a < b` |
| `lte` | `{{a \| lte b}}` | `a <= b` |
| `gt` | `{{a \| gt b}}` | `a > b` |
| `gte` | `{{a \| gte b}}` | `a >= b` |
| `and` | `{{a \| and b}}` | `a && b` |
| `or` | `{{a \| or b}}` | `a \|\| b` |
| `not` | `{{val \| not}}` | `!val` |

### Type Helpers

| Helper | Usage | Result |
|--------|-------|--------|
| `isArray` | `{{val \| isArray}}` | Boolean |
| `isObject` | `{{val \| isObject}}` | Boolean |
| `isString` | `{{val \| isString}}` | Boolean |
| `isNumber` | `{{val \| isNumber}}` | Boolean |
| `isEmpty` | `{{val \| isEmpty}}` | Boolean |

### Output Helpers

| Helper | Usage | Result |
|--------|-------|--------|
| `json` | `{{{data \| json}}}` | JSON string |
| `json` | `{{{data \| json 2}}}` | Pretty JSON |
| `safe` | `{{html \| safe}}` | Skip escaping |
| `default` | `{{val \| default "N/A"}}` | Fallback value |
| `if` | `{{active \| if "Yes" "No"}}` | Conditional value |

## Custom Helpers

### Value Helpers

Value helpers receive the piped value as the first argument:

```typescript
app.use(template({
  helpers: {
    // Simple transformation
    double: (value) => Number(value) * 2,

    // With additional arguments
    repeat: (value, times = 1) => String(value).repeat(Number(times)),

    // Complex transformation
    initials: (value) => {
      if (!value) return '';
      return String(value)
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase();
    }
  }
}));
```

Template usage:

```html
<p>{{price | double}}</p>           <!-- 199.98 -->
<p>{{"-" | repeat 20}}</p>          <!-- -------------------- -->
<p>{{fullName | initials}}</p>      <!-- JD -->
```

### Async Helpers

Async helpers are supported with `renderAsync()`:

```typescript
app.use(template({
  helpers: {
    fetchUser: async (userId) => {
      const response = await fetch(`/api/users/${userId}`);
      return response.json();
    }
  }
}));
```

```html
{{#with userId | fetchUser}}
  <p>Name: {{name}}</p>
  <p>Email: {{email}}</p>
{{/with}}
```

::: tip
Use async helpers sparingly. Each async helper adds latency to page rendering. Consider fetching data in your route handler and passing it to the template instead.
:::

### Helper with Context

For block helpers that need to render content:

```typescript
import type { HelperContext } from '@nextrush/template';

const helpers = {
  times: (count: unknown, context: HelperContext) => {
    const n = Number(count);
    let result = '';
    for (let i = 0; i < n; i++) {
      result += context.fn({ index: i });
    }
    return result;
  }
};
```

```html
{{#times 3}}
  <p>Iteration {{index}}</p>
{{/times}}
```

## Layouts and Partials

### Layouts

Layouts wrap page content with common structure (headers, footers, navigation):

**views/layouts/main.html:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{{title}} | My App</title>
  <link rel="stylesheet" href="/css/main.css">
</head>
<body>
  <header>
    {{> navigation}}
  </header>

  <main>
    {{{body}}}
  </main>

  <footer>
    <p>&copy; 2025 My App</p>
  </footer>
</body>
</html>
```

**views/home.html:**

```html
<h1>{{title}}</h1>
<p>Welcome to our site!</p>
```

**Configuration:**

```typescript
app.use(template({
  root: './views',
  layout: 'layouts/main'  // Default layout for all pages
}));

app.get('/', async (ctx) => {
  await ctx.render('home', { title: 'Home' });
});
```

**Override layout per request:**

```typescript
// Use different layout
app.get('/admin', async (ctx) => {
  await ctx.render('admin/dashboard', { user }, {
    layout: 'layouts/admin'
  });
});

// No layout (for API-like HTML fragments)
app.get('/fragment', async (ctx) => {
  await ctx.render('partials/card', { data }, {
    layout: null
  });
});
```

### Partials

Partials are reusable template fragments:

**views/partials/userCard.html:**

```html
<div class="user-card">
  <img src="{{avatar}}" alt="{{name}}">
  <h3>{{name}}</h3>
  <p>{{bio | truncate 100}}</p>
</div>
```

**Register partials:**

```typescript
import { createEngine } from '@nextrush/template';

const engine = createEngine({
  root: './views',
  partialsDir: 'partials'  // Auto-loads all files from views/partials/
});

// Or register manually
engine.registerPartial('userCard', '<div class="user-card">...</div>');
```

**Use in templates:**

```html
{{#each users}}
  {{> userCard}}
{{/each}}

<!-- With explicit data -->
{{> userCard user=currentUser}}
```

## Multiple Template Engines

Switch engines with a single parameter. The API stays the same.

### Engine Selection

```typescript
// Built-in engine (default, zero dependencies)
app.use(template());
app.use(template({ root: './views' }));

// EJS
app.use(template('ejs', { root: './views' }));

// Handlebars
app.use(template('handlebars', { root: './views', ext: '.hbs' }));

// Nunjucks
app.use(template('nunjucks', { root: './views' }));

// Pug
app.use(template('pug', { root: './views' }));

// Eta
app.use(template('eta', { root: './views' }));
```

### Engine-Specific Options

#### EJS Options

```typescript
app.use(template('ejs', {
  root: './views',
  delimiter: '%',           // Custom delimiter (default: %)
  openDelimiter: '<',       // Custom open delimiter
  closeDelimiter: '>',      // Custom close delimiter
  strict: true,             // Strict mode
  rmWhitespace: true        // Remove whitespace
}));
```

#### Handlebars Options

```typescript
app.use(template('handlebars', {
  root: './views',
  ext: '.hbs',
  strict: true,             // Strict mode
  preventIndent: false      // Prevent partial indentation
}));
```

#### Nunjucks Options

```typescript
app.use(template('nunjucks', {
  root: './views',
  autoescape: true,         // Auto-escape (default: true)
  throwOnUndefined: false,  // Throw on undefined variables
  watch: true               // Watch for changes (development)
}));
```

#### Pug Options

```typescript
app.use(template('pug', {
  root: './views',
  pretty: true,             // Pretty-print output
  doctype: 'html'           // Doctype declaration
}));
```

#### Eta Options

```typescript
app.use(template('eta', {
  root: './views',
  autoEscape: true,         // Auto-escape (default: true)
  autoTrim: false           // Trim whitespace
}));
```

### When to Use Each Engine

| Engine | Best For |
|--------|----------|
| **Built-in** | Simple projects, zero dependencies, security-focused |
| **EJS** | Teams familiar with EJS, embedded JavaScript |
| **Handlebars** | Logic-less templates, strict separation |
| **Nunjucks** | Django/Jinja2 familiarity, complex inheritance |
| **Pug** | Concise syntax, significant whitespace lovers |
| **Eta** | Modern EJS alternative, better performance |

## Security Features

::: danger Critical Section
Template engines are a common attack vector. Understanding these protections is essential for secure applications.
:::

### XSS Prevention

All variables are HTML-escaped by default:

```typescript
const template = compile('{{comment}}');

template.render({
  comment: '<script>alert("XSS")</script>'
});
// Output: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
```

The attacker's script is rendered as visible text, not executed code.

**When you must output raw HTML** (for trusted content only):

```html
<!-- Trusted admin-generated content -->
{{{trustedHtml}}}

<!-- User-generated content - NEVER use triple braces -->
{{userComment}}
```

### Prototype Pollution Protection

Prototype pollution attacks try to modify `Object.prototype` through template access. This can lead to remote code execution in some environments.

**Blocked properties:**

```html
{{__proto__}}              <!-- Returns empty -->
{{constructor}}            <!-- Returns empty -->
{{prototype}}              <!-- Returns empty -->
{{obj.__proto__.polluted}} <!-- Returns empty -->
{{obj | get "constructor"}}<!-- Returns empty -->
```

This protection is based on **CVE-2021-23369** (Handlebars prototype pollution vulnerability). NextRush blocks these at the property resolution level, not just in helpers.

### Path Traversal Protection

Attackers may try to read arbitrary files:

```typescript
// Attempted attack
await ctx.render('../../../etc/passwd', {});
// Throws: Path traversal detected
```

**How it works:**

1. The `..` segment is blocked entirely
2. Resolved paths are verified to be within the views directory
3. Absolute paths outside views directory are rejected

### Recursion Protection

Infinite partial loops can cause stack overflow:

```html
{{!-- partials/recursive.html --}}
<p>This will loop:</p>
{{> recursive}}
```

**Protection:** Maximum nesting depth of 100 levels. When exceeded:

```
Error: Maximum template nesting depth (100) exceeded.
Check for circular partial references involving "recursive".
```

### Security Summary

| Vulnerability | Protection | Enabled By |
|--------------|------------|------------|
| XSS (Cross-Site Scripting) | HTML escaping | Default |
| Prototype Pollution | Property blocklist | Always on |
| Path Traversal | Path validation | Always on |
| DoS via Recursion | Max depth (100) | Always on |
| ReDoS | Safe regex patterns | Parser design |

## Runtime Compatibility

| Runtime | String Rendering | File Rendering |
|---------|-----------------|----------------|
| Node.js 20+ | ✅ Full support | ✅ Full support |
| Bun | ✅ Full support | ✅ Full support |
| Deno | ✅ Full support | ✅ With `--allow-read` |
| Edge (Cloudflare/Vercel) | ✅ Full support | ❌ No filesystem |

### Edge Runtime Usage

Edge runtimes don't have filesystem access. Pre-compile templates at build time:

```typescript
import { compile } from '@nextrush/template';

// Pre-compile at build time (or import from compiled module)
const homeTemplate = compile(`
  <!DOCTYPE html>
  <html>
  <head><title>{{title}}</title></head>
  <body>
    <h1>Welcome, {{user.name}}!</h1>
  </body>
  </html>
`);

// Cloudflare Worker
export default {
  async fetch(request: Request) {
    const html = homeTemplate.render({
      title: 'Edge-Rendered Page',
      user: { name: 'Edge User' }
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};
```

## API Reference

### `template(engine?, options?)`

Create template middleware for NextRush.

**Signature:**

```typescript
function template(
  engine?: EngineName | TemplateOptions,
  options?: TemplateOptions
): Middleware
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `engine` | `EngineName \| TemplateOptions` | `'builtin'` | Engine name or options object |
| `options` | `TemplateOptions` | `{}` | Configuration options |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `root` | `string` | `'./views'` | Template directory |
| `ext` | `string` | varies by engine | File extension |
| `cache` | `boolean` | `true` in production | Enable template caching |
| `layout` | `string` | `undefined` | Default layout template |
| `helpers` | `Record<string, Function>` | `{}` | Custom helper functions |
| `enableContextRender` | `boolean` | `true` | Add `ctx.render()` method |

### `compile(source, options?)`

Compile a template string into a reusable render function.

**Signature:**

```typescript
function compile(
  source: string,
  options?: CompileOptions
): CompiledTemplate
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | `string` | Template source string |
| `options` | `CompileOptions` | Compilation options |

**CompileOptions:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `escape` | `boolean` | `true` | HTML-escape by default |
| `strict` | `boolean` | `false` | Throw on missing variables |
| `delimiters` | `[string, string]` | `['{{', '}}']` | Custom delimiters |
| `helpers` | `Record<string, Function>` | `{}` | Available helpers |
| `partials` | `Record<string, string>` | `{}` | Available partials |

**Returns:** `CompiledTemplate`

```typescript
interface CompiledTemplate {
  render(data?: Record<string, unknown>, options?: RenderOptions): string;
  renderAsync(data?: Record<string, unknown>, options?: RenderOptions): Promise<string>;
  source: string;
  ast: AST;
}
```

**Example:**

```typescript
import { compile } from '@nextrush/template';

const template = compile('Hello {{name | upper}}!', {
  escape: true,
  strict: false
});

// Synchronous render
const html = template.render({ name: 'world' });
// => 'Hello WORLD!'

// Async render (for async helpers)
const htmlAsync = await template.renderAsync({ name: 'world' });
```

### `createEngine(options?)`

Create a template engine for file-based templates.

**Signature:**

```typescript
function createEngine(options?: EngineOptions): TemplateEngine
```

**EngineOptions:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `root` | `string` | `process.cwd()` | Template root directory |
| `ext` | `string` | `'.html'` | Default file extension |
| `cache` | `boolean` | `true` in production | Enable caching |
| `layout` | `string` | `null` | Default layout |
| `partialsDir` | `string` | `null` | Partials directory |
| `helpers` | `Record<string, Function>` | `{}` | Global helpers |
| `partials` | `Record<string, string>` | `{}` | Global partials |

**TemplateEngine methods:**

```typescript
class TemplateEngine {
  render(name: string, data?: object, options?: RenderOptions): Promise<string>;
  renderString(source: string, data?: object): string;
  renderStringAsync(source: string, data?: object): Promise<string>;
  compile(source: string): CompiledTemplate;
  registerHelper(name: string, fn: Function): void;
  registerPartial(name: string, source: string): void;
  clearCache(): void;
}
```

### `createAdapter(engine, config?)`

Create a template adapter for a specific engine.

**Signature:**

```typescript
function createAdapter(
  engine?: EngineName,
  config?: AdapterConfig
): TemplateAdapter
```

**EngineName:** `'builtin' | 'ejs' | 'handlebars' | 'nunjucks' | 'pug' | 'eta'`

**TemplateAdapter interface:**

```typescript
interface TemplateAdapter {
  readonly name: string;
  render(source: string, data?: object): string;
  renderAsync(source: string, data?: object): Promise<string>;
  renderFile(filename: string, data?: object): Promise<string>;
  registerHelper(name: string, fn: Function): void;
  clearCache(): void;
}
```

### `RenderOptions`

Options passed during template rendering.

```typescript
interface RenderOptions {
  data?: Record<string, unknown>;
  partials?: Record<string, string | CompiledTemplate>;
  helpers?: Record<string, Function>;
  layout?: string | null;
  layoutData?: Record<string, unknown>;
}
```

## Error Handling

```typescript
import { compile, TemplateParseError } from '@nextrush/template';

try {
  compile('{{#if open}}content');  // Missing closing tag
} catch (error) {
  if (error instanceof TemplateParseError) {
    console.error('Template error:', error.message);
    console.error('Line:', error.line);
    console.error('Column:', error.column);
    console.error('Code:', error.code);  // 'UNCLOSED_BLOCK'
  }
}
```

**Error Codes:**

| Code | Description |
|------|-------------|
| `PARSE_ERROR` | General parsing error |
| `COMPILE_ERROR` | Compilation failed |
| `RENDER_ERROR` | Rendering failed |
| `UNCLOSED_BLOCK` | Missing `{{/block}}` |
| `UNEXPECTED_CLOSE` | Unexpected `{{/block}}` |
| `PARTIAL_NOT_FOUND` | Partial doesn't exist |
| `MISSING_VARIABLE` | Variable not in data (strict mode) |

## Common Mistakes

### Using Triple Braces for User Content

```html
<!-- ❌ DANGEROUS: XSS vulnerability -->
<div>{{{userBio}}}</div>

<!-- ✅ SAFE: Auto-escaped -->
<div>{{userBio}}</div>
```

Triple braces bypass escaping. Only use them for content you generate and trust completely.

### Forgetting to Install Engine Dependencies

```typescript
// This will fail if handlebars isn't installed
app.use(template('handlebars', { root: './views' }));
// Error: Handlebars is not installed. Please install it with: npm install handlebars
```

Install the engine before using it:

```bash
pnpm add handlebars
```

### Not Validating Data Before Rendering

```typescript
// ❌ No validation
app.post('/preview', async (ctx) => {
  await ctx.render('email', ctx.body);  // ctx.body could have prototype pollution
});

// ✅ Validate and sanitize
app.post('/preview', async (ctx) => {
  const { subject, message } = ctx.body;
  await ctx.render('email', {
    subject: String(subject ?? '').slice(0, 200),
    message: String(message ?? '').slice(0, 5000)
  });
});
```

### Mixing Engine Syntaxes

If you switch engines, update your templates:

```html
<!-- Built-in / Handlebars syntax -->
{{#each items}}{{name}}{{/each}}

<!-- EJS syntax -->
<% items.forEach(item => { %><%= item.name %><% }) %>

<!-- Nunjucks syntax -->
{% for item in items %}{{ item.name }}{% endfor %}
```

## When NOT to Use

### Client-Side Interactivity

Templates render once on the server. For dynamic UIs:

```typescript
// ❌ Wrong tool for reactive UI
app.get('/dashboard', async (ctx) => {
  await ctx.render('dashboard', { data });  // Static HTML
});

// ✅ Use React, Vue, or similar
// Render a shell, hydrate on client
```

### Real-Time Updates

Templates don't update after render:

```typescript
// ❌ Won't reflect real-time changes
await ctx.render('chat', { messages });

// ✅ Use WebSockets for real-time
app.ws('/chat', (ws) => {
  ws.on('message', (msg) => ws.broadcast(msg));
});
```

### Heavy Computation

Don't do complex logic in templates:

```html
<!-- ❌ Too much logic in template -->
{{#each items}}
  {{#if this | complexCalculation | anotherHelper | yetAnother}}
    ...
  {{/if}}
{{/each}}

<!-- ✅ Compute in route handler, pass simple data -->
```

## TypeScript Support

Full type definitions are included:

```typescript
import type {
  CompiledTemplate,
  CompileOptions,
  RenderOptions,
  EngineOptions,
  HelperFn,
  ValueHelper,
  HelperContext,
  TemplateAdapter,
  EngineName
} from '@nextrush/template';

// Type your helpers
const formatPrice: ValueHelper = (value) => {
  const num = Number(value);
  return isNaN(num) ? '' : `$${num.toFixed(2)}`;
};

// Type your template data
interface PageData {
  title: string;
  user: { name: string; email: string };
  items: Array<{ id: number; name: string }>;
}

const template = compile<PageData>('...');
template.render({ title: 'Home', user: { name: 'Alice', email: 'a@b.com' }, items: [] });
```

## See Also

- [Middleware Guide](/guides/middleware) - How middleware works in NextRush
- [Plugin System](/concepts/plugins) - Creating and using plugins
- [Error Handling](/guides/error-handling) - Application-wide error handling
- [@nextrush/static](/plugins/static) - Serving static files
