# Template Plugin API Reference

The Template Plugin provides safe, minimal HTML templating for NextRush v2 applications with auto-escaping, helpers, partials, and layout support.

## What it is

A production-ready template engine that handles:

- **Auto-escaping by default** for XSS protection
- **Helper functions** for common transformations
- **Partials** for reusable template components
- **Control structures** (if/else, loops, with blocks)
- **Layout support** for consistent page structure
- **File-based or inline** template rendering
- **Template caching** for performance

## When to use

Use the Template Plugin when you need:

- Server-side HTML rendering
- Safe template rendering with XSS protection
- Reusable template components (partials)
- Dynamic content generation
- Layout-based page structure
- Simple templating without complex syntax

## Quick start

```typescript
import { createApp, TemplatePlugin } from 'nextrush';

const app = createApp();

// Basic template plugin
const templatePlugin = new TemplatePlugin({
  viewsDir: './views',
});

templatePlugin.install(app);

// Use in routes
app.get('/', async ctx => {
  await ctx.render('index.html', {
    title: 'Welcome',
    message: 'Hello from NextRush v2',
  });
});

app.listen(3000);
```

---

# TemplatePlugin Class

## Constructor

```typescript
constructor(options?: TemplatePluginOptions)
```

**Parameters:**

- `options` (TemplatePluginOptions, optional): Template engine configuration

**Example:**

```typescript
const templatePlugin = new TemplatePlugin({
  viewsDir: './views',
  cache: true,
  partialExt: '.html',
  helpers: {
    currency: value => `$${Number(value).toFixed(2)}`,
  },
});
```

---

## Configuration Options

```typescript
interface TemplatePluginOptions {
  viewsDir?: string; // Template directory
  cache?: boolean; // Enable caching (default: true)
  helpers?: Record<string, Function>; // Custom helper functions
  partials?: Record<string, string>; // Preloaded partials
  enableFilePartials?: boolean; // Load partials from files (default: true)
  partialExt?: string; // Partial file extension (default: '.html')
}
```

### Options in Detail

#### `viewsDir` (optional)

**What:** Directory containing template files
**Default:** `undefined` (inline templates only)

```typescript
// File-based templates
{
  viewsDir: './views';
}
// Templates loaded from ./views/ directory

// Inline templates only
{
  viewsDir: undefined;
}
// Templates passed as strings to render()
```

#### `cache` (optional)

**What:** Enable compiled template caching
**Default:** `true`

```typescript
// Production: enable caching
{
  cache: true;
}

// Development: disable for live reloading
{
  cache: false;
}
```

#### `helpers` (optional)

**What:** Custom helper functions for templates
**Default:** Built-in helpers only

```typescript
{
  helpers: {
    currency: (value) => `$${Number(value).toFixed(2)}`,
    truncate: (str, len = 50) =>
      String(str).length > len ? String(str).slice(0, len) + '...' : String(str),
    formatDate: (date) => new Date(date).toLocaleDateString()
  }
}
```

#### `partials` (optional)

**What:** Preloaded partial templates
**Default:** `{}`

```typescript
{
  partials: {
    header: '<header><h1>{{title}}</h1></header>',
    footer: '<footer>&copy; 2024</footer>'
  }
}
```

#### `enableFilePartials` (optional)

**What:** Load partials from files in viewsDir
**Default:** `true`

```typescript
// Load partials from files
{
  enableFilePartials: true;
}
// {{> navbar}} loads ./views/navbar.html

// Only use preloaded partials
{
  enableFilePartials: false;
}
```

#### `partialExt` (optional)

**What:** File extension for partial files
**Default:** `'.html'`

```typescript
// HTML partials
{
  partialExt: '.html';
}
// {{> navbar}} loads navbar.html

// Template partials
{
  partialExt: '.tpl';
}
// {{> navbar}} loads navbar.tpl
```

---

# Template Syntax

## Variables

```html
<!-- Basic variable (auto-escaped) -->
<h1>{{title}}</h1>

<!-- Raw/unescaped variable -->
<div>{{{htmlContent}}}</div>

<!-- Nested object properties -->
<p>{{user.name}} - {{user.profile.bio}}</p>
```

