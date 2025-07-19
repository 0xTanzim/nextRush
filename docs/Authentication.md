# 🔐 Authentication & Authorization

## 📚 Table of Contents

- [🎯 Quick Start](#-quick-start)
- [🔧 API Reference](#-api-reference)
  - [Configuration Methods](#configuration-methods)
  - [JWT Operations](#jwt-operations)
  - [Session Management](#session-management)
  - [Authentication Middleware](#authentication-middleware)
  - [Authorization (RBAC)](#authorization-rbac)
  - [Utility Methods](#utility-methods)
- [💻 Usage Examples](#-usage-examples)
- [⚙️ Configuration](#️-configuration)
- [📋 Type Definitions](#-type-definitions)
- [� Advanced Features](#-advanced-features)
- [� Best Practices](#-best-practices)

## 🎯 Quick Start

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// 1. Configure authentication
app.useJwt({
  secret: 'your-super-secret-key',
  expiresIn: '24h',
});

// 2. Create a login endpoint
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  // Verify user credentials (your logic)
  const user = await authenticateUser(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Create JWT token
  const token = app.signJwt({
    sub: user.id,
    username: user.username,
    roles: user.roles,
  });

  res.json({ token, user: { id: user.id, username: user.username } });
});

// 3. Protect routes
app.get('/profile', app.requireAuth(), (req, res) => {
  res.json({ user: req.user });
});

// 4. Add role-based protection
app.get('/admin', app.requireAuth(), app.requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin dashboard' });
});

app.listen(3000);
```

## 🔧 API Reference

### Configuration Methods

| Method                  | Signature                                  | Description                            |
| ----------------------- | ------------------------------------------ | -------------------------------------- |
| `useJwt(options)`       | `(options: JwtOptions) => Application`     | Configure JWT authentication           |
| `useSession(options)`   | `(options: SessionOptions) => Application` | Configure session-based authentication |
| `configureAuth(config)` | `(config: AuthConfig) => Application`      | Configure complete auth system         |

### JWT Operations

| Method                          | Signature                                                                     | Description                     |
| ------------------------------- | ----------------------------------------------------------------------------- | ------------------------------- |
| `signJwt(payload, options?)`    | `(payload: Record<string, unknown>, options?: Partial<JwtOptions>) => string` | Create a new JWT token          |
| `verifyJwt(token, options?)`    | `(token: string, options?: Partial<JwtOptions>) => JwtPayload`                | Verify and decode JWT token     |
| `decodeJwt(token)`              | `(token: string) => JwtPayload \| null`                                       | Decode JWT without verification |
| `refreshJwt(token, newExpiry?)` | `(token: string, newExpiry?: string \| number) => string`                     | Refresh JWT with new expiration |

### Session Management

| Method                           | Signature                                                                   | Description                |
| -------------------------------- | --------------------------------------------------------------------------- | -------------------------- |
| `createSession(userId, data?)`   | `(userId: string \| number, data?: Record<string, any>) => Promise<string>` | Create new session         |
| `getSession(sessionId)`          | `(sessionId: string) => Promise<SessionData \| undefined>`                  | Get session data           |
| `updateSession(sessionId, data)` | `(sessionId: string, data: Record<string, any>) => Promise<boolean>`        | Update session data        |
| `destroySession(sessionId)`      | `(sessionId: string) => Promise<void>`                                      | Destroy session            |
| `touchSession(sessionId)`        | `(sessionId: string) => Promise<boolean>`                                   | Update session access time |
| `getSessionStats()`              | `() => Promise<{totalSessions: number, activeSessions: number}>`            | Get session statistics     |

### Authentication Middleware

| Method                          | Signature                                               | Description                        |
| ------------------------------- | ------------------------------------------------------- | ---------------------------------- |
| `requireAuth(strategy?)`        | `(strategy?: 'jwt' \| 'session') => MiddlewareFunction` | Require authentication             |
| `optionalAuth(strategy?)`       | `(strategy?: 'jwt' \| 'session') => MiddlewareFunction` | Optional authentication            |
| `requireAnyAuth(...strategies)` | `(...strategies: AuthStrategy[]) => MiddlewareFunction` | Accept any authentication strategy |

### Authorization (RBAC)

| Method                                  | Signature                                                   | Description                 |
| --------------------------------------- | ----------------------------------------------------------- | --------------------------- |
| `defineRole(role)`                      | `(role: Role) => Application`                               | Define a new role           |
| `getRole(name)`                         | `(name: string) => Role \| undefined`                       | Get role by name            |
| `getAllRoles()`                         | `() => Role[]`                                              | Get all defined roles       |
| `requireRole(...roles)`                 | `(...roles: string[]) => MiddlewareFunction`                | Require specific roles      |
| `requirePermission(resource, action)`   | `(resource: string, action: string) => MiddlewareFunction`  | Require specific permission |
| `hasPermission(user, resource, action)` | `(user: User, resource: string, action: string) => boolean` | Check user permission       |
| `getUserPermissions(user)`              | `(user: User) => Permission[]`                              | Get all user permissions    |

### Utility Methods

| Method                            | Signature                                                             | Description                         |
| --------------------------------- | --------------------------------------------------------------------- | ----------------------------------- |
| `getCurrentUser(req)`             | `(req: NextRushRequest) => User \| null`                              | Get authenticated user from request |
| `isAuthenticated(req, strategy?)` | `(req: NextRushRequest, strategy?: AuthStrategy) => Promise<boolean>` | Check if request is authenticated   |
| `getAuthInfo(req)`                | `(req: NextRushRequest) => Promise<AuthInfo>`                         | Get complete auth information       |
| `getAuthConfig()`                 | `() => Partial<AuthConfig>`                                           | Get current auth configuration      |
| `clearAuthCache()`                | `() => Application`                                                   | Clear permission cache              |

## 💻 Usage Examples

### Basic JWT Authentication

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Configure JWT
app.useJwt({
  secret: process.env.JWT_SECRET || 'your-secret-key',
  algorithm: 'HS256',
  expiresIn: '24h',
  issuer: 'your-app',
});

// Login endpoint
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  // Authenticate user (implement your logic)
  const user = await authenticateUser(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Create JWT token
  const token = app.signJwt({
    sub: user.id,
    username: user.username,
    roles: user.roles,
    permissions: user.permissions,
  });

  res.json({ token, user });
});

// Protected route
app.get('/api/profile', app.requireAuth('jwt'), (req, res) => {
  res.json({ user: req.user });
});

app.listen(3000);
```

### Session-Based Authentication

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Configure sessions
app.useSession({
  secret: process.env.SESSION_SECRET || 'session-secret',
  name: 'app_session',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'strict',
  rolling: true, // Extend session on activity
});

// Login with session
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await authenticateUser(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Create session
  const sessionId = await app.createSession(user.id, { user });

  // Set session cookie
  const cookieOptions = app.sessionManager?.getCookieOptions();
  res.cookie(cookieOptions.name, sessionId, cookieOptions);

  res.json({ message: 'Logged in successfully', user });
});

// Protected route with session
app.get('/api/dashboard', app.requireAuth('session'), (req, res) => {
  res.json({
    message: 'Welcome to dashboard',
    user: req.user,
  });
});

// Logout
app.post('/auth/logout', async (req, res) => {
  const cookieOptions = app.sessionManager?.getCookieOptions();
  const sessionId = req.cookies[cookieOptions.name];

  if (sessionId) {
    await app.destroySession(sessionId);
  }

  res.clearCookie(cookieOptions.name);
  res.json({ message: 'Logged out successfully' });
});
```

### Role-Based Access Control

```typescript
import { createApp, CommonRoles } from 'nextrush';

const app = createApp();

// Configure auth
app.useJwt({ secret: 'jwt-secret', expiresIn: '1h' });

// Define custom roles
app.defineRole({
  name: 'editor',
  permissions: [
    { resource: 'articles', action: 'create' },
    { resource: 'articles', action: 'read' },
    { resource: 'articles', action: 'update' },
    { resource: 'comments', action: 'moderate' },
  ],
});

app.defineRole({
  name: 'author',
  permissions: [
    { resource: 'articles', action: 'create' },
    { resource: 'articles', action: 'read' },
    { resource: 'articles', action: 'update', conditions: { owner: true } },
  ],
  inherits: ['user'], // Inherit from user role
});

// Use predefined roles
app.defineRole(CommonRoles.admin());
app.defineRole(CommonRoles.moderator());

// Role-protected routes
app.get('/admin/*', app.requireAuth(), app.requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin area' });
});

app.post(
  '/articles',
  app.requireAuth(),
  app.requireRole('editor', 'author'),
  (req, res) => {
    // Create article logic
    res.json({ message: 'Article created' });
  }
);

app.delete(
  '/articles/:id',
  app.requireAuth(),
  app.requirePermission('articles', 'delete'),
  (req, res) => {
    // Delete article logic
    res.json({ message: 'Article deleted' });
  }
);
```

### Advanced Authentication Features

```typescript
// Multi-strategy authentication
app.get('/api/data', app.requireAnyAuth('jwt', 'session'), (req, res) => {
  res.json({ data: 'sensitive-data', user: req.user });
});

// Optional authentication
app.get('/api/public', app.optionalAuth('jwt'), (req, res) => {
  const isAuthenticated = !!req.user;
  res.json({
    public: true,
    authenticated: isAuthenticated,
    user: req.user || null,
  });
});

// Manual authentication check
app.get('/api/check', async (req, res) => {
  const authInfo = await app.getAuthInfo(req);
  res.json(authInfo);
});

// JWT token refresh
app.post('/auth/refresh', (req, res) => {
  const { token } = req.body;

  try {
    const newToken = app.refreshJwt(token, '1h');
    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// Permission checking utility
app.get('/api/permissions', app.requireAuth(), (req, res) => {
  const user = req.user;
  const permissions = app.getUserPermissions(user);

  res.json({
    user: user.id,
    permissions,
    canEditArticles: app.hasPermission(user, 'articles', 'update'),
    canDeleteUsers: app.hasPermission(user, 'users', 'delete'),
  });
});
```

## ⚙️ Configuration

### JWT Configuration Options

```typescript
interface JwtOptions {
  secret: string; // Required: Secret key (min 32 chars)
  algorithm?: 'HS256' | 'HS384' | 'HS512'; // Default: 'HS256'
  expiresIn?: string | number; // Default: '1h' (1h, 7d, 3600)
  issuer?: string; // Token issuer
  audience?: string; // Token audience
  notBefore?: string | number; // Not valid before
}
```

### Session Configuration Options

```typescript
interface SessionOptions {
  secret: string; // Required: Session secret (min 32 chars)
  name?: string; // Default: 'session'
  maxAge?: number; // Default: 86400000 (24 hours)
  secure?: boolean; // Default: false (true for HTTPS)
  httpOnly?: boolean; // Default: true
  sameSite?: 'strict' | 'lax' | 'none'; // Default: 'lax'
  rolling?: boolean; // Default: false
  store?: SessionStore; // Custom session store
}
```

### Complete Auth Configuration

```typescript
interface AuthConfig {
  jwt?: JwtOptions;
  session?: SessionOptions;
  defaultStrategy?: 'jwt' | 'session';
  rateLimiting?: {
    enabled: boolean;
    maxAttempts: number;
    windowMs: number;
  };
}

// Usage
app.configureAuth({
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '15m',
    algorithm: 'HS256',
  },
  session: {
    secret: process.env.SESSION_SECRET,
    maxAge: 24 * 60 * 60 * 1000,
    rolling: true,
  },
  defaultStrategy: 'jwt',
});
```

## 📋 Type Definitions

### Core Interfaces

```typescript
interface User {
  id: string | number;
  username?: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  metadata?: Record<string, unknown>;
}

interface Role {
  name: string;
  permissions: Permission[];
  inherits?: string[];
}

interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

interface JwtPayload {
  sub?: string | number; // Subject (user ID)
  iss?: string; // Issuer
  aud?: string; // Audience
  exp?: number; // Expiration time
  nbf?: number; // Not before
  iat?: number; // Issued at
  roles?: string[]; // User roles
  permissions?: string[]; // User permissions
  [key: string]: unknown; // Additional claims
}
```

## 🚀 Advanced Features

### Custom Session Store

```typescript
import { SessionStore, SessionData } from 'nextrush';

class RedisSessionStore implements SessionStore {
  constructor(private redisClient: any) {}

  async get(sessionId: string): Promise<SessionData | undefined> {
    const data = await this.redisClient.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : undefined;
  }

  async set(sessionId: string, data: SessionData): Promise<void> {
    const ttl = Math.ceil((data.expiresAt - Date.now()) / 1000);
    await this.redisClient.setex(
      `session:${sessionId}`,
      ttl,
      JSON.stringify(data)
    );
  }

  async destroy(sessionId: string): Promise<void> {
    await this.redisClient.del(`session:${sessionId}`);
  }

  async cleanup(): Promise<void> {
    // Redis handles TTL automatically
  }
}

// Use custom store
app.useSession({
  secret: 'session-secret',
  store: new RedisSessionStore(redisClient),
});
```

### Dynamic Role Management

```typescript
// Create roles at runtime
app.post('/admin/roles', app.requireRole('admin'), (req, res) => {
  const { name, permissions, inherits } = req.body;

  app.defineRole({
    name,
    permissions: permissions.map((p) => ({
      resource: p.resource,
      action: p.action,
    })),
    inherits,
  });

  res.json({ message: `Role '${name}' created successfully` });
});

// Get all roles
app.get('/admin/roles', app.requireRole('admin'), (req, res) => {
  const roles = app.getAllRoles();
  res.json({ roles });
});
```

## 📝 Best Practices

### Security Best Practices

1. **Strong Secrets**: Use cryptographically strong secrets (min 32 characters)

   ```typescript
   // Good
   const jwtSecret = crypto.randomBytes(64).toString('hex');

   // Bad
   const jwtSecret = 'simple-secret';
   ```

2. **Environment Variables**: Store secrets in environment variables

   ```typescript
   app.useJwt({
     secret: process.env.JWT_SECRET, // From .env file
     expiresIn: process.env.JWT_EXPIRY || '15m',
   });
   ```

3. **HTTPS in Production**: Always use HTTPS for authentication

   ```typescript
   app.useSession({
     secure: process.env.NODE_ENV === 'production',
     sameSite: 'strict',
   });
   ```

4. **Short Token Expiry**: Use short-lived tokens for better security

   ```typescript
   app.useJwt({
     expiresIn: '15m', // Short expiry
   });

   // Implement refresh token mechanism
   ```

### Performance Best Practices

1. **Permission Caching**: The RBAC system automatically caches permissions

   ```typescript
   // Clear cache when roles change
   app.defineRole(newRole);
   app.clearAuthCache(); // Optional - done automatically
   ```

2. **Session Store**: Use Redis for production session storage

   ```typescript
   // Production
   app.useSession({
     store: new RedisSessionStore(redisClient),
   });

   // Development only
   app.useSession({
     store: new MemorySessionStore(), // Default
   });
   ```

3. **Middleware Order**: Place auth middleware before business logic

   ```typescript
   // Correct order
   app.use('/api', app.requireAuth());
   app.use('/api', businessLogicMiddleware);

   // Wrong order
   app.use('/api', businessLogicMiddleware);
   app.use('/api', app.requireAuth());
   ```

### Error Handling

```typescript
// Custom error handling
app.use((err, req, res, next) => {
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      refreshRequired: true,
    });
  }

  next(err);
});
```

### Testing Authentication

```typescript
// Test helper
function createTestUser(roles = ['user']) {
  return app.signJwt({
    sub: 'test-user-123',
    username: 'testuser',
    roles,
  });
}

// Use in tests
const token = createTestUser(['admin']);
const response = await request(app)
  .get('/admin/users')
  .set('Authorization', `Bearer ${token}`)
  .expect(200);
```
