# Template Plugin for NextRush v2 🎨

> **Performance-first, type-safe HTML templating with auto-escaping, layouts, partials, and powerful helpers**

## 🚀 Overview

The Template Plugin provides enterprise-grade HTML templating for NextRush v2 applications. Built with performance and security in mind, it offers:

- **🔒 Security First**: Auto-escaping by default prevents XSS attacks
- **⚡ High Performance**: In-memory compilation with smart caching
- **🎯 Developer Experience**: Familiar Handlebars/Mustache-like syntax
- **🧩 Modular Design**: Extensible helpers and partials system
- **📁 File & Inline Support**: Works with file-based templates or inline strings
- **🎨 Layout System**: Powerful layout inheritance for consistent designs

## 📦 Installation & Setup

### Basic Setup

```typescript
import { createApp } from '@/index';
import { TemplatePlugin } from '@/plugins/template/template.plugin';

const app = createApp();

// Basic setup with file-based templates
const templatePlugin = new TemplatePlugin({
  viewsDir: path.join(__dirname, 'views'),
  cache: true, // Enable template caching (default: true)
});

templatePlugin.install(app);
```

### Advanced Configuration

```typescript
import { TemplatePlugin } from '@/plugins/template/template.plugin';

const templatePlugin = new TemplatePlugin({
  viewsDir: './views', // Directory for template files
  cache: process.env.NODE_ENV === 'production', // Cache in production
  enableFilePartials: true, // Enable {{> partial}} from files
  partialExt: '.html', // Extension for partial files

  // Custom helpers
  helpers: {
    formatPrice: value => `$${Number(value).toFixed(2)}`,
    truncate: (text, length = 100) =>
      text.length > length ? text.slice(0, length) + '...' : text,
    capitalize: text => text.charAt(0).toUpperCase() + text.slice(1),
  },

  // Inline partials
  partials: {
    button: '<button class="btn {{class}}">{{text}}</button>',
    alert: '<div class="alert alert-{{type}}">{{message}}</div>',
  },
});
```

## 🎯 Quick Start Guide

### 1. Create Your First Template

```html
<!-- views/welcome.html -->
<!DOCTYPE html>
<html>
  <head>
    <title>{{title}}</title>
  </head>
  <body>
    <h1>Welcome, {{user.name}}!</h1>
    <p>You have {{user.notifications.length}} notifications.</p>

    {{#if user.isAdmin}}
    <div class="admin-panel">Admin Panel Available</div>
    {{else}}
    <div class="user-panel">User Dashboard</div>
    {{/if}}
  </body>
</html>
```

### 2. Render in Your Route Handler

```typescript
app.get('/welcome', async ctx => {
  const data = {
    title: 'Welcome Page',
    user: {
      name: 'John Doe',
      isAdmin: false,
      notifications: ['Message 1', 'Message 2'],
    },
  };

  // Method 1: Using ctx.render()
  await ctx.render('welcome.html', data);

  // Method 2: Using ctx.res.render()
  // await ctx.res.render('welcome.html', data);
});
```

## 📝 Template Syntax Guide

### Variables & Data Access

```html
<!-- Basic variable -->
<h1>{{title}}</h1>

<!-- Nested object access -->
<p>{{user.profile.email}}</p>

<!-- Array access -->
<span>{{items.0.name}}</span>

<!-- Special variables in loops -->
{{#each users}}
<li>{{@index}}: {{this.name}}</li>
<!-- @index for array position -->
{{/each}} {{#each settings}}
<div>{{@key}}: {{this}}</div>
<!-- @key for object keys -->
{{/each}}
```

### HTML Escaping & Raw Output

```html
<!-- Auto-escaped (safe, prevents XSS) -->
<div>{{userInput}}</div>
<!-- <script> becomes &lt;script&gt; -->

<!-- Raw/unescaped output (dangerous - use carefully!) -->
<div>{{{trustedHtmlContent}}}</div>
<!-- Triple braces = raw HTML -->

<!-- Safe helper for trusted content -->
<div>{{ safe trustedContent }}</div>
```

### Conditional Rendering

