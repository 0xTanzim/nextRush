# Template Engine

## Introduction

The NextRush framework provides a powerful, flexible template engine that supports multiple syntax styles including Mustache, Handlebars-like expressions, and simple variable interpolation. The template system offers file-based rendering, data interpolation, and a clean API for server-side rendering without external dependencies.

## Public APIs

### Template Engine Interface

| Interface        | Description                     |
| ---------------- | ------------------------------- |
| `TemplateEngine` | Base template engine interface. |

#### TemplateEngine Methods

| Method                       | Signature                                                          | Description                       |
| ---------------------------- | ------------------------------------------------------------------ | --------------------------------- |
| `render(template, data)`     | `(template: string, data: Record<string, any>) => string`          | Render template string with data. |
| `renderFile(filePath, data)` | `(filePath: string, data: Record<string, any>) => Promise<string>` | Render template file with data.   |

### Application Template Methods

| Method                      | Signature                                                       | Description                        |
| --------------------------- | --------------------------------------------------------------- | ---------------------------------- |
| `setViews(viewsPath)`       | `(viewsPath: string) => Application`                            | Set views directory for templates. |
| `setTemplateEngine(engine)` | `(engine: TemplateEngine) => Application`                       | Set custom template engine.        |
| `render(view, data?)`       | `(view: string, data?: Record<string, any>) => Promise<string>` | Render template with data.         |

### Response Template Methods

| Method                | Signature                                            | Description                        |
| --------------------- | ---------------------------------------------------- | ---------------------------------- |
| `render(view, data?)` | `(view: string, data?: Record<string, any>) => void` | Render and send template response. |

### Built-in Template Engines

| Class                    | Description                          |
| ------------------------ | ------------------------------------ |
| `SimpleTemplateEngine`   | Basic variable interpolation engine. |
| `MustacheTemplateEngine` | Mustache-style template engine.      |

### Factory Functions

| Function               | Signature                                          | Description                      |
| ---------------------- | -------------------------------------------------- | -------------------------------- |
| `createTemplateEngine` | `(type: 'simple' \| 'mustache') => TemplateEngine` | Create template engine instance. |

## Usage Examples

### Basic Template Setup

```typescript
import { createApp, createTemplateEngine } from 'nextrush';

const app = createApp();

// Set views directory
app.setViews('./views');

// Use built-in simple template engine
app.setTemplateEngine(createTemplateEngine('simple'));

// Basic template rendering
app.get('/hello/:name', (req, res) => {
  res.render('hello.html', {
    name: req.params.name,
    title: 'Welcome',
  });
});

app.listen(3000);
```

### Template File Structure

```html
<!-- views/hello.html -->
<!DOCTYPE html>
<html>
  <head>
    <title>{{title}}</title>
  </head>
  <body>
    <h1>Hello, {{name}}!</h1>
    <p>Welcome to NextRush template engine.</p>
  </body>
</html>
```

### Mustache Template Engine

```typescript
import { createApp, createTemplateEngine } from 'nextrush';

const app = createApp();

// Configure Mustache template engine
app.setViews('./templates');
app.setTemplateEngine(createTemplateEngine('mustache'));

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

### Custom Template Engine

```typescript
import { createApp, TemplateEngine } from 'nextrush';

// Create custom template engine
class CustomTemplateEngine implements TemplateEngine {
  render(template: string, data: Record<string, any> = {}): string {
    // Custom template processing logic
    return template.replace(/\\$\\{([^}]+)\\}/g, (match, key) => {
      const keys = key.split('.');
      let value = data;

      for (const k of keys) {
        value = value?.[k];
      }

      return value !== undefined ? String(value) : match;
    });
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

// Use custom template engine
app.setViews('./views');
app.setTemplateEngine(new CustomTemplateEngine());

// Render with custom syntax: ${variable.property}
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
import { createApp, createTemplateEngine } from 'nextrush';

const app = createApp();

app.setViews('./views');
app.setTemplateEngine(createTemplateEngine('mustache'));

// Complex data rendering
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
      publishedAt: new Date(post.createdAt).toLocaleDateString(),
      viewCount: post.views,
    })),
    hasRecentPosts: stats.recentPosts.length > 0,
    currentYear: new Date().getFullYear(),
  };

  res.render('dashboard.html', templateData);
});

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
```

### Error Handling in Templates

```typescript
import { createApp, createTemplateEngine } from 'nextrush';

const app = createApp();

app.setViews('./views');
app.setTemplateEngine(createTemplateEngine('mustache'));

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
        publishedAt: new Date(content.createdAt).toLocaleDateString(),
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
```

### Template Caching

```typescript
import { createApp, TemplateEngine } from 'nextrush';

// Template engine with caching
class CachedTemplateEngine implements TemplateEngine {
  private cache = new Map<string, string>();
  private baseEngine: TemplateEngine;

  constructor(baseEngine: TemplateEngine) {
    this.baseEngine = baseEngine;
  }

  render(template: string, data: Record<string, any> = {}): string {
    return this.baseEngine.render(template, data);
  }

  async renderFile(
    filePath: string,
    data: Record<string, any> = {}
  ): Promise<string> {
    // Check cache in production
    if (process.env.NODE_ENV === 'production' && this.cache.has(filePath)) {
      const template = this.cache.get(filePath)!;
      return this.render(template, data);
    }

    // Read and cache template
    const fs = await import('fs/promises');
    const template = await fs.readFile(filePath, 'utf-8');

    if (process.env.NODE_ENV === 'production') {
      this.cache.set(filePath, template);
    }

    return this.render(template, data);
  }
}

const app = createApp();

// Use cached template engine
app.setViews('./views');
app.setTemplateEngine(
  new CachedTemplateEngine(createTemplateEngine('mustache'))
);

app.listen(3000);
```

## Configuration Options

### Basic Configuration

```typescript
// Simple template setup
app.setViews('./views');
app.setTemplateEngine(createTemplateEngine('simple'));
```

### Mustache Configuration

```typescript
// Mustache template engine
app.setViews('./templates');
app.setTemplateEngine(createTemplateEngine('mustache'));
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
