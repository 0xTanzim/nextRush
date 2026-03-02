# Cross-Cutting Security Audit

## Vulnerability Summary

| ID     | Severity     | Package               | Issue                                               | OWASP Category                  |
| ------ | ------------ | --------------------- | --------------------------------------------------- | ------------------------------- |
| SEC-01 | **CRITICAL** | adapter-node          | IP Spoofing via X-Forwarded-For                     | A01 Broken Access Control       |
| SEC-02 | **CRITICAL** | adapter-node          | Prototype Pollution in query parser                 | A03 Injection                   |
| SEC-03 | **CRITICAL** | adapter-node          | `require()` in ESM module                           | A06 Vulnerable Components       |
| SEC-04 | **CRITICAL** | runtime               | Body size check after full buffering (DoS)          | A05 Security Misconfiguration   |
| SEC-05 | **CRITICAL** | runtime, adapter-node | `JSON.parse` without try/catch at boundary          | A03 Injection                   |
| SEC-06 | **HIGH**     | adapter-node          | Unbounded query parameter parsing                   | A05 Security Misconfiguration   |
| SEC-07 | **HIGH**     | adapter-node          | Stream duck-typing without error handling           | A08 Software Integrity Failures |
| SEC-08 | **HIGH**     | adapter-node          | Unsafe graceful shutdown order                      | A05 Security Misconfiguration   |
| SEC-09 | **HIGH**     | errors                | `errorHandler()` misclassifies adapter errors → 500 | A05 Security Misconfiguration   |
| SEC-10 | **MEDIUM**   | errors                | `err.name` always exposed (info disclosure)         | A01 Broken Access Control       |
| SEC-11 | **MEDIUM**   | errors                | Stack trace can leak filesystem paths               | A01 Broken Access Control       |
| SEC-12 | **MEDIUM**   | adapter-node          | `console.*` in production (info leak)               | A09 Logging & Monitoring        |
| SEC-13 | **MEDIUM**   | core                  | `NODE_ENV` staging → error messages exposed         | A01 Broken Access Control       |
| SEC-14 | **LOW**      | errors                | 404 returns request path (path enumeration)         | A01 Broken Access Control       |
| SEC-15 | **LOW**      | adapter-node          | No body in redirect response                        | Minimal                         |

---

## Detailed Analysis

### SEC-01: IP Spoofing (CRITICAL)

**Attack Vector**: Client sends `X-Forwarded-For: 1.2.3.4` header to any endpoint.

**Affected Code**:

```typescript
// packages/adapters/node/src/context.ts#L117-L127
private getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const firstIp = forwarded.split(',')[0];
    return firstIp?.trim() ?? '';
  }
  return req.socket?.remoteAddress ?? '';
}
```

**Consequences**:

- Rate limiting bypassed (new "IP" per request)
- Audit logs poisoned with attacker-chosen IPs
- Geo-fencing/IP allowlisting defeated
- Abuse detection systems blinded

**Fix**:

1. Default `trustProxy: false`
2. Only read `X-Forwarded-For` when `trustProxy === true` (or matches CIDR list)
3. Pass configuration from `ApplicationOptions` through adapter to context

---

### SEC-02: Prototype Pollution (CRITICAL)

**Attack Vector**: `GET /api?__proto__[isAdmin]=true`

**Affected Code**:

```typescript
// packages/adapters/node/src/utils.ts#L25-L57
const result: QueryParams = {}; // Has Object.prototype
result[key] = value; // key = '__proto__', 'constructor', 'prototype'
```

**Consequences**:

- `Object.prototype` mutation via `__proto__` key
- If result is spread/merged downstream, pollution propagates app-wide
- Can lead to privilege escalation, auth bypass, or RCE

**Fix**:

```typescript
const result: QueryParams = Object.create(null); // No prototype
if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
```

---

### SEC-03: `require()` in ESM (CRITICAL)

**Attack Vector**: Any GET/HEAD/OPTIONS/DELETE request that triggers `EmptyBodySource.stream()`.

**Affected Code**:

```typescript
// packages/adapters/node/src/body-source.ts#L195-L199
stream(): NodeJS.ReadableStream {
  const { Readable } = require('node:stream');  // CRASHES IN ESM
  return Readable.from([]);
}
```

**Consequences**: Hard runtime crash → service unavailability

**Fix**: Top-level `import { Readable } from 'node:stream'`.

---

### SEC-04: Body Size DoS (CRITICAL)