```html
<!-- Simple if/else -->
{{#if user.isLoggedIn}}
<p>Welcome back, {{user.name}}!</p>
{{else}}
<p>Please log in to continue</p>
{{/if}}

<!-- Checking for existence -->
{{#if user.profile.avatar}}
<img src="{{user.profile.avatar}}" alt="Avatar" />
{{else}}
<div class="default-avatar">{{user.initials}}</div>
{{/if}}

<!-- Complex conditions (use helpers) -->
{{#if (isEqual user.role 'admin')}}
<div class="admin-tools">...</div>
{{/if}}
```

### Loops & Iteration

#### Array Iteration

```html
{{#each products}}
<div class="product" data-index="{{@index}}">
  <h3>{{name}}</h3>
  <p>Price: ${{price}}</p>
  {{#if this.onSale}}
  <span class="sale-badge">ON SALE!</span>
  {{/if}}
</div>
{{/each}}

<!-- Empty state -->
{{#each products}}
<div class="product">{{name}}</div>
{{else}}
<p>No products found</p>
{{/each}}
```

#### Object Iteration

```html
{{#each userSettings}}
<div class="setting">
  <label>{{@key}}:</label>
  <span>{{this}}</span>
</div>
{{/each}}

<!-- Example output for { theme: 'dark', language: 'en' }:
<div class="setting">
  <label>theme:</label>
  <span>dark</span>
</div>
<div class="setting">
  <label>language:</label>
  <span>en</span>
</div>
-->
```

### Context Switching with `with`

```html
{{#with user.profile}}
<h2>{{name}}</h2>
<!-- Instead of {{user.profile.name}} -->
<p>{{email}}</p>
<!-- Instead of {{user.profile.email}} -->
<p>Joined: {{joinDate}}</p>
<!-- Instead of {{user.profile.joinDate}} -->
{{/with}}
```

## 🔧 Built-in Helpers

### String Helpers

```html
<!-- Text transformation -->
<h1>{{ upper user.name }}</h1>
<!-- JOHN DOE -->
<p>{{ lower user.email }}</p>
<!-- john@example.com -->

<!-- HTML stripping -->
<span>{{ stripHTML content }}</span>
<!-- Removes all HTML tags -->

<!-- Safe output -->
<div>{{ safe trustedHtml }}</div>
<!-- Outputs raw HTML safely -->
```

### Date Formatting

```html
<!-- Default ISO format -->
<time>{{ date createdAt }}</time>
<!-- 2024-01-15T10:30:00.000Z -->

<!-- Custom formatting -->
<time>{{ date createdAt 'YYYY-MM-DD' }}</time>
<!-- 2024-01-15 -->
<time>{{ date createdAt 'DD/MM/YYYY hh:mm' }}</time>
<!-- 15/01/2024 10:30 -->

<!-- Format tokens: YYYY MM DD hh mm ss -->
<span>{{ date updatedAt 'DD/MM/YYYY at hh:mm:ss' }}</span>
```

### JSON Helper

```html
<!-- Debug output -->
<pre>{{ json userData }}</pre>

<!-- Pretty-printed JSON (auto-unescaped) -->
<script>
  const config = {{ json appConfig }};
</script>
```

## 🎭 Filter Chains

Chain multiple helpers for powerful data transformation:

```html
<!-- Basic chain -->
<h1>{{ user.bio | stripHTML | upper }}</h1>

<!-- Complex transformation -->
<p>{{ article.content | stripHTML | truncate 150 | capitalize }}</p>

<!-- Multiple filters -->
<span>{{ user.email | lower | safe }}</span>
```

## 🧩 Partials System

### File-based Partials

```html
<!-- views/partials/header.html -->
<header class="site-header">
  <h1>{{siteName}}</h1>
  <nav>{{> navigation}}</nav>
</header>

<!-- views/partials/navigation.html -->
<ul class="nav">
  {{#each menuItems}}
  <li><a href="{{url}}">{{title}}</a></li>
  {{/each}}
</ul>

<!-- In your main template -->
{{> header}}
<main>Content here</main>
{{> footer}}
```

### Inline Partials

```typescript
const templatePlugin = new TemplatePlugin({
  partials: {
    userCard: `
      <div class="user-card">
        <img src="{{avatar}}" alt="{{name}}">
        <h3>{{name}}</h3>
        <p>{{title}}</p>
      </div>
    `,

    statusBadge: `
      <span class="badge badge-{{status}}">{{status | upper}}</span>
    `,
  },
});

// Use in templates
// {{> userCard}}
// {{> statusBadge}}
```

