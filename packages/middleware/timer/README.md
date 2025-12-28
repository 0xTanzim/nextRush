# @nextrush/timer

High-resolution request timing middleware for NextRush. Measure response times with microsecond precision and Server-Timing support.

## Features

- **High Resolution**: Uses `performance.now()` for sub-millisecond precision
- **Server-Timing**: Native browser DevTools integration
- **Multi-Runtime**: Works on Node.js, Bun, Deno, Cloudflare Workers
- **Security Hardened**: RFC 7230 compliant header sanitization
- **Zero Dependencies**: Pure TypeScript implementation
- **Detailed Mode**: Capture full timing information with start/end timestamps

## Installation

```bash
npm install @nextrush/timer
# or
pnpm add @nextrush/timer
# or
bun add @nextrush/timer
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { timer } from '@nextrush/timer';

const app = createApp();

// Add timing to all requests
app.use(timer());

app.get('/api/data', (ctx) => {
  // Access timing info after next()
  console.log('Response time:', ctx.state.responseTime);
  ctx.json({ data: 'Hello' });
});
```

**Response Header:**

```
X-Response-Time: 12.34ms
```

## Middleware Functions

### timer(options?)

Basic request timing middleware:

```typescript
import { timer } from '@nextrush/timer';

// Basic usage
app.use(timer());

// With options
app.use(timer({
  header: 'X-Duration',      // Custom header name
  suffix: ' ms',             // Custom suffix
  precision: 3,              // Decimal places (max: 6)
  stateKey: 'duration',      // ctx.state key
  exposeHeader: true,        // Set response header
}));
```

### responseTime(options?)

Alias for `timer()` with common naming:

```typescript
import { responseTime } from '@nextrush/timer';

app.use(responseTime());
```

### serverTiming(options?)

Uses the standard `Server-Timing` header format, visible in browser DevTools:

```typescript
import { serverTiming } from '@nextrush/timer';

app.use(serverTiming());
// Header: Server-Timing: total;dur=123.45
```

With description:

```typescript
app.use(serverTiming({
  metric: 'api',
  description: 'API Response Time',
}));
// Header: Server-Timing: api;dur=123.45;desc="API Response Time"
```

### detailedTimer(options?)

Captures complete timing information:

```typescript
import { detailedTimer } from '@nextrush/timer';
import type { TimingResult } from '@nextrush/timer';

app.use(detailedTimer({ detailed: true }));

app.use(async (ctx) => {
  await ctx.next();

  const timing = ctx.state.responseTime as TimingResult;
  console.log({
    duration: timing.duration,    // 123.45
    formatted: timing.formatted,  // "123.45ms"
    start: timing.start,          // 1234567890.123
    end: timing.end,              // 1234568013.573
  });
});
```

## Options Reference

### TimerOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `header` | `string` | `'X-Response-Time'` | Response header name |
| `suffix` | `string` | `'ms'` | Time unit suffix |
| `precision` | `number` | `2` | Decimal places (0-6) |
| `stateKey` | `string` | `'responseTime'` | Key in `ctx.state` |
| `exposeHeader` | `boolean` | `true` | Set response header |
| `now` | `() => number` | `performance.now` | Time getter function |

### ServerTimingOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `metric` | `string` | `'total'` | Metric name |
| `description` | `string` | - | Optional description |
| `precision` | `number` | `2` | Decimal places (0-6) |
| `stateKey` | `string` | `'responseTime'` | Key in `ctx.state` |
| `exposeHeader` | `boolean` | `true` | Set response header |
| `now` | `() => number` | `performance.now` | Time getter function |

### DetailedTimerOptions

Extends `TimerOptions` with:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `detailed` | `boolean` | `false` | Store `TimingResult` object |

## Context State

### Basic Timer

```typescript
app.use(timer());

app.use(async (ctx) => {
  await ctx.next();
  // ctx.state.responseTime: number (e.g., 123.45)
});
```

### Detailed Timer

```typescript
app.use(detailedTimer({ detailed: true }));

app.use(async (ctx) => {
  await ctx.next();
  const timing = ctx.state.responseTime as TimingResult;
  // timing.duration: number
  // timing.formatted: string
  // timing.start: number
  // timing.end: number
});
```

## Multiple Timing Metrics

