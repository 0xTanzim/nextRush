# 📚 API Documentation Generator Guide

NextRush includes a powerful API documentation generator that automatically creates OpenAPI/Swagger documentation from your routes and serves an interactive documentation interface.

## Quick Start

```typescript
import { createApp, CommonSchemas } from 'nextrush';

const app = createApp();

// Enable API documentation
app.enableApiDocs({
  title: 'My API',
  description: 'RESTful API built with NextRush',
  version: '1.0.0',
});

// Document your routes
app.doc('/api/users', 'GET', {
  summary: 'Get all users',
  description: 'Retrieve a list of all users',
  responses: {
    '200': {
      description: 'List of users',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: { $ref: '#/components/schemas/User' },
          },
        },
      },
    },
  },
});

// Access documentation
// GET /swagger - Interactive Swagger UI
// GET /docs - Redirect to Swagger UI
// GET /api-docs.json - OpenAPI JSON specification

app.listen(3000);
```

## Configuration Options

### Basic Configuration

```typescript
app.enableApiDocs({
  title: 'NextRush API',
  description: 'Comprehensive API documentation',
  version: '2.1.0',
  docsPath: '/docs',
  swaggerUiPath: '/swagger',
  jsonPath: '/api-docs.json',
  enableSwaggerUI: true,
});
```

### Advanced Configuration

```typescript
app.enableApiDocs({
  title: 'Enterprise API',
  description: 'Production-ready API with comprehensive documentation',
  version: '1.0.0',

  // Server configuration
  servers: [
    {
      url: 'https://api.example.com/v1',
      description: 'Production server',
    },
    {
      url: 'https://staging-api.example.com/v1',
      description: 'Staging server',
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],

  // Contact information
  contact: {
    name: 'API Support',
    url: 'https://example.com/support',
    email: 'api-support@example.com',
  },

  // License information
  license: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT',
  },

  // API tags for organization
  tags: [
    {
      name: 'Users',
      description: 'User management operations',
    },
    {
      name: 'Posts',
      description: 'Blog post operations',
    },
    {
      name: 'Auth',
      description: 'Authentication and authorization',
    },
  ],

  // External documentation
  externalDocs: {
    description: 'Find more info here',
    url: 'https://docs.example.com',
  },
});
```

## Documenting Routes

### Basic Route Documentation

```typescript
// Simple GET endpoint
app.doc('/api/users/:id', 'GET', {
  summary: 'Get user by ID',
  description: 'Retrieve a specific user by their unique identifier',
  tags: ['Users'],
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      description: 'User ID',
      schema: { type: 'string' },
    },
  ],
  responses: {
    '200': {
      description: 'User found',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/User' },
        },
      },
    },
    '404': {
      description: 'User not found',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Error' },
        },
      },
    },
  },
});

// Implement the route
app.get('/api/users/:id', (req, res) => {
  const user = getUserById(req.params.id);
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});
```

### POST Endpoint with Request Body

```typescript
app.doc('/api/users', 'POST', {
  summary: 'Create new user',
  description: 'Create a new user account',
  tags: ['Users'],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/CreateUserRequest' },
      },
    },
  },
  responses: {
    '201': {
      description: 'User created successfully',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/User' },
        },
      },
    },
    '400': {
      description: 'Invalid input',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ValidationError' },
        },
      },
    },
  },
});
```

### Query Parameters

```typescript
app.doc('/api/users', 'GET', {
  summary: 'List users with pagination',
  description: 'Get a paginated list of users with optional filtering',
  tags: ['Users'],
  parameters: [
    {
      name: 'page',
      in: 'query',
      description: 'Page number (1-based)',
      schema: { type: 'integer', minimum: 1, default: 1 },
    },
    {
      name: 'limit',
      in: 'query',
      description: 'Number of users per page',
      schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
    {
      name: 'search',
      in: 'query',
      description: 'Search users by name or email',
      schema: { type: 'string' },
    },
    {
      name: 'role',
      in: 'query',
      description: 'Filter by user role',
      schema: {
        type: 'string',
        enum: ['admin', 'user', 'moderator'],
      },
    },
  ],
  responses: {
    '200': {
      description: 'List of users',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/UserListResponse' },
        },
      },
    },
  },
});
```

### Authentication Documentation

```typescript
app.doc('/api/protected-endpoint', 'GET', {
  summary: 'Protected endpoint',
  description: 'Requires valid JWT token',
  tags: ['Protected'],
  security: [{ bearerAuth: [] }],
  responses: {
    '200': { description: 'Success' },
    '401': { description: 'Unauthorized' },
    '403': { description: 'Forbidden' },
  },
});
```

