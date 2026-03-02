# Adapter-Node Package Audit (`@nextrush/adapter-node`)

## Package Overview

- **Files**: `adapter.ts`, `context.ts`, `body-source.ts`, `utils.ts`, `index.ts`
- **Performance Score**: 5/10
- **Security Score**: 2/10
- **Correctness Score**: 3/10

---

## CRITICAL Issues

### 1. IP Spoofing — Unconditional X-Forwarded-For Trust

See [01-CRITICAL-ISSUES.md → CRIT-02](01-CRITICAL-ISSUES.md)

### 2. `ctx.send(object)` Produces Hung Connections

See [01-CRITICAL-ISSUES.md → CRIT-04](01-CRITICAL-ISSUES.md)

### 3. Prototype Pollution in Query String Parser

See [01-CRITICAL-ISSUES.md → CRIT-03](01-CRITICAL-ISSUES.md)

### 4. `require()` in ESM Module

See [01-CRITICAL-ISSUES.md → CRIT-07](01-CRITICAL-ISSUES.md)

### 5. `JSON.parse` Without try/catch

See [01-CRITICAL-ISSUES.md → CRIT-08](01-CRITICAL-ISSUES.md)

### 6. `console.error`/`console.log` in Production Code

- **Locations**: `packages/adapters/node/src/adapter.ts#L100`, `#L157`, `#L211`
- **Impact**: Forbidden by project rules. No structured logging, potential sensitive data exposure.

---

## HIGH Issues

### 7. Unsafe Graceful Shutdown Order

- **Location**: `packages/adapters/node/src/adapter.ts#L176-L188`
- **Evidence**: Plugins destroyed BEFORE server stops accepting connections
- **Impact**: New requests arrive after plugin cleanup → undefined behavior, null reference errors
- **Fix**: Stop server first → drain connections → destroy plugins → close

### 8. Double Error Listener on Server

- **Location**: `packages/adapters/node/src/adapter.ts#L153`, `#L190`
- **Impact**: Two error handlers on same emitter can produce duplicate error logging/handling

### 9. Duplicate HttpError Class

See [01-CRITICAL-ISSUES.md → CRIT-01](01-CRITICAL-ISSUES.md)

### 10. Stream Response Path Lacks Error Handling

- **Location**: `packages/adapters/node/src/context.ts#L184-L191`
- **Evidence**: `.pipe()` without `error`/`close` handler
- **Impact**: Stream error after `_responded=true` → adapter fallback won't run → hung socket/leaked connection

### 11. Query String DoS — No Parameter Limits

- **Location**: `packages/adapters/node/src/utils.ts#L12-L55`
- **Evidence**: `qs.split('&')` allocates unbounded array, no max-params or max-length limit
- **Impact**: Thousands of query parameters amplify CPU + allocation → DoS vector

---

## MEDIUM Issues

### 12. Duplicate Body Error Classes

- **Location**: `packages/adapters/node/src/body-source.ts#L15-L40`
- **vs**: `packages/runtime/src/body-source.ts#L14-L39`
- **Impact**: `instanceof` fails across packages; maintenance drift

### 13. Cached Body Buffer Never Cleared

- **Location**: `packages/adapters/node/src/body-source.ts#L66-L139`
- **Impact**: Full request body retained in `_cachedBuffer` for context lifetime. If context references leak (logging, queues), this becomes a memory leak.

### 14. Response Methods Don't Consult `res.headersSent`

- **Location**: `packages/adapters/node/src/context.ts#L141-L225`
- **Impact**: Edge cases where raw `res` was used directly → `ctx.*` methods can still attempt writes

### 15. `serve()` Reports Requested Port Not Actual Port

- **Location**: `packages/adapters/node/src/adapter.ts#L167`
- **Impact**: When using port 0 (auto-assign), logged port is 0, not the actual bound port

### 16. DELETE Included in METHODS_WITHOUT_BODY

- **Location**: `packages/adapters/node/src/context.ts#L65`
- **Impact**: DELETE can technically have a body (RFC 9110 doesn't forbid it). Prevents body parsing for DELETE requests.

### 17. No Shutdown Drain Timeout

- **Impact**: Keep-alive sockets can block shutdown indefinitely

---

## LOW Issues

### 18. Fallback Responses Hardcode JSON Without Charset/Length

### 19. Per-Request .then/.catch Closures

### 20. `redirect()` Sends No Body

### 21. Minor Perf: Regex in decode for `+` → space

---

## Per-Request Allocation Table

| Allocation                               | When                    |     Avoidable?      |
| ---------------------------------------- | ----------------------- | :-----------------: |
| `new NodeContext(req, res)`              | Every request           |         No          |
| `{ req, res }` for `ctx.raw`             | Every request           |         Yes         |
| `query = {}`                             | No-query URL            | Yes (shared empty)  |
| `parseQueryString()` result              | Query present           |      Partially      |
| `qs.split('&')` array                    | Query present           |      Partially      |
| `params = {}`                            | Every request           |   Yes (lazy init)   |
| `state = {}`                             | Every request           |      Partially      |
| `createEmptyBodySource()` → new instance | GET/HEAD/OPTIONS/DELETE | **Yes** (singleton) |
| `new NodeBodySource(req)`                | POST/PUT/PATCH          |         No          |
| `JSON.stringify(data)`                   | `ctx.json()`            |         No          |
| `new TextDecoder(...)`                   | `bodySource.text()`     |   **Yes** (reuse)   |
| `Buffer.concat(chunks)`                  | `bodySource.buffer()`   |      Mostly no      |

---

## Security Vulnerabilities Summary

| Issue                                     | Severity     | Impact                                          |
| ----------------------------------------- | ------------ | ----------------------------------------------- |
| Unconditional `X-Forwarded-For` trust     | **CRITICAL** | IP spoofing → bypass rate limiting, poison logs |
| Prototype pollution in `parseQueryString` | **CRITICAL** | Can mutate `Object.prototype` via query params  |
| Unbounded query parsing                   | **HIGH**     | CPU + allocation amplification → DoS            |
| Stream duck-typing + no error handling    | **HIGH**     | Unexpected objects can hang response            |
| Stack traces in error responses           | **MEDIUM**   | File path / structure disclosure                |

---

## Response Method Correctness

| Method       |  Double-Response Safe?  | Stream Safe? |              Error Safe?               |
| ------------ | :---------------------: | :----------: | :------------------------------------: |
| `json()`     |        ✅ Mostly        |     N/A      | ⚠️ Partial (can throw circular/BigInt) |
| `send()`     | **❌ No** (object path) |  ⚠️ Partial  |     **❌** (sets responded early)      |
| `html()`     |        ✅ Mostly        |     N/A      |               ⚠️ Partial               |
| `redirect()` |        ✅ Mostly        |     N/A      |               ⚠️ Partial               |