Compose multiple Server-Timing headers for detailed breakdown:

```typescript
app.use(async (ctx) => {
  // Database timing
  const dbStart = performance.now();
  await db.query('SELECT * FROM users');
  const dbTime = performance.now() - dbStart;

  // Set custom Server-Timing metric
  ctx.set('Server-Timing', `db;dur=${dbTime.toFixed(2)};desc="Database"`);

  await ctx.next();
});

// Total timing
app.use(serverTiming({ metric: 'total' }));
```

**Result:**

```
Server-Timing: db;dur=32.50;desc="Database", total;dur=45.23
```

## Browser DevTools Integration

Server-Timing headers are visible in:

- **Chrome DevTools**: Network → Request → Timing tab
- **Firefox DevTools**: Network → Timings column
- **Safari Web Inspector**: Network → Resource details

## Security

### Header Injection Prevention

All metric names are sanitized per RFC 7230 token rules:

```typescript
// CRLF sequences removed
serverTiming({ metric: 'api\r\nEvil: header' })
// Result: "apiEvilheader;dur=..."

// Control characters removed from descriptions
serverTiming({ metric: 'api', description: 'Test\x00value' })
// Result: "api;dur=...;desc=\"Testvalue\""

// Quotes escaped in descriptions
serverTiming({ description: 'Test "quoted" value' })
// Result: "...;desc=\"Test \\\"quoted\\\" value\""
```

### Precision Clamping

Precision is automatically clamped to valid range (0-6):

```typescript
timer({ precision: 10 })  // Clamped to 6
timer({ precision: -1 })  // Clamped to 0
```

## Multi-Runtime Support

Uses only universal APIs compatible with all JavaScript runtimes:

- **Node.js** ≥20
- **Bun** ≥1.0
- **Deno** ≥1.0
- **Cloudflare Workers**
- **Vercel Edge**

```typescript
// Custom time getter for alternative runtimes
app.use(timer({
  now: () => Date.now(), // Fallback for environments without performance.now()
}));
```

## Testing

Use the `now` option to mock time in tests:

```typescript
import { timer } from '@nextrush/timer';
import { describe, it, expect, vi } from 'vitest';

describe('timing', () => {
  it('should measure duration', async () => {
    let time = 0;
    const mockNow = vi.fn(() => {
      time += 100;
      return time;
    });

    const middleware = timer({ now: mockNow });
    const ctx = createMockContext();

    await middleware(ctx);

    expect(ctx.state.responseTime).toBe(100);
  });
});
```

## Constants & Utilities

```typescript
import {
  // Constants
  DEFAULT_HEADER,        // 'X-Response-Time'
  SERVER_TIMING_HEADER,  // 'Server-Timing'
  DEFAULT_SUFFIX,        // 'ms'
  DEFAULT_PRECISION,     // 2
  MAX_PRECISION,         // 6
  DEFAULT_STATE_KEY,     // 'responseTime'
  DEFAULT_METRIC,        // 'total'

  // Utilities
  defaultTimeGetter,     // () => performance.now()
} from '@nextrush/timer';
```

## TypeScript Types

```typescript
import type {
  TimerOptions,
  ServerTimingOptions,
  DetailedTimerOptions,
  TimingResult,
  TimeGetter,
  TimerContext,
  Middleware,
} from '@nextrush/timer';
```

## Performance

- Overhead: < 0.01ms per request
- Memory: Minimal (no allocations in hot path)
- Build size: ~3.15 KB ESM, ~7 KB types

## API Reference

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `timer` | Function | Basic timing middleware |
| `responseTime` | Function | Alias for `timer` |
| `serverTiming` | Function | Server-Timing middleware |
| `detailedTimer` | Function | Extended timing with timestamps |
| `DEFAULT_HEADER` | Constant | `'X-Response-Time'` |
| `SERVER_TIMING_HEADER` | Constant | `'Server-Timing'` |
| `DEFAULT_SUFFIX` | Constant | `'ms'` |
| `DEFAULT_PRECISION` | Constant | `2` |
| `MAX_PRECISION` | Constant | `6` |
| `DEFAULT_STATE_KEY` | Constant | `'responseTime'` |
| `DEFAULT_METRIC` | Constant | `'total'` |
| `defaultTimeGetter` | Function | `performance.now()` wrapper |

## License

MIT