## Schema Definitions

### Adding Schemas

```typescript
// Define reusable schemas
app.addSchema('User', {
  type: 'object',
  required: ['id', 'email', 'createdAt'],
  properties: {
    id: {
      type: 'string',
      description: 'Unique user identifier',
      example: 'user_123',
    },
    email: {
      type: 'string',
      format: 'email',
      description: 'User email address',
      example: 'user@example.com',
    },
    name: {
      type: 'string',
      description: 'User full name',
      example: 'John Doe',
    },
    role: {
      type: 'string',
      enum: ['admin', 'user', 'moderator'],
      description: 'User role',
      example: 'user',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'Account creation timestamp',
      example: '2023-07-19T10:30:00Z',
    },
    profile: {
      $ref: '#/components/schemas/UserProfile',
    },
  },
});

app.addSchema('UserProfile', {
  type: 'object',
  properties: {
    avatar: {
      type: 'string',
      format: 'uri',
      description: 'Profile picture URL',
    },
    bio: {
      type: 'string',
      description: 'User biography',
      maxLength: 500,
    },
    location: {
      type: 'string',
      description: 'User location',
    },
  },
});

app.addSchema('CreateUserRequest', {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: {
      type: 'string',
      format: 'email',
      description: 'User email address',
    },
    password: {
      type: 'string',
      minLength: 8,
      description: 'User password (minimum 8 characters)',
    },
    name: {
      type: 'string',
      description: 'User full name',
    },
  },
});
```

### Using Common Schemas

```typescript
// Use predefined common schemas
app.addSchema('Error', CommonSchemas.Error());
app.addSchema(
  'UserListResponse',
  CommonSchemas.PaginatedResponse({
    $ref: '#/components/schemas/User',
  })
);
app.addSchema(
  'SuccessResponse',
  CommonSchemas.SuccessResponse({
    $ref: '#/components/schemas/User',
  })
);
```

## Security Schemes

### JWT Authentication

```typescript
app.addSecurityScheme('bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'JWT token for API authentication',
});
```

### API Key Authentication

```typescript
app.addSecurityScheme('apiKey', {
  type: 'apiKey',
  in: 'header',
  name: 'X-API-Key',
  description: 'API key for external service access',
});
```

### OAuth2

```typescript
app.addSecurityScheme('oauth2', {
  type: 'oauth2',
  description: 'OAuth2 authentication',
  flows: {
    authorizationCode: {
      authorizationUrl: 'https://auth.example.com/oauth/authorize',
      tokenUrl: 'https://auth.example.com/oauth/token',
      scopes: {
        'read:users': 'Read user information',
        'write:users': 'Modify user information',
        admin: 'Administrative access',
      },
    },
  },
});
```

## Advanced Features

### Custom Examples

```typescript
app.doc('/api/users', 'POST', {
  summary: 'Create user with examples',
  requestBody: {
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/CreateUserRequest' },
        examples: {
          admin: {
            summary: 'Admin user example',
            description: 'Example of creating an admin user',
            value: {
              email: 'admin@example.com',
              password: 'secure_password_123',
              name: 'Admin User',
              role: 'admin',
            },
          },
          regular: {
            summary: 'Regular user example',
            description: 'Example of creating a regular user',
            value: {
              email: 'user@example.com',
              password: 'user_password_456',
              name: 'John Doe',
            },
          },
        },
      },
    },
  },
});
```

### Response Headers

```typescript
app.doc('/api/users', 'GET', {
  summary: 'List users with custom headers',
  responses: {
    '200': {
      description: 'Success',
      headers: {
        'X-Total-Count': {
          description: 'Total number of users',
          schema: { type: 'integer' },
        },
        'X-Page-Count': {
          description: 'Total number of pages',
          schema: { type: 'integer' },
        },
        'X-Rate-Limit': {
          description: 'Requests remaining in current window',
          schema: { type: 'integer' },
        },
      },
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/UserListResponse' },
        },
      },
    },
  },
});
```

### File Upload Documentation

