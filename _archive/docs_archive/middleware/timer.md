# Timer Middleware

> Precision request timing with microsecond accuracy and Server-Timing API support.

## The Problem

Performance monitoring requires accurate timing data:

**Milliseconds hide latency spikes.** When your P99 latency is 5ms but P99.9 is 50ms, millisecond precision can miss the tail latency that affects real users.

**Manual timing is error-prone.** Calculating `Date.now()` differences in every handler leads to inconsistent measurement points and forgotten timings.

**Server-Timing headers are underutilized.** Browsers and APM tools can consume timing data via the Server-Timing header, but most apps don't implement it.

**Response time logging is scattered.** Without centralized timing, logs have inconsistent formats and measurement points.

## How NextRush Approaches This

NextRush's Timer middleware provides:

1. **High-resolution timing** using `performance.now()` or `process.hrtime.bigint()`
2. **Automatic Server-Timing headers** for browser DevTools integration
3. **Multiple output formats** (ms, μs, ns, human-readable)
4. **Detailed breakdown** with basic and detailed middleware options
5. **Clean state access** via `ctx.state.startTime` and `ctx.state.timing`

## Mental Model

```
Request Arrives
     │
     ▼
┌──────────────────────────────────────────────┐
│           Timer Middleware Start             │
│  ctx.state.startTime = performance.now()     │
│  ctx.state.timing = TimingInfo object        │
└──────────────────────────────────────────────┘
     │
     ▼
   Your Application Logic
     │
     ▼
┌──────────────────────────────────────────────┐
│           Timer Middleware End               │
│  Calculate duration                          │
│  Set Server-Timing header (if enabled)       │
│  Store timing in ctx.state.timing            │
└──────────────────────────────────────────────┘
     │
     ▼
Response with timing data
```

## Installation

```bash
pnpm add @nextrush/timer
```

## Basic Usage

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';
import { timer } from '@nextrush/timer';

const app = createApp();

// Add timing to all requests
app.use(timer());

app.get('/api/data', (ctx) => {
  // Access timing information
  console.log('Request started at:', ctx.state.startTime);
  ctx.json({ data: 'value' });
});

await serve(app, { port: 3000 });
```

**Response Headers:**

```
Server-Timing: total;dur=1.234;desc="Total Request Time"
X-Response-Time: 1.234ms
```

## API Reference

### timer(options?)

Basic timing middleware:

```typescript
timer({
  // Header name for response time
  header?: string;           // default: 'X-Response-Time'

  // Include Server-Timing header
  serverTiming?: boolean;    // default: true

  // Time unit for output
  unit?: 'ms' | 'us' | 'ns'; // default: 'ms'

  // Key in ctx.state
  stateKey?: string;         // default: 'timing'
})
```

### detailedTimer(options?)

Extended timing with breakdown metrics:

```typescript
import { detailedTimer } from '@nextrush/timer';

app.use(detailedTimer({
  // All timer options, plus:

  // Name for Server-Timing metric
  name?: string;             // default: 'total'

  // Description for Server-Timing
  description?: string;      // default: 'Total Request Time'
}));
```

## Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `header` | `string` | `'X-Response-Time'` | Response header name |
| `serverTiming` | `boolean` | `true` | Include Server-Timing header |
| `unit` | `'ms' \| 'us' \| 'ns'` | `'ms'` | Time unit |
| `stateKey` | `string` | `'timing'` | Key in `ctx.state` |
| `name` | `string` | `'total'` | Server-Timing metric name |
| `description` | `string` | `'Total Request Time'` | Server-Timing description |

## Context State

After middleware runs, timing data is available:

```typescript
// Basic timer
ctx.state.startTime   // number - High-resolution start time
ctx.state.timing      // TimingInfo object

// TimingInfo interface
interface TimingInfo {
  start: number;      // Start timestamp
  duration?: number;  // Duration (after await ctx.next())
  unit: string;       // Time unit
}
```

## Time Units

```typescript
// Milliseconds (default) - good for most cases
timer({ unit: 'ms' });
// X-Response-Time: 1.234ms

// Microseconds - for sub-millisecond precision
timer({ unit: 'us' });
// X-Response-Time: 1234.56us

// Nanoseconds - maximum precision
timer({ unit: 'ns' });
// X-Response-Time: 1234567ns
```

## Server-Timing Header

The Server-Timing header integrates with browser DevTools and APM tools:

```typescript
// Default
app.use(timer({ serverTiming: true }));
// Server-Timing: total;dur=1.234;desc="Total Request Time"

// Custom name and description
app.use(detailedTimer({
  name: 'api',
  description: 'API Processing',
}));
// Server-Timing: api;dur=1.234;desc="API Processing"

