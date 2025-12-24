# Template Plugin API Reference

The `@nextrush/template` package provides a universal template engine with multi-engine support and a simple, unified API.

## Features

- **🔌 Multi-Engine Support** - EJS, Handlebars, Nunjucks, Pug, Eta, or built-in
- **🎯 Simple One-Liner Setup** - `app.use(template())` or `app.use(template('ejs'))`
- **🚀 Zero Dependencies** - Built-in engine has no external dependencies
- **⚡ Production Ready** - Automatic caching, layouts, and helpers

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { template } from '@nextrush/template';

const app = createApp();

// Built-in engine (default)
app.use(template({ root: './views' }));

// Or use any popular engine
app.use(template('ejs', { root: './views' }));
app.use(template('handlebars', { root: './views', ext: '.hbs' }));
app.use(template('nunjucks', { root: './views' }));
app.use(template('pug', { root: './views' }));
app.use(template('eta', { root: './views' }));

app.get('/', async (ctx) => {
  await ctx.render('home', { title: 'Welcome' });
});
```

## Using Different Engines

### EJS

```bash
npm install ejs
```

```typescript
app.use(template('ejs', { root: './views' }));
```

```html
<!-- views/home.ejs -->
<h1>Hello <%= name %>!</h1>
```

### Handlebars

```bash
npm install handlebars
```

```typescript
app.use(template('handlebars', { root: './views', ext: '.hbs' }));
```

```handlebars
<!-- views/home.hbs -->
<h1>Hello {{name}}!</h1>
```

### Nunjucks

```bash
npm install nunjucks
```

```typescript
app.use(template('nunjucks', { root: './views', autoescape: true }));
```

```nunjucks
<!-- views/home.njk -->
<h1>Hello {{ name }}!</h1>
```

### Pug

```bash
npm install pug
```

```typescript
app.use(template('pug', { root: './views', pretty: true }));
```

```pug
//- views/home.pug
h1 Hello #{name}!
```

### Built-in Engine (Default)

No installation required - uses Mustache-like syntax:

```typescript
app.use(template({ root: './views' }));
```

```html
<!-- views/home.html -->
<h1>Hello {{name}}!</h1>
```

## Middleware API

### template(engine?, options?)

Create template middleware for NextRush.

**Signatures:**

```typescript
// Built-in engine with defaults
template()

// Built-in engine with options
template({ root: './views', cache: true })

// Specific engine with options
template('ejs', { root: './views' })
template('handlebars', { root: './views', ext: '.hbs' })
```

**Common Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `root` | `string` | `'./views'` | Template directory |
| `ext` | `string` | varies | File extension |
| `cache` | `boolean` | `true` in production | Template caching |
| `layout` | `string` | - | Default layout template |
| `helpers` | `object` | - | Custom helper functions |

**Engine-Specific Options:**

| Engine | Options |
|--------|---------|
| `ejs` | `delimiter`, `openDelimiter`, `closeDelimiter` |
| `handlebars` | `strict`, `preventIndent` |
| `nunjucks` | `autoescape`, `throwOnUndefined`, `watch` |
| `pug` | `pretty`, `doctype` |
| `eta` | `autoEscape`, `autoTrim` |

### templatePlugin(engine?, options?)

Create template plugin (same options as `template()`).

```typescript
import { templatePlugin } from '@nextrush/template';

app.use(templatePlugin('handlebars', { root: './views' }));
```

## Context Methods

The middleware adds `ctx.render()` to the context:

### ctx.render(template, data?, options?)

Render a template file and send as HTML response.

```typescript
app.get('/', async (ctx) => {
  await ctx.render('home', { title: 'Welcome' });
});

// Override layout
await ctx.render('page', data, { layout: 'layouts/special' });

// No layout
await ctx.render('fragment', data, { layout: null });
```

## Adapter API

For standalone template rendering or custom integrations.

### createAdapter(engine, options)

Create a template adapter instance.

```typescript
import { createAdapter } from '@nextrush/template';

const adapter = createAdapter('handlebars', { root: './views' });

// Render file
const html = await adapter.renderFile('home', { name: 'World' });

