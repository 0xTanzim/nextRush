# NextRush v2 Architecture Guidelines

## 🎯 **Core Principle: No Duplication**

**Rule**: If it's already built-in, don't create a plugin for it!

---

## 📋 **What Goes in Core (`src/core/`)**

### **Core Functionality (Always Available)**

#### **1. Application (`src/core/app/`)**

```typescript
// Always available - no installation needed
const app = createApp();

// Routing (Built-in)
app.get('/users', handler); // ✅ Core
app.post('/users', handler); // ✅ Core
app.put('/users/:id', handler); // ✅ Core
app.delete('/users/:id', handler); // ✅ Core
app.patch('/users/:id', handler); // ✅ Core
app.use('/api', router); // ✅ Core

// Middleware (Built-in)
app.use(middleware); // ✅ Core
app.json(); // ✅ Core
app.urlencoded(); // ✅ Core
app.cors(); // ✅ Core
app.helmet(); // ✅ Core
app.compression(); // ✅ Core
app.rateLimit(); // ✅ Core
app.logger(); // ✅ Core
app.requestId(); // ✅ Core
app.timer(); // ✅ Core
```

#### **2. Router (`src/core/router/`)**

```typescript
// Modular routing for complex apps
const router = app.router();
router.get('/users', handler);
router.post('/users', handler);
app.use('/api', router);
```

#### **3. Middleware (`src/core/middleware/`)**

```typescript
// All basic middleware is built-in
body - parser.ts; // JSON, URL-encoded parsing
cors.ts; // CORS headers
helmet.ts; // Security headers
compression.ts; // Response compression
rate - limiter.ts; // Rate limiting
logger.ts; // Basic request logging
request - id.ts; // Request ID generation
timer.ts; // Response timing
```

#### **4. Enhancers (`src/core/enhancers/`)**

```typescript
// Request/Response enhancement
request - enhancer.ts; // Adds properties to req
response - enhancer.ts; // Adds methods to res
```

---

## 🔌 **What Goes in Plugins (`src/plugins/`)**

### **Enhanced/Advanced Functionality (Optional)**

#### **1. Logger Plugin (`src/plugins/logger/`)**

```typescript
// Enhanced logging with transports
import { LoggerPlugin } from '@/plugins/logger';

const loggerPlugin = new LoggerPlugin({
  level: 'info',
  transports: [
    new ConsoleTransport(),
    new FileTransport({ filename: 'app.log' }),
    new HttpTransport({ url: 'http://logs.example.com' }),
  ],
});

loggerPlugin.install(app);
```

**Why Plugin?**

- ✅ **Enhanced**: Multiple transports (file, HTTP, console)
- ✅ **Configurable**: Different log levels, formats
- ✅ **Optional**: Not needed for basic apps
- ✅ **Advanced**: Structured logging, log rotation

#### **2. Database Plugin (`src/plugins/database/`)**

```typescript
// Database connections and ORM
import { DatabasePlugin } from '@/plugins/database';

const dbPlugin = new DatabasePlugin({
  type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  username: 'user',
  password: 'pass',
});

dbPlugin.install(app);
```

**Why Plugin?**

- ✅ **Optional**: Not all apps need databases
- ✅ **Configurable**: Different database types
- ✅ **Advanced**: Connection pooling, migrations
- ✅ **Heavy**: Large dependency

#### **3. Authentication Plugin (`src/plugins/auth/`)**

```typescript
// JWT, OAuth, session management
import { AuthPlugin } from '@/plugins/auth';

const authPlugin = new AuthPlugin({
  secret: 'your-secret-key',
  algorithms: ['HS256'],
  expiresIn: '24h',
});

authPlugin.install(app);
```

**Why Plugin?**

- ✅ **Optional**: Not all apps need auth
- ✅ **Configurable**: Different auth strategies
- ✅ **Advanced**: JWT, OAuth, sessions
- ✅ **Security**: Sensitive configuration

#### **4. WebSocket Plugin (`src/plugins/websocket/`)**

```typescript
// Real-time communication
import { WebSocketPlugin } from '@/plugins/websocket';

const wsPlugin = new WebSocketPlugin({
  path: '/ws',
  heartbeat: 30000,
});

wsPlugin.install(app);
```

**Why Plugin?**

- ✅ **Optional**: Not all apps need WebSockets
- ✅ **Advanced**: Real-time features
- ✅ **Complex**: Event handling, rooms
- ✅ **Heavy**: Additional protocols

#### **5. GraphQL Plugin (`src/plugins/graphql/`)**

