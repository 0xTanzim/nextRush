/**
 * 📚 API Documentation Generator Plugin - NextRush Framework
 *
 * Automatically generates OpenAPI/Swagger documentation from route metadata
 * and serves interactive documentation interface.
 */

import { Application } from '../../core/app/application';
import { NextRushRequest, NextRushResponse } from '../../types/express';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';

/**
 * OpenAPI specification version
 */
export const OPENAPI_VERSION = '3.0.3';

/**
 * API documentation options
 */
export interface ApiDocsOptions {
  title?: string; // API title
  description?: string; // API description
  version?: string; // API version
  servers?: ServerObject[]; // API servers
  contact?: ContactObject; // Contact information
  license?: LicenseObject; // License information
  basePath?: string; // Base path for API
  docsPath?: string; // Documentation endpoint path
  swaggerUiPath?: string; // Swagger UI endpoint path
  jsonPath?: string; // JSON spec endpoint path
  enableSwaggerUI?: boolean; // Enable Swagger UI
  authentication?: AuthenticationScheme; // Default auth scheme
  tags?: TagObject[]; // API tags
  externalDocs?: ExternalDocumentationObject; // External docs
}

/**
 * Server object
 */
export interface ServerObject {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariableObject>;
}

/**
 * Server variable object
 */
export interface ServerVariableObject {
  enum?: string[];
  default: string;
  description?: string;
}

/**
 * Contact object
 */
export interface ContactObject {
  name?: string;
  url?: string;
  email?: string;
}

/**
 * License object
 */
export interface LicenseObject {
  name: string;
  url?: string;
}

/**
 * Tag object
 */
export interface TagObject {
  name: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
}

/**
 * External documentation object
 */
export interface ExternalDocumentationObject {
  description?: string;
  url: string;
}

/**
 * Authentication scheme
 */
export interface AuthenticationScheme {
  type: 'bearer' | 'apiKey' | 'basic' | 'oauth2';
  scheme?: string; // For bearer
  bearerFormat?: string; // For bearer
  name?: string; // For apiKey
  in?: 'query' | 'header' | 'cookie'; // For apiKey
  flows?: OAuthFlowsObject; // For oauth2
}

/**
 * OAuth flows object
 */
export interface OAuthFlowsObject {
  implicit?: OAuthFlowObject;
  password?: OAuthFlowObject;
  clientCredentials?: OAuthFlowObject;
  authorizationCode?: OAuthFlowObject;
}

/**
 * OAuth flow object
 */
