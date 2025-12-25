# NextRush v3 Integration Testing Plan

## Overview

This document outlines the integration testing strategy for NextRush v3. Integration tests verify that multiple components work together correctly, testing real HTTP requests against running servers.

## Test Categories

### 1. Core Integration Tests

**Location**: `packages/core/src/__tests__/integration/`

| Test Suite | Description | Priority |
|------------|-------------|----------|
| `app.integration.test.ts` | Full app lifecycle with middleware | High |
| `middleware-chain.integration.test.ts` | Complex middleware composition | High |
| `error-handling.integration.test.ts` | Error propagation through middleware | High |
| `context.integration.test.ts` | Context state across middleware | Medium |

**Test Scenarios**:
- Application startup and shutdown
- Multiple middleware executing in order
- Error middleware catching errors
- Context state persistence across middleware chain
- Response already sent detection

### 2. Router Integration Tests

**Location**: `packages/router/src/__tests__/integration/`

| Test Suite | Description | Priority |
|------------|-------------|----------|
| `routing.integration.test.ts` | Full routing with real requests | High |
| `params.integration.test.ts` | Route parameters extraction | High |
| `nested-routers.integration.test.ts` | Router composition | Medium |
| `method-handling.integration.test.ts` | HTTP method matching | Medium |

**Test Scenarios**:
- GET/POST/PUT/DELETE routing
- Route parameter extraction (`:id`, `:slug`)
- Query string parsing
- Wildcard routes (`/*`)
- 404 handling
- Method not allowed (405)
- Nested router mounting

### 3. Middleware Integration Tests

**Location**: `packages/middleware/*/src/__tests__/integration/`

| Package | Test Focus |
|---------|------------|
| `body-parser` | JSON/form/text parsing with real requests |
| `cors` | CORS headers, preflight requests |
| `helmet` | Security headers on responses |
| `rate-limit` | Rate limiting with concurrent requests |
| `compression` | Gzip/brotli response compression |
| `cookies` | Cookie set/get/delete |

**Key Scenarios**:
```typescript
// body-parser
- Parse JSON body correctly
- Handle malformed JSON (400)
- Respect content-type header
- Handle large payloads (413)

// cors
- Add CORS headers to response
- Handle OPTIONS preflight
- Respect origin whitelist
- Expose custom headers

// rate-limit
- Block after limit exceeded (429)
- Reset after window expires
- Tiered limits work correctly
- Whitelist bypass works
```

### 4. Plugin Integration Tests

**Location**: `packages/plugins/*/src/__tests__/integration/`

| Package | Test Focus |
|---------|------------|
| `static` | File serving with caching |
| `websocket` | WebSocket connections and messaging |
| `template` | Template rendering with layouts |
| `events` | Event emission and handling |
| `logger` | Log output verification |

### 5. Adapter Integration Tests

**Location**: `packages/adapters/node/src/__tests__/integration/`

| Test Suite | Description |
|------------|-------------|
| `http.integration.test.ts` | Node.js HTTP server |
| `keep-alive.integration.test.ts` | Connection keep-alive |
| `streaming.integration.test.ts` | Stream responses |

### 6. End-to-End (E2E) Tests

**Location**: `apps/e2e-tests/`

Full application scenarios:

| Scenario | Description |
|----------|-------------|
| `hello-world.e2e.ts` | Minimal app test |
| `rest-api.e2e.ts` | Full REST API with CRUD |
| `authentication.e2e.ts` | Auth flow with middleware |
| `file-upload.e2e.ts` | Multipart form handling |
| `websocket.e2e.ts` | WebSocket chat simulation |
| `static-spa.e2e.ts` | SPA with static files |

## Test Utilities

### Test Server Helper

```typescript
// test-utils/server.ts
import { createApp } from '@nextrush/core';
import { listen } from '@nextrush/adapter-node';

export async function createTestServer(setup: (app: Application) => void) {
  const app = createApp();
  setup(app);

  const server = await listen(app, 0); // Random port
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://localhost:${port}`;

  return {
    app,
    server,
    baseUrl,
    fetch: (path: string, init?: RequestInit) => fetch(`${baseUrl}${path}`, init),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
```

### Request Helper

```typescript
// test-utils/request.ts
export async function testRequest(url: string, options: TestRequestOptions = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: await response.json().catch(() => response.text()),
    ok: response.ok,
  };
}
```

## Test Structure Example

```typescript
// packages/core/src/__tests__/integration/app.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer } from '@nextrush/test-utils';
import { createApp } from '../../application';

describe('Application Integration', () => {
  let server: Awaited<ReturnType<typeof createTestServer>>;

  beforeAll(async () => {
    server = await createTestServer((app) => {
      app.use(async (ctx) => {
        ctx.json({ message: 'Hello World' });
      });
    });
  });

  afterAll(async () => {
    await server.close();
  });

  it('should handle GET request', async () => {
    const response = await server.fetch('/');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.message).toBe('Hello World');
  });

  it('should return 404 for unknown routes', async () => {
    const response = await server.fetch('/unknown');
    expect(response.status).toBe(404);
  });
});
```

## Coverage Requirements

| Category | Min Coverage |
|----------|-------------|
| Core Integration | 85% |
| Router Integration | 85% |
| Middleware Integration | 80% |
| Plugin Integration | 75% |
| E2E Tests | 70% |

## CI/CD Integration

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install
      - run: pnpm build
      - run: pnpm test:integration

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: integration
```

## Next Steps

1. **Phase 1**: Core + Router integration tests
2. **Phase 2**: Middleware integration tests
3. **Phase 3**: Plugin integration tests
4. **Phase 4**: E2E test suite
5. **Phase 5**: CI/CD pipeline setup

## Running Integration Tests

```bash
# Run all integration tests
pnpm test:integration

# Run specific package integration tests
pnpm --filter @nextrush/core test:integration

# Run with coverage
pnpm test:integration --coverage

# Run E2E tests
pnpm test:e2e
```