// Render string
const result = adapter.render('Hello {{name}}!', { name: 'World' });
```

**Adapter Methods:**

| Method | Description |
|--------|-------------|
| `render(source, data)` | Render template string synchronously |
| `renderAsync(source, data)` | Render template string asynchronously |
| `renderFile(filename, data, options)` | Render template file |
| `registerHelper(name, fn)` | Register custom helper |
| `clearCache()` | Clear template cache |

### registerAdapter(name, factory)

Register a custom template adapter.

```typescript
import { registerAdapter, type TemplateAdapter } from '@nextrush/template';

const myAdapter: TemplateAdapter = {
  name: 'myengine',
  render: (source, data) => /* ... */,
  renderAsync: async (source, data) => /* ... */,
  renderFile: async (filename, data, options) => /* ... */,
  registerHelper: (name, fn) => { /* ... */ },
  clearCache: () => { /* ... */ }
};

registerAdapter('myengine', () => myAdapter);

// Now usable as
app.use(template('myengine', { root: './views' }));
```

### Utility Functions

```typescript
import { hasAdapter, getAvailableEngines } from '@nextrush/template';

// Check if adapter exists
if (hasAdapter('ejs')) {
  app.use(template('ejs'));
}

// Get list of available engines
const engines = getAvailableEngines();
// ['builtin', 'ejs', 'handlebars', 'nunjucks', 'pug', 'eta']
```

---

## Built-in Engine Reference

The built-in engine provides a zero-dependency template system with Mustache-like syntax.

## Core Functions

### compile(source, options?)

Compile a template string into a reusable compiled template.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | `string` | Template source string |
| `options` | `CompileOptions` | Compilation options |

**Returns:** `CompiledTemplate`

**CompileOptions:**

```typescript
interface CompileOptions {
  /** HTML escape output by default (default: true) */
  escape?: boolean;

  /** Throw on missing variables (default: false) */
  strict?: boolean;

  /** Custom delimiters [open, close] (default: ['{{', '}}']) */
  delimiters?: [string, string];

  /** Custom helpers */
  helpers?: Record<string, HelperFn>;

  /** Partials available at compile time */
  partials?: Record<string, string>;
}
```

**Example:**

```typescript
import { compile } from '@nextrush/template';

const template = compile('{{name | upper}}', {
  escape: true,
  helpers: {
    custom: (v) => `[${v}]`
  }
});

// Sync render
const result = template.render({ name: 'test' });

// Async render (supports async helpers)
const asyncResult = await template.renderAsync({ name: 'test' });
```

### parse(source, options?)

Parse a template string into an Abstract Syntax Tree (AST).

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | `string` | Template source string |
| `options` | `ParseOptions` | Parse options |

**Returns:** `TemplateAST`

**Example:**

```typescript
import { parse } from '@nextrush/template';

const ast = parse('Hello {{name}}!');
// { type: 'root', body: [...] }
```

### validate(source, options?)

Validate a template string. Returns `true` if valid, throws `TemplateParseError` if invalid.

**Example:**

```typescript
import { validate, TemplateParseError } from '@nextrush/template';

validate('Hello {{name}}!'); // true
validate('{{#if open}}'); // throws TemplateParseError
```

### createEngine(options?)

Create a template engine instance for file-based template management.

**EngineOptions:**

```typescript
interface EngineOptions {
  /** Root directory for templates */
  root?: string;

  /** File extension (default: '.hbs') */
  ext?: string;

  /** Enable template caching (default: true) */
  cache?: boolean;

  /** Default layout template */
  layout?: string;

  /** Global helpers */
  helpers?: Record<string, HelperFn>;

  /** Global partials */
  partials?: Record<string, string>;
}
```

**Engine Methods:**

| Method | Description |
|--------|-------------|
| `render(name, data, options?)` | Render a template file |
| `renderString(source, data, options?)` | Render a string template |
| `registerHelper(name, fn)` | Register a helper function |
| `registerPartial(name, source)` | Register a partial template |
| `clearCache()` | Clear the template cache |

**Example:**

```typescript
import { createEngine } from '@nextrush/template';

const engine = createEngine({
  root: './views',
  ext: '.hbs',
  cache: true,
  layout: 'layouts/main'
});

// Register helpers and partials
engine.registerHelper('formatDate', (d) => new Date(d).toLocaleDateString());
engine.registerPartial('header', '<header>{{title}}</header>');

// Render templates
const html = await engine.render('pages/home', { title: 'Home' });
const inline = await engine.renderString('Hello {{name}}', { name: 'World' });
```

## Template Syntax

### Variables

```handlebars
{{! Basic variable }}
{{name}}

