# Path Utilities

Cross-platform path manipulation utilities for NextRush v2 applications with file system operations and path resolution.

## What it is

Path Utilities provide a comprehensive set of functions for working with file paths, directory operations, and file system queries in a cross-platform manner. These utilities handle path resolution, normalization, and common file operations.

## When to use

- Working with file paths in middleware or route handlers
- Building file serving capabilities
- Template engine path resolution
- Static file management
- Configuration file loading
- Cross-platform path operations

## Core Functions

### resolvePath()

Resolve a path relative to the project root directory.

```typescript
import { resolvePath } from 'nextrush/path-utils';

// Resolve relative to project root
const configPath = resolvePath('config/app.json');
const publicPath = resolvePath('public/assets');

console.log(configPath); // /project/root/config/app.json
console.log(publicPath); // /project/root/public/assets
```

**Parameters:**

- `path: string` - Path to resolve

**Returns:** `string` - Absolute path from project root

### joinPaths()

Join multiple path segments into a single path.

```typescript
import { joinPaths } from 'nextrush/path-utils';

// Join path segments
const assetPath = joinPaths('public', 'css', 'styles.css');
const templatePath = joinPaths('views', 'templates', 'user.html');

console.log(assetPath); // public/css/styles.css
console.log(templatePath); // views/templates/user.html
```

**Parameters:**

- `...paths: string[]` - Path segments to join

**Returns:** `string` - Joined path

### normalizePath()

Normalize a path by resolving `.` and `..` segments.

```typescript
import { normalizePath } from 'nextrush/path-utils';

// Normalize paths
const normalized1 = normalizePath('./config/../public/index.html');
const normalized2 = normalizePath('public//assets//./images');

console.log(normalized1); // public/index.html
console.log(normalized2); // public/assets/images
```

**Parameters:**

- `path: string` - Path to normalize

**Returns:** `string` - Normalized path

## File Information Functions

### getFileExtension()

Extract file extension from a path.

```typescript
import { getFileExtension } from 'nextrush/path-utils';

const ext1 = getFileExtension('style.css');
const ext2 = getFileExtension('script.min.js');
const ext3 = getFileExtension('README');

console.log(ext1); // '.css'
console.log(ext2); // '.js'
console.log(ext3); // ''
```

**Parameters:**

- `path: string` - File path

**Returns:** `string` - File extension including the dot, or empty string

### getFileName()

Get file name without extension.

```typescript
import { getFileName } from 'nextrush/path-utils';

const name1 = getFileName('styles.css');
const name2 = getFileName('app.config.json');
const name3 = getFileName('/path/to/image.png');

console.log(name1); // 'styles'
console.log(name2); // 'app.config'
console.log(name3); // 'image'
```

**Parameters:**

- `path: string` - File path

**Returns:** `string` - File name without extension

### getDirName()

Get directory name from a path.

```typescript
import { getDirName } from 'nextrush/path-utils';

const dir1 = getDirName('/home/user/documents/file.txt');
const dir2 = getDirName('public/css/styles.css');

console.log(dir1); // '/home/user/documents'
console.log(dir2); // 'public/css'
```

**Parameters:**

- `path: string` - File path

**Returns:** `string` - Directory name

## File System Query Functions

### pathExists()

Check if a path exists in the file system.

```typescript
import { pathExists } from 'nextrush/path-utils';

// Check if files/directories exist
if (pathExists('public/index.html')) {
  console.log('Index file exists');
}

if (pathExists('config/app.json')) {
  console.log('Config file found');
}
```

**Parameters:**

- `path: string` - Path to check

**Returns:** `boolean` - True if path exists

### isFile()

Check if a path points to a file.

```typescript
import { isFile } from 'nextrush/path-utils';

// Check if path is a file
if (isFile('package.json')) {
  console.log('Package.json is a file');
}

if (!isFile('node_modules')) {
  console.log('node_modules is not a file');
}
```

**Parameters:**

- `path: string` - Path to check

**Returns:** `boolean` - True if path is a file

### isDirectory()

