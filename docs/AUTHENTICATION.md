# 🔐 Authentication & Authorization Guide

NextRush provides a comprehensive authentication system with JWT, session-based auth, and Role-Based Access Control (RBAC). This guide covers all authentication features and best practices.

## Quick Start

```typescript
import { createApp, CommonRoles } from 'nextrush';

const app = createApp();

// Configure JWT authentication
app.useJwt({
  secret: 'your-secret-key',
  expiresIn: '1h'
});

// Configure session authentication
app.useSession({
  secret: 'session-secret',
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
});

// Define roles
app.defineRole(CommonRoles.admin());
app.defineRole(CommonRoles.user());

app.listen(3000);
```

## JWT Authentication

### Basic JWT Setup

```typescript
app.useJwt({
  secret: process.env.JWT_SECRET,
  algorithm: 'HS256',
  expiresIn: '1h',
  issuer: 'your-app',
  audience: 'your-users'
});

// Sign tokens
app.post('/auth/login', async (req, res) => {
  // Validate credentials
  const user = await validateUser(req.body.email, req.body.password);
  
  if (user) {
    const token = app.signJwt({
      sub: user.id,
      email: user.email,
      roles: user.roles
    });
    
    res.json({ token, user });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});
```

### JWT Verification

```typescript
// Verify tokens
app.get('/auth/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.slice(7); // Remove 'Bearer '
    const payload = app.verifyJwt(token);
    res.json({ valid: true, payload });
  } catch (error) {
    res.status(401).json({ valid: false, error: error.message });
  }
});
```

### Protected Routes with JWT

```typescript
// Require JWT authentication
app.get('/api/profile', 
  app.requireAuth('jwt'),
  (req, res) => {
    res.json({ user: req.user });
  }
);

// With role requirements
app.get('/api/admin', 
  app.requireAuth('jwt'),
  app.requireRole('admin'),
  (req, res) => {
    res.json({ message: 'Admin access granted' });
  }
);
```

## Session Authentication

### Session Configuration

```typescript
app.useSession({
  secret: process.env.SESSION_SECRET,
  name: 'sessionId', // Cookie name
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  httpOnly: true, // Prevent XSS
  sameSite: 'strict' // CSRF protection
});
```

### Custom Session Store

```typescript
import Redis from 'ioredis';

class RedisSessionStore implements SessionStore {
  private redis: Redis;
  
  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }
  
  async get(sessionId: string): Promise<SessionData | undefined> {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : undefined;
  }
  
  async set(sessionId: string, data: SessionData): Promise<void> {
    const ttl = Math.ceil((data.expiresAt - Date.now()) / 1000);
    await this.redis.setex(`session:${sessionId}`, ttl, JSON.stringify(data));
  }
  
  async destroy(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
  }
  
  async cleanup(): Promise<void> {
    // Redis handles TTL automatically
  }
}

app.useSession({
  secret: 'session-secret',
  store: new RedisSessionStore('redis://localhost:6379')
});
```

### Session Management

```typescript
// Create session
app.post('/auth/login', async (req, res) => {
  const user = await validateUser(req.body.email, req.body.password);
  
  if (user) {
    const sessionId = await app.createSession(user.id, {
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles
      }
    });
    
    // Set session cookie
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });
    
    res.json({ success: true, user });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Logout
app.post('/auth/logout', async (req, res) => {
  const sessionId = req.cookies.sessionId;
  if (sessionId) {
    await app.destroySession(sessionId);
    res.clearCookie('sessionId');
  }
  res.json({ success: true });
});
```

## Role-Based Access Control (RBAC)

### Defining Roles

```typescript
// Basic roles
app.defineRole({
  name: 'user',
  permissions: [
    { resource: 'profile', action: 'read' },
    { resource: 'profile', action: 'update' }
  ]
});

app.defineRole({
  name: 'moderator',
  permissions: [
    { resource: 'content', action: 'read' },
    { resource: 'content', action: 'update' },
    { resource: 'content', action: 'delete' },
    { resource: 'users', action: 'read' }
  ],
  inherits: ['user'] // Inherit user permissions
});

app.defineRole({
  name: 'admin',
  permissions: [
    { resource: '*', action: '*' } // All permissions
  ]
});
```

### Permission-Based Access Control

```typescript
// Check specific permissions
app.get('/api/users', 
  app.requireAuth(),
  app.requirePermission('users', 'read'),
  (req, res) => {
    res.json({ users: [] });
  }
);

app.delete('/api/users/:id', 
  app.requireAuth(),
  app.requirePermission('users', 'delete'),
  (req, res) => {
    res.json({ success: true });
  }
);
```

### Dynamic Permissions

```typescript
// Resource-specific permissions
app.get('/api/posts/:id', 
  app.requireAuth(),
  async (req, res, next) => {
    const post = await getPost(req.params.id);
    
    // Check if user owns the post or has admin permissions
    if (post.authorId === req.user.id || 
        req.user.roles.includes('admin')) {
      next();
    } else {
      res.status(403).json({ error: 'Access denied' });
    }
  },
  (req, res) => {
    res.json({ post });
  }
);
```

