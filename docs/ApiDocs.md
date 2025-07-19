# 📚 API Documentation Generator

## 📚 Table of Contents

- [📚 API Documentation Generator](#-api-documentation-generator)
  - [📚 Table of Contents](#-table-of-contents)
  - [📖 Introduction](#-introduction)
  - [🔧 Public APIs](#-public-apis)
    - [📋 Configuration Interfaces](#-configuration-interfaces)
      - [ApiDocsOptions Properties](#apidocsoptions-properties)
      - [RouteDocumentation Properties](#routedocumentation-properties)
    - [🛠️ Documentation Methods](#️-documentation-methods)
    - [📝 Route Metadata](#-route-metadata)
  - [💻 Usage Examples](#-usage-examples)
    - [Basic API Documentation](#basic-api-documentation)
    - [Advanced API Documentation](#advanced-api-documentation)
    - [Product API with Comprehensive Documentation](#product-api-with-comprehensive-documentation)
    - [API Documentation with Components](#api-documentation-with-components)
  - [⚙️ Configuration Options](#️-configuration-options)
    - [Production Configuration](#production-configuration)
    - [Development Configuration](#development-configuration)
  - [📝 Notes](#-notes)

## 📖 Introduction

The NextRush API Documentation Generator plugin automatically generates OpenAPI/Swagger documentation from route metadata and serves interactive documentation interfaces. It provides automatic API discovery, comprehensive schema generation, and built-in Swagger UI for testing and exploration.

## 🔧 Public APIs

### 📋 Configuration Interfaces

| Interface              | Description                                   |
| ---------------------- | --------------------------------------------- |
| `ApiDocsOptions`       | Main API documentation configuration options. |
| `RouteDocumentation`   | Route-specific documentation metadata.        |
| `ServerObject`         | API server configuration.                     |
| `AuthenticationScheme` | Authentication scheme definition.             |
| `ParameterObject`      | API parameter specification.                  |
| `RequestBodyObject`    | Request body specification.                   |
| `ResponseObject`       | Response specification.                       |

#### ApiDocsOptions Properties

| Property          | Type                          | Default               | Description                    |
| ----------------- | ----------------------------- | --------------------- | ------------------------------ |
| `title`           | `string`                      | `'API Documentation'` | API title in documentation.    |
| `description`     | `string`                      | `'API Documentation'` | API description.               |
| `version`         | `string`                      | `'1.0.0'`             | API version.                   |
| `servers`         | `ServerObject[]`              | Auto-detected         | API servers configuration.     |
| `contact`         | `ContactObject`               | `undefined`           | Contact information.           |
| `license`         | `LicenseObject`               | `undefined`           | License information.           |
| `basePath`        | `string`                      | `'/'`                 | Base path for API.             |
| `docsPath`        | `string`                      | `'/docs'`             | Documentation endpoint path.   |
| `swaggerUiPath`   | `string`                      | `'/swagger'`          | Swagger UI endpoint path.      |
| `jsonPath`        | `string`                      | `'/openapi.json'`     | JSON spec endpoint path.       |
| `enableSwaggerUI` | `boolean`                     | `true`                | Enable Swagger UI interface.   |
| `authentication`  | `AuthenticationScheme`        | `undefined`           | Default authentication scheme. |
| `tags`            | `TagObject[]`                 | `[]`                  | API tags for grouping.         |
| `externalDocs`    | `ExternalDocumentationObject` | `undefined`           | External documentation links.  |

#### RouteDocumentation Properties

| Property       | Type                             | Description                             |
| -------------- | -------------------------------- | --------------------------------------- |
| `summary`      | `string`                         | Brief route summary.                    |
| `description`  | `string`                         | Detailed route description.             |
| `tags`         | `string[]`                       | Tags for grouping routes.               |
| `parameters`   | `ParameterObject[]`              | Route parameters specification.         |
| `requestBody`  | `RequestBodyObject`              | Request body specification.             |
| `responses`    | `Record<string, ResponseObject>` | Response specifications by status code. |
| `security`     | `SecurityRequirementObject[]`    | Security requirements.                  |
| `operationId`  | `string`                         | Unique operation identifier.            |
| `deprecated`   | `boolean`                        | Whether the route is deprecated.        |
| `externalDocs` | `ExternalDocumentationObject`    | External documentation for this route.  |

### 🛠️ Documentation Methods

| Method                          | Signature                                              | Description                          |
| ------------------------------- | ------------------------------------------------------ | ------------------------------------ |
| `enableApiDocs(options?)`       | `(options?: ApiDocsOptions) => Application`            | Enable API documentation generation. |
| `documentRoute(path, metadata)` | `(path: string, metadata: RouteDocumentation) => void` | Document a specific route.           |
| `addTag(tag)`                   | `(tag: TagObject) => void`                             | Add API tag for grouping.            |
| `addServer(server)`             | `(server: ServerObject) => void`                       | Add API server configuration.        |
| `setAuthentication(auth)`       | `(auth: AuthenticationScheme) => void`                 | Set default authentication scheme.   |
| `generateSpec()`                | `() => OpenAPISpecification`                           | Generate OpenAPI specification.      |

### 📝 Route Metadata

Routes can be documented using decorators or method calls to provide comprehensive API information.

## 💻 Usage Examples

### Basic API Documentation

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Enable API documentation with basic configuration
app.enableApiDocs({
  title: 'My API',
  description: 'RESTful API for my application',
  version: '1.0.0',
  docsPath: '/docs',
  swaggerUiPath: '/swagger',
});

// Simple route with automatic documentation
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

// Route with detailed documentation
app.documentRoute('/users', {
  summary: 'Get all users',
  description: 'Retrieve a list of all users in the system',
  tags: ['Users'],
  responses: {
    '200': {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              users: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    name: { type: 'string' },
                    email: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});

app.listen(3000);
// Documentation available at: http://localhost:3000/docs
// Swagger UI available at: http://localhost:3000/swagger
```

### Advanced API Documentation

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Comprehensive API documentation setup
app.enableApiDocs({
  title: 'E-commerce API',
  description:
    'Complete e-commerce platform API with authentication and payments',
  version: '2.1.0',

  // Contact information
  contact: {
    name: 'API Support',
    url: 'https://example.com/support',
    email: 'api-support@example.com',
  },

  // License information
  license: {
    name: 'MIT License',
    url: 'https://opensource.org/licenses/MIT',
  },

  // Server configurations
  servers: [
    {
      url: 'https://api.example.com/v2',
      description: 'Production server',
    },
    {
      url: 'https://staging-api.example.com/v2',
      description: 'Staging server',
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],

  // Default authentication
  authentication: {
    type: 'bearer',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  },

  // API tags for organization
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication operations',
    },
    {
      name: 'Users',
      description: 'User management operations',
    },
    {
      name: 'Products',
      description: 'Product catalog operations',
    },
    {
      name: 'Orders',
      description: 'Order management operations',
    },
  ],

  // External documentation
  externalDocs: {
    description: 'Complete API Guide',
    url: 'https://docs.example.com/api',
  },
});

// Document authentication routes
app.post('/auth/login', (req, res) => {
  // Login logic
  res.json({ token: 'jwt-token', user: {} });
});

app.documentRoute('/auth/login', {
  summary: 'User login',
  description: 'Authenticate user with email and password',
  tags: ['Authentication'],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              minLength: 6,
              example: 'password123',
            },
          },
        },
      },
    },
  },
  responses: {
    '200': {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              token: {
                type: 'string',
                description: 'JWT authentication token',
              },
              user: {
                $ref: '#/components/schemas/User',
              },
            },
          },
        },
      },
    },
    '401': {
      description: 'Invalid credentials',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/Error',
          },
        },
      },
    },
  },
});

// Document user routes with parameters
app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  res.json({ id: userId, name: 'John Doe' });
});

app.documentRoute('/users/{id}', {
  summary: 'Get user by ID',
  description: 'Retrieve detailed information about a specific user',
  tags: ['Users'],
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      description: 'User unique identifier',
      schema: {
        type: 'integer',
        minimum: 1,
      },
      example: 123,
    },
  ],
  security: [{ bearerAuth: [] }],
  responses: {
    '200': {
      description: 'User details',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/User',
          },
        },
      },
    },
    '404': {
      description: 'User not found',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/Error',
          },
        },
      },
    },
  },
});

app.listen(3000);
```

### Product API with Comprehensive Documentation

```typescript
import { createApp } from 'nextrush';

const app = createApp();

app.enableApiDocs({
  title: 'Product Catalog API',
  description: 'Product management and catalog browsing API',
  version: '1.5.0',
});

// List products with filtering
app.get('/products', (req, res) => {
  const { category, minPrice, maxPrice, page = 1, limit = 20 } = req.query;
  // Product filtering logic
  res.json({
    products: [],
    pagination: { page, limit, total: 0 },
  });
});

app.documentRoute('/products', {
  summary: 'List products',
  description: 'Retrieve a paginated list of products with optional filtering',
  tags: ['Products'],
  parameters: [
    {
      name: 'category',
      in: 'query',
      description: 'Filter by product category',
      schema: {
        type: 'string',
        enum: ['electronics', 'clothing', 'books', 'home'],
      },
      example: 'electronics',
    },
    {
      name: 'minPrice',
      in: 'query',
      description: 'Minimum price filter',
      schema: {
        type: 'number',
        minimum: 0,
      },
      example: 10.99,
    },
    {
      name: 'maxPrice',
      in: 'query',
      description: 'Maximum price filter',
      schema: {
        type: 'number',
        minimum: 0,
      },
      example: 999.99,
    },
    {
      name: 'page',
      in: 'query',
      description: 'Page number for pagination',
      schema: {
        type: 'integer',
        minimum: 1,
        default: 1,
      },
    },
    {
      name: 'limit',
      in: 'query',
      description: 'Number of items per page',
      schema: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20,
      },
    },
  ],
  responses: {
    '200': {
      description: 'Products retrieved successfully',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              products: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Product',
                },
              },
              pagination: {
                $ref: '#/components/schemas/Pagination',
              },
            },
          },
        },
      },
    },
  },
});

// Create product
app.post('/products', (req, res) => {
  // Product creation logic
  res.status(201).json({ id: 123, ...req.body });
});

app.documentRoute('/products', {
  summary: 'Create product',
  description: 'Add a new product to the catalog',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  requestBody: {
    required: true,
    description: 'Product information',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['name', 'price', 'category'],
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 200,
              example: 'Wireless Headphones',
            },
            description: {
              type: 'string',
              maxLength: 1000,
              example:
                'High-quality wireless headphones with noise cancellation',
            },
            price: {
              type: 'number',
              minimum: 0,
              example: 199.99,
            },
            category: {
              type: 'string',
              enum: ['electronics', 'clothing', 'books', 'home'],
              example: 'electronics',
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['wireless', 'audio', 'premium'],
            },
            specifications: {
              type: 'object',
              additionalProperties: {
                type: 'string',
              },
              example: {
                battery_life: '30 hours',
                connectivity: 'Bluetooth 5.0',
                weight: '250g',
              },
            },
          },
        },
      },
    },
  },
  responses: {
    '201': {
      description: 'Product created successfully',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/Product',
          },
        },
      },
    },
    '400': {
      description: 'Invalid product data',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/ValidationError',
          },
        },
      },
    },
  },
});

app.listen(3000);
```

### API Documentation with Components

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Enable API docs with reusable components
app.enableApiDocs({
  title: 'Social Media API',
  description:
    'Social media platform API with posts, comments, and user interactions',
  version: '3.0.0',

  // Define reusable components
  components: {
    schemas: {
      User: {
        type: 'object',
        required: ['id', 'username', 'email'],
        properties: {
          id: {
            type: 'integer',
            description: 'User unique identifier',
            example: 12345,
          },
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 30,
            pattern: '^[a-zA-Z0-9_]+$',
            example: 'johndoe123',
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'john.doe@example.com',
          },
          fullName: {
            type: 'string',
            example: 'John Doe',
          },
          avatar: {
            type: 'string',
            format: 'uri',
            example: 'https://example.com/avatars/johndoe.jpg',
          },
          bio: {
            type: 'string',
            maxLength: 500,
            example: 'Software developer and tech enthusiast',
          },
          followers: {
            type: 'integer',
            minimum: 0,
            example: 1250,
          },
          following: {
            type: 'integer',
            minimum: 0,
            example: 340,
          },
          verified: {
            type: 'boolean',
            example: false,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-15T10:30:00Z',
          },
        },
      },

      Post: {
        type: 'object',
        required: ['id', 'content', 'author'],
        properties: {
          id: {
            type: 'integer',
            example: 789,
          },
          content: {
            type: 'string',
            minLength: 1,
            maxLength: 2000,
            example: 'Just launched my new project! 🚀',
          },
          author: {
            $ref: '#/components/schemas/User',
          },
          images: {
            type: 'array',
            items: {
              type: 'string',
              format: 'uri',
            },
            example: ['https://example.com/images/post1.jpg'],
          },
          likes: {
            type: 'integer',
            minimum: 0,
            example: 42,
          },
          comments: {
            type: 'integer',
            minimum: 0,
            example: 8,
          },
          shares: {
            type: 'integer',
            minimum: 0,
            example: 3,
          },
          hashtags: {
            type: 'array',
            items: {
              type: 'string',
              pattern: '^[a-zA-Z0-9_]+$',
            },
            example: ['project', 'launch', 'startup'],
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-11-20T14:30:00Z',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-11-20T14:35:00Z',
          },
        },
      },

      Error: {
        type: 'object',
        required: ['error', 'message'],
        properties: {
          error: {
            type: 'string',
            example: 'VALIDATION_ERROR',
          },
          message: {
            type: 'string',
            example: 'The provided data is invalid',
          },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2023-11-20T14:30:00Z',
          },
        },
      },
    },

    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
    },
  },
});

app.listen(3000);
```

## ⚙️ Configuration Options

### Production Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Production API documentation setup
app.enableApiDocs({
  title: 'Production API',
  description: 'Production-ready API with comprehensive documentation',
  version: process.env.API_VERSION || '1.0.0',

  servers: [
    {
      url: process.env.API_BASE_URL || 'https://api.example.com',
      description: 'Production server',
    },
  ],

  // Secure documentation endpoint
  docsPath: '/api/docs',
  swaggerUiPath: '/api/swagger',
  jsonPath: '/api/openapi.json',

  // Authentication for docs access
  authentication: (req) => {
    const token = req.headers.authorization;
    return validateAdminToken(token);
  },

  // Only enable in non-production or for authorized users
  enableSwaggerUI:
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_DOCS === 'true',
});

app.listen(3000);
```

### Development Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Development-friendly configuration
app.enableApiDocs({
  title: 'Development API',
  description: 'API documentation for development and testing',
  version: '0.1.0-dev',

  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
    {
      url: 'http://localhost:3001',
      description: 'Alternative dev server',
    },
  ],

  // Enable all development features
  enableSwaggerUI: true,
  docsPath: '/dev/docs',
  swaggerUiPath: '/dev/swagger',

  // No authentication in development
  authentication: undefined,
});

app.listen(3000);
```

## 📝 Notes

- **Automatic Discovery**: The plugin automatically discovers routes and generates basic documentation. Enhanced documentation requires explicit route documentation.

- **OpenAPI Compliance**: Generated documentation follows OpenAPI 3.0.3 specification for maximum compatibility with tools and clients.

- **Swagger UI Integration**: Built-in Swagger UI provides interactive testing capabilities directly from the documentation.

- **Schema Validation**: Use JSON Schema to define request/response structures for better validation and documentation.

- **Security Documentation**: Properly document authentication schemes and security requirements for each endpoint.

- **Component Reusability**: Define reusable components (schemas, responses, parameters) to maintain consistency and reduce duplication.

- **Environment Awareness**: Configure documentation endpoints and features based on environment (development vs. production).

- **Performance Considerations**: Documentation generation adds minimal overhead, but consider caching generated specs in production.

- **Version Management**: Keep API documentation synchronized with actual API versions and maintain compatibility.

- **External Tools**: Generated OpenAPI specs can be used with code generators, testing tools, and API clients.

- **Custom Themes**: Swagger UI can be customized with themes and branding to match your application design.

- **Access Control**: Implement proper access controls for documentation endpoints, especially in production environments.
