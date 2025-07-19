# 📊 Metrics & Monitoring

## 📚 Table of Contents

- [📖 Introduction](#-introduction)
- [🔧 Public APIs](#-public-apis)
  - [📋 Configuration Interfaces](#-configuration-interfaces)
  - [🛠️ Metrics Methods](#️-metrics-methods)
  - [📈 Metric Types](#-metric-types)
- [💻 Usage Examples](#-usage-examples)
- [⚙️ Configuration Options](#️-configuration-options)
- [📝 Notes](#-notes)

## 📖 Introduction

The NextRush Metrics & Monitoring plugin provides comprehensive application monitoring with request tracking, performance metrics, system metrics, health checks, and Prometheus-compatible endpoints. It enables real-time monitoring, alerting, and observability for production applications.

## 🔧 Public APIs

### 📋 Configuration Interfaces

| Interface        | Description                             |
| ---------------- | --------------------------------------- |
| `MetricsOptions` | Main metrics configuration options.     |
| `CustomMetric`   | Custom metric definition interface.     |
| `MetricValue`    | Metric value with labels and timestamp. |
| `RequestMetrics` | HTTP request metrics aggregation.       |
| `SystemMetrics`  | System performance metrics.             |
| `HealthStatus`   | Health check status and results.        |

#### MetricsOptions Properties

| Property                | Type                                | Default        | Description                           |
| ----------------------- | ----------------------------------- | -------------- | ------------------------------------- |
| `endpoint`              | `string`                            | `'/metrics'`   | Metrics endpoint path.                |
| `enableHealthCheck`     | `boolean`                           | `true`         | Enable /health endpoint.              |
| `collectDefaultMetrics` | `boolean`                           | `true`         | Collect system metrics automatically. |
| `requestTracking`       | `boolean`                           | `true`         | Track HTTP requests metrics.          |
| `customMetrics`         | `Record<string, CustomMetric>`      | `{}`           | Custom metrics definitions.           |
| `authentication`        | `(req: NextRushRequest) => boolean` | `undefined`    | Authentication for metrics endpoint.  |
| `format`                | `'prometheus' \| 'json'`            | `'prometheus'` | Output format for metrics.            |
| `prefix`                | `string`                            | `'nextrush_'`  | Metric name prefix.                   |

#### CustomMetric Properties

| Property    | Type                                               | Description                         |
| ----------- | -------------------------------------------------- | ----------------------------------- |
| `type`      | `'counter' \| 'gauge' \| 'histogram' \| 'summary'` | Metric type.                        |
| `help`      | `string`                                           | Metric description.                 |
| `labels`    | `string[]`                                         | Label names for the metric.         |
| `buckets`   | `number[]`                                         | Histogram buckets (histogram only). |
| `quantiles` | `number[]`                                         | Summary quantiles (summary only).   |

#### RequestMetrics Properties

| Property              | Type                     | Description                            |
| --------------------- | ------------------------ | -------------------------------------- |
| `total`               | `number`                 | Total number of requests.              |
| `active`              | `number`                 | Currently active requests.             |
| `byMethod`            | `Record<string, number>` | Requests grouped by HTTP method.       |
| `byStatus`            | `Record<number, number>` | Requests grouped by status code.       |
| `averageResponseTime` | `number`                 | Average response time in milliseconds. |
| `totalResponseTime`   | `number`                 | Total response time.                   |
| `errors`              | `number`                 | Total number of error responses.       |

#### SystemMetrics Properties

| Property  | Type                                                               | Description                    |
| --------- | ------------------------------------------------------------------ | ------------------------------ |
| `uptime`  | `number`                                                           | Application uptime in seconds. |
| `memory`  | `{ used: number, total: number, heap: NodeJS.MemoryUsage }`        | Memory usage information.      |
| `cpu`     | `{ usage: number, load: number[] }`                                | CPU usage and load averages.   |
| `process` | `{ pid: number, version: string, arch: string, platform: string }` | Process information.           |

### 🛠️ Metrics Methods

| Method                                   | Signature                                                                | Description                              |
| ---------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------- |
| `enableMetrics(options?)`                | `(options?: MetricsOptions) => Application`                              | Enable metrics collection and endpoints. |
| `incrementCounter(name, labels?)`        | `(name: string, labels?: Record<string, string>) => void`                | Increment a counter metric.              |
| `setGauge(name, value, labels?)`         | `(name: string, value: number, labels?: Record<string, string>) => void` | Set gauge metric value.                  |
| `observeHistogram(name, value, labels?)` | `(name: string, value: number, labels?: Record<string, string>) => void` | Observe histogram metric.                |
| `observeSummary(name, value, labels?)`   | `(name: string, value: number, labels?: Record<string, string>) => void` | Observe summary metric.                  |
| `addHealthCheck(name, check)`            | `(name: string, check: () => Promise<HealthResult>) => void`             | Add custom health check.                 |
| `removeHealthCheck(name)`                | `(name: string) => void`                                                 | Remove health check.                     |
| `getMetrics(format?)`                    | `(format?: 'prometheus' \| 'json') => string`                            | Get current metrics in specified format. |
| `getHealthStatus()`                      | `() => Promise<HealthStatus>`                                            | Get current health status.               |

### 📈 Metric Types

#### Counter

Monotonically increasing values (requests, errors, events).

#### Gauge

Values that can go up and down (memory usage, active connections).

#### Histogram

Distribution of values in buckets (response times, request sizes).

#### Summary

Quantile-based measurements (latency percentiles).

## 💻 Usage Examples

### Basic Metrics Setup

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Enable basic metrics with default configuration
app.enableMetrics({
  endpoint: '/metrics',
  enableHealthCheck: true,
  collectDefaultMetrics: true,
  requestTracking: true,
});

// Your application routes
app.get('/api/data', (req, res) => {
  res.json({ message: 'Data retrieved successfully' });
});

app.listen(3000);

// Metrics available at: http://localhost:3000/metrics
// Health check at: http://localhost:3000/health
```

### Custom Metrics

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Enable metrics with custom metric definitions
app.enableMetrics({
  endpoint: '/metrics',
  customMetrics: {
    // Counter for tracking business events
    user_registrations: {
      type: 'counter',
      help: 'Total number of user registrations',
      labels: ['source', 'plan'],
    },

    // Gauge for tracking current values
    active_users: {
      type: 'gauge',
      help: 'Currently active users',
      labels: ['region'],
    },

    // Histogram for response time distribution
    api_response_time: {
      type: 'histogram',
      help: 'API response time distribution',
      labels: ['method', 'endpoint'],
      buckets: [0.1, 0.5, 1, 2, 5, 10], // seconds
    },

    // Summary for percentile tracking
    database_query_duration: {
      type: 'summary',
      help: 'Database query duration',
      labels: ['operation', 'table'],
      quantiles: [0.5, 0.95, 0.99],
    },
  },
});

// Use custom metrics in your application
app.post('/api/users/register', (req, res) => {
  const startTime = Date.now();

  try {
    // Registration logic
    const user = createUser(req.body);

    // Track successful registration
    app.incrementCounter('user_registrations', {
      source: req.body.source || 'direct',
      plan: user.plan,
    });

    // Update active users count
    const activeCount = getActiveUsersCount(user.region);
    app.setGauge('active_users', activeCount, {
      region: user.region,
    });

    res.status(201).json({ user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  } finally {
    // Track response time
    const duration = (Date.now() - startTime) / 1000;
    app.observeHistogram('api_response_time', duration, {
      method: 'POST',
      endpoint: '/api/users/register',
    });
  }
});

// Database operations with metrics
app.get('/api/users/:id', async (req, res) => {
  const queryStart = Date.now();

  try {
    const user = await getUserById(req.params.id);

    // Track database query time
    const queryDuration = (Date.now() - queryStart) / 1000;
    app.observeSummary('database_query_duration', queryDuration, {
      operation: 'select',
      table: 'users',
    });

    res.json({ user });
  } catch (error) {
    res.status(404).json({ error: 'User not found' });
  }
});

app.listen(3000);
```

### Health Checks

```typescript
import { createApp } from 'nextrush';
import { createConnection } from 'database';
import { createClient } from 'redis';

const app = createApp();

// Database connection
const db = createConnection(process.env.DATABASE_URL);
const redis = createClient(process.env.REDIS_URL);

app.enableMetrics({
  endpoint: '/metrics',
  enableHealthCheck: true,
});

// Add custom health checks
app.addHealthCheck('database', async () => {
  try {
    await db.query('SELECT 1');
    return { status: 'pass', message: 'Database connection is healthy' };
  } catch (error) {
    return {
      status: 'fail',
      message: `Database connection failed: ${error.message}`,
    };
  }
});

app.addHealthCheck('redis', async () => {
  try {
    await redis.ping();
    return { status: 'pass', message: 'Redis connection is healthy' };
  } catch (error) {
    return {
      status: 'fail',
      message: `Redis connection failed: ${error.message}`,
    };
  }
});

app.addHealthCheck('external_api', async () => {
  try {
    const response = await fetch('https://api.external-service.com/health');
    if (response.ok) {
      return { status: 'pass', message: 'External API is reachable' };
    } else {
      return {
        status: 'warn',
        message: `External API returned ${response.status}`,
      };
    }
  } catch (error) {
    return {
      status: 'fail',
      message: `External API unreachable: ${error.message}`,
    };
  }
});

// Memory usage health check
app.addHealthCheck('memory', async () => {
  const usage = process.memoryUsage();
  const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const totalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const usagePercent = (usedMB / totalMB) * 100;

  if (usagePercent > 90) {
    return {
      status: 'fail',
      message: `Memory usage critical: ${usagePercent.toFixed(1)}%`,
    };
  } else if (usagePercent > 75) {
    return {
      status: 'warn',
      message: `Memory usage high: ${usagePercent.toFixed(1)}%`,
    };
  } else {
    return {
      status: 'pass',
      message: `Memory usage normal: ${usagePercent.toFixed(1)}%`,
    };
  }
});

app.listen(3000);

// Health endpoint returns:
// {
//   "status": "healthy",
//   "timestamp": 1700000000000,
//   "uptime": 3600,
//   "version": "1.0.0",
//   "checks": {
//     "database": { "status": "pass", "message": "Database connection is healthy" },
//     "redis": { "status": "pass", "message": "Redis connection is healthy" },
//     "external_api": { "status": "warn", "message": "External API returned 503" },
//     "memory": { "status": "pass", "message": "Memory usage normal: 45.2%" }
//   }
// }
```

### Advanced Monitoring

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Advanced metrics configuration
app.enableMetrics({
  endpoint: '/internal/metrics',
  enableHealthCheck: true,
  collectDefaultMetrics: true,
  requestTracking: true,
  format: 'prometheus',
  prefix: 'myapp_',

  // Secure metrics endpoint
  authentication: (req) => {
    const token = req.headers.authorization;
    return token === `Bearer ${process.env.METRICS_TOKEN}`;
  },

  customMetrics: {
    // Business metrics
    orders_total: {
      type: 'counter',
      help: 'Total number of orders processed',
      labels: ['status', 'payment_method', 'region'],
    },

    revenue_total: {
      type: 'gauge',
      help: 'Total revenue in USD',
      labels: ['currency', 'region'],
    },

    order_processing_time: {
      type: 'histogram',
      help: 'Order processing time distribution',
      labels: ['type', 'complexity'],
      buckets: [0.5, 1, 2, 5, 10, 30, 60], // seconds
    },

    // Infrastructure metrics
    cache_operations: {
      type: 'counter',
      help: 'Cache operations count',
      labels: ['operation', 'cache_type', 'result'],
    },

    queue_size: {
      type: 'gauge',
      help: 'Current queue size',
      labels: ['queue_name', 'priority'],
    },

    worker_processing_time: {
      type: 'summary',
      help: 'Worker task processing time',
      labels: ['worker_type', 'task_type'],
      quantiles: [0.5, 0.9, 0.95, 0.99],
    },
  },
});

// Business logic with metrics
app.post('/api/orders', async (req, res) => {
  const orderStart = Date.now();
  const orderData = req.body;

  try {
    // Process order
    const order = await processOrder(orderData);

    // Track successful order
    app.incrementCounter('orders_total', {
      status: 'completed',
      payment_method: order.paymentMethod,
      region: order.region,
    });

    // Update revenue
    const currentRevenue = await getTotalRevenue(order.region);
    app.setGauge('revenue_total', currentRevenue, {
      currency: order.currency,
      region: order.region,
    });

    res.status(201).json({ order });
  } catch (error) {
    // Track failed order
    app.incrementCounter('orders_total', {
      status: 'failed',
      payment_method: orderData.paymentMethod || 'unknown',
      region: orderData.region || 'unknown',
    });

    res.status(400).json({ error: error.message });
  } finally {
    // Track processing time
    const processingTime = (Date.now() - orderStart) / 1000;
    app.observeHistogram('order_processing_time', processingTime, {
      type: orderData.type || 'standard',
      complexity: orderData.items?.length > 10 ? 'high' : 'low',
    });
  }
});

// Cache operations with metrics
const cacheGet = async (key, cacheType = 'redis') => {
  try {
    const value = await cache.get(key);

    app.incrementCounter('cache_operations', {
      operation: 'get',
      cache_type: cacheType,
      result: value ? 'hit' : 'miss',
    });

    return value;
  } catch (error) {
    app.incrementCounter('cache_operations', {
      operation: 'get',
      cache_type: cacheType,
      result: 'error',
    });
    throw error;
  }
};

// Queue monitoring
const updateQueueMetrics = () => {
  const queues = ['high_priority', 'normal', 'low_priority'];

  queues.forEach(async (queueName) => {
    const size = await getQueueSize(queueName);
    app.setGauge('queue_size', size, {
      queue_name: queueName,
      priority: queueName.split('_')[0],
    });
  });
};

// Update queue metrics every 30 seconds
setInterval(updateQueueMetrics, 30000);

// Worker metrics
const processWorkerTask = async (taskType, workerType) => {
  const start = Date.now();

  try {
    await executeTask(taskType);

    const duration = (Date.now() - start) / 1000;
    app.observeSummary('worker_processing_time', duration, {
      worker_type: workerType,
      task_type: taskType,
    });
  } catch (error) {
    // Handle error and still record metrics
    const duration = (Date.now() - start) / 1000;
    app.observeSummary('worker_processing_time', duration, {
      worker_type: workerType,
      task_type: `${taskType}_failed`,
    });
    throw error;
  }
};

app.listen(3000);
```

### Prometheus Integration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Configure for Prometheus scraping
app.enableMetrics({
  endpoint: '/metrics',
  format: 'prometheus',
  prefix: 'myapp_',
  collectDefaultMetrics: true,
  requestTracking: true,

  customMetrics: {
    http_requests_total: {
      type: 'counter',
      help: 'Total number of HTTP requests',
      labels: ['method', 'status_code', 'endpoint'],
    },

    http_request_duration_seconds: {
      type: 'histogram',
      help: 'HTTP request duration in seconds',
      labels: ['method', 'endpoint'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
    },

    active_connections: {
      type: 'gauge',
      help: 'Number of active connections',
    },
  },
});

// Middleware to track all requests
app.use((req, res, next) => {
  const start = Date.now();

  // Track request start
  app.incrementCounter('http_requests_total', {
    method: req.method,
    status_code: '0', // Will be updated in response
    endpoint: req.path,
  });

  // Override end to capture response metrics
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = (Date.now() - start) / 1000;

    // Track final request metrics
    app.incrementCounter('http_requests_total', {
      method: req.method,
      status_code: res.statusCode.toString(),
      endpoint: req.path,
    });

    app.observeHistogram('http_request_duration_seconds', duration, {
      method: req.method,
      endpoint: req.path,
    });

    originalEnd.apply(this, args);
  };

  next();
});

app.listen(3000);

// Prometheus scrape configuration (prometheus.yml):
// scrape_configs:
//   - job_name: 'myapp'
//     static_configs:
//       - targets: ['localhost:3000']
//     metrics_path: '/metrics'
//     scrape_interval: 15s
```

## ⚙️ Configuration Options

### Production Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Production metrics configuration
app.enableMetrics({
  endpoint: '/internal/metrics',
  enableHealthCheck: true,
  collectDefaultMetrics: true,
  requestTracking: true,
  format: 'prometheus',
  prefix: process.env.APP_NAME + '_',

  // Secure access to metrics
  authentication: (req) => {
    const token = req.headers['x-metrics-token'];
    return token === process.env.METRICS_ACCESS_TOKEN;
  },

  customMetrics: {
    // Production-specific metrics
    business_transactions: {
      type: 'counter',
      help: 'Business transactions processed',
      labels: ['type', 'status', 'region'],
    },

    error_rate: {
      type: 'gauge',
      help: 'Current error rate percentage',
    },

    response_time_p99: {
      type: 'gauge',
      help: '99th percentile response time',
    },
  },
});

app.listen(3000);
```

### Development Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Development metrics configuration
app.enableMetrics({
  endpoint: '/dev/metrics',
  enableHealthCheck: true,
  collectDefaultMetrics: true,
  requestTracking: true,
  format: 'json', // JSON format for easier reading

  // No authentication in development
  authentication: undefined,

  customMetrics: {
    debug_events: {
      type: 'counter',
      help: 'Debug events for development',
      labels: ['event_type', 'component'],
    },
  },
});

app.listen(3000);
```

## 📝 Notes

- **Performance Impact**: Metrics collection adds minimal overhead but can accumulate with high-cardinality labels. Design labels carefully.

- **Label Cardinality**: Avoid high-cardinality labels (like user IDs, UUIDs) as they can consume significant memory and impact performance.

- **Prometheus Compatibility**: The default Prometheus format ensures compatibility with Prometheus, Grafana, and other monitoring tools.

- **Health Check Design**: Design health checks to be fast and reliable. Avoid external dependencies that could cause false negatives.

- **Security**: Secure metrics endpoints in production as they may contain sensitive operational information.

- **Storage**: Metrics are stored in memory by default. For distributed systems, consider external metric stores like Prometheus.

- **Alerting**: Use metrics for alerting on application health, performance degradation, and business KPIs.

- **Dashboard Integration**: Integrate with monitoring dashboards like Grafana for visualization and operational insights.

- **Custom Metrics Strategy**: Design custom metrics around business value and operational needs rather than technical convenience.

- **Metric Lifecycle**: Clean up or archive unused metrics to prevent memory bloat and confusion in monitoring systems.

- **Sampling**: For high-volume metrics, consider sampling strategies to balance observability with performance.

- **Documentation**: Document custom metrics thoroughly for operations teams and future maintenance.
