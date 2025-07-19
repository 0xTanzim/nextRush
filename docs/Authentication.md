# 🔐 Authentication

## 📚 Table of Contents

- [📖 Introduction](#-introduction)
- [🔧 Public APIs](#-public-apis)
  - [⚙️ Authentication Configuration](#️-authentication-configuration)
  - [🔑 JWT Methods](#-jwt-methods)
  - [🛡️ Authentication Middleware](#️-authentication-middleware)
  - [💾 Session Management](#-session-management)
  - [👥 Role Management](#-role-management)
  - [📋 Configuration Interfaces](#-configuration-interfaces)
- [💻 Usage Examples](#-usage-examples)
- [⚙️ Configuration Options](#️-configuration-options)
- [📝 Notes](#-notes)

## 📖 Introduction

The NextRush framework provides a comprehensive authentication system that supports JWT (JSON Web Tokens), session-based authentication, and Role-Based Access Control (RBAC). The authentication plugin offers secure route guards, user permissions management, and flexible authentication strategies to protect your application's resources.

## 🔧 Public APIs

### ⚙️ Authentication Configuration

| Method                | Signature                                  | Description                             |
| --------------------- | ------------------------------------------ | --------------------------------------- |
| `useJwt(options)`     | `(options: JwtOptions) => Application`     | Configure JWT authentication.           |
| `useSession(options)` | `(options: SessionOptions) => Application` | Configure session-based authentication. |

### 🔑 JWT Methods

| Method                       | Signature                                                                     | Description                    |
| ---------------------------- | ----------------------------------------------------------------------------- | ------------------------------ |
| `signJwt(payload, options?)` | `(payload: Record<string, unknown>, options?: Partial<JwtOptions>) => string` | Sign a JWT token with payload. |
| `verifyJwt(token, options?)` | `(token: string, options?: Partial<JwtOptions>) => JwtPayload`                | Verify and decode a JWT token. |

### 🛡️ Authentication Middleware

| Method                                | Signature                                                  | Description                              |
| ------------------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| `requireAuth(strategy?)`              | `(strategy?: 'jwt' \| 'session') => MiddlewareFunction`    | Require authentication for routes.       |
| `requireRole(...roles)`               | `(...roles: string[]) => MiddlewareFunction`               | Require specific roles for access.       |
| `requirePermission(resource, action)` | `(resource: string, action: string) => MiddlewareFunction` | Require specific permissions for access. |

### 💾 Session Management

| Method                         | Signature                                                                   | Description           |
| ------------------------------ | --------------------------------------------------------------------------- | --------------------- |
| `createSession(userId, data?)` | `(userId: string \| number, data?: Record<string, any>) => Promise<string>` | Create a new session. |
| `destroySession(sessionId)`    | `(sessionId: string) => Promise<void>`                                      | Destroy a session.    |

### 👥 Role Management

| Method             | Signature                             | Description                         |
| ------------------ | ------------------------------------- | ----------------------------------- |
| `defineRole(role)` | `(role: Role) => Application`         | Define a new role with permissions. |
| `getRole(name)`    | `(name: string) => Role \| undefined` | Get a role by name.                 |

### 📋 Configuration Interfaces

| Interface        | Description                             |
| ---------------- | --------------------------------------- |
| `JwtOptions`     | JWT configuration options.              |
| `SessionOptions` | Session configuration options.          |
| `User`           | User interface for authentication.      |
| `JwtPayload`     | JWT payload structure with type safety. |
| `Role`           | Role definition with permissions.       |
| `Permission`     | Permission structure for RBAC.          |

#### JwtOptions Properties

| Property    | Type                            | Default     | Description                    |
| ----------- | ------------------------------- | ----------- | ------------------------------ |
| `secret`    | `string`                        | _required_  | Secret key for signing tokens. |
| `algorithm` | `'HS256' \| 'HS384' \| 'HS512'` | `'HS256'`   | HMAC algorithm for signing.    |
| `expiresIn` | `string \| number`              | `'1h'`      | Token expiration time.         |
| `issuer`    | `string`                        | `undefined` | Token issuer.                  |
| `audience`  | `string`                        | `undefined` | Token audience.                |
| `notBefore` | `string \| number`              | `undefined` | Token not valid before time.   |

#### SessionOptions Properties

| Property   | Type                          | Default              | Description                      |
| ---------- | ----------------------------- | -------------------- | -------------------------------- |
| `secret`   | `string`                      | _required_           | Secret for session encryption.   |
| `name`     | `string`                      | `'session'`          | Session cookie name.             |
| `maxAge`   | `number`                      | `86400000`           | Session max age in milliseconds. |
| `secure`   | `boolean`                     | `false`              | Require HTTPS for cookies.       |
| `httpOnly` | `boolean`                     | `true`               | HTTP-only cookies.               |
| `sameSite` | `'strict' \| 'lax' \| 'none'` | `'lax'`              | SameSite cookie attribute.       |
| `rolling`  | `boolean`                     | `false`              | Reset expiry on activity.        |
| `store`    | `SessionStore`                | `MemorySessionStore` | Custom session store.            |

#### User Properties

| Property      | Type                       | Description               |
| ------------- | -------------------------- | ------------------------- |
| `id`          | `string \| number`         | User unique identifier.   |
| `username`    | `string?`                  | Username (optional).      |
| `email`       | `string?`                  | Email address (optional). |
| `roles`       | `string[]?`                | User roles.               |
| `permissions` | `string[]?`                | Direct user permissions.  |
| `metadata`    | `Record<string, unknown>?` | Additional user data.     |

#### Role Properties

| Property      | Type           | Description                   |
| ------------- | -------------- | ----------------------------- |
| `name`        | `string`       | Role name.                    |
| `permissions` | `Permission[]` | Role permissions.             |
| `inherits`    | `string[]?`    | Parent roles to inherit from. |

#### Permission Properties

| Property     | Type                   | Description                                    |
| ------------ | ---------------------- | ---------------------------------------------- |
| `resource`   | `string`               | Resource name (e.g., 'users', 'posts').        |
| `action`     | `string`               | Action name (e.g., 'read', 'write', 'delete'). |
| `conditions` | `Record<string, any>?` | Additional permission conditions.              |

## 💻 Usage Examples

### JWT Authentication Setup

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Configure JWT
app.useJwt({
  secret: 'your-super-secret-key',
  algorithm: 'HS256',
  expiresIn: '24h',
  issuer: 'your-app',
  audience: 'your-users',
});

// Login endpoint
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  // Verify credentials (implement your logic)
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

  res.json({
    token,
    user: { id: user.id, username: user.username },
  });
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
  secret: 'session-secret-key',
  name: 'app_session',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'strict',
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
  res.cookie('app_session', sessionId, {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });

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
  const sessionId = req.cookies.app_session;
  if (sessionId) {
    await app.destroySession(sessionId);
  }
  res.clearCookie('app_session');
  res.json({ message: 'Logged out successfully' });
});
```

### Role-Based Access Control (RBAC)

```typescript
import { createApp, CommonRoles } from 'nextrush';

const app = createApp();

// Define custom roles
app.defineRole({
  name: 'editor',
  permissions: [
    { resource: 'articles', action: 'create' },
    { resource: 'articles', action: 'read' },
    { resource: 'articles', action: 'update' },
    { resource: 'comments', action: 'read' },
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
});

// Use predefined roles
app.defineRole(CommonRoles.admin());
app.defineRole(CommonRoles.user());

// Protected routes with role requirements
app.get(
  '/admin',
  app.requireAuth('jwt'),
  app.requireRole('admin'),
  (req, res) => {
    res.json({ message: 'Admin dashboard' });
  }
);

app.post(
  '/articles',
  app.requireAuth('jwt'),
  app.requireRole('editor', 'author'),
  (req, res) => {
    // Create article logic
    res.json({ message: 'Article created' });
  }
);

app.delete(
  '/articles/:id',
  app.requireAuth('jwt'),
  app.requirePermission('articles', 'delete'),
  (req, res) => {
    // Delete article logic
    res.json({ message: 'Article deleted' });
  }
);
```

### Permission-Based Access Control

```typescript
// Fine-grained permission control
app.get(
  '/api/users/:id',
  app.requireAuth('jwt'),
  app.requirePermission('users', 'read'),
  (req, res) => {
    // Get user logic
    res.json({ user: getUserById(req.params.id) });
  }
);

app.put(
  '/api/users/:id',
  app.requireAuth('jwt'),
  app.requirePermission('users', 'update'),
  (req, res) => {
    // Update user logic
    res.json({ message: 'User updated' });
  }
);

// Wildcard permissions
app.defineRole({
  name: 'superadmin',
  permissions: [
    { resource: '*', action: '*' }, // All permissions
  ],
});
```

### Custom Session Store

```typescript
import { SessionStore, SessionData } from 'nextrush';

// Redis session store example
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

// Use custom session store
app.useSession({
  secret: 'session-secret',
  store: new RedisSessionStore(redisClient),
});
```

### Advanced JWT Usage

```typescript
// Custom JWT claims
const token = app.signJwt(
  {
    sub: user.id,
    username: user.username,
    roles: ['editor'],
    permissions: ['articles:read', 'articles:write'],
    metadata: {
      department: 'content',
      region: 'us-west',
    },
  },
  {
    expiresIn: '2h',
    audience: 'api-service',
  }
);

// Verify with custom options
try {
  const payload = app.verifyJwt(token, {
    audience: 'api-service',
  });
  console.log('Valid token:', payload);
} catch (error) {
  console.error('Invalid token:', error.message);
}

// Middleware with custom logic
app.use('/api/sensitive', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = app.verifyJwt(token);

    // Custom validation
    if (!payload.roles?.includes('admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});
```

## ⚙️ Configuration Options

### JWT Configuration

```typescript
app.useJwt({
  secret: process.env.JWT_SECRET || 'fallback-secret',
  algorithm: 'HS256',
  expiresIn: '24h',
  issuer: 'your-application',
  audience: 'your-api-users',
  notBefore: '0s', // Valid immediately
});
```

### Session Configuration

```typescript
app.useSession({
  secret: process.env.SESSION_SECRET || 'session-secret',
  name: 'connect.sid',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'strict',
  rolling: true, // Reset expiry on each request
  store: new CustomSessionStore(), // Optional custom store
});
```

### Environment-Based Configuration

```typescript
// Development configuration
if (process.env.NODE_ENV === 'development') {
  app.useJwt({
    secret: 'dev-secret-not-for-production',
    expiresIn: '7d', // Longer expiry for development
    algorithm: 'HS256',
  });
} else {
  // Production configuration
  app.useJwt({
    secret: process.env.JWT_SECRET, // From environment
    expiresIn: '15m', // Shorter expiry for security
    algorithm: 'HS256',
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
  });
}
```

## 📝 Notes

- **Security**: Always use strong, randomly generated secrets for JWT and session configuration. Store secrets in environment variables, never in code.
- **Token Expiry**: Choose appropriate expiry times for JWT tokens. Shorter expiry increases security but may impact user experience.
- **Session Storage**: The default `MemorySessionStore` is suitable for development but not for production. Use Redis or database-backed storage for production.
- **HTTPS Requirements**: Always use HTTPS in production when dealing with authentication tokens and session cookies.
- **Role Inheritance**: Roles can inherit permissions from parent roles, creating a hierarchy of access levels.
- **Permission Format**: Permissions use the format `resource:action` (e.g., `users:read`, `articles:write`). Wildcards (`*`) grant access to all resources or actions.
- **Request Context**: Authenticated user information is available on `req.user` after successful authentication middleware.
- **Error Handling**: Authentication middleware automatically returns appropriate HTTP status codes (401 for authentication failures, 403 for authorization failures).
- **Middleware Order**: Apply authentication middleware before authorization middleware (roles/permissions).
- **Session Cleanup**: The memory session store automatically cleans up expired sessions. Implement cleanup for custom stores.
