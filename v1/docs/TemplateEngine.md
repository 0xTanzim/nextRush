# Template Engine

## Introduction

The NextRush framework provides a **super simple** template engine with amazing developer experience! Our philosophy: **one-line setup, zero configuration needed**. The template system supports multiple syntax styles including Mustache, Handlebars-like expressions, and simple variable interpolation, but hides all complexity behind clean APIs.

## 🚀 Quick Start (Super Simple!)

### One-Line Setup

```typescript
import { createApp, quickTemplate } from 'nextrush';

const app = createApp();

// ONE LINE SETUP! 🎉
app.setTemplateEngine(quickTemplate());

app.get('/', (req, res) => {
  res.render('Hello {{name}}!', { name: 'World' });
});
```

### With Custom Helpers

```typescript
import { createApp, quickTemplate } from 'nextrush';

const app = createApp();

// Add custom helpers easily
app.setTemplateEngine(
  quickTemplate({
    greet: (name: string) => `Hello ${name}!`,
    bold: (text: string) => `<strong>${text}</strong>`,
  })
);

app.get('/custom', (req, res) => {
  res.render('{{greet name}} {{bold "Welcome!"}}', { name: 'Developer' });
});
```

### Web Template (Pre-loaded Helpers)

```typescript
import { createApp, webTemplate } from 'nextrush';

const app = createApp();

// Web template has common helpers built-in
app.setTemplateEngine(webTemplate());

app.get('/web', (req, res) => {
  res.render(
    `
    <h1>{{user.name}}</h1>
    <p>{{stripHTML user.bio}}</p>
    <pre>{{json data}}</pre>
  `,
    {
      user: { name: 'John', bio: 'A <script>dev</script>' },
      data: { status: 'success' },
    }
  );
});
```

## Simple Template Functions

### Quick Setup Functions

| Function           | Description                             | Use Case              |
| ------------------ | --------------------------------------- | --------------------- |
| `quickTemplate()`  | One-line setup with built-in helpers    | Most common use case  |
| `webTemplate()`    | Pre-loaded with web development helpers | Web apps, APIs        |
| `createTemplate()` | Customizable setup (still simple!)      | Custom configurations |

### Built-in Helpers (Always Available)

| Helper       | Example                  | Output          |
| ------------ | ------------------------ | --------------- |
| `formatDate` | `{{formatDate date}}`    | `12/25/2024`    |
| `currency`   | `{{currency 29.99}}`     | `$29.99`        |
| `pluralize`  | `{{pluralize 2 "item"}}` | `items`         |
| `uppercase`  | `{{uppercase "hello"}}`  | `HELLO`         |
| `lowercase`  | `{{lowercase "HELLO"}}`  | `hello`         |
| `timeAgo`    | `{{timeAgo date}}`       | `5 minutes ago` |
| `truncate`   | `{{truncate text 20}}`   | `Short text...` |
| `capitalize` | `{{capitalize "hello"}}` | `Hello`         |

### Web Template Helpers

| Helper      | Example                | Description            |
| ----------- | ---------------------- | ---------------------- |
| `json`      | `{{json data}}`        | Pretty JSON output     |
| `truncate`  | `{{truncate text 50}}` | Truncate with ellipsis |
| `stripHTML` | `{{stripHTML html}}`   | Remove HTML tags       |
| `urlEncode` | `{{urlEncode url}}`    | URL encode string      |

## Public APIs

### Simple Template Options

```typescript
interface SimpleTemplateOptions {
  cache?: boolean; // Enable caching (default: true)
  helpers?: object; // Custom helpers
  debug?: boolean; // Debug mode (default: dev mode)
}
```

### Application Template Methods

| Method                      | Signature                                              | Description            |
| --------------------------- | ------------------------------------------------------ | ---------------------- |
| `setTemplateEngine(engine)` | `(engine: TemplateEngine) => Application`              | Set template engine    |
| `render(template, data?)`   | `(template: string, data?: object) => Promise<string>` | Render template string |

### Response Template Methods

| Method                | Signature                               | Description                       |
| --------------------- | --------------------------------------- | --------------------------------- |
| `render(view, data?)` | `(view: string, data?: object) => void` | Render and send template response |

## Advanced Usage (When You Need It)

### Custom Template Engine