## 🎨 Layout System

### Creating Layouts

```html
<!-- views/layouts/main.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>{{title}} - My App</title>
    <link rel="stylesheet" href="/css/main.css" />
  </head>
  <body>
    <header>{{> header}}</header>

    <main class="main-content">
      {{{body}}}
      <!-- Page content goes here -->
    </main>

    <footer>{{> footer}}</footer>

    <script src="/js/main.js"></script>
  </body>
</html>
```

### Using Layouts

```typescript
// In your route handler
app.get('/profile', async ctx => {
  await ctx.render('profile.html', userData, {
    layout: 'layouts/main.html', // Wraps content in layout
  });
});
```

```html
<!-- views/profile.html (content only) -->
<div class="profile-page">
  <h1>{{user.name}}'s Profile</h1>
  <div class="profile-info">
    <p>Email: {{user.email}}</p>
    <p>Member since: {{ date user.joinDate 'YYYY-MM-DD' }}</p>
  </div>
</div>
```

## ⚡ Performance Features

### Template Caching

```typescript
const templatePlugin = new TemplatePlugin({
  cache: process.env.NODE_ENV === 'production', // Cache in production
  viewsDir: './views',
});

// Cached templates are compiled once and reused
// Significant performance improvement for repeated renders
```

### Smart File Loading

```typescript
// The plugin intelligently detects file vs inline templates
await ctx.render('user.html', data); // File-based (if viewsDir set)
await ctx.render('<h1>{{title}}</h1>', data); // Inline template
```

## 🛠️ Custom Helpers

### Creating Custom Helpers

```typescript
const templatePlugin = new TemplatePlugin({
  helpers: {
    // Simple transformation
    formatCurrency: (value: unknown, currency = 'USD') => {
      const num = Number(value) || 0;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency as string,
      }).format(num);
    },

    // Conditional helper
    isEqual: (a: unknown, b: unknown) => a === b,

    // Array helper
    length: (arr: unknown) => (Array.isArray(arr) ? arr.length : 0),

    // String manipulation
    truncate: (text: unknown, length = 100) => {
      const str = String(text || '');
      return str.length > length ? str.slice(0, length) + '...' : str;
    },

    // Safe HTML helper
    markdown: (text: unknown) => {
      // Simple markdown parsing (you can use a real markdown library)
      const str = String(text || '');
      const html = str
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');

      return { __safe: true, value: html }; // Mark as safe HTML
    },
  },
});
```

### Using Custom Helpers

```html
<!-- Currency formatting -->
<p>Price: {{ formatCurrency product.price 'EUR' }}</p>

<!-- Conditional rendering -->
{{#if (isEqual user.status 'active')}}
<span class="status-active">Active User</span>
{{/if}}

<!-- String manipulation -->
<p>{{ truncate article.description 200 }}</p>

<!-- Safe HTML output -->
<div class="content">{{ markdown post.content }}</div>

<!-- Chain with other helpers -->
<h2>{{ post.title | upper | truncate 50 }}</h2>
```

## 🏗️ Real-World Examples

### Complete Blog Application

```typescript
// Route handlers
app.get('/', async ctx => {
  const posts = await getBlogPosts();
  await ctx.render('home.html', { posts }, { layout: 'layouts/main.html' });
});

app.get('/post/:id', async ctx => {
  const post = await getPost(ctx.params.id);
  const comments = await getComments(ctx.params.id);

  await ctx.render(
    'post.html',
    { post, comments },
    {
      layout: 'layouts/main.html',
    }
  );
});
```

```html
<!-- views/home.html -->
<div class="blog-home">
  <h1>Latest Posts</h1>

  {{#each posts}}
  <article class="post-preview">
    <h2><a href="/post/{{id}}">{{title}}</a></h2>
    <div class="meta">
      By {{author.name}} on {{ date publishedAt 'MM/DD/YYYY' }}
    </div>
    <p>{{ truncate content 300 }}</p>
    <a href="/post/{{id}}" class="read-more">Read More</a>
  </article>
  {{else}}
  <p>No posts yet!</p>
  {{/each}}
</div>
```

