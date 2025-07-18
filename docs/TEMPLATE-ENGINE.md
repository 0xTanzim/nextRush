# Template Engine Guide

NextRush includes a powerful, zero-dependency template engine that supports multiple syntaxes and advanced features.

## Basic Template Rendering

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Set views directory
app.setViews('./views');

// Render template
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

## Template Syntax

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

    <!-- Escaped content (safe) -->
    <p>Bio: {{user.bio}}</p>

    <!-- Unescaped content (use with caution) -->
    <div>{{{user.htmlContent}}}</div>
  </body>
</html>
```

### Conditionals

```html
<!-- Conditional rendering -->
{{#if user.isActive}}
<span class="status active">User is active</span>
{{/if}} {{#unless user.isActive}}
<span class="status inactive">User is inactive</span>
{{/unless}}

<!-- If-else statements -->
{{#if user.isAdmin}}
<a href="/admin">Admin Panel</a>
{{else}}
<span>Regular User</span>
{{/if}}

<!-- Multiple conditions -->
{{#if user.isActive}} {{#if user.isVerified}}
<span class="badge verified">Verified User</span>
{{else}}
<span class="badge unverified">Unverified User</span>
{{/if}} {{/if}}
```

### Loops and Iterations

```html
<!-- Loop through arrays -->
<ul>
  {{#each user.posts}}
  <li>{{this}}</li>
  {{/each}}
</ul>

<!-- Loop with index -->
<ol>
  {{#each user.posts}}
  <li data-index="{{@index}}">{{this}}</li>
  {{/each}}
</ol>

<!-- Loop through objects -->
{{#each user.metadata}}
<p><strong>{{@key}}:</strong> {{this}}</p>
{{/each}}

<!-- Empty state -->
{{#each user.posts}}
<div class="post">{{this}}</div>
{{else}}
<p>No posts available</p>
{{/each}}
```

### Nested Data Access

```html
<!-- Nested object properties -->
<h2>{{user.profile.displayName}}</h2>
<p>
  Location: {{user.profile.location.city}}, {{user.profile.location.country}}
</p>

<!-- Array access -->
<p>Latest post: {{user.posts.0}}</p>
<p>Second post: {{user.posts.1}}</p>

<!-- Complex nested structures -->
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

## Advanced Features

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
      {{content}}
    </main>

    {{> footer}}
  </body>
</html>
```

### Custom Helpers

```typescript
// Register custom template helpers
app.setViews('./views', {
  helpers: {
    // Format date helper
    formatDate: (date) => {
      return new Date(date).toLocaleDateString();
    },

    // Uppercase helper
    upper: (text) => {
      return text.toUpperCase();
    },

    // Math operations
    add: (a, b) => a + b,
    multiply: (a, b) => a * b,

    // String operations
    truncate: (text, length = 50) => {
      return text.length > length ? text.substring(0, length) + '...' : text;
    },

    // Conditional helpers
    eq: (a, b) => a === b,
    gt: (a, b) => a > b,
    lt: (a, b) => a < b,

    // JSON stringify for debugging
    json: (obj) => JSON.stringify(obj, null, 2),
  },
});

// Use helpers in templates
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

    <!-- Debug info (development only) -->
    {{#if @root.debug}}
    <pre>{{json this}}</pre>
    {{/if}}
  </article>
  {{/each}}
</div>
```

### Layouts and Inheritance

```typescript
// Set default layout
app.setViews('./views', {
  layout: 'layouts/main.html',
});

// Render with custom layout
app.get('/admin', (req, res) => {
  res.render(
    'admin/dashboard.html',
    { title: 'Admin Dashboard' },
    { layout: 'layouts/admin.html' }
  );
});

// Render without layout
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
// Configure template engine
app.setViews('./views', {
  cache: process.env.NODE_ENV === 'production', // Cache in production
  extension: '.html', // Default extension
  encoding: 'utf8', // File encoding

  // Watch for changes in development
  watch: process.env.NODE_ENV === 'development',

  // Compilation options
  compile: {
    removeComments: true, // Remove HTML comments
    minifyHTML: process.env.NODE_ENV === 'production',
    preserveWhitespace: false, // Remove extra whitespace
  },

  // Error handling
  strict: true, // Throw errors for undefined variables

  // Custom delimiters
  delimiters: {
    start: '{{',
    end: '}}',
  },
});
```

## Template Organization

### Directory Structure

```text
views/
├── layouts/
│   ├── main.html           # Default layout
│   ├── admin.html          # Admin layout
│   └── email.html          # Email layout
├── partials/
│   ├── header.html         # Navigation header
│   ├── footer.html         # Site footer
│   ├── sidebar.html        # Sidebar component
│   └── forms/
│       ├── login.html      # Login form
│       └── contact.html    # Contact form
├── pages/
│   ├── home.html           # Homepage
│   ├── about.html          # About page
│   └── contact.html        # Contact page
├── user/
│   ├── profile.html        # User profile
│   ├── settings.html       # User settings
│   └── dashboard.html      # User dashboard
├── admin/
│   ├── dashboard.html      # Admin dashboard
│   ├── users.html          # User management
│   └── posts.html          # Post management
└── email/
    ├── welcome.html        # Welcome email
    ├── reset-password.html # Password reset
    └── notification.html   # Notifications
```

### Template Inheritance Chain

```typescript
// Complex template rendering with data preprocessing
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

    // Prepare template data
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

## Email Templates

```typescript
// Email template rendering
const sendWelcomeEmail = async (user) => {
  try {
    const emailHTML = await app.renderTemplate(
      'email/welcome.html',
      {
        user: {
          name: user.name,
          email: user.email,
        },
        siteName: 'NextRush App',
        siteUrl: process.env.SITE_URL,
        unsubscribeUrl: `${process.env.SITE_URL}/unsubscribe?token=${user.unsubscribeToken}`,
      },
      { layout: 'layouts/email.html' }
    );

    // Send email using your email service
    await sendEmail({
      to: user.email,
      subject: 'Welcome to NextRush App!',
      html: emailHTML,
    });
  } catch (error) {
    console.error('Failed to send welcome email:', error);
  }
};

// API endpoint for email preview (development)
if (process.env.NODE_ENV === 'development') {
  app.get('/preview/email/:template', (req, res) => {
    const sampleData = {
      user: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      siteName: 'NextRush App',
      siteUrl: 'http://localhost:3000',
    };

    res.render(`email/${req.params.template}.html`, sampleData, {
      layout: 'layouts/email.html',
    });
  });
}
```

```html
<!-- views/email/welcome.html -->
<div class="email-content">
  <h1>Welcome to {{siteName}}, {{user.name}}!</h1>

  <p>Thank you for joining our platform. We're excited to have you on board!</p>

  <div class="cta">
    <a href="{{siteUrl}}/login" class="button">Get Started</a>
  </div>

  <p>If you have any questions, feel free to reply to this email.</p>

  <div class="footer">
    <p>Best regards,<br />The {{siteName}} Team</p>
    <p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
  </div>
</div>
```

## Performance Optimization

### Template Precompilation

```typescript
// Precompile templates for production
if (process.env.NODE_ENV === 'production') {
  app.precompileTemplates('./views', {
    outputDir: './compiled-templates',
    minify: true,
    gzip: true,
  });

  // Use precompiled templates
  app.setViews('./compiled-templates', {
    precompiled: true,
    cache: true,
  });
}
```

### Template Caching Strategy

```typescript
// Custom template caching
const templateCache = new Map();

app.setViews('./views', {
  cache: true,
  cacheSize: 100, // Max cached templates
  cacheTTL: 3600000, // 1 hour TTL

  // Custom cache implementation
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

## Error Handling

```typescript
// Template error handling
app.setViews('./views', {
  onError: (error, templatePath, data) => {
    console.error(`Template error in ${templatePath}:`, error);

    // Log template data for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('Template data:', JSON.stringify(data, null, 2));
    }

    // Return fallback template or error page
    return `
      <div class="template-error">
        <h1>Template Error</h1>
        <p>${error.message}</p>
        ${
          process.env.NODE_ENV === 'development'
            ? `<pre>${error.stack}</pre>`
            : ''
        }
      </div>
    `;
  },
});

// Global error templates
app.use((err, req, res, next) => {
  const status = err.status || 500;

  res.status(status).render(
    `errors/${status}.html`,
    {
      title: `Error ${status}`,
      error: err,
      stack: process.env.NODE_ENV === 'development' ? err.stack : null,
    },
    {
      layout: 'layouts/error.html',
    }
  );
});
```

## Testing Templates

```typescript
// Test template rendering
import { createApp } from 'nextrush';

describe('Template Engine', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    app.setViews('./test-views');
  });

  test('renders simple template', async () => {
    // Create test template
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