```typescript
import { createTemplate } from 'nextrush';

const advancedTemplate = createTemplate({
  cache: true,
  debug: process.env.NODE_ENV !== 'production',
  helpers: {
    formatCurrency: (amount: number, currency = 'USD') =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(amount),

    timeAgo: (date: Date) => {
      const diff = Date.now() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      return minutes < 60
        ? `${minutes}m ago`
        : `${Math.floor(minutes / 60)}h ago`;
    },
  },
});

app.setTemplateEngine(advancedTemplate);
```

## Legacy API (For Complex Setups)

> ⚠️ **Note**: Only use this if you need advanced customization. For 99% of use cases, use the simple functions above!

### Built-in Template Classes

| Class                      | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| `UltimateTemplateParser`   | Multi-syntax template parser (Handlebars, JSX, etc.) |
| `UltimateTemplateRenderer` | High-performance template rendering engine           |
| `TemplateHelperManager`    | Helper and filter management system                  |

### Complex Setup Example

```typescript
// ❌ DON'T DO THIS (too complex!)
const templateEngine = {
  async render(
    templateContent: string,
    data: Record<string, any>
  ): Promise<string> {
    const validation = validateTemplateSyntax(templateContent);
    if (!validation.valid) {
      throw new Error(`Template syntax error: ${validation.errors.join(', ')}`);
    }

    const parser = new UltimateTemplateParser(templateContent, {
      cache: true,
      helpers: {
        formatDate: (date: Date) => date.toLocaleDateString(),
        currency: (amount: number) => `$${amount.toFixed(2)}`,
      },
    });

    const parseResult = parser.parse();
    const renderer = new UltimateTemplateRenderer({
      cache: true,
      debug: process.env.NODE_ENV !== 'production',
    });

    return renderer.render(parseResult.nodes, data);
  },
};

// ✅ DO THIS INSTEAD (super simple!)
app.setTemplateEngine(quickTemplate());
```

## Template File Structure

```html
<!-- views/hello.html -->
--- title: "{{title}}" layout: main ---
<!DOCTYPE html>
<html>
  <head>
    <title>{{title}}</title>
  </head>
  <body>
    <h1>Hello, {{name}}!</h1>
    <p>Welcome to NextRush Ultimate Template Engine.</p>

    {{#if features}}
    <h2>Features:</h2>
    <ul>
      {{#each features}}
      <li>{{this}}</li>
      {{/each}}
    </ul>
    {{/if}}
  </body>
</html>
```

### Advanced Template Features

```typescript
import { createApp } from 'nextrush';
import {
  UltimateTemplateRenderer,
  UltimateTemplateParser,
  TemplateHelperManager,
} from 'nextrush/template';

const app = createApp();

// Configure advanced template engine with helpers
const templateOptions = {
  cache: true,
  views: './views',
  partials: './views/partials',
  components: './views/components',
  helpers: {
    formatDate: (date: Date) => date.toLocaleDateString(),
    uppercase: (str: string) => str.toUpperCase(),
  },
};

const templateEngine = {
  async render(
    templateContent: string,
    data: Record<string, any>
  ): Promise<string> {
    const parser = new UltimateTemplateParser(templateContent, templateOptions);
    const parseResult = parser.parse();
    const renderer = new UltimateTemplateRenderer(templateOptions);
    return renderer.render(parseResult.nodes, data);
  },
};

app.setTemplateEngine(templateEngine);

// Render with Mustache syntax
app.get('/user/:id', async (req, res) => {
  const user = await getUserById(req.params.id);

  res.render('user-profile.html', {
    user: {
      name: user.name,
      email: user.email,
      isAdmin: user.role === 'admin',
    },
    posts: user.posts,
    pageTitle: `${user.name}'s Profile`,
  });
});

