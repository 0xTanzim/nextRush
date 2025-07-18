# 📊 Metrics & Monitoring Guide

NextRush includes a comprehensive monitoring system with request tracking, performance metrics, health checks, and Prometheus-compatible endpoints. This guide covers all monitoring features and best practices.

## Quick Start

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Enable metrics with default configuration
app.enableMetrics();

// Access metrics
// GET /metrics - Prometheus format
// GET /health - Health checks

app.listen(3000);
```

## Configuration Options

### Basic Configuration

```typescript
app.enableMetrics({
  endpoint: '/metrics', // Metrics endpoint
  enableHealthCheck: true, // Enable /health endpoint
  collectDefaultMetrics: true, // System metrics
  requestTracking: true, // HTTP request tracking
  format: 'prometheus', // 'prometheus' or 'json'
  prefix: 'myapp_', // Metric name prefix
});
```

### Advanced Configuration

```typescript
app.enableMetrics({
  endpoint: '/api/metrics',
  enableHealthCheck: true,
  collectDefaultMetrics: true,
  requestTracking: true,
  format: 'json',
  prefix: 'nextrush_',

  // Authentication for metrics endpoint
  authentication: (req) => {
    const token = req.headers.authorization;
    return token === 'Bearer secret-metrics-token';
  },

  // Custom metrics definitions
  customMetrics: {
    user_registrations: {
      type: 'counter',
      help: 'Total number of user registrations',
      labels: ['source', 'plan'],
    },
    database_connection_pool: {
      type: 'gauge',
      help: 'Current database connections',
      labels: ['database'],
    },
    request_duration: {
      type: 'histogram',
      help: 'Request duration in seconds',
      buckets: [0.1, 0.5, 1, 2, 5],
      labels: ['method', 'route'],
    },
  },
});
```

## Custom Metrics

### Counter Metrics

```typescript
// Increment counters
app.incrementCounter('user_registrations', { source: 'web', plan: 'free' });
app.incrementCounter('api_calls', { endpoint: '/users' }, 5);

// In route handlers
app.post('/auth/register', (req, res) => {
  // Registration logic
  app.incrementCounter('user_registrations', {
    source: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'web',
    plan: req.body.plan || 'free',
  });

  res.json({ success: true });
});
```

### Gauge Metrics

```typescript
// Set gauge values
app.setGauge('active_connections', 42);
app.setGauge('database_connection_pool', 15, { database: 'main' });
app.setGauge('queue_size', 100, { queue: 'email' });

// Dynamic gauge updates
setInterval(() => {
  const memUsage = process.memoryUsage();
  app.setGauge('memory_heap_used', memUsage.heapUsed);
  app.setGauge('memory_heap_total', memUsage.heapTotal);
}, 5000);
```

### Histogram Metrics

```typescript
// Observe histogram values (for timing/duration metrics)
app.observeHistogram('request_duration', 0.5, {
  method: 'GET',
  route: '/api/users',
});

// Automatic request duration tracking
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    app.observeHistogram('request_duration', duration, {
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode.toString(),
    });
  });

  next();
});
```

## Health Checks

### Adding Health Checks

```typescript
// Database health check
app.addHealthCheck('database', async () => {
  try {
    await database.ping();
    return { status: 'pass', message: 'Database connection OK' };
  } catch (error) {
    return { status: 'fail', message: `Database error: ${error.message}` };
  }
});

// External service health check
app.addHealthCheck('payment_service', async () => {
  try {
    const response = await fetch('https://api.stripe.com/v1/account', {
      headers: { Authorization: `Bearer ${process.env.STRIPE_KEY}` },
    });

    if (response.ok) {
      return { status: 'pass', message: 'Payment service accessible' };
    } else {
      return {
        status: 'warn',
        message: 'Payment service responding with errors',
      };
    }
  } catch (error) {
    return { status: 'fail', message: 'Payment service unreachable' };
  }
});

// Memory usage health check
app.addHealthCheck('memory', async () => {
  const usage = process.memoryUsage();
  const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const totalMB = Math.round(usage.heapTotal / 1024 / 1024);

  if (usedMB > 512) {
    // 512MB threshold
    return {
      status: 'warn',
      message: `High memory usage: ${usedMB}MB / ${totalMB}MB`,
    };
  }

  return {
    status: 'pass',
    message: `Memory usage OK: ${usedMB}MB / ${totalMB}MB`,
  };
});
```

### Health Check Response

```json
{
  "status": "healthy",
  "timestamp": 1642678800000,
  "uptime": 3600000,
  "checks": {
    "database": {
      "status": "pass",
      "message": "Database connection OK",
      "duration": 15
    },
    "payment_service": {
      "status": "pass",
      "message": "Payment service accessible",
      "duration": 120
    },
    "memory": {
      "status": "warn",
      "message": "High memory usage: 520MB / 1024MB",
      "duration": 1
    }
  }
}
```

## Metrics Output Formats

### Prometheus Format

```text
# HELP nextrush_http_requests_total Total number of HTTP requests
# TYPE nextrush_http_requests_total counter
nextrush_http_requests_total 1234

# HELP nextrush_http_requests_active Number of active HTTP requests
# TYPE nextrush_http_requests_active gauge
nextrush_http_requests_active 5

# HELP nextrush_memory_usage_bytes Memory usage in bytes
# TYPE nextrush_memory_usage_bytes gauge
nextrush_memory_usage_bytes 52428800