export interface OAuthFlowObject {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

/**
 * Route documentation metadata
 */
export interface RouteDocumentation {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses?: Record<string, ResponseObject>;
  security?: SecurityRequirementObject[];
  operationId?: string;
  deprecated?: boolean;
  externalDocs?: ExternalDocumentationObject;
}

/**
 * Parameter object
 */
export interface ParameterObject {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject;
  example?: any;
  examples?: Record<string, ExampleObject>;
}

/**
 * Request body object
 */
export interface RequestBodyObject {
  description?: string;
  content: Record<string, MediaTypeObject>;
  required?: boolean;
}

/**
 * Response object
 */
export interface ResponseObject {
  description: string;
  headers?: Record<string, HeaderObject>;
  content?: Record<string, MediaTypeObject>;
  links?: Record<string, LinkObject>;
}

/**
 * Security requirement object
 */
export interface SecurityRequirementObject {
  [name: string]: string[];
}

/**
 * Media type object
 */
export interface MediaTypeObject {
  schema?: SchemaObject;
  example?: any;
  examples?: Record<string, ExampleObject>;
  encoding?: Record<string, EncodingObject>;
}

/**
 * Schema object (simplified)
 */
export interface SchemaObject {
  type?: string;
  format?: string;
  title?: string;
  description?: string;
  default?: any;
  example?: any;
  enum?: any[];
  const?: any;
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: boolean;
  minimum?: number;
  exclusiveMinimum?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  properties?: Record<string, SchemaObject>;
  additionalProperties?: boolean | SchemaObject;
  items?: SchemaObject;
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  not?: SchemaObject;
}

/**
 * Example object
 */
export interface ExampleObject {
  summary?: string;
  description?: string;
  value?: any;
  externalValue?: string;
}

/**
 * Header object
 */
export interface HeaderObject {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject;
  example?: any;
  examples?: Record<string, ExampleObject>;
}

/**
 * Link object
 */
export interface LinkObject {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, any>;
  requestBody?: any;
  description?: string;
  server?: ServerObject;
}

/**
 * Encoding object
 */
export interface EncodingObject {
  contentType?: string;
  headers?: Record<string, HeaderObject>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

/**
 * OpenAPI specification
 */
export interface OpenAPISpec {
  openapi: string;
  info: InfoObject;
  servers?: ServerObject[];
  paths: Record<string, PathItemObject>;
  components?: ComponentsObject;
  security?: SecurityRequirementObject[];
  tags?: TagObject[];
  externalDocs?: ExternalDocumentationObject;
}

/**
 * Info object
 */
export interface InfoObject {
  title: string;
  description?: string;
  termsOfService?: string;
  contact?: ContactObject;
  license?: LicenseObject;
  version: string;
}

/**
 * Path item object
 */
export interface PathItemObject {
  summary?: string;
  description?: string;
  get?: OperationObject;
  put?: OperationObject;
  post?: OperationObject;
  delete?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  patch?: OperationObject;
  trace?: OperationObject;
  servers?: ServerObject[];
  parameters?: ParameterObject[];
}

/**
 * Operation object
 */
export interface OperationObject {
  tags?: string[];
  summary?: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
  operationId?: string;
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
  callbacks?: Record<string, CallbackObject>;
  deprecated?: boolean;
  security?: SecurityRequirementObject[];
  servers?: ServerObject[];
}

/**
 * Components object
 */
export interface ComponentsObject {
  schemas?: Record<string, SchemaObject>;
  responses?: Record<string, ResponseObject>;
  parameters?: Record<string, ParameterObject>;
  examples?: Record<string, ExampleObject>;
  requestBodies?: Record<string, RequestBodyObject>;
  headers?: Record<string, HeaderObject>;
  securitySchemes?: Record<string, SecuritySchemeObject>;
  links?: Record<string, LinkObject>;
  callbacks?: Record<string, CallbackObject>;
}

/**
 * Security scheme object
 */
export interface SecuritySchemeObject {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlowsObject;
  openIdConnectUrl?: string;
}

/**
 * Callback object
 */
export interface CallbackObject {
  [expression: string]: PathItemObject;
}

/**
 * 📚 API Documentation Generator Plugin
 */
export class ApiDocumentationPlugin extends BasePlugin {
  name = 'ApiDocumentation';
  private options: ApiDocsOptions;
  private routes = new Map<string, Map<string, RouteDocumentation>>();
  private components: ComponentsObject = {};

  constructor(registry: PluginRegistry) {
    super(registry);
    this.options = {
      title: 'NextRush API',
      description: 'API documentation generated by NextRush',
      version: '1.0.0',
      docsPath: '/docs',
      swaggerUiPath: '/swagger',
      jsonPath: '/api-docs.json',
      enableSwaggerUI: true,
      basePath: '',
    };
  }

  /**
   * Install API documentation capabilities
   */
  install(app: Application): void {
    // Configure API documentation
    (app as any).enableApiDocs = (options: ApiDocsOptions = {}) => {
      this.options = { ...this.options, ...options };

      // Add documentation endpoints
      (app as any).get(this.options.jsonPath, this.createSpecHandler());

      if (this.options.enableSwaggerUI) {
        (app as any).get(
          this.options.swaggerUiPath,
          this.createSwaggerUIHandler()
        );
        (app as any).get(this.options.docsPath, this.createDocsHandler());
      }

      return app;
    };

    // Document route method
    (app as any).doc = (
      path: string,
      method: string,
      documentation: RouteDocumentation
    ) => {
      const methodRoutes = this.routes.get(path) || new Map();
      methodRoutes.set(method.toLowerCase(), documentation);
      this.routes.set(path, methodRoutes);
      return app;
    };

    // Document component schemas
    (app as any).addSchema = (name: string, schema: SchemaObject) => {
      if (!this.components.schemas) {
        this.components.schemas = {};
      }
      this.components.schemas[name] = schema;
      return app;
    };

    // Document security schemes
    (app as any).addSecurityScheme = (
      name: string,
      scheme: SecuritySchemeObject
    ) => {
      if (!this.components.securitySchemes) {
        this.components.securitySchemes = {};
      }
      this.components.securitySchemes[name] = scheme;
      return app;
    };

    // Get OpenAPI specification
    (app as any).getOpenAPISpec = () => {
      return this.generateOpenAPISpec();
    };

    this.emit('api-docs:installed');
  }

  /**
   * Start the API documentation plugin
   */
  start(): void {
    this.emit('api-docs:started');
  }