Check if a path points to a directory.

```typescript
import { isDirectory } from 'nextrush/path-utils';

// Check if path is a directory
if (isDirectory('public')) {
  console.log('Public is a directory');
}

if (isDirectory('src/components')) {
  console.log('Components directory exists');
}
```

**Parameters:**

- `path: string` - Path to check

**Returns:** `boolean` - True if path is a directory

### getFileSize()

Get file size in bytes.

```typescript
import { getFileSize } from 'nextrush/path-utils';

try {
  const size = getFileSize('package.json');
  console.log(`Package.json size: ${size} bytes`);

  // Convert to human-readable format
  const sizeKB = (size / 1024).toFixed(2);
  console.log(`Size: ${sizeKB} KB`);
} catch (error) {
  console.error('File not found or not a file');
}
```

**Parameters:**

- `path: string` - File path

**Returns:** `number` - File size in bytes

**Throws:** `Error` - If path is not a file

### getFileModifiedTime()

Get file modification time.

```typescript
import { getFileModifiedTime } from 'nextrush/path-utils';

try {
  const modTime = getFileModifiedTime('config/app.json');
  console.log(`Last modified: ${modTime.toISOString()}`);

  // Check if file was modified in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  if (modTime > oneHourAgo) {
    console.log('File was recently modified');
  }
} catch (error) {
  console.error('File not found');
}
```

**Parameters:**

- `path: string` - File path

**Returns:** `Date` - File modification time

**Throws:** `Error` - If path is not a file

## Advanced Path Operations

### getRelativePath()

Get relative path from a base directory.

```typescript
import { getRelativePath } from 'nextrush/path-utils';

const base = '/project/root';
const target = '/project/root/src/components/Button.tsx';

const relativePath = getRelativePath(base, target);
console.log(relativePath); // 'src/components/Button.tsx'

// Use with current working directory
const relativeFromCwd = getRelativePath(process.cwd(), target);
console.log(relativeFromCwd);
```

**Parameters:**

- `base: string` - Base directory path
- `path: string` - Target path to make relative

**Returns:** `string` - Relative path from base to target

### getAbsolutePath()

Get absolute path from any path.

```typescript
import { getAbsolutePath } from 'nextrush/path-utils';

// Convert relative paths to absolute
const abs1 = getAbsolutePath('public/index.html');
const abs2 = getAbsolutePath('./config/../src/app.ts');

console.log(abs1); // /current/directory/public/index.html
console.log(abs2); // /current/directory/src/app.ts
```

**Parameters:**

- `path: string` - Path to resolve

**Returns:** `string` - Absolute path

### isAbsolutePath()

Check if a path is absolute.

```typescript
import { isAbsolutePath } from 'nextrush/path-utils';

// Check path types
console.log(isAbsolutePath('/usr/local/bin')); // true (Unix)
console.log(isAbsolutePath('C:\\Program Files')); // true (Windows)
console.log(isAbsolutePath('./relative/path')); // false
console.log(isAbsolutePath('relative/path')); // false
```

**Parameters:**

- `path: string` - Path to check

**Returns:** `boolean` - True if path is absolute

### getCommonPrefix()

Find common path prefix among multiple paths.

```typescript
import { getCommonPrefix } from 'nextrush/path-utils';

const paths = [
  '/project/src/components/Button.tsx',
  '/project/src/components/Input.tsx',
  '/project/src/utils/helpers.ts',
];

const commonPrefix = getCommonPrefix(paths);
console.log(commonPrefix); // '/project/src'

// Use for finding common directory
const files = ['src/app.ts', 'src/server.ts', 'src/config.ts'];
const commonDir = getCommonPrefix(files);
console.log(commonDir); // 'src'
```

**Parameters:**

- `paths: string[]` - Array of paths to analyze

**Returns:** `string` - Common prefix path

## Complete Examples

### Static File Middleware

