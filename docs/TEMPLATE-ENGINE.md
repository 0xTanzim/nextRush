# 🎭 NextRush Ultimate Template Engine Documentation

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Quick Start](#quick-start)
4. [API Reference](#api-reference)
5. [Template Syntax](#template-syntax)
6. [Plugin Integration](#plugin-integration)
7. [Performance](#performance)
8. [Examples](#examples)
9. [Advanced Usage](#advanced-usage)
10. [Troubleshooting](#troubleshooting)

## Overview

The NextRush Ultimate Template Engine is a powerful, flexible, and zero-dependency template system designed for the NextRush web framework. It supports multiple template syntaxes, streaming rendering, component systems, and advanced features like layouts and partials.

### Key Benefits

- 🎯 **Multi-syntax support**: Handlebars, JSX-style, Mustache, and custom syntaxes
- 🔥 **Streaming rendering**: High-performance output for large templates
- 🧩 **Component system**: Reusable template components with slots
- 📁 **Smart path resolution**: Automatic template discovery and aliasing
- 🎨 **Layout inheritance**: Powerful layout system for consistent designs
- 🛡️ **Type-safe**: Full TypeScript support with strict type checking
- ⚡ **Caching**: Template compilation caching for production performance
- 🌐 **i18n ready**: Built-in internationalization support
- 🧪 **Testing utilities**: Comprehensive testing and debugging tools

## Features

### Multi-Syntax Template Support

#### Handlebars Syntax

```html
<!-- Basic variables -->
<h1>{{title}}</h1>
<p>Welcome {{user.name}}!</p>

<!-- Conditionals -->
{{#if user.isLoggedIn}}
<p>Hello {{user.name}}!</p>
{{else}}
<p>Please log in</p>
{{/if}}

<!-- Loops -->
{{#each items}}
<div class="item">{{name}} - ${{price}}</div>
{{/each}}

<!-- Helpers -->
{{formatDate createdAt "YYYY-MM-DD"}} {{uppercase title}}
```

#### JSX-Style Syntax

```html
<!-- Variables -->
<h1><%= title %></h1>
<p>Welcome <%= user.name %>!</p>

<!-- Code blocks -->
<% if (user.isLoggedIn) { %>
<p>Hello <%= user.name %>!</p>
<% } else { %>
<p>Please log in</p>
<% } %>

<!-- Loops -->
<% for (const item of items) { %>
<div class="item"><%= item.name %> - $<%= item.price %></div>
<% } %>
```

#### Component Syntax

```html
<!-- Component usage -->
<UserCard name="{{user.name}}" avatar="{{user.avatar}}">
  <div slot="bio">
    <p>{{user.bio}}</p>
  </div>
</UserCard>

<!-- Component with children -->
<Layout title="{{pageTitle}}">
  <main>{{content}}</main>
</Layout>
```

### Advanced Features

#### Layout System

```html
<!-- layout.html -->
<!DOCTYPE html>
<html>
  <head>
    <title>{{title}}</title>
  </head>
  <body>
    <header>{{> header}}</header>
    <main>{{content}}</main>
    <footer>{{> footer}}</footer>
  </body>
</html>

<!-- page.html -->
--- layout: layout title: My Page ---
<h1>Page Content</h1>
<p>This content will be inserted into the layout.</p>
```

#### Frontmatter Support

```html
---
layout: base
title: Blog Post
author: Jane Doe
date: 2024-01-15
tags: [nextjs, templates, web]
---

<article>
  <h1>{{title}}</h1>
  <p>By {{author}} on {{formatDate date}}</p>
  <div class="content">
    <!-- Template content here -->
  </div>
</article>
```

## Quick Start

### Installation

The template engine is included with NextRush by default. To use it in your application:

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Set views directory
app.setViews('./views', {
  cache: process.env.NODE_ENV === 'production',
  defaultExtension: '.html',
  syntax: 'auto', // Automatically detect syntax
});

// Use in routes
app.get('/', (req, res) => {
  res.render('index', {
    title: 'Welcome to NextRush',
    user: { name: 'Developer' },
  });
});
```

### Basic Template Structure

Create a template file `views/index.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>{{title}}</title>
  </head>
  <body>
    <h1>{{title}}</h1>
    <p>Hello {{user.name}}!</p>

    {{#if user.hobbies}}
    <h2>Your hobbies:</h2>
    <ul>
      {{#each user.hobbies}}
      <li>{{this}}</li>
      {{/each}}
    </ul>
    {{/if}}
  </body>
</html>
```

## API Reference

### NextRush Integration

#### app.setViews(directory, options?)

Set the views directory and template options.

```typescript
app.setViews('./views', {
  cache: boolean, // Enable template caching
  defaultExtension: string, // Default file extension
  syntax: string, // Template syntax ('auto', 'handlebars', 'jsx', 'mustache')
  watchFiles: boolean, // Watch for file changes in development
  streaming: boolean, // Enable streaming rendering
});
```

#### app.setTemplateEngine(options)

Configure template engine options.

```typescript
app.setTemplateEngine({
  syntax: 'handlebars',
  cache: true,
  helpers: {
    formatDate: (date) => new Date(date).toLocaleDateString(),
    uppercase: (str) => str.toUpperCase(),
  },
  filters: {
    reverse: (arr) => [...arr].reverse(),
    take: (arr, n) => arr.slice(0, n),
  },
});
```

#### res.render(template, data, options?)

Render a template and send the response.

```typescript
app.get('/profile/:id', async (req, res) => {
  const user = await getUserById(req.params.id);

  res.render(
    'profile',
    {
      user,
      title: `${user.name}'s Profile`,
    },
    {
      layout: 'main',
      streaming: true, // Enable streaming for this render
    }
  );
});
```

### Direct Usage

#### UltimateTemplateParser

Parse template strings into AST nodes.

```typescript
import { UltimateTemplateParser } from 'nextrush/template';

const parser = new UltimateTemplateParser(templateString, {
  engine: 'handlebars',
});

const parseResult = parser.parse();
console.log(parseResult.nodes);
console.log(parseResult.metadata);
```

#### UltimateTemplateRenderer

Render parsed templates with data.

```typescript
import { UltimateTemplateRenderer } from 'nextrush/template';

const renderer = new UltimateTemplateRenderer({
  cache: true,
  helpers: {
    formatPrice: (price) => `$${price.toFixed(2)}`,
  },
});

const html = await renderer.render(parseResult.nodes, data);
```

### Streaming Rendering

For large templates or real-time rendering:

```typescript
app.get('/large-report', (req, res) => {
  res.render('report', reportData, {
    streaming: true,
  });
});

// Or directly
const stream = await renderer.renderStream(nodes, data);
stream.pipe(res);
```

## Template Syntax

### Variables

#### Basic Variables

```html
{{name}}
<!-- Handlebars -->
<%= name %>
<!-- JSX-style -->
{{{rawHtml}}}
<!-- Unescaped HTML -->
<%- rawHtml %>
<!-- Unescaped JSX-style -->
```

#### Object Properties

```html
{{user.name}} {{user.profile.avatar}} {{items[0].title}}
```

#### Array Access

```html
{{users[0].name}} {{colors[index]}}
```

### Conditionals

#### Handlebars Style

```html
{{#if condition}}
<p>Condition is true</p>
{{else}}
<p>Condition is false</p>
{{/if}} {{#unless disabled}}
<button>Click me</button>
{{/unless}}
```

#### JSX Style

```html
<% if (condition) { %>
<p>Condition is true</p>
<% } else { %>
<p>Condition is false</p>
<% } %>
```

### Loops

#### Handlebars Each

```html
{{#each items}}
<div class="item">
  <h3>{{name}}</h3>
  <p>Index: {{@index}}</p>
  <p>Key: {{@key}}</p>
  <p>First: {{@first}}</p>
  <p>Last: {{@last}}</p>
</div>
{{/each}}
```

#### JSX Style Loops

```html
<% for (const item of items) { %>
<div class="item">
  <h3><%= item.name %></h3>
</div>
<% } %> <% items.forEach((item, index) => { %>
<div data-index="<%= index %>"><%= item.name %></div>
<% }); %>
```

### Helpers and Filters

#### Built-in Helpers

```html
{{formatDate date "YYYY-MM-DD"}} {{uppercase title}} {{lowercase description}}
{{capitalize name}} {{truncate text 100}} {{json object}} {{length array}}
```

#### Custom Helpers

```typescript
app.setTemplateEngine({
  helpers: {
    formatPrice(price, currency = 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(price);
    },

    timeAgo(date) {
      const now = new Date();
      const diff = now.getTime() - new Date(date).getTime();
      const minutes = Math.floor(diff / 60000);

      if (minutes < 60) return `${minutes} minutes ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hours ago`;
      const days = Math.floor(hours / 24);
      return `${days} days ago`;
    },
  },
});
```

#### Using Custom Helpers

```html
<div class="product">
  <h3>{{name}}</h3>
  <p class="price">{{formatPrice price "EUR"}}</p>
  <span class="time">{{timeAgo createdAt}}</span>
</div>
```

### Partials

#### Including Partials

```html
{{> header}} {{> navigation user}} {{> footer year=2024}}
```

#### Partial with Context

```html
{{#each posts}} {{> post-card title=title author=author date=publishedAt}}
{{/each}}
```

### Components

#### Component Definition

```html
<!-- components/UserCard.html -->
<div class="user-card">
  <img src="{{avatar}}" alt="{{name}}'s avatar" />
  <h3>{{name}}</h3>
  <p>{{email}}</p>
  <div class="bio">{{> slot "bio"}}</div>
  <div class="actions">{{> slot "actions"}}</div>
</div>
```

#### Component Usage

```html
<UserCard name="{{user.name}}" email="{{user.email}}" avatar="{{user.avatar}}">
  <div slot="bio">
    <p>{{user.bio}}</p>
    <p>Joined {{formatDate user.joinedAt}}</p>
  </div>

  <div slot="actions">
    <button onclick="sendMessage('{{user.id}}')">Message</button>
    <button onclick="follow('{{user.id}}')">Follow</button>
  </div>
</UserCard>
```

## Plugin Integration

### Creating a Template Plugin

```typescript
import { TemplatePlugin } from 'nextrush/plugins';

const templatePlugin = new TemplatePlugin(registry, {
  views: './views',
  cache: true,
  defaultExtension: '.html',
  syntax: 'auto',
});

// Register with application
app.use(templatePlugin);
```

### Custom Template Engine

```typescript
import {
  UltimateTemplateParser,
  UltimateTemplateRenderer,
} from 'nextrush/template';

class CustomTemplateEngine {
  private parser: UltimateTemplateParser;
  private renderer: UltimateTemplateRenderer;

  constructor(options = {}) {
    this.parser = new UltimateTemplateParser('', options);
    this.renderer = new UltimateTemplateRenderer(options);
  }

  async render(templatePath: string, data: object): Promise<string> {
    const template = await fs.readFile(templatePath, 'utf8');
    this.parser = new UltimateTemplateParser(template);
    const parseResult = this.parser.parse();
    return this.renderer.render(parseResult.nodes, data);
  }
}
```

## Performance

### Caching Strategies

#### Template Compilation Caching

```typescript
app.setTemplateEngine({
  cache: true, // Cache compiled templates
  cacheSize: 100, // Maximum cached templates
  cacheTTL: 3600000, // Cache TTL in milliseconds
});
```

#### Streaming for Large Templates

```typescript
// Use streaming for templates that generate large output
app.get('/report', (req, res) => {
  res.render('large-report', data, {
    streaming: true,
  });
});
```

### Performance Optimization Tips

1. **Enable caching in production**:

   ```typescript
   app.setViews('./views', {
     cache: process.env.NODE_ENV === 'production',
   });
   ```

2. **Use streaming for large outputs**:

   ```typescript
   res.render('large-template', data, { streaming: true });
   ```

3. **Precompile templates**:

   ```typescript
   // Build step - precompile templates
   const compiledTemplates = await compileTemplates('./views');
   ```

4. **Minimize helper complexity**:

   ```typescript
   // Good - simple helper
   helpers: {
     formatDate: (date) => date.toLocaleDateString();
   }

   // Avoid - complex computation in helper
   helpers: {
     complexCalculation: (data) => {
       // Heavy computation here
     };
   }
   ```

## Examples

### Basic Blog

#### Layout Template (`layouts/base.html`)

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{title}} - My Blog</title>
    <link rel="stylesheet" href="/styles/main.css" />
  </head>
  <body>
    <header>{{> header}}</header>

    <main>{{content}}</main>

    <footer>{{> footer}}</footer>

    <script src="/scripts/main.js"></script>
  </body>
</html>
```

#### Blog Post Template (`posts/show.html`)

```html
---
layout: base
---

<article class="blog-post">
  <header>
    <h1>{{post.title}}</h1>
    <div class="meta">
      <span class="author">By {{post.author.name}}</span>
      <time>{{formatDate post.publishedAt "MMMM DD, YYYY"}}</time>
      <div class="tags">
        {{#each post.tags}}
        <span class="tag">{{this}}</span>
        {{/each}}
      </div>
    </div>
  </header>

  <div class="content">{{{post.content}}}</div>

  {{#if post.author}} {{> author-bio author=post.author}} {{/if}}

  <section class="comments">
    <h3>Comments</h3>
    {{#each comments}} {{> comment-card comment=this}} {{/each}}
  </section>
</article>
```

#### Route Handler

```typescript
app.get('/posts/:slug', async (req, res) => {
  const post = await getPostBySlug(req.params.slug);
  const comments = await getCommentsByPostId(post.id);

  if (!post) {
    return res.status(404).render('404', {
      title: 'Post Not Found',
    });
  }

  res.render('posts/show', {
    title: post.title,
    post,
    comments,
  });
});
```

### E-commerce Product Listing

#### Product Grid Template

```html
<div class="product-grid">
  {{#each products}}
  <ProductCard
    id="{{id}}"
    name="{{name}}"
    price="{{price}}"
    image="{{image}}"
    rating="{{rating}}"
    onSale="{{onSale}}"
  >
    <div slot="badges">
      {{#if onSale}}
      <span class="badge sale">Sale</span>
      {{/if}} {{#if featured}}
      <span class="badge featured">Featured</span>
      {{/if}}
    </div>

    <div slot="actions">
      <button class="btn btn-primary" onclick="addToCart('{{id}}')">
        Add to Cart
      </button>
      <button class="btn btn-secondary" onclick="addToWishlist('{{id}}')">
        ♥
      </button>
    </div>
  </ProductCard>
  {{/each}}
</div>

{{#unless products}}
<div class="empty-state">
  <h3>No products found</h3>
  <p>Try adjusting your search or filters.</p>
</div>
{{/unless}}
```

### API Response Template

#### JSON API Template

```html
<% const formatApiResponse = (data, status = 'success') => { return { status,
timestamp: new Date().toISOString(), data: data || null, meta: { count:
Array.isArray(data) ? data.length : (data ? 1 : 0), version: '1.0.0' } }; }; %>
<%= JSON.stringify(formatApiResponse(responseData), null, 2) %>
```

#### XML API Template

```html
<?xml version="1.0" encoding="UTF-8"?>
<response>
  <status>{{status}}</status>
  <timestamp>{{timestamp}}</timestamp>
  <data>
    {{#if users}}
    <users>
      {{#each users}}
      <user id="{{id}}">
        <name>{{name}}</name>
        <email>{{email}}</email>
        <createdAt>{{createdAt}}</createdAt>
      </user>
      {{/each}}
    </users>
    {{/if}}
  </data>
</response>
```

## Advanced Usage

### Custom Syntax Support

#### Creating a Custom Parser

```typescript
import { UltimateTemplateParser } from 'nextrush/template';

class CustomSyntaxParser extends UltimateTemplateParser {
  constructor(template: string) {
    super(template, { engine: 'custom' });
  }

  protected parseVariable(): TemplateNode | null {
    // Custom variable syntax: ${variable}
    if (this.peek(2) === '${') {
      const start = this.pos;
      this.pos += 2;

      const key = this.parseIdentifier();

      if (this.peek() === '}') {
        this.pos++;
        return {
          type: 'variable',
          key,
          escape: true,
          start,
          end: this.pos,
        };
      }
    }

    return super.parseVariable();
  }
}
```

### Internationalization

#### i18n Setup

```typescript
app.setTemplateEngine({
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es', 'fr'],
    directory: './locales',
  },
  helpers: {
    t: (key, locale) => i18n.translate(key, locale),
    tn: (key, count, locale) => i18n.translatePlural(key, count, locale),
  },
});
```

#### i18n Templates

```html
<h1>{{t "welcome.title" locale}}</h1>
<p>{{t "welcome.message" locale}}</p>

<div class="stats">
  <span>{{tn "items.count" itemCount locale}}</span>
  <span>{{tn "users.online" onlineUsers locale}}</span>
</div>
```

### Testing Templates

#### Template Testing Utilities

```typescript
import { testTemplateRender } from 'nextrush/template/testing';

describe('User Profile Template', () => {
  test('renders user information correctly', async () => {
    const result = await testTemplateRender('profile', {
      user: {
        name: 'John Doe',
        email: 'john@example.com',
        verified: true,
      },
    });

    expect(result.html).toContain('John Doe');
    expect(result.html).toContain('john@example.com');
    expect(result.html).toContain('verified');
  });

  test('handles missing user gracefully', async () => {
    const result = await testTemplateRender('profile', {});

    expect(result.html).toContain('Guest User');
    expect(result.errors).toHaveLength(0);
  });
});
```

## Troubleshooting

### Common Issues

#### Template Not Found

```
Error: Template not found: /path/to/template.html
```

**Solutions:**

1. Check the views directory path
2. Verify the template file exists
3. Check file permissions
4. Ensure the correct file extension

#### Compilation Errors

```
Error: Unexpected token at line 15, column 23
```

**Solutions:**

1. Check template syntax
2. Ensure proper opening/closing tags
3. Validate frontmatter YAML syntax
4. Check for unescaped quotes

#### Performance Issues

```
Warning: Template rendering is slow
```

**Solutions:**

1. Enable template caching
2. Use streaming for large templates
3. Optimize helpers and filters
4. Reduce template complexity

### Debug Mode

Enable debug mode for detailed error information:

```typescript
app.setTemplateEngine({
  debug: true,
  logLevel: 'verbose',
});
```

### Error Handling

#### Custom Error Templates

```typescript
app.setTemplateEngine({
  errorTemplate: 'errors/template-error',
  onError: (error, templatePath, data) => {
    console.error('Template error:', error);

    // Custom error handling
    if (process.env.NODE_ENV === 'development') {
      return renderDebugTemplate(error, templatePath, data);
    }

    return renderErrorTemplate(error);
  },
});
```

#### Graceful Error Recovery

```html
{{#try}} {{dangerousHelper data}} {{catch error}}
<div class="error">Something went wrong: {{error.message}}</div>
{{/try}}
```

---

**🎉 Congratulations!** You now have a comprehensive understanding of the NextRush Ultimate Template Engine. This powerful system provides everything you need to build dynamic, high-performance web applications with beautiful, maintainable templates.

For more examples and advanced usage patterns, check out the [NextRush Examples Repository](https://github.com/nextrush/examples) and the [Template Engine Playground](https://nextrush.dev/playground/templates).