  /**
   * Stop the API documentation plugin
   */
  stop(): void {
    this.routes.clear();
    this.components = {};
    this.emit('api-docs:stopped');
  }

  /**
   * Create OpenAPI spec handler
   */
  private createSpecHandler() {
    return (req: NextRushRequest, res: NextRushResponse) => {
      try {
        const spec = this.generateOpenAPISpec();
        res.setHeader('Content-Type', 'application/json');
        res.json(spec);
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate API specification' });
      }
    };
  }

  /**
   * Create Swagger UI handler
   */
  private createSwaggerUIHandler() {
    return (req: NextRushRequest, res: NextRushResponse) => {
      const swaggerHtml = this.generateSwaggerUI();
      res.setHeader('Content-Type', 'text/html');
      res.send(swaggerHtml);
    };
  }

  /**
   * Create documentation handler
   */
  private createDocsHandler() {
    return (req: NextRushRequest, res: NextRushResponse) => {
      res.redirect(this.options.swaggerUiPath || '/swagger');
    };
  }

  /**
   * Generate OpenAPI specification
   */
  private generateOpenAPISpec(): OpenAPISpec {
    const info: InfoObject = {
      title: this.options.title || 'NextRush API',
      version: this.options.version || '1.0.0',
    };

    if (this.options.description) info.description = this.options.description;
    if (this.options.contact) info.contact = this.options.contact;
    if (this.options.license) info.license = this.options.license;

    const spec: OpenAPISpec = {
      openapi: OPENAPI_VERSION,
      info,
      paths: this.generatePaths(),
    };

    if (this.options.servers) {
      spec.servers = this.options.servers;
    }

    if (Object.keys(this.components).length > 0) {
      spec.components = this.components;
    }

    if (this.options.tags) {
      spec.tags = this.options.tags;
    }

    if (this.options.externalDocs) {
      spec.externalDocs = this.options.externalDocs;
    }

    return spec;
  }

  /**
   * Generate paths object
   */
  private generatePaths(): Record<string, PathItemObject> {
    const paths: Record<string, PathItemObject> = {};

    for (const [path, methods] of this.routes) {
      const pathItem: PathItemObject = {};

      for (const [method, doc] of methods) {
        const operation: OperationObject = {
          responses: doc.responses || {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: { type: 'object' },
                },
              },
            },
          },
        };

        // Add optional properties only if they exist
        if (doc.summary) operation.summary = doc.summary;
        if (doc.description) operation.description = doc.description;
        if (doc.tags) operation.tags = doc.tags;
        if (doc.parameters) operation.parameters = doc.parameters;
        if (doc.requestBody) operation.requestBody = doc.requestBody;
        if (doc.security) operation.security = doc.security;
        if (doc.operationId) operation.operationId = doc.operationId;
        if (doc.deprecated) operation.deprecated = doc.deprecated;
        if (doc.externalDocs) operation.externalDocs = doc.externalDocs;

        (pathItem as any)[method] = operation;
      }

      paths[path] = pathItem;
    }

    return paths;
  }

  /**
   * Generate Swagger UI HTML
   */
  private generateSwaggerUI(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.options.title} - API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '${this.options.jsonPath}',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>`;
  }
}

/**
 * Common schema definitions
 */
export const CommonSchemas = {
  Error: (): SchemaObject => ({
    type: 'object',
    required: ['error', 'message'],
    properties: {
      error: {
        type: 'string',
        description: 'Error type',
      },
      message: {
        type: 'string',
        description: 'Error message',
      },
      details: {
        type: 'object',
        description: 'Additional error details',
      },
    },
  }),

  PaginatedResponse: (itemSchema: SchemaObject): SchemaObject => ({
    type: 'object',
    required: ['data', 'total', 'page', 'limit'],
    properties: {
      data: {
        type: 'array',
        items: itemSchema,
      },
      total: {
        type: 'integer',
        description: 'Total number of items',
      },
      page: {
        type: 'integer',
        description: 'Current page number',
      },
      limit: {
        type: 'integer',
        description: 'Items per page',
      },
      hasNext: {
        type: 'boolean',
        description: 'Whether there are more pages',
      },
    },
  }),

  SuccessResponse: (dataSchema?: SchemaObject): SchemaObject => ({
    type: 'object',
    required: ['success'],
    properties: {
      success: {
        type: 'boolean',
        enum: [true],
      },
      message: {
        type: 'string',
        description: 'Success message',
      },
      data: dataSchema || {
        type: 'object',
        description: 'Response data',
      },
    },
  }),
};