## Control Structures

### Conditionals

```html
<!-- If/else -->
{{#if user}}
<p>Welcome, {{user.name}}!</p>
{{else}}
<p>Please log in</p>
{{/if}}

<!-- Nested conditions -->
{{#if user}} {{#if user.isAdmin}}
<button>Admin Panel</button>
{{/if}} {{/if}}
```

### Loops

```html
<!-- Array iteration -->
{{#each items}}
<li>{{@index}}: {{this.name}}</li>
{{/each}}

<!-- Object iteration -->
{{#each settings}}
<div>{{@key}}: {{this}}</div>
{{/each}}

<!-- Access parent scope in loops -->
{{#each posts}}
<article>
  <h2>{{this.title}}</h2>
  <p>By {{../author.name}}</p>
</article>
{{/each}}
```

### With blocks

```html
<!-- Scoped context -->
{{#with user.profile}}
<div>
  <h3>{{name}}</h3>
  <p>{{bio}}</p>
  <img src="{{avatar}}" alt="{{name}}" />
</div>
{{/with}}
```

## Partials

```html
<!-- Include partial -->
{{> header}}

<!-- Partials inherit current context -->
{{#with user}} {{> userCard}}
<!-- userCard can access user properties -->
{{/with}}
```

## Built-in Helpers

### stripHTML

Removes HTML tags from content:

```html
<!-- Template -->
<p>{{content | stripHTML}}</p>

<!-- Data: { content: '<b>Bold</b> text' } -->
<!-- Output: <p>Bold text</p> -->
```

### json

Formats data as JSON:

```html
<!-- Template -->
<pre>{{data | json}}</pre>

<!-- Data: { data: { name: 'John', age: 30 } } -->
<!-- Output: <pre>{"name": "John", "age": 30}</pre> -->
```

### upper / lower

Text case transformation:

```html
<!-- Template -->
<h1>{{title | upper}}</h1>
<p>{{description | lower}}</p>

<!-- Data: { title: 'hello world', description: 'LOUD TEXT' } -->
<!-- Output: <h1>HELLO WORLD</h1><p>loud text</p> -->
```

### date

Date formatting:

```html
<!-- Template -->
<time>{{createdAt | date}}</time>
<time>{{updatedAt | date "YYYY-MM-DD"}}</time>

<!-- Data: { createdAt: new Date(), updatedAt: new Date() } -->
<!-- Output: <time>2024-01-15T10:30:00.000Z</time><time>2024-01-15</time> -->
```

### safe

Mark content as safe (no escaping):

```html
<!-- Template -->
<div>{{htmlContent | safe}}</div>

<!-- Data: { htmlContent: '<em>Emphasis</em>' } -->
<!-- Output: <div><em>Emphasis</em></div> -->
```

---

# Rendering Methods

## Context methods

When the plugin is installed, it adds render methods to the context:

```typescript
// Both methods available on context
await ctx.render(template, data, options);
await ctx.res.render(template, data, options);
```

## File-based rendering

```typescript
// Setup with viewsDir
const templatePlugin = new TemplatePlugin({
  viewsDir: './views',
});

templatePlugin.install(app);

// File structure:
// views/
//   ├── index.html
//   ├── about.html
//   ├── layout.html
//   └── partials/
//       ├── header.html
//       └── footer.html

app.get('/', async ctx => {
  // Renders ./views/index.html
  await ctx.render('index.html', {
    title: 'Home Page',
    users: [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
    ],
  });
});
```

## Inline rendering

```typescript
// No viewsDir - inline templates
const templatePlugin = new TemplatePlugin();
templatePlugin.install(app);

app.get('/hello', async ctx => {
  const template = `
    <html>
      <body>
        <h1>{{greeting}}</h1>
        <p>{{message}}</p>
      </body>
    </html>
  `;

  await ctx.render(template, {
    greeting: 'Hello World',
    message: 'Welcome to NextRush v2',
  });
});
```