// Disable Server-Timing
app.use(timer({ serverTiming: false }));
// Only X-Response-Time header
```

### Viewing in Browser DevTools

1. Open DevTools → Network tab
2. Click on a request
3. Look for "Server-Timing" in the Timing section

## Common Patterns

### Logging Response Times

```typescript
import { timer } from '@nextrush/timer';
import { logger } from '@nextrush/logger';

app.use(timer());
app.use(async (ctx) => {
  await ctx.next();
  const { timing } = ctx.state;
  console.log(`${ctx.method} ${ctx.path} - ${timing.duration}${timing.unit}`);
});
```

### Multiple Timing Points

```typescript
app.use(timer({ stateKey: 'totalTiming' }));

app.use(async (ctx) => {
  const dbStart = performance.now();
  await db.query('...');
  const dbTime = performance.now() - dbStart;

  ctx.set('Server-Timing', `db;dur=${dbTime.toFixed(3)};desc="Database"`);
  await ctx.next();
});
```

### Conditional Timing

```typescript
app.use(async (ctx) => {
  // Only time slow requests
  await ctx.next();

  if (ctx.state.timing?.duration > 100) {
    console.warn(`Slow request: ${ctx.path} took ${ctx.state.timing.duration}ms`);
  }
});

app.use(timer());
```

### APM Integration

```typescript
import { timer } from '@nextrush/timer';

app.use(timer());

app.use(async (ctx) => {
  await ctx.next();

  // Send to your APM
  apm.recordMetric('http.response_time', ctx.state.timing.duration, {
    method: ctx.method,
    path: ctx.path,
    status: ctx.status,
  });
});
```

## Constants

All constants are exported for customization:

```typescript
import {
  DEFAULT_HEADER,        // 'X-Response-Time'
  DEFAULT_STATE_KEY,     // 'timing'
  DEFAULT_UNIT,          // 'ms'
  DEFAULT_NAME,          // 'total'
  DEFAULT_DESCRIPTION,   // 'Total Request Time'
} from '@nextrush/timer';
```

## TypeScript Types

```typescript
import type {
  TimerOptions,
  DetailedTimerOptions,
  TimingInfo,
  TimeUnit,
  Middleware,
} from '@nextrush/timer';

// TimerOptions
interface TimerOptions {
  header?: string;
  serverTiming?: boolean;
  unit?: TimeUnit;
  stateKey?: string;
}

// DetailedTimerOptions
interface DetailedTimerOptions extends TimerOptions {
  name?: string;
  description?: string;
}

// TimingInfo
interface TimingInfo {
  start: number;
  duration?: number;
  unit: string;
}

// TimeUnit
type TimeUnit = 'ms' | 'us' | 'ns';
```

## Performance Considerations

- **Overhead**: ~0.01ms per request (negligible)
- **Memory**: Minimal allocations (one object per request)
- **Resolution**: Uses `performance.now()` for best accuracy

### Why performance.now()?

| API | Resolution | Cross-Platform |
|-----|------------|----------------|
| `Date.now()` | ~1ms | ✅ |
| `performance.now()` | ~5μs | ✅ |
| `process.hrtime.bigint()` | ~1ns | Node.js only |

Timer uses `performance.now()` by default for the best balance of precision and portability.

## Runtime Support

Works on all JavaScript runtimes:

- **Node.js** ≥20
- **Bun** ≥1.0
- **Deno** ≥1.0
- **Cloudflare Workers**
- **Vercel Edge**

## Common Mistakes

### Mistake 1: Wrong Middleware Order

```typescript
// ❌ Timer won't measure route handlers
app.get('/api/data', handler);
app.use(timer());

// ✅ Timer first to measure everything
app.use(timer());
app.get('/api/data', handler);
```

### Mistake 2: Forgetting await ctx.next()

```typescript
// ❌ Duration will be wrong
app.use(timer());
app.use((ctx) => {
  // Missing await ctx.next()
  ctx.json({ data: 'value' });
});

// ✅ Properly await downstream
app.use(timer());
app.use(async (ctx) => {
  await ctx.next();
  // Duration is now correct
});
```

## Security

The Timer middleware sanitizes header values to prevent header injection:

```typescript
// Sanitization removes: \r, \n, :
// Safe characters: alphanumeric, -, _, ., spaces
```

---

**Package:** `@nextrush/timer`
**Version:** 3.0.0-alpha.1
**License:** MIT
**Build Size:** 3.15 KB ESM, 7.00 KB types
**Test Coverage:** 44/44 tests passing ✅