{{! Nested properties }}
{{user.profile.name}}

{{! HTML escaped (default) }}
{{userInput}}

{{! Raw output (unescaped) }}
{{{rawHtml}}}
{{& rawHtml}}
```

### Pipe Helpers

```handlebars
{{! Single helper }}
{{name | upper}}

{{! Chained helpers - processed left to right }}
{{name | trim | upper | truncate 10}}

{{! Helper with arguments }}
{{price | round 2}}
{{text | replace "old" "new"}}
```

### Block Helpers

#### `{{#if}}`

Conditional rendering based on truthiness.

```handlebars
{{#if user}}
  <p>Welcome, {{user.name}}!</p>
{{/if}}

{{#if isAdmin}}
  <p>Admin Panel</p>
{{else}}
  <p>Access Denied</p>
{{/if}}
```

#### `{{#unless}}`

Inverse conditional (renders when falsy).

```handlebars
{{#unless loggedIn}}
  <p>Please log in to continue</p>
{{/unless}}
```

#### `{{#each}}`

Iterate over arrays or objects.

```handlebars
{{! Array iteration }}
{{#each items}}
  <li>{{this}}</li>
{{/each}}

{{! Object iteration }}
{{#each settings}}
  <dt>{{@key}}</dt>
  <dd>{{this}}</dd>
{{/each}}

{{! With iteration variables }}
{{#each users}}
  {{@index}}: {{name}}
  {{#if @first}}(first){{/if}}
  {{#if @last}}(last){{/if}}
{{/each}}
```

**Iteration Variables:**

| Variable | Type | Description |
|----------|------|-------------|
| `this` | `any` | Current item value |
| `@index` | `number` | Zero-based index |
| `@key` | `string` | Object key (in object iteration) |
| `@first` | `boolean` | True for first item |
| `@last` | `boolean` | True for last item |
| `@root` | `object` | Root data context |

#### `{{#with}}`

Change context scope.

```handlebars
{{#with user.profile}}
  <h1>{{name}}</h1>
  <p>{{bio}}</p>
  <p>Root title: {{@root.title}}</p>
{{/with}}
```

### Partials

```handlebars
{{! Include partial }}
{{>header}}

{{! Partial with data context }}
{{>userCard user}}
```

### Comments

```handlebars
{{! This comment will not appear in output }}
```

## Built-in Helpers

### String Helpers

| Helper | Signature | Description |
|--------|-----------|-------------|
| `upper` | `(value)` | Convert to uppercase |
| `lower` | `(value)` | Convert to lowercase |
| `capitalize` | `(value)` | Capitalize first letter |
| `titleCase` | `(value)` | Title Case Every Word |
| `trim` | `(value)` | Remove leading/trailing whitespace |
| `truncate` | `(value, length, suffix?)` | Truncate with suffix |
| `replace` | `(value, search, replace)` | Replace all occurrences |
| `padStart` | `(value, length, char?)` | Pad start of string |
| `padEnd` | `(value, length, char?)` | Pad end of string |
| `stripHtml` | `(value)` | Remove HTML tags |
| `split` | `(value, separator)` | Split into array |
| `join` | `(value, separator)` | Join array elements |
| `reverse` | `(value)` | Reverse string |
| `length` | `(value)` | Get length |

### Number Helpers

| Helper | Signature | Description |
|--------|-----------|-------------|
| `round` | `(value, decimals?)` | Round to decimal places |
| `floor` | `(value)` | Round down |
| `ceil` | `(value)` | Round up |
| `abs` | `(value)` | Absolute value |
| `add` | `(value, num)` | Addition |
| `subtract` | `(value, num)` | Subtraction |
| `multiply` | `(value, num)` | Multiplication |
| `divide` | `(value, num)` | Division |
| `mod` | `(value, num)` | Modulo |
| `formatNumber` | `(value, locale?)` | Locale formatting |
| `currency` | `(value, code?, locale?)` | Currency formatting |
| `percent` | `(value, decimals?)` | Percentage formatting |

### Array Helpers

| Helper | Signature | Description |
|--------|-----------|-------------|
| `first` | `(array)` | Get first element |
| `last` | `(array)` | Get last element |
| `at` | `(array, index)` | Get element at index |
| `slice` | `(array, start, end?)` | Slice array |
| `sort` | `(array, key?)` | Sort array |
| `unique` | `(array)` | Remove duplicates |
| `compact` | `(array)` | Remove falsy values |
| `flatten` | `(array)` | Flatten nested arrays |
| `includes` | `(array, value)` | Check if includes value |
| `indexOf` | `(array, value)` | Find index of value |

### Object Helpers

| Helper | Signature | Description |
|--------|-----------|-------------|
| `keys` | `(object)` | Get object keys |
| `values` | `(object)` | Get object values |
| `entries` | `(object)` | Get key-value pairs |
| `get` | `(object, path)` | Get nested value by path |

### Comparison Helpers

| Helper | Signature | Description |
|--------|-----------|-------------|
| `eq` | `(a, b)` | Equal `===` |
| `ne` | `(a, b)` | Not equal `!==` |
| `lt` | `(a, b)` | Less than `<` |
| `lte` | `(a, b)` | Less than or equal `<=` |
| `gt` | `(a, b)` | Greater than `>` |
| `gte` | `(a, b)` | Greater than or equal `>=` |
| `and` | `(a, b)` | Logical AND |
| `or` | `(a, b)` | Logical OR |
| `not` | `(value)` | Logical NOT |

### Type Helpers

| Helper | Signature | Description |
|--------|-----------|-------------|
| `isArray` | `(value)` | Check if array |
| `isObject` | `(value)` | Check if plain object |
| `isString` | `(value)` | Check if string |
| `isNumber` | `(value)` | Check if number |
| `isEmpty` | `(value)` | Check if empty |

### Output Helpers

| Helper | Signature | Description |
|--------|-----------|-------------|
| `json` | `(value)` | JSON stringify |
| `safe` | `(value)` | Mark as safe HTML |
| `default` | `(value, fallback)` | Default if falsy |
| `if` | `(condition, then, else)` | Inline conditional |

## Custom Helpers

### Value Helpers

Value helpers receive the piped value as the first argument:

```typescript
const template = compile('{{price | addTax 0.08}}', {
  helpers: {
    addTax: (value, rate) => {
      const num = Number(value);
      const taxRate = Number(rate);
      return (num * (1 + taxRate)).toFixed(2);
    }
  }
});

template.render({ price: 100 }); // '108.00'
```

### Async Helpers

Helpers can be async - use `renderAsync()` for async helpers:

```typescript
const template = compile('{{userId | fetchUser | get "name"}}', {
  helpers: {
    fetchUser: async (id) => {
      const res = await fetch(`/api/users/${id}`);
      return res.json();
    }
  }
});

const result = await template.renderAsync({ userId: 123 });
```

## Error Handling

### TemplateParseError

Thrown when template parsing fails:

```typescript
import { compile, TemplateParseError } from '@nextrush/template';

try {
  compile('{{#if open}}content'); // Missing closing tag
} catch (error) {
  if (error instanceof TemplateParseError) {
    console.log(error.message); // Error message
    console.log(error.line);    // Line number
    console.log(error.column);  // Column number
  }
}
```

## Security

### XSS Protection

All variables are HTML-escaped by default:

```typescript
const template = compile('{{input}}');
template.render({ input: '<script>alert("XSS")</script>' });
// '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
```

### Raw Output

Use triple mustache or `&` prefix for trusted content only:

```typescript
// Only use for trusted content!
const template = compile('{{{trustedHtml}}}');
template.render({ trustedHtml: '<b>Bold</b>' }); // '<b>Bold</b>'
```

## TypeScript Types

```typescript
import type {
  CompiledTemplate,
  CompileOptions,
  RenderOptions,
  EngineOptions,
  TemplateAST,
  HelperFn,
  ValueHelper,
  TemplateNode,
  VariableNode,
  BlockNode,
  TextNode,
  RawNode,
  PartialNode,
  CommentNode
} from '@nextrush/template';
```

## Performance Tips

1. **Compile Once, Render Many**: Store compiled templates for reuse
2. **Enable Caching**: Use `cache: true` in engine options
3. **Avoid Deep Nesting**: Flatten data structures when possible
4. **Use Specific Helpers**: Avoid complex helper chains in hot paths

## See Also

- [Getting Started Guide](../guides/getting-started.md)
- [Plugin Development](../guides/plugin-development.md)
- [Middleware Development](../guides/middleware-development.md)