## Layout rendering

```typescript
// layout.html
const layout = `
<!DOCTYPE html>
<html>
<head>
  <title>{{title}}</title>
</head>
<body>
  {{{body}}}
</body>
</html>
`;

// page.html
const page = `
<main>
  <h1>{{heading}}</h1>
  <p>{{content}}</p>
</main>
`;

app.get('/page', async ctx => {
  await ctx.render(
    'page.html',
    {
      title: 'My Page',
      heading: 'Welcome',
      content: 'This is the page content',
    },
    {
      layout: 'layout.html',
    }
  );
});
```

---

# Advanced Features

## Custom helpers

```typescript
const templatePlugin = new TemplatePlugin({
  helpers: {
    // Currency formatting
    currency: (value, symbol = '$') => {
      return `${symbol}${Number(value).toFixed(2)}`;
    },

    // Text truncation
    truncate: (text, length = 50) => {
      const str = String(text);
      return str.length > length ? str.slice(0, length) + '...' : str;
    },

    // URL generation
    url: (path, base = '') => {
      return `${base}${path}`;
    },

    // Conditional classes
    classNames: (...classes) => {
      return classes.filter(Boolean).join(' ');
    },
  },
});

// Use in templates
const template = `
<div class="{{classNames 'card' (if featured 'featured') (if urgent 'urgent')}}">
  <h3>{{title | truncate 30}}</h3>
  <p>Price: {{price | currency '€'}}</p>
  <a href="{{slug | url '/posts/'}}">Read more</a>
</div>
`;
```

## Runtime helper registration

```typescript
const templatePlugin = new TemplatePlugin();

// Add helpers after creation
templatePlugin.engine.registerHelper('markdown', text => {
  // Convert markdown to HTML (simplified)
  return String(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
});

templatePlugin.install(app);
```

## Dynamic partials