```html
<!-- views/post.html -->
<article class="blog-post">
  <header class="post-header">
    <h1>{{post.title}}</h1>
    <div class="post-meta">
      By {{post.author.name}} on {{ date post.publishedAt 'MMMM DD, YYYY' }}
      <span class="reading-time">{{ readingTime post.content }} min read</span>
    </div>
  </header>

  <div class="post-content">{{ markdown post.content }}</div>

  <section class="comments">
    <h3>Comments ({{ length comments }})</h3>

    {{#each comments}}
    <div class="comment">
      <div class="comment-author">{{author.name}}</div>
      <div class="comment-date">{{ date createdAt 'MM/DD/YYYY' }}</div>
      <div class="comment-content">{{content}}</div>
    </div>
    {{else}}
    <p>No comments yet. Be the first to comment!</p>
    {{/each}}
  </section>
</article>
```

### E-commerce Product Listing

```typescript
app.get('/products', async ctx => {
  const products = await getProducts(ctx.query);
  const categories = await getCategories();

  await ctx.render(
    'products.html',
    {
      products,
      categories,
      selectedCategory: ctx.query.category,
      priceRange: ctx.query.price,
    },
    { layout: 'layouts/shop.html' }
  );
});
```

```html
<!-- views/products.html -->
<div class="products-page">
  <aside class="filters">
    <h3>Categories</h3>
    <ul class="category-list">
      {{#each categories}}
      <li>
        <a
          href="/products?category={{id}}"
          class="{{#if (isEqual ../selectedCategory id)}}active{{/if}}"
        >
          {{name}} ({{productCount}})
        </a>
      </li>
      {{/each}}
    </ul>
  </aside>

  <main class="product-grid">
    {{#each products}}
    <div class="product-card">
      {{#if images.0}}
      <img src="{{images.0.url}}" alt="{{name}}" class="product-image" />
      {{/if}}

      <div class="product-info">
        <h3 class="product-name">{{name}}</h3>
        <p class="product-description">{{ truncate description 100 }}</p>

        <div class="product-price">
          {{#if onSale}}
          <span class="original-price">${{originalPrice}}</span>
          <span class="sale-price">{{ formatCurrency salePrice }}</span>
          {{else}}
          <span class="price">{{ formatCurrency price }}</span>
          {{/if}}
        </div>

        <div class="product-actions">
          <button class="btn btn-primary" data-product-id="{{id}}">
            Add to Cart
          </button>
          {{#if inWishlist}}
          <button class="btn btn-wishlist active">❤️</button>
          {{else}}
          <button class="btn btn-wishlist">🤍</button>
          {{/if}}
        </div>
      </div>

      {{#if onSale}}
      <div class="sale-badge">SALE</div>
      {{/if}}
    </div>
    {{else}}
    <div class="no-products">
      <h3>No products found</h3>
      <p>Try adjusting your filters or search terms.</p>
    </div>
    {{/each}}
  </main>
</div>
```

## 🔧 Configuration Reference

### TemplatePluginOptions Interface

```typescript
interface TemplatePluginOptions {
  /**
   * Directory containing template files
   * If not set, only inline templates are supported
   */
  viewsDir?: string;

  /**
   * Enable template compilation caching
   * @default true
   */
  cache?: boolean;

  /**
   * Custom helper functions
   * @example
   * helpers: {
   *   formatPrice: (value) => `$${value}`,
   *   isEven: (num) => num % 2 === 0
   * }
   */
  helpers?: Record<string, (value: unknown, ...args: unknown[]) => unknown>;

  /**
   * Inline partial templates
   * @example
   * partials: {
   *   button: '<button class="{{class}}">{{text}}</button>'
   * }
   */
  partials?: Record<string, string>;

  /**
   * Enable loading partials from files
   * When true, {{> header}} loads from viewsDir/header.html
   * @default true
   */
  enableFilePartials?: boolean;

  /**
   * File extension for partial files
   * @default '.html'
   */
  partialExt?: string;
}
```

### Context Methods

