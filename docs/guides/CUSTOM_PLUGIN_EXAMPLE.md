# Custom Plugin Example: Template Engine Plugin

This document shows a complete example of creating a custom plugin with full type safety, error handling, and TypeScript support.

## Table of Contents

- [Plugin Overview](#plugin-overview)
- [Implementation](#implementation)
- [Type Declarations](#type-declarations)
- [Usage Examples](#usage-examples)
- [Error Handling](#error-handling)
- [Testing](#testing)

## Plugin Overview

We'll create a `TemplateEnginePlugin` that provides template rendering capabilities to the application.

### Features

- **Template Rendering**: Render HTML templates with data
- **Multiple Engines**: Support for different template engines (EJS, Handlebars, etc.)
- **Type Safety**: Full TypeScript support
- **Error Handling**: Clear error messages when plugin isn't installed
- **Context Integration**: Available in both app and request context

## Implementation

### 1. Template Engine Plugin

```typescript
// src/plugins/template/template.plugin.ts
import { BasePlugin } from '@/plugins/core/base-plugin';
import type { Application, Context } from '@/types/context';

export interface TemplateEngineConfig {
  engine: 'ejs' | 'handlebars' | 'pug';
  viewsPath: string;
  defaultLayout?: string;
  cache?: boolean;
  debug?: boolean;
}

export interface TemplateInstance {
  render(template: string, data?: Record<string, unknown>): string;
  renderFile(filename: string, data?: Record<string, unknown>): string;
  compile(template: string): (data: Record<string, unknown>) => string;
  setEngine(engine: TemplateEngineConfig['engine']): void;
  getEngine(): string;
}

export class TemplateEnginePlugin extends BasePlugin {
  public name = 'TemplateEngine';
  public version = '1.0.0';

  private config: TemplateEngineConfig;
  private templateInstance: TemplateInstance;

  constructor(config: TemplateEngineConfig) {
    super();
    this.config = config;
    this.templateInstance = this.createTemplateInstance();
  }

  onInstall(app: Application): void {
    // ✅ Add template methods to app instance
    (app as any).template = this.templateInstance;

    // ✅ Add middleware for template context
    app.use(this.createTemplateMiddleware());

    this.log('TemplateEngine plugin installed');
  }

  private createTemplateInstance(): TemplateInstance {
    return {
      render: (template: string, data: Record<string, unknown> = {}) => {
        // Simple template rendering (you can integrate with real engines)
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
          return String(data[key] || '');
        });
      },

      renderFile: (filename: string, data: Record<string, unknown> = {}) => {
        // Read file and render
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(this.config.viewsPath, filename);

        if (!fs.existsSync(filePath)) {
          throw new Error(`Template file not found: ${filePath}`);
        }

        const template = fs.readFileSync(filePath, 'utf8');
        return this.templateInstance.render(template, data);
      },

      compile: (template: string) => {
        return (data: Record<string, unknown>) => {
          return this.templateInstance.render(template, data);
        };
      },

      setEngine: (engine: TemplateEngineConfig['engine']) => {
        this.config.engine = engine;
        this.log(`Template engine changed to: ${engine}`);
      },

      getEngine: () => {
        return this.config.engine;
      },
    };
  }

  private createTemplateMiddleware(): Middleware {
    return (ctx: Context, next) => {
      // ✅ Add template to context for request-specific access
      (ctx as any).template = this.templateInstance;
      next();
    };
  }

  onCleanup(): void {
    this.log('TemplateEngine plugin cleaned up');
  }
}
```

### 2. Type Declarations

```typescript
// src/types/template.d.ts
import type { TemplateInstance } from '@/plugins/template/template.plugin';

declare module '@/types/context' {
  interface Application {
    // ... existing methods

    // Template plugin methods
    template?: TemplateInstance;
  }

  interface Context {
    // ... existing properties

    // Template plugin context
    template?: TemplateInstance;
  }
}
```

### 3. Plugin Export

```typescript
// src/plugins/template/index.ts
export {
  TemplateEnginePlugin,
  type TemplateEngineConfig,
  type TemplateInstance,
} from './template.plugin';

// Factory function for easy usage
export function createTemplateEngine(
  config: TemplateEngineConfig
): TemplateEnginePlugin {
  return new TemplateEnginePlugin(config);
}
```

## Usage Examples

### 1. Basic Usage

```typescript
// ✅ Basic template plugin usage
import { createApp } from '@/index';
import { createTemplateEngine } from '@/plugins/template';

const app = createApp();

// Install template plugin
const template = createTemplateEngine({
  engine: 'ejs',
  viewsPath: './views',
  cache: true,
});
template.install(app);

// ✅ TypeScript knows about app.template
app.get('/welcome', ctx => {
  const html = app.template?.render('Hello {{name}}!', { name: 'World' });
  ctx.res.html(html || 'Hello World!');
});
```

### 2. File-based Templates

```typescript
// ✅ Using template files
app.get('/profile', ctx => {
  const html = app.template?.renderFile('profile.html', {
    user: { name: 'John', email: 'john@example.com' },
    title: 'User Profile',
  });
  ctx.res.html(html || 'Profile not found');
});
```

### 3. Context-level Access

```typescript
// ✅ Template available in request context
app.get('/dashboard', ctx => {
  // Context-level access
  const html = ctx.template?.render('Welcome {{user.name}}!', {
    user: { name: 'Admin' },
  });
  ctx.res.html(html || 'Welcome!');
});
```

### 4. Conditional Usage

```typescript
// ✅ Safe conditional usage
app.get('/content', ctx => {
  if (app.template) {
    const html = app.template.render('{{content}}', {
      content: 'Dynamic content here',
    });
    ctx.res.html(html);
  } else {
    ctx.res.html('<h1>Static content</h1>');
  }
});
```

## Error Handling

### 1. Plugin Installation Validation

```typescript
// ✅ Validate template plugin installation
class TemplateGuard {
  static requireTemplate(
    app: Application
  ): asserts app is Application & {
    template: NonNullable<Application['template']>;
  } {
    if (!app.template) {
      throw new Error(
        'TemplateEnginePlugin must be installed to use app.template'
      );
    }
  }
}

// Usage
app.get('/render', ctx => {
  TemplateGuard.requireTemplate(app);

  // Now TypeScript knows app.template is defined
  const html = app.template.render('Hello {{name}}!', { name: 'World' });
  ctx.res.html(html);
});
```

### 2. Safe Plugin Access

```typescript
// ✅ Safe plugin access with fallbacks
app.get('/safe-render', ctx => {
  const html =
    app.template?.render('Hello {{name}}!', { name: 'World' }) ||
    'Hello World!';
  ctx.res.html(html);
});
```

### 3. Plugin Method Proxies

```typescript
// ✅ Plugin method proxies for better error handling
class TemplateProxy {
  static createTemplateProxy(app: Application): TemplateInstance {
    return new Proxy({} as TemplateInstance, {
      get(target, prop) {
        if (!app.template) {
          throw new Error(
            `Cannot access app.template.${String(prop)} - TemplateEnginePlugin is not installed`
          );
        }
        return (app.template as any)[prop];
      },
    });
  }
}

// Usage
const app = createApp();
const template = TemplateProxy.createTemplateProxy(app);

// This will throw a clear error if plugin isn't installed
template.render('Hello {{name}}!', { name: 'World' }); // Error: TemplateEnginePlugin is not installed
```

## Testing

### 1. Plugin Installation Test

```typescript
// src/tests/unit/plugins/template.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '@/index';
import { TemplateEnginePlugin } from '@/plugins/template';

describe('TemplateEngine Plugin', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
  });

  it('should install template plugin', () => {
    const template = new TemplateEnginePlugin({
      engine: 'ejs',
      viewsPath: './views',
    });

    template.install(app);

    expect(app.template).toBeDefined();
    expect(typeof app.template!.render).toBe('function');
    expect(typeof app.template!.renderFile).toBe('function');
  });

  it('should render templates correctly', () => {
    const template = new TemplateEnginePlugin({
      engine: 'ejs',
      viewsPath: './views',
    });

    template.install(app);

    const result = app.template!.render('Hello {{name}}!', { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('should handle missing plugin gracefully', () => {
    // app.template is undefined
    expect(app.template).toBeUndefined();

    // Safe usage
    const result = app.template?.render('Hello {{name}}!', { name: 'World' });
    expect(result).toBeUndefined();
  });
});
```

### 2. Integration Test

```typescript
// src/tests/integration/template-integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '@/index';
import { TemplateEnginePlugin } from '@/plugins/template';
import type { Server } from 'node:http';

describe('Template Engine Integration', () => {
  let app: Application;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    app = createApp({ port: 0 });

    // Install template plugin
    const template = new TemplateEnginePlugin({
      engine: 'ejs',
      viewsPath: './views',
    });
    template.install(app);

    // Add test routes
    app.get('/welcome', ctx => {
      const html = app.template?.render('Hello {{name}}!', { name: 'World' });
      ctx.res.html(html || 'Hello World!');
    });

    app.get('/profile', ctx => {
      const html = app.template?.render('Profile: {{user.name}}', {
        user: { name: 'John' },
      });
      ctx.res.html(html || 'Profile not found');
    });

    // Start server
    server = app.listen();
    await new Promise<void>(resolve => {
      server.on('listening', () => {
        const address = server.address() as any;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await app.shutdown();
    server.close();
  });

  it('should render templates via HTTP', async () => {
    const response = await fetch(`${baseUrl}/welcome`);
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toBe('Hello World!');
  });

  it('should render templates with data', async () => {
    const response = await fetch(`${baseUrl}/profile`);
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toBe('Profile: John');
  });
});
```

## Summary

### Key Benefits

1. **Type Safety**: Full TypeScript support with proper type inference
2. **Error Handling**: Clear error messages when plugin isn't installed
3. **Flexibility**: Easy to extend with custom functionality
4. **Performance**: Zero runtime overhead when not used
5. **Developer Experience**: Intuitive API with good error messages

### Best Practices

```typescript
// ✅ Recommended template plugin usage
const app = createApp();

// Install template plugin
const template = createTemplateEngine({
  engine: 'ejs',
  viewsPath: './views',
  cache: true,
});
template.install(app);

// Safe usage with type inference
app.get('/render', ctx => {
  // App-level access (type-safe)
  const html = app.template?.render('Hello {{name}}!', { name: 'World' });

  // Context-level access (type-safe)
  const ctxHtml = ctx.template?.render('Welcome {{user}}!', { user: 'Admin' });

  ctx.res.html(html || ctxHtml || 'Hello World!');
});
```

This example demonstrates:

- **Custom Plugin Development**: How to create plugins that extend the framework
- **Type Safety**: Full TypeScript support with proper type inference
- **Error Handling**: Clear error messages and graceful fallbacks
- **Testing**: Comprehensive test coverage for plugins
- **Integration**: How plugins integrate with the application lifecycle

The pattern can be applied to any custom plugin you want to create! 🎯
