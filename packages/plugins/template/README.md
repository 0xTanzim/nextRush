# @nextrush/template

Universal template engine for NextRush with multi-engine support.

## Highlights

- **🔌 Multi-Engine Support** - Use EJS, Handlebars, Nunjucks, Pug, Eta, or the built-in engine
- **🎯 Simple One-Liner Setup** - Get started with just `app.use(template())`
- **🚀 Zero Dependencies** - Built-in engine requires no external dependencies
- **⚡ Production Ready** - Automatic caching, layouts, and helpers
- **📝 Express Compatible** - Familiar `ctx.render()` API

## Installation

```bash
npm install @nextrush/template
# or
pnpm add @nextrush/template
```

### Optional Engines

Install only the engines you need:

```bash
# EJS
npm install ejs

# Handlebars
npm install handlebars

# Nunjucks
npm install nunjucks

# Pug
npm install pug

# Eta (modern EJS alternative)
npm install eta
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { template } from '@nextrush/template';

const app = createApp();

// Simplest setup - uses built-in engine
app.use(template());

// With views directory
app.use(template({ root: './views' }));

app.get('/', async (ctx) => {
  await ctx.render('home', { title: 'Welcome' });
});
```

## Using Different Engines

### EJS

```typescript
import { template } from '@nextrush/template';

// npm install ejs
app.use(template('ejs', { root: './views' }));

app.get('/', async (ctx) => {
  await ctx.render('home', { name: 'World' });
});
```

**views/home.ejs:**
```html
<h1>Hello <%= name %>!</h1>
```

### Handlebars

```typescript
// npm install handlebars
app.use(template('handlebars', {
  root: './views',
  ext: '.hbs',
  layout: 'layouts/main'
}));
```

**views/home.hbs:**
```handlebars
<h1>Hello {{name}}!</h1>
```

### Nunjucks

```typescript
// npm install nunjucks
app.use(template('nunjucks', {
  root: './views',
  autoescape: true
}));
```

**views/home.njk:**
```nunjucks
<h1>Hello {{ name }}!</h1>
```

### Pug

```typescript
// npm install pug
app.use(template('pug', { root: './views', pretty: true }));
```

**views/home.pug:**
```pug
h1 Hello #{name}!
```

### Eta (Modern EJS)

```typescript
// npm install eta
app.use(template('eta', { root: './views', autoEscape: true }));
```

**views/home.eta:**
```eta
<h1>Hello <%= it.name %>!</h1>
```

### Built-in Engine (Default)

The built-in engine uses Mustache-like syntax with no dependencies:

```typescript
app.use(template({ root: './views' }));
```

**views/home.html:**
```html
<h1>Hello {{name}}!</h1>
```

## Configuration Options

### Common Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `root` | `string` | `'./views'` | Template directory |
| `ext` | `string` | varies | File extension (`.ejs`, `.hbs`, `.njk`, `.pug`, `.eta`, `.html`) |
| `cache` | `boolean` | `true` in production | Enable template caching |
| `layout` | `string` | - | Default layout template |
| `helpers` | `object` | - | Custom helper functions |

### Engine-Specific Options

#### EJS
- `delimiter` - Custom delimiter (default: `%`)
- `openDelimiter` - Opening delimiter
- `closeDelimiter` - Closing delimiter

#### Handlebars
- `strict` - Enable strict mode
- `preventIndent` - Prevent partial indentation

#### Nunjucks
- `autoescape` - Enable auto-escaping (default: `true`)
- `throwOnUndefined` - Throw on undefined variables
- `watch` - Watch for file changes (development)

#### Pug
- `pretty` - Pretty print output
- `doctype` - HTML doctype

#### Eta
- `autoEscape` - Enable auto-escaping (default: `true`)
- `autoTrim` - Trim whitespace

## Features

### Layouts

```typescript
app.use(template('handlebars', {
  root: './views',
  layout: 'layouts/main'
}));
```

**views/layouts/main.hbs:**
```handlebars
<!DOCTYPE html>
<html>
<head><title>{{title}}</title></head>
<body>
  {{{body}}}
</body>
</html>
```

**views/home.hbs:**
```handlebars
<h1>{{title}}</h1>
<p>Welcome to our site!</p>
```

### Custom Helpers

```typescript
app.use(template({
  helpers: {
    formatDate: (date) => new Date(date).toLocaleDateString(),
    currency: (value) => `$${Number(value).toFixed(2)}`,
  }
}));
```

**Built-in template usage:**
```html
<p>Date: {{createdAt | formatDate}}</p>
<p>Price: {{price | currency}}</p>
```

### Override Layout Per Request

```typescript
app.get('/admin', async (ctx) => {
  await ctx.render('admin/dashboard', { user }, { layout: 'layouts/admin' });
});

app.get('/print', async (ctx) => {
  await ctx.render('report', { data }, { layout: null }); // No layout
});
```