```typescript
const templatePlugin = new TemplatePlugin({
  partials: {
    button: `
      <button class="{{class}}" {{#if disabled}}disabled{{/if}}>
        {{text}}
      </button>
    `,
    alert: `
      <div class="alert alert-{{type}}">
        {{message}}
      </div>
    `,
  },
});

// Register partials at runtime
templatePlugin.engine.registerPartial(
  'icon',
  `
  <svg class="icon icon-{{name}}">
    <use href="#{{name}}"></use>
  </svg>
`
);

// Use in templates
const template = `
<div>
  {{> alert type="success" message="Data saved!"}}
  {{> button text="Save" class="btn-primary"}}
  {{> icon name="check"}}
</div>
`;
```

---

# Complete Examples

## Blog application

```typescript
import { createApp, TemplatePlugin } from 'nextrush';

const app = createApp();

// Configure template engine
const templatePlugin = new TemplatePlugin({
  viewsDir: './views',
  cache: process.env.NODE_ENV === 'production',
  helpers: {
    formatDate: date => new Date(date).toLocaleDateString(),
    excerpt: (text, length = 150) => {
      const str = String(text);
      return str.length > length ? str.slice(0, length) + '...' : str;
    },
  },
  partials: {
    meta: `
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>{{title}} - My Blog</title>
    `,
  },
});

templatePlugin.install(app);

// Blog posts data (normally from database)
const posts = [
  {
    id: 1,
    title: 'Getting Started with NextRush v2',
    content: 'NextRush v2 is a modern web framework...',
    author: 'John Doe',
    createdAt: new Date('2024-01-15'),
    featured: true,
  },
  {
    id: 2,
    title: 'Template Engine Guide',
    content: 'Learn how to use the template engine...',
    author: 'Jane Smith',
    createdAt: new Date('2024-01-10'),
    featured: false,
  },
];

// Routes
app.get('/', async ctx => {
  await ctx.render(
    'index.html',
    {
      title: 'Home',
      posts: posts,
      featuredPost: posts.find(p => p.featured),
    },
    {
      layout: 'layout.html',
    }
  );
});

app.get('/post/:id', async ctx => {
  const id = parseInt(ctx.params.id);
  const post = posts.find(p => p.id === id);

  if (!post) {
    ctx.res.status(404);
    await ctx.render('404.html', { title: 'Post Not Found' });
    return;
  }

  await ctx.render(
    'post.html',
    {
      title: post.title,
      post: post,
    },
    {
      layout: 'layout.html',
    }
  );
});

app.listen(3000);
```

**File structure:**

```
views/
├── layout.html          # Main layout
├── index.html           # Home page
├── post.html           # Blog post page
├── 404.html            # Not found page
└── partials/
    ├── header.html     # Site header
    ├── footer.html     # Site footer
    └── post-card.html  # Post preview card
```

**layout.html:**

```html
<!DOCTYPE html>
<html>
  <head>
    {{> meta}}
    <link rel="stylesheet" href="/css/style.css" />
  </head>
  <body>
    {{> header}}
    <main>{{{body}}}</main>
    {{> footer}}
  </body>
</html>
```

**index.html:**

```html
<section class="hero">
  {{#if featuredPost}}
  <article class="featured">
    <h1>{{featuredPost.title}}</h1>
    <p>{{featuredPost.content | excerpt 200}}</p>
    <a href="/post/{{featuredPost.id}}">Read more</a>
  </article>
  {{/if}}
</section>

<section class="posts">
  <h2>Latest Posts</h2>
  {{#each posts}} {{> post-card}} {{/each}}
</section>
```

**post.html:**

```html
<article class="post">
  <header>
    <h1>{{post.title}}</h1>
    <p class="meta">By {{post.author}} on {{post.createdAt | formatDate}}</p>
  </header>
  <div class="content">{{{post.content}}}</div>
</article>
```

**partials/post-card.html:**

```html
<article class="post-card">
  <h3><a href="/post/{{id}}">{{title}}</a></h3>
  <p>{{content | excerpt}}</p>
  <footer>
    <span>{{author}}</span>
    <time>{{createdAt | formatDate}}</time>
  </footer>
</article>
```

## API with HTML responses

```typescript
import { createApp, TemplatePlugin } from 'nextrush';

const app = createApp();

const templatePlugin = new TemplatePlugin({
  helpers: {
    json: data => ({ __safe: true, value: JSON.stringify(data, null, 2) }),
    statusColor: status => {
      const colors = {
        success: 'green',
        error: 'red',
        warning: 'orange',
        info: 'blue',
      };
      return colors[status] || 'gray';
    },
  },
});

templatePlugin.install(app);

// API status page
app.get('/status', async ctx => {
  const services = [
    { name: 'Database', status: 'success', latency: 12 },
    { name: 'Cache', status: 'success', latency: 3 },
    { name: 'External API', status: 'warning', latency: 156 },
  ];

  const template = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>System Status</title>
      <style>
        .status { padding: 10px; margin: 5px 0; border-radius: 4px; }
        .success { background: #d4edda; color: #155724; }
        .warning { background: #fff3cd; color: #856404; }
        .error { background: #f8d7da; color: #721c24; }
      </style>
    </head>
    <body>
      <h1>System Status</h1>
      {{#each services}}
        <div class="status {{status}}">
          <strong>{{name}}</strong>: {{status}} ({{latency}}ms)
        </div>
      {{/each}}

      <details>
        <summary>Raw Data</summary>
        <pre>{{services | json}}</pre>
      </details>
    </body>
    </html>
  `;

  await ctx.render(template, { services });
});

// Form handling
app.get('/contact', async ctx => {
  const template = `
    <form method="POST" action="/contact">
      <div>
        <label>Name: <input name="name" required></label>
      </div>
      <div>
        <label>Email: <input type="email" name="email" required></label>
      </div>
      <div>
        <label>Message: <textarea name="message" required></textarea></label>
      </div>
      <button type="submit">Send</button>
    </form>
  `;

  await ctx.render(template, {});
});