```typescript
// static-file-middleware.ts
import { createApp } from 'nextrush';
import {
  resolvePath,
  joinPaths,
  pathExists,
  isFile,
  getFileExtension,
  getFileSize,
} from 'nextrush/path-utils';
import { readFile } from 'node:fs/promises';

const app = createApp();

// Static file serving middleware
app.use('/static', async (ctx, next) => {
  // Get requested file path
  const requestedPath = ctx.path.replace('/static', '');
  const filePath = joinPaths(resolvePath('public'), requestedPath);

  // Security check: ensure path is within public directory
  const publicDir = resolvePath('public');
  if (!filePath.startsWith(publicDir)) {
    ctx.res.status(403).json({ error: 'Access denied' });
    return;
  }

  // Check if file exists and is a file
  if (!pathExists(filePath) || !isFile(filePath)) {
    await next(); // Let other middleware handle 404
    return;
  }

  try {
    // Get file info
    const fileSize = getFileSize(filePath);
    const extension = getFileExtension(filePath);

    // Set appropriate content type
    const contentTypes: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    };

    const contentType = contentTypes[extension] || 'application/octet-stream';

    // Read and serve file
    const fileContent = await readFile(filePath);

    ctx.res.set('Content-Type', contentType);
    ctx.res.set('Content-Length', fileSize.toString());
    ctx.res.set('Cache-Control', 'public, max-age=3600'); // 1 hour cache

    ctx.body = fileContent;
  } catch (error) {
    ctx.res.status(500).json({ error: 'Failed to read file' });
  }
});

export default app;
```

### Template Path Resolution

```typescript
// template-resolver.ts
import {
  resolvePath,
  joinPaths,
  pathExists,
  isFile,
  getFileName,
  getFileExtension,
} from 'nextrush/path-utils';

interface TemplateResolverOptions {
  viewsDirectory: string;
  defaultExtension: string;
  layouts?: string;
}

export class TemplateResolver {
  private viewsDir: string;
  private defaultExt: string;
  private layoutsDir?: string;

  constructor(options: TemplateResolverOptions) {
    this.viewsDir = resolvePath(options.viewsDirectory);
    this.defaultExt = options.defaultExtension;
    this.layoutsDir = options.layouts
      ? resolvePath(options.layouts)
      : undefined;
  }

  /**
   * Resolve template path with automatic extension
   */
  resolveTemplate(templateName: string): string | null {
    // Add default extension if not present
    let fileName = templateName;
    if (!getFileExtension(fileName)) {
      fileName += this.defaultExt;
    }

    const templatePath = joinPaths(this.viewsDir, fileName);

    // Check if template exists
    if (pathExists(templatePath) && isFile(templatePath)) {
      return templatePath;
    }

    return null;
  }

  /**
   * Resolve layout template
   */
  resolveLayout(layoutName: string): string | null {
    if (!this.layoutsDir) return null;

    let fileName = layoutName;
    if (!getFileExtension(fileName)) {
      fileName += this.defaultExt;
    }

    const layoutPath = joinPaths(this.layoutsDir, fileName);

    if (pathExists(layoutPath) && isFile(layoutPath)) {
      return layoutPath;
    }

    return null;
  }

  /**
   * Get all available templates
   */
  getAvailableTemplates(): string[] {
    // This would require fs.readdir implementation
    // For demonstration, returning empty array
    return [];
  }
}

// Usage example
const resolver = new TemplateResolver({
  viewsDirectory: 'views',
  defaultExtension: '.html',
  layouts: 'views/layouts',
});

// In route handler
app.get('/users/:id', async ctx => {
  const templatePath = resolver.resolveTemplate('users/profile');
  const layoutPath = resolver.resolveLayout('main');

  if (!templatePath) {
    ctx.res.status(404).json({ error: 'Template not found' });
    return;
  }

  // Render template logic here
  ctx.res.render(templatePath, { layout: layoutPath });
});
```

### Configuration File Loader