## Built-in Engine Features

The built-in Mustache-like engine includes:

### String Helpers

| Helper | Usage | Description |
|--------|-------|-------------|
| `upper` | `{{name \| upper}}` | Convert to uppercase |
| `lower` | `{{name \| lower}}` | Convert to lowercase |
| `capitalize` | `{{name \| capitalize}}` | Capitalize first letter |
| `titleCase` | `{{name \| titleCase}}` | Title Case String |
| `trim` | `{{text \| trim}}` | Remove whitespace |
| `truncate` | `{{text \| truncate 100 "..."}}` | Limit length |
| `replace` | `{{text \| replace "old" "new"}}` | Replace substring |
| `padStart` | `{{num \| padStart 3 "0"}}` | Pad start of string |
| `padEnd` | `{{num \| padEnd 3 "0"}}` | Pad end of string |
| `stripHtml` | `{{html \| stripHtml}}` | Remove HTML tags |
| `split` | `{{csv \| split ","}}` | Split string to array |
| `join` | `{{arr \| join "-"}}` | Join array to string |
| `reverse` | `{{text \| reverse}}` | Reverse string |
| `length` | `{{text \| length}}` | Get string/array length |

### Number Helpers

| Helper | Usage | Description |
|--------|-------|-------------|
| `round` | `{{num \| round 2}}` | Round to decimal places |
| `floor` | `{{num \| floor}}` | Round down |
| `ceil` | `{{num \| ceil}}` | Round up |
| `abs` | `{{num \| abs}}` | Absolute value |
| `add` | `{{num \| add 10}}` | Add numbers |
| `subtract` | `{{num \| subtract 5}}` | Subtract numbers |
| `multiply` | `{{num \| multiply 2}}` | Multiply numbers |
| `divide` | `{{num \| divide 2}}` | Divide numbers |
| `mod` | `{{num \| mod 3}}` | Modulo operation |
| `formatNumber` | `{{num \| formatNumber "en-US"}}` | Locale formatting |
| `currency` | `{{price \| currency "USD"}}` | Currency formatting |
| `percent` | `{{ratio \| percent 2}}` | Percentage formatting |

### Array Helpers

| Helper | Usage | Description |
|--------|-------|-------------|
| `first` | `{{arr \| first}}` | First element |
| `last` | `{{arr \| last}}` | Last element |
| `at` | `{{arr \| at 2}}` | Element at index |
| `slice` | `{{arr \| slice 1 3}}` | Slice array |
| `sort` | `{{arr \| sort}}` | Sort array |
| `unique` | `{{arr \| unique}}` | Remove duplicates |
| `compact` | `{{arr \| compact}}` | Remove falsy values |
| `flatten` | `{{arr \| flatten}}` | Flatten nested arrays |
| `includes` | `{{arr \| includes "item"}}` | Check if includes |
| `indexOf` | `{{arr \| indexOf "item"}}` | Find index |

### Object Helpers

| Helper | Usage | Description |
|--------|-------|-------------|
| `keys` | `{{obj \| keys}}` | Get object keys |
| `values` | `{{obj \| values}}` | Get object values |
| `entries` | `{{obj \| entries}}` | Get key-value pairs |
| `get` | `{{obj \| get "path.to.value"}}` | Get nested value |

### Comparison Helpers

| Helper | Usage | Description |
|--------|-------|-------------|
| `eq` | `{{a \| eq b}}` | Equal |
| `ne` | `{{a \| ne b}}` | Not equal |
| `lt` | `{{a \| lt b}}` | Less than |
| `lte` | `{{a \| lte b}}` | Less than or equal |
| `gt` | `{{a \| gt b}}` | Greater than |
| `gte` | `{{a \| gte b}}` | Greater than or equal |
| `and` | `{{a \| and b}}` | Logical AND |
| `or` | `{{a \| or b}}` | Logical OR |
| `not` | `{{val \| not}}` | Logical NOT |

### Type Helpers

| Helper | Usage | Description |
|--------|-------|-------------|
| `isArray` | `{{val \| isArray}}` | Check if array |
| `isObject` | `{{val \| isObject}}` | Check if object |
| `isString` | `{{val \| isString}}` | Check if string |
| `isNumber` | `{{val \| isNumber}}` | Check if number |
| `isEmpty` | `{{val \| isEmpty}}` | Check if empty |

### Output Helpers

| Helper | Usage | Description |
|--------|-------|-------------|
| `json` | `{{{data \| json}}}` | JSON stringify |
| `safe` | `{{html \| safe}}` | Mark as safe (no escape) |
| `default` | `{{val \| default "fallback"}}` | Default value |
| `if` | `{{active \| if "Yes" "No"}}` | Inline conditional |