app.post('/contact', async ctx => {
  const { name, email, message } = ctx.body as any;

  // Process form (send email, save to database, etc.)

  const template = `
    <div class="success">
      <h2>Thank you, {{name}}!</h2>
      <p>We received your message and will respond to {{email}} soon.</p>
      <a href="/contact">Send another message</a>
    </div>
  `;

  await ctx.render(template, { name, email });
});
```

---

# TypeScript Support

Full TypeScript support with proper type definitions:

```typescript
import type {
  TemplatePlugin,
  TemplatePluginOptions,
  TemplateHelper,
  TemplateRenderOptions,
} from 'nextrush';

// Type-safe configuration
const options: TemplatePluginOptions = {
  viewsDir: './views',
  cache: true,
  helpers: {
    // TypeScript knows this should return unknown
    formatCurrency: (value: unknown): string => {
      return `$${Number(value).toFixed(2)}`;
    },
  },
};

// Custom helper with types
const dateHelper: TemplateHelper = (value, format = 'short') => {
  const date = new Date(String(value));
  return format === 'short' ? date.toLocaleDateString() : date.toISOString();
};

// Render options with types
const renderOptions: TemplateRenderOptions = {
  layout: 'main.html',
};
```

---

# Security Features

## Auto-escaping

Templates automatically escape variables to prevent XSS:

```html
<!-- Data: { userInput: '<script>alert("xss")</script>' } -->

<!-- Safe (auto-escaped) -->
<p>{{userInput}}</p>
<!-- Output: <p>&lt;script&gt;alert("xss")&lt;/script&gt;</p> -->

<!-- Unsafe (raw output) -->
<p>{{{userInput}}}</p>
<!-- Output: <p><script>alert("xss")</script></p> -->
```

## Safe helpers

Built-in helpers return safe values:

```typescript
// stripHTML helper safely removes tags
const helpers = {
  stripHTML: value => String(value).replace(/<[^>]*>/g, ''),

  // Custom safe helper
  safeHtml: value => ({
    __safe: true,
    value: sanitizeHtml(String(value)), // Use external sanitizer
  }),
};
```

## Input validation

Always validate template data:

```typescript
import { z } from 'zod';

const PostSchema = z.object({
  title: z.string().max(100),
  content: z.string().max(10000),
  author: z.string().max(50),
});

app.post('/post', async ctx => {
  try {
    const post = PostSchema.parse(ctx.body);
    await ctx.render('post.html', { post });
  } catch (error) {
    ctx.res.status(400);
    await ctx.render('error.html', {
      message: 'Invalid post data',
    });
  }
});
```

---

# Performance Features

## Template caching

Compiled templates are cached automatically:

```typescript
// Production: enable caching
const templatePlugin = new TemplatePlugin({
  cache: true, // Templates compiled once, reused
});

// Development: disable for live updates
const templatePlugin = new TemplatePlugin({
  cache: false, // Templates recompiled on each request
});
```

## Partial optimization

Partials are resolved at compile time:

```html
<!-- This partial is inlined during compilation -->
{{> header}}

<!-- Not resolved at runtime -->
<!-- Results in faster rendering -->
```

## Helper performance

Use efficient helpers:

```typescript
// ✅ Fast: direct operations
const helpers = {
  upper: value => String(value).toUpperCase(),
  currency: value => `$${Number(value).toFixed(2)}`,
};

// ❌ Slow: complex operations
const helpers = {
  markdown: value => {
    // Heavy markdown parsing on every render
    return parseMarkdown(String(value));
  },
};

// ✅ Better: cache heavy operations
const markdownCache = new Map();
const helpers = {
  markdown: value => {
    const str = String(value);
    if (markdownCache.has(str)) {
      return markdownCache.get(str);
    }
    const result = parseMarkdown(str);
    markdownCache.set(str, result);
    return result;
  },
};
```

---

# See also

- [Context API](./context.md) - Working with request context
- [Application API](./application.md) - App-level configuration
- [Static Files Plugin](./static-files-plugin.md) - Serving CSS/JS assets
- [Plugin Architecture](../architecture/plugin-system.md) - How plugins work

---

_Added in v2.0.0-alpha.1_
