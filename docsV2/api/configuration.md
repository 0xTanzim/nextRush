# Configuration & Validation System

Type-safe configuration validation for NextRush v2 applications with runtime error prevention and secure defaults.

## What it is

The Configuration & Validation System provides type-safe validation for application settings, preventing runtime errors and ensuring proper application initialization. It validates ports, hosts, timeouts, and other critical settings before your app starts.

## When to use

- Setting up application configuration with safety guarantees
- Validating user-provided configuration options
- Creating production-ready apps with secure defaults
- Preventing common configuration errors

## Core Components

### ConfigurationError Class

Custom error class for configuration validation failures.

```typescript
import { ConfigurationError } from 'nextrush/config';

class ConfigurationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  );
}
```

**Properties:**

- `field: string` - Configuration field that failed validation
- `value: unknown` - Invalid value that caused the error
- `message: string` - Descriptive error message

### ValidationRule Interface

Defines validation logic for configuration fields.

```typescript
interface ValidationRule<T = unknown> {
  validate: (value: T) => boolean;
  message: string;
}
```

**Properties:**

- `validate: (value: T) => boolean` - Validation function
- `message: string` - Error message when validation fails

## Built-in Validation Rules

### ValidationRules.port

Validates port numbers (0-65535).

```typescript
import { ValidationRules, validateField } from 'nextrush/config';

// Valid ports
validateField('port', 3000, ValidationRules.port); // ✅
validateField('port', 8080, ValidationRules.port); // ✅

// Invalid ports
validateField('port', -1, ValidationRules.port); // ❌ Throws
validateField('port', 70000, ValidationRules.port); // ❌ Throws
```

### ValidationRules.host

Validates host strings (non-empty).

```typescript
// Valid hosts
validateField('host', 'localhost', ValidationRules.host); // ✅
validateField('host', '0.0.0.0', ValidationRules.host); // ✅
validateField('host', 'example.com', ValidationRules.host); // ✅

// Invalid hosts
validateField('host', '', ValidationRules.host); // ❌ Throws
validateField('host', null, ValidationRules.host); // ❌ Throws
```

### ValidationRules.timeout

Validates timeout values (1-300000ms).

```typescript
// Valid timeouts
validateField('timeout', 5000, ValidationRules.timeout); // ✅ 5 seconds
validateField('timeout', 30000, ValidationRules.timeout); // ✅ 30 seconds

// Invalid timeouts
validateField('timeout', 0, ValidationRules.timeout); // ❌ Too small
validateField('timeout', 400000, ValidationRules.timeout); // ❌ Too large
```

### ValidationRules.maxBodySize

Validates maximum body size (1 byte - 100MB).

```typescript
// Valid sizes
validateField('maxBodySize', 1024 * 1024, ValidationRules.maxBodySize); // ✅ 1MB
validateField('maxBodySize', 10 * 1024 * 1024, ValidationRules.maxBodySize); // ✅ 10MB

// Invalid sizes
validateField('maxBodySize', 0, ValidationRules.maxBodySize); // ❌ Too small
validateField('maxBodySize', 200 * 1024 * 1024, ValidationRules.maxBodySize); // ❌ Too large
```

## Core Functions

### validateApplicationOptions()

Validates complete application configuration.

```typescript
import { validateApplicationOptions } from 'nextrush/config';
import type { ApplicationOptions } from 'nextrush/types';

const options: Partial<ApplicationOptions> = {
  port: 3000,
  host: 'localhost',
  debug: true,
  maxBodySize: 1024 * 1024,
};

try {
  validateApplicationOptions(options);
  console.log('Configuration is valid');
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error(`Invalid config: ${error.message}`);
    console.error(`Field: ${error.field}, Value: ${error.value}`);
  }
}
```

**Parameters:**

- `options: Partial<ApplicationOptions>` - Configuration to validate

**Returns:** `void` (throws on validation failure)

**Throws:** `ConfigurationError` - When validation fails

### createSafeConfiguration()

Creates validated configuration with secure defaults.

```typescript
import { createSafeConfiguration } from 'nextrush/config';

// With custom options
const config = createSafeConfiguration({
  port: 8080,
  debug: true,
});

// Result: Fully configured with validated options + defaults
console.log(config);
// {
//   port: 8080,        // Your value
//   host: 'localhost', // Default
//   debug: true,       // Your value
//   trustProxy: false, // Default
//   maxBodySize: 1048576, // Default (1MB)
//   timeout: 30000,    // Default (30s)
//   cors: true,        // Default
//   static: 'public',  // Default
//   template: { engine: 'simple', directory: 'views' }, // Default
//   keepAlive: 10000   // Default (10s)
// }
```

**Parameters:**

- `options: Partial<ApplicationOptions>` - Optional configuration overrides

**Returns:** `Required<ApplicationOptions>` - Complete validated configuration

**Throws:** `ConfigurationError` - When validation fails

## Configuration Utilities

### ConfigUtils.isValidPort()

Type guard for port validation.

```typescript
import { ConfigUtils } from 'nextrush/config';

const userInput: unknown = 3000;

if (ConfigUtils.isValidPort(userInput)) {
  // userInput is now typed as number
  console.log(`Starting server on port ${userInput}`);
}
```

### ConfigUtils.isValidHost()

Type guard for host validation.

```typescript
const userInput: unknown = 'localhost';

if (ConfigUtils.isValidHost(userInput)) {
  // userInput is now typed as string
  console.log(`Binding to host ${userInput}`);
}
```

### ConfigUtils.sanitize()

Removes invalid configuration fields.