```typescript
// Available on context object
interface TemplateContext {
  /**
   * Render a template and send response
   * @param templateOrName - Template file name or inline template string
   * @param data - Data object to pass to template
   * @param options - Render options (layout, etc.)
   */
  render(
    templateOrName: string,
    data?: Record<string, unknown>,
    options?: { layout?: string }
  ): Promise<void>;
}

// Available on response object
interface TemplateResponse {
  /**
   * Render a template and send response
   * Same as ctx.render()
   */
  render(
    templateOrName: string,
    data?: Record<string, unknown>,
    options?: { layout?: string }
  ): Promise<void>;
}
```

## 🚨 Security Best Practices

### 1. Always Validate User Input

```typescript
// ❌ DANGEROUS - Never trust user input directly
app.post('/profile', async ctx => {
  await ctx.render('profile.html', {
    userBio: ctx.body.bio, // XSS vulnerability!
  });
});

// ✅ SAFE - Validate and sanitize
import { z } from 'zod';

const ProfileSchema = z.object({
  bio: z
    .string()
    .max(500)
    .refine(text => !/<script>/i.test(text)),
});

app.post('/profile', async ctx => {
  const data = ProfileSchema.parse(ctx.body);
  await ctx.render('profile.html', {
    userBio: data.bio, // Auto-escaped by template engine
  });
});
```

### 2. Use Escaping Correctly

```html
<!-- ✅ SAFE - Auto-escaped -->
<div class="user-content">{{userInput}}</div>

<!-- ⚠️ DANGEROUS - Only for trusted content -->
<div class="admin-content">{{{trustedHtmlFromAdmin}}}</div>

<!-- ✅ SAFE - Explicitly marked as safe after validation -->
<div class="content">{{ safe validatedAndSanitizedHtml }}</div>
```

### 3. Validate Helper Outputs

```typescript
const templatePlugin = new TemplatePlugin({
  helpers: {
    // ❌ BAD - Could return unsafe HTML
    formatContent: (content: unknown) => {
      return `<div>${content}</div>`; // XSS risk!
    },

    // ✅ GOOD - Returns safe content or explicitly marked safe
    formatContent: (content: unknown) => {
      const sanitized = escapeHtml(String(content || ''));
      return { __safe: true, value: `<div class="content">${sanitized}</div>` };
    },
  },
});
```

## 🐛 Debugging & Troubleshooting

### Common Issues & Solutions

#### 1. Template Not Found

```
Error: Template 'user.html' not found
```

**Solution:**

```typescript
// Ensure viewsDir is set correctly
const templatePlugin = new TemplatePlugin({
  viewsDir: path.resolve(__dirname, 'views'), // Use absolute path
});

// Check file exists
console.log('Views directory:', path.resolve(__dirname, 'views'));
console.log('Template exists:', fs.existsSync('./views/user.html'));
```

#### 2. Partial Not Rendering

```html
<!-- {{> header}} renders as empty -->
```

**Solutions:**

```typescript
// Option 1: Enable file partials
const templatePlugin = new TemplatePlugin({
  viewsDir: './views',
  enableFilePartials: true, // Make sure this is true
  partialExt: '.html', // Check file extension
});

// Option 2: Use inline partials
const templatePlugin = new TemplatePlugin({
  partials: {
    header: '<header><h1>{{title}}</h1></header>',
  },
});
```

#### 3. Helper Not Working

```html
<!-- {{ formatPrice product.price }} returns nothing -->
```

**Solution:**

```typescript
// Make sure helper is registered
const templatePlugin = new TemplatePlugin({
  helpers: {
    formatPrice: (value: unknown) => {
      console.log('Helper called with:', value); // Debug log
      return `$${Number(value || 0).toFixed(2)}`;
    },
  },
});

// Or register after creation
templatePlugin.engine.registerHelper('formatPrice', value => {
  return `$${Number(value || 0).toFixed(2)}`;
});
```

#### 4. Layout Not Applied

```typescript
// Layout content not wrapping page content
await ctx.render('page.html', data, { layout: 'main.html' });
```

**Solutions:**

```html
<!-- Ensure layout has body placeholder -->
<!DOCTYPE html>
<html>
  <body>
    <!-- Must have one of these: -->
    {{{body}}}
    <!-- Preferred - unescaped -->
    {{body}}
    <!-- Also works - but escaped -->
  </body>
</html>
```

