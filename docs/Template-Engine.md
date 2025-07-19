# 🎭 NextRush Template Engine Guide

## 📚 Table of Contents

- [📖 Introduction](#-introduction)
- [🔧 Public APIs](#-public-apis)
- [💻 Usage Examples](#-usage-examples)
- [⚙️ Configuration Options](#️-configuration-options)
- [📝 Notes](#-notes)

## 📖 Introduction

NextRush provides a **powerful, flexible template engine** that supports multiple syntax styles including Mustache, Handlebars-like expressions, and modern component-based templates. The template system offers streaming rendering, intelligent caching, and a rich ecosystem of helpers and filters.

## ✨ Key Features

- **🎨 Multi-Syntax Support**: Mustache, Handlebars-like, JSX-style expressions
- **⚡ Streaming Rendering**: High-performance output streaming
- **🧩 Component System**: Reusable components with slots and props
- **📁 Layout Inheritance**: Flexible layout system with nesting
- **💾 Smart Caching**: Template compilation caching with TTL
- **🔧 Custom Helpers & Filters**: Extensible helper system
- **🌐 Internationalization**: Built-in i18n support
- **📝 Frontmatter Support**: YAML metadata in templates
- **🎯 Path Aliases**: Smart template resolution
- **🧪 Testing Utilities**: Built-in template testing tools

---

## 🚀 Quick Start

### Basic Template Rendering

```typescript
import { NextRushApp } from 'nextrush';

const app = new NextRushApp();

// 📁 Set views directory
app.setViews('./views');

// 🎨 Render template
app.get('/profile/:id', (req, res) => {
  const user = {
    id: req.params.id,
    name: 'John Doe',
    email: 'john@example.com',
    isActive: true,
    posts: ['Post 1', 'Post 2', 'Post 3'],
  };

  res.render('profile.html', { user });
});

app.listen(3000);
```

### Express.js Compatibility

```typescript
// 📦 Works exactly like Express.js
app.set('view engine', 'html');
app.set('views', './views');

// 🔄 Direct migration from Express
app.get('/', (req, res) => {
  res.render('index', { title: 'Home' });
});
```

---

## 🎨 Template Syntax

### Mustache-Style Variables

```html
<!-- views/profile.html -->
<!DOCTYPE html>
<html>
  <head>
    <title>{{user.name}} - Profile</title>
  </head>
  <body>
    <h1>Welcome, {{user.name}}!</h1>
    <p>Email: {{user.email}}</p>
    <p>ID: {{user.id}}</p>

    <!-- 🔒 Escaped content (safe) -->
    <p>Bio: {{user.bio}}</p>

    <!-- ⚠️ Unescaped content (use with caution) -->
    <div>{{{user.htmlContent}}}</div>
  </body>
</html>
```

### Conditionals

```html
<!-- 🎯 Simple conditionals -->
{{#if user.isActive}}
<span class="badge active">Online</span>
{{else}}
<span class="badge inactive">Offline</span>
{{/if}}

<!-- 🔗 Complex conditions -->
{{#if user.isAdmin}}
<button class="admin-panel">Admin Panel</button>
{{else if user.isModerator}}
<button class="mod-panel">Moderator Panel</button>
{{else}}
<button class="user-panel">User Dashboard</button>
{{/if}}

<!-- 🚫 Unless (opposite of if) -->
{{#unless user.isBlocked}}
<div class="user-content">{{user.content}}</div>
{{/unless}}
```

### Loops and Iterations

```html
<!-- 📋 Simple loop -->
<ul class="posts">
  {{#each user.posts}}
  <li>{{this}}</li>
  {{/each}}
</ul>

<!-- 🎯 Loop with index -->
<ol class="numbered-posts">
  {{#each user.posts}}
  <li data-index="{{@index}}">
    <span class="number">{{@index + 1}}.</span>
    {{this}}
  </li>
  {{/each}}
</ol>

<!-- 🔄 Object iteration -->
<dl class="user-info">
  {{#each user.profile}}
  <dt>{{@key}}</dt>
  <dd>{{this}}</dd>
  {{/each}}
</dl>

<!-- 📊 Advanced iteration with conditions -->
{{#each products}} {{#if this.featured}}
<div class="featured-product">
  <h3>{{name}}</h3>
  <p class="price">${{price}}</p>
  <span class="badge">Featured</span>
</div>
{{/if}} {{/each}}
```

### Nested Data Access

```html
<!-- 🌳 Nested object properties -->
<h2>{{user.profile.displayName}}</h2>
<p>
  Location: {{user.profile.location.city}}, {{user.profile.location.country}}
</p>

<!-- 📚 Array access -->
<p>Latest post: {{user.posts.0}}</p>
<p>Second post: {{user.posts.1}}</p>

<!-- 🏗️ Complex nested structures -->
{{#each user.projects}}
<div class="project">
  <h3>{{title}}</h3>
  <p>{{description}}</p>

  {{#each technologies}}
  <span class="tech-tag">{{name}} ({{version}})</span>
  {{/each}}
</div>
{{/each}}
```

---

## 🧩 Advanced Features

### Partials (Template Includes)

```html
<!-- views/partials/header.html -->
<header>
  <nav>
    <a href="/">Home</a>
    <a href="/about">About</a>
    {{#if user}}
    <a href="/profile">Profile</a>
    <a href="/logout">Logout</a>
    {{else}}
    <a href="/login">Login</a>
    {{/if}}
  </nav>
</header>

<!-- views/main.html -->
<!DOCTYPE html>
<html>
  <head>
    <title>{{title}}</title>
  </head>
  <body>
    {{> header}}

    <main>
      <h1>{{pageTitle}}</h1>
      {{{content}}}
    </main>

    {{> footer}}
  </body>
</html>
```

### Custom Helpers

```typescript
// 🔧 Register custom template helpers
app.setViews('./views', {
  helpers: {
    // 📅 Format date helper
    formatDate: (date) => {
      return new Date(date).toLocaleDateString();
    },

    // 🔤 Uppercase helper
    upper: (text) => {
      return text.toUpperCase();
    },

    // 🧮 Math operations
    add: (a, b) => a + b,
    multiply: (a, b) => a * b,

    // ✂️ String operations
    truncate: (text, length = 50) => {
      return text.length > length ? text.substring(0, length) + '...' : text;
    },

    // 🎯 Conditional helpers
    eq: (a, b) => a === b,
    gt: (a, b) => a > b,
    lt: (a, b) => a < b,

    // 🐛 JSON stringify for debugging
    json: (obj) => JSON.stringify(obj, null, 2),
  },
});

// 🎨 Use helpers in templates
app.get('/posts', (req, res) => {
  const posts = [
    {
      title: 'First Post',
      content: 'This is a very long post content that needs to be truncated...',
      createdAt: '2024-01-15',
      views: 150,
    },
  ];

  res.render('posts.html', { posts });
});
```

```html
<!-- views/posts.html -->
<div class="posts">
  {{#each posts}}
  <article class="post">
    <h2>{{upper title}}</h2>
    <p>{{truncate content 100}}</p>
    <div class="meta">
      <span>Published: {{formatDate createdAt}}</span>
      <span>Views: {{views}}</span>

      {{#if (gt views 100)}}
      <span class="badge popular">Popular</span>
      {{/if}}
    </div>

    <!-- 🐛 Debug info (development only) -->
    {{#if @root.debug}}
    <pre>{{json this}}</pre>
    {{/if}}
  </article>
  {{/each}}
</div>
```

### Layouts and Inheritance

```typescript
// 🏗️ Set default layout
app.setViews('./views', {
  layout: 'layouts/main.html',
});

// 🎯 Render with custom layout
app.get('/admin', (req, res) => {
  res.render(
    'admin/dashboard.html',
    { title: 'Admin Dashboard' },
    { layout: 'layouts/admin.html' }
  );
});

// 🚫 Render without layout
app.get('/api/template', (req, res) => {
  res.render('email/welcome.html', { user: req.user }, { layout: false });
});
```

```html
<!-- views/layouts/main.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>{{title}} - My Site</title>
    <link rel="stylesheet" href="/assets/style.css" />
    {{#if additionalCSS}} {{#each additionalCSS}}
    <link rel="stylesheet" href="{{this}}" />
    {{/each}} {{/if}}
  </head>
  <body>
    {{> header}}

    <main class="content">{{{body}}}</main>

    {{> footer}}

    <script src="/assets/app.js"></script>
    {{#if additionalJS}} {{#each additionalJS}}
    <script src="{{this}}"></script>
    {{/each}} {{/if}}
  </body>
</html>

<!-- views/admin/dashboard.html -->
<div class="admin-dashboard">
  <h1>Admin Dashboard</h1>
  <div class="stats">
    <div class="stat">
      <h3>{{stats.users}}</h3>
      <p>Total Users</p>
    </div>
    <div class="stat">
      <h3>{{stats.posts}}</h3>
      <p>Total Posts</p>
    </div>
  </div>
</div>
```

### Template Compilation and Caching

```typescript
// ⚙️ Configure template engine
app.setViews('./views', {
  cache: process.env.NODE_ENV === 'production', // Cache in production
  extension: '.html', // Default extension
  encoding: 'utf8', // File encoding

  // 👀 Watch for changes in development
  watch: process.env.NODE_ENV === 'development',

  // 🔨 Compilation options
  compile: {
    removeComments: true, // Remove HTML comments
    minifyHTML: process.env.NODE_ENV === 'production',
    preserveWhitespace: false, // Remove extra whitespace
  },

  // 🚨 Error handling
  strict: true, // Throw errors for undefined variables

  // 🎭 Custom delimiters
  delimiters: {
    start: '{{',
    end: '}}',
  },
});
```

---

## 📁 Template Organization

### Directory Structure

```text
views/
├── layouts/           # Layout templates
│   ├── main.html
│   ├── admin.html
│   └── email.html
├── partials/          # Reusable components
│   ├── header.html
│   ├── footer.html
│   ├── sidebar.html
│   └── pagination.html
├── components/        # Complex components
│   ├── user-card.html
│   ├── product-grid.html
│   └── comment-thread.html
├── pages/             # Page templates
│   ├── home.html
│   ├── about.html
│   └── contact.html
├── user/              # User-related templates
│   ├── profile.html
│   ├── settings.html
│   └── dashboard.html
├── admin/             # Admin templates
│   └── dashboard.html
├── errors/            # Error pages
│   ├── 404.html
│   ├── 500.html
│   └── maintenance.html
└── email/             # Email templates
    ├── welcome.html
    ├── reset-password.html
    └── notification.html
```

### Template Inheritance Chain

```typescript
// 🏗️ Complex template rendering with data preprocessing
app.get('/user/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).render('errors/404.html', {
        title: 'User Not Found',
        message: 'The requested user does not exist',
      });
    }

    // 📊 Prepare template data
    const templateData = {
      title: `${user.name} - Profile`,
      user: {
        ...user,
        avatarUrl: user.avatar || '/assets/default-avatar.png',
        joinedDate: new Date(user.createdAt).toLocaleDateString(),
        postCount: user.posts.length,
        isOwnProfile: req.user && req.user.id === user.id,
      },
      posts: user.posts.map((post) => ({
        ...post,
        excerpt: post.content.substring(0, 150) + '...',
        publishedDate: new Date(post.createdAt).toLocaleDateString(),
      })),
      meta: {
        description: `${user.name}'s profile page`,
        keywords: ['profile', 'user', user.name],
      },
      additionalCSS: ['/assets/profile.css'],
      additionalJS: ['/assets/profile.js'],
    };

    res.render('user/profile.html', templateData);
  } catch (error) {
    res.status(500).render('errors/500.html', {
      title: 'Server Error',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});
```

---

## ⚡ Performance Optimization

### Template Precompilation

```typescript
// 🏭 Precompile templates for production
if (process.env.NODE_ENV === 'production') {
  app.precompileTemplates('./views', {
    outputDir: './compiled-templates',
    minify: true,
    gzip: true,
  });

  // 📦 Use precompiled templates
  app.setViews('./compiled-templates', {
    precompiled: true,
    cache: true,
  });
}
```

### Template Caching Strategy

```typescript
// 💾 Custom template caching
const templateCache = new Map();

app.setViews('./views', {
  cache: true,
  cacheSize: 100, // Max cached templates
  cacheTTL: 3600000, // 1 hour TTL

  // 🔧 Custom cache implementation
  customCache: {
    get: (key) => templateCache.get(key),
    set: (key, value, ttl) => {
      templateCache.set(key, {
        value,
        expires: Date.now() + ttl,
      });
    },
    has: (key) => {
      const item = templateCache.get(key);
      if (item && item.expires > Date.now()) {
        return true;
      }
      templateCache.delete(key);
      return false;
    },
  },
});
```

### Streaming Templates

```typescript
// 🌊 Stream large templates for better performance
app.get('/large-page', (req, res) => {
  res.setHeader('Content-Type', 'text/html');

  // 📡 Stream template directly to response
  res.renderStream('large-template.html', {
    items: largeDataSet,
    user: req.user,
  });
});

// 🎯 Custom streaming with progress
app.get('/report', async (req, res) => {
  const reportData = await generateReportData();

  const templateStream = app.createTemplateStream('report.html', {
    report: reportData,
    generatedAt: new Date(),
  });

  templateStream.pipe(res);
});
```

---

## 🚨 Error Handling

### Template Error Management

```typescript
// 🛡️ Global template error handler
app.setViews('./views', {
  errorHandler: (error, templatePath, data) => {
    console.error(`Template error in ${templatePath}:`, error);

    if (process.env.NODE_ENV === 'development') {
      return `
        <div style="background: #f00; color: #fff; padding: 20px;">
          <h2>Template Error</h2>
          <p><strong>File:</strong> ${templatePath}</p>
          <p><strong>Error:</strong> ${error.message}</p>
          <pre>${error.stack}</pre>
        </div>
      `;
    }

    return '<div>Template rendering error</div>';
  },
});

// 🎯 Specific error handling
app.use((err, req, res, next) => {
  if (err.name === 'TemplateError') {
    res.status(500).render(
      'errors/template-error.html',
      {
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : null,
      },
      {
        layout: 'layouts/error.html',
      }
    );
  } else {
    next(err);
  }
});
```

---

## 🧪 Testing Templates

### Template Testing Utilities

```typescript
// 🧪 Test template rendering
import { NextRushApp } from 'nextrush';

describe('Template Engine', () => {
  let app;

  beforeEach(() => {
    app = new NextRushApp();
    app.setViews('./test-views');
  });

  test('renders simple template', async () => {
    // 📝 Create test template
    const testTemplate = '<h1>{{title}}</h1><p>{{message}}</p>';

    const result = await app.renderTemplate('test.html', {
      title: 'Test Title',
      message: 'Test Message',
    });

    expect(result).toContain('<h1>Test Title</h1>');
    expect(result).toContain('<p>Test Message</p>');
  });

  test('handles conditionals', async () => {
    const template = '{{#if showContent}}<div>{{content}}</div>{{/if}}';

    const result = await app.renderTemplate('conditional.html', {
      showContent: true,
      content: 'Hello World',
    });

    expect(result).toContain('<div>Hello World</div>');
  });

  test('loops through arrays', async () => {
    const template = '{{#each items}}<li>{{this}}</li>{{/each}}';

    const result = await app.renderTemplate('loop.html', {
      items: ['Item 1', 'Item 2', 'Item 3'],
    });

    expect(result).toContain('<li>Item 1</li>');
    expect(result).toContain('<li>Item 2</li>');
    expect(result).toContain('<li>Item 3</li>');
  });
});
```

### Template Debugging

```typescript
// 🐛 Debug template rendering
app.setViews('./views', {
  debug: process.env.NODE_ENV === 'development',

  // 📊 Template performance monitoring
  onRender: (templatePath, data, duration) => {
    console.log(`🎭 Rendered ${templatePath} in ${duration}ms`);
  },

  // 🔍 Variable resolution tracking
  onVariableAccess: (path, value) => {
    console.log(`📍 Accessed ${path}:`, value);
  },
});

// 🎯 Template-specific debugging
app.get('/debug-template', (req, res) => {
  res.render('debug.html', {
    debug: true,
    user: req.user,
    timestamp: Date.now(),
  });
});
```

---

## 🔧 Configuration Reference

### Complete Template Options

```typescript
interface TemplateOptions {
  // 📁 Directories
  views?: string; // Views directory (default: './views')
  layouts?: string; // Layouts directory
  partials?: string; // Partials directory
  components?: string; // Components directory

  // 💾 Caching
  cache?: boolean; // Enable template caching
  cacheSize?: number; // Max cached templates
  cacheTTL?: number; // Cache time-to-live

  // 🎨 Rendering
  engine?: 'mustache' | 'handlebars' | 'jsx' | 'auto';
  encoding?: BufferEncoding; // File encoding (default: 'utf8')
  defaultExtension?: string; // Default file extension

  // 🏗️ Layout
  layout?: string; // Default layout file

  // 🔧 Processing
  minify?: boolean; // Minify HTML output
  removeComments?: boolean; // Remove HTML comments
  preserveWhitespace?: boolean; // Preserve whitespace

  // 🌐 Internationalization
  i18n?: I18nConfig; // i18n configuration

  // 👀 Development
  watch?: boolean; // Watch files for changes
  debug?: boolean; // Enable debug mode
  strict?: boolean; // Strict variable checking

  // 🔧 Extensions
  helpers?: Record<string, Function>; // Custom helpers
  filters?: Record<string, Function>; // Custom filters
  globals?: Record<string, any>; // Global variables

  // ⚡ Performance
  streaming?: boolean; // Enable streaming
  precompiled?: boolean; // Use precompiled templates

  // 🎭 Syntax
  delimiters?: {
    // Custom delimiters
    start: string;
    end: string;
  };
}
```

### Built-in Helpers Reference

```typescript
// 📅 Date & Time Helpers
formatDate(date, format?)          // Format date string
timeAgo(date)                      // Relative time display
now()                              // Current timestamp

// 🔤 String Helpers
upper(str)                         // Uppercase string
lower(str)                         // Lowercase string
capitalize(str)                    // Capitalize first letter
truncate(str, length, suffix?)     // Truncate string
slugify(str)                       // Create URL slug
trim(str)                          // Trim whitespace
replace(str, search, replacement)  // Replace text

// 🧮 Math Helpers
add(a, b)                          // Addition
subtract(a, b)                     // Subtraction
multiply(a, b)                     // Multiplication
divide(a, b)                       // Division
round(num, precision?)             // Round number
abs(num)                           // Absolute value

// 📚 Array Helpers
length(arr)                        // Array length
first(arr)                         // First element
last(arr)                          // Last element
slice(arr, start, end?)            // Array slice
sort(arr, key?)                    // Sort array
reverse(arr)                       // Reverse array
join(arr, separator?)              // Join array
unique(arr)                        // Remove duplicates
filter(arr, key, value?)           // Filter array
map(arr, key)                      // Map array values

// 🎯 Object Helpers
keys(obj)                          // Object keys
values(obj)                        // Object values
has(obj, key)                      // Check if has property

// 🎨 Utility Helpers
json(obj, indent?)                 // JSON stringify
default(value, defaultValue)       // Default value
debug(value)                       // Debug output
typeof(value)                      // Type check

// 🌐 URL Helpers
urlEncode(str)                     // URL encode
urlDecode(str)                     // URL decode

// 🎯 Conditional Helpers
eq(a, b)                           // Equal comparison
gt(a, b)                           // Greater than
lt(a, b)                           // Less than
gte(a, b)                          // Greater than or equal
lte(a, b)                          // Less than or equal
unless(condition, content)         // Inverse if
when(condition, truthy, falsy?)    // Ternary operator

// 🌍 i18n Helpers
t(key, locale?)                    // Translate
tn(key, count, locale?)            // Plural translate
```

---

## 🎯 Best Practices

### ✅ Template Organization

1. **📁 Use consistent directory structure** for different template types
2. **🧩 Create reusable partials** for common UI components
3. **🏗️ Implement layout inheritance** for consistent page structure
4. **🎯 Separate business logic** from template logic
5. **📝 Use meaningful template names** and directory organization

### ✅ Performance Optimization

1. **💾 Enable caching in production** with appropriate TTL settings
2. **🏭 Precompile templates** for production deployments
3. **🌊 Use streaming** for large templates and data sets
4. **🎯 Minimize template complexity** and nested loops
5. **📊 Monitor template rendering performance** in production

### ✅ Security Best Practices

1. **🔒 Always escape user input** by default (use `{{}}` not `{{{}}}`)
2. **🛡️ Validate template data** before rendering
3. **🚫 Never render user-provided templates** directly
4. **🔍 Sanitize HTML content** when using unescaped output
5. **📊 Implement proper error handling** to prevent information leakage

---

## 🚨 Troubleshooting

### Common Issues

#### Template Not Found

```typescript
// ❌ Problem: Template file not found
app.get('/page', (req, res) => {
  res.render('non-existent.html', data); // 👈 File doesn't exist
});

// ✅ Solution: Check file path and extension
app.get('/page', (req, res) => {
  res.render('pages/existing.html', data); // 👈 Correct path
});
```

#### Variable Not Displaying

```html
<!-- ❌ Problem: Variable undefined -->
<h1>{{user.fullName}}</h1>
<!-- 👈 Property doesn't exist -->

<!-- ✅ Solution: Use default values or check existence -->
<h1>{{user.fullName || user.name}}</h1>
<h1>{{default user.fullName "Guest User"}}</h1>
```

#### Layout Not Applied

```typescript
// ❌ Problem: Layout not configured
res.render('page.html', data); // 👈 No layout specified

// ✅ Solution: Set default layout or specify explicitly
app.setViews('./views', { layout: 'layouts/main.html' });
// OR
res.render('page.html', data, { layout: 'layouts/custom.html' });
```

---

## 🔮 What's Next?

Explore these related NextRush features:

- **[🧩 Component System](./Components.md)** - Advanced component development
- **[🌐 Internationalization](./I18n.md)** - Multi-language support
- **[📊 Performance Monitoring](./METRICS-MONITORING.md)** - Template performance tracking
- **[🔌 Plugin Development](./Plugins.md)** - Creating template plugins
- **[🛡️ Security Guide](./SECURITY.md)** - Template security best practices

---

> **NextRush Template Engine - Powerful, flexible, and developer-friendly templating! 🎭✨**