app.listen(3000);
```

### Mustache Template Example

```html
<!-- templates/user-profile.html -->
<!DOCTYPE html>
<html>
  <head>
    <title>{{pageTitle}}</title>
  </head>
  <body>
    <header>
      <h1>{{user.name}}</h1>
      <p>Email: {{user.email}}</p>
      {{#user.isAdmin}}
      <span class="badge">Administrator</span>
      {{/user.isAdmin}}
    </header>

    <section>
      <h2>Posts</h2>
      {{#posts}}
      <article>
        <h3>{{title}}</h3>
        <p>{{excerpt}}</p>
        <time>{{publishedAt}}</time>
      </article>
      {{/posts}} {{^posts}}
      <p>No posts available.</p>
      {{/posts}}
    </section>
  </body>
</html>
```

### Custom Template Engine Integration

```typescript
import { createApp } from 'nextrush';
import {
  UltimateTemplateRenderer,
  UltimateTemplateParser,
  TemplateHelperManager,
  TemplateOptions,
} from 'nextrush/template';

// Create custom template engine wrapper
class NextRushTemplateEngine {
  private parser: UltimateTemplateParser;
  private renderer: UltimateTemplateRenderer;

  constructor(options: TemplateOptions = {}) {
    this.renderer = new UltimateTemplateRenderer({
      cache: true,
      helpers: {
        formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
        timeAgo: (date: Date) => {
          const now = new Date();
          const diff = now.getTime() - date.getTime();
          const minutes = Math.floor(diff / 60000);
          return minutes < 60
            ? `${minutes}m ago`
            : `${Math.floor(minutes / 60)}h ago`;
        },
      },
      ...options,
    });
  }

  async render(
    template: string,
    data: Record<string, any> = {}
  ): Promise<string> {
    this.parser = new UltimateTemplateParser(template);
    const parseResult = this.parser.parse();
    return this.renderer.render(parseResult.nodes, data);
  }

  async renderFile(
    filePath: string,
    data: Record<string, any> = {}
  ): Promise<string> {
    const fs = await import('fs/promises');
    const template = await fs.readFile(filePath, 'utf-8');
    return this.render(template, data);
  }
}

const app = createApp();

// Use NextRush template engine
app.setViews('./views');
app.setTemplateEngine(
  new NextRushTemplateEngine({
    cache: process.env.NODE_ENV === 'production',
    views: './views',
    partials: './views/partials',
  })
);

// Render with enhanced syntax
app.get('/profile', (req, res) => {
  res.render('profile.html', {
    user: {
      name: 'John Doe',
      profile: {
        bio: 'Web developer',
        location: 'New York',
      },
    },
  });
});

app.listen(3000);
```

### Advanced Template Rendering

```typescript
import { createApp } from 'nextrush';
import {
  UltimateTemplateRenderer,
  UltimateTemplateParser,
  testTemplateRender,
  validateTemplateSyntax,
} from 'nextrush/template';

const app = createApp();

app.setViews('./views');

// Setup template engine with advanced features
const templateEngine = {
  async render(
    templateContent: string,
    data: Record<string, any>
  ): Promise<string> {
    // Validate template syntax first
    const validation = validateTemplateSyntax(templateContent);
    if (!validation.valid) {
      throw new Error(`Template syntax error: ${validation.errors.join(', ')}`);
    }

    const parser = new UltimateTemplateParser(templateContent, {
      cache: true,
      helpers: {
        formatDate: (date: Date) => date.toLocaleDateString(),
        currency: (amount: number) => `$${amount.toFixed(2)}`,
        pluralize: (count: number, word: string) =>
          count === 1 ? word : word + 's',
      },
    });

    const parseResult = parser.parse();
    const renderer = new UltimateTemplateRenderer({
      cache: true,
      debug: process.env.NODE_ENV !== 'production',
    });

    return renderer.render(parseResult.nodes, data);
  },
};

app.setTemplateEngine(templateEngine);

// Complex data rendering with helpers
app.get('/dashboard', async (req, res) => {
  const user = req.user;
  const stats = await getDashboardStats(user.id);

  const templateData = {
    user: {
      name: user.name,
      avatar: user.avatar || '/assets/default-avatar.png',
    },
    stats: {
      totalPosts: stats.posts,
      totalViews: stats.views,
      totalLikes: stats.likes,
    },
    recentPosts: stats.recentPosts.map((post) => ({
      id: post.id,
      title: post.title,
      excerpt: post.content.substring(0, 100) + '...',
      publishedAt: new Date(post.createdAt),
      viewCount: post.views,
    })),
    hasRecentPosts: stats.recentPosts.length > 0,
    currentYear: new Date().getFullYear(),
  };

  res.render('dashboard.html', templateData);
});
```

### Template with Helpers Example

```html
<!-- views/dashboard.html -->
--- title: Dashboard layout: main ---
<div class="dashboard">
  <header>
    <img src="{{user.avatar}}" alt="{{user.name}}" />
    <h1>Welcome back, {{user.name}}!</h1>
  </header>

  <section class="stats">
    <div class="stat">
      <span class="number">{{stats.totalPosts}}</span>
      <span class="label">{{pluralize stats.totalPosts "Post"}}</span>
    </div>
    <div class="stat">
      <span class="number">{{stats.totalViews}}</span>
      <span class="label">Views</span>
    </div>
    <div class="stat">
      <span class="number">{{stats.totalLikes}}</span>
      <span class="label">{{pluralize stats.totalLikes "Like"}}</span>
    </div>
  </section>

  <section class="recent-posts">
    <h2>Recent Posts</h2>
    {{#if hasRecentPosts}} {{#each recentPosts}}
    <article>
      <h3>{{title}}</h3>
      <p>{{excerpt}}</p>
      <footer>
        <time>{{formatDate publishedAt}}</time>
        <span>{{viewCount}} views</span>
      </footer>
    </article>
    {{/each}} {{else}}
    <p>No recent posts to display.</p>
    {{/if}}
  </section>

  <footer>
    <p>&copy; {{currentYear}} NextRush Dashboard</p>
  </footer>
</div>
```

// Direct template rendering (without response)
app.get('/api/template/:name', async (req, res) => {
try {
const templateName = req.params.name;
const data = req.body;

    const html = await app.render(`${templateName}.html`, data);

    res.json({
      success: true,
      html: html,
      template: templateName,
    });

} catch (error) {
res.status(500).json({
success: false,
error: error.message,
});
}
});

app.listen(3000);

````

### Error Handling in Templates

```typescript
import { createApp } from 'nextrush';
import {
  UltimateTemplateRenderer,
  UltimateTemplateParser,
  validateTemplateSyntax
} from 'nextrush/template';

const app = createApp();

app.setViews('./views');

// Template engine with error handling
const templateEngine = {
  async render(templateContent: string, data: Record<string, any>): Promise<string> {
    try {
      // Validate template first
      const validation = validateTemplateSyntax(templateContent);
      if (!validation.valid) {
        throw new Error(`Template syntax errors: ${validation.errors.join(', ')}`);
      }

      const parser = new UltimateTemplateParser(templateContent, {
        debug: process.env.NODE_ENV !== 'production'
      });
      const parseResult = parser.parse();

      const renderer = new UltimateTemplateRenderer({
        debug: process.env.NODE_ENV !== 'production'
      });

      return renderer.render(parseResult.nodes, data);
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Template rendering failed');
      }
      throw error; // Show detailed error in development
    }
  }
};

app.setTemplateEngine(templateEngine);

// Template error handling
app.get('/content/:slug', async (req, res) => {
  try {
    const content = await getContentBySlug(req.params.slug);

    if (!content) {
      return res.render('errors/404.html', {
        title: 'Content Not Found',
        message: 'The requested content does not exist.',
        backUrl: '/',
      });
    }

    res.render('content.html', {
      content: {
        title: content.title,
        body: content.body,
        author: content.author,
        publishedAt: new Date(content.createdAt),
      },
      meta: {
        title: content.title,
        description: content.excerpt,
      },
    });
  } catch (error) {
    console.error('Template rendering error:', error);

    res.status(500).render('errors/500.html', {
      title: 'Server Error',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'An internal server error occurred.',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

app.listen(3000);
````

### Template Caching

```typescript
import { createApp } from 'nextrush';
import {
  UltimateTemplateRenderer,
  UltimateTemplateParser,
} from 'nextrush/template';

// Template engine with built-in caching
const templateEngine = {
  async render(
    templateContent: string,
    data: Record<string, any>
  ): Promise<string> {
    const parser = new UltimateTemplateParser(templateContent, {
      cache: process.env.NODE_ENV === 'production', // Enable caching in production
    });

    const parseResult = parser.parse();

    const renderer = new UltimateTemplateRenderer({
      cache: process.env.NODE_ENV === 'production', // Enable caching in production
      debug: process.env.NODE_ENV !== 'production',
    });

    return renderer.render(parseResult.nodes, data);
  },
};

const app = createApp();

// Use cached template engine
app.setViews('./views');
app.setTemplateEngine(templateEngine);

// Templates will be automatically cached in production
app.get('/cached-page', (req, res) => {
  res.render('page.html', {
    title: 'Cached Page',
    content: 'This template is cached in production for better performance.',
    timestamp: new Date().toISOString(),
  });
});

app.listen(3000);
```

## Configuration Options

### Basic Configuration

```typescript
// Simple template setup
app.setViews('./views');
app.setTemplateEngine(createTemplateEngine('simple'));
```

### Ultimate Template Engine Configuration

```typescript
import { createApp } from 'nextrush';
import {
  UltimateTemplateRenderer,
  UltimateTemplateParser,
  TemplateOptions,
} from 'nextrush/template';

const templateOptions: TemplateOptions = {
  cache: true,
  views: './templates',
  partials: './templates/partials',
  encoding: 'utf8',
  defaultExtension: '.html',
  helpers: {
    formatDate: (date: Date) => date.toLocaleDateString(),
    currency: (amount: number) => `$${amount.toFixed(2)}`,
  },
};

const templateEngine = {
  async render(
    templateContent: string,
    data: Record<string, any>
  ): Promise<string> {
    const parser = new UltimateTemplateParser(templateContent, templateOptions);
    const parseResult = parser.parse();
    const renderer = new UltimateTemplateRenderer(templateOptions);
    return renderer.render(parseResult.nodes, data);
  },
};

app.setViews('./templates');
app.setTemplateEngine(templateEngine);
```

### Custom Engine Configuration

```typescript
// Custom template engine with specific features
class AdvancedTemplateEngine implements TemplateEngine {
  private options: {
    escapeHtml: boolean;
    allowUnsafe: boolean;
    customDelimiters: { start: string; end: string };
  };

  constructor(options = {}) {
    this.options = {
      escapeHtml: true,
      allowUnsafe: false,
      customDelimiters: { start: '{{', end: '}}' },
      ...options,
    };
  }

  render(template: string, data: Record<string, any> = {}): string {
    const { start, end } = this.options.customDelimiters;
    const regex = new RegExp(`\\${start}([^\\${end}]+)\\${end}`, 'g');

    return template.replace(regex, (match, key) => {
      const value = data[key.trim()];
      if (value === undefined) return match;

      const stringValue = String(value);
      return this.options.escapeHtml
        ? this.escapeHtml(stringValue)
        : stringValue;
    });
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async renderFile(
    filePath: string,
    data: Record<string, any> = {}
  ): Promise<string> {
    const fs = await import('fs/promises');
    const template = await fs.readFile(filePath, 'utf-8');
    return this.render(template, data);
  }
}

// Use advanced template engine
app.setTemplateEngine(
  new AdvancedTemplateEngine({
    escapeHtml: true,
    customDelimiters: { start: '${', end: '}' },
  })
);
```

### Environment-Based Configuration

```typescript
// Different configurations for development vs production
if (process.env.NODE_ENV === 'development') {
  // Development: no caching, detailed errors
  app.setViews('./src/views');
  app.setTemplateEngine(createTemplateEngine('simple'));
} else {
  // Production: caching enabled, optimized
  app.setViews('./dist/views');
  app.setTemplateEngine(
    new CachedTemplateEngine(createTemplateEngine('mustache'))
  );
}
```

## Notes

- **File-Based Templates**: Templates are loaded from the file system based on the views directory configured with `setViews()`.

- **Template Engines**: The framework provides two built-in engines - Simple (basic variable interpolation) and Mustache (conditional and loop support).

- **Custom Engines**: You can implement the `TemplateEngine` interface to create custom template processing logic.

- **Performance**: Consider implementing caching for production environments to avoid repeated file system access.

- **Security**: Template engines should escape HTML by default to prevent XSS attacks. Be cautious with raw HTML output.

- **Error Handling**: Template rendering errors should be caught and handled gracefully with appropriate error pages.

- **Data Types**: Template data should be serializable objects. Functions and complex objects may not render as expected.

- **File Extensions**: Template files can use any extension (.html, .mustache, .tmpl) as long as they contain valid template syntax.

- **Async Support**: Template rendering is asynchronous to support file system operations and complex data processing.

- **Path Resolution**: Template paths are resolved relative to the views directory. Use forward slashes for cross-platform compatibility.