```typescript
app.doc('/api/users/:id/avatar', 'POST', {
  summary: 'Upload user avatar',
  description: 'Upload a new profile picture for the user',
  tags: ['Users'],
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
    },
  ],
  requestBody: {
    content: {
      'multipart/form-data': {
        schema: {
          type: 'object',
          properties: {
            avatar: {
              type: 'string',
              format: 'binary',
              description: 'Avatar image file',
            },
            description: {
              type: 'string',
              description: 'Optional description',
            },
          },
        },
      },
    },
  },
  responses: {
    '200': {
      description: 'Avatar uploaded successfully',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                format: 'uri',
                description: 'URL of uploaded avatar',
              },
            },
          },
        },
      },
    },
  },
});
```

## Integration with Other Features

### With Validation

```typescript
// Combine documentation with validation
const userSchema = {
  email: { required: true, type: 'email' },
  password: { required: true, minLength: 8 },
  name: { required: false, type: 'string' },
};

app.post('/api/users', app.validate(userSchema), (req, res) => {
  // Route logic
});

// Auto-generate documentation from validation schema
app.doc('/api/users', 'POST', {
  summary: 'Create user',
  requestBody: {
    content: {
      'application/json': {
        schema: validationSchemaToOpenAPI(userSchema),
      },
    },
  },
});
```

### With Authentication

```typescript
// Document protected routes
app.get(
  '/api/admin/users',
  app.requireAuth('jwt'),
  app.requireRole('admin'),
  (req, res) => {
    // Admin logic
  }
);

app.doc('/api/admin/users', 'GET', {
  summary: 'Admin: List all users',
  description: 'Requires admin role',
  tags: ['Admin'],
  security: [{ bearerAuth: [] }],
  responses: {
    '200': { description: 'Success' },
    '401': { description: 'Authentication required' },
    '403': { description: 'Admin role required' },
  },
});
```

## Customizing Swagger UI

### Custom CSS

```typescript
app.get('/swagger', (req, res) => {
  const customCSS = `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #1976d2; }
    .swagger-ui .scheme-container { background: #f5f5f5; }
  `;

  const html = generateSwaggerUI().replace(
    '</head>',
    `<style>${customCSS}</style></head>`
  );

  res.send(html);
});
```

### Custom Logo

```typescript
app.enableApiDocs({
  title: 'My API',
  // Custom Swagger UI configuration
  swaggerUIConfig: {
    customCss: `
      .topbar-wrapper img[alt="Swagger UI"] {
        content: url('https://example.com/logo.png');
        height: 40px;
      }
    `,
    customSiteTitle: 'My API Documentation',
  },
});
```

## Best Practices

### 1. Organize with Tags

```typescript
// Group related endpoints
const TAGS = {
  AUTH: 'Authentication',
  USERS: 'User Management',
  POSTS: 'Blog Posts',
  ADMIN: 'Administration',
};

app.doc('/auth/login', 'POST', { tags: [TAGS.AUTH] });
app.doc('/api/users', 'GET', { tags: [TAGS.USERS] });
app.doc('/api/posts', 'GET', { tags: [TAGS.POSTS] });
```

### 2. Consistent Error Responses

```typescript
// Define standard error schemas
app.addSchema('ValidationError', {
  type: 'object',
  required: ['error', 'message', 'details'],
  properties: {
    error: { type: 'string', example: 'Validation Error' },
    message: { type: 'string', example: 'Request validation failed' },
    details: {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: { type: 'string' },
      },
      example: {
        email: ['Must be a valid email address'],
        password: ['Must be at least 8 characters'],
      },
    },
  },
});

// Use consistently across all endpoints
const standardResponses = {
  '400': {
    description: 'Validation error',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ValidationError' },
      },
    },
  },
  '401': {
    description: 'Authentication required',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
      },
    },
  },
  '500': {
    description: 'Internal server error',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
      },
    },
  },
};
```

### 3. Version Your API

```typescript
app.enableApiDocs({
  title: 'My API',
  version: '2.0.0',
  servers: [
    {
      url: 'https://api.example.com/v2',
      description: 'Production v2',
    },
    {
      url: 'https://api.example.com/v1',
      description: 'Legacy v1 (deprecated)',
    },
  ],
});
```

### 4. Document Rate Limits

```typescript
app.doc('/api/users', 'GET', {
  summary: 'List users',
  description: 'Rate limited to 100 requests per hour',
  responses: {
    '200': { description: 'Success' },
    '429': {
      description: 'Rate limit exceeded',
      headers: {
        'Retry-After': {
          description: 'Seconds to wait before retry',
          schema: { type: 'integer' },
        },
      },
    },
  },
});
```

This API documentation system provides comprehensive, interactive documentation that keeps developers informed and APIs well-documented automatically.
