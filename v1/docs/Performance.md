# 📊 Performance & Metrics

## 📚 Table of Contents

- [📖 Introduction](#-introduction)
- [🔧 Public APIs](#-public-apis)
  - [⚙️ Metrics Configuration](#️-metrics-configuration)
  - [📈 Metrics Collection](#-metrics-collection)
  - [🏥 Health Checks](#-health-checks)
  - [📊 Data Access](#-data-access)
  - [📋 Configuration Interfaces](#-configuration-interfaces)
- [💻 Usage Examples](#-usage-examples)
- [⚙️ Configuration Options](#️-configuration-options)
- [📝 Notes](#-notes)

## 📖 Introduction

The NextRush framework includes a comprehensive performance monitoring and metrics collection system that provides real-time insights into application performance, system resources, and custom business metrics. The metrics plugin offers Prometheus-compatible endpoints, health checks, and request tracking capabilities for production monitoring and observability.

## 🔧 Public APIs

### ⚙️ Metrics Configuration

| Method                    | Signature                                   | Description                              |
| ------------------------- | ------------------------------------------- | ---------------------------------------- |
| `enableMetrics(options?)` | `(options?: MetricsOptions) => Application` | Enable metrics collection and endpoints. |

### 📈 Metrics Collection

| Method                                    | Signature                                                                        | Description                 |
| ----------------------------------------- | -------------------------------------------------------------------------------- | --------------------------- |
| `incrementCounter(name, labels?, value?)` | `(name: string, labels?: Record<string, string>, value?: number) => Application` | Increment a counter metric. |
| `setGauge(name, value, labels?)`          | `(name: string, value: number, labels?: Record<string, string>) => Application`  | Set a gauge metric value.   |
| `observeHistogram(name, value, labels?)`  | `(name: string, value: number, labels?: Record<string, string>) => Application`  | Observe a histogram metric. |

### 🏥 Health Checks

| Method                        | Signature                                                                | Description                |
| ----------------------------- | ------------------------------------------------------------------------ | -------------------------- |
| `addHealthCheck(name, check)` | `(name: string, check: () => Promise<HealthCheckResult>) => Application` | Add a custom health check. |

### 📊 Data Access

| Method         | Signature                     | Description                     |
| -------------- | ----------------------------- | ------------------------------- |
| `getMetrics()` | `() => MetricsData`           | Get all collected metrics data. |
| `getHealth()`  | `() => Promise<HealthStatus>` | Get current health status.      |

### 📋 Configuration Interfaces

| Interface        | Description                                   |
| ---------------- | --------------------------------------------- |
| `MetricsOptions` | Configuration options for metrics collection. |
| `CustomMetric`   | Custom metric definition.                     |
| `RequestMetrics` | HTTP request metrics data.                    |
| `SystemMetrics`  | System resource metrics data.                 |
| `HealthStatus`   | Health check status and results.              |

#### MetricsOptions Properties

| Property                | Type                                | Default        | Description                          |
| ----------------------- | ----------------------------------- | -------------- | ------------------------------------ |
| `endpoint`              | `string`                            | `'/metrics'`   | Metrics endpoint path.               |
| `enableHealthCheck`     | `boolean`                           | `true`         | Enable /health endpoint.             |
| `collectDefaultMetrics` | `boolean`                           | `true`         | Collect system metrics.              |
| `requestTracking`       | `boolean`                           | `true`         | Track HTTP requests.                 |
| `customMetrics`         | `Record<string, CustomMetric>`      | `{}`           | Custom metric definitions.           |
| `authentication`        | `(req: NextRushRequest) => boolean` | `undefined`    | Authentication for metrics endpoint. |
| `format`                | `'prometheus' \| 'json'`            | `'prometheus'` | Output format.                       |
| `prefix`                | `string`                            | `'nextrush_'`  | Metric name prefix.                  |

#### CustomMetric Properties

| Property    | Type                                               | Description                 |
| ----------- | -------------------------------------------------- | --------------------------- |
| `type`      | `'counter' \| 'gauge' \| 'histogram' \| 'summary'` | Metric type.                |
| `help`      | `string`                                           | Metric description.         |
| `labels`    | `string[]?`                                        | Label names for the metric. |
| `buckets`   | `number[]?`                                        | Histogram buckets.          |
| `quantiles` | `number[]?`                                        | Summary quantiles.          |

#### RequestMetrics Properties

| Property              | Type                     | Description                            |
| --------------------- | ------------------------ | -------------------------------------- |
| `total`               | `number`                 | Total number of requests.              |
| `active`              | `number`                 | Currently active requests.             |
| `byMethod`            | `Record<string, number>` | Requests grouped by HTTP method.       |
| `byStatus`            | `Record<number, number>` | Requests grouped by status code.       |
| `averageResponseTime` | `number`                 | Average response time in milliseconds. |
| `totalResponseTime`   | `number`                 | Total response time in milliseconds.   |
| `errors`              | `number`                 | Number of error responses (4xx/5xx).   |

#### SystemMetrics Properties

| Property  | Type                                                               | Description                         |
| --------- | ------------------------------------------------------------------ | ----------------------------------- |
| `uptime`  | `number`                                                           | Application uptime in milliseconds. |
| `memory`  | `{ used: number, total: number, heap: NodeJS.MemoryUsage }`        | Memory usage information.           |
| `cpu`     | `{ usage: number, load: number[] }`                                | CPU usage and load averages.        |
| `process` | `{ pid: number, version: string, arch: string, platform: string }` | Process information.                |

#### HealthStatus Properties

| Property    | Type                                                                                          | Description                      |
| ----------- | --------------------------------------------------------------------------------------------- | -------------------------------- |
| `status`    | `'healthy' \| 'unhealthy' \| 'degraded'`                                                      | Overall health status.           |
| `timestamp` | `number`                                                                                      | Health check timestamp.          |
| `uptime`    | `number`                                                                                      | Application uptime.              |
| `version`   | `string?`                                                                                     | Application version.             |
| `checks`    | `Record<string, { status: 'pass' \| 'fail' \| 'warn', message?: string, duration?: number }>` | Individual health check results. |

## 💻 Usage Examples

### Basic Metrics Setup

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Enable metrics with default configuration
app.enableMetrics();

// Basic route
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

// Metrics will be available at GET /metrics
// Health check will be available at GET /health
app.listen(3000);
```

### Advanced Metrics Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Advanced metrics configuration
app.enableMetrics({
  endpoint: '/api/metrics',
  enableHealthCheck: true,
  collectDefaultMetrics: true,
  requestTracking: true,
  format: 'prometheus',
  prefix: 'myapp_',
  authentication: (req) => {
    // Protect metrics endpoint
    const token = req.headers.authorization?.replace('Bearer ', '');
    return token === process.env.METRICS_TOKEN;
  },
  customMetrics: {
    user_signups: {
      type: 'counter',
      help: 'Total number of user signups',
      labels: ['source', 'plan'],
    },
    active_connections: {
      type: 'gauge',
      help: 'Number of active WebSocket connections',
    },
    response_duration: {
      type: 'histogram',
      help: 'HTTP response duration',
      buckets: [0.1, 0.5, 1, 2, 5],
    },
  },
});

app.listen(3000);
```

### Custom Metrics Collection

```typescript
import { createApp } from 'nextrush';

const app = createApp();
app.enableMetrics();

// Counter metrics
app.post('/api/users', (req, res) => {
  // Increment signup counter
  app.incrementCounter('user_signups', {
    source: 'web',
    plan: req.body.plan,
  });

  // Business logic
  const user = createUser(req.body);
  res.json({ user });
});

// Gauge metrics
app.get('/api/stats', (req, res) => {
  // Set current active users
  const activeUsers = getCurrentActiveUsers();
  app.setGauge('active_users', activeUsers);

  res.json({ activeUsers });
});

// Histogram metrics
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    app.observeHistogram('request_duration_seconds', duration, {
      method: req.method,
      route: req.route?.path || 'unknown',
      status: res.statusCode.toString(),
    });
  });

  next();
});
```

### Application Health Checks

```typescript
import { createApp } from 'nextrush';

const app = createApp();
app.enableMetrics();

// Database health check
app.addHealthCheck('database', async () => {
  try {
    await database.ping();
    return { status: 'pass', message: 'Database connection healthy' };
  } catch (error) {
    return {
      status: 'fail',
      message: `Database connection failed: ${error.message}`,
    };
  }
});

// Redis health check
app.addHealthCheck('redis', async () => {
  try {
    const response = await redis.ping();
    if (response === 'PONG') {
      return { status: 'pass', message: 'Redis connection healthy' };
    } else {
      return { status: 'warn', message: 'Redis responded unexpectedly' };
    }
  } catch (error) {
    return {
      status: 'fail',
      message: `Redis connection failed: ${error.message}`,
    };
  }
});

// External service health check
app.addHealthCheck('payment_service', async () => {
  try {
    const response = await fetch('https://api.payment-service.com/health');
    if (response.ok) {
      return { status: 'pass', message: 'Payment service available' };
    } else {
      return {
        status: 'warn',
        message: `Payment service returned ${response.status}`,
      };
    }
  } catch (error) {
    return {
      status: 'fail',
      message: 'Payment service unreachable',
    };
  }
});

app.listen(3000);
```

### Performance Monitoring

```typescript
import { createApp } from 'nextrush';

const app = createApp();
app.enableMetrics();

// Request performance tracking
app.use((req, res, next) => {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1000000;

    // Log slow requests
    if (durationMs > 1000) {
      console.warn(`Slow request: ${req.method} ${req.url} - ${durationMs}ms`);

      // Increment slow request counter
      app.incrementCounter('slow_requests_total', {
        method: req.method,
        path: req.route?.path || req.url,
      });
    }

    // Record response time histogram
    app.observeHistogram('http_request_duration_ms', durationMs, {
      method: req.method,
      status: res.statusCode.toString(),
    });
  });

  next();
});

// Memory usage monitoring
setInterval(() => {
  const memUsage = process.memoryUsage();
  app.setGauge('nodejs_heap_used_bytes', memUsage.heapUsed);
  app.setGauge('nodejs_heap_total_bytes', memUsage.heapTotal);
  app.setGauge('nodejs_external_bytes', memUsage.external);
  app.setGauge('nodejs_rss_bytes', memUsage.rss);
}, 30000); // Every 30 seconds
```

### Business Metrics

```typescript
import { createApp } from 'nextrush';

const app = createApp();
app.enableMetrics();

// E-commerce metrics
app.post('/api/orders', (req, res) => {
  const order = req.body;

  // Track order metrics
  app.incrementCounter('orders_total', {
    country: order.country,
    payment_method: order.paymentMethod,
  });

  app.observeHistogram('order_value_usd', order.totalAmount, {
    country: order.country,
  });

  // Track conversion funnel
  app.incrementCounter('conversion_funnel', {
    step: 'order_completed',
    source: order.source,
  });

  res.json({ orderId: order.id });
});

// User engagement metrics
app.post('/api/events/page-view', (req, res) => {
  const { page, userId, sessionId } = req.body;

  app.incrementCounter('page_views_total', {
    page: page,
    user_type: userId ? 'authenticated' : 'anonymous',
  });

  res.status(204).send();
});

// Feature usage metrics
app.post('/api/features/:feature/usage', (req, res) => {
  const feature = req.params.feature;
  const { userId } = req.body;

  app.incrementCounter('feature_usage_total', {
    feature: feature,
    user_id: userId,
  });

  res.status(204).send();
});
```

### Prometheus Integration

```typescript
// Prometheus configuration example
app.enableMetrics({
  format: 'prometheus',
  prefix: 'myapp_',
  endpoint: '/metrics',
  authentication: (req) => {
    // Allow Prometheus scraper
    const userAgent = req.headers['user-agent'] || '';
    return (
      userAgent.includes('Prometheus') ||
      req.headers.authorization === `Bearer ${process.env.METRICS_TOKEN}`
    );
  },
});

// The metrics endpoint will return Prometheus format:
/*
# HELP myapp_http_requests_total Total number of HTTP requests
# TYPE myapp_http_requests_total counter
myapp_http_requests_total 1234

# HELP myapp_http_requests_active Number of active HTTP requests
# TYPE myapp_http_requests_active gauge
myapp_http_requests_active 5

# HELP myapp_memory_usage_bytes Memory usage in bytes
# TYPE myapp_memory_usage_bytes gauge
myapp_memory_usage_bytes 52428800
*/
```

### JSON Metrics Format

```typescript
app.enableMetrics({
  format: 'json',
  endpoint: '/api/metrics',
});

// JSON format response:
/*
{
  "request": {
    "total": 1234,
    "active": 5,
    "byMethod": { "GET": 800, "POST": 300, "PUT": 134 },
    "byStatus": { "200": 1000, "404": 100, "500": 5 },
    "averageResponseTime": 250,
    "totalResponseTime": 308500,
    "errors": 105
  },
  "system": {
    "uptime": 86400000,
    "memory": {
      "used": 52428800,
      "total": 8589934592,
      "heap": {
        "rss": 52428800,
        "heapTotal": 20971520,
        "heapUsed": 18874368,
        "external": 1048576,
        "arrayBuffers": 0
      }
    },
    "cpu": {
      "usage": 0.25,
      "load": [0.5, 0.3, 0.1]
    },
    "process": {
      "pid": 12345,
      "version": "v18.17.0",
      "arch": "x64",
      "platform": "linux"
    }
  },
  "custom": {
    "user_signups": [
      { "value": 150, "labels": { "source": "web" }, "timestamp": 1634567890000 }
    ]
  }
}
*/
```

## ⚙️ Configuration Options

### Production Configuration

```typescript
app.enableMetrics({
  endpoint: '/metrics',
  enableHealthCheck: true,
  collectDefaultMetrics: true,
  requestTracking: true,
  format: 'prometheus',
  prefix: process.env.APP_NAME ? `${process.env.APP_NAME}_` : 'app_',
  authentication: (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    return token === process.env.METRICS_TOKEN;
  },
});
```

### Development Configuration

```typescript
app.enableMetrics({
  endpoint: '/dev/metrics',
  enableHealthCheck: true,
  collectDefaultMetrics: true,
  requestTracking: true,
  format: 'json', // Easier to read during development
  prefix: 'dev_',
  authentication: undefined, // No auth in development
});
```

### Minimal Configuration

```typescript
// Just enable basic metrics
app.enableMetrics({
  requestTracking: true,
  collectDefaultMetrics: false,
  enableHealthCheck: false,
});
```

## 📝 Notes

- **Prometheus Compatibility**: The metrics plugin generates Prometheus-compatible output by default, making it easy to integrate with monitoring systems.
- **Performance Impact**: Metrics collection has minimal performance impact, but consider the frequency of custom metric updates in high-traffic applications.
- **Memory Usage**: Custom metrics are stored in memory. Consider implementing custom storage for applications with many unique label combinations.
- **Security**: Always protect the metrics endpoint in production using authentication to prevent information disclosure.
- **Health Checks**: Health checks run on every request to `/health`. Keep them lightweight and fast to avoid impacting the endpoint performance.
- **Request Tracking**: Automatic request tracking captures response times, status codes, and HTTP methods without additional configuration.
- **Custom Metrics**: Use meaningful metric names and consistent labels. Follow Prometheus naming conventions for better integration.
- **Metric Types**: Choose appropriate metric types - counters for accumulating values, gauges for current state, histograms for distributions.
- **Label Cardinality**: Be careful with high-cardinality labels (many unique values) as they can impact memory usage and query performance.
- **Cleanup**: The plugin automatically cleans up resources when the application stops, but custom session stores should implement proper cleanup methods.