## API Reference

### compile(source, options?)

Compile a template string into a reusable template object.

```typescript
import { compile } from '@nextrush/template';

const template = compile('Hello {{name}}!', {
  escape: true,       // HTML escape by default (default: true)
  strict: false,      // Throw on missing variables (default: false)
  delimiters: ['{{', '}}'], // Custom delimiters
  helpers: {          // Custom helpers
    double: (v) => Number(v) * 2
  }
});

// Synchronous render
const result = template.render({ name: 'World' });

// Async render (supports async helpers)
const asyncResult = await template.renderAsync({ name: 'World' });
```

### parse(source, options?)

Parse a template string into an AST.

```typescript
import { parse } from '@nextrush/template';

const ast = parse('Hello {{name}}!');
// Returns TemplateAST with body array of nodes
```

### validate(source, options?)

Validate a template string without compiling.

```typescript
import { validate } from '@nextrush/template';

const isValid = validate('Hello {{name}}!'); // true
validate('Hello {{name'); // throws TemplateParseError
```

### createEngine(options?)

Create a template engine for file-based templates.

```typescript
import { createEngine } from '@nextrush/template';

const engine = createEngine({
  root: './views',        // Template root directory
  ext: '.hbs',            // File extension
  cache: true,            // Enable caching (default: true)
  layout: 'layouts/main', // Default layout
  helpers: {},            // Global helpers
  partials: {}            // Global partials
});

// Render a template file
const html = await engine.render('pages/home', { title: 'Home' });

// Render a string template
const result = await engine.renderString('Hello {{name}}!', { name: 'World' });

// Register helpers
engine.registerHelper('shout', (v) => String(v).toUpperCase() + '!');

// Register partials
engine.registerPartial('header', '<header>{{title}}</header>');

// Clear cache
engine.clearCache();
```

## Custom Helpers

### Value Helpers (Pipe Helpers)

Value helpers receive the piped value and any additional arguments:

```typescript
const template = compile('{{value | double}}', {
  helpers: {
    double: (value) => Number(value) * 2
  }
});

// With arguments
const template2 = compile('{{value | multiply 3}}', {
  helpers: {
    multiply: (value, factor) => Number(value) * Number(factor)
  }
});
```

### Async Helpers

```typescript
const template = compile('{{userId | fetchUser | get "name"}}', {
  helpers: {
    fetchUser: async (id) => {
      const response = await fetch(`/api/users/${id}`);
      return response.json();
    }
  }
});

const result = await template.renderAsync({ userId: 123 });
```

## NextRush Integration

### Middleware

```typescript
import { createApp } from '@nextrush/core';
import { template } from '@nextrush/template';

const app = createApp();

// Use template middleware
app.use(template({
  root: './views',
  ext: '.hbs',
  helpers: {
    formatDate: (d) => new Date(d).toLocaleDateString()
  }
}));

// In route handlers
app.get('/', async (ctx) => {
  await ctx.render('home', {
    title: 'Welcome',
    user: ctx.state.user
  });
});
```

### Plugin

```typescript
import { createApp } from '@nextrush/core';
import { templatePlugin } from '@nextrush/template';

const app = createApp();

app.use(templatePlugin({
  root: './views',
  ext: '.hbs'
}));
```

## Security

### XSS Protection

By default, all variables are HTML-escaped to prevent XSS attacks:

```typescript
const template = compile('{{comment}}');
template.render({ comment: '<script>alert("XSS")</script>' });
// => '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
```

Use triple mustache `{{{raw}}}` or `{{& raw}}` only for trusted content:

```typescript
const template = compile('{{{trustedHtml}}}');
template.render({ trustedHtml: '<b>Bold</b>' });
// => '<b>Bold</b>'
```

## Performance

The template engine is optimized for performance:

- **Compiled Templates**: Templates are parsed once and reused
- **Efficient Rendering**: Minimal allocations during rendering
- **Caching**: Built-in template caching for file-based templates
- **Benchmarks**: Handles 10,000+ items in under 500ms

## Error Handling

```typescript
import { compile, TemplateParseError } from '@nextrush/template';

try {
  compile('{{#if open}}content'); // Missing closing tag
} catch (error) {
  if (error instanceof TemplateParseError) {
    console.log(error.message); // "Unclosed block: if"
    console.log(error.line);    // Line number
    console.log(error.column);  // Column number
  }
}
```

## TypeScript

Full TypeScript support with type definitions:

```typescript
import type {
  CompiledTemplate,
  CompileOptions,
  RenderOptions,
  TemplateAST,
  HelperFn,
  ValueHelper
} from '@nextrush/template';

// Custom helper type
const myHelper: ValueHelper = (value, ...args) => {
  return String(value).toUpperCase();
};
```

## License

MIT © NextRush Team