### Debug Mode

```typescript
const templatePlugin = new TemplatePlugin({
  cache: false, // Disable cache during development
  helpers: {
    debug: (value: unknown) => {
      console.log('Debug helper:', value);
      return {
        __safe: true,
        value: `<pre>${JSON.stringify(value, null, 2)}</pre>`,
      };
    },
  },
});

// Use in templates for debugging
// {{ debug userData }}
```

## 📊 Performance Optimization

### 1. Enable Caching in Production

```typescript
const templatePlugin = new TemplatePlugin({
  cache: process.env.NODE_ENV === 'production',
  viewsDir: './views',
});
```

### 2. Precompile Templates

```typescript
// Preload commonly used templates
const popularTemplates = ['home.html', 'user-card.html', 'product-list.html'];

for (const template of popularTemplates) {
  await templatePlugin.engine.renderFile(
    path.join('./views', template),
    {} // Empty data just to compile
  );
}
```

### 3. Optimize Helper Functions

```typescript
// ❌ SLOW - Creates new formatter each time
helpers: {
  formatDate: date => new Intl.DateTimeFormat('en-US').format(date);
}

// ✅ FAST - Reuse formatter instance
const dateFormatter = new Intl.DateTimeFormat('en-US');
helpers: {
  formatDate: date => dateFormatter.format(date);
}
```

## 🧪 Testing Templates

### Unit Testing Helpers

```typescript
import { TemplatePlugin } from '@/plugins/template/template.plugin';

describe('Template Helpers', () => {
  let plugin: TemplatePlugin;

  beforeEach(() => {
    plugin = new TemplatePlugin({
      helpers: {
        formatPrice: value => `$${Number(value).toFixed(2)}`,
      },
    });
  });

  it('should format prices correctly', async () => {
    const result = await plugin.engine.renderString('{{ formatPrice price }}', {
      price: 19.99,
    });

    expect(result).toBe('$19.99');
  });
});
```

### Integration Testing

```typescript
import request from 'supertest';
import { createApp } from '@/index';
import { TemplatePlugin } from '@/plugins/template/template.plugin';

describe('Template Integration', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
    new TemplatePlugin({
      viewsDir: path.join(__dirname, 'fixtures/views'),
    }).install(app);

    app.get('/test', async ctx => {
      await ctx.render('test.html', { message: 'Hello World' });
    });
  });

  it('should render template correctly', async () => {
    const response = await request(app.callback())
      .get('/test')
      .expect(200)
      .expect('Content-Type', /text\/html/);

    expect(response.text).toContain('Hello World');
  });
});
```

## 📚 Migration Guide

### From Handlebars

```javascript
// Handlebars
{{#if user}}
  {{#with user}}
    <h1>{{name}}</h1>
    {{#each hobbies}}
      <li>{{this}}</li>
    {{/each}}
  {{/with}}
{{/if}}

// NextRush Template Plugin - Same syntax! ✅
{{#if user}}
  {{#with user}}
    <h1>{{name}}</h1>
    {{#each hobbies}}
      <li>{{this}}</li>
    {{/each}}
  {{/with}}
{{/if}}
```

### From EJS

```html
<!-- EJS -->
<% if (user.isLoggedIn) { %>
<h1>Welcome, <%= user.name %>!</h1>
<% users.forEach(function(user, index) { %>
<div><%= index %>: <%= user.name %></div>
<% }); %> <% } %>

<!-- NextRush Template Plugin -->
{{#if user.isLoggedIn}}
<h1>Welcome, {{user.name}}!</h1>
{{#each users}}
<div>{{@index}}: {{name}}</div>
{{/each}} {{/if}}
```

---

## 🎉 Conclusion

The NextRush v2 Template Plugin provides everything you need for modern, secure, and performant HTML templating:

- ✅ **Beginner-friendly** with familiar syntax
- ✅ **Enterprise-ready** with security and performance features
- ✅ **Highly extensible** with custom helpers and partials
- ✅ **Type-safe** with full TypeScript support
- ✅ **Production-tested** with comprehensive caching

Start with the basic examples and gradually explore advanced features like custom helpers, layouts, and performance optimizations. The plugin grows with your application needs!

**Happy templating!** 🚀