# HELP nextrush_user_registrations Custom metric
# TYPE nextrush_user_registrations gauge
nextrush_user_registrations{source="web",plan="free"} 42
nextrush_user_registrations{source="mobile",plan="premium"} 18
```

### JSON Format

```json
{
  "request": {
    "total": 1234,
    "active": 5,
    "byMethod": {
      "GET": 800,
      "POST": 300,
      "PUT": 100,
      "DELETE": 34
    },
    "byStatus": {
      "200": 1100,
      "404": 80,
      "500": 4
    },
    "averageResponseTime": 150,
    "totalResponseTime": 185100,
    "errors": 84
  },
  "system": {
    "uptime": 3600000,
    "memory": {
      "used": 1073741824,
      "total": 8589934592,
      "heap": {
        "rss": 52428800,
        "heapTotal": 20971520,
        "heapUsed": 18874368,
        "external": 1089024
      }
    },
    "cpu": {
      "usage": 0.15,
      "load": [0.2, 0.5, 0.8]
    },
    "process": {
      "pid": 12345,
      "version": "v18.17.0",
      "arch": "x64",
      "platform": "linux"
    }
  },
  "custom": {
    "user_registrations": [
      {
        "value": 42,
        "labels": { "source": "web", "plan": "free" },
        "timestamp": 1642678800000
      }
    ]
  }
}
```

## Advanced Features

### Business Metrics

```typescript
// Track business KPIs
app.post('/api/orders', async (req, res) => {
  const order = await createOrder(req.body);

  // Track order metrics
  app.incrementCounter('orders_created', {
    product: order.product,
    plan: order.plan,
    country: order.billing.country,
  });

  app.setGauge('revenue_today', await getTodaysRevenue());
  app.observeHistogram('order_value', order.total, {
    currency: order.currency,
  });

  res.json({ order });
});
```

### Performance Monitoring

```typescript
// Database query performance
const measureDbQuery = (queryName: string) => {
  return async (query: string, params: any[]) => {
    const start = Date.now();

    try {
      const result = await database.query(query, params);
      const duration = (Date.now() - start) / 1000;

      app.observeHistogram('database_query_duration', duration, {
        query: queryName,
        status: 'success',
      });

      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;

      app.observeHistogram('database_query_duration', duration, {
        query: queryName,
        status: 'error',
      });

      app.incrementCounter('database_errors', { query: queryName });
      throw error;
    }
  };
};

// Usage
const getUserQuery = measureDbQuery('get_user');
const user = await getUserQuery('SELECT * FROM users WHERE id = ?', [userId]);
```

### Error Tracking

```typescript
// Global error tracking
app.use((err, req, res, next) => {
  app.incrementCounter('errors', {
    type: err.constructor.name,
    route: req.route?.path || req.path,
    method: req.method,
    status: err.status || 500,
  });

  // Log error details
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  next(err);
});
```

## Integration with External Systems

### Prometheus Integration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'nextrush-app'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "NextRush Application Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(nextrush_http_requests_total[5m])",
            "legendFormat": "{{method}} requests/sec"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(nextrush_request_duration_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      }
    ]
  }
}
```

### CloudWatch Integration

```typescript
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'us-east-1' });

// Send custom metrics to CloudWatch
app.use(async (req, res, next) => {
  res.on('finish', async () => {
    try {
      await cloudwatch.send(
        new PutMetricDataCommand({
          Namespace: 'NextRush/Application',
          MetricData: [
            {
              MetricName: 'RequestCount',
              Value: 1,
              Unit: 'Count',
              Dimensions: [
                { Name: 'Method', Value: req.method },
                { Name: 'Route', Value: req.route?.path || req.path },
              ],
            },
            {
              MetricName: 'ResponseTime',
              Value: res.get('X-Response-Time'),
              Unit: 'Milliseconds',
            },
          ],
        })
      );
    } catch (error) {
      console.error('Failed to send metrics to CloudWatch:', error);
    }
  });

  next();
});
```

## Best Practices

### 1. Metric Naming Conventions

```typescript
// Good metric names
app.incrementCounter('http_requests_total');
app.setGauge('database_connections_active');
app.observeHistogram('request_duration_seconds');

// Avoid
app.incrementCounter('requests'); // Too generic
app.setGauge('db_conn'); // Unclear abbreviation
```

### 2. Label Usage

```typescript
// Good label usage
app.incrementCounter('http_requests_total', {
  method: 'GET',
  status: '200',
  endpoint: '/api/users',
});

// Avoid high cardinality labels
app.incrementCounter('requests', {
  user_id: '12345', // High cardinality!
  timestamp: Date.now().toString(), // Infinite cardinality!
});
```

### 3. Performance Considerations

```typescript
// Batch metric updates
const metricBatch = [];

app.use((req, res, next) => {
  res.on('finish', () => {
    metricBatch.push({
      name: 'http_requests_total',
      value: 1,
      labels: { method: req.method, status: res.statusCode },
    });

    // Flush batch periodically
    if (metricBatch.length >= 100) {
      flushMetrics(metricBatch);
      metricBatch.length = 0;
    }
  });

  next();
});
```

### 4. Alerting Rules

```yaml
# Prometheus alerting rules
groups:
  - name: nextrush.rules
    rules:
      - alert: HighErrorRate
        expr: rate(nextrush_http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High error rate detected

      - alert: HighMemoryUsage
        expr: nextrush_memory_usage_bytes > 1073741824 # 1GB
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: High memory usage
```

## Troubleshooting

### Common Issues

1. **High cardinality metrics**: Limit label values to avoid memory issues
2. **Missing metrics**: Ensure proper initialization and endpoint access
3. **Performance impact**: Use sampling for high-frequency metrics

### Debug Mode

```typescript
app.enableMetrics({
  debug: true, // Enable debug logging
  endpoint: '/debug/metrics',
});

// Manual metrics inspection
app.get('/debug/metrics-raw', (req, res) => {
  const metrics = app.getMetrics();
  res.json({
    metrics,
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  });
});
```

This monitoring system provides comprehensive observability for production applications while maintaining performance and ease of use.