```typescript
// GraphQL endpoint
import { GraphQLPlugin } from '@/plugins/graphql';

const graphqlPlugin = new GraphQLPlugin({
  schema: userSchema,
  resolvers: userResolvers,
  playground: true,
});

graphqlPlugin.install(app);
```

**Why Plugin?**

- ✅ **Optional**: Alternative to REST
- ✅ **Advanced**: Complex queries
- ✅ **Heavy**: Large dependency
- ✅ **Specialized**: Not for all apps

---

## ❌ **What NOT to Create as Plugins**

### **Already Built-in (Don't Duplicate!)**

```typescript
// ❌ DON'T CREATE THESE PLUGINS - Already built-in!

// ❌ Router Plugin - app.get() already exists
// ❌ Body Parser Plugin - app.json() already exists
// ❌ CORS Plugin - app.cors() already exists
// ❌ Helmet Plugin - app.helmet() already exists
// ❌ Compression Plugin - app.compression() already exists
// ❌ Rate Limiter Plugin - app.rateLimit() already exists
// ❌ Logger Plugin (Basic) - app.logger() already exists
// ❌ Request ID Plugin - app.requestId() already exists
// ❌ Timer Plugin - app.timer() already exists
```

---

## 🎯 **Plugin Creation Rules**

### **Rule 1: Check Built-in First**

```typescript
// ✅ DO: Check if it's already built-in
if (app.hasBuiltInFeature('cors')) {
  // Use app.cors() instead of creating plugin
}

// ❌ DON'T: Create plugin for built-in features
const corsPlugin = new CorsPlugin(); // ❌ Redundant!
```

### **Rule 2: Plugin Must Be Optional**

```typescript
// ✅ DO: Plugin is optional
const app = createApp();
// App works without any plugins

// ❌ DON'T: Make core functionality a plugin
const routerPlugin = new RouterPlugin(); // ❌ Core functionality!
```

### **Rule 3: Plugin Must Be Advanced**

```typescript
// ✅ DO: Advanced functionality
const loggerPlugin = new LoggerPlugin({
  transports: [fileTransport, httpTransport],
  format: 'json',
  rotation: true,
});

// ❌ DON'T: Basic functionality as plugin
const basicLoggerPlugin = new BasicLoggerPlugin(); // ❌ Too simple!
```

### **Rule 4: Plugin Must Be Configurable**

```typescript
// ✅ DO: Highly configurable
const dbPlugin = new DatabasePlugin({
  type: 'postgresql',
  host: 'localhost',
  port: 5432,
  pool: { min: 2, max: 10 },
  ssl: true,
});

// ❌ DON'T: Fixed configuration
const fixedPlugin = new FixedPlugin(); // ❌ No configuration!
```

---

## 📁 **File Structure Guidelines**

### **Core Structure**

```
src/core/
├── app/
│   ├── application.ts    # Main app class
│   └── context.ts        # Request/Response context
├── router/
│   └── index.ts          # Router class
├── middleware/
│   ├── body-parser.ts    # Built-in body parsing
│   ├── cors.ts           # Built-in CORS
│   ├── helmet.ts         # Built-in security
│   └── ...               # Other built-in middleware
└── enhancers/
    ├── request-enhancer.ts
    └── response-enhancer.ts
```

### **Plugin Structure**

```
src/plugins/
├── core/
│   └── base-plugin.ts    # Base plugin class
├── logger/
│   ├── logger.plugin.ts  # Enhanced logging
│   ├── transports/       # File, HTTP, Console
│   └── index.ts
├── database/
│   ├── database.plugin.ts # Database connections
│   ├── adapters/         # PostgreSQL, MySQL, etc.
│   └── index.ts
├── auth/
│   ├── auth.plugin.ts    # Authentication
│   ├── strategies/       # JWT, OAuth, etc.
│   └── index.ts
└── websocket/
    ├── websocket.plugin.ts # Real-time communication
    └── index.ts
```

---

## 🔧 **Plugin Development Guidelines**

### **1. Extend BasePlugin**

```typescript
import { BasePlugin } from '@/plugins/core/base-plugin';

export class MyPlugin extends BasePlugin {
  name = 'MyPlugin';

  constructor(private config: MyPluginConfig) {
    super();
  }

  install(app: Application): void {
    this.log('Installing MyPlugin');
    // Plugin logic here
    this.log('MyPlugin installed successfully');
  }

  onInit?(): void {
    // Optional initialization
  }

  onCleanup?(): void {
    // Optional cleanup
  }
}
```

### **2. Use Dependency Injection**