```typescript
const rawConfig = {
  port: 3000, // ✅ Valid
  host: 'localhost', // ✅ Valid
  invalidField: 123, // ❌ Unknown field
  timeout: 'bad', // ❌ Invalid type
};

const sanitized = ConfigUtils.sanitize(rawConfig);
console.log(sanitized);
// { port: 3000, host: 'localhost' }
```

## Complete Example

### Basic Configuration Validation

```typescript
// server.ts
import { createApp } from 'nextrush';
import { createSafeConfiguration, ConfigurationError } from 'nextrush/config';
import type { ApplicationOptions } from 'nextrush/types';

async function startServer() {
  try {
    const userOptions: Partial<ApplicationOptions> = {
      port: parseInt(process.env.PORT || '3000'),
      host: process.env.HOST || 'localhost',
      debug: process.env.NODE_ENV === 'development',
      maxBodySize: 2 * 1024 * 1024, // 2MB
    };

    // Create safe configuration with validation
    const config = createSafeConfiguration(userOptions);

    const app = createApp(config);

    app.get('/health', async ctx => {
      ctx.res.json({
        status: 'healthy',
        config: {
          port: config.port,
          debug: config.debug,
        },
      });
    });

    app.listen(config.port, config.host, () => {
      console.log(`Server running on http://${config.host}:${config.port}`);
    });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error('Configuration Error:', error.message);
      console.error(`Invalid field: ${error.field}`);
      console.error(`Invalid value: ${JSON.stringify(error.value)}`);
      process.exit(1);
    }
    throw error;
  }
}

startServer();
```

### Environment-based Configuration

```typescript
// config.ts
import { createSafeConfiguration, ConfigUtils } from 'nextrush/config';
import type { ApplicationOptions } from 'nextrush/types';

function loadEnvironmentConfig(): Partial<ApplicationOptions> {
  const rawConfig: Record<string, unknown> = {
    port: process.env.PORT ? parseInt(process.env.PORT) : undefined,
    host: process.env.HOST,
    debug: process.env.NODE_ENV === 'development',
    trustProxy: process.env.TRUST_PROXY === 'true',
    maxBodySize: process.env.MAX_BODY_SIZE
      ? parseInt(process.env.MAX_BODY_SIZE)
      : undefined,
    timeout: process.env.TIMEOUT ? parseInt(process.env.TIMEOUT) : undefined,
    cors: process.env.CORS !== 'false',
    static: process.env.STATIC_DIR,
  };

  // Remove invalid values and unknown fields
  return ConfigUtils.sanitize(rawConfig);
}

export function createProductionConfig() {
  const envConfig = loadEnvironmentConfig();

  // Create safe configuration with environment overrides
  return createSafeConfiguration({
    ...envConfig,
    // Production-specific overrides
    debug: false,
    trustProxy: true,
    maxBodySize: 10 * 1024 * 1024, // 10MB for production
  });
}
```

## Default Configuration Values

| Option               | Default       | Description            |
| -------------------- | ------------- | ---------------------- |
| `port`               | `3000`        | Server port            |
| `host`               | `'localhost'` | Bind address           |
| `debug`              | `false`       | Debug mode             |
| `trustProxy`         | `false`       | Trust proxy headers    |
| `maxBodySize`        | `1048576`     | Max body size (1MB)    |
| `timeout`            | `30000`       | Request timeout (30s)  |
| `cors`               | `true`        | Enable CORS            |
| `static`             | `'public'`    | Static files directory |
| `template.engine`    | `'simple'`    | Template engine        |
| `template.directory` | `'views'`     | Template directory     |
| `keepAlive`          | `10000`       | HTTP keep-alive (10s)  |

## Validation Limits

| Field         | Minimum | Maximum             | Type    |
| ------------- | ------- | ------------------- | ------- |
| `port`        | `0`     | `65535`             | Integer |
| `timeout`     | `1`     | `300000` (5 min)    | Integer |
| `maxBodySize` | `1`     | `104857600` (100MB) | Integer |
| `keepAlive`   | `0`     | `300000` (5 min)    | Integer |

## Error Handling

### Single Field Validation

```typescript
import {
  validateField,
  ValidationRules,
  ConfigurationError,
} from 'nextrush/config';

try {
  validateField('port', 70000, ValidationRules.port);
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error(error.message); // "Invalid port: Port must be an integer between 0 and 65535"
    console.error(error.field); // "port"
    console.error(error.value); // 70000
  }
}
```

### Multiple Field Validation

```typescript
import {
  validateApplicationOptions,
  ConfigurationError,
} from 'nextrush/config';

try {
  validateApplicationOptions({
    port: -1, // Invalid
    host: '', // Invalid
    timeout: 500000, // Invalid
  });
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error(error.message); // Lists all validation failures
    console.error(error.field); // "multiple"
  }
}
```

## Security Notes

- Default configuration prioritizes security over convenience
- Input validation prevents injection attacks through configuration
- Sensitive defaults (e.g., `trustProxy: false`) require explicit override
- Maximum limits prevent resource exhaustion attacks

## Performance Notes

- Validation occurs only during application initialization
- Built-in validation rules use efficient type checks
- Configuration is validated once and cached
- No runtime performance impact after startup

## See Also

- [Application API](./application.md) - Application setup and lifecycle
- [Middleware](./middleware.md) - Built-in middleware configuration
- [Enhanced Request & Response](./Enhanced-Request-Response.md) - Request/response configuration
- [Template System](./template-plugin.md) - Template engine configuration

## Version

- **Added in:** v2.0.0-alpha.1
- **Status:** Stable