## Advanced Authentication Features

### Multi-Factor Authentication (MFA)

```typescript
import { authenticator } from 'otplib';

// Generate MFA secret
app.post('/auth/mfa/setup', 
  app.requireAuth(),
  (req, res) => {
    const secret = authenticator.generateSecret();
    const qrCode = authenticator.keyuri(
      req.user.email, 
      'YourApp', 
      secret
    );
    
    // Save secret to user (temporarily)
    res.json({ secret, qrCode });
  }
);

// Verify MFA token
app.post('/auth/mfa/verify', 
  app.requireAuth(),
  (req, res) => {
    const { token, secret } = req.body;
    const isValid = authenticator.verify({ token, secret });
    
    if (isValid) {
      // Enable MFA for user
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Invalid MFA token' });
    }
  }
);
```

### OAuth Integration

```typescript
// OAuth callback handler
app.get('/auth/oauth/callback', async (req, res) => {
  const { code, state } = req.query;
  
  try {
    // Exchange code for access token
    const tokenResponse = await exchangeCodeForToken(code, state);
    const userInfo = await fetchUserInfo(tokenResponse.access_token);
    
    // Create or update user
    const user = await createOrUpdateUser(userInfo);
    
    // Create session
    const sessionId = await app.createSession(user.id, { user });
    
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: true
    });
    
    res.redirect('/dashboard');
  } catch (error) {
    res.status(400).json({ error: 'OAuth authentication failed' });
  }
});
```

### API Key Authentication

```typescript
// API key middleware
const apiKeyAuth = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  const user = await validateApiKey(apiKey);
  if (!user) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  req.user = user;
  next();
};

// Use API key authentication
app.get('/api/data', apiKeyAuth, (req, res) => {
  res.json({ data: 'API response' });
});
```

## Security Best Practices

### Password Security

```typescript
import bcrypt from 'bcrypt';

// Hash passwords
const hashPassword = async (password: string) => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

// Verify passwords
const verifyPassword = async (password: string, hash: string) => {
  return bcrypt.compare(password, hash);
};

// Registration with secure password handling
app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;
  
  // Validate password strength
  if (password.length < 8) {
    return res.status(400).json({ 
      error: 'Password must be at least 8 characters' 
    });
  }
  
  const hashedPassword = await hashPassword(password);
  const user = await createUser({ email, password: hashedPassword });
  
  res.json({ success: true, user: { id: user.id, email: user.email } });
});
```

### Rate Limiting for Auth

```typescript
// Strict rate limiting for authentication endpoints
app.use('/auth/login', app.useRateLimit({
  max: 5, // 5 attempts
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many login attempts'
}));

app.use('/auth/register', app.useRateLimit({
  max: 3, // 3 registrations
  windowMs: 60 * 60 * 1000, // 1 hour
  keyGenerator: (req) => req.ip
}));
```

### Secure Headers

```typescript
// Add security headers for auth endpoints
app.use('/auth/*', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 
      'max-age=31536000; includeSubDomains');
  }
  
  next();
});
```

## Integration Examples

### With Validation

```typescript
app.post('/auth/login',
  app.validate({
    email: { required: true, type: 'email' },
    password: { required: true, minLength: 8 }
  }),
  async (req, res) => {
    // Login logic
  }
);
```

### With CORS

```typescript
// Allow credentials for auth endpoints
app.use('/auth/*', app.cors({
  origin: ['https://yourapp.com'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### With Metrics

```typescript
// Track authentication metrics
app.post('/auth/login', 
  (req, res, next) => {
    app.incrementCounter('auth.login.attempts');
    next();
  },
  async (req, res) => {
    const user = await validateUser(req.body.email, req.body.password);
    
    if (user) {
      app.incrementCounter('auth.login.success');
      // Success logic
    } else {
      app.incrementCounter('auth.login.failure');
      // Failure logic
    }
  }
);
```

## Testing Authentication

### Unit Tests

```typescript
import { describe, it, expect } from 'jest';

describe('JWT Authentication', () => {
  it('should sign and verify tokens', () => {
    const payload = { sub: '123', email: 'test@example.com' };
    const token = app.signJwt(payload);
    const verified = app.verifyJwt(token);
    
    expect(verified.sub).toBe(payload.sub);
    expect(verified.email).toBe(payload.email);
  });
  
  it('should reject expired tokens', () => {
    const token = app.signJwt({ sub: '123' }, { expiresIn: '1ms' });
    
    setTimeout(() => {
      expect(() => app.verifyJwt(token)).toThrow('JWT expired');
    }, 10);
  });
});
```

### Integration Tests

```typescript
import supertest from 'supertest';

describe('Authentication API', () => {
  it('should login with valid credentials', async () => {
    const response = await supertest(app)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      })
      .expect(200);
    
    expect(response.body.token).toBeDefined();
  });
  
  it('should protect routes', async () => {
    await supertest(app)
      .get('/api/profile')
      .expect(401);
    
    const token = 'valid-jwt-token';
    await supertest(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
```

This authentication system provides enterprise-grade security while maintaining developer-friendly APIs and comprehensive feature coverage.