```typescript
// ✅ DO: Accept configuration
class DatabasePlugin extends BasePlugin {
  constructor(private config: DatabaseConfig) {
    super();
  }
}

// ❌ DON'T: Hard-code values
class DatabasePlugin extends BasePlugin {
  constructor() {
    super();
    this.host = 'localhost'; // ❌ Hard-coded!
  }
}
```

### **3. Provide Factory Functions**

```typescript
// ✅ DO: Provide factory function
export function createDatabasePlugin(config: DatabaseConfig): DatabasePlugin {
  return new DatabasePlugin(config);
}

// Usage
const dbPlugin = createDatabasePlugin({
  type: 'postgresql',
  host: 'localhost',
});
```

### **4. Handle Errors Gracefully**

```typescript
install(app: Application): void {
  try {
    this.log('Installing MyPlugin');
    // Plugin logic
    this.log('MyPlugin installed successfully');
  } catch (error) {
    this.log(`Failed to install MyPlugin: ${error}`);
    throw error;
  }
}
```

---

## 🧪 **Testing Guidelines**

### **Plugin Tests**

```typescript
// src/tests/unit/plugins/my-plugin.test.ts
describe('MyPlugin', () => {
  it('should install successfully', () => {
    const app = createApp();
    const plugin = new MyPlugin(config);
    expect(() => plugin.install(app)).not.toThrow();
  });

  it('should handle configuration', () => {
    const plugin = new MyPlugin({ option: 'value' });
    expect(plugin.config.option).toBe('value');
  });
});
```

### **Integration Tests**

```typescript
// src/tests/integration/my-plugin-integration.test.ts
describe('MyPlugin Integration', () => {
  it('should work with application', async () => {
    const app = createApp();
    const plugin = new MyPlugin(config);
    plugin.install(app);

    // Test plugin functionality
  });
});
```

---

## 📚 **Documentation Guidelines**

### **Plugin Documentation**

````markdown
# MyPlugin

## Installation

```typescript
import { MyPlugin } from '@/plugins/my-plugin';

const plugin = new MyPlugin({
  option: 'value',
});
plugin.install(app);
```
````

## Configuration

- `option` (string): Description of option

## Usage

```typescript
// Example usage
```

````

---

## 🚫 **Common Mistakes to Avoid**

### **1. Duplicating Built-in Features**
```typescript
// ❌ DON'T: Create plugin for built-in feature
class RouterPlugin extends BasePlugin {
  install(app: Application) {
    app.get = (path, handler) => { /* custom logic */ }; // ❌ Override built-in!
  }
}
````

### **2. Making Core Features Optional**

```typescript
// ❌ DON'T: Make routing a plugin
const routerPlugin = new RouterPlugin(); // ❌ Routing is core!
routerPlugin.install(app);
```

### **3. Creating Simple Plugins**

```typescript
// ❌ DON'T: Create plugin for simple functionality
class SimpleLoggerPlugin extends BasePlugin {
  install(app: Application) {
    app.use((req, res, next) => {
      console.log(`${req.method} ${req.url}`); // ❌ Too simple!
      next();
    });
  }
}
```

### **4. Hard-coding Configuration**

```typescript
// ❌ DON'T: Hard-code values
class DatabasePlugin extends BasePlugin {
  install(app: Application) {
    this.connection = connect('localhost:5432'); // ❌ Hard-coded!
  }
}
```

---

## ✅ **Summary: When to Create Plugins**

### **Create Plugin When:**

- ✅ **Optional**: Not needed for basic apps
- ✅ **Advanced**: Complex functionality
- ✅ **Configurable**: Multiple configuration options
- ✅ **Heavy**: Large dependencies or performance impact
- ✅ **Specialized**: Not for all use cases

### **Don't Create Plugin When:**

- ❌ **Built-in**: Already available in core
- ❌ **Core**: Essential for all apps
- ❌ **Simple**: Basic functionality
- ❌ **Fixed**: No configuration needed

---

## 🎯 **Current Plugin Status**

### **✅ Implemented:**

- `LoggerPlugin` - Enhanced logging with transports

### **🔄 Planned:**

- `DatabasePlugin` - Database connections
- `AuthPlugin` - Authentication
- `WebSocketPlugin` - Real-time communication
- `GraphQLPlugin` - GraphQL support

### **❌ Removed (Duplication):**

- `RouterPlugin` - Duplicated built-in routing
- `BodyParserPlugin` - Duplicated built-in body parsing

---

This guideline ensures we maintain a clean, non-duplicated architecture where core features are always available and plugins provide enhanced, optional functionality.