**Attack Vector**: Send multi-GB body without `Content-Length` to any POST endpoint.

**Affected Code**:

```typescript
// packages/runtime/src/body-source.ts#L191-L194
const arrayBuffer = await this.request.arrayBuffer();  // Full buffer first
if (buffer.length > this.options.limit) throw ...;     // Check after
```

**Consequences**: OOM / process crash under memory pressure

**Fix**: Stream-based size checking with byte counting during read.

---

### SEC-05: Unprotected JSON.parse (CRITICAL)

**Attack Vector**: Send malformed JSON body (`{"key": broken}`) to any endpoint using `ctx.body`.

**Affected Code**:

```typescript
// packages/runtime/src/body-source.ts#L144-L147
return JSON.parse(text) as T; // Raw SyntaxError → 500
```

**Consequences**: Internal error type propagated instead of structured 400

**Fix**: Wrap in try/catch, throw `BadRequestError`.

---

### SEC-06: Query Parameter DoS (HIGH)

**Attack Vector**: `GET /api?a=1&b=2&c=3&...` with thousands of parameters.

**Consequences**: CPU + memory amplification per request

**Fix**: Enforce max query length (~2048 chars), max pairs (~100), max key/value length.

---

### SEC-07: Stream Duck-Typing (HIGH)

**Affected Code**:

```typescript
// packages/adapters/node/src/context.ts#L184-L191
if (typeof (data as any).pipe === 'function') {
  (data as NodeJS.ReadableStream).pipe(this.res);
}
```

**Consequences**: Non-stream objects with `.pipe` method trigger unexpected behavior; stream errors after `_responded=true` → hung connections.

**Fix**: Use `instanceof Readable` check; add `error`/`close` handlers.

---

### SEC-08: Shutdown Race Condition (HIGH)

**Affected Code**: Plugins destroyed before server stops → new requests arrive during/after cleanup.

**Fix**: Stop server → drain connections → destroy plugins → close.

---

### SEC-09: Error Misclassification (HIGH)

**Root Cause**: `errorHandler()` uses `instanceof HttpError` from `@nextrush/errors`, but `ctx.throw()` creates adapter `HttpError`.

**Consequences**: Intended 404/401/403 → 500 in production. Wrong status codes in error responses.

---

## Input Validation Gaps

| Input               |       Validated?        |               Size Limited?               | Sanitized? |
| ------------------- | :---------------------: | :---------------------------------------: | :--------: |
| Request body (Node) | ❌ No try/catch on JSON | ⚠️ Before full buffer (Node), After (Web) |     ❌     |
| Query string        |  ❌ No prototype check  |               ❌ Unbounded                |     ❌     |
| Route params        |      ✅ By router       |                    N/A                    |     ❌     |
| Headers             |       ⚠️ Partial        |                    N/A                    |     ❌     |
| URL path            |      ⚠️ Normalized      |                    N/A                    |     ❌     |

---

## Error Information Disclosure

| What Leaks                      | When                                      | Audience                 |
| ------------------------------- | ----------------------------------------- | ------------------------ |
| Error class name (`err.name`)   | Always (even non-exposed)                 | All clients              |
| Error message                   | When `expose: true` or non-production env | All clients              |
| Stack trace frames              | When `includeStack: true`                 | Misconfigured production |
| File paths (in stack)           | Same as stack                             | Misconfigured production |
| Request path in 404             | Always                                    | All clients              |
| Package structure (class names) | Via `err.name`                            | All clients              |

---

## Recommendations Priority

| Priority | Action                                                       | Effort |
| :------: | ------------------------------------------------------------ | :----: |
|    P0    | Fix prototype pollution (`Object.create(null)` + key filter) | 30 min |
|    P0    | Wire proxy option to IP extraction                           |  1 hr  |
|    P0    | Add try/catch around `JSON.parse` at boundaries              | 30 min |
|    P0    | Replace `require()` with ESM import                          | 15 min |
|    P0    | Fix `send()` double-response bug                             | 30 min |
|    P1    | Add query parameter limits                                   |  1 hr  |
|    P1    | Implement streaming body size check                          |  2 hr  |
|    P1    | Fix graceful shutdown order                                  |  1 hr  |
|    P1    | Unify error classes                                          |  4 hr  |
|    P2    | Mask `err.name` when not exposed                             | 30 min |
|    P2    | Gate stack trace on explicit dev mode                        | 30 min |
|    P2    | Add stream error handlers                                    |  1 hr  |