```typescript
// config-loader.ts
import {
  resolvePath,
  joinPaths,
  pathExists,
  isFile,
  getFileExtension,
  getFileModifiedTime,
} from 'nextrush/path-utils';
import { readFile } from 'node:fs/promises';

interface ConfigCache {
  data: unknown;
  lastModified: Date;
  path: string;
}

export class ConfigLoader {
  private cache = new Map<string, ConfigCache>();
  private configDir: string;

  constructor(configDirectory: string = 'config') {
    this.configDir = resolvePath(configDirectory);
  }

  /**
   * Load configuration file with caching
   */
  async loadConfig<T = unknown>(fileName: string): Promise<T | null> {
    const configPath = this.resolveConfigPath(fileName);

    if (!configPath) {
      throw new Error(`Configuration file not found: ${fileName}`);
    }

    // Check cache
    const cached = this.cache.get(configPath);
    const lastModified = getFileModifiedTime(configPath);

    if (cached && cached.lastModified >= lastModified) {
      return cached.data as T;
    }

    // Load and parse configuration
    try {
      const content = await readFile(configPath, 'utf8');
      const extension = getFileExtension(configPath);

      let data: unknown;

      if (extension === '.json') {
        data = JSON.parse(content);
      } else if (extension === '.js') {
        // For JS files, would need dynamic import
        throw new Error(
          'JavaScript config files not supported in this example'
        );
      } else {
        // Plain text
        data = content;
      }

      // Update cache
      this.cache.set(configPath, {
        data,
        lastModified,
        path: configPath,
      });

      return data as T;
    } catch (error) {
      throw new Error(
        `Failed to load config ${fileName}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Resolve configuration file path
   */
  private resolveConfigPath(fileName: string): string | null {
    // Try with given name first
    let configPath = joinPaths(this.configDir, fileName);

    if (pathExists(configPath) && isFile(configPath)) {
      return configPath;
    }

    // Try with .json extension
    if (!getFileExtension(fileName)) {
      configPath = joinPaths(this.configDir, fileName + '.json');

      if (pathExists(configPath) && isFile(configPath)) {
        return configPath;
      }
    }

    return null;
  }

  /**
   * Clear configuration cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Usage example
const configLoader = new ConfigLoader('config');

// In application startup
app.use(async (ctx, next) => {
  try {
    const dbConfig = await configLoader.loadConfig<DatabaseConfig>('database');
    const appConfig = await configLoader.loadConfig<AppConfig>('app');

    // Store in context state
    ctx.state.dbConfig = dbConfig;
    ctx.state.appConfig = appConfig;

    await next();
  } catch (error) {
    ctx.res.status(500).json({
      error: 'Configuration loading failed',
      message: (error as Error).message,
    });
  }
});
```

## Cross-Platform Considerations

### Path Separators

```typescript
import { joinPaths, normalizePath } from 'nextrush/path-utils';

// These work correctly on both Windows and Unix systems
const path1 = joinPaths('public', 'assets', 'images');
const path2 = normalizePath('./config/../public');

// Avoid manual path concatenation
// ❌ Don't do this
const badPath = 'public' + '/' + 'assets'; // Breaks on Windows

// ✅ Do this instead
const goodPath = joinPaths('public', 'assets');
```

### Absolute Path Detection

```typescript
import { isAbsolutePath } from 'nextrush/path-utils';

// Works on both Unix and Windows
if (isAbsolutePath(userPath)) {
  console.log('User provided absolute path');
} else {
  console.log('User provided relative path');
}
```

## Security Notes

- Always validate paths before file operations to prevent directory traversal
- Use `resolvePath()` and check if resolved path is within expected directory
- Sanitize user-provided paths before using with file system operations
- Be cautious when serving static files based on user input

## Performance Notes

- File system operations are cached where appropriate
- Path operations are lightweight string manipulations
- Consider caching file existence checks for frequently accessed paths
- Use streaming for large file operations

## See Also

- [Configuration & Validation](./configuration.md) - Configuration file validation
- [Template Plugin](./template-plugin.md) - Template path resolution
- [Static Files Plugin](../plugins/static-files-plugin.md) - Static file serving
- [Developer Experience](./developer-experience.md) - Error handling utilities

## Version

- **Added in:** v2.0.0-alpha.1
- **Status:** Stable
