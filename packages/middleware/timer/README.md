# @nextrush/timer

High-resolution request timing middleware for NextRush. Measure response times with nanosecond precision and Server-Timing support.

## Installation

```bash
npm install @nextrush/timer
# or
pnpm add @nextrush/timer
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { timer } from '@nextrush/timer';

const app = createApp();

// Add timing to all requests
app.use(timer());

app.get('/api/data', (ctx) => {
  // Access timing info
  console.log('Response time:', ctx.state.responseTime);
  ctx.json({ data: 'Hello' });
});
```

## Features

- **High Resolution**: Uses `process.hrtime.bigint()` for nanosecond precision
- **Server-Timing**: Native browser DevTools integration
- **Custom Metrics**: Track database queries, cache hits, external calls
- **Low Overhead**: Minimal performance impact
- **Zero Dependencies**: Pure TypeScript implementation

## Middleware Options

### timer(options?)

Basic request timing:

```typescript
app.use(timer({
  // Response header name (default: 'X-Response-Time')
  header: 'X-Response-Time',

  // Header value suffix (default: 'ms')
  suffix: 'ms',

  // Decimal precision (default: 2)
  precision: 2,

  // State key (default: 'responseTime')
  stateKey: 'responseTime',
}));
```

### responseTime(options?)

Alias for `timer()`:

```typescript
import { responseTime } from '@nextrush/timer';

app.use(responseTime());
```

### serverTiming(options?)

Add Server-Timing headers for DevTools:

```typescript
import { serverTiming } from '@nextrush/timer';

app.use(serverTiming());

app.get('/api/users', async (ctx) => {
  // Add custom timing metrics
  ctx.timing.start('db');
  const users = await db.query('SELECT * FROM users');
  ctx.timing.end('db');

  ctx.timing.start('serialize');
  const json = JSON.stringify(users);
  ctx.timing.end('serialize');

  ctx.json(users);
});
```

**Response Header:**

```
Server-Timing: db;dur=45.2, serialize;dur=2.1, total;dur=50.5
```

## Context API

After applying middleware:

```typescript
// Timer middleware
ctx.state.responseTime   // Response time in ms (number)
ctx.state.startTime      // Request start time (bigint)

// Server-Timing middleware
ctx.timing.start(name)   // Start a named timer
ctx.timing.end(name)     // End a named timer
ctx.timing.add(name, ms) // Add a metric with known duration
ctx.timing.get(name)     // Get timer duration
```

## Server-Timing API

Track multiple operations:

```typescript
app.use(serverTiming());

app.get('/api/dashboard', async (ctx) => {
  // Database query
  ctx.timing.start('db-users');
  const users = await db.getUsers();
  ctx.timing.end('db-users');

  // Cache lookup
  ctx.timing.start('cache');
  const cached = await cache.get('stats');
  ctx.timing.end('cache');

  // External API call
  ctx.timing.start('external-api');
  const external = await fetch('https://api.example.com/data');
  ctx.timing.end('external-api');

  // Add pre-calculated timing
  ctx.timing.add('render', 5.2);

  ctx.json({ users, cached, external });
});
```

**Result in Browser DevTools:**

```
Server-Timing: db-users;dur=32.5, cache;dur=1.2, external-api;dur=125.3, render;dur=5.2, total;dur=170.4
```

## Adding Descriptions

Include human-readable descriptions:

```typescript
ctx.timing.start('db', 'Database Query');
ctx.timing.end('db');
// Server-Timing: db;desc="Database Query";dur=32.5
```

## Response Headers

### X-Response-Time

```
X-Response-Time: 45.23ms
```

### Server-Timing

```
Server-Timing: db;dur=32.5, cache;dur=1.2;desc="Redis Lookup", total;dur=45.2
```

## Integration with Logging

```typescript
import { timer } from '@nextrush/timer';
import { logger } from '@nextrush/logger';

app.use(timer());
app.use(logger({
  customProps: (ctx) => ({
    responseTime: ctx.state.responseTime,
  }),
}));
```

## Conditional Timing

Skip timing for specific routes:

```typescript
app.use(timer({
  skip: (ctx) => ctx.path === '/health',
}));
```

## Custom Header Format

```typescript
app.use(timer({
  // Custom format function
  format: (ms) => `${ms.toFixed(3)} milliseconds`,
}));
// X-Response-Time: 45.234 milliseconds
```

## Low-Level Timing Utilities

```typescript
import { startTimer, endTimer, formatDuration } from '@nextrush/timer';

const start = startTimer();
// ... operation
const duration = endTimer(start);
console.log(formatDuration(duration)); // "45.23ms"
```

## API Reference

### Exports

```typescript
import {
  timer,           // Basic timing middleware
  responseTime,    // Alias for timer
  serverTiming,    // Server-Timing middleware
  startTimer,      // Utility: start high-res timer
  endTimer,        // Utility: end timer, get duration
  formatDuration,  // Utility: format ms to string
} from '@nextrush/timer';
```

### Types

```typescript
interface TimerOptions {
  header?: string;
  suffix?: string;
  precision?: number;
  stateKey?: string;
  skip?: (ctx: Context) => boolean;
  format?: (ms: number) => string;
}

interface ServerTimingOptions {
  includeTotal?: boolean;
  totalName?: string;
  precision?: number;
}

interface TimingAPI {
  start(name: string, description?: string): void;
  end(name: string): number;
  add(name: string, duration: number, description?: string): void;
  get(name: string): number | undefined;
  getAll(): Map<string, TimingEntry>;
}
```

## Performance Considerations

- Timer overhead is typically < 0.01ms
- Server-Timing adds minimal header size
- Use `skip` option for high-frequency endpoints

## Browser DevTools

Server-Timing is visible in:

1. **Chrome DevTools** → Network tab → Select request → Timing tab
2. **Firefox DevTools** → Network tab → Timings column
3. **Safari Web Inspector** → Network tab → Resource details

## License

MIT
