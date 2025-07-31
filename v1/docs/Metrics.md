# 📊 NextRush Metrics & Monitoring Plugin

## 📋 Table of Contents

- [🎯 Overview](#-overview)
- [✨ Key Features](#-key-features)
- [🚀 Quick Start](#-quick-start)
- [📚 API Reference](#-api-reference)
- [⚙️ Configuration](#-configuration)
- [💻 Usage Examples](#-usage-examples)
- [🏗️ Architecture](#-architecture)
- [🛠️ Best Practices](#-best-practices)
- [🚨 Troubleshooting](#-troubleshooting)

---

## 🎯 Overview

NextRush provides **simple yet powerful metrics and monitoring** with enterprise-grade features. The plugin is designed for **ease of use** while maintaining high performance and comprehensive monitoring capabilities.

### 🌟 Philosophy

- **Simple API**: Easy-to-use methods that don't get in your way
- **Modular Design**: Clean separation of concerns with focused components
- **Enterprise Ready**: Production-grade features when you need them
- **Zero Configuration**: Works out of the box with sensible defaults

---

## ✨ Key Features

| Feature | Description | Benefit |
|---------|-------------|---------|
| **📊 Simple Metrics** | Counter, gauge, histogram APIs | Easy to add to any application |
| **🏥 Health Checks** | Built-in and custom health monitoring | Reliable service monitoring |
| **📈 Prometheus Format** | Industry-standard metrics format | Works with existing tools |
| **🎯 Auto-Collection** | HTTP requests tracked automatically | Zero-config monitoring |
| **💾 Memory Efficient** | Automatic cleanup and optimization | Production ready |
| **🔒 Secure** | Optional authentication for endpoints | Enterprise security |

---

## 🚀 Quick Start

### Installation & Basic Usage

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// ✨ Enable metrics with one line
app.enableMetrics();

// Your routes work as normal
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000);

// 📊 Metrics: http://localhost:3000/metrics
// 🏥 Health: http://localhost:3000/health
```

### Custom Metrics

```typescript
import { createApp } from 'nextrush';

const app = createApp();

app.enableMetrics({
  prefix: 'myapp_',
  customMetrics: [
    {
      name: 'user_registrations_total',
      type: 'counter',
      help: 'Total user registrations',
      labels: ['source', 'plan']
    }
  ]
});

// Track custom events
app.post('/register', (req, res) => {
  // Increment counter with labels
  app.incrementCounter('user_registrations_total', {
    source: 'web',
    plan: req.body.plan || 'free'
  });
  
  res.json({ success: true });
});

app.listen(3000);
```

---

## 📚 API Reference

### Core Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `enableMetrics(options?)` | `(options?: MetricsOptions) => Application` | Enable metrics collection and endpoints |
| `incrementCounter(name, labels?, value?)` | `(name: string, labels?: Record<string, string>, value?: number) => void` | Increment a counter metric |
| `setGauge(name, value, labels?)` | `(name: string, value: number, labels?: Record<string, string>) => void` | Set a gauge metric value |
| `observeHistogram(name, value, labels?)` | `(name: string, value: number, labels?: Record<string, string>) => void` | Record a histogram observation |
| `addHealthCheck(name, check)` | `(name: string, check: HealthCheckFunction) => void` | Register a health check |
| `removeHealthCheck(name)` | `(name: string) => void` | Remove a health check |
| `getMetrics()` | `() => string` | Get metrics in Prometheus format |
| `getHealth()` | `() => Promise<HealthStatus>` | Get current health status |

### Configuration Interface

```typescript
interface MetricsOptions {
  endpoint?: string;                    // Default: '/metrics'
  enableHealthCheck?: boolean;          // Default: true
  collectDefaultMetrics?: boolean;      // Default: true
  prefix?: string;                      // Default: 'nextrush_'
  defaultLabels?: Record<string, string>;
  customMetrics?: CustomMetric[];
  authentication?: (req: NextRushRequest) => boolean;
}
```

### Custom Metric Definition

```typescript
interface CustomMetric {
  name: string;                         // Metric name
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;                         // Description
  labels?: string[];                    // Label names
  buckets?: number[];                   // Histogram buckets
  quantiles?: number[];                 // Summary quantiles
}
```

### Health Check Function

```typescript
type HealthCheckFunction = () => Promise<{
  status: 'pass' | 'fail' | 'warn';
  message?: string;
}>;
```

### Response Types

#### HealthStatus
```typescript
interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: number;
  uptime: number;
  checks: Record<string, HealthCheckResult>;
}
```

#### HealthCheckResult
```typescript
interface HealthCheckResult {
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration: number;
  timestamp: number;
}
```

---

## ⚙️ Configuration

### Default Configuration

```typescript
const defaultOptions: MetricsOptions = {
  endpoint: '/metrics',
  enableHealthCheck: true,
  collectDefaultMetrics: true,
  prefix: 'nextrush_',
  defaultLabels: {},
  customMetrics: [],
  authentication: undefined
};
```

### Production Configuration

```typescript
app.enableMetrics({
  endpoint: '/internal/metrics',        // Internal endpoint
  prefix: 'myservice_',                 // Service-specific prefix
  defaultLabels: {
    service: process.env.SERVICE_NAME,
    version: process.env.APP_VERSION,
    environment: process.env.NODE_ENV,
  },
  authentication: (req) => {
    // Simple API key auth
    return req.headers['x-api-key'] === process.env.METRICS_API_KEY;
  }
});
```

---

## 💻 Usage Examples

### Business Metrics

```typescript
import { createApp } from 'nextrush';

const app = createApp();

app.enableMetrics({
  prefix: 'ecommerce_',
  customMetrics: [
    {
      name: 'orders_total',
      type: 'counter',
      help: 'Total orders processed',
      labels: ['status', 'payment_method']
    },
    {
      name: 'cart_value_histogram',
      type: 'histogram',
      help: 'Shopping cart values',
      buckets: [10, 50, 100, 500, 1000]
    }
  ]
});

// Order processing
app.post('/orders', async (req, res) => {
  try {
    const order = await processOrder(req.body);
    
    // Track successful order
    app.incrementCounter('orders_total', {
      status: 'completed',
      payment_method: order.paymentMethod
    });
    
    // Track cart value
    app.observeHistogram('cart_value_histogram', order.total);
    
    res.json(order);
  } catch (error) {
    // Track failed order
    app.incrementCounter('orders_total', {
      status: 'failed',
      payment_method: 'unknown'
    });
    
    res.status(500).json({ error: 'Order processing failed' });
  }
});
```

### Advanced Health Checks

```typescript
import { createApp } from 'nextrush';
import { createConnection } from 'database';

const app = createApp();
const db = createConnection();

app.enableMetrics();

// Database health check
app.addHealthCheck('database', async () => {
  try {
    await db.ping();
    return { status: 'pass', message: 'Database connection healthy' };
  } catch (error) {
    return { status: 'fail', message: `Database error: ${error.message}` };
  }
});

// External API health check
app.addHealthCheck('payment_api', async () => {
  try {
    const response = await fetch('https://api.payment.com/health', {
      timeout: 3000
    });
    
    if (response.ok) {
      return { status: 'pass', message: 'Payment API healthy' };
    } else {
      return { status: 'warn', message: `Payment API returned ${response.status}` };
    }
  } catch (error) {
    return { status: 'fail', message: 'Payment API unreachable' };
  }
});

// Custom health endpoint with detailed info
app.get('/admin/health', async (req, res) => {
  const health = await app.getHealth();
  
  // Add custom information
  const detailed = {
    ...health,
    version: process.env.APP_VERSION,
    build: process.env.BUILD_NUMBER,
    environment: process.env.NODE_ENV,
  };
  
  res.status(health.status === 'healthy' ? 200 : 503).json(detailed);
});
```

### Monitoring Middleware

```typescript
import { createApp } from 'nextrush';

const app = createApp();

app.enableMetrics({
  customMetrics: [
    {
      name: 'api_response_time_seconds',
      type: 'histogram',
      help: 'API response times',
      labels: ['method', 'route', 'status_class'],
      buckets: [0.1, 0.5, 1, 2, 5]
    }
  ]
});

// Custom monitoring middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const statusClass = Math.floor(res.statusCode / 100) + 'xx';
    
    app.observeHistogram('api_response_time_seconds', duration, {
      method: req.method,
      route: req.route?.path || 'unknown',
      status_class: statusClass
    });
  });
  
  next();
});
```

---

## 🏗️ Architecture

The metrics plugin uses a **modular architecture** for maintainability and performance:

```
📊 MetricsPlugin (Main)
├── 🗄️ MetricsStorage (High-performance storage)
├── 🏥 HealthCheckManager (Health monitoring)
├── 📈 PrometheusFormatter (Metric formatting)
└── 🖥️ SystemMonitor (System metrics)
```

### Component Responsibilities

| Component | Purpose | Size |
|-----------|---------|------|
| `MetricsPlugin` | Main API and coordination | ~220 lines |
| `MetricsStorage` | High-performance metric storage | ~120 lines |
| `HealthCheckManager` | Health check orchestration | ~90 lines |
| `PrometheusFormatter` | Prometheus format output | ~130 lines |
| `SystemMonitor` | System metrics collection | ~80 lines |

### Benefits of Modular Design

- **📦 Focused Components**: Each module has a single responsibility
- **🧪 Easy Testing**: Components can be tested in isolation
- **🔧 Maintainable**: Changes are localized to specific modules
- **📈 Scalable**: New features can be added without bloating core code

---

## 🛠️ Best Practices

### Metric Naming

```typescript
// ✅ Good: Clear, consistent names
app.incrementCounter('api_requests_total');
app.setGauge('active_connections');
app.observeHistogram('request_duration_seconds');

// ❌ Bad: Unclear or inconsistent names
app.incrementCounter('reqs');
app.setGauge('connections_active');  // Inconsistent ordering
app.observeHistogram('duration');    // Too generic
```

### Label Usage

```typescript
// ✅ Good: Low cardinality labels
app.incrementCounter('http_requests_total', {
  method: 'GET',
  status: '200',
  endpoint: '/api/users'  // Limited set of values
});

// ❌ Bad: High cardinality labels
app.incrementCounter('http_requests_total', {
  user_id: '12345',      // Unbounded values
  request_id: 'abc-123'  // Unique per request
});
```

### Health Check Design

```typescript
// ✅ Good: Fast, reliable checks
app.addHealthCheck('redis', async () => {
  try {
    const start = Date.now();
    await redis.ping();
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      return { status: 'warn', message: `Redis slow: ${duration}ms` };
    }
    
    return { status: 'pass', message: 'Redis healthy' };
  } catch (error) {
    return { status: 'fail', message: error.message };
  }
});

// ❌ Bad: Slow or unreliable checks
app.addHealthCheck('external_api', async () => {
  // This could timeout or be unreliable
  const response = await fetch('https://slow-api.com/health');
  return { status: response.ok ? 'pass' : 'fail' };
});
```

---

## 🚨 Troubleshooting

### Common Issues

#### High Memory Usage

**Problem**: Metrics consuming too much memory

**Solution**: 
```typescript
// Monitor metric cardinality
app.get('/admin/metrics-stats', (req, res) => {
  const stats = app.getMetricsStorage().getStats();
  res.json({
    metricCount: stats.metricCount,
    memoryUsage: stats.memoryUsage,
    recommendation: stats.metricCount > 10000 ? 'Consider reducing label cardinality' : 'Normal'
  });
});
```

#### Slow Health Checks

**Problem**: Health endpoint responding slowly

**Solution**:
```typescript
// Add timeout wrapper
const withTimeout = (check: HealthCheckFunction, timeoutMs: number = 5000) => {
  return async () => {
    return Promise.race([
      check(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  };
};

app.addHealthCheck('database', withTimeout(async () => {
  await db.ping();
  return { status: 'pass' };
}, 3000));
```

#### Missing Metrics

**Problem**: Custom metrics not appearing

**Solution**:
```typescript
// Verify metric registration
app.enableMetrics({
  customMetrics: [
    {
      name: 'my_metric_total',
      type: 'counter',
      help: 'My custom metric'
    }
  ]
});

// Ensure you're using the correct name
app.incrementCounter('my_metric_total');  // ✅ Correct
app.incrementCounter('my_metric');        // ❌ Wrong
```

### Debug Mode

```typescript
// Enable debug logging in development
app.enableMetrics({
  // Add debug endpoint
});

app.get('/debug/metrics', (req, res) => {
  res.json({
    metricNames: app.getMetricsStorage().getMetricNames(),
    healthChecks: app.getHealthManager().getCheckNames(),
    systemMetrics: app.getSystemMonitor().getMetrics()
  });
});
```

---

## 📖 Additional Resources

- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
- [NextRush Plugin Development](./Plugins.md)
- [Production Deployment Guide](./DEPLOYMENT.md)
- [Performance Guide](./Performance.md)

---

*NextRush Metrics Plugin - Simple, powerful monitoring for modern applications* 🚀
